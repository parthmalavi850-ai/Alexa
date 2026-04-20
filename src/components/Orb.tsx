import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'motion/react';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface OrbProps {
  state: OrbState;
  colorHex: string;
}

export function Orb({ state, colorHex }: OrbProps) {
  const controls = useAnimation();
  
  useEffect(() => {
    switch (state) {
      case 'idle':
        controls.start({
          scale: [1, 1.05, 1],
          opacity: [0.6, 0.8, 0.6],
          borderRadius: ['50%', '50%', '50%'],
          transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' }
        });
        break;
      case 'listening':
        controls.start({
          scale: [1.1, 1.3, 1.15, 1.25, 1.1],
          opacity: [0.8, 1, 0.9, 1, 0.8],
          borderRadius: ['50%', '45% 55% 55% 45%', '55% 45% 45% 55%', '50%'],
          transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
        });
        break;
      case 'thinking':
        controls.start({
          scale: [1, 1.1, 1],
          opacity: [0.5, 0.7, 0.5],
          rotate: [0, 360],
          borderRadius: ['50%', '40% 60% 60% 40%', '50%'],
          transition: { duration: 3, repeat: Infinity, ease: 'linear' }
        });
        break;
      case 'speaking':
        controls.start({
           scale: [1, 1.2, 1.05, 1.15, 1],
           opacity: [0.8, 1, 0.8, 1, 0.8],
           borderRadius: ['50%', '48% 52% 50% 50%', '52% 48% 50% 50%', '50%'],
           transition: { duration: 0.8, repeat: Infinity, ease: 'linear' }
        });
        break;
    }
  }, [state, controls]);

  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      {/* Glow layers */}
      <motion.div 
        animate={controls}
        className="absolute w-48 h-48 blur-3xl opacity-50 mix-blend-screen"
        style={{ backgroundColor: colorHex }}
      />
      <motion.div 
        animate={controls}
        className="absolute w-32 h-32 blur-2xl opacity-80"
        style={{ backgroundColor: colorHex }}
      />
      
      {/* Core Orb */}
      <motion.div
        animate={controls}
        className="absolute w-24 h-24 rounded-full border border-white/20 shadow-2xl"
        style={{ 
          background: `radial-gradient(circle at 30% 30%, ${colorHex}, #000000)`,
          boxShadow: `0 0 40px 10px ${colorHex}40`
        }}
      />
    </div>
  );
}
