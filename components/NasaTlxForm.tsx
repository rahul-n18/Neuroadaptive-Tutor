import React, { useState } from 'react';
import { NasaTlxResult } from '../types';

interface NasaTlxFormProps {
  onSubmit: (result: NasaTlxResult) => void;
}

const SliderQuestion: React.FC<{
  label: string;
  description: string;
  value: number;
  onChange: (val: number) => void;
}> = ({ label, description, value, onChange }) => (
  <div className="mb-6">
    <div className="flex justify-between items-end mb-2">
        <label className="text-lg font-semibold text-slate-200">{label}</label>
        <span className="text-sm text-slate-400">{value}/100</span>
    </div>
    <p className="text-sm text-slate-400 mb-3">{description}</p>
    <input
      type="range"
      min="0"
      max="100"
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
    />
    <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>Low</span>
        <span>High</span>
    </div>
  </div>
);

const NasaTlxForm: React.FC<NasaTlxFormProps> = ({ onSubmit }) => {
  const [mentalDemand, setMentalDemand] = useState(50);
  const [performance, setPerformance] = useState(50);
  const [effort, setEffort] = useState(50);
  const [frustration, setFrustration] = useState(50);

  const handleSubmit = () => {
    onSubmit({ mentalDemand, performance, effort, frustration });
  };

  return (
    <div className="bg-slate-800 p-8 rounded-2xl max-w-2xl w-full shadow-xl border border-slate-700">
      <h2 className="text-2xl font-bold mb-6 text-white text-center">Subjective Workload Rating</h2>
      <p className="text-slate-400 mb-8 text-center">Please rate your experience during the last session.</p>

      <SliderQuestion
        label="Mental Demand"
        description="How much mental and perceptual activity was required?"
        value={mentalDemand}
        onChange={setMentalDemand}
      />
      <SliderQuestion
        label="Performance"
        description="How successful were you in accomplishing what you were asked to do?"
        value={performance}
        onChange={setPerformance}
      />
      <SliderQuestion
        label="Effort"
        description="How hard did you have to work to accomplish your level of performance?"
        value={effort}
        onChange={setEffort}
      />
      <SliderQuestion
        label="Frustration"
        description="How insecure, discouraged, irritated, stressed, and annoyed were you?"
        value={frustration}
        onChange={setFrustration}
      />

      <button
        onClick={handleSubmit}
        className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-colors"
      >
        Submit Rating
      </button>
    </div>
  );
};

export default NasaTlxForm;
