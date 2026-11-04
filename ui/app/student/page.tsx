"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Sparkles, 
  Award, 
  LogOut, 
  CheckCircle2, 
  RotateCcw, 
  BookOpen, 
  Layers, 
  ChevronRight, 
  School,
  Check,
  Compass,
  Play,
  ArrowLeft
} from 'lucide-react';
import { api, getToken, getUser, removeToken } from '../../lib/api';

import { Scene0Intro } from '../../components/stage/Scene0Intro';
import { Scene1ConectaRoom } from '../../components/stage/Scene1ConectaRoom';
import { Scene2ComprendeEntry } from '../../components/stage/Scene2ComprendeEntry';
import { Scene2Microcheck } from '../../components/stage/Scene2Microcheck';
import { Scene3GeometricProof } from '../../components/stage/Scene3GeometricProof';
import { Scene4ReturnToRoom } from '../../components/stage/Scene4ReturnToRoom';
import { Scene5ResuelveExercise } from '../../components/stage/Scene5ResuelveExercise';
import { SceneRealtimePractice } from '../../components/stage/SceneRealtimePractice';
import { SceneDynamicTopic } from '../../components/stage/SceneDynamicTopic';
import { SocraticCopilot } from '../../components/tutor/SocraticCopilot';
import { StudentCurriculumPath } from '../../components/student/StudentCurriculumPath';

