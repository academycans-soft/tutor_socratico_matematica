"use client";

import React, { useState } from 'react';
import { ArrowRight, Lightbulb, Compass, CheckCircle2 } from 'lucide-react';

interface Scene1ConectaRoomProps {
  onHypothesisSubmit: (idea: string) => void;
  onDiscover: () => void;
  highlightedElement?: string | null;
}

export const Scene1ConectaRoom: React.FC<Scene1ConectaRoomProps> = ({
  onHypothesisSubmit,
  onDiscover,
  highlightedElement,
}) => {
  const [idea, setIdea] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleContinue = () => {
    if (idea.trim() && !submitted) {
      onHypothesisSubmit(idea);
      setSubmitted(true);
    }
    setRevealed(true);
  };

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 md:p-8">
      {/* Stage Badge */}
      <div className="flex items-center justify-between mb-4">
        <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200 uppercase tracking-wider">
          Etapa 1: Conecta · ¿Para qué necesito esto?
        </span>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        El Caso de las Baldosas Descuadradas
      </h2>
      <p className="text-slate-600 text-sm md:text-base leading-relaxed mb-6">
        Una habitación tiene dos paredes contiguas de <strong>6 m</strong> y <strong>8 m</strong>. Al colocar las baldosas del piso, estas no quedan correctamente alineadas, aunque están bien cortadas. Surge una sospecha: <em>¿las paredes forman realmente un ángulo de 90°?</em> No tenemos un instrumento para medir ángulos. ¿Cómo podríamos comprobarlo utilizando solamente mediciones de longitud?
      </p>

      {/* SVG Canvas representing the 6x8 room and floor grid */}
      <div className="w-full bg-slate-900 rounded-xl p-4 md:p-6 mb-6 flex flex-col items-center justify-center relative overflow-hidden">
        <svg viewBox="0 0 400 300" className="w-full max-w-lg h-auto select-none">
          <defs>
            {/* Misaligned tile pattern */}
            <pattern id="tiles" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(2.5)">
              <rect width="24" height="24" fill="#1e293b" stroke="#334155" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Floor room boundary */}
          <polygon points="50,250 350,250 50,50" fill="url(#tiles)" opacity="0.9" />

          {/* Left Wall (6m) */}
          <line x1="50" y1="250" x2="50" y2="50" stroke={highlightedElement === 'pared_6m' ? "#fbbf24" : "#f59e0b"} strokeWidth={highlightedElement === 'pared_6m' ? 10 : 6} strokeLinecap="round" className={highlightedElement === 'pared_6m' ? "animate-pulse" : ""} />
          <text x="25" y="155" fill={highlightedElement === 'pared_6m' ? "#fbbf24" : "#f59e0b"} fontSize="14" fontWeight="bold">6 m</text>

          {/* Bottom Wall (8m) */}
          <line x1="50" y1="250" x2="350" y2="250" stroke={highlightedElement === 'pared_8m' ? "#fbbf24" : "#3b82f6"} strokeWidth={highlightedElement === 'pared_8m' ? 10 : 6} strokeLinecap="round" className={highlightedElement === 'pared_8m' ? "animate-pulse" : ""} />
          <text x="195" y="275" fill={highlightedElement === 'pared_8m' ? "#fbbf24" : "#3b82f6"} fontSize="14" fontWeight="bold">8 m</text>

          {/* Corner angle indicator & AI Highlight */}
          <rect x="50" y="230" width="20" height="20" fill={highlightedElement === 'angulo_recto' ? "#fbbf24" : "none"} fillOpacity={highlightedElement === 'angulo_recto' ? "0.4" : "0"} stroke={highlightedElement === 'angulo_recto' ? "#fbbf24" : "#ef4444"} strokeWidth={highlightedElement === 'angulo_recto' ? 3 : 2} strokeDasharray={highlightedElement === 'angulo_recto' ? "none" : "3 3"} className={highlightedElement === 'angulo_recto' ? "animate-pulse" : ""} />
          <text x="75" y="242" fill={highlightedElement === 'angulo_recto' ? "#fbbf24" : "#ef4444"} fontSize="11" fontWeight={highlightedElement === 'angulo_recto' ? "bold" : "normal"}>¿90°?</text>

          {highlightedElement === 'angulo_recto' && (
            <circle cx="50" cy="250" r="32" fill="none" stroke="#fbbf24" strokeWidth="3" strokeDasharray="4 2" className="animate-spin-slow" />
          )}

          {/* Animated Diagonal when revealed */}
          {(revealed || highlightedElement === 'diagonal_real') && (
            <g className="animate-fade-in">
              <line
                x1="50"
                y1="50"
                x2="350"
                y2="250"
                stroke={highlightedElement === 'diagonal_real' ? "#fbbf24" : "#10b981"}
                strokeWidth={highlightedElement === 'diagonal_real' ? 6 : 4}
                strokeDasharray="6 4"
                className={highlightedElement === 'diagonal_real' ? "animate-pulse" : ""}
              />
              {/* Measurement badge */}
              <rect x="160" y="125" width="110" height="32" rx="6" fill="#064e3b" stroke="#10b981" strokeWidth="1.5" />
              <text x="215" y="146" fill="#34d399" fontSize="13" fontWeight="bold" textAnchor="middle">
                Diagonal: 10,18 m
              </text>
            </g>
          )}
        </svg>

        {revealed && (
          <div className="mt-3 px-4 py-2 bg-emerald-950/80 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs md:text-sm text-center">
            Medición real realizada entre las esquinas opuestas: <strong>10,18 m</strong>
          </div>
        )}
      </div>

      {/* Interactive Action Area */}
      {!revealed ? (
        <div className="flex flex-col space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center space-x-1.5">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span>Tengo una idea (Opcional - Tu respuesta se guarda como participación)</span>
            </label>
            <input
              type="text"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="¿Qué medirías tú en el suelo o en las esquinas?"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleContinue}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center space-x-2 text-sm shadow-sm"
            >
              <span>Continuar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col space-y-4 bg-blue-50/70 border border-blue-200/80 rounded-xl p-5">
          <p className="text-slate-800 text-sm md:text-base font-medium">
            Al medir la distancia diagonal entre esquinas, obtenemos <strong>10,18 m</strong>.<br />
            <strong>Si las paredes formaran exactamente 90°, ¿cuánto debería medir esa diagonal?</strong>
          </p>

          <div className="flex justify-end">
            <button
              onClick={onDiscover}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md flex items-center space-x-2 text-sm"
            >
              <span>Descubrirlo en Comprende</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
