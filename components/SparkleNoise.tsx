import React, { useEffect, useRef } from 'react';

const SparkleNoise: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const imageData = ctx.createImageData(w, h);
      const buffer = new Uint32Array(imageData.data.buffer);

      for (let i = 0; i < buffer.length; i++) {
        // 50% chance of being white (sparkle) or transparent/black
        // Using semi-transparent white for "sparkle" effect over dark background
        if (Math.random() > 0.5) {
            // ARGB format - Little Endian
            // 255 alpha, 255 red, 255 green, 255 blue -> 0xFFFFFFFF
            // Let's make it slightly less intense: 0x88FFFFFF (approx 50% opacity white)
             buffer[i] = 0x88FFFFFF; 
        } else {
            buffer[i] = 0x00000000; // Transparent
        }
      }

      ctx.putImageData(imageData, 0, 0);
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-30"
    />
  );
};

export default SparkleNoise;