export default function StudentConversationalStage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'roadmap' | 'stage'>('roadmap');
  const [topicCode, setTopicCode] = useState('MATH-PITAGORAS');
  const [topicData, setTopicData] = useState<any>(null);
  const [topicState, setTopicState] = useState<any>(null);
  const [studentProgress, setStudentProgress] = useState<Record<string, any>>({});
  const [currentExercise, setCurrentExercise] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [proofStep, setProofStep] = useState<number>(1);
  const [highlightedElement, setHighlightedElement] = useState<string | null>(null);

  // Classroom & Grade Topic Discovery
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [activeClassroom, setActiveClassroom] = useState<any | null>(null);
  const [gradeTopics, setGradeTopics] = useState<any[]>([]);
  const [showTopicSelector, setShowTopicSelector] = useState<boolean>(false);


  // Infinite Practice Mode State
  const [isInfiniteMode, setIsInfiniteMode] = useState<boolean>(false);
  const [realtimeExercise, setRealtimeExercise] = useState<any>(null);
  const [loadingRealtime, setLoadingRealtime] = useState<boolean>(false);

  // Proactive Socratic Agent State
  const [proactiveIntervention, setProactiveIntervention] = useState<any | null>(null);
  const [isThinkingProactively, setIsThinkingProactively] = useState<boolean>(false);
  const [lastAgentAction, setLastAgentAction] = useState<any | null>(null);

  // Classroom Enrollment State
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);
  const [joinCode, setJoinCode] = useState<string>('');
  const [joiningClass, setJoiningClass] = useState<boolean>(false);
  const [joinStatus, setJoinStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Helper: load topic details and student state
  const loadTopicDetailsAndState = async (code: string) => {
    try {
      const [details, state] = await Promise.all([
        api.getTopic(code).catch(() => null),
        api.getTopicState(code).catch(() => null),
      ]);
      setTopicData(details);
      setTopicState(state);

      if (state) {
        setStudentProgress((prev) => ({
          ...prev,
          [code]: {
            topic_code: code,
            average_domain_d: state.average_domain_d ?? prev[code]?.average_domain_d ?? 0,
            active_stage: state.active_stage ?? 'CONECTA',
            active_scene: state.active_scene ?? 'scene_0_intro',
            current_level: state.current_level ?? 'basico',
            is_mastered: (state.average_domain_d ?? 0) >= 80 || state.active_stage === 'COMPLETADO',
            completed: (state.average_domain_d ?? 0) >= 80 || state.active_stage === 'COMPLETADO',
          }
        }));
      }

      if (state?.active_stage === 'RESUELVE') {
        const ex = await api.getCurrentExercise(code).catch(() => null);
        if (ex) {
          setCurrentExercise(ex);
        } else if (details?.staged_content?.resuelve?.exercises?.length > 0) {
          setCurrentExercise(details.staged_content.resuelve.exercises[0]);
        }
      } else {
        setCurrentExercise(null);
      }
    } catch (err) {
      console.error("Error loading topic details or state:", err);
    }
  };

  const handleResetTopic = async (code: string) => {
    try {
      setLoading(true);
      await api.resetTopic(code);
      await loadTopicDetailsAndState(code);
      const prog = await api.getStudentProgress().catch(() => null);
      if (prog?.topics) {
        setStudentProgress(prog.topics);
      }
    } catch (err) {
      console.error("Error resetting topic:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial Data Load: User, Classrooms, Curriculum Roadmap, Grade Topics
  const loadInitialData = async () => {
    try {
      const u = getUser();
      setCurrentUser(u);

      const [userClassrooms, fullRoadmap, progressRes] = await Promise.all([
        api.getClassrooms().catch(() => []),
        api.getRoadmap().catch(() => []),
        api.getStudentProgress().catch(() => null),
      ]);

      setClassrooms(userClassrooms || []);
      if (progressRes?.topics) {
        setStudentProgress(progressRes.topics);
      }

      // 1. Identify active classroom and grade
      let initialClassroom = userClassrooms && userClassrooms.length > 0 ? userClassrooms[0] : null;
      setActiveClassroom(initialClassroom);

      // 2. Discover topics belonging to student's enrolled grade
      let foundTopics: any[] = [];
      if (initialClassroom) {
        const matchingGrade = (fullRoadmap || []).find(
          (g: any) => g.id === initialClassroom.grade_id || g.name === initialClassroom.grade_name
        );
        if (matchingGrade) {
          for (const unit of matchingGrade.units || []) {
            for (const top of unit.topics || []) {
              foundTopics.push({
                ...top,
                unitTitle: unit.title,
                trimester: unit.trimester,
                gradeName: matchingGrade.name,
              });
            }
          }
        }
      }

      // If student is not enrolled in a classroom yet or grade has no topics, collect all available roadmap topics
      if (foundTopics.length === 0) {
        for (const grade of fullRoadmap || []) {
          for (const unit of grade.units || []) {
            for (const top of unit.topics || []) {
              foundTopics.push({
                ...top,
                unitTitle: unit.title,
                trimester: unit.trimester,
                gradeName: grade.name,
              });
            }
          }
        }
      }

      setGradeTopics(foundTopics);

      // 3. Select active topic: prioritize published topic from student's grade or keep selected
      let selectedCode = topicCode;
      const exists = foundTopics.find((t: any) => t.code === selectedCode);
      if (!exists && foundTopics.length > 0) {
        const published = foundTopics.find((t: any) => t.status === 'published');
        selectedCode = (published || foundTopics[0]).code;
        setTopicCode(selectedCode);
      }

      await loadTopicDetailsAndState(selectedCode);
    } catch (err) {
      console.error("Failed to load initial student data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    loadInitialData();
  }, [router]);

  const handleLogout = () => {
    removeToken();
    router.push('/login');
  };

  const handleSelectTopic = async (code: string) => {
    setTopicCode(code);
    setShowTopicSelector(false);
    setIsInfiniteMode(false);
    setViewMode('stage');
    setLoading(true);
    try {
      await loadTopicDetailsAndState(code);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTopicFromRoadmap = async (code: string) => {
    setTopicCode(code);
    setIsInfiniteMode(false);
    setViewMode('stage');
    setLoading(true);
    try {
      await loadTopicDetailsAndState(code);
    } finally {
      setLoading(false);
    }
  };

  const handleStartPracticeFromRoadmap = async (code: string) => {
    setTopicCode(code);
    setViewMode('stage');
    setIsInfiniteMode(true);
    setLoading(true);
    try {
      await loadTopicDetailsAndState(code);
      const ex = await api.getRealtimeExercise(code);
      setRealtimeExercise(ex);
    } catch (err) {
      console.error("Error launching practice from roadmap:", err);
    } finally {
      setLoading(false);
    }
  };


  // Stage navigation transitions
  const goToScene = async (stage: string, scene: string) => {
    try {
      setIsInfiniteMode(false);
      await api.advanceScene(topicCode, stage, scene);
      setTopicState((prev: any) => ({
        ...prev,
        active_stage: stage,
        active_scene: scene,
      }));

      setStudentProgress((prev: any) => ({
        ...prev,
        [topicCode]: {
          ...(prev[topicCode] || {}),
          topic_code: topicCode,
          active_stage: stage,
          active_scene: scene,
        }
      }));

      if (stage === 'RESUELVE') {
        const ex = await api.getCurrentExercise(topicCode).catch(() => null);
        if (ex) {
          setCurrentExercise(ex);
        } else if (topicData?.staged_content?.resuelve?.exercises?.length > 0) {
          setCurrentExercise(topicData.staged_content.resuelve.exercises[0]);
        }
      }
    } catch (err) {
      console.error("Error advancing scene:", err);
    }
  };

  // Proactive Intervention Trigger: calls agent to intervene autonomously based on canvas events
  const triggerProactiveEvent = async (eventType: string, eventPayload: any = {}) => {
    setIsThinkingProactively(true);
    try {
      const activeStg = isInfiniteMode ? 'PRACTICA_INFINITA' : (topicState?.active_stage || 'CONECTA');
      const activeScn = isInfiniteMode ? 'realtime_practice' : (topicState?.active_scene || 'scene_0_intro');

      const res = await api.getProactiveIntervention(
        topicCode,
        eventType,
        eventPayload,
        {
          active_stage: activeStg,
          active_scene: activeScn,
          current_level: topicState?.current_level || 'basico',
          proof_step: proofStep,
          highlighted_element: highlightedElement,
          topic_title: topicData?.title,
          topic_subtitle: topicData?.subtitle,
          conecta_story: topicData?.staged_content?.conecta?.context_story,
          driving_question: topicData?.staged_content?.conecta?.driving_question,
          comprende_core: topicData?.staged_content?.comprende?.conceptual_core,
          exercise: isInfiniteMode && realtimeExercise ? {
            title: realtimeExercise.title,
            statement: realtimeExercise.statement,
            level: realtimeExercise.level || 'intermedio',
            correct_answer: realtimeExercise.correct_answer,
            unit: realtimeExercise.unit,
            hints: realtimeExercise.hints,
          } : currentExercise ? {
            title: currentExercise.title,
            statement: currentExercise.statement,
            level: currentExercise.level,
            correct_answer: currentExercise.correct_answer,
            hints: currentExercise.hints,
          } : null,
        }
      );

      if (res && res.reply) {
        setProactiveIntervention({
          id: `${Date.now()}-${eventType}`,
          text: res.reply,
          action: res.action,
          badgeText: eventType === 'exercise_evaluated'
            ? (eventPayload?.is_correct ? '🎉 ¡Bien Deductivo!' : '💡 Pista Socrática')
            : eventType === 'hypothesis_submitted'
            ? '🔍 Análisis de Hipótesis'
            : eventType === 'microcheck_completed'
            ? '📊 Diagnóstico Socrático'
            : eventType === 'inactivity_nudge'
            ? '💬 Mediación Socrática'
            : '💡 Orientación del Tutor',
          suggestedPrompts: res.suggested_prompts || [],
        });

        if (res.action) {
          handleCanvasAction(res.action);
        }
      }
    } catch (err) {
      console.error("Error triggering proactive intervention:", err);
    } finally {
      setIsThinkingProactively(false);
    }
  };

  const handleConectaHypothesis = async (idea: string) => {
    await api.submitHypothesis(topicCode, idea);
    setTopicState((prev: any) => ({
      ...prev,
      active_scene: 'scene_1_diagonal_reveal',
    }));

    // Socratic Agent analyzes hypothesis and guides student proactivamente
    triggerProactiveEvent('hypothesis_submitted', {
      hypothesis: idea,
      driving_question: topicData?.staged_content?.conecta?.driving_question,
    });
  };

  const handleMicrocheckSubmit = async (answers: Record<string, string>) => {
    const res = await api.submitMicrocheck(topicCode, answers);
    const nextStg = res.next_stage || 'RESUELVE';
    const nextScn = res.next_scene || 'scene_5_exercise';
    setTopicState((prev: any) => ({
      ...prev,
      active_stage: nextStg,
      active_scene: nextScn,
    }));
    setStudentProgress((prev: any) => ({
      ...prev,
      [topicCode]: {
        ...(prev[topicCode] || {}),
        topic_code: topicCode,
        active_stage: nextStg,
        active_scene: nextScn,
      }
    }));
    if (nextStg === 'RESUELVE') {
      const ex = await api.getCurrentExercise(topicCode).catch(() => null);
      if (ex) {
        setCurrentExercise(ex);
      } else if (topicData?.staged_content?.resuelve?.exercises?.length > 0) {
        setCurrentExercise(topicData.staged_content.resuelve.exercises[0]);
      }
    }

    // Socratic Agent comments on diagnostic results and explains routing
    triggerProactiveEvent('microcheck_completed', {
      approved: res.approved,
      correct_count: res.correct_count,
      total: res.total,
      next_stage: res.next_stage,
      message: res.message,
    });
  };

  const handleExerciseSubmit = async (ans: string, hintsUsed: number) => {
    if (!currentExercise) return;
    const res = await api.submitExercise(topicCode, currentExercise.id, ans, hintsUsed);
    // Reload state after submission to update mastery D
    const updatedState = await api.getTopicState(topicCode);
    setTopicState(updatedState);

    // Auto-mark topic completed if mastery threshold reached or challenge solved correctly
    if (res.correct && (updatedState?.average_domain_d >= 80 || currentExercise.level === 'desafio')) {
      try {
        await api.markTopicCompleted(topicCode);
        const prog = await api.getStudentProgress().catch(() => null);
        if (prog?.topics) {
          setStudentProgress(prog.topics);
        }
      } catch (err) {
        console.error("Error auto-completing topic:", err);
      }
    }

    // Proactively intervene on exercise result (scaffolding error coaching or praise)
    triggerProactiveEvent('exercise_evaluated', {
      is_correct: res.correct,
      student_answer: ans,
      correct_answer: res.correct_answer,
      hints_used: hintsUsed,
      level: currentExercise.level,
      level_up: res.level_up,
      error_type: res.error_type,
      solution_steps: res.solution_steps,
    });


    return res;
  };

  const handleNextExercise = async () => {
    const ex = await api.getCurrentExercise(topicCode).catch(() => null);
    if (ex) {
      setCurrentExercise(ex);
    } else if (topicData?.staged_content?.resuelve?.exercises?.length > 0) {
      setCurrentExercise(topicData.staged_content.resuelve.exercises[0]);
    }
  };

  // Real-time Infinite Practice Handlers
  const startInfinitePractice = async () => {
    setLoadingRealtime(true);
    setIsInfiniteMode(true);
    try {
      const ex = await api.getRealtimeExercise(topicCode);
      setRealtimeExercise(ex);
    } catch (err) {
      console.error("Error loading realtime exercise:", err);
    } finally {
      setLoadingRealtime(false);
    }
  };

  const loadNewRealtimeExercise = async () => {
    setLoadingRealtime(true);
    try {
      const ex = await api.getRealtimeExercise(topicCode);
      setRealtimeExercise(ex);
    } catch (err) {
      console.error("Error loading new realtime exercise:", err);
    } finally {
      setLoadingRealtime(false);
    }
  };

  const handleRealtimeSubmit = async (answer: string, hintsUsed: number) => {
    if (!realtimeExercise) return;
    const res = await api.submitRealtimeExercise(topicCode, realtimeExercise, answer, hintsUsed);

    // Proactively intervene on real-time exercise result
    triggerProactiveEvent('exercise_evaluated', {
      is_correct: res.is_correct,
      student_answer: answer,
      correct_answer: res.correct_answer,
      hints_used: hintsUsed,
      level: realtimeExercise.level || 'intermedio',
      solution_steps: res.solution_steps,
    });

    return res;
  };

  // Proactive Inactivity Nudge: prompts student with Socratic guidance if idle for 60s
  useEffect(() => {
    let idleTimer: NodeJS.Timeout;

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!loading && topicState?.active_stage) {
          triggerProactiveEvent('inactivity_nudge', {
            seconds_idle: 60,
          });
        }
      }, 60000);
    };

    resetIdleTimer();

    const handleUserActivity = () => {
      resetIdleTimer();
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);

    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
    };
  }, [topicState?.active_stage, topicState?.active_scene, topicCode, loading]);

  const handleJoinClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoiningClass(true);
    setJoinStatus(null);
    try {
      const res = await api.joinClassroom(joinCode.trim().toUpperCase());
      setJoinStatus({
        text: `¡Te has matriculado exitosamente en el aula "${res.name}"!`,
        type: 'success',
      });
      setJoinCode('');
      // Reload initial data to reflect the new classroom and its topics
      await loadInitialData();
      setTimeout(() => {
        setShowJoinModal(false);
        setJoinStatus(null);
      }, 2000);
    } catch (err: any) {
      setJoinStatus({
        text: err.message || 'Código de aula no encontrado o ya te encuentras matriculado.',
        type: 'error',
      });
    } finally {
      setJoiningClass(false);
    }
  };

  // AI Tutor Tool Calling: Handles real-time canvas modifications requested by the agent
  const handleCanvasAction = (action: any) => {
    if (!action) return;
    setLastAgentAction(action);

    if (action.accion === 'cambiar_escena') {
      const targetScene = action.escena === 'scene_3_proof' ? 'scene_3_geometric_proof'
        : action.escena === 'scene_4_room_resolution' ? 'scene_4_return_room'
        : action.escena;
      if (targetScene) {
        goToScene(action.etapa || topicState?.active_stage || 'CONECTA', targetScene);
      }
    } else if (action.accion === 'mostrar_paso_demostracion') {
      if (topicState?.active_scene !== 'scene_3_geometric_proof' && topicState?.active_scene !== 'scene_3_proof') {
        goToScene('COMPRENDE', 'scene_3_geometric_proof');
      }
      if (action.paso_demostracion) {
        setProofStep(action.paso_demostracion);
      }
    } else if (action.accion === 'resaltar_elemento' && action.elemento_a_resaltar) {
      setHighlightedElement(action.elemento_a_resaltar);
      setTimeout(() => setHighlightedElement(null), 8000);
    } else if (action.accion === 'abrir_simulador') {
      setHighlightedElement('simulador');
      setTimeout(() => setHighlightedElement(null), 8000);
      if (typeof document !== 'undefined') {
        const simEl = document.getElementById('interactive-simulator-container');
        if (simEl) {
          simEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    } else if (action.accion === 'ajustar_parametro_simulador') {
      setHighlightedElement('mision_simulador');
      setTimeout(() => setHighlightedElement(null), 8000);
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-600">
        <div className="flex flex-col items-center space-y-3">
          <Sparkles className="w-8 h-8 animate-spin text-blue-600" />
          <p className="font-semibold text-sm">Cargando el escenario de aprendizaje y aula...</p>
        </div>
      </div>
    );
  }

  const activeStage = topicState?.active_stage || 'CONECTA';
  const activeScene = topicState?.active_scene || 'scene_0_intro';
  const avgD = topicState?.average_domain_d || 0;
  const isMastered = avgD >= 80;

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden font-sans">
      {/* Zero-Clicks Navigation Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 md:px-6 flex items-center justify-between shrink-0 shadow-sm gap-3 z-30">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-base shadow-md shrink-0">
            π
          </div>

          {viewMode === 'roadmap' ? (
            <div className="overflow-hidden">
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-black text-white leading-tight truncate">
                  Ruta de Aprendizaje Curricular
                </h1>
                {activeClassroom && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-indigo-300 bg-indigo-950/60 border border-indigo-500/40 px-2 py-0.5 rounded-full shrink-0">
                    <School className="w-3 h-3" />
                    {activeClassroom.name}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {activeClassroom ? `Matemática · ${activeClassroom.grade_name || "9.° EGB"}` : "Plan Curricular Oficial de Matemática"}
              </p>
            </div>
          ) : (
            <>
              {/* Back to Roadmap Button */}
              <button
                onClick={() => {
                  api.getStudentProgress().then((p) => {
                    if (p?.topics) setStudentProgress(p.topics);
                  });
                  setIsInfiniteMode(false);
                  setViewMode('roadmap');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 hover:border-blue-500 text-xs font-bold transition shadow-sm shrink-0 cursor-pointer"
                title="Volver a la ruta general de aprendizaje"
              >
                <Compass className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">← Mi Ruta</span>
              </button>


              <div className="overflow-hidden">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm md:text-base font-bold text-white leading-tight truncate">
                    {topicData?.title || "Teorema de Pitágoras"}
                  </h1>
                  {activeClassroom && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-300 bg-indigo-950/60 border border-indigo-500/40 px-2 py-0.5 rounded-full shrink-0">
                      <School className="w-3 h-3" />
                      {activeClassroom.name}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {topicData?.subtitle || (activeClassroom ? `Matemática · ${activeClassroom.grade_name || "EGB"}` : "Matemática · Educación General Básica")}
                </p>
              </div>

              {/* Button: Selector de Temas del Aula */}
              <button
                onClick={() => setShowTopicSelector(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition border border-slate-700 shrink-0 cursor-pointer"
                title="Ver todos los temas y unidades de mi aula"
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Temas</span>
                <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px]">
                  {gradeTopics.length}
                </span>
              </button>
            </>
          )}
        </div>

        {/* Central Stage Progress (Agent-driven, non-clickable) */}
        {viewMode === 'stage' ? (
          <div className="hidden lg:flex items-center space-x-1.5 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-2xl shadow-inner">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              Etapa:
            </span>
            {[
              { id: 'CONECTA', label: '1. Conecta', desc: 'Situación contextual' },
              { id: 'COMPRENDE', label: '2. Comprende', desc: 'Significado y deducción' },
              { id: 'RESUELVE', label: '3. Resuelve', desc: 'Práctica adaptativa' },
            ].map((st) => {
              const stageOrder = ['CONECTA', 'COMPRENDE', 'RESUELVE'];
              const currentIdx = stageOrder.indexOf(activeStage);
              const thisIdx = stageOrder.indexOf(st.id);
              const isCurrent = !isInfiniteMode && activeStage === st.id;
              const isPassed = !isInfiniteMode && currentIdx > thisIdx;

              return (
                <div
                  key={st.id}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all select-none ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400/50'
                      : isPassed
                      ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 bg-slate-800/40 border border-slate-700/30 opacity-70'
                  }`}
                  title={`${st.label}: ${st.desc} — Avanza automáticamente según el tutor socrático`}
                >
                  {isPassed ? (
                    <span className="text-emerald-400 text-xs">✓</span>
                  ) : isCurrent ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                  ) : (
                    <span className="text-[10px] text-slate-400">🔒</span>
                  )}
                  <span>{st.label}</span>
                </div>
              );
            })}
            {isMastered && (
              <button
                onClick={startInfinitePractice}
                className={`ml-1 px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  isInfiniteMode
                    ? 'bg-amber-400 text-slate-950 shadow-md ring-1 ring-amber-300'
                    : 'text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30'
                }`}
                title="Modo de práctica infinita generada con IA"
              >
                <span>♾️ Práctica Infinita</span>
              </button>
            )}

            <button
              onClick={() => handleResetTopic(topicCode)}
              className="ml-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-[10px] font-bold border border-slate-700/60 transition cursor-pointer flex items-center gap-1"
              title="Reiniciar este tema a la etapa CONECTA (Escena inicial)"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reiniciar</span>
            </button>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setViewMode('stage')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Continuar en Tema Activo: {topicData?.title || "Teorema de Pitágoras"}</span>
            </button>
          </div>
        )}

        {/* User Badge & Average Domain Index */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <button
            onClick={() => {
              setShowJoinModal(true);
              setJoinStatus(null);
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Ingresar código de clase para matricularte"
          >
            <span>🏫 {activeClassroom ? "Cambiar Aula" : "Unirse a Aula"}</span>
          </button>

          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl">
            <Award className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-blue-300">
              Dominio: {avgD}%
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-slate-200">{currentUser?.name || "Estudiante"}</p>
              <p className="text-[10px] text-slate-500 capitalize">{currentUser?.role || "Estudiante"}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>


      {viewMode === 'roadmap' ? (
        <StudentCurriculumPath
          classroom={activeClassroom}
          topics={gradeTopics}
          progressData={studentProgress}
          activeTopicCode={topicCode}
          activeTopicState={topicState}
          onSelectTopic={handleSelectTopicFromRoadmap}
          onStartPractice={handleStartPracticeFromRoadmap}
          onResetTopic={handleResetTopic}
          onOpenClassroomModal={() => {
            setShowJoinModal(true);
            setJoinStatus(null);
          }}
        />
      ) : (
        <>
          {/* Completion & Infinite Practice Alert Banner */}
          {isMastered && (
            <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 text-white px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="text-base">🏆</span>
                <span>
                  ¡Tema Aprobado con Maestría ($D \ge 80\%$)! Has completado {topicData?.title || "este tema"}.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    api.getStudentProgress().then((p) => {
                      if (p?.topics) setStudentProgress(p.topics);
                    });
                    setIsInfiniteMode(false);
                    setViewMode('roadmap');
                  }}
                  className="px-3.5 py-1.5 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-400/40 text-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Ver mi Ruta de Progreso</span>
                </button>

                {!isInfiniteMode ? (
                  <button
                    onClick={startInfinitePractice}
                    className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>♾️ Practicar con IA en Tiempo Real</span>
                  </button>
                ) : (
                  <span className="text-xs font-semibold bg-emerald-900/80 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                    Modo Práctica Infinita Activo
                  </span>
                )}
              </div>
            </div>
          )}


      {/* Main Dual-Panel Layout: Conversational Stage */}
      <main className="flex-1 flex flex-col lg:flex-row p-4 md:p-6 gap-6 overflow-hidden">
        {/* Left Column: Lienzo Dinámico (Active Stage / Infinite Practice) */}
        <section className="flex-1 overflow-y-auto pr-1">
          {isInfiniteMode && realtimeExercise ? (
            <SceneRealtimePractice
              exercise={realtimeExercise}
              onRefreshExercise={loadNewRealtimeExercise}
              onSubmitAnswer={handleRealtimeSubmit}
              onExitInfinitePractice={() => setIsInfiniteMode(false)}
              loadingNew={loadingRealtime}
            />
          ) : topicCode === 'MATH-PITAGORAS' ? (
            /* Specialized Pythagoras 3D Isometric Room & Bhaskara Proof */
            <>
              {activeScene === 'scene_0_intro' && (
                <Scene0Intro onStart={() => goToScene('CONECTA', 'scene_1_room')} />
              )}

              {(activeScene === 'scene_1_room' || activeScene === 'scene_1_diagonal_reveal') && (
                <Scene1ConectaRoom
                  onHypothesisSubmit={handleConectaHypothesis}
                  onDiscover={() => goToScene('COMPRENDE', 'scene_2_comprende_entry')}
                  highlightedElement={highlightedElement}
                />
              )}

              {activeScene === 'scene_2_comprende_entry' && (
                <Scene2ComprendeEntry
                  onStartProof={() => goToScene('COMPRENDE', 'scene_3_geometric_proof')}
                  onOpenMicrocheck={() => goToScene('COMPRENDE', 'scene_2_microcheck')}
                  onSpeakExplanation={(txt) => {
                    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                      const u = new SpeechSynthesisUtterance(txt);
                      u.lang = 'es-ES';
                      window.speechSynthesis.speak(u);
                    }
                  }}
                />
              )}

              {activeScene === 'scene_2_microcheck' && (
                <Scene2Microcheck
                  onSubmit={handleMicrocheckSubmit}
                  onCancel={() => goToScene('COMPRENDE', 'scene_2_comprende_entry')}
                />
              )}

              {(activeScene === 'scene_3_geometric_proof' || activeScene === 'scene_3_proof') && (
                <Scene3GeometricProof
                  externalStep={proofStep}
                  onStepChange={setProofStep}
                  onComplete={() => goToScene('COMPRENDE', 'scene_4_return_room')}
                  highlightedElement={highlightedElement}
                />
              )}

              {(activeScene === 'scene_4_return_room' || activeScene === 'scene_4_room_resolution') && (
                <Scene4ReturnToRoom
                  onStartPractice={() => goToScene('RESUELVE', 'scene_5_exercise')}
                />
              )}

              {activeScene === 'scene_5_exercise' && currentExercise && (
                <Scene5ResuelveExercise
                  exercise={currentExercise}
                  currentLevel={topicState?.current_level || 'basico'}
                  onSubmit={handleExerciseSubmit}
                  onNextExercise={handleNextExercise}
                  highlightedElement={highlightedElement}
                />
              )}
            </>
          ) : (
            /* Adaptive Dynamic Stage for Any Topic in Curriculum */
            <>
              {(activeStage === 'CONECTA' || activeStage === 'COMPRENDE') && (
                <SceneDynamicTopic
                  topic={topicData}
                  activeStage={activeStage}
                  activeScene={activeScene}
                  onGoToStage={(stage, scene) => goToScene(stage, scene)}
                  onSubmitHypothesis={handleConectaHypothesis}
                  onSubmitMicrocheck={handleMicrocheckSubmit}
                  highlightedElement={highlightedElement}
                  agentAction={lastAgentAction}
                />
              )}

              {activeStage === 'RESUELVE' && currentExercise && (
                <Scene5ResuelveExercise
                  exercise={currentExercise}
                  currentLevel={topicState?.current_level || 'basico'}
                  onSubmit={handleExerciseSubmit}
                  onNextExercise={handleNextExercise}
                  highlightedElement={highlightedElement}
                />
              )}

              {activeStage === 'RESUELVE' && !currentExercise && (
                <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-4 max-w-lg mx-auto mt-12 shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">
                    Ejercicios Prácticos de {topicData?.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Aplica lo aprendido en CONECTA y COMPRENDE resolviendo problemas prácticos adaptativos.
                  </p>
                  <button
                    onClick={handleNextExercise}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    Comenzar Primer Ejercicio
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Right Column: Socratic Tutor Copilot */}
        <aside className="w-full lg:w-[420px] shrink-0 h-[380px] lg:h-full">
          <SocraticCopilot
            topicCode={topicCode}
            currentStage={isInfiniteMode ? 'PRACTICA_INFINITA' : activeStage}
            currentScene={isInfiniteMode ? 'realtime_practice' : activeScene}
            currentLevel={topicState?.current_level || 'basico'}
            canvasState={{
              active_stage: isInfiniteMode ? 'PRACTICA_INFINITA' : activeStage,
              active_scene: isInfiniteMode ? 'realtime_practice' : activeScene,
              current_level: topicState?.current_level || 'basico',
              proof_step: proofStep,
              topic_title: topicData?.title,
              topic_subtitle: topicData?.subtitle,
              conecta_story: topicData?.staged_content?.conecta?.context_story,
              driving_question: topicData?.staged_content?.conecta?.driving_question,
              comprende_core: topicData?.staged_content?.comprende?.conceptual_core,
              exercise: isInfiniteMode && realtimeExercise ? {
                title: realtimeExercise.title,
                statement: realtimeExercise.statement,
                level: realtimeExercise.level || 'intermedio',
                unit: realtimeExercise.unit,
                hints: realtimeExercise.hints,
                figure_type: realtimeExercise.figure_type,
                data_params: realtimeExercise.data_params,
              } : currentExercise ? {
                title: currentExercise.title,
                statement: currentExercise.statement,
                level: currentExercise.level,
                unit: currentExercise.unit,
                hints: currentExercise.hints,
              } : null,
              highlighted_element: highlightedElement,
            }}
            onExecuteCanvasAction={handleCanvasAction}
            proactiveIntervention={proactiveIntervention}
            isThinkingProactively={isThinkingProactively}
          />
        </aside>
      </main>
        </>
      )}


      {/* Modal: Selector de Temas del Aula */}
      {showTopicSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 max-h-[88vh] flex flex-col">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  <span>Temas Curriculares de mi Aula</span>
                </h3>
                <p className="text-xs text-slate-500">
                  {activeClassroom ? `Aula: ${activeClassroom.name} (${activeClassroom.grade_name || "EGB"})` : "Explora los temas disponibles en el plan de estudios"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTopicSelector(false)}
                className="text-slate-400 hover:text-slate-700 text-base p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {gradeTopics.length > 0 ? (
                gradeTopics.map((top: any) => {
                  const isCurrent = top.code === topicCode;
                  const isPublished = top.status === 'published';

                  return (
                    <div
                      key={top.id || top.code}
                      onClick={() => handleSelectTopic(top.code)}
                      className={`p-4 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                        isCurrent
                          ? 'bg-blue-50 border-blue-500 shadow-sm'
                          : 'bg-slate-50 hover:bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 leading-tight">
                            {top.title}
                          </h4>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                              isPublished
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isPublished ? 'Publicado' : 'Revisión'}
                          </span>
                        </div>
                        {top.subtitle && (
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {top.subtitle}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                          <span>{top.unitTitle || "Unidad"}</span>
                          <span>·</span>
                          <span className="font-mono">{top.code}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isCurrent ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-white px-3 py-1.5 rounded-xl border border-blue-200 shadow-2xs">
                            <Check className="w-3.5 h-3.5" />
                            <span>Activo</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-300 text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                          >
                            <span>Abrir</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                  <p>No se encontraron temas asociados a esta aula.</p>
                  <p className="text-[11px] text-slate-500">Únete a un aula con código o solicita a tu profesor publicar temas.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTopicSelector(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Unirse a un Aula con Código */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  🏫 Unirse a un Aula de Clases
                </h3>
                <p className="text-xs text-slate-500">Ingresa el código proporcionado por tu profesor o institución</p>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="text-slate-400 hover:text-slate-700 text-base p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {joinStatus && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  joinStatus.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {joinStatus.text}
              </div>
            )}

            <form onSubmit={handleJoinClassroom} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wider">
                  Código del Aula
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. 9EGB-A-3489"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-mono font-bold uppercase tracking-wider placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  El código no distingue mayúsculas o minúsculas.
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={joiningClass || !joinCode.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  {joiningClass ? 'Verificando...' : 'Unirme al Aula'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
