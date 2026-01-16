require('dotenv').config();
const express = require('express');
const cors = require('cors');
const chokidar = require('chokidar');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const http = require('http'); 
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for high-quality photos
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Setup HTTP & WebSocket Server
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } 
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

let watcher = null;

// --- API ROUTES ---

app.get('/api/events', async (req, res) => {
    try {
        const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const generatePassword = () => Math.random().toString(36).slice(-8).toUpperCase();
app.post('/api/events', async (req, res) => {
    const { name, folderPath, contact } = req.body;
    const autoPassword = generatePassword();
    try {
         // e.g., "A7B2X9Z1"
        const { data, error } = await supabase.from('events').insert([{ name, folder_path: folderPath,contact,password: autoPassword }]).select();
        if (error) throw error;
        res.json(data[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/start', (req, res) => {
    const { folderPath, eventId, uploadRaw } = req.body;
    if (!folderPath || !eventId) return res.status(400).json({ error: "Missing params" });

    if (watcher) { watcher.close(); }

    watcher = chokidar.watch(folderPath, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 3000 }
    });

    watcher.on('add', async (filePath) => {
        const originalName = path.basename(filePath);
        const fileName = `${Date.now()}-${originalName}`;
        
        // 1. SIGNAL FRONTEND: UPLOAD STARTED
        io.emit('upload-start', { name: originalName });

        try {
            let fileBuffer;
            if (uploadRaw) {
                fileBuffer = fs.readFileSync(filePath);
            } else {
                fileBuffer = await sharp(filePath, { failOn: 'none' })
                    .resize(1600).jpeg({ quality: 80 }).toBuffer();
            }

            const { error: storageErr } = await supabase.storage
                .from('wedding_photos').upload(`live/${fileName}`, fileBuffer, { contentType: 'image/jpeg' });

            if (storageErr) throw storageErr;

            const { data: { publicUrl } } = supabase.storage
                .from('wedding_photos').getPublicUrl(`live/${fileName}`);

            await supabase.from('photos').insert([{ url: publicUrl, event_id: eventId }]);

            // 2. SIGNAL FRONTEND: SUCCESS
            io.emit('upload-success', { name: originalName, time: new Date().toLocaleTimeString() });
            console.log(`✅ ${originalName}`);

        } catch (err) {
            // 3. SIGNAL FRONTEND: ERROR
            io.emit('upload-error', { name: originalName, error: err.message });
        }
    });

    res.json({ message: "Bridge Started" });
});

app.post('/api/stop', (req, res) => {
    if (watcher) {
        watcher.close(); // This physically stops Chokidar from watching your folder
        watcher = null;
        console.log("🛑 Bridge Stopped");
        res.json({ message: "Stopped" });
    } else {
        res.json({ message: "Not running" });
    }
});
const PORT = 5000;
server.listen(PORT, () => {
    console.log(`🌐 Bridge Engine Active on Port ${PORT}`);
});

// --- NEW ADMIN ROUTES ---

// 1. Get current banners
app.get('/api/banners', async (req, res) => {
    const { data, error } = await supabase.from('homepage_banners').select('*').order('display_order', { ascending: true });
    if (error) return res.status(500).json(error);
    res.json(data);
});

// 2. Upload/Update Banner (Slot Restricted)
// ... (keep your existing imports and setup)

// 2. Upload/Update Banner (Slot Restricted)
app.post('/api/banners/upload', async (req, res) => {
    const { fileBuffer, fileName, index, bannerId, contentType } = req.body;
    
    // Log 1: Request Receipt
    console.log(`\n[BANNER REQUEST] Slot: ${index} | File: ${fileName}`);
    console.log(`[INFO] Banner ID provided: ${bannerId || 'None (New Insert)'}`);

    try {
        if (!fileBuffer) throw new Error("No file buffer received");

        const buffer = Buffer.from(fileBuffer, 'base64');
        console.log(`[INFO] Buffer converted. Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

        // Log 2: Starting Storage Upload
        console.log(`[STORAGE] Uploading to bucket: "banners"...`);
        const { error: storageErr } = await supabase.storage
            .from('banners')
            .upload(`${fileName}`, buffer, { contentType, upsert: true });

        if (storageErr) {
            console.error(`[STORAGE ERROR] ${storageErr.message}`);
            throw storageErr;
        }
        console.log(`[STORAGE] Upload Success ✅`);

        const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(`${fileName}`);
        console.log(`[INFO] Public URL generated: ${publicUrl}`);

        // Log 3: Database Operation
        if (bannerId) {
            console.log(`[DATABASE] Updating existing banner ID: ${bannerId}`);
            const { error: dbErr } = await supabase
                .from('homepage_banners')
                .update({ media_url: publicUrl, })
                .eq('id', bannerId);
            
            if (dbErr) throw dbErr;
            console.log(`[DATABASE] Update Success ✅`);
        } else {
            console.log(`[DATABASE] Inserting new banner into slot: ${index}`);
            const { error: dbErr } = await supabase
                .from('homepage_banners')
                .insert([{ media_url: publicUrl, display_order: index }]);
            
            if (dbErr) throw dbErr;
            console.log(`[DATABASE] Insert Success ✅`);
        }

        res.json({ success: true, url: publicUrl });
    } catch (err) {
        console.error(`[CRITICAL ERROR] ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// 3. Delete Event
app.delete('/api/events/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('events').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// Fetch all photos for a specific event
app.get('/api/events/:id/photos', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('photos')
            .select('*')
            .eq('event_id', id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.delete('/api/photos/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Get the URL of the photo to find the storage path
        const { data: photo, error: fetchErr } = await supabase
            .from('photos')
            .select('url')
            .eq('id', id)
            .single();

        if (fetchErr || !photo) throw new Error("Photo not found");

        // 2. Extract the filename from the URL 
        // Example URL: .../storage/v1/object/public/wedding_photos/live/123.jpg
        const urlParts = photo.url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const folderName = urlParts[urlParts.length - 2]; // Usually 'live' or 'portfolio'
        const fullStoragePath = `${folderName}/${fileName}`;

        // 3. Delete from Supabase Storage
        const { error: storageErr } = await supabase.storage
            .from('wedding_photos') // Ensure this matches your bucket name
            .remove([fullStoragePath]);

        if (storageErr) console.warn("Storage deletion warning:", storageErr.message);

        // 4. Delete from Database
        const { error: dbErr } = await supabase
            .from('photos')
            .delete()
            .eq('id', id);

        if (dbErr) throw dbErr;

        console.log(`🗑️ Deleted asset: ${fullStoragePath}`);
        res.json({ success: true, message: "Deleted from storage and database" });

    } catch (err) {
        console.error("Delete Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- PRICING MANAGEMENT ROUTES ---

// 1. Get all packages
app.get('/api/pricing', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pricing_packages')
            .select('*')
            .order('display_order', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Update a specific package
app.put('/api/pricing/:id', async (req, res) => {
    const { id } = req.params;
    const { name, price, description, features, highlight } = req.body;
    try {
        const { data, error } = await supabase
            .from('pricing_packages')
            .update({ name, price, description, features, highlight })
            .eq('id', id)
            .select();
        
        if (error) throw error;
        res.json(data[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- PORTFOLIO MANAGEMENT ROUTES ---

// 1. Get all portfolio items
app.get('/api/portfolio', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('portfolio')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Upload New Portfolio Item (No Compression)
app.post('/api/portfolio/upload', async (req, res) => {
    // 1. Destructure only what we need (Removed title)
    const { fileBuffer, fileName, contentType } = req.body;    
    try {
        if (!fileBuffer) throw new Error("File buffer is empty");

        const buffer = Buffer.from(fileBuffer, 'base64');
        // Standardizing path: no subfolders, just the timestamped filename
        const storagePath = `${Date.now()}-${fileName}`;

        // 2. Upload to 'portfolio_assets' bucket
        const { error: storageErr } = await supabase.storage
            .from('portfolio_assests')
            .upload(storagePath, buffer, { 
                contentType: contentType, 
                upsert: true 
            });

        if (storageErr) {
            console.error("Storage Error:", storageErr.message);
            throw storageErr;
        }

        // 3. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('portfolio_assests')
            .getPublicUrl(storagePath);

        // 4. Insert into 'portfolio' table (Removed title column)
        const { data, error: dbErr } = await supabase
            .from('portfolio')
            .insert([{ 
                media_url: publicUrl, 
                media_type: contentType.includes('video') ? 'video' : 'image' 
            }])
            .select();

        if (dbErr) {
            console.error("Database Error:", dbErr.message);
            throw dbErr;
        }

        res.json(data[0]);
    } catch (err) { 
        console.error("Upload Route Failed:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

// 3. Delete Portfolio Item
app.delete('/api/portfolio/:id', async (req, res) => {
    try {
        const { data: item } = await supabase.from('portfolio').select('media_url').eq('id', req.params.id).single();
        if (item) {
            const path = item.media_url.split('/').pop();
            await supabase.storage.from('portfolio_assests').remove([`portfolio/${path}`]);
        }
        await supabase.from('portfolio').delete().eq('id', req.params.id);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});