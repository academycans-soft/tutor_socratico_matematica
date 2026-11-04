"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw, ArrowRight } from 'lucide-react';
import { MathText } from '../ui/MathText';

interface Scene3GeometricProofProps {
  onComplete: () => void;
  externalStep?: number;
  onStepChange?: (step: number) => void;
  highlightedElement?: string | null;
}

export const Scene3GeometricProof: React.FC<Scene3GeometricProofProps> = ({
  onComplete,
  externalStep,
  onStepChange,
  highlightedElement,
}) => {
  const [currentScene, setCurrentScene] = useState<number>(externalStep || 1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    if (externalStep && externalStep >= 1 && externalStep <= 5) {
      setCurrentScene(externalStep);
    }
  }, [externalStep]);

  // Auto-play timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setTimeout(() => {
        if (currentScene < 5) {
          setCurrentScene((s) => s + 1);
        } else {
          setIsPlaying(false);
        }
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentScene]);

  const handleNext = () => {
    if (currentScene < 5) setCurrentScene(currentScene + 1);
  };

  const handlePrev = () => {
    if (currentScene > 1) setCurrentScene(currentScene - 1);
  };

  const handleReset = () => {
    setCurrentScene(1);
    setIsPlaying(false);
  };

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
      {/* Stage Badge & Step Indicator */}
      <div className="flex items-center justify-between mb-4">
        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-200 uppercase tracking-wider">
          Demostración Geométrica · Escena {currentScene} de 5
        </span>
        <div className="flex space-x-1.5">
          {[1, 2, 3, 4, 5].map((step) => (
            <button
              key={step}
              onClick={() => setCurrentScene(step)}
              className={`w-6 h-6 rounded-full text-xs font-bold transition-all ${
                currentScene === step
                  ? "bg-blue-600 text-white shadow-sm"
                  : currentScene > step
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {step}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Canvas for the 5 Geometric Proof Scenes */}
      <div className="w-full bg-slate-950 rounded-xl p-4 md:p-6 mb-6 flex flex-col items-center justify-center relative overflow-hidden min-h-[340px]">
        <svg viewBox="0 0 400 360" className="w-full max-w-md h-auto select-none">
          {/* Base measurements: a=90, b=120, total outer side=210. Centered around x=95..305, y=50..260 */}

          {/* ESCENA 1: Solo el triángulo base */}
          {currentScene === 1 && (
            <g className="transition-all duration-500">
              <polygon points="120,240 240,240 120,150" fill="#3b82f6" fillOpacity="0.4" stroke="#60a5fa" strokeWidth="2.5" />
              {/* Right angle marker */}
              <polyline points="120,225 135,225 135,240" fill="none" stroke="#93c5fd" strokeWidth="2" />
              {/* Labels */}
              <text
                x="100"
                y="200"
                fill={highlightedElement === 'cateto_a' ? "#fbbf24" : "#facc15"}
                fontSize={highlightedElement === 'cateto_a' ? "24" : "18"}
                fontWeight="bold"
                fontStyle="italic"
                className={highlightedElement === 'cateto_a' ? "animate-pulse" : ""}
              >
                a
              </text>
              <text
                x="175"
                y="265"
                fill={highlightedElement === 'cateto_b' ? "#fbbf24" : "#38bdf8"}
                fontSize={highlightedElement === 'cateto_b' ? "24" : "18"}
                fontWeight="bold"
                fontStyle="italic"
                className={highlightedElement === 'cateto_b' ? "animate-pulse" : ""}
              >
                b
              </text>
              <text
                x="195"
                y="190"
                fill={highlightedElement === 'hipotenusa_c' ? "#fbbf24" : "#4ade80"}
                fontSize={highlightedElement === 'hipotenusa_c' ? "26" : "20"}
                fontWeight="extrabold"
                fontStyle="italic"
                className={highlightedElement === 'hipotenusa_c' ? "animate-pulse" : ""}
              >
                c
              </text>
            </g>
          )}

          {/* ESCENAS 2 A 5: Cuadrado exterior con 4 triángulos congruentes y cuadrado interior */}
          {currentScene >= 2 && (
            <g className="transition-all duration-500">
              {/* Outer boundary frame */}
              <rect
                x="95"
                y="50"
                width="210"
                height="210"
                fill="none"
                stroke={currentScene === 3 ? "#f59e0b" : "#475569"}
                strokeWidth={currentScene === 3 ? "3.5" : "1.5"}
                strokeDasharray={currentScene === 3 ? "none" : "4 4"}
              />

              {/* Triangle 1 (Bottom) */}
              <polygon
                points="95,260 305,260 95,170"
                fill="#3b82f6"
                fillOpacity={highlightedElement === 'triangulos' ? "0.85" : currentScene === 4 ? "0.7" : "0.35"}
                stroke={highlightedElement === 'triangulos' ? "#fbbf24" : "#60a5fa"}
                strokeWidth={highlightedElement === 'triangulos' ? 3.5 : 2}
                className={highlightedElement === 'triangulos' ? "animate-pulse" : ""}
              />

              {/* Triangle 2 (Right) */}
              <polygon
                points="305,260 305,50 215,260"
                fill="#3b82f6"
                fillOpacity={highlightedElement === 'triangulos' ? "0.85" : currentScene === 4 ? "0.7" : "0.35"}
                stroke={highlightedElement === 'triangulos' ? "#fbbf24" : "#60a5fa"}
                strokeWidth={highlightedElement === 'triangulos' ? 3.5 : 2}
                className={highlightedElement === 'triangulos' ? "animate-pulse" : ""}
              />

              {/* Triangle 3 (Top) */}
              <polygon
                points="305,50 95,50 305,140"
                fill="#3b82f6"
                fillOpacity={highlightedElement === 'triangulos' ? "0.85" : currentScene === 4 ? "0.7" : "0.35"}
                stroke={highlightedElement === 'triangulos' ? "#fbbf24" : "#60a5fa"}
                strokeWidth={highlightedElement === 'triangulos' ? 3.5 : 2}
                className={highlightedElement === 'triangulos' ? "animate-pulse" : ""}
              />

              {/* Triangle 4 (Left) */}
              <polygon
                points="95,50 95,260 185,50"
                fill="#3b82f6"
                fillOpacity={highlightedElement === 'triangulos' ? "0.85" : currentScene === 4 ? "0.7" : "0.35"}
                stroke={highlightedElement === 'triangulos' ? "#fbbf24" : "#60a5fa"}
                strokeWidth={highlightedElement === 'triangulos' ? 3.5 : 2}
                className={highlightedElement === 'triangulos' ? "animate-pulse" : ""}
              />

              {/* Central Inner Square (Side c, Area c²) */}
              <polygon
                points="95,170 215,260 305,140 185,50"
                fill={highlightedElement === 'cuadrado_central' ? "#fbbf24" : currentScene >= 4 ? "#10b981" : "#1e293b"}
                fillOpacity={highlightedElement === 'cuadrado_central' ? "0.75" : currentScene >= 4 ? "0.55" : "0.4"}
                stroke={highlightedElement === 'cuadrado_central' ? "#f59e0b" : "#34d399"}
                strokeWidth={highlightedElement === 'cuadrado_central' ? 5 : 2.5}
                className={highlightedElement === 'cuadrado_central' ? "animate-pulse" : ""}
              />

              {/* Labels for side a and b on outer edges */}
              <text
                x="65"
                y="115"
                fill={highlightedElement === 'cateto_b' ? "#fbbf24" : "#facc15"}
                fontSize={highlightedElement === 'cateto_b' ? "22" : "16"}
                fontWeight="bold"
                className={highlightedElement === 'cateto_b' ? "animate-pulse" : ""}
              >
                b
              </text>
              <text
                x="65"
                y="220"
                fill={highlightedElement === 'cateto_a' ? "#fbbf24" : "#facc15"}
                fontSize={highlightedElement === 'cateto_a' ? "22" : "16"}
                fontWeight="bold"
                className={highlightedElement === 'cateto_a' ? "animate-pulse" : ""}
              >
                a
              </text>
              <text
                x="145"
                y="285"
                fill={highlightedElement === 'cateto_b' ? "#fbbf24" : "#38bdf8"}
                fontSize={highlightedElement === 'cateto_b' ? "22" : "16"}
                fontWeight="bold"
                className={highlightedElement === 'cateto_b' ? "animate-pulse" : ""}
              >
                b
              </text>
              <text
                x="260"
                y="285"
                fill={highlightedElement === 'cateto_a' ? "#fbbf24" : "#38bdf8"}
                fontSize={highlightedElement === 'cateto_a' ? "22" : "16"}
                fontWeight="bold"
                className={highlightedElement === 'cateto_a' ? "animate-pulse" : ""}
              >
                a
              </text>

              {/* Central Area Label */}
              <text
                x="200"
                y="160"
                fill={highlightedElement === 'cuadrado_central' || highlightedElement === 'hipotenusa_c' ? "#fbbf24" : "#34d399"}
                fontSize={highlightedElement === 'cuadrado_central' || highlightedElement === 'hipotenusa_c' ? "28" : "22"}
                fontWeight="extrabold"
                textAnchor="middle"
                fontStyle="italic"
                className={highlightedElement === 'cuadrado_central' || highlightedElement === 'hipotenusa_c' ? "animate-pulse" : ""}
              >
                c²
              </text>

              {/* Outer Dimension indicators for Scene 3 */}
              {currentScene === 3 && (
                <g>
                  <text x="200" y="35" fill="#f59e0b" fontSize="15" fontWeight="bold" textAnchor="middle">
                    Lado = (a + b)
                  </text>
                </g>
              )}
            </g>
          )}
        </svg>

        {/* Narrative / Formula Box below Canvas */}
        <div className="w-full mt-3 p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-center text-slate-100 text-sm md:text-base">
          {currentScene === 1 && (
            <p>
              Partimos de un triángulo rectángulo base con catetos <strong className="text-yellow-400">a</strong> y{" "}
              <strong className="text-sky-400">b</strong>, e hipotenusa <strong className="text-emerald-400">c</strong>.
            </p>
          )}
          {currentScene === 2 && (
            <p>
              Tomamos <strong>4 copias idénticas</strong> del triángulo y las rotamos para formar un gran cuadrado exterior.
              En el centro queda un cuadrado de lado <strong className="text-emerald-400">c</strong>.
            </p>
          )}
          {currentScene === 3 && (
            <div>
              <p className="mb-1">El cuadrado exterior tiene lado <strong>(a + b)</strong>. Su área total es:</p>
              <div className="text-amber-400 font-bold text-lg">
                <MathText content="$$A = (a + b)^2 = a^2 + 2ab + b^2$$" />
              </div>
            </div>
          )}
          {currentScene === 4 && (
            <div>
              <p className="mb-1">Esa misma área total también es la suma de sus <strong>5 piezas internas</strong>:</p>
              <div className="text-emerald-400 font-bold text-lg">
                <MathText content="$$A = 4\left(\frac{ab}{2}\right) + c^2 = 2ab + c^2$$" />
              </div>
            </div>
          )}
          {currentScene === 5 && (
            <div className="space-y-2">
              <p className="text-slate-300">Como ambas expresiones calculan la misma superficie, las igualamos:</p>
              <div className="text-slate-200 font-semibold">
                <MathText content="$$(a + b)^2 = 2ab + c^2$$" />
                <MathText content="$$a^2 + \mathbf{2ab} + b^2 = \mathbf{2ab} + c^2$$" />
              </div>
              <p className="text-xs text-amber-300">¡Cancelamos visualmente el término común 2ab a ambos lados!</p>
              <div className="p-3 bg-blue-950/80 border border-blue-500/50 rounded-lg text-blue-300 font-extrabold text-xl">
                <MathText content="$$a^2 + b^2 = c^2$$" />
                <span className="block text-xs uppercase tracking-widest text-slate-300 font-normal mt-1">
                  Teorema de Pitágoras
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Control Bar: Anterior · Pausar/Play · Siguiente · Repetir */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrev}
            disabled={currentScene === 1}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-xl text-slate-700 transition-colors"
            title="Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-800 text-sm font-semibold flex items-center space-x-1.5 transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-slate-700" /> : <Play className="w-4 h-4 fill-slate-700" />}
            <span>{isPlaying ? "Pausar" : "Reproducir"}</span>
          </button>

          <button
            onClick={handleNext}
            disabled={currentScene === 5}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-xl text-slate-700 transition-colors"
            title="Siguiente"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={handleReset}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition-colors"
            title="Repetir desde el inicio"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {currentScene === 5 && (
          <button
            onClick={onComplete}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-all shadow-md flex items-center space-x-2 animate-pulse"
          >
            <span>Resolver el Caso de la Habitación</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
