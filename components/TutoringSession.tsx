
import React, { useState, useEffect, useRef } from 'react';
import { TutoringConfig, TutoringComplexity, TutoringPacing, TutoringSessionData, NasaTlxResult, QuizQuestion, SessionMode } from '../types';
import { generateTutoringScript, generateTutoringAudio, generateQuiz, answerLearnerQuestion } from '../services/geminiService';
import { AudioPlayer } from '../utils/audio';
import { logger } from '../utils/eventLogger';
import NasaTlxForm from './NasaTlxForm';
import AudioVisualizer from './AudioVisualizer';
import AICharacter from './AICharacter';

interface TutoringSessionProps {
  config: TutoringConfig;
  onSessionComplete: (data: any) => void;
  onModeChange: (mode: SessionMode) => void;
}

enum SessionState {
  LOADING,
  PLAYING,
  LISTENING, // Interrupted, recording user
  PROCESSING, // Processing audio/getting answer
  ANSWERING, // AI responding to interruption
  QUIZ,
  RATING,
  FINISHED,
  ERROR
}

const TutoringSession: React.FC<TutoringSessionProps> = ({ config, onSessionComplete, onModeChange }) => {
  const [state, setState] = useState<SessionState>(SessionState.LOADING);
  const [sessionData, setSessionData] = useState<TutoringSessionData | null>(null);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [loadingStep, setLoadingStep] = useState<string>("Initializing...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Timer State
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Interruption State
  const [isRecording, setIsRecording] = useState(false);
  const [answerText, setAnswerText] = useState<string>("");

  const audioPlayerRef = useRef<AudioPlayer | null>(null); // Main Lesson Player
  const answerPlayerRef = useRef<AudioPlayer | null>(null); // Interruption Answer Player
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Update App Mode based on local State
  useEffect(() => {
    let mode: SessionMode = 'default';
    if (state === SessionState.PLAYING) {
        mode = 'explanation';
    } else if (state === SessionState.LISTENING || state === SessionState.PROCESSING || state === SessionState.ANSWERING) {
        mode = 'interruption';
    } else if (state === SessionState.QUIZ) {
        mode = 'quiz';
    } else if (state === SessionState.LOADING) {
        mode = 'default'; // Keep default background during loading
    }
    
    onModeChange(mode);
  }, [state, onModeChange]);

  const isLightMode = state === SessionState.LISTENING || state === SessionState.PROCESSING || state === SessionState.ANSWERING;
  
  // Text contrast helpers
  const textColor = isLightMode ? 'text-slate-900' : 'text-white';
  const subTextColor = isLightMode ? 'text-slate-600' : 'text-slate-400';
  const accentTextColor = isLightMode ? 'text-blue-700' : 'text-blue-300';
  const statusPillStyle = config.complexity === TutoringComplexity.COMPLEX 
    ? (isLightMode ? 'bg-purple-500/10 border-purple-500/50 text-purple-700' : 'bg-purple-500/10 border-purple-500/50 text-purple-300')
    : (isLightMode ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300');


  // Timer Logic
  useEffect(() => {
    let interval: number;
    if (state === SessionState.PLAYING) {
      interval = window.setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [state]);

  // Format Time (MM:SS)
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Determine Character State
  const getCharacterState = (): 'idle' | 'speaking' | 'listening' | 'thinking' => {
    switch (state) {
        case SessionState.PLAYING:
        case SessionState.ANSWERING:
            return 'speaking';
        case SessionState.LISTENING:
            return 'listening';
        case SessionState.PROCESSING:
        case SessionState.LOADING:
            return 'thinking';
        default:
            return 'idle';
    }
  };

  // Initialize Session
  useEffect(() => {
    const init = async () => {
      try {
        setState(SessionState.LOADING);
        setErrorMessage(null);
        
        // Start Event Logging
        const participantId = `p-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        logger.startSession(participantId);

        // Step 1: Generate Script
        setLoadingStep("Drafting Lesson Plan...");
        const script = await generateTutoringScript(config.topic, config.complexity, config.pacing);
        
        // Step 2: Parallelize Audio and Quiz Generation with Stagger
        setLoadingStep("Synthesizing Voice & Preparing Assessment...");
        
        // We trigger both but with a small stagger to avoid hitting the API rate limit/concurrency issues exactly simultaneously
        const audioPromise = generateTutoringAudio(script);
        
        // Wait 500ms before starting quiz generation to spread the load
        await new Promise(r => setTimeout(r, 500));
        
        const quizPromise = generateQuiz(script);

        const [audioBase64, quiz] = await Promise.all([
          audioPromise,
          quizPromise
        ]);
        
        // --- LOGGING UPDATE: Save context ---
        logger.setSessionContext(config, script, quiz);

        setSessionData({ script, audioBase64, quiz });

        // Decrease playback rate to slow down speed as requested
        // Normal = 0.9x, Fast = 1.15x
        const playbackRate = config.pacing === TutoringPacing.FAST ? 1.15 : 0.9;
        
        audioPlayerRef.current = new AudioPlayer(playbackRate);
        await audioPlayerRef.current.loadAudio(audioBase64);

        setLoadingStep("Ready");
        setState(SessionState.PLAYING);
      } catch (error: any) {
        console.error("Initialization failed", error);
        setErrorMessage(error.message || "Failed to initialize session. Please try again.");
        setState(SessionState.ERROR);
      }
    };

    init();

    return () => {
      audioPlayerRef.current?.stop();
      answerPlayerRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Play Start
  useEffect(() => {
    if (state === SessionState.PLAYING && audioPlayerRef.current) {
      // If we are coming back from interruption, resume. If start, play.
      const timeout = setTimeout(() => {
        // Determine if it is a resume (pausedAt > 0) or start
        const isResume = audioPlayerRef.current!.getCurrentTime() > 0.1;
        
        audioPlayerRef.current?.play(() => {
            setState(SessionState.QUIZ);
        });

        if (isResume) {
          logger.log('audio_resume');
        } else {
          logger.log('audio_start', { 
            topic: config.topic,
            duration: audioPlayerRef.current?.getDuration() 
          });
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [state, config.topic]);

  // --- Interruption Logic ---

  const startInterruption = async () => {
    if (!audioPlayerRef.current || state !== SessionState.PLAYING) return;
    
    // Pause lesson
    const currentTime = audioPlayerRef.current.getCurrentTime();
    logger.log('user_interrupt', { progressMs: currentTime * 1000 });

    audioPlayerRef.current.pause();
    setState(SessionState.LISTENING);
    setIsRecording(true);
    setAnswerText("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processInterruption(audioBlob);
      };

      mediaRecorder.start();
    } catch (err) {
      console.error("Mic access denied", err);
      setState(SessionState.PLAYING); // Fallback
    }
  };

  const stopInterruption = () => {
    setState(SessionState.PROCESSING);
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const processInterruption = async (audioBlob: Blob) => {
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      
      try {
        if (!sessionData) return;
        
        // Now returns userTranscript and aiAnswer
        const result = await answerLearnerQuestion(sessionData.script, base64String);
        
        // --- LOGGING UPDATE: Record conversation ---
        logger.logConversation(result.userTranscript, result.aiAnswer);

        setAnswerText(result.aiAnswer);
        setState(SessionState.ANSWERING);

        answerPlayerRef.current = new AudioPlayer(1.0);
        await answerPlayerRef.current.loadAudio(result.audioData);
        
        answerPlayerRef.current.play(() => {
          setState(SessionState.PLAYING);
          setAnswerText("");
        });

      } catch (e) {
        console.error("Failed to answer", e);
        // Fallback: Just resume
        setState(SessionState.PLAYING);
      }
    };
  };

  // --- Quiz Logic ---

  const handleQuizAnswer = (optionIndex: number) => {
    if (!sessionData) return;
    
    const isCorrect = optionIndex === sessionData.quiz[currentQuizIndex].correctIndex;
    if (isCorrect) setQuizScore(s => s + 1);
    
    const newAnswers = [...quizAnswers, optionIndex];
    setQuizAnswers(newAnswers);

    if (currentQuizIndex < sessionData.quiz.length - 1) {
      setCurrentQuizIndex(prev => prev + 1);
    } else {
      logger.log('session_end', { quizScore: quizScore + (isCorrect ? 1 : 0) });
      // Store preliminary results (without TLX yet)
      logger.setResults(quizScore + (isCorrect ? 1 : 0), newAnswers);
      setState(SessionState.RATING);
    }
  };

  const handleSkip = () => {
    if (!sessionData) return;
    
    // -1 denotes a skip
    const newAnswers = [...quizAnswers, -1];
    setQuizAnswers(newAnswers);

    if (currentQuizIndex < sessionData.quiz.length - 1) {
      setCurrentQuizIndex(prev => prev + 1);
    } else {
      logger.log('session_end', { quizScore: quizScore });
      // Store preliminary results
      logger.setResults(quizScore, newAnswers);
      setState(SessionState.RATING);
    }
  };
  
  const handlePreviousQuestion = () => {
    if (!sessionData || currentQuizIndex === 0) return;

    // Get the answer we are about to remove
    const lastAnswerIndex = quizAnswers[quizAnswers.length - 1];
    
    // If it wasn't skipped (-1) and was correct, we need to decrement the score
    if (lastAnswerIndex !== -1) {
        const prevQuestion = sessionData.quiz[currentQuizIndex - 1];
        if (lastAnswerIndex === prevQuestion.correctIndex) {
            setQuizScore(s => Math.max(0, s - 1));
        }
    }

    // Remove the last answer
    setQuizAnswers(prev => prev.slice(0, -1));
    
    // Move back
    setCurrentQuizIndex(prev => prev - 1);
  };

  const handleRatingSubmit = (rating: NasaTlxResult) => {
    // Update logger with final rating
    logger.setResults(quizScore, quizAnswers, rating);
    
    onSessionComplete({
      config,
      quizScore,
      rating
    });
  };

  const retryInit = () => {
     window.location.reload(); // Simple reload for full reset
  };

  // Renders

  if (state === SessionState.ERROR) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6 text-center max-w-md mx-auto">
        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 mb-4">
           <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <h3 className="text-xl font-bold text-white">Connection Error</h3>
        <p className="text-slate-400">{errorMessage}</p>
        <button 
            onClick={retryInit}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium transition-colors"
        >
            Retry Session
        </button>
      </div>
    );
  }

  if (state === SessionState.LOADING) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8">
        {/* Loading Avatar */}
        <AICharacter state="thinking" />
        
        <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-2">Consulting AI Tutor</h2>
            <p className="text-sm text-blue-300 font-mono animate-pulse">{loadingStep}</p>
        </div>
      </div>
    );
  }

  // Active Session View
  if (state === SessionState.PLAYING || state === SessionState.LISTENING || state === SessionState.ANSWERING || state === SessionState.PROCESSING) {
    return (
      <div className="relative flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center px-4 w-full">
        
        {/* Timer UI - Positioned absolute top right */}
        <div className="absolute top-4 right-4 bg-slate-800/80 border border-slate-600 px-4 py-2 rounded-full font-mono text-emerald-400 font-bold shadow-lg">
          {formatTime(elapsedTime)}
        </div>

        {/* Character & Visualizer Area */}
        <div className="mb-6 w-full flex flex-col items-center gap-2">
             {/* The Animated Character */}
             <div className="relative z-10">
                <AICharacter state={getCharacterState()} />
             </div>

             {/* The Audio Wave Visualizer */}
             <div className="h-24 w-full flex justify-center items-center relative -mt-4 opacity-80">
                {state === SessionState.LISTENING ? (
                    <div className={`flex items-center gap-2 animate-pulse font-mono text-sm ${isLightMode ? 'text-rose-600' : 'text-rose-400'}`}>
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span> Recording...
                    </div>
                ) : state === SessionState.ANSWERING ? (
                    <AudioVisualizer 
                        audioPlayer={answerPlayerRef.current} 
                        isActive={true} 
                    />
                ) : (
                    <AudioVisualizer 
                        audioPlayer={audioPlayerRef.current} 
                        isActive={state === SessionState.PLAYING} 
                    />
                )}
             </div>
        </div>
        
        {/* Topic Title */}
        <h2 className={`text-4xl font-bold mb-4 tracking-tight ${textColor}`}>{config.topic}</h2>
        
        {/* Status Pills */}
        <div className="flex gap-3 justify-center mb-8">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase border ${statusPillStyle}`}>
                {config.complexity} Level
            </span>
            {state === SessionState.ANSWERING && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase border animate-pulse ${isLightMode ? 'bg-blue-500/10 border-blue-500 text-blue-700' : 'bg-blue-500/10 border-blue-500 text-blue-300'}`}>
                    Answering
                </span>
            )}
        </div>
        
        {/* Context Text */}
        <div className="space-y-4 min-h-[60px] flex flex-col items-center">
            {state === SessionState.ANSWERING && answerText ? (
                 <p className={`text-lg font-medium max-w-lg p-4 rounded-xl border animate-fade-in ${isLightMode ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-blue-900/30 text-blue-200 border-blue-500/30'}`}>
                    "{answerText}"
                 </p>
            ) : state === SessionState.LISTENING ? (
                 <p className={`text-lg ${isLightMode ? 'text-rose-600' : 'text-rose-300'}`}>Listening to your question...</p>
            ) : state === SessionState.PROCESSING ? (
                 <p className={`text-lg ${isLightMode ? 'text-indigo-600' : 'text-indigo-300'}`}>Processing your query...</p>
            ) : (
                 <div className="flex flex-col items-center gap-1">
                     <p className={`text-lg ${subTextColor}`}>Listen carefully to the explanation.</p>
                 </div>
            )}
        </div>

        {/* Interaction Controls */}
        <div className="mt-12">
            {state === SessionState.PLAYING && (
                <button 
                    onClick={startInterruption}
                    className="flex items-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-blue-400 text-white rounded-full font-bold transition-all shadow-lg hover:shadow-blue-500/20 group"
                >
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                    Interrupt / Ask Question
                </button>
            )}

            {state === SessionState.LISTENING && (
                <button 
                    onClick={stopInterruption}
                    className="flex items-center gap-2 px-8 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-full font-bold transition-all shadow-lg animate-pulse"
                >
                    <div className="w-3 h-3 bg-white rounded-sm"></div>
                    Stop Speaking & Get Answer
                </button>
            )}
        </div>
      </div>
    );
  }

  if (state === SessionState.QUIZ && sessionData) {
    const question = sessionData.quiz[currentQuizIndex];
    return (
      <div className="max-w-2xl w-full mx-auto p-4">
        <div className="bg-slate-800/80 backdrop-blur p-8 rounded-3xl shadow-2xl border border-slate-700/50">
            <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">?</span>
                    Comprehension Check
                </h3>
                <span className="text-sm font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded-full">
                    {currentQuizIndex + 1} / {sessionData.quiz.length}
                </span>
            </div>
            
            <p className="text-xl text-slate-100 mb-8 font-medium leading-relaxed">{question.question}</p>
            
            <div className="space-y-4">
            {question.options.map((option, idx) => (
                <button
                key={idx}
                onClick={() => handleQuizAnswer(idx)}
                className="w-full text-left p-5 rounded-xl bg-slate-700/50 hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-900/20 text-slate-200 transition-all border border-transparent hover:border-blue-400 group flex items-center"
                >
                <span className="w-8 h-8 rounded-full border border-slate-500 group-hover:border-white mr-4 flex items-center justify-center text-sm text-slate-400 group-hover:text-white transition-colors">
                    {String.fromCharCode(65 + idx)}
                </span>
                {option}
                </button>
            ))}
            </div>

            <div className="mt-8 flex justify-between items-center">
                <button 
                    onClick={handlePreviousQuestion}
                    disabled={currentQuizIndex === 0}
                    className={`px-4 py-2 flex items-center gap-1 font-medium text-sm transition-colors ${
                        currentQuizIndex === 0 
                        ? 'text-slate-600 cursor-not-allowed' 
                        : 'text-slate-500 hover:text-slate-300 group'
                    }`}
                >
                    <svg className={`w-4 h-4 ${currentQuizIndex !== 0 && 'group-hover:-translate-x-1'} transition-transform`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 17l-5-5m0 0l5-5m-5 5h12"></path></svg>
                    Previous
                </button>

                <button 
                  onClick={handleSkip}
                  className="px-4 py-2 text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 font-medium text-sm group"
                >
                  Skip Question
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                </button>
            </div>
        </div>
      </div>
    );
  }

  if (state === SessionState.RATING) {
    return (
        <div className="flex items-center justify-center h-full w-full">
            <NasaTlxForm onSubmit={handleRatingSubmit} />
        </div>
    );
  }

  return null;
};

export default TutoringSession;
