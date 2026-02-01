import React from 'react';

interface AICharacterProps {
  state: 'idle' | 'speaking' | 'listening' | 'thinking';
}

const AICharacter: React.FC<AICharacterProps> = ({ state }) => {
  const isSpeaking = state === 'speaking';
  const isThinking = state === 'thinking';
  const isListening = state === 'listening';

  return (
    <div className="relative w-40 h-40 flex items-center justify-center transition-all duration-500">
      {/* Glow / Aura Effect */}
      <div className={`absolute inset-0 rounded-full blur-2xl transition-all duration-700 ${
        isSpeaking ? 'bg-blue-500/40 opacity-100 scale-110' : 
        isThinking ? 'bg-indigo-500/40 opacity-80 scale-100 animate-pulse' : 
        isListening ? 'bg-rose-500/40 opacity-80 scale-100' : 
        'bg-slate-500/10 opacity-30 scale-90'
      }`}></div>

      {/* Main Avatar Container */}
      <div className={`relative z-10 w-28 h-28 bg-slate-800 rounded-3xl border-2 shadow-2xl flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ${
        isListening ? 'border-rose-500 shadow-rose-500/20' : 
        isThinking ? 'border-indigo-500 shadow-indigo-500/20' : 
        isSpeaking ? 'border-blue-400 shadow-blue-500/40' : 
        'border-slate-700 shadow-slate-900/50'
      }`}>
        
        {/* Antenna / Status Light */}
        <div className={`absolute -top-3 w-1 h-5 bg-slate-600 rounded-full transition-colors ${
             isThinking ? 'bg-indigo-400 animate-pulse shadow-[0_0_10px_rgba(129,140,248,0.8)]' : 
             isSpeaking ? 'bg-blue-400' : 
             isListening ? 'bg-rose-500' : ''
        }`}></div>

        {/* Eyes */}
        <div className="flex gap-4 mb-3 mt-1">
            {/* Left Eye */}
            <div className={`w-2.5 bg-white rounded-full transition-all duration-300 ${
                isSpeaking ? 'h-5 shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 
                isListening ? 'h-2.5 w-2.5 bg-rose-400' : 
                isThinking ? 'h-2.5 animate-bounce' : 
                'h-2.5 opacity-60 animate-blink'
            }`}></div>
            
            {/* Right Eye */}
             <div className={`w-2.5 bg-white rounded-full transition-all duration-300 ${
                isSpeaking ? 'h-5 shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 
                isListening ? 'h-2.5 w-2.5 bg-rose-400' : 
                isThinking ? 'h-2.5 animate-bounce delay-100' : 
                'h-2.5 opacity-60 animate-blink'
            }`} style={{ animationDelay: isThinking ? '0.1s' : '0s' }}></div>
        </div>

        {/* Voice/Mouth Visualizer */}
        <div className="h-6 flex items-center gap-1 justify-center">
            {isSpeaking ? (
                <>
                  <div className="w-1 bg-blue-400 rounded-full animate-voice-1 shadow-[0_0_5px_rgba(96,165,250,0.8)]"></div>
                  <div className="w-1 bg-blue-400 rounded-full animate-voice-2 shadow-[0_0_5px_rgba(96,165,250,0.8)]"></div>
                  <div className="w-1 bg-blue-400 rounded-full animate-voice-3 shadow-[0_0_5px_rgba(96,165,250,0.8)]"></div>
                  <div className="w-1 bg-blue-400 rounded-full animate-voice-2 shadow-[0_0_5px_rgba(96,165,250,0.8)]"></div>
                  <div className="w-1 bg-blue-400 rounded-full animate-voice-1 shadow-[0_0_5px_rgba(96,165,250,0.8)]"></div>
                </>
            ) : isThinking ? (
                <div className="flex gap-1">
                    <div className="w-1 h-1 bg-indigo-500 rounded-full animate-ping"></div>
                    <div className="w-1 h-1 bg-indigo-500 rounded-full animate-ping delay-150"></div>
                    <div className="w-1 h-1 bg-indigo-500 rounded-full animate-ping delay-300"></div>
                </div>
            ) : isListening ? (
                <div className="w-10 h-0.5 bg-rose-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(244,63,94,0.6)]"></div>
            ) : (
                <div className="w-6 h-0.5 bg-slate-600 rounded-full opacity-50"></div>
            )}
        </div>
      </div>

      <style>{`
        @keyframes voice-1 { 0%, 100% { height: 4px; opacity: 0.5; } 50% { height: 12px; opacity: 1; } }
        @keyframes voice-2 { 0%, 100% { height: 8px; opacity: 0.5; } 50% { height: 18px; opacity: 1; } }
        @keyframes voice-3 { 0%, 100% { height: 6px; opacity: 0.5; } 50% { height: 14px; opacity: 1; } }
        @keyframes blink { 0%, 96%, 100% { transform: scaleY(1); } 98% { transform: scaleY(0.1); } }
        
        .animate-voice-1 { animation: voice-1 0.4s infinite ease-in-out; }
        .animate-voice-2 { animation: voice-2 0.3s infinite ease-in-out; }
        .animate-voice-3 { animation: voice-3 0.5s infinite ease-in-out; }
        .animate-blink { animation: blink 4s infinite; }
      `}</style>
    </div>
  );
};

export default AICharacter;