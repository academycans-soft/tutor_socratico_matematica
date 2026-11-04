"use client";

import React, { useState } from 'react';
import {
  Sparkles,
  Award,
  CheckCircle2,
  Lock,
  Play,
  Flame,
  Star,
  School,
  ChevronRight,
  BookOpen,
  Layers,
  ArrowRight,
  RotateCcw,
  Compass,
  Trophy,
  Zap,
  Info
} from 'lucide-react';

export interface TopicItem {
  id?: string;
  code: string;
  title: string;
  subtitle?: string;
  description?: string;
  unit_id?: string;
  unitTitle?: string;
  trimester?: number;
  gradeName?: string;
  order_index?: number;
  status?: string;
  microcompetencies?: any[];
}

export interface StudentProgressMap {
  [topicCode: string]: {
    topic_code: string;
    average_domain_d: number;
    active_stage: string;
    active_scene: string;
    current_level: string;
    is_mastered: boolean;
    completed: boolean;
  };
}

interface StudentCurriculumPathProps {
  classroom: any | null;
  topics: TopicItem[];
  progressData: StudentProgressMap;
  activeTopicCode: string;
  activeTopicState?: any;
  onSelectTopic: (code: string) => void;
  onStartPractice: (code: string) => void;
  onResetTopic?: (code: string) => void;
  onOpenClassroomModal: () => void;
}

