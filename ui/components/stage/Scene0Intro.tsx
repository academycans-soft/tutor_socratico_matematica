"use client";

import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface Scene0IntroProps {
  onStart: () => void;
}

export const Scene0Intro: React.FC<Scene0IntroProps> = ({ onStart }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="w-20 h-20 mb-6 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center shadow-inner">
        <Sparkles className="w-10 h-10" />
      </div>

      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
        Teorema de Pitágoras
      </h1>
      <p className="text-lg text-slate-600 max-w-xl mb-8 leading-relaxed">
        Descubre cómo relacionar las longitudes de un triángulo rectángulo a través de una experiencia guiada e intuitiva.
      </p>

      {/* Clean illustration of a right triangle without formulas */}
      <div className="w-64 h-64 mb-8 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center p-6 relative">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
          <polygon points="15,85 85,85 15,15" fill="#dbeafe" stroke="#2563eb" strokeWidth="2.5" />
          {/* Right angle marker */}
          <polyline points="15,73 27,73 27,85" fill="none" stroke="#2563eb" strokeWidth="2" />
        </svg>
      </div>

      <button
        onClick={onStart}
        className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center space-x-2 text-base"
      >
        <span>Comenzar</span>
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
};
