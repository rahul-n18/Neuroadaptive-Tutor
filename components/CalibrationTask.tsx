import React, { useState, useEffect, useCallback } from 'react';
import { WorkloadCondition } from '../types';
import SparkleNoise from './SparkleNoise';

interface CalibrationTaskProps {
  onComplete: () => void;
}

const TOTAL_TRIALS = 6; // Reduced from 40 for demo purposes, but enough to show flow
const TRIAL_DURATION_MS = 10000; // 10 seconds

const CalibrationTask: React.FC<CalibrationTaskProps> = ({ onComplete }) => {
  const [trialCount, setTrialCount] = useState(0);
  const [condition, setCondition] = useState<WorkloadCondition>(WorkloadCondition.LOW);
  const [timeLeft, setTimeLeft] = useState(TRIAL_DURATION_MS / 1000);
  const [mathState, setMathState] = useState<{ current: number; step: number } | null>(null);

  // Helper to generate new math problem
  const generateMathProblem = useCallback(() => {
    const start = Math.floor(Math.random() * (1200 - 200 + 1)) + 200;
    let step = Math.floor(Math.random() * (19 - 6 + 1)) + 6;
    while (step === 10 || step === 15) {
       step = Math.floor(Math.random() * (19 - 6 + 1)) + 6;
    }
    return { current: start, step };
  }, []);

  // Timer Effect
  useEffect(() => {
    if (trialCount >= TOTAL_TRIALS) {
      onComplete();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // End of trial
          clearInterval(timer);
          nextTrial();
          return TRIAL_DURATION_MS / 1000;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialCount]);

  const nextTrial = () => {
    setTrialCount((prev) => prev + 1);
    // Alternate conditions: Even = Low (Rest), Odd = High (Math)
    // Starting with Low (0 is even)
    const nextCondition = (trialCount + 1) % 2 === 0 ? WorkloadCondition.LOW : WorkloadCondition.HIGH;
    setCondition(nextCondition);
    
    if (nextCondition === WorkloadCondition.HIGH) {
      setMathState(generateMathProblem());
    } else {
      setMathState(null);
    }
  };

  // Setup initial trial
  useEffect(() => {
    // Initial setup
    setCondition(WorkloadCondition.LOW);
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (trialCount >= TOTAL_TRIALS) return null;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      {/* Visual Noise Overlay - Always active as per report to control visual confounds */}
      <SparkleNoise />

      <div className="z-10 bg-slate-900/80 p-12 rounded-3xl backdrop-blur-sm border border-slate-700 text-center shadow-2xl max-w-xl w-full">
        <div className="mb-8">
            <span className="inline-block px-3 py-1 rounded-full bg-slate-700 text-slate-300 text-sm font-mono">
                Trial {trialCount + 1} / {TOTAL_TRIALS}
            </span>
            <div className="mt-2 text-slate-500 text-xs uppercase tracking-widest font-bold">
                Time Remaining: {timeLeft}s
            </div>
        </div>

        {condition === WorkloadCondition.LOW ? (
          <div className="flex flex-col items-center animate-pulse">
            <div className="text-6xl text-emerald-400 font-light mb-4">+</div>
            <h2 className="text-2xl text-slate-200">Rest State</h2>
            <p className="text-slate-400 mt-2">Keep your eyes open and relax.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <h2 className="text-2xl text-rose-400 font-bold mb-6">Mental Arithmetic</h2>
            <div className="text-5xl font-mono text-white font-bold mb-2">
              {mathState?.current}
            </div>
            <div className="text-xl text-slate-400 font-mono mb-8">
              - {mathState?.step}
            </div>
            <p className="text-sm text-slate-400">
              Keep subtracting <b>{mathState?.step}</b> from the previous result in your head.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalibrationTask;
