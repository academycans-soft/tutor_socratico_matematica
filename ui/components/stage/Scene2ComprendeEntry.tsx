"use client";

import React, { useState } from 'react';
import { Play, BookOpen, Volume2, CheckCircle2, ArrowRight } from 'lucide-react';
import { MathText } from '../ui/MathText';

interface Scene2ComprendeEntryProps {
  onStartProof: () => void;
  onOpenMicrocheck: () => void;
  onSpeakExplanation: (text: string) => void;
}

export const Scene2ComprendeEntry: React.FC<Scene2ComprendeEntryProps> = ({
  onStartProof,
  onOpenMicrocheck,
  onSpeakExplanation,
}) => {
  const [showTextExplanation, setShowTextExplanation] = useState(false);

  const explanationText = 
    "En cualquier triángulo rectángulo, los dos lados que forman el ángulo recto de 90° se llaman catetos (a y b). " +
    "El lado opuesto al ángulo recto, que siempre es el más largo, se llama hipotenusa (c). " +
    "Existe una relación geométrica fundamental entre las áreas de los cuadrados formados sobre cada lado.";

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
      {/* Stage Badge */}
      <div className="flex items-center justify-between mb-4">
        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-200 uppercase tracking-wider">
          Etapa 2: Comprende · ¿Por qué funciona?
        </span>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        La Relación Geométrica Fundamental
      </h2>
      <p className="text-slate-600 text-sm md:text-base leading-relaxed mb-6">
        Para resolver la duda de la habitación, analizamos la relación entre las longitudes de un triángulo rectángulo cualquiera.
      </p>

      {/* Clean Right Triangle Visual */}
      <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6 flex flex-col items-center justify-center">
        <svg viewBox="0 0 320 220" className="w-full max-w-sm h-auto select-none drop-shadow-sm">
          {/* Triangle ABC */}
          <polygon points="50,180 270,180 50,40" fill="#eff6ff" stroke="#2563eb" strokeWidth="2.5" />

          {/* Right Angle Marker */}
          <polyline points="50,162 68,162 68,180" fill="none" stroke="#2563eb" strokeWidth="2" />

          {/* Labels */}
          {/* Vertical leg a */}
          <text x="30" y="115" fill="#1e293b" fontSize="16" fontWeight="bold" fontStyle="italic">a</text>
          <text x="18" y="135" fill="#64748b" fontSize="11">cateto</text>

          {/* Horizontal leg b */}
          <text x="155" y="202" fill="#1e293b" fontSize="16" fontWeight="bold" fontStyle="italic">b</text>
          <text x="145" y="215" fill="#64748b" fontSize="11">cateto</text>

          {/* Hypotenuse c */}
          <text x="170" y="100" fill="#2563eb" fontSize="18" fontWeight="extrabold" fontStyle="italic">c</text>
          <text x="185" y="115" fill="#3b82f6" fontSize="11" fontWeight="bold">hipotenusa</text>
        </svg>
      </div>

      {showTextExplanation && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm leading-relaxed animate-fade-in">
          <MathText content={explanationText} />
        </div>
      )}

      {/* Action Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <button
          onClick={onStartProof}
          className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm transition-all flex items-center justify-center space-x-2 text-sm sm:col-span-2"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Ver Demostración Geométrica Interactiva</span>
        </button>

        <button
          onClick={() => setShowTextExplanation(!showTextExplanation)}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2 text-sm"
        >
          <BookOpen className="w-4 h-4 text-slate-500" />
          <span>{showTextExplanation ? "Ocultar Explicación" : "Leer Explicación"}</span>
        </button>

        <button
          onClick={() => onSpeakExplanation(explanationText)}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2 text-sm"
        >
          <Volume2 className="w-4 h-4 text-slate-500" />
          <span>Escuchar Explicación</span>
        </button>
      </div>

      {/* "Ya conozco esto" Section */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500">¿Ya has estudiado este tema antes?</span>
        <button
          onClick={onOpenMicrocheck}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center space-x-1"
        >
          <span>Ya conozco esto</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
