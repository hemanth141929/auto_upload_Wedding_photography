require('dotenv').config();
const express = require('express');
const cors = require('cors');
const chokidar = require('chokidar');
const { createClient } = require('@supabase/supabase-js');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const http = require('http'); 
const { Server } = require('socket.io');

const app = express();
app.use(cors({
  origin: "https://auto-upload-wedding-photography.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Increase limit for high-quality photos
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Setup HTTP & WebSocket Server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://auto-upload-wedding-photography.vercel.app",
    methods: ["GET", "POST"]
  }
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});
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
        
        io.emit('upload-start', { name: originalName });

        try {
            let fileBuffer;
            if (uploadRaw) {
                fileBuffer = fs.readFileSync(filePath);
            } else {
                fileBuffer = await sharp(filePath, { failOn: 'none' })
                    .resize(1600).jpeg({ quality: 80 }).toBuffer();
            }

            // --- REPLACED SUPABASE WITH CLOUDFLARE R2 ---
            const key = `live/${fileName}`;
            await r2.send(new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: key,
                Body: fileBuffer,
                ContentType: 'image/jpeg'
            }));

            // Construct Public URL (Replaces getPublicUrl)
            const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
            console.log(`Uploaded to R2: ${publicUrl}`);

            // Save to Supabase DATABASE (Remains same)
            await supabase.from('photos').insert([{ url: publicUrl, event_id: eventId }]);

            io.emit('upload-success', { name: originalName, time: new Date().toLocaleTimeString() });
            console.log(`✅ ${originalName}`);

        } catch (err) {
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

    try {
        // 1. Fetch the media_url from Supabase to know what to delete in R2
        const { data: item, error: fetchErr } = await supabase
            .from('photos')
            .select('url')
            .eq('id', req.params.id)
            .single();

        if (fetchErr || !item) throw new Error("Portfolio item not found");

        // 2. Extract the R2 Key from the URL
        // Example: https://pub-xxx.r2.dev/portfolio/12345-image.jpg -> portfolio/12345-image.jpg
        const key = item.url.replace(`${process.env.R2_PUBLIC_URL}/`, '');
        
        // 3. Delete from Cloudflare R2
        console.log(`🗑️ Attempting to delete from R2: ${key}`);
        await r2.send(new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
        }));

        // 4. Delete from Supabase Database
        const { error: dbErr } = await supabase
            .from('photos')
            .delete()
            .eq('id', req.params.id);

        if (dbErr) throw dbErr;

        res.json({ success: true, message: "Deleted from Cloudflare and Database" });
    } catch (err) {
        console.error("Delete Portfolio Error:", err.message);
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

// ... existing imports (r2 client and PutObjectCommand)

// Manual Upload Route for Specific Events (Linked to Cloudflare R2)
app.post('/api/photos/upload', async (req, res) => {
    const { fileBuffer, fileName, eventId, contentType } = req.body;
    
    try {
        if (!fileBuffer) throw new Error("No file data received");
        if (!eventId) throw new Error("No Event ID provided");

        // 1. Convert Base64 string from frontend to a Buffer
        const buffer = Buffer.from(fileBuffer, 'base64');
        
        // 2. Define the Cloudflare R2 Key (Path)
        const key = `live/${Date.now()}-${fileName}`;

        // 3. Upload to Cloudflare R2 (Same logic as api/start)
        await r2.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType || 'image/jpeg', // Use dynamic content type
        }));

        // 4. Construct the Public URL
        const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
        console.log(`📸 Manual Upload Success: ${publicUrl}`);

        // 5. Save metadata to Supabase 'photos' table
        const { data, error: dbErr } = await supabase
            .from('photos')
            .insert([{ 
                url: publicUrl, 
                event_id: eventId 
            }])
            .select();

        if (dbErr) throw dbErr;

        // Return the new photo object to the frontend
        res.json(data[0]);

    } catch (err) {
        console.error("❌ Photo Upload Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});