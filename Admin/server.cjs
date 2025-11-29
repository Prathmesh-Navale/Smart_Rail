// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bodyParser = require("body-parser");

// Optional: Google Gemini SDK
let GoogleGenerativeAI = null;
try {
  GoogleGenerativeAI = require("@google/generative-ai").GoogleGenerativeAI;
} catch (e) {
  console.warn("Google SDK not found. Using keyword fallback.");
}

const app = express();
app.use(helmet());
// Allow all origins for development to prevent CORS errors
app.use(cors({ origin: "*" })); 
app.use(bodyParser.json({ limit: "10mb" }));

const PORT = process.env.PORT || 4000;
const GEN_KEY = process.env.GEN_AI_API_KEY || "";
const genAI = GoogleGenerativeAI ? new GoogleGenerativeAI(GEN_KEY) : null;

// Mock Executors
const Executors = {
  navigate: async (target) => {
    // Return clean ID (remove slash) to match React State
    const cleanTarget = target.replace('/', '').toLowerCase();
    return { success: true, message: `Navigating to ${cleanTarget}`, data: { route: cleanTarget } };
  },
  filter: async (target) => {
    return { success: true, message: `Filter applied: ${target}`, data: { filter: target } };
  },
  create_ticket: async (target) => {
    const fakeId = `TICKET-${Date.now() % 100000}`;
    return { success: true, message: `Ticket created: ${fakeId}`, data: { ticketId: fakeId } };
  },
  sos: async (target) => {
    return { success: true, message: `SOS raised`, data: { sosId: `SOS-${Date.now()}` } };
  },
  live_feed: async (target) => {
    return { success: true, message: "Opening Live Feed", data: { url: "live_feed" } };
  },
  none: async (_) => {
    return { success: false, message: "No action taken" };
  }
};

// Keyword Fallback
function simpleParse(userText) {
  const t = userText.toLowerCase();
  if (t.includes("dashboard")) return { action: "navigate", target: "dashboard", reply: "Opening dashboard." };
  if (t.includes("alert")) return { action: "navigate", target: "alerts", reply: "Showing alerts." };
  if (t.includes("ticket") || t.includes("compliance")) return { action: "navigate", target: "tickets", reply: "Opening tickets." };
  if (t.includes("sos") || t.includes("emergency")) return { action: "navigate", target: "sos", reply: "Opening emergency panel." };
  if (t.includes("live") || t.includes("camera")) return { action: "navigate", target: "live_feed", reply: "Opening camera feed." };
  
  if (t.includes("safety")) return { action: "filter", target: "Safety", reply: "Filtering for Safety issues." };
  if (t.includes("high")) return { action: "filter", target: "High", reply: "Filtering high priority items." };
  
  return { action: "none", target: "", reply: "I'm not sure how to handle that." };
}

// AI Extractor
function extractJsonFromModel(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(raw.substring(start, end + 1)); } catch (e) { return null; }
}

app.post("/api/assistant", async (req, res) => {
  const { userText = "" } = req.body;
  if (!userText) return res.status(400).json({ error: "No text provided" });

  try {
    let parsed = null;
    if (genAI) {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `
        You are a Train Dashboard Assistant. User said: "${userText}".
        Actions: navigate, filter, create_ticket, sos, live_feed, none.
        Targets: dashboard, alerts, tickets, sos, live_feed.
        Reply JSON: {"action":"...", "target":"...", "reply":"..."}
      `;
      const result = await model.generateContent(prompt);
      parsed = extractJsonFromModel(await result.response.text());
    }

    if (!parsed) parsed = simpleParse(userText);

    const action = parsed.action || "none";
    const execResult = Executors[action] ? await Executors[action](parsed.target) : await Executors.none();

    return res.json({
      action,
      reply: parsed.reply,
      execResult
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ reply: "System error." });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));