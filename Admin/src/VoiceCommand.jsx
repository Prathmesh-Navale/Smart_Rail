// src/VoiceCommand.jsx
import { useEffect, useRef } from "react";

export function useVoiceCommand({ onWake, onCommand, onError, wakeWord = "hey rail", lang = "en-US" } = {}) {
  const wakeRef = useRef(null);
  const commandRef = useRef(null);
  const wakeModeRef = useRef(true); 

  useEffect(() => {
    // Browser Compat Check
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (onError) onError(new Error("Browser not supported. Use Chrome."));
      return;
    }

    // 1. Wake Word Listener
    const wake = new SpeechRecognition();
    wake.continuous = true;
    wake.lang = lang;
    wake.interimResults = false;

    wake.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const text = last[0].transcript.toLowerCase();
      // Tolerant check
      if (text.includes(wakeWord) || text.includes("hey real") || text.includes("rail assistant")) {
        wakeModeRef.current = false;
        onWake && onWake(text);
        wake.stop(); 
      }
    };

    wake.onend = () => {
      if (wakeModeRef.current) try { wake.start(); } catch (e) {}
    };
    wakeRef.current = wake;

    // 2. Command Listener
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.lang = lang;
    rec.interimResults = false;

    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      onCommand && onCommand(text);
    };

    rec.onend = () => {
      wakeModeRef.current = true; // Go back to waiting for wake word
      try { wakeRef.current?.start(); } catch (e) {}
    };
    commandRef.current = rec;

    return () => {
      wakeModeRef.current = false;
      wake.stop();
      rec.stop();
    };
  }, []);

  return {
    startWake: () => { wakeModeRef.current = true; try { wakeRef.current?.start(); } catch(e){} },
    startCommand: () => { try { commandRef.current?.start(); } catch(e){} }
  };
}

export default useVoiceCommand;