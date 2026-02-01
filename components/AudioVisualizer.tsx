import React, { useEffect, useRef } from 'react';
import { AudioPlayer } from '../utils/audio';

interface AudioVisualizerProps {
  audioPlayer: AudioPlayer | null;
  isActive: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ audioPlayer, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioPlayer || !isActive) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      if (!isActive) return;
      
      const width = rect.width;
      const height = rect.height;
      const data = audioPlayer.getFrequencyData();
      const bufferLength = data.length;
      
      ctx.clearRect(0, 0, width, height);

      // We'll draw a mirrored bar chart centered
      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      // Create gradient
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#3b82f6'); // Blue-500
      gradient.addColorStop(1, '#10b981'); // Emerald-500

      ctx.fillStyle = gradient;

      // Draw standard bars
      // We only use the lower half of the frequency data for better visuals (voice range)
      const visibleBars = Math.floor(bufferLength * 0.7); 
      const spacer = 2;
      const totalWidth = visibleBars * (barWidth + spacer);
      const startX = (width - totalWidth) / 2;

      for (let i = 0; i < visibleBars; i++) {
        const value = data[i];
        const percent = value / 255;
        const barHeight = height * percent * 0.8; // Scale to 80% max height
        
        // Draw centered bar
        const xPos = startX + i * (barWidth + spacer);
        const yPos = (height - barHeight) / 2;

        // Rounded caps look nice
        ctx.beginPath();
        ctx.roundRect(xPos, yPos, barWidth, barHeight, 4);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [audioPlayer, isActive]);

  return (
    <div className="relative w-64 h-32 flex items-center justify-center">
        {/* Glow effect behind the visualizer */}
        <div className={`absolute inset-0 bg-blue-500/20 blur-xl rounded-full transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-0'}`}></div>
        <canvas 
            ref={canvasRef} 
            className="relative z-10 w-full h-full"
        />
    </div>
  );
};

export default AudioVisualizer;
