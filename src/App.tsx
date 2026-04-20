import React, { useState, useEffect, useRef } from 'react';
import { Orb, OrbState } from './components/Orb';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { generateChatResponse, generateSpeech } from './services/aiService';
import { MessageSquare, Settings2, History, X, Volume2, Square, Volume1, VolumeX, Mic } from 'lucide-react';
import { ambientStyles } from './styles';

type Role = 'user' | 'model';

interface Message {
  id: string;
  role: Role;
  text: string;
}

interface Personality {
  id: string;
  name: string;
  voiceName: string;
  color: string;
  systemPrompt: string;
}

const PERSONALITIES: Personality[] = [
  {
    id: 'default',
    name: 'Hindi Alexa',
    voiceName: 'Kore',
    color: '#00ccff', // Blue/Cyan
    systemPrompt: 'You are a highly capable voice assistant, similar to Alexa. You MUST understand user input in Hindi or Hinglish, and you MUST always reply in pure Hindi (written in Devanagari script). Be very fast, concise, and helpful. Do not use markdown or emojis since your output will be spoken via TTS.'
  },
  {
    id: 'friendly',
    name: 'Dost (Hindi)',
    voiceName: 'Zephyr',
    color: '#ff66aa', // Pink
    systemPrompt: 'You are a super friendly, enthusiastic best friend. You MUST speak in friendly conversational Hindi (Devanagari script). Keep things lighthearted, energetic, and express emotion warmly. Keep responses very short, fast, and avoid markdown.'
  },
  {
    id: 'professional',
    name: 'Professional Assistant',
    voiceName: 'Puck',
    color: '#00ff88', // Green
    systemPrompt: 'You are an elite executive assistant. You MUST speak in formal Hindi (Devanagari script). You are precise, organized, and polite. Keep responses completely unambiguous and strictly concise. Prevent using markdown.'
  }
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [selectedPersonalityId, setSelectedPersonalityId] = useState<string>('default');
  const [showHistory, setShowHistory] = useState(false);
  const [volume, setVolume] = useState<number>(1);
  
  // Audio States
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const hasWokenRef = useRef(false);
  
  const [audioBlocked, setAudioBlocked] = useState(false);

  const [hasInteracted, setHasInteracted] = useState(false);

  // Global Interaction Tracker to unblock AudioContext
  useEffect(() => {
    const handleInteraction = () => {
      setHasInteracted(true);
      setAudioBlocked(false);
    };
    
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  const activePersonality = PERSONALITIES.find(p => p.id === selectedPersonalityId) || PERSONALITIES[0];

  const isWakeWordDetected = (text: string) => {
    const t = text.toLowerCase();
    const wakeWords = ['alexa', 'एलेक्सा', 'अलेक्सा', 'ऐलेक्सा', 'alixa', 'elixa', 'election', 'eleksa', 'aliksa', 'aleksa'];
    return wakeWords.some(w => t.includes(w));
  };

  // Speech Recognition hook
  const { isListening, transcript, startListening, stopListening, error } = useSpeechRecognition(
    async (finalText) => {
      if (finalText.trim() === '') return;
      
      const lowerText = finalText.toLowerCase();
      
      // We no longer require a wake word to reply, so the assistant never ignores the user.
      const isWakeWordDetected = true; // Kept for compatibility with other logic that expects a truthy value when it shouldn't be ignored

      // Voice Control System Commands
      const isCmd = (triggers: string[]) => triggers.some(t => lowerText.includes(t));

      // 1. Stop / Shut Up
      if (isCmd(['alexa stop', 'alexa chup', 'alexa quiet', 'alexa ruk jao'])) {
         stopBotAudio();
         return;
      }

      // 2. Clear History Command
      if (isCmd(['alexa clear history', 'alexa delete history', 'alexa bhul jao'])) {
         setMessages([]);
         localStorage.removeItem('voice-assistant-history');
         stopBotAudio();
         return;
      }

      // 3. Volume Control Commands
      if (isCmd(['alexa volume up', 'alexa increase volume', 'alexa awaaz badhao'])) {
         setVolume(v => Math.min(1, v + 0.3));
         return;
      }

      if (isCmd(['alexa volume down', 'alexa decrease volume', 'alexa awaaz kam karo'])) {
         setVolume(v => Math.max(0.1, v - 0.3));
         return;
      }

      if (isCmd(['alexa mute', 'mute yourself'])) {
          setVolume(0);
          return;
      }

      if (isCmd(['alexa unmute', 'alexa unmute karo'])) {
          setVolume(1);
          return;
      }
      
      // If the user hasn't clicked yet, we CANNOT play audio.
      if (!hasInteracted) {
         setAudioBlocked(true); // Flash banner
         // Also add it to the chat so they realize it was heard but couldn't be spoken
         const newMessage: Message = { id: Date.now().toString(), role: 'user', text: finalText };
         const modelMsg: Message = { id: (Date.now()+1).toString(), role: 'model', text: "(Please tap the screen so I can reply back out loud!)" };
         setMessages(prev => [...prev, newMessage, modelMsg]);
         return;
      }

      // If it passes all command checks, handle as normal conversational input
      handleUserInput(finalText);
    }
  );

  useEffect(() => {
    // Load history from local storage on mount
    const saved = localStorage.getItem('voice-assistant-history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch(e) {}
    }
  }, []);

  useEffect(() => {
    // Save history when it changes
    localStorage.setItem('voice-assistant-history', JSON.stringify(messages));
    
    // Auto-scroll chat
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Safely manage Orb Visual State
  useEffect(() => {
    if (!isListening) {
      hasWokenRef.current = false;
    }

    if (isAudioPlaying) setOrbState('speaking');
    else if (isThinking) setOrbState('thinking');
    else if (isListening) {
      // It's always active now, no wake word needed
      if (transcript.trim() !== '') {
        setOrbState('listening');
        // We only play wake chime if it's the very first time it woke in this listening burst
        if (!hasWokenRef.current) {
          hasWokenRef.current = true;
          // Play wake chime beep
          try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              const gainNode = ctx.createGain();

              osc.connect(gainNode);
              gainNode.connect(ctx.destination);

              // Play a pleasant "ding" sound
              osc.type = 'sine';
              osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
              osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1); // A5

              gainNode.gain.setValueAtTime(0, ctx.currentTime);
              gainNode.gain.linearRampToValueAtTime(0.15 * volume, ctx.currentTime + 0.02);
              gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 0.3);
            }
          } catch (e) {
             console.error("Audio beep failed", e);
          }
        }
      } else {
        setOrbState('idle');
      }
    }
    else setOrbState('idle');
  }, [isAudioPlaying, isListening, isThinking, transcript, volume]);

  // Always-On Feature: Auto-Restart Mic when inactive
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (!isListening && !isAudioPlaying && !isThinking && !error) {
      timeoutId = setTimeout(() => {
        startListening();
      }, 500); // 500ms delay to prevent browser spam
    }
    return () => clearTimeout(timeoutId);
  }, [isListening, isAudioPlaying, isThinking, error, startListening]);

  // Auto-start on load
  useEffect(() => {
    startListening();
  }, [startListening]);

  // Adjust volume when state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const stopBotAudio = () => {
    if (audioRef.current && isAudioPlaying) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
    }
  };

  const handleUserInput = async (text: string) => {
    const newMessage: Message = { id: Date.now().toString(), role: 'user', text };
    const chatHistory = [...messages, newMessage];
    setMessages(chatHistory);
    
    setIsThinking(true);
    
    // Stop any playing audio safely by not just calling pause on a possibly pending promise
    stopBotAudio();

    try {
      // 1. Get the LLM completion
      const responseText = await generateChatResponse(
        text, 
        messages.map(m => ({ role: m.role, text: m.text })), 
        activePersonality.systemPrompt
      );

      const modelMessage: Message = { id: (Date.now()+1).toString(), role: 'model', text: responseText };
      setMessages(prev => [...prev, modelMessage]);

      // 2. TTS the response
      const audioUrl = await generateSpeech(responseText, activePersonality.voiceName);
      
      if (audioUrl) {
        if (!audioRef.current) {
          audioRef.current = new Audio();
          audioRef.current.onended = () => setIsAudioPlaying(false);
          audioRef.current.onerror = () => setIsAudioPlaying(false);
        }
        
        // Ensure standard DOM operations
        audioRef.current.src = audioUrl;
        audioRef.current.volume = volume;
        setIsAudioPlaying(true);
        
        // Cache the play promise so we don't accidentally try to pause it while it's loading
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            if (e.name === 'NotAllowedError') {
              console.error("Audio playback prevented by browser:", e);
              setAudioBlocked(true); // Show non-blocking banner again
            } else if (e.name === 'AbortError') {
              console.log("Audio playback was aborted appropriately by user interaction.");
            } else {
              console.error("Audio playback error:", e);
            }
            setIsAudioPlaying(false);
          });
        }
      }
      setIsThinking(false);

    } catch (err) {
      console.error(err);
      setIsThinking(false);
    }
  };

  return (
    <>
      <style>{ambientStyles}</style>
      <div className="relative min-h-screen bg-[#050505] text-white overflow-hidden font-sans flex flex-col cursor-pointer">
        
        {/* Interaction Banner Overlay (Non-blocking) */}
        {audioBlocked && (
          <div className="absolute top-0 w-full bg-blue-600/90 text-white p-3 text-center text-sm font-medium z-50 animate-in slide-in-from-top cursor-pointer shadow-lg backdrop-blur-sm">
             Tap anywhere on the screen so Alexa can talk back to you!
          </div>
        )}

        <div className="atmosphere pointer-events-none" />
        
        {/* Main Interface Content */}
        <div className="relative z-10 flex flex-col items-center justify-between h-screen p-6">
          
          {/* Header */}
          <header className="w-full max-w-4xl flex items-center justify-between">
            <div className="flex gap-4">
              <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-3">
                <Settings2 size={16} className="text-gray-400" />
                <select 
                  value={selectedPersonalityId} 
                  onChange={(e) => setSelectedPersonalityId(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm font-medium cursor-pointer"
                >
                  {PERSONALITIES.map(p => (
                    <option key={p.id} value={p.id} className="bg-gray-900 text-white">{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Volume Control */}
              <div className="glass-panel px-4 py-2 rounded-full hidden sm:flex items-center gap-3">
                {volume === 0 ? <VolumeX size={16} className="text-gray-400" /> : <Volume1 size={16} className="text-gray-400" />}
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={volume} 
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 accent-white"
                />
              </div>
            </div>
            
             <div className="flex gap-3">
               {/* Stop Audio Button (Only shows when speaking) */}
               {isAudioPlaying && (
                 <button 
                    onClick={stopBotAudio}
                    className="glass-panel px-4 py-2 rounded-full flex gap-2 items-center text-red-400 hover:text-red-300 transition-colors animate-pulse"
                 >
                    <Square size={14} fill="currentColor" />
                    <span className="text-xs font-semibold uppercase tracking-wider hidden sm:block">Stop</span>
                 </button>
               )}

              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="glass-panel p-3 rounded-full hover:bg-white/10 transition-colors"
                title="View Conversation History"
              >
                <History size={18} />
              </button>
            </div>
          </header>

          {/* Assistant Visualizer (The Orb) */}
          <main className="flex-1 flex flex-col items-center justify-center w-full">
            <Orb state={orbState} colorHex={activePersonality.color} />
            
            {/* Contextual textual feedback */}
            <div className="h-16 mt-12 flex flex-col items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <p className={`text-sm font-semibold uppercase tracking-widest flex items-center gap-2 transition-colors duration-500 ${orbState === 'idle' ? 'text-white/30' : 'text-[#00ccff] drop-shadow-[0_0_10px_rgba(0,204,255,0.5)]'}`}>
                  <Volume2 size={16} className={orbState === 'idle' ? '' : 'animate-pulse'} /> 
                  {orbState === 'idle' ? 'Listening...' : 'Voice Control Active'}
                </p>
                {transcript && orbState === 'listening' && (
                   <p className="text-xl font-light text-white/80 tracking-wide mt-2 animate-in fade-in zoom-in duration-300">
                     {transcript}
                   </p>
                )}
              </div>
              {isThinking && (
                 <p className="text-sm font-medium text-white/50 tracking-widest uppercase mt-4">Thinking</p>
              )}
            </div>
          </main>

          {/* Footer - No buttons anymore! Just pure voice UI */}
          <footer className="w-full max-w-md flex flex-col items-center pb-8 gap-6">
             {error && error !== 'not-allowed' && <p className="text-red-400 text-sm text-center px-4 bg-red-500/10 py-2 rounded-lg">{error}</p>}
             <div className="glass-panel px-6 py-3 rounded-2xl flex flex-col items-center gap-2">
                <p className="text-xs text-center text-gray-400 max-w-xs uppercase tracking-widest leading-relaxed">
                  Always Listening (No Alexa Needed)
                </p>
                <p className="text-sm text-white/80 font-medium">
                   "aaz mausam kaisa hai?"
                </p>
                <p className="text-sm text-white/80 font-medium">
                   "ek badhiya joke sunao"
                </p>
             </div>
          </footer>
        </div>

        {/* Permissions Overlay Fallback */}
        {error === 'not-allowed' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-6 text-center">
            <Mic size={48} className="text-red-400 mb-6" />
            <h2 className="text-2xl font-semibold mb-2">Microphone Access Needed</h2>
            <p className="text-gray-400 max-w-md mb-8">
              Your browser blocked automatic microphone access. Please allow microphone permissions, then click below to restart.
            </p>
            <button 
               onClick={() => startListening()}
               className="glass-panel px-8 py-3 rounded-full text-white font-medium hover:bg-white/10 transition-colors"
            >
              Retry & Connect
            </button>
          </div>
        )}

        {/* History Drawer Overlay */}
        <div className={`absolute inset-y-0 right-0 w-80 sm:w-96 glass-panel border-l transform transition-transform duration-500 z-50 flex flex-col ${showHistory ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
            <h2 className="text-lg font-medium flex items-center gap-2"><MessageSquare size={18}/> Conversation</h2>
            <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/10 rounded-full">
              <X size={18} />
            </button>
          </div>
          
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-center mt-10">No history yet.</p>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-white/10 text-white rounded-br-sm' : 'bg-[#151520] text-gray-300 rounded-bl-sm border border-white/5'}`}>
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="p-4 border-t border-white/10 flex justify-center bg-black/20">
            <button 
              onClick={() => {
                 setMessages([]);
                 localStorage.removeItem('voice-assistant-history');
              }} 
              className="text-xs text-red-400 hover:text-red-300 font-semibold tracking-wider uppercase"
            >
              Clear History
            </button>
          </div>
        </div>

      </div>
    </>
  );
}

