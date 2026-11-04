"use client";

import React, { useState } from "react";
import { Sparkles, CheckCircle2, XCircle, ArrowRight, Lightbulb, RefreshCw, BookOpen, RotateCcw } from "lucide-react";
import confetti from "canvas-confetti";
import { MathText } from "../ui/MathText";

interface RealtimeExercise {
  id: string;
  title: string;
  statement: string;
  level?: string;
  figure_type?: string;
  data_params?: Record<string, any>;
  correct_answer?: string;
  acceptable_range?: [number, number];
  unit?: string;
  hints?: {
    level_1?: string;
    level_2?: string;
    level_3?: string;
  };
  solution_steps?: string[];
}

interface SceneRealtimePracticeProps {
  exercise: RealtimeExercise;
  onRefreshExercise: () => void;
  onSubmitAnswer: (answer: string, hintsUsed: number) => Promise<any>;
  onExitInfinitePractice: () => void;
  loadingNew?: boolean;
}

export const SceneRealtimePractice: React.FC<SceneRealtimePracticeProps> = ({
  exercise,
  onRefreshExercise,
  onSubmitAnswer,
  onExitInfinitePractice,
  loadingNew = false,
}) => {
  const [answer, setAnswer] = useState("");
  const [hintsLevel, setHintsLevel] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await onSubmitAnswer(answer, hintsLevel);
      setFeedback(res);
      if (res.is_correct) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    setAnswer("");
    setHintsLevel(0);
    setFeedback(null);
    onRefreshExercise();
  };

  const params = exercise.data_params || {};
  const unit = exercise.unit || "m";
  const figureType = exercise.figure_type || "triangle_direct";

  // Dynamic SVG rendering based on figure_type
  const renderCanvas = () => {
    if (figureType === "diagonal_bar" || figureType === "ladder" || figureType === "ramp") {
      const dx = params.dx || params.base || 6;
      const dy = params.dy || params.altura || 8;
      return (
        <svg viewBox="0 0 400 240" className="w-full h-48 bg-slate-900 rounded-xl border border-slate-800">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>
          </defs>
          {/* Ground */}
          <line x1="40" y1="200" x2="360" y2="200" stroke="#475569" strokeWidth="2" strokeDasharray="4 4" />
          {/* Wall / Height */}
          <line x1="80" y1="200" x2="80" y2="50" stroke="#3b82f6" strokeWidth="4" />
          <text x="50" y="130" fill="#60a5fa" fontSize="12" fontWeight="bold">
            {dy} {unit}
          </text>
          {/* Base */}
          <line x1="80" y1="200" x2="300" y2="200" stroke="#10b981" strokeWidth="4" />
          <text x="180" y="220" fill="#34d399" fontSize="12" fontWeight="bold">
            {dx} {unit}
          </text>
          {/* Right angle marker */}
          <rect x="80" y="185" width="15" height="15" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
          {/* Hypotenuse / Support */}
          <line x1="80" y1="50" x2="300" y2="200" stroke="#f59e0b" strokeWidth="4" strokeDasharray="6 3" />
          <circle cx="80" cy="50" r="5" fill="#f59e0b" />
          <circle cx="300" cy="200" r="5" fill="#f59e0b" />
          <text x="200" y="110" fill="#fbbf24" fontSize="13" fontWeight="bold">
            ¿ c = ?
          </text>
        </svg>
      );
    }

    // Default right triangle
    const a = params.a || params.base || 6;
    const b = params.b || params.altura || 8;
    return (
      <svg viewBox="0 0 400 240" className="w-full h-48 bg-slate-900 rounded-xl border border-slate-800">
        {/* Right Triangle */}
        <polygon points="100,190 280,190 100,50" fill="rgba(59, 130, 246, 0.1)" stroke="#3b82f6" strokeWidth="3" />
        {/* Right angle */}
        <rect x="100" y="175" width="15" height="15" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
        <circle cx="107" cy="182" r="1.5" fill="#94a3b8" />
        {/* Cateto A */}
        <text x="180" y="210" fill="#34d399" fontSize="12" fontWeight="bold">
          b = {a} {unit}
        </text>
        {/* Cateto B */}
        <text x="60" y="125" fill="#60a5fa" fontSize="12" fontWeight="bold">
          a = {b} {unit}
        </text>
        {/* Hipotenusa */}
        <text x="210" y="110" fill="#fbbf24" fontSize="13" fontWeight="bold">
          c = ?
        </text>
      </svg>
    );
  };

  return (
    <div className="flex flex-col bg-slate-900 rounded-2xl border border-slate-800 p-6 md:p-8 space-y-6 shadow-xl">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Práctica Infinita · Generado por IA en Vivo</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">No precargado</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefreshExercise}
            disabled={loadingNew}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingNew ? "animate-spin" : ""}`} />
            <span>Nuevo Problema IA</span>
          </button>
          <button
            onClick={onExitInfinitePractice}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Salir de Modo Infinito</span>
          </button>
        </div>
      </div>

      {/* Title & Statement */}
      <div className="space-y-2">
        <h3 className="text-base font-bold text-white">{exercise.title}</h3>
        <p className="text-xs text-slate-300 leading-relaxed font-sans">{exercise.statement}</p>
      </div>

      {/* Dynamic 2D SVG Canvas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-[10px]">
            Diagrama 2D del Problema en el Lienzo:
          </span>
        </div>
        {renderCanvas()}
      </div>

      {/* Answer Form */}
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Ingresa tu respuesta numérica..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={submitting || feedback?.is_correct}
              className="w-full bg-slate-950 border border-slate-700 text-white font-mono font-bold text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />
            <span className="absolute right-4 top-3.5 text-xs text-slate-400 font-bold">{unit}</span>
          </div>

          {!feedback?.is_correct ? (
            <button
              type="submit"
              disabled={!answer.trim() || submitting}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {submitting ? "Verificando..." : "Comprobar"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <span>Siguiente Ejercicio IA</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs space-y-2 ${
            feedback.is_correct
              ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
              : "bg-rose-950/60 border-rose-800 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            {feedback.is_correct ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>¡Correcto! Excelente razonamiento</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>Respuesta incorrecta</span>
              </>
            )}
          </div>
          <p className="leading-relaxed">{feedback.feedback}</p>

          {feedback.solution_steps && feedback.solution_steps.length > 0 && (
            <div className="pt-2 border-t border-slate-800 space-y-1 text-slate-300">
              <span className="font-semibold text-amber-400 block">Pasos de Solución:</span>
              {feedback.solution_steps.map((st: string, idx: number) => (
                <p key={idx} className="font-mono text-[11px]">
                  {idx + 1}. {st}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Progressive Hints (Spec Section 12.3) */}
      <div className="pt-2 border-t border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <span>Pistas Progresivas del Tutor IA:</span>
          </span>
          <button
            type="button"
            onClick={() => setHintsLevel((prev) => Math.min(3, prev + 1))}
            disabled={hintsLevel >= 3}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold disabled:opacity-40"
          >
            {hintsLevel === 0 ? "Pedir Pista 1" : hintsLevel < 3 ? `Ver Pista ${hintsLevel + 1}` : "Pistas Agotadas"}
          </button>
        </div>

        {hintsLevel >= 1 && (
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
            <span className="font-bold text-amber-400 block mb-0.5">Pista 1 (Conceptual):</span>
            {exercise.hints?.level_1 || "Identifica los dos lados perpendiculares que forman 90°."}
          </div>
        )}
        {hintsLevel >= 2 && (
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
            <span className="font-bold text-amber-400 block mb-0.5">Pista 2 (Fórmula):</span>
            {exercise.hints?.level_2 || "Aplica la relación fundamental: c² = a² + b²."}
          </div>
        )}
        {hintsLevel >= 3 && (
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
            <span className="font-bold text-amber-400 block mb-0.5">Pista 3 (Cálculo directo):</span>
            {exercise.hints?.level_3 || `Calcula la raíz cuadrada de la suma de los cuadrados.`}
          </div>
        )}
      </div>
    </div>
  );
};
