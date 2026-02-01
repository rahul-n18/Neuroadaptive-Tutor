import React, { useState, useEffect } from 'react';
import { AppState, TutoringConfig, TutoringComplexity, TutoringPacing, SessionMode } from './types';
import TutoringSession from './components/TutoringSession';
import { generateAppBackground } from './services/geminiService';
import { logger } from './utils/eventLogger';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.WELCOME);
  const [sessionMode, setSessionMode] = useState<SessionMode>('default');
  const [tutoringConfig, setTutoringConfig] = useState<TutoringConfig>({
    topic: 'Photosynthesis',
    complexity: TutoringComplexity.SIMPLE,
    pacing: TutoringPacing.NORMAL
  });
  const [results, setResults] = useState<any[]>([]);
  const [bgImage, setBgImage] = useState<string | null>(null);

  // Load AI Background on Mount
  useEffect(() => {
    const loadBackground = async () => {
        try {
            const image = await generateAppBackground();
            setBgImage(image);
        } catch (e) {
            console.error("Failed to load background", e);
        }
    };
    loadBackground();
  }, []);

  // Navigation Handlers
  const startTutoringSetup = () => {
      setAppState(AppState.TUTORING_SETUP);
      setSessionMode('default');
  };
  const startTutoringSession = () => setAppState(AppState.TUTORING_SESSION);
  const goBackToWelcome = () => {
      setAppState(AppState.WELCOME);
      setSessionMode('default');
  };
  
  const handleSessionComplete = (data: any) => {
    setResults([...results, data]);
    setAppState(AppState.FINISHED);
    setSessionMode('default');
  };
  const restart = () => {
    setResults([]);
    setAppState(AppState.WELCOME);
    setSessionMode('default');
  };
  const nextSession = () => {
    setAppState(AppState.TUTORING_SETUP);
    setSessionMode('default');
  };

  const handleModeChange = (mode: SessionMode) => {
    setSessionMode(mode);
  };

  const getBackgroundClass = () => {
    switch(sessionMode) {
        case 'explanation': return 'bg-black text-white';
        case 'interruption': return 'bg-white text-slate-900';
        case 'quiz': return 'bg-gray-600 text-white';
        default: return 'bg-slate-900 text-slate-100';
    }
  };

  // Render Views
  const renderContent = () => {
    switch (appState) {
      case AppState.WELCOME:
        return (
          <div className="max-w-2xl text-center space-y-8 animate-fade-in">
            <div className="mb-8">
                <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-4">
                Neuroadaptive AI Tutor
                </h1>
                <p className="text-xl text-slate-400">
                A research interface for AI tutoring.
                </p>
            </div>

            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 text-left space-y-4 shadow-lg backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white">Session Protocol</h3>
                <ul className="list-disc list-inside text-slate-300 space-y-2">
                    <li><span className="text-blue-400 font-bold">Learning Phase</span> - Learn a topic from an AI Tutor with varying complexity.</li>
                    <li><span className="text-emerald-400 font-bold">Evaluation</span> - Assessment and subjective workload rating.</li>
                </ul>
            </div>

            <div className="flex flex-col gap-3">
                <button onClick={startTutoringSetup} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-lg shadow-lg shadow-emerald-900/50 transition-all transform hover:scale-105">
                Start Learning Session
                </button>
            </div>
          </div>
        );

      case AppState.TUTORING_SETUP:
        return (
            <div className="max-w-lg w-full bg-slate-800/90 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-slate-700 relative">
                <button 
                  onClick={goBackToWelcome}
                  className="absolute top-4 left-4 text-slate-400 hover:text-white transition-colors"
                  aria-label="Back"
                >
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                </button>

                <h2 className="text-2xl font-bold text-white mb-6 text-center">Configure Tutoring Session</h2>
                
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Learning Topic</label>
                        <input 
                            type="text" 
                            value={tutoringConfig.topic}
                            onChange={(e) => setTutoringConfig({...tutoringConfig, topic: e.target.value})}
                            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="e.g. Quantum Physics, Roman History"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Complexity</label>
                        <div className="grid grid-cols-2 gap-4">
                            {[TutoringComplexity.SIMPLE, TutoringComplexity.COMPLEX].map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setTutoringConfig({...tutoringConfig, complexity: c})}
                                    className={`p-3 rounded-lg border transition-all ${tutoringConfig.complexity === c ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-700 border-transparent text-slate-400 hover:bg-slate-600'}`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Pacing</label>
                        <div className="grid grid-cols-2 gap-4">
                            {[TutoringPacing.NORMAL, TutoringPacing.FAST].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setTutoringConfig({...tutoringConfig, pacing: p})}
                                    className={`p-3 rounded-lg border transition-all ${tutoringConfig.pacing === p ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-700 border-transparent text-slate-400 hover:bg-slate-600'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button 
                        onClick={startTutoringSession}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-lg shadow-lg mt-4"
                    >
                        Start Session
                    </button>
                </div>
            </div>
        );

      case AppState.TUTORING_SESSION:
        return <TutoringSession config={tutoringConfig} onSessionComplete={handleSessionComplete} onModeChange={handleModeChange} />;

      case AppState.FINISHED:
        return (
            <div className="max-w-3xl w-full text-center space-y-8 animate-fade-in">
                 <div className="text-center">
                    <h2 className="text-3xl font-bold text-white mb-2">Session Complete</h2>
                    <p className="text-slate-400">Data recorded for analysis</p>
                 </div>
                 
                 <div className="bg-slate-800/90 backdrop-blur-md rounded-xl overflow-hidden border border-slate-700 shadow-xl">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-700/50 text-slate-200">
                            <tr>
                                <th className="p-4">Condition</th>
                                <th className="p-4">Topic</th>
                                <th className="p-4">Score</th>
                                <th className="p-4">Workload (Avg)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((r, i) => {
                                const workloadAvg = Math.round((r.rating.mentalDemand + r.rating.effort + r.rating.frustration) / 3);
                                return (
                                    <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/30 transition-colors">
                                        <td className="p-4">
                                            <div className="flex gap-2">
                                                <span className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-xs">{r.config.complexity}</span>
                                                <span className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-xs">{r.config.pacing}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 font-bold text-white">{r.config.topic}</td>
                                        <td className="p-4">
                                            <span className={`font-bold ${r.quizScore === 3 ? 'text-emerald-400' : 'text-slate-200'}`}>
                                                {r.quizScore}/3
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-24 bg-slate-900 rounded-full h-2">
                                                    <div className={`h-2 rounded-full ${workloadAvg > 70 ? 'bg-rose-500' : 'bg-blue-500'}`} style={{width: `${workloadAvg}%`}}></div>
                                                </div>
                                                <span className="text-xs">{workloadAvg}</span>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                 </div>

                 <div className="flex flex-col gap-3 items-center">
                    <div className="flex gap-4">
                        <button onClick={nextSession} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-all">
                            Run Another Condition
                        </button>
                        <button onClick={restart} className="px-6 py-3 border border-slate-600 text-slate-400 hover:text-white rounded-lg transition-all">
                            Reset Experiment
                        </button>
                    </div>
                    
                    <button 
                        onClick={() => logger.exportJSON()} 
                        className="mt-4 px-6 py-3 bg-blue-600/80 hover:bg-blue-500 text-white rounded-lg font-mono text-sm border border-blue-400/30 flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        Download Session Log (JSON)
                    </button>
                 </div>
            </div>
        );

      default:
        return <div>Unknown State</div>;
    }
  };

  return (
    <div 
        className={`min-h-screen w-full flex flex-col items-center justify-center p-6 relative overflow-hidden transition-all duration-500 ${getBackgroundClass()}`}
        style={{
            backgroundImage: (bgImage && sessionMode === 'default') ? `url(${bgImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
        }}
    >
      {/* Dark Overlay for readability - only in default mode */}
      {sessionMode === 'default' && (
        <div className={`absolute inset-0 bg-slate-900/80 transition-opacity duration-1000 ${bgImage ? 'opacity-90' : 'opacity-100'}`}></div>
      )}
      
      {/* Radial Gradient fallback/blend - only in default mode */}
      {sessionMode === 'default' && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent to-slate-950 pointer-events-none"></div>
      )}

      {/* Content wrapper with z-index */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center">
        {renderContent()}
      </div>
    </div>
  );
};

export default App;