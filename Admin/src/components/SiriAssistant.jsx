// src/components/SiriAssistant.jsx
import React, { useEffect, useRef, useState } from "react";
// Assumes VoiceCommand.jsx is one folder up in src/
import { useVoiceCommand } from "../VoiceCommand"; 

export default function SiriAssistant({ apiBaseUrl = "http://localhost:4000", onNavigate, onAction }) {
  const [hasStarted, setHasStarted] = useState(false);
  const [mode, setMode] = useState("idle"); // idle, listening, processing, speaking
  const [log, setLog] = useState("");
  const synthRef = useRef(window.speechSynthesis);

  // --- Voice Logic ---
  const onWake = () => {
    setMode("listening");
    wakeTone();
    // Delay slightly to let the tone finish
    setTimeout(() => vc.startCommand(), 300);
  };

  const onCommand = (text) => {
    setLog(`"${text}"`);
    setMode("processing");
    sendToServer(text);
  };

  const onError = (err) => console.warn(err);

  const vc = useVoiceCommand({ onWake, onCommand, onError });

  const handleStart = async () => {
    await navigator.mediaDevices.getUserMedia({ audio: true }); // Request Mic
    setHasStarted(true);
    speak("Assistant Online.");
  };

  const speak = (text) => {
    setMode("speaking");
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => {
      setMode("idle");
      // Resume wake listener
      setTimeout(() => vc.startWake(), 100);
    };
    synthRef.current.speak(u);
  };

  const wakeTone = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(800, ctx.currentTime);
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  const sendToServer = async (userText) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userText }),
      });
      const json = await res.json();
      
      // Execute Action
      if (json.action === "navigate") onNavigate(json.execResult?.data?.route || json.target);
      if (json.action === "filter") onAction("filter", json.execResult?.data?.filter);
      
      speak(json.reply);
    } catch (e) {
      speak("I lost connection to the server.");
      setMode("idle");
    }
  };

  // --- Visuals (The "Siri" Orb) ---
  return (
    <>
      {!hasStarted && (
        <div onClick={handleStart} className="fixed inset-0 z-[120] bg-black/90 flex flex-col items-center justify-center cursor-pointer text-white animate-in fade-in">
          <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-pulse blur-md flex items-center justify-center">
            <div className="bg-white text-blue-900 font-bold w-20 h-20 rounded-full flex items-center justify-center">GO</div>
          </div>
          <p className="mt-4 font-mono">Tap to Initialize AI</p>
        </div>
      )}

      {hasStarted && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
          {/* The Siri Orb Container */}
          <div className="relative flex items-center justify-center w-32 h-32">
            
            {/* 1. Outer Glow (Listening) */}
            <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-500 
              ${mode === 'listening' ? 'bg-blue-500/60 scale-150' : 
                mode === 'processing' ? 'bg-purple-500/60 scale-125 animate-spin' : 
                'bg-gray-500/20 scale-100'}`} 
            />

            {/* 2. Core Orb */}
            <div className={`relative w-16 h-16 rounded-full shadow-2xl overflow-hidden transition-all duration-300
              ${mode === 'listening' ? 'scale-110 border-4 border-blue-400 bg-black' : 
                mode === 'processing' ? 'scale-90 border-4 border-purple-400 bg-black' : 
                mode === 'speaking' ? 'scale-125 border-none bg-gradient-to-tr from-green-400 to-blue-500 animate-pulse' :
                'bg-gray-800 border-2 border-gray-600'}`}
            >
               {/* Inner Visuals for Core */}
               {mode === 'listening' && <div className="absolute inset-0 bg-blue-500 animate-ping opacity-20"/>}
            </div>

            {/* 3. Text Label */}
            <div className="absolute -bottom-12 whitespace-nowrap bg-black/70 backdrop-blur-md px-4 py-1 rounded-full text-white text-sm font-medium border border-white/10">
               {mode === 'idle' && "Say 'Hey Rail'"}
               {mode === 'listening' && "Listening..."}
               {mode === 'processing' && "Thinking..."}
               {mode === 'speaking' && "Assistant"}
            </div>

            {/* 4. Log Transcript */}
            {log && mode !== 'idle' && (
               <div className="absolute -top-16 whitespace-nowrap text-white text-lg font-light drop-shadow-md">
                 {log}
               </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}