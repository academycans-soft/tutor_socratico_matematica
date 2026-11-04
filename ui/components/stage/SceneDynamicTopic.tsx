"use client";

import React, { useState } from 'react';
import { 
  Sparkles, 
  HelpCircle, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Lightbulb, 
  BookOpen, 
  Volume2, 
  Send, 
  BrainCircuit, 
  Check, 
  AlertCircle,
  FlaskConical,
  Maximize2,
  Minimize2,
  RotateCcw,
  Compass,
  Sliders,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { MathText } from '../ui/MathText';

import { NativeGeoGebraCanvas, CanvasMode } from './NativeGeoGebraCanvas';

interface SceneDynamicTopicProps {
  topic: any;
  activeStage: string;
  activeScene: string;
  onGoToStage: (stage: string, scene: string) => void;
  onSubmitHypothesis: (idea: string) => Promise<void>;
  onSubmitMicrocheck?: (answers: Record<string, string>) => Promise<any>;
  highlightedElement?: string | null;
  agentAction?: any;
}

// Fallback GeoGebra simulators catalog for frontend instant lookup
const FRONTEND_SIMULATORS: Record<string, any> = {
  algebra: {
    type: "geogebra",
    mode: "algebra" as CanvasMode,
    url: "https://www.geogebra.org/material/iframe/id/kewx4c4c/width/700/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false",
    title: "Simulador GeoGebra: Modelo de Áreas y Factorización de Polinomios",
    instructions: "Usa el modelo geométrico de áreas para descomponer binomios y trinomios en rectángulos parciales. Observa cómo (x+a)(x+b) o las diferencias de cuadrados se representan visualmente como sumas de áreas.",
    controls: [
      { param: "base_x", label: "Base (x + a)", default: 2 },
      { param: "altura_x", label: "Altura (x + b)", default: 3 },
    ]
  },
  geometria: {
    type: "geogebra",
    mode: "geometria" as CanvasMode,
    url: "https://www.geogebra.org/material/iframe/id/v895s35a/width/700/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false",
    title: "Simulador GeoGebra: Triángulos Rectángulos y Teoremas Métricos",
    instructions: "Manipula los catetos o arrastra los vértices en tiempo real para observar cómo varía la hipotenusa y la relación a² + b² = c².",
    controls: [
      { param: "cateto_a", label: "Cateto A", default: 6 },
      { param: "cateto_b", label: "Cateto B", default: 8 },
    ]
  },
  ecuaciones: {
    type: "geogebra",
    mode: "ecuaciones" as CanvasMode,
    url: "https://www.geogebra.org/material/iframe/id/j28rfe5f/width/700/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false",
    title: "Simulador GeoGebra: Balanza de Igualdad y Despeje de Ecuaciones",
    instructions: "Equilibra la balanza colocando términos en cada platillo y aplica operaciones idénticas en ambos lados para despejar la incógnita.",
    controls: [
      { param: "coef_x", label: "Término en x", default: 2 },
      { param: "constante", label: "Constante", default: 6 },
    ]
  },
  funciones: {
    type: "geogebra",
    mode: "funciones" as CanvasMode,
    url: "https://www.geogebra.org/material/iframe/id/m5c9m467/width/700/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false",
    title: "Simulador GeoGebra: Graficador de Rectas, Pendiente y Ordenada",
    instructions: "Modifica la pendiente m y la ordenada b en y = mx + b para observar al instante la inclinación y desplazamiento en el plano cartesiano.",
    controls: [
      { param: "m", label: "Pendiente (m)", default: 2 },
      { param: "b", label: "Ordenada al origen (b)", default: 1 },
    ]
  },
  fracciones: {
    type: "geogebra",
    mode: "algebra" as CanvasMode,
    url: "https://www.geogebra.org/material/iframe/id/dsmfqe2z/width/700/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false",
    title: "Simulador GeoGebra: Modelos Visuales de Fracciones y Razones",
    instructions: "Empareja representaciones geométricas de áreas con sus valores numéricos fraccionarios y proporcionales.",
    controls: [
      { param: "num", label: "Numerador", default: 3 },
      { param: "den", label: "Denominador", default: 4 },
    ]
  },
  probabilidad: {
    type: "geogebra",
    mode: "funciones" as CanvasMode,
    url: "https://www.geogebra.org/material/iframe/id/a74z6e5u/width/700/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false",
    title: "Simulador GeoGebra: Distribución de Frecuencias y Probabilidad",
    instructions: "Explora distribuciones de datos y descubre cómo se representan visualmente las frecuencias en GeoGebra.",
    controls: [
      { param: "filas", label: "Ensayos", default: 10 },
    ]
  },
  trigonometria: {
    type: "geogebra",
    mode: "trigonometria" as CanvasMode,
    url: "https://www.geogebra.org/material/iframe/id/c9r8kcvu/width/700/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false",
    title: "Simulador GeoGebra: Círculo Trigonométrico Interactivo",
    instructions: "Gira el radio vector sobre la circunferencia unitaria y observa las proyecciones seno, coseno y tangente en tiempo real.",
    controls: [
      { param: "angulo", label: "Ángulo θ", default: 45 },
    ]
  },
  proporciones: {
    type: "geogebra",
    mode: "geometria" as CanvasMode,
    url: "https://www.geogebra.org/material/iframe/id/dsmfqe2z/width/700/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false",
    title: "Simulador GeoGebra: Proporciones, Razones y Teorema de Tales",
    instructions: "Ajusta las razones numéricas y comprueba visualmente la equivalencia de razones geométricas.",
    controls: [
      { param: "razon_a", label: "Razón A", default: 2 },
      { param: "razon_b", label: "Razón B", default: 5 },
    ]
  }
};

function resolveFrontendSimulator(title: string = "", description: string = ""): any {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes("trigonometr") || text.includes("seno") || text.includes("coseno") || text.includes("tangente")) {
    return FRONTEND_SIMULATORS.trigonometria;
  }
  if (text.includes("proporcion") || text.includes("escala") || text.includes("razon")) {
    return FRONTEND_SIMULATORS.proporciones;
  }
  if (text.includes("factor") || text.includes("binomio") || text.includes("polinomio") || text.includes("algebra") || text.includes("cuadrado") || text.includes("trinomio")) {
    return FRONTEND_SIMULATORS.algebra;
  }
  if (text.includes("pitagora") || text.includes("triang") || text.includes("geometr") || text.includes("angulo") || text.includes("distancia") || text.includes("vector") || text.includes("hipotenusa")) {
    return FRONTEND_SIMULATORS.geometria;
  }
  if (text.includes("ecuacion") || text.includes("sistema") || text.includes("despeje") || text.includes("igualdad")) {
    return FRONTEND_SIMULATORS.ecuaciones;
  }
  if (text.includes("funcion") || text.includes("lineal") || text.includes("recta") || text.includes("pendiente") || text.includes("grafic")) {
    return FRONTEND_SIMULATORS.funciones;
  }
  if (text.includes("fraccion")) {
    return FRONTEND_SIMULATORS.fracciones;
  }
  if (text.includes("probab") || text.includes("estadist") || text.includes("azar")) {
    return FRONTEND_SIMULATORS.probabilidad;
  }
  return FRONTEND_SIMULATORS.geometria;
}

