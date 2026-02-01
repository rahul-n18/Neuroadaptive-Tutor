import React from 'react';

interface AICharacterProps {
  state: 'idle' | 'speaking' | 'listening' | 'thinking';
}

const AICharacter: React.FC<AICharacterProps> = ({ state }) => {
  const isSpeaking = state === 'speaking';
  const isThinking = state === 'thinking';
  const isListening = state === 'listening';

  let barColor = 'bg-slate-400';
  let shadow = '';
  let animation = '';

  if (isListening) {
    barColor = 'bg-rose-500';
    shadow = 'shadow-[0_0_12px_rgba(244,63,94,0.8)]';
    animation = 'scale-110'; 
  } else if (isThinking) {
    barColor = 'bg-indigo-400';
    shadow = 'shadow-[0_0_12px_rgba(129,140,248,0.8)]';
    animation = 'animate-pulse';
  } else if (isSpeaking) {
    barColor = 'bg-blue-400';
    shadow = 'shadow-[0_0_12px_rgba(96,165,250,0.8)]';
  } else {
    // Idle
    barColor = 'bg-slate-500';
    shadow = 'opacity-50';
  }

  return (
    <div className="relative w-40 h-40 flex items-center justify-center transition-all duration-500">
      {/* Central Fixation Plus Symbol */}
      <div className={`relative flex items-center justify-center transition-all duration-300 ${animation}`}>
         {/* Horizontal Bar */}
         <div className={`absolute w-24 h-3 rounded-md transition-colors duration-300 ${barColor} ${shadow}`}></div>
         {/* Vertical Bar */}
         <div className={`absolute h-24 w-3 rounded-md transition-colors duration-300 ${barColor} ${shadow}`}></div>
      </div>
    </div>
  );
};

export default AICharacter;