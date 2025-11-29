// backend/server.js
import express from 'express';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';
import QRCode from 'qrcode'; // <--- NEW IMPORT

// 1. Load environment variables
dotenv.config();

const app = express();
app.use(cors()); 
app.use(express.json());

// 2. Use config from .env
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;
const ESP_API_KEY = process.env.ESP_API_KEY;
const DB_NAME = "tikets"; // Using your specific DB name

if (!MONGO_URI) {
    console.error("❌ Fatal Error: MONGO_URI is missing in .env");
    process.exit(1);
}

const client = new MongoClient(MONGO_URI);
let db, tickets_collection, users_collection;

async function connectDB() {
    try {
        await client.connect();
        console.log("✅ Connected to MongoDB Atlas");
        db = client.db(DB_NAME);
        tickets_collection = db.collection("tickets");
        users_collection = db.collection("users");
    } catch (e) {
        console.error("❌ MongoDB Connection Error:", e);
    }
}
connectDB();

// --- API ROUTES ---

// 1. Get or Create User
app.post('/api/user', async (req, res) => {
    const { uid } = req.body;
    try {
        let user = await users_collection.findOne({ uid });
        if (!user) {
            user = { uid, wallet: 500, name: 'Commuter', createdAt: new Date() };
            await users_collection.insertOne(user);
        }
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Update Wallet
app.post('/api/wallet', async (req, res) => {
    const { uid, amount } = req.body; 
    try {
        const result = await users_collection.findOneAndUpdate(
            { uid },
            { $inc: { wallet: amount } },
            { returnDocument: 'after' }
        );
        const updatedDoc = result.value || result; 
        res.json(updatedDoc || {});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Create Ticket (UPDATED: NOW GENERATES REAL QR IMAGE)
app.post('/api/createTicket', async (req, res) => {
    const { uid, meta } = req.body;
    const tid = `T-${Date.now()}`; 
    
    try {
        // --- FIX: Generate Real QR Code Image Data ---
        const qrData = JSON.stringify({ 
            tid: tid, 
            uid: uid, 
            src: meta.source, 
            dst: meta.destination 
        });
        
        // This creates a string starting with "data:image/png;base64..."
        const qrDataUrl = await QRCode.toDataURL(qrData); 

        const ticketDoc = {
            tid,
            uid,
            source: meta.source,
            destination: meta.destination,
            amount: meta.amount,
            classType: meta.classType,
            count: meta.count,
            bookingMethod: meta.bookingMethod,
            qrDataUrl: qrDataUrl, // <--- Saving the real image data here
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour expiry
            used: false 
        };

        await tickets_collection.insertOne(ticketDoc);
        console.log(`🎟️ Ticket Created: ${tid}`);
        res.json({ ok: true, tid });

    } catch (e) { 
        console.error("Create Ticket Error:", e);
        res.status(500).json({ ok: false, err: e.message }); 
    }
});

// 4. Get Tickets for User
app.get('/api/user/:uid', async (req, res) => {
    try {
        const tickets = await tickets_collection
            .find({ uid: req.params.uid })
            .sort({ createdAt: -1 })
            .toArray();
        res.json({ ok: true, tickets });
    } catch (e) { res.status(500).json({ ok: false, err: e.message }); }
});

// 5. VALIDATE TICKET (Secured with API Key)
app.post('/api/validate', async (req, res) => {
    const { tid, espId } = req.body;
    const apiKey = req.headers['x-api-key'];

    console.log(`🔍 Validation Request from ${espId} for ${tid}`);

    // A. Check API Key
    if (apiKey !== ESP_API_KEY) {
        console.log(`⛔ Unauthorized Access Attempt with Key: ${apiKey}`);
        return res.status(401).json({ ok: false, err: "unauthorized" });
    }

    try {
        // B. Find Ticket
        const ticket = await tickets_collection.findOne({ tid });

        if (!ticket) {
            console.log("❌ Ticket not found");
            return res.status(400).json({ ok: false, err: "invalid tid" });
        }

        if (new Date() > new Date(ticket.expiresAt)) {
             console.log("❌ Ticket Expired");
             return res.status(400).json({ ok: false, err: "expired" });
        }

        if (ticket.used) {
             console.log("⚠️ Ticket Already Used");
             return res.status(400).json({ ok: false, err: "already used" });
        }

        // C. Update Ticket
        await tickets_collection.updateOne(
            { tid },
            { $set: { used: true, usedAt: new Date(), gateId: espId } }
        );

        console.log("✅ Access Granted");
        res.json({ ok: true });

    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, err: "server error" });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));