export const SceneDynamicTopic: React.FC<SceneDynamicTopicProps> = ({
  topic,
  activeStage,
  activeScene,
  onGoToStage,
  onSubmitHypothesis,
  onSubmitMicrocheck,
  highlightedElement,
  agentAction,
}) => {
  const staged = topic?.staged_content || {};
  const conecta = staged.conecta || {};
  const comprende = staged.comprende || {};
  const resuelve = staged.resuelve || {};

  // Simulator resolution: from backend staged_content or smart catalog fallback
  const simulator = staged.simulator || conecta.simulator || comprende.simulator || resolveFrontendSimulator(topic?.title, topic?.description);
  const [simulatorKey, setSimulatorKey] = useState(0);
  const [isSimulatorFullscreen, setIsSimulatorFullscreen] = useState(false);
  const [canvasEngine, setCanvasEngine] = useState<'native' | 'geogebra'>('native');
  const [iframeError, setIframeError] = useState(false);

  const resolvedCanvasMode: CanvasMode = (simulator?.mode as CanvasMode) || resolveFrontendSimulator(topic?.title, topic?.description).mode || 'geometria';
  const canvasInitialParams = simulator?.initial_params || (simulator?.controls ? Object.fromEntries(simulator.controls.map((c: any) => [c.param, c.default])) : {});

  // CONECTA state
  const story = conecta.hook_story || conecta.context_story || topic?.description || "Explora el contexto práctico de este contenido matemático.";
  const drivingQuestion = conecta.driving_question || topic?.subtitle || "¿Qué relación observas en este problema?";
  const simulatorMission = conecta.simulator_mission || simulator?.instructions || "Interactúa con los controles del simulador para poner a prueba tu intuición.";
  const revealInsight = conecta.reveal_insight || conecta.insight || conecta.resolution || "";
  const [hypothesisText, setHypothesisText] = useState('');
  const [submittingHypothesis, setSubmittingHypothesis] = useState(false);
  const [hypothesisSubmitted, setHypothesisSubmitted] = useState(false);

  // COMPRENDE state
  const conceptualCore = comprende.conceptual_bridge || comprende.conceptual_core || topic?.description || "";
  const proofSteps = comprende.proof_steps || [];
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const microchecks = comprende.microcheck_questions || comprende.microchecks || [];
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [microcheckSubmitted, setMicrocheckSubmitted] = useState(false);

  // Text to speech
  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = String(text || '').replace(/\$/g, '');
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'es-ES';
    u.rate = 1.0;
    window.speechSynthesis.speak(u);
  };

  const handleSendHypothesis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hypothesisText.trim() || submittingHypothesis) return;
    setSubmittingHypothesis(true);
    try {
      await onSubmitHypothesis(hypothesisText.trim());
      setHypothesisSubmitted(true);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } finally {
      setSubmittingHypothesis(false);
    }
  };

  const handleAnswerSelect = (qIdx: number, optIdx: number) => {
    if (microcheckSubmitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleVerifyMicrochecks = async () => {
    setMicrocheckSubmitted(true);
    let correctCount = 0;
    microchecks.forEach((mc: any, idx: number) => {
      const correctIdx = mc.correct_index ?? 0;
      if (selectedAnswers[idx] === correctIdx) {
        correctCount++;
      }
    });

    if (correctCount === microchecks.length) {
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
    }

    if (onSubmitMicrocheck) {
      const formattedAnswers: Record<string, string> = {};
      microchecks.forEach((mc: any, idx: number) => {
        formattedAnswers[`q_${idx}`] = String(selectedAnswers[idx] ?? "");
      });
      await onSubmitMicrocheck(formattedAnswers);
    }
  };

  const isSimulatorHighlighted = highlightedElement === 'simulador' || highlightedElement === 'mision_simulador';

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. CONECTA STAGE: Overview, Real Story, Interactive Simulator, Hypothesis Studio
  // ─────────────────────────────────────────────────────────────────────────────
  if (activeStage === 'CONECTA') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in duration-300">
        {/* Banner Topic Overview */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">
                1. Conecta
              </span>
              <span className="text-xs text-slate-400 font-mono">{topic?.code}</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 leading-tight">
              {conecta.problem_title || topic?.title || "Situación de Aprendizaje"}
            </h2>
            <p className="text-xs text-slate-500">
              {topic?.subtitle || "Observa la situación real, manipula el simulador y formula tu intuición matemática."}
            </p>
          </div>

          <button
            onClick={() => onGoToStage('COMPRENDE', 'scene_2_entry')}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span>Saltar a Comprende</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Narrative Context Card */}
        <div className="bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/70 rounded-2xl p-6 border border-indigo-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>Contexto y Narrativa del Problema Real</span>
            </div>
            <button
              onClick={() => speakText(story)}
              className="text-xs text-indigo-600 hover:text-indigo-800 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition flex items-center gap-1 cursor-pointer font-medium"
              title="Escuchar narrativa"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Escuchar Historia</span>
            </button>
          </div>

          <div className="text-sm md:text-base text-slate-700 leading-relaxed font-normal">
            <MathText text={story} />
          </div>

          {/* Driving Question Box */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex items-start gap-3 shadow-2xs">
            <div className="p-2 rounded-lg bg-amber-200 text-amber-900 shrink-0">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-0.5">
                Pregunta Esencial Detonante
              </h4>
              <p className="text-sm md:text-base font-bold text-amber-950 leading-snug">
                <MathText text={drivingQuestion} />
              </p>
            </div>
          </div>
        </div>

        {/* Interactive GeoGebra & Native System Canvas Sandbox */}
        {simulator && (
          <div 
            id="interactive-simulator-container"
            className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm ${
              isSimulatorHighlighted 
                ? 'ring-4 ring-amber-400 border-amber-400 shadow-xl' 
                : 'border-slate-200'
            }`}
          >
            {/* Simulator Header */}
            <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold tracking-tight">
                      {simulator.title || "Laboratorio Digital Interactivo"}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold uppercase">
                      {canvasEngine === 'native' ? 'Lienzo Nativo' : 'GeoGebra'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {canvasEngine === 'native'
                      ? 'Lienzo interactivo del sistema gobernado por el agente socrático'
                      : 'Experimentación visual dinámica para contrastar tu hipótesis'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Engine Selector: Native Canvas vs GeoGebra Embed */}
                <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setCanvasEngine('native')}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      canvasEngine === 'native'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Lienzo nativo interactivo con control agéntico en tiempo real"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span className="hidden sm:inline">Lienzo Nativo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIframeError(false);
                      setCanvasEngine('geogebra');
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      canvasEngine === 'geogebra'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Simulador oficial de GeoGebra incrustado"
                  >
                    <Compass className="w-3.5 h-3.5 text-indigo-300" />
                    <span className="hidden sm:inline">GeoGebra Oficial</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSimulatorKey((k) => k + 1)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                  title="Reiniciar simulación"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reiniciar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSimulatorFullscreen(!isSimulatorFullscreen)}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isSimulatorFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Reducir</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Maximizar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Embedded Simulator Viewport: Native Canvas OR Official GeoGebra */}
            {canvasEngine === 'native' ? (
              <div className="relative bg-slate-900 w-full overflow-hidden">
                <NativeGeoGebraCanvas
                  key={`native-${simulatorKey}`}
                  mode={resolvedCanvasMode}
                  initialParams={canvasInitialParams}
                  highlightedElement={highlightedElement}
                  agentAction={agentAction}
                  isFullscreen={isSimulatorFullscreen}
                />
              </div>
            ) : (
              <div className={`relative bg-slate-950 w-full transition-all duration-300 ${
                isSimulatorFullscreen ? 'h-[80vh]' : 'h-[460px] md:h-[500px]'
              }`}>
                {iframeError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-300 bg-slate-950 space-y-3">
                    <AlertCircle className="w-10 h-10 text-amber-400" />
                    <h4 className="text-sm font-bold text-white">No se pudo cargar el applet de GeoGebra</h4>
                    <p className="text-xs text-slate-400 max-w-md">
                      El navegador o las políticas de red bloquean iframes externos. Activa el Lienzo Nativo del sistema para continuar con la experiencia interactiva sin interrupciones.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIframeError(false);
                        setCanvasEngine('native');
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Activar Lienzo Nativo Agéntico</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <iframe
                      key={`embed-${simulatorKey}`}
                      src={simulator.url}
                      title={simulator.title || "Interactive Math Simulator"}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                      onError={() => setIframeError(true)}
                    />
                    <div className="absolute bottom-2 right-2 bg-slate-900/90 backdrop-blur-xs border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 flex items-center gap-2 shadow-sm">
                      <span>¿Problemas cargando GeoGebra?</span>
                      <button
                        type="button"
                        onClick={() => setCanvasEngine('native')}
                        className="text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer"
                      >
                        Usar Lienzo Nativo
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Simulator Mission & Controls Guide */}
            <div className="p-4 md:p-5 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-t border-slate-200 space-y-2.5">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wider">
                <Compass className="w-4 h-4 text-indigo-600" />
                <span>🎯 Misión de Exploración en el Simulador</span>
              </div>

              <p className="text-xs md:text-sm text-slate-700 leading-relaxed font-medium">
                <MathText text={simulatorMission} />
              </p>

              {simulator.controls && simulator.controls.length > 0 && (
                <div className="pt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-slate-500 font-semibold flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Controles sugeridos:</span>
                  </span>
                  {simulator.controls.map((ctrl: any, idx: number) => (
                    <span 
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-900 font-mono font-medium shadow-2xs"
                    >
                      {ctrl.label || ctrl.param}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hypothesis Studio */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Tu Hipótesis o Intuición Inicial
              </h3>
            </div>
            <span className="text-xs text-slate-400">Sin miedo al error · Tu intuición importa</span>
          </div>

          <p className="text-xs text-slate-500">
            {conecta.hypothesis_prompt || "Escribe con tus propias palabras qué crees que ocurre o cómo resolverías esta duda:"}
          </p>

          <form onSubmit={handleSendHypothesis} className="space-y-3">
            <textarea
              rows={3}
              value={hypothesisText}
              onChange={(e) => setHypothesisText(e.target.value)}
              placeholder="Escribe tu hipótesis aquí tras experimentar con el simulador (ej. 'Al expandir los rectángulos, observo que la superficie total se divide en cuatro piezas...')."
              disabled={hypothesisSubmitted}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs md:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
            />

            {!hypothesisSubmitted ? (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!hypothesisText.trim() || submittingHypothesis}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingHypothesis ? "Enviando..." : "Formular y Enviar Hipótesis"}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>¡Hipótesis registrada exitosamente!</span>
                  </div>
                  <p className="text-xs text-emerald-900 italic">
                    "{hypothesisText}"
                  </p>
                </div>

                {/* Reveal Key Insight */}
                {revealInsight && (
                  <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-1.5 animate-in fade-in">
                    <h5 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 uppercase tracking-wider">
                      <span>💡 Revelación y Conexión Matemática</span>
                    </h5>
                    <div className="text-xs md:text-sm text-indigo-950 font-medium leading-relaxed">
                      <MathText text={revealInsight} />
                    </div>
                  </div>
                )}

                {/* Primary CTA to COMPRENDE */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => onGoToStage('COMPRENDE', 'scene_2_entry')}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs md:text-sm transition shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <span>➡️ Ir a la Etapa 2: COMPRENDE</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. COMPRENDE STAGE: Core Concept, Interactive Proof, Embedded Simulator, Microchecks
  // ─────────────────────────────────────────────────────────────────────────────
  if (activeStage === 'COMPRENDE') {
    const currentStep = proofSteps[activeStepIndex] || {};

    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in duration-300">
        {/* Banner Topic Overview */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider">
                2. Comprende
              </span>
              <span className="text-xs text-slate-400 font-mono">{topic?.title}</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 leading-tight">
              Fundamentos Conceptuales y Demostración
            </h2>
            <p className="text-xs text-slate-500">
              Analiza el razonamiento paso a paso, verifica las relaciones en el simulador y comprueba tu aprendizaje.
            </p>
          </div>

          <button
            onClick={() => onGoToStage('RESUELVE', 'scene_5_exercise')}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span>Ir a Resuelve</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Conceptual Core Box */}
        {conceptualCore && (
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Definición y Núcleo Conceptual
              </span>
              <button
                onClick={() => speakText(conceptualCore)}
                className="text-xs text-blue-200 hover:text-white px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition flex items-center gap-1 cursor-pointer"
                title="Escuchar definición"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Escuchar</span>
              </button>
            </div>
            <div className="text-sm md:text-base font-medium text-slate-100 leading-relaxed">
              <MathText text={conceptualCore} />
            </div>
          </div>
        )}

        {/* Interactive Step-by-Step Proof / Breakdown */}
        {proofSteps.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Steps Navigation Tabs */}
            <div className="bg-slate-50 border-b border-slate-200 p-2 flex items-center gap-2 overflow-x-auto">
              {proofSteps.map((step: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveStepIndex(idx)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeStepIndex === idx
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <span>{step.title || `Paso ${idx + 1}`}</span>
                </button>
              ))}
            </div>

            {/* Active Step Content */}
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    Paso {activeStepIndex + 1} de {proofSteps.length}
                  </span>
                  <h3 className="text-base md:text-lg font-bold text-slate-900 mt-1">
                    {currentStep.title || `Paso ${activeStepIndex + 1}`}
                  </h3>
                </div>

                <button
                  onClick={() => speakText(`${currentStep.title || ''}. ${currentStep.explanation || currentStep.description || ''}`)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 text-blue-600" />
                  <span>Escuchar Paso</span>
                </button>
              </div>

              <div className="text-sm md:text-base text-slate-700 leading-relaxed">
                <MathText text={currentStep.explanation || currentStep.description || "Explora este paso de razonamiento."} />
              </div>

              {/* Visual Formula / Representation Card */}
              {(currentStep.visual_representation || currentStep.formula) && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-center font-mono text-sm md:text-base text-indigo-900 font-bold shadow-2xs">
                  <MathText text={currentStep.visual_representation || currentStep.formula} />
                </div>
              )}

              {/* Step Controls */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button
                  onClick={() => setActiveStepIndex((prev) => Math.max(0, prev - 1))}
                  disabled={activeStepIndex === 0}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>

                <div className="text-xs text-slate-400 font-medium">
                  {activeStepIndex + 1} / {proofSteps.length}
                </div>

                <button
                  onClick={() => setActiveStepIndex((prev) => Math.min(proofSteps.length - 1, prev + 1))}
                  disabled={activeStepIndex === proofSteps.length - 1}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Siguiente Paso</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Verification in COMPRENDE */}
        {simulator && (
          <div 
            id="interactive-simulator-container"
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm space-y-0"
          >
            <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <FlaskConical className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs md:text-sm font-bold">
                    Comprueba la Demostración: {simulator.title}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {canvasEngine === 'native' ? 'Lienzo Nativo Agéntico' : 'GeoGebra Oficial'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setCanvasEngine('native')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      canvasEngine === 'native'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Lienzo Nativo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIframeError(false);
                      setCanvasEngine('geogebra');
                    }}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      canvasEngine === 'geogebra'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    GeoGebra Oficial
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSimulatorFullscreen(!isSimulatorFullscreen)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  {isSimulatorFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                  <span className="hidden sm:inline">{isSimulatorFullscreen ? 'Reducir' : 'Maximizar'}</span>
                </button>
              </div>
            </div>

            {canvasEngine === 'native' ? (
              <div className="relative bg-slate-900 w-full overflow-hidden">
                <NativeGeoGebraCanvas
                  key={`comprende-native-${simulatorKey}`}
                  mode={resolvedCanvasMode}
                  initialParams={canvasInitialParams}
                  highlightedElement={highlightedElement}
                  agentAction={agentAction}
                  isFullscreen={isSimulatorFullscreen}
                />
              </div>
            ) : (
              <div className={`relative bg-slate-950 w-full transition-all duration-300 ${
                isSimulatorFullscreen ? 'h-[75vh]' : 'h-[380px] md:h-[440px]'
              }`}>
                {iframeError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-300 bg-slate-950 space-y-2">
                    <AlertCircle className="w-8 h-8 text-amber-400" />
                    <h5 className="text-xs font-bold text-white">No se pudo cargar el iframe de GeoGebra</h5>
                    <button
                      type="button"
                      onClick={() => {
                        setIframeError(false);
                        setCanvasEngine('native');
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Usar Lienzo Nativo
                    </button>
                  </div>
                ) : (
                  <iframe
                    key={`comprende-${simulatorKey}`}
                    src={simulator.url}
                    title={simulator.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                    onError={() => setIframeError(true)}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Microchecks: Quick Conceptual Diagnostics */}
        {microchecks.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Micro-Comprobación Diagnóstica</span>
                </h3>
                <p className="text-xs text-slate-500">Responde estas breves preguntas para validar tu comprensión antes de resolver problemas.</p>
              </div>
            </div>

            <div className="space-y-4">
              {microchecks.map((mc: any, qIdx: number) => {
                const selectedOpt = selectedAnswers[qIdx];
                const correctOpt = mc.correct_index ?? 0;
                const isAnswered = selectedOpt !== undefined;
                const isCorrect = selectedOpt === correctOpt;

                return (
                  <div key={qIdx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {qIdx + 1}
                      </span>
                      <p className="text-xs md:text-sm font-bold text-slate-800">
                        <MathText text={mc.question} />
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-7">
                      {(mc.options || []).map((opt: string, optIdx: number) => {
                        const isThisSelected = selectedOpt === optIdx;
                        let btnStyle = "bg-white border-slate-200 text-slate-700 hover:bg-slate-100";

                        if (microcheckSubmitted) {
                          if (optIdx === correctOpt) {
                            btnStyle = "bg-emerald-50 border-emerald-500 text-emerald-900 font-bold ring-2 ring-emerald-400";
                          } else if (isThisSelected && !isCorrect) {
                            btnStyle = "bg-rose-50 border-rose-400 text-rose-900";
                          } else {
                            btnStyle = "bg-white border-slate-200 opacity-60";
                          }
                        } else if (isThisSelected) {
                          btnStyle = "bg-blue-50 border-blue-500 text-blue-900 font-bold ring-2 ring-blue-300";
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => handleAnswerSelect(qIdx, optIdx)}
                            className={`p-2.5 rounded-xl border text-xs text-left transition flex items-center gap-2 cursor-pointer ${btnStyle}`}
                          >
                            <span className="w-4 h-4 rounded-full border border-slate-300 text-[10px] flex items-center justify-center shrink-0">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span className="flex-1">
                              <MathText text={opt} />
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {microcheckSubmitted && (mc.explanation || mc.rationale) && (
                      <div className="pl-7 pt-1 text-[11px] text-slate-600 italic">
                        💡 {mc.explanation || mc.rationale}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              {!microcheckSubmitted ? (
                <button
                  type="button"
                  onClick={handleVerifyMicrochecks}
                  disabled={Object.keys(selectedAnswers).length < microchecks.length}
                  className="ml-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition shadow-sm cursor-pointer"
                >
                  Verificar Respuestas
                </button>
              ) : (
                <div className="w-full flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>¡Micro-comprobación completada! Ahora pon a prueba tu destreza.</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onGoToStage('RESUELVE', 'scene_5_exercise')}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold text-xs transition shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <span>➡️ Ir a Etapa 3: RESUELVE</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};
