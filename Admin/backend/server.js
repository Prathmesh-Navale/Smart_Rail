import express from 'express';
import cors from 'cors';
import { NlpManager } from 'node-nlp';
import mongoose from 'mongoose';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. MONGODB CONNECTION ---
mongoose.connect('mongodb://127.0.0.1:27017/tikets')
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ DB Error:", err));

// Schemas
const TrafficSchema = new mongoose.Schema({ station: String, level: String, count: Number });
const AlertSchema = new mongoose.Schema({ time: String, location: String, type: String, severity: String, status: String });
const SosSchema = new mongoose.Schema({ time: String, train: String, type: String, status: String });

const Traffic = mongoose.model('Traffic', TrafficSchema);
const Alert = mongoose.model('Alert', AlertSchema);
const SOS = mongoose.model('SOS', SosSchema);

// --- 2. TRAIN THE SUPER-CHARGED LOCAL AI ---
// We use a threshold of 0.8 to prevent wrong guesses
const manager = new NlpManager({ languages: ['en'], forceNER: true, nlu: { log: true } });

// --- INTENT: NAVIGATION (DASHBOARD) ---
manager.addDocument('en', 'go to dashboard', 'nav.dashboard');
manager.addDocument('en', 'open dashboard', 'nav.dashboard');
manager.addDocument('en', 'show me the dashboard', 'nav.dashboard');
manager.addDocument('en', 'back to home', 'nav.dashboard');
manager.addDocument('en', 'main menu', 'nav.dashboard');
manager.addDocument('en', 'home screen', 'nav.dashboard');
manager.addDocument('en', 'open overview', 'nav.dashboard');

// --- INTENT: NAVIGATION (ALERTS) ---
manager.addDocument('en', 'open alerts', 'nav.alerts'); // <--- The one you missed!
manager.addDocument('en', 'show alerts', 'nav.alerts');
manager.addDocument('en', 'go to alerts', 'nav.alerts');
manager.addDocument('en', 'view active alerts', 'nav.alerts');
manager.addDocument('en', 'are there any warnings', 'nav.alerts');
manager.addDocument('en', 'show me the danger zones', 'nav.alerts');
manager.addDocument('en', 'alert list', 'nav.alerts');
manager.addDocument('en', 'open notifications', 'nav.alerts');

// --- INTENT: NAVIGATION (TICKETS) ---
manager.addDocument('en', 'check tickets', 'nav.tickets');
manager.addDocument('en', 'open tickets', 'nav.tickets');
manager.addDocument('en', 'show compliance', 'nav.tickets');
manager.addDocument('en', 'ticket status', 'nav.tickets');
manager.addDocument('en', 'revenue report', 'nav.tickets');
manager.addDocument('en', 'compliance view', 'nav.tickets');
manager.addDocument('en', 'ticket sales', 'nav.tickets');

// --- INTENT: NAVIGATION (SOS) ---
manager.addDocument('en', 'open sos', 'nav.sos');
manager.addDocument('en', 'show sos', 'nav.sos');
manager.addDocument('en', 'emergency', 'nav.sos');
manager.addDocument('en', 'help', 'nav.sos');
manager.addDocument('en', 'dispatch team', 'nav.sos');
manager.addDocument('en', 'show emergencies', 'nav.sos');
manager.addDocument('en', 'medical emergency', 'nav.sos');
manager.addDocument('en', 'police support', 'nav.sos');

// --- INTENT: NAVIGATION (LIVE FEED) ---
manager.addDocument('en', 'show cameras', 'nav.feed');
manager.addDocument('en', 'open live feed', 'nav.feed');
manager.addDocument('en', 'cctv', 'nav.feed');
manager.addDocument('en', 'video feed', 'nav.feed');
manager.addDocument('en', 'watch live', 'nav.feed');
manager.addDocument('en', 'camera view', 'nav.feed');
manager.addDocument('en', 'platform view', 'nav.feed');

// --- INTENT: DATA QUERIES ---
manager.addDocument('en', 'how is the traffic', 'query.traffic');
manager.addDocument('en', 'traffic status', 'query.traffic');
manager.addDocument('en', 'where is the most crowd', 'query.traffic');
manager.addDocument('en', 'is it crowded', 'query.traffic');
manager.addDocument('en', 'crowd levels', 'query.traffic');
manager.addDocument('en', 'which station is busy', 'query.traffic');

// --- RESPONSES (Mapped to Intents) ---
manager.addAnswer('en', 'nav.dashboard', 'Navigating to Dashboard.');
manager.addAnswer('en', 'nav.alerts', 'Opening Alerts View.');
manager.addAnswer('en', 'nav.tickets', 'Opening Tickets View.');
manager.addAnswer('en', 'nav.sos', 'Opening SOS Dispatch.');
manager.addAnswer('en', 'nav.feed', 'Showing Live Feed.');
manager.addAnswer('en', 'query.traffic', 'DATA_HOOK:TRAFFIC');

// --- TRAIN FUNCTION ---
const trainModel = async () => {
  // Optional: Delete old model file to force fresh training
  if (fs.existsSync('./model.nlp')) {
    fs.unlinkSync('./model.nlp');
  }
  
  console.log("🧠 Training New AI Brain...");
  await manager.train();
  manager.save();
  console.log("✅ AI Training Complete!");
};

trainModel();

// --- 3. API ENDPOINTS ---

app.get('/api/dashboard', async (req, res) => {
  try {
    const traffic = await Traffic.find();
    const alerts = await Alert.find();
    const sos = await SOS.find();
    res.json({ traffic, alerts, sos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    // Process the text
    const result = await manager.process('en', message);
    
    console.log(`User: ${message} | Intent: ${result.intent} | Score: ${result.score}`);

    let reply = result.answer;
    let action = "NONE";
    let target = null;

    // Fallback if confidence is too low
    if (!result.intent || result.score < 0.7) {
        reply = "I didn't quite catch that. Try saying 'Open Alerts' or 'Show Traffic'.";
    }

    // Logic Hooks
    if (reply === 'DATA_HOOK:TRAFFIC') {
        const critical = await Traffic.findOne({ level: "Critical" });
        reply = critical 
          ? `Traffic is Critical at ${critical.station} (${critical.count} pax).`
          : "Traffic is normal across all stations.";
    }

    // Navigation Mapping
    if (result.intent === 'nav.dashboard') { action = "NAVIGATE"; target = "dashboard"; }
    if (result.intent === 'nav.alerts') { action = "NAVIGATE"; target = "alerts"; }
    if (result.intent === 'nav.tickets') { action = "NAVIGATE"; target = "tickets"; }
    if (result.intent === 'nav.sos') { action = "NAVIGATE"; target = "sos"; }
    if (result.intent === 'nav.feed') { action = "NAVIGATE"; target = "live_feed"; }

    res.json({ reply, action, target });

  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: "Brain Error" });
  }
});

app.listen(5000, () => console.log("🚀 SmartRail Server running on 5000"));
 