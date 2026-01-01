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
app.use(express.json());

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

app.post('/api/events', async (req, res) => {
    const { name, folderPath, contact } = req.body;
    try {
        const { data, error } = await supabase.from('events').insert([{ name, folder_path: folderPath,contact }]).select();
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