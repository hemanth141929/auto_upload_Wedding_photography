require('dotenv').config();
const express = require('express');
const cors = require('cors');
const chokidar = require('chokidar');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

let watcher = null;

// --- API ROUTES ---

// 1. Get all wedding events for the dropdown
app.get('/api/events', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Create a new wedding event
app.post('/api/events', async (req, res) => {
    const { name, folderPath } = req.body;
    try {
        const { data, error } = await supabase
            .from('events')
            .insert([{ name, folder_path: folderPath }])
            .select();
        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Start the bridge sync
app.post('/api/start', (req, res) => {
    const { folderPath, eventId, uploadRaw } = req.body; // Get uploadRaw from request

    if (!folderPath || !eventId) {
        return res.status(400).json({ error: "Missing folderPath or eventId" });
    }

    if (watcher) {
        watcher.close();
    }

    console.log(`🚀 Bridge Active | Raw Mode: ${uploadRaw} | Watching: ${folderPath}`);

    watcher = chokidar.watch(folderPath, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 3000 }
    });

    watcher.on('add', async (filePath) => {
        const fileName = `${Date.now()}-${path.basename(filePath)}`;
        console.time(`Process-${fileName}`);

        try {
            let fileBuffer;

            if (uploadRaw) {
                // PATH A: RAW UPLOAD
                fileBuffer = fs.readFileSync(filePath);
                console.log(`📦 Reading Raw: ${fileName}`);
            } else {
                // PATH B: COMPRESSED UPLOAD
                console.log(`🗜️ Compressing: ${fileName}`);
                fileBuffer = await sharp(filePath, { failOn: 'none' })
                    .resize(1600) // Resize to a standard large web size
                    .jpeg({ quality: 80 }) // 80% quality is perfect for web
                    .toBuffer();
            }

            // Upload to Storage
            const { error: storageErr } = await supabase.storage
                .from('wedding_photos')
                .upload(`live/${fileName}`, fileBuffer, { 
                    contentType: 'image/jpeg',
                    upsert: false 
                });

            if (storageErr) throw storageErr;

            const { data: { publicUrl } } = supabase.storage
                .from('wedding_photos')
                .getPublicUrl(`live/${fileName}`);

            // Insert into Photos Table
            const { error: dbErr } = await supabase
                .from('photos')
                .insert([{ url: publicUrl, event_id: eventId }]);

            if (dbErr) throw dbErr;

            console.log(`✅ Success: ${fileName} (${uploadRaw ? 'RAW' : 'COMPRESSED'})`);
            console.timeEnd(`Process-${fileName}`);
        } catch (err) {
            console.error("❌ Sync Error:", err.message);
        }
    });

    res.json({ message: "Bridge Started!", rawMode: uploadRaw });
});
app.post('/api/stop', (req, res) => {
    if (watcher) {
        watcher.close();
        watcher = null;
        console.log("🛑 Bridge Stopped via Dashboard");
        res.json({ message: "Bridge Stopped" });
    } else {
        res.json({ message: "No active bridge to stop" });
    }
});

// CRITICAL: This keeps the process alive!
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🌐 Bridge Engine running at http://localhost:${PORT}`);
    console.log(`👉 Waiting for commands from Next.js Dashboard...`);
});