export function StudentCurriculumPath({
  classroom,
  topics,
  progressData,
  activeTopicCode,
  activeTopicState,
  onSelectTopic,
  onStartPractice,
  onResetTopic,
  onOpenClassroomModal,
}: StudentCurriculumPathProps) {
  const [selectedTopicModal, setSelectedTopicModal] = useState<TopicItem | null>(null);

  // Group topics by unit
  const unitsMap = new Map<string, { title: string; trimester?: number; topics: TopicItem[] }>();

  topics.forEach((t) => {
    const unitKey = t.unitTitle || t.unit_id || "Unidad de Aprendizaje";
    if (!unitsMap.has(unitKey)) {
      unitsMap.set(unitKey, {
        title: unitKey,
        trimester: t.trimester,
        topics: [],
      });
    }
    unitsMap.get(unitKey)!.topics.push(t);
  });

  const unitsList = Array.from(unitsMap.values());

  // Determine unlocked / completed states sequentially
  // Rule:
  // - First topic is always unlocked if not completed.
  // - A topic is locked if the previous topic is not completed (unless it already has progress/mastery).
  let prevTopicCompleted = true;
  const enrichedTopics: { topic: TopicItem; status: 'completed' | 'current' | 'locked'; progress: any }[] = [];

  topics.forEach((t, index) => {
    // If active topic state is already loaded, merge it for instant 100% synchronization
    const p = (t.code === activeTopicCode && activeTopicState) ? {
      topic_code: t.code,
      average_domain_d: activeTopicState.average_domain_d || 0,
      active_stage: activeTopicState.active_stage || 'CONECTA',
      active_scene: activeTopicState.active_scene || 'scene_0_intro',
      current_level: activeTopicState.current_level || 'basico',
      is_mastered: (activeTopicState.average_domain_d || 0) >= 80 || activeTopicState.active_stage === 'COMPLETADO',
      completed: (activeTopicState.average_domain_d || 0) >= 80 || activeTopicState.active_stage === 'COMPLETADO',
    } : progressData[t.code];

    const isMastered = Boolean(p?.is_mastered || p?.completed || (p?.average_domain_d && p.average_domain_d >= 80));

    let status: 'completed' | 'current' | 'locked' = 'locked';

    if (isMastered) {
      status = 'completed';
      prevTopicCompleted = true;
    } else if (prevTopicCompleted || index === 0 || (p?.average_domain_d && p.average_domain_d > 0)) {
      status = 'current';
      prevTopicCompleted = false; // Next topic remains locked until this one is completed
    } else {
      status = 'locked';
      prevTopicCompleted = false;
    }

    enrichedTopics.push({ topic: t, status, progress: p });
  });


  // Calculate global metrics
  const totalTopics = enrichedTopics.length;
  const completedCount = enrichedTopics.filter((t) => t.status === 'completed').length;
  const completionPercentage = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;
  const avgDomainTotal = enrichedTopics.reduce((acc, curr) => acc + (curr.progress?.average_domain_d || 0), 0);
  const avgDomainDisplay = totalTopics > 0 ? Math.round(avgDomainTotal / totalTopics) : 0;

  // Horizontal position sequence for zig-zag mathematical trail (offsets from center)
  const offsetClasses = [
    'translate-x-0',        // Center
    '-translate-x-12 md:-translate-x-20', // Left
    'translate-x-12 md:translate-x-20',   // Right
    '-translate-x-8 md:-translate-x-14',  // Mild Left
    'translate-x-8 md:translate-x-14',   // Mild Right
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:py-8 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100 min-h-full">
      {/* Top Banner: Aula, Progreso Curricular & Métricas Gamificadas */}
      <div className="max-w-3xl mx-auto mb-10">
        <div className="relative overflow-hidden rounded-3xl bg-slate-800/80 border border-slate-700/80 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Compass className="w-3.5 h-3.5" />
                  Ruta Curricular Guiada
                </span>
                {classroom && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <School className="w-3.5 h-3.5" />
                    {classroom.name} · {classroom.grade_name || "9.° EGB"}
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                <span>Camino del Aprendizaje</span>
                <span className="text-amber-400 text-xl font-bold">✨</span>
              </h1>
              <p className="text-sm text-slate-400 max-w-xl">
                Avanza a través de cada desafío socrático paso a paso. Completa un tema para desbloquear la práctica infinita con inteligencia artificial.
              </p>
            </div>

            <div className="flex md:flex-col items-center md:items-end justify-between gap-3 shrink-0">
              <button
                onClick={onOpenClassroomModal}
                className="px-4 py-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 border border-slate-600/80 text-xs font-bold text-slate-200 transition flex items-center gap-2 cursor-pointer shadow-sm hover:border-slate-500"
              >
                <School className="w-4 h-4 text-blue-400" />
                <span>{classroom ? "Cambiar Aula" : "Unirse a un Aula"}</span>
              </button>

              <div className="flex items-center gap-2 bg-slate-900/80 px-3.5 py-1.5 rounded-xl border border-slate-700/60">
                <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="text-xs font-bold text-amber-300">Racha: Activa</span>
              </div>
            </div>
          </div>

          {/* Progress Bar & Indicators */}
          <div className="mt-6 pt-6 border-t border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="sm:col-span-2 space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-300">Avance del Plan Curricular</span>
                <span className="text-emerald-400 font-bold">{completedCount} de {totalTopics} Temas ({completionPercentage}%)</span>
              </div>
              <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-700 shadow-sm"
                  style={{ width: `${Math.max(completionPercentage, 5)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-around sm:justify-end gap-6 sm:border-l sm:border-slate-700/60 sm:pl-4">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Dominio Medio</p>
                <p className="text-lg font-black text-blue-400">{avgDomainDisplay}%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Completados</p>
                <p className="text-lg font-black text-emerald-400">{completedCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sinuous Learning Path - By Units */}
      <div className="max-w-2xl mx-auto space-y-16 pb-20">
        {unitsList.length > 0 ? (
          unitsList.map((unit, unitIdx) => {
            const unitTopics = enrichedTopics.filter((et) => {
              const uKey = et.topic.unitTitle || et.topic.unit_id || "Unidad de Aprendizaje";
              return uKey === unit.title;
            });

            const unitCompletedCount = unitTopics.filter((t) => t.status === 'completed').length;
            const unitTotal = unitTopics.length;
            const unitPercent = unitTotal > 0 ? Math.round((unitCompletedCount / unitTotal) * 100) : 0;

            return (
              <section key={unit.title || unitIdx} className="relative">
                {/* Unit Header Landmark */}
                <div className="sticky top-2 z-20 mb-10">
                  <div className="bg-slate-800/95 border border-slate-700/80 rounded-2xl p-4 shadow-xl backdrop-blur-md flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center font-black text-sm shadow-inner">
                        U{unitIdx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                            {unit.trimester ? `Trimestre ${unit.trimester}` : `Módulo ${unitIdx + 1}`}
                          </span>
                        </div>
                        <h2 className="text-sm md:text-base font-bold text-white leading-tight">
                          {unit.title}
                        </h2>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-emerald-400">
                        {unitCompletedCount}/{unitTotal} Dominados
                      </span>
                      <div className="w-24 h-1.5 bg-slate-900 rounded-full mt-1 overflow-hidden border border-slate-700">
                        <div
                          className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${unitPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sinuous Topic Nodes along the Path */}
                <div className="relative flex flex-col items-center space-y-12 py-4">
                  {unitTopics.map((item, idx) => {
                    const { topic, status, progress } = item;
                    const offsetClass = offsetClasses[idx % offsetClasses.length];
                    const isCompleted = status === 'completed';
                    const isCurrent = status === 'current';
                    const isLocked = status === 'locked';

                    return (
                      <div
                        key={topic.code}
                        className={`relative z-10 flex flex-col items-center transition-transform duration-300 ${offsetClass}`}
                      >
                        {/* Interactive Node Button */}
                        <div className="relative group">
                          {/* Pulsing Beacon Halo for Current Topic */}
                          {isCurrent && (
                            <div className="absolute -inset-3 rounded-full bg-blue-500/30 blur-md animate-pulse pointer-events-none" />
                          )}

                          {/* Golden Halo for Mastered Topic */}
                          {isCompleted && (
                            <div className="absolute -inset-2 rounded-full bg-emerald-500/20 blur-sm pointer-events-none" />
                          )}

                          <button
                            onClick={() => setSelectedTopicModal(topic)}
                            className={`relative w-20 h-20 md:w-24 md:h-24 rounded-3xl flex flex-col items-center justify-center font-bold transition-all duration-300 shadow-xl cursor-pointer border-2 ${
                              isCompleted
                                ? 'bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 border-emerald-400 text-white hover:scale-105 hover:shadow-emerald-500/30'
                                : isCurrent
                                ? 'bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 border-blue-400 text-white hover:scale-105 hover:shadow-blue-500/30 ring-4 ring-blue-500/30'
                                : 'bg-slate-800/80 border-slate-700 text-slate-500 hover:border-slate-600 cursor-not-allowed'
                            }`}
                          >
                            {/* Icon or Status Badge */}
                            {isCompleted ? (
                              <div className="flex flex-col items-center gap-1">
                                <Trophy className="w-7 h-7 text-amber-300 drop-shadow-md" />
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200">
                                  Dominado
                                </span>
                              </div>
                            ) : isCurrent ? (
                              <div className="flex flex-col items-center gap-1">
                                <Play className="w-7 h-7 text-white fill-white drop-shadow-md" />
                                <span className="text-[10px] font-black uppercase tracking-wider text-blue-200">
                                  En Curso
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <Lock className="w-6 h-6 text-slate-500" />
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                  Bloqueado
                                </span>
                              </div>
                            )}

                            {/* Corner Status Badge */}
                            {isCompleted && (
                              <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-md border-2 border-slate-900">
                                ✓
                              </span>
                            )}
                            {isCurrent && (
                              <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-md border-2 border-slate-900 animate-bounce">
                                ★
                              </span>
                            )}
                          </button>
                        </div>

                        {/* Node Label Card */}
                        <div
                          onClick={() => setSelectedTopicModal(topic)}
                          className={`mt-3 max-w-[220px] text-center p-2.5 rounded-2xl border transition-all cursor-pointer ${
                            isCompleted
                              ? 'bg-slate-800/90 border-emerald-500/40 hover:border-emerald-400 text-emerald-300'
                              : isCurrent
                              ? 'bg-slate-800/90 border-blue-500/50 hover:border-blue-400 text-white ring-1 ring-blue-500/20'
                              : 'bg-slate-900/60 border-slate-800 text-slate-500'
                          }`}
                        >
                          <h3 className="text-xs md:text-sm font-bold line-clamp-2 leading-tight">
                            {topic.title}
                          </h3>

                          {/* Micro-indicator */}
                          <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px]">
                            {isCompleted ? (
                              <span className="font-bold text-amber-300 flex items-center gap-1">
                                <span>Maestría: {progress?.average_domain_d || 85}%</span>
                              </span>
                            ) : isCurrent ? (
                              <span className="font-bold text-blue-300">
                                Etapa: {progress?.active_stage || "CONECTA"}
                              </span>
                            ) : (
                              <span className="text-slate-500">Completa el anterior</span>
                            )}
                          </div>
                        </div>

                        {/* Quick Action Button Under Node */}
                        <div className="mt-2">
                          {isCompleted ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onStartPractice(topic.code);
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer hover:scale-105"
                              title="Generar ejercicios dinámicos adaptativos con IA"
                            >
                              <span>♾️ Practicar</span>
                            </button>
                          ) : isCurrent ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectTopic(topic.code);
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer hover:scale-105"
                            >
                              <span>Continuar</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-600 flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Requiere tema previo
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        ) : (
          <div className="text-center py-16 bg-slate-800/40 rounded-3xl border border-slate-700/60 p-8 space-y-4">
            <BookOpen className="w-12 h-12 text-slate-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">No hay temas disponibles en esta aula aún</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Únete a un aula con el código proporcionado por tu profesor para acceder al mapa de contenidos interactivo.
            </p>
            <button
              onClick={onOpenClassroomModal}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Unirse a un Aula
            </button>
          </div>
        )}
      </div>

      {/* Modal: Detalle y Acciones del Tema Seleccionado */}
      {selectedTopicModal && (() => {
        const enriched = enrichedTopics.find((et) => et.topic.code === selectedTopicModal.code);
        const p = enriched?.progress || progressData[selectedTopicModal.code];
        const isMastered = Boolean(p?.is_mastered || p?.completed || (p?.average_domain_d && p.average_domain_d >= 80));
        const status = enriched?.status || (isMastered ? 'completed' : 'current');

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg p-6 md:p-8 shadow-2xl space-y-6 relative overflow-hidden">
              {/* Background Ambient Glow */}
              <div className={`absolute -top-24 -right-24 w-60 h-60 rounded-full blur-3xl pointer-events-none ${
                status === 'completed' ? 'bg-emerald-500/20' : status === 'current' ? 'bg-blue-500/20' : 'bg-slate-700/10'
              }`} />

              <div className="relative z-10 flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400 uppercase">
                      {selectedTopicModal.code}
                    </span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
                      status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : status === 'current'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {status === 'completed' ? '🏆 Tema Completado' : status === 'current' ? '🚀 En Curso' : '🔒 Bloqueado'}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white">
                    {selectedTopicModal.title}
                  </h3>
                  {selectedTopicModal.subtitle && (
                    <p className="text-xs text-slate-400">
                      {selectedTopicModal.subtitle}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => setSelectedTopicModal(null)}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Status Specific Message & Actions */}
              <div className="space-y-4">
                {status === 'completed' && (
                  <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
                      <Trophy className="w-5 h-5 text-amber-300" />
                      <span>¡Tema Validado y Completado!</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      El agente socrático ha validado tu dominio de este tema con un índice <strong className="text-emerald-300">D = {p?.average_domain_d || 85}%</strong>. El tutorial lineal está completado y bloqueado para que sigas avanzando.
                    </p>
                    <p className="text-xs text-amber-200/90 font-medium bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5">
                      💡 Ahora tienes disponible el modo de <strong>Práctica Dinámica</strong>: la IA generará problemas únicos en tiempo real cada vez que practiques.
                    </p>
                  </div>
                )}

                {status === 'current' && (
                  <div className="bg-blue-950/40 border border-blue-500/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2.5 text-blue-400 font-bold text-sm">
                      <Zap className="w-5 h-5 text-blue-400" />
                      <span>Listo para Continuar</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Este es tu tema activo en la progresión. Entra al escenario conversacional con tu tutor socrático para explorar las etapas <strong>CONECTA</strong>, <strong>COMPRENDE</strong> y <strong>RESUELVE</strong>.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Etapa actual guiada:</span>
                      <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                        {p?.active_stage || 'CONECTA'}
                      </span>
                    </div>
                  </div>
                )}

                {status === 'locked' && (
                  <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 space-y-2 text-slate-400">
                    <div className="flex items-center gap-2 font-bold text-slate-300 text-sm">
                      <Lock className="w-4 h-4 text-slate-400" />
                      <span>Hito Curricular Bloqueado</span>
                    </div>
                    <p className="text-xs leading-relaxed">
                      Para asegurar una comprensión sólida y escalonada, debes completar con éxito los temas anteriores antes de ingresar a este contenido.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={() => setSelectedTopicModal(null)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  Cerrar
                </button>

                {onResetTopic && (status === 'completed' || status === 'current') && (
                  <button
                    onClick={() => {
                      setSelectedTopicModal(null);
                      onResetTopic(selectedTopicModal.code);
                    }}
                    className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-amber-300 border border-slate-700/70 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Reiniciar este tema desde el inicio (CONECTA) para recorrer la experiencia desde cero"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reiniciar a CONECTA</span>
                  </button>
                )}

                {status === 'completed' && (
                  <button
                    onClick={() => {
                      setSelectedTopicModal(null);
                      onStartPractice(selectedTopicModal.code);
                    }}
                    className="w-full sm:flex-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>♾️ Practicar Tema con IA en Tiempo Real</span>
                  </button>
                )}

                {status === 'current' && (
                  <button
                    onClick={() => {
                      setSelectedTopicModal(null);
                      onSelectTopic(selectedTopicModal.code);
                    }}
                    className="w-full sm:flex-1 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Entrar al Lienzo ({p?.active_stage || 'CONECTA'})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {status === 'locked' && (
                  <button
                    disabled
                    className="w-full sm:flex-1 px-5 py-2.5 rounded-xl bg-slate-800 text-slate-500 text-xs font-bold opacity-60 cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Bloqueado por Prerrequisito</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
