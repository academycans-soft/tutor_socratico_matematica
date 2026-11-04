"use client";

import React, { useState } from 'react';
import { HelpCircle, CheckCircle2, XCircle, ArrowRight, Lightbulb, BookOpen, Eye, EyeOff } from 'lucide-react';
import confetti from 'canvas-confetti';
import { MathText } from '../ui/MathText';

interface Exercise {
  id: string;
  level: string;
  title: string;
  statement: string;
  figure_type?: string;
  data_params?: Record<string, any>;
  unit?: string;
  hints?: {
    level_1?: string;
    level_2?: string;
    level_3?: string;
  };
  solution_steps?: string[];
}

interface Scene5ResuelveExerciseProps {
  exercise: Exercise;
  currentLevel: string;
  onSubmit: (answer: string, hintsUsed: number) => Promise<any>;
  onNextExercise: () => void;
  highlightedElement?: string | null;
}

export const Scene5ResuelveExercise: React.FC<Scene5ResuelveExerciseProps> = ({
  exercise,
  currentLevel,
  onSubmit,
  onNextExercise,
  highlightedElement,
}) => {
  const [answer, setAnswer] = useState('');
  const [hintsLevel, setHintsLevel] = useState<number>(0);
  const [showConceptModal, setShowConceptModal] = useState(false);
  const [showDiagram, setShowDiagram] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await onSubmit(answer, hintsLevel);
      setFeedback(res);
      if (res.correct) {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    setAnswer('');
    setHintsLevel(0);
    setFeedback(null);
    onNextExercise();
  };

  const levelBadges: Record<string, { label: string; color: string }> = {
    basico: { label: "Nivel 1 · Básico (Aplicación Directa)", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    intermedio: { label: "Nivel 2 · Intermedio (Interpretación)", color: "bg-blue-50 text-blue-700 border-blue-200" },
    avanzado: { label: "Nivel 3 · Avanzado (Modelación)", color: "bg-purple-50 text-purple-700 border-purple-200" },
    desafio: { label: "Desafío Opcional (Problema No Rutinario)", color: "bg-amber-50 text-amber-700 border-amber-200" },
  };

  const badge = levelBadges[exercise.level] || levelBadges.basico;
  const params = exercise.data_params || {};
  const unit = exercise.unit || "m";

  const isHighlighted = (target: string) => {
    if (!highlightedElement) return false;
    const h = highlightedElement.toLowerCase();
    const t = target.toLowerCase();
    if (h === t) return true;
    if (h === 'diagrama') return true;
    if (t === 'cateto_a' && (h === 'cateto_horizontal' || h === 'base' || h === 'pared_8m')) return true;
    if (t === 'cateto_b' && (h === 'cateto_vertical' || h === 'altura' || h === 'pared_6m')) return true;
    if (t === 'hipotenusa' && (h === 'hipotenusa_c' || h === 'barra' || h === 'barra_diagonal' || h === 'escalera' || h === 'diagonal_real')) return true;
    return false;
  };

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 relative">
      {/* Level Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <span className={`px-3 py-1 text-xs font-bold rounded-full border uppercase tracking-wider ${badge.color}`}>
          {badge.label}
        </span>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowDiagram(!showDiagram)}
            className="text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 transition-colors"
          >
            {showDiagram ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showDiagram ? "Ocultar Diagrama" : "Ver Diagrama"}</span>
          </button>
          <button
            onClick={() => setShowConceptModal(true)}
            className="text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center space-x-1"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Recordar Concepto</span>
          </button>
        </div>
      </div>

      <h2 className="text-xl font-bold text-slate-900 mb-3">{exercise.title}</h2>
      <div className="text-slate-700 text-sm md:text-base leading-relaxed mb-6 bg-slate-50 border border-slate-200 p-4 rounded-xl">
        <MathText content={exercise.statement} />
      </div>

      {/* Dynamic 2D Geometric Diagram for the Exercise */}
      {showDiagram && (
        <div className="w-full bg-slate-950 rounded-2xl p-4 md:p-6 mb-6 flex flex-col items-center justify-center relative overflow-hidden border border-slate-800 shadow-inner">
          <div className="w-full flex items-center justify-between mb-2 px-1 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span>Lienzo del Problema · Representación Geométrica</span>
            </span>
            <span className="text-[11px] text-slate-500">Ángulo Recto = 90°</span>
          </div>

          {/* 1. Diagonal Bar Problem (Longitud de Barra Diagonal) */}
          {(exercise.figure_type === 'diagonal_bar' || exercise.title.toLowerCase().includes('barra')) && (
            <svg viewBox="0 0 420 220" className="w-full max-w-md h-auto select-none">
              <defs>
                <pattern id="diag-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.8" />
                </pattern>
              </defs>
              <rect width="420" height="220" fill="url(#diag-grid)" opacity="0.6" />

              {/* Shaded triangle area */}
              <polygon
                points="70,180 330,180 330,40"
                fill="#1e293b"
                fillOpacity="0.4"
                stroke="#334155"
                strokeWidth="1"
              />

              {/* Horizontal Separation (dx = 4.8 m) */}
              <line
                x1="70"
                y1="180"
                x2="330"
                y2="180"
                stroke={isHighlighted('cateto_a') ? "#fbbf24" : "#3b82f6"}
                strokeWidth={isHighlighted('cateto_a') ? 6 : 3.5}
                strokeLinecap="round"
                className={isHighlighted('cateto_a') ? "animate-pulse" : ""}
              />
              <text
                x="200"
                y="202"
                fill={isHighlighted('cateto_a') ? "#fbbf24" : "#38bdf8"}
                fontSize="14"
                fontWeight="bold"
                textAnchor="middle"
                className={isHighlighted('cateto_a') ? "animate-pulse" : ""}
              >
                Horizontal = {params.dx ?? "4.8"} {unit}
              </text>

              {/* Vertical Separation (dy = 7.2 m) */}
              <line
                x1="330"
                y1="180"
                x2="330"
                y2="40"
                stroke={isHighlighted('cateto_b') ? "#fbbf24" : "#f59e0b"}
                strokeWidth={isHighlighted('cateto_b') ? 6 : 3.5}
                strokeLinecap="round"
                className={isHighlighted('cateto_b') ? "animate-pulse" : ""}
              />
              <text
                x="340"
                y="115"
                fill={isHighlighted('cateto_b') ? "#fbbf24" : "#facc15"}
                fontSize="14"
                fontWeight="bold"
                className={isHighlighted('cateto_b') ? "animate-pulse" : ""}
              >
                Vertical = {params.dy ?? "7.2"} {unit}
              </text>

              {/* Right Angle Corner (90°) */}
              <polyline
                points="310,180 310,160 330,160"
                fill={isHighlighted('angulo_recto') ? "#fbbf24" : "none"}
                fillOpacity={isHighlighted('angulo_recto') ? "0.4" : "0"}
                stroke={isHighlighted('angulo_recto') ? "#fbbf24" : "#ef4444"}
                strokeWidth={isHighlighted('angulo_recto') ? 3 : 2}
                className={isHighlighted('angulo_recto') ? "animate-pulse" : ""}
              />
              <text x="290" y="174" fill={isHighlighted('angulo_recto') ? "#fbbf24" : "#f87171"} fontSize="11" fontWeight="bold">90°</text>

              {/* Diagonal Support Bar (Hypotenuse = ?) */}
              <line
                x1="70"
                y1="180"
                x2="330"
                y2="40"
                stroke={isHighlighted('hipotenusa') ? "#fbbf24" : "#10b981"}
                strokeWidth={isHighlighted('hipotenusa') ? 7 : 4.5}
                strokeLinecap="round"
                strokeDasharray="6 3"
                className={isHighlighted('hipotenusa') ? "animate-pulse" : ""}
              />

              {/* Support Points A and B */}
              <circle cx="70" cy="180" r="6" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />
              <text x="50" y="185" fill="#93c5fd" fontSize="13" fontWeight="extrabold">A</text>

              <circle cx="330" cy="40" r="6" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
              <text x="342" y="42" fill="#fde68a" fontSize="13" fontWeight="extrabold">B</text>

              {/* Diagonal Bar Measurement Badge */}
              <g transform="translate(140, 90)">
                <rect
                  x="0"
                  y="0"
                  width="140"
                  height="30"
                  rx="8"
                  fill="#064e3b"
                  stroke={isHighlighted('hipotenusa') ? "#fbbf24" : "#10b981"}
                  strokeWidth={isHighlighted('hipotenusa') ? 2.5 : 1.5}
                  className={isHighlighted('hipotenusa') ? "animate-pulse" : ""}
                />
                <text x="70" y="19" fill="#34d399" fontSize="12" fontWeight="extrabold" textAnchor="middle">
                  Barra (L) = ?
                </text>
              </g>
            </svg>
          )}

          {/* 2. Leaning Ladder Problem (Seguridad de Escalera) */}
          {(exercise.figure_type === 'ladder' || exercise.title.toLowerCase().includes('escalera')) && (
            <svg viewBox="0 0 420 220" className="w-full max-w-md h-auto select-none">
              {/* Wall structure */}
              <rect x="310" y="20" width="30" height="170" fill="#334155" stroke="#475569" strokeWidth="1.5" />
              <line
                x1="310"
                y1="190"
                x2="310"
                y2="40"
                stroke={isHighlighted('cateto_b') ? "#fbbf24" : "#f59e0b"}
                strokeWidth={isHighlighted('cateto_b') ? 6 : 3.5}
                className={isHighlighted('cateto_b') ? "animate-pulse" : ""}
              />
              <text x="350" y="115" fill={isHighlighted('cateto_b') ? "#fbbf24" : "#facc15"} fontSize="13" fontWeight="bold">
                Altura = {params.height ?? "3.06"} {unit}
              </text>

              {/* Window */}
              <rect x="295" y="35" width="15" height="20" fill="#38bdf8" fillOpacity="0.7" stroke="#ffffff" strokeWidth="1" />

              {/* Floor */}
              <line
                x1="70"
                y1="190"
                x2="350"
                y2="190"
                stroke={isHighlighted('cateto_a') ? "#fbbf24" : "#3b82f6"}
                strokeWidth={isHighlighted('cateto_a') ? 6 : 3.5}
                className={isHighlighted('cateto_a') ? "animate-pulse" : ""}
              />
              <text x="180" y="210" fill={isHighlighted('cateto_a') ? "#fbbf24" : "#38bdf8"} fontSize="13" fontWeight="bold" textAnchor="middle">
                Base al suelo = {params.base ?? "4.20"} {unit}
              </text>

              {/* Corner 90° */}
              <polyline points="295,190 295,175 310,175" fill="none" stroke="#ef4444" strokeWidth="2" />
              <text x="275" y="185" fill="#f87171" fontSize="10" fontWeight="bold">90°</text>

              {/* Leaning Ladder */}
              <line
                x1="90"
                y1="190"
                x2="310"
                y2="45"
                stroke={isHighlighted('hipotenusa') ? "#fbbf24" : "#10b981"}
                strokeWidth={isHighlighted('hipotenusa') ? 6 : 4}
                className={isHighlighted('hipotenusa') ? "animate-pulse" : ""}
              />
              <rect x="135" y="95" width="130" height="28" rx="6" fill="#064e3b" stroke="#10b981" strokeWidth="1.5" />
              <text x="200" y="113" fill="#34d399" fontSize="12" fontWeight="bold" textAnchor="middle">
                Escalera (L) = ?
              </text>
            </svg>
          )}

          {/* 3. The Pond Problem (Desafío del Estanque) */}
          {(exercise.figure_type === 'pond' || exercise.title.toLowerCase().includes('estanque')) && (
            <svg viewBox="0 0 420 220" className="w-full max-w-md h-auto select-none">
              {/* Water area */}
              <rect x="60" y="90" width="300" height="100" fill="#0369a1" fillOpacity="0.4" stroke="#0284c7" strokeWidth="1.5" />
              <text x="210" y="115" fill="#bae6fd" fontSize="12" fontWeight="bold" textAnchor="middle">Superficie del Agua</text>

              {/* Width dimension: 10m -> 5m center to shore */}
              <line x1="210" y1="90" x2="360" y2="90" stroke={isHighlighted('cateto_a') ? "#fbbf24" : "#38bdf8"} strokeWidth="3" />
              <text x="285" y="80" fill={isHighlighted('cateto_a') ? "#fbbf24" : "#38bdf8"} fontSize="12" fontWeight="bold" textAnchor="middle">
                Centro a orilla = 5 m
              </text>

              {/* Vertical reed: depth x + overflow 1m */}
              <line x1="210" y1="190" x2="210" y2="60" stroke="#eab308" strokeWidth="4" />
              <text x="145" y="145" fill={isHighlighted('cateto_b') ? "#fbbf24" : "#fef08a"} fontSize="12" fontWeight="bold">
                Profundidad = x
              </text>
              <text x="215" y="55" fill="#a3e635" fontSize="11" fontWeight="bold">+1 m</text>

              {/* Bent reed reaching the shore */}
              <line
                x1="210"
                y1="190"
                x2="360"
                y2="90"
                stroke={isHighlighted('hipotenusa') ? "#fbbf24" : "#10b981"}
                strokeWidth={isHighlighted('hipotenusa') ? 5 : 3.5}
                strokeDasharray="5 3"
                className={isHighlighted('hipotenusa') ? "animate-pulse" : ""}
              />
              <text x="310" y="150" fill={isHighlighted('hipotenusa') ? "#fbbf24" : "#34d399"} fontSize="12" fontWeight="bold">
                Largo = (x + 1)
              </text>
            </svg>
          )}

          {/* 4. Default Direct Triangle (Cálculo directo de hipotenusa o cateto) */}
          {!['diagonal_bar', 'ladder', 'pond'].includes(exercise.figure_type || '') &&
           !exercise.title.toLowerCase().includes('barra') &&
           !exercise.title.toLowerCase().includes('escalera') &&
           !exercise.title.toLowerCase().includes('estanque') && (
            <svg viewBox="0 0 420 220" className="w-full max-w-md h-auto select-none">
              <polygon
                points="100,180 320,180 100,50"
                fill="#1e293b"
                fillOpacity="0.5"
                stroke="#475569"
                strokeWidth="1.5"
              />

              {/* Base Leg */}
              <line
                x1="100"
                y1="180"
                x2="320"
                y2="180"
                stroke={isHighlighted('cateto_b') || isHighlighted('cateto_a') ? "#fbbf24" : "#3b82f6"}
                strokeWidth={isHighlighted('cateto_b') || isHighlighted('cateto_a') ? 6 : 3.5}
                className={isHighlighted('cateto_b') || isHighlighted('cateto_a') ? "animate-pulse" : ""}
              />
              <text
                x="210"
                y="202"
                fill={isHighlighted('cateto_b') || isHighlighted('cateto_a') ? "#fbbf24" : "#38bdf8"}
                fontSize="14"
                fontWeight="bold"
                textAnchor="middle"
              >
                {params.b ? `b = ${params.b} ${unit}` : params.a ? `a = ${params.a} ${unit}` : `Cateto = ?`}
              </text>

              {/* Vertical Leg */}
              <line
                x1="100"
                y1="180"
                x2="100"
                y2="50"
                stroke={isHighlighted('cateto_a') || isHighlighted('cateto_b') ? "#fbbf24" : "#f59e0b"}
                strokeWidth={isHighlighted('cateto_a') || isHighlighted('cateto_b') ? 6 : 3.5}
                className={isHighlighted('cateto_a') || isHighlighted('cateto_b') ? "animate-pulse" : ""}
              />
              <text
                x="60"
                y="115"
                fill={isHighlighted('cateto_a') || isHighlighted('cateto_b') ? "#fbbf24" : "#facc15"}
                fontSize="14"
                fontWeight="bold"
              >
                {params.a ? `a = ${params.a} ${unit}` : params.b ? `b = ${params.b} ${unit}` : `Cateto`}
              </text>

              {/* Right Angle Corner 90° */}
              <polyline points="100,165 115,165 115,180" fill="none" stroke="#ef4444" strokeWidth="2" />
              <text x="120" y="174" fill="#f87171" fontSize="11" fontWeight="bold">90°</text>

              {/* Hypotenuse */}
              <line
                x1="100"
                y1="50"
                x2="320"
                y2="180"
                stroke={isHighlighted('hipotenusa') ? "#fbbf24" : "#10b981"}
                strokeWidth={isHighlighted('hipotenusa') ? 6 : 4}
                className={isHighlighted('hipotenusa') ? "animate-pulse" : ""}
              />
              <text
                x="230"
                y="105"
                fill={isHighlighted('hipotenusa') ? "#fbbf24" : "#34d399"}
                fontSize="15"
                fontWeight="extrabold"
              >
                {params.c ? `c = ${params.c} ${unit}` : `Hipotenusa (c) = ?`}
              </text>
            </svg>
          )}
        </div>
      )}

      {/* Progressive Hints Area */}
      {hintsLevel > 0 && exercise.hints && (
        <div className="mb-6 space-y-2 animate-fade-in">
          {hintsLevel >= 1 && exercise.hints.level_1 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs md:text-sm text-amber-900 flex items-start space-x-2">
              <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Pista 1 (Conceptual):</strong> <MathText content={exercise.hints.level_1} />
              </div>
            </div>
          )}
          {hintsLevel >= 2 && exercise.hints.level_2 && (
            <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-xl text-xs md:text-sm text-amber-950 flex items-start space-x-2">
              <Lightbulb className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Pista 2 (Señalamiento visual / fórmula):</strong> <MathText content={exercise.hints.level_2} />
              </div>
            </div>
          )}
          {hintsLevel >= 3 && exercise.hints.level_3 && (
            <div className="p-3 bg-amber-200/60 border border-amber-400 rounded-xl text-xs md:text-sm text-amber-950 flex items-start space-x-2">
              <Lightbulb className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
              <div>
                <strong>Pista 3 (Guía paso a paso):</strong> <MathText content={exercise.hints.level_3} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Answer Form */}
      {!feedback?.correct ? (
        <form onSubmit={handleCheck} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="relative flex-1">
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Ingresa tu respuesta numérica"
              className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
            {exercise.unit && (
              <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">
                {exercise.unit}
              </span>
            )}
          </div>

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setHintsLevel((h) => Math.min(3, h + 1))}
              disabled={hintsLevel >= 3}
              className="px-4 py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold rounded-xl text-xs md:text-sm transition-colors flex items-center space-x-1.5"
            >
              <Lightbulb className="w-4 h-4 text-amber-600" />
              <span>Pista {hintsLevel > 0 ? `(${hintsLevel}/3)` : ''}</span>
            </button>

            <button
              type="submit"
              disabled={!answer.trim() || submitting}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center space-x-2"
            >
              <span>{submitting ? "Verificando..." : "Comprobar"}</span>
            </button>
          </div>
        </form>
      ) : null}

      {/* Feedback Alerts */}
      {feedback && (
        <div className={`p-4 rounded-xl mb-6 border animate-fade-in ${
          feedback.correct
            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
            : "bg-rose-50 border-rose-200 text-rose-900"
        }`}>
          <div className="flex items-start space-x-3">
            {feedback.correct ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-2 flex-1">
              <p className="text-sm font-semibold">{feedback.feedback}</p>
              {feedback.level_up && (
                <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-800">
                  🎉 ¡Has acertado 2 ejercicios seguidos sin ayuda! Has avanzado al siguiente nivel: {feedback.current_level?.toUpperCase()}.
                </div>
              )}
              {feedback.solution_steps && (
                <div className="text-xs text-slate-600 pt-1">
                  <strong>Pasos de solución:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {feedback.solution_steps.map((st: string, i: number) => (
                      <li key={i}><MathText content={st} /></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {feedback.correct && (
            <div className="flex justify-end mt-4">
              <button
                onClick={handleNext}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-all shadow-sm flex items-center space-x-2"
              >
                <span>Siguiente Ejercicio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recordar Concepto Modal */}
      {showConceptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Recordar: Teorema de Pitágoras</h3>
            <p className="text-xs text-slate-500 mb-4">Consulta rápida sin abandonar tu ejercicio actual.</p>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center mb-4">
              <div className="text-xl font-extrabold text-blue-700">
                <MathText content="$$a^2 + b^2 = c^2$$" />
              </div>
              <p className="text-xs text-slate-600 mt-2">
                En todo triángulo rectángulo, el cuadrado de la hipotenusa ($c$) es igual a la suma de los cuadrados de los catetos ($a$ y $b$).
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowConceptModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Volver al Ejercicio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
