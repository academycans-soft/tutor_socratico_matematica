"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Plus,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Layers,
  Award,
  Sparkles,
  Send,
  RefreshCw,
  Check,
  Lock,
  Eye,
  Trash2,
} from "lucide-react";
import { api, getToken, getUser } from "../../../lib/api";

export default function CurriculumStudio() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [roadmap, setRoadmap] = useState<any[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<any>(null);
  const [activeTrimester, setActiveTrimester] = useState<number>(1);
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Permissions
  const isTeacherManager =
    currentUser?.role === "teacher_manager" ||
    currentUser?.is_admin ||
    currentUser?.role === "admin";

  // Modals State
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [newUnitTitle, setNewUnitTitle] = useState("");
  const [newUnitDesc, setNewUnitDesc] = useState("");
  const [newUnitTrimester, setNewUnitTrimester] = useState(1);
  const [creatingUnit, setCreatingUnit] = useState(false);

  const [showAIGenerateModal, setShowAIGenerateModal] = useState(false);
  const [aiTopicTitle, setAiTopicTitle] = useState("");
  const [aiUnitId, setAiUnitId] = useState("");
  const [aiContextDesc, setAiContextDesc] = useState("");
  const [aiPrereqs, setAiPrereqs] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);

  // Staging Review State
  const [stagedContent, setStagedContent] = useState<any>(null);
  const [stagingTab, setStagingTab] = useState<"conecta" | "comprende" | "resuelve">("conecta");
  const [copilotInput, setCopilotInput] = useState("");
  const [refiningAI, setRefiningAI] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<{ role: "agent" | "teacher"; text: string }[]>([]);
  const [approving, setApproving] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    const user = getUser();
    setCurrentUser(user);
    loadRoadmap();
  }, [router]);

  const loadRoadmap = async () => {
    try {
      const data = await api.getRoadmap();
      setRoadmap(data);
      if (data && data.length > 0) {
        const defaultGrade = data.find((g: any) => g.name.includes("9.° EGB")) || data[0];
        setSelectedGrade(defaultGrade);
      }
      // Load default pilot topic
      const pyt = await api.getTopic("MATH-PITAGORAS");
      setSelectedTopic(pyt);
      if (pyt?.staged_content) {
        setStagedContent(pyt.staged_content);
      }
    } catch (err) {
      console.error("Failed to load roadmap:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTopic = async (topicCode: string) => {
    try {
      setLoading(true);
      const topic = await api.getTopic(topicCode);
      setSelectedTopic(topic);
      setStagedContent(topic.staged_content || null);
      setCopilotMessages([
        {
          role: "agent",
          text: `Hola ${currentUser?.name || "profesor"}. Estoy listo para ajustar cualquier parte de "${topic.title}". Puedes pedirme modificar problemas, fórmulas, pistas o el contexto de la vida real.`,
        },
      ]);
    } catch (err: any) {
      setNotification({ text: err.message || "Error al cargar tema", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGrade || !newUnitTitle.trim() || creatingUnit) return;
    setCreatingUnit(true);
    try {
      await api.createUnit({
        grade_id: selectedGrade.id,
        title: newUnitTitle.trim(),
        description: newUnitDesc.trim(),
        trimester: newUnitTrimester,
      });
      setShowUnitModal(false);
      setNewUnitTitle("");
      setNewUnitDesc("");
      setNotification({ text: "Unidad creada exitosamente en el trimestre.", type: "success" });
      await loadRoadmap();
    } catch (err: any) {
      setNotification({ text: err.message || "Error al crear unidad", type: "error" });
    } finally {
      setCreatingUnit(false);
    }
  };

  const handleGenerateAITopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopicTitle.trim() || generatingAI) return;
    setGeneratingAI(true);
    try {
      const res = await api.generateTopicAI({
        title: aiTopicTitle.trim(),
        grade_level: selectedGrade?.name || "9.° EGB",
        unit_id: aiUnitId || undefined,
        description: aiContextDesc.trim(),
        prerequisites: aiPrereqs ? aiPrereqs.split(",").map((s) => s.trim()) : [],
      });

      setShowAIGenerateModal(false);
      setSelectedTopic(res.topic);
      setStagedContent(res.staged_content);
      setCopilotMessages([
        {
          role: "agent",
          text: `He generado la propuesta pedagógica completa para "${res.topic.title}". Revisa las pestañas CONECTA, COMPRENDE y RESUELVE. Si deseas modificar algo, escríbeme aquí y lo ajustaré antes de que le des el Visto Bueno.`,
        },
      ]);
      setNotification({
        text: `Propuesta pedagógica generada para '${res.topic.title}'. En modo revisión.`,
        type: "success",
      });
      await loadRoadmap();
    } catch (err: any) {
      setNotification({ text: err.message || "Error al generar contenido con IA", type: "error" });
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleRefineWithCopilot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotInput.trim() || !selectedTopic || refiningAI) return;
    const instruction = copilotInput.trim();
    setCopilotInput("");
    setCopilotMessages((prev) => [...prev, { role: "teacher", text: instruction }]);
    setRefiningAI(true);
    try {
      const res = await api.refineTopicAI(selectedTopic.code, instruction);
      setSelectedTopic(res.topic);
      setStagedContent(res.staged_content);
      setCopilotMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: "He aplicado las modificaciones solicitadas. Puedes ver los cambios actualizados en las pestañas correspondientes.",
        },
      ]);
    } catch (err: any) {
      setCopilotMessages((prev) => [
        ...prev,
        { role: "agent", text: `Ocurrió un error al procesar la modificación: ${err.message}` },
      ]);
    } finally {
      setRefiningAI(false);
    }
  };

  const handleApproveAndPublish = async () => {
    if (!selectedTopic || approving) return;
    setApproving(true);
    try {
      const res = await api.approveTopic(selectedTopic.code);
      setSelectedTopic(res.topic);
      setNotification({
        text: "¡Tema aprobado y publicado exitosamente! Ahora está activo para los estudiantes.",
        type: "success",
      });
      await loadRoadmap();
    } catch (err: any) {
      setNotification({ text: err.message || "Error al aprobar tema", type: "error" });
    } finally {
      setApproving(false);
    }
  };

  const handleDeleteTopic = async () => {
    if (!selectedTopic) return;
    const ok = window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el tema '${selectedTopic.title}'?`);
    if (!ok) return;
    try {
      await api.deleteTopic(selectedTopic.code);
      setNotification({ text: `Tema '${selectedTopic.title}' eliminado exitosamente.`, type: "success" });
      setSelectedTopic(null);
      await loadRoadmap();
    } catch (err: any) {
      setNotification({ text: err.message || "Error al eliminar tema", type: "error" });
    }
  };

  const currentTrimesterUnits =
    selectedGrade?.trimesters?.find((t: any) => t.number === activeTrimester)?.units || [];

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0 shadow-lg sticky top-0 z-40">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.push("/teacher")}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Volver al Panel Docente"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white leading-tight">
                Estudio Curricular y Diseñador con IA
              </h1>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                  isTeacherManager
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                }`}
              >
                {isTeacherManager ? "Profesor Gestor · Edición Activa" : "Modo Consulta / Solo Lectura"}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Malla Curricular EGB y Bachillerato dividida en 3 Trimestres
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {isTeacherManager && (
            <>
              <button
                onClick={() => setShowUnitModal(true)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center space-x-1.5 transition-colors"
              >
                <Plus className="w-4 h-4 text-slate-400" />
                <span>Nueva Unidad</span>
              </button>
              <button
                onClick={() => setShowAIGenerateModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center space-x-1.5 transition-all"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Crear Tema con IA</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Role Restriction Banner if normal teacher */}
      {!isTeacherManager && (
        <div className="bg-blue-950/60 border-b border-blue-900/60 px-6 py-2.5 flex items-center justify-between text-xs text-blue-300">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              <strong>Modo Solo Lectura:</strong> Tu cuenta tiene rol de Profesor Estándar. Para crear unidades,
              generar temas con IA o modificar contenidos curriculares, solicita el rol de{" "}
              <strong>Profesor Gestor</strong> al Administrador.
            </span>
          </div>
          <button
            onClick={() => router.push("/admin")}
            className="text-[11px] underline hover:text-white"
          >
            Ver en Admin
          </button>
        </div>
      )}

      {/* Notifications */}
      {notification && (
        <div className="px-6 pt-3">
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
              notification.type === "success"
                ? "bg-emerald-950/60 border border-emerald-800 text-emerald-300"
                : "bg-rose-950/60 border border-rose-800 text-rose-300"
            }`}
          >
            <span>{notification.text}</span>
            <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Studio Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Grades, Trimesters & Units Tree */}
        <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
          {/* Grade Selector */}
          <div className="p-4 border-b border-slate-800">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Grado / Nivel Curricular
            </label>
            <select
              value={selectedGrade?.id || ""}
              onChange={(e) => {
                const g = roadmap.find((item) => item.id === e.target.value);
                if (g) setSelectedGrade(g);
              }}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 font-semibold"
            >
              {roadmap.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · {g.level_group}
                </option>
              ))}
            </select>
          </div>

          {/* Trimesters Tabs */}
          <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/40 text-xs font-bold text-center">
            {[1, 2, 3].map((tNum) => (
              <button
                key={tNum}
                onClick={() => setActiveTrimester(tNum)}
                className={`py-3 transition border-b-2 ${
                  activeTrimester === tNum
                    ? "border-amber-500 text-amber-400 bg-amber-500/10"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {tNum}.er Trimestre
              </button>
            ))}
          </div>

          {/* Units and Topics List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {currentTrimesterUnits.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No hay unidades registradas en el {activeTrimester}.er Trimestre.
                {isTeacherManager && (
                  <button
                    onClick={() => {
                      setNewUnitTrimester(activeTrimester);
                      setShowUnitModal(true);
                    }}
                    className="mt-3 block mx-auto text-amber-400 font-semibold hover:underline"
                  >
                    + Agregar Unidad
                  </button>
                )}
              </div>
            ) : (
              currentTrimesterUnits.map((unit: any) => (
                <div key={unit.id} className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300 bg-slate-800/60 px-3 py-2 rounded-lg">
                    <span className="truncate">{unit.title}</span>
                    <span className="text-[10px] text-slate-500">{unit.topics?.length ?? 0} temas</span>
                  </div>

                  <div className="pl-2 space-y-1">
                    {unit.topics?.map((topic: any) => {
                      const isSelected = selectedTopic?.code === topic.code;
                      const isPublished = topic.status === "published";
                      return (
                        <button
                          key={topic.id}
                          onClick={() => handleSelectTopic(topic.code)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                            isSelected
                              ? "bg-amber-500/15 border border-amber-500/40 text-amber-300 font-semibold"
                              : "hover:bg-slate-800/60 text-slate-300"
                          }`}
                        >
                          <div className="truncate pr-2">
                            <p className="truncate">{topic.title}</p>
                            <span className="text-[10px] text-slate-500 font-mono">{topic.code}</span>
                          </div>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
                              isPublished
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                : "bg-amber-950 text-amber-400 border border-amber-800"
                            }`}
                          >
                            {isPublished ? "Publicado" : "Revisión"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Center & Right: Staging Review & Pedagogical Copilot Chat */}
        {selectedTopic ? (
          <main className="flex-1 flex overflow-hidden">
            {/* Center Pane: Content Preview (CONECTA -> COMPRENDE -> RESUELVE) */}
            <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden border-r border-slate-800">
              {/* Topic Header Bar */}
              <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-white">{selectedTopic.title}</h2>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        selectedTopic.status === "published"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {selectedTopic.status === "published" ? "✓ Publicado y Activo" : "🟡 En Revisión (Staging)"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">{selectedTopic.code}</p>
                </div>

                <div className="flex items-center gap-3">
                  {selectedTopic.status === "staging_review" && isTeacherManager && (
                    <button
                      onClick={handleApproveAndPublish}
                      disabled={approving}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>{approving ? "Publicando..." : "Dar Visto Bueno y Publicar"}</span>
                    </button>
                  )}
                  {selectedTopic.status === "published" && (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Aprobado
                    </span>
                  )}
                  {isTeacherManager && (
                    <button
                      onClick={handleDeleteTopic}
                      className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      title="Eliminar este tema del currículo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Staging Tabs (CONECTA -> COMPRENDE -> RESUELVE) */}
              <div className="bg-slate-900/60 border-b border-slate-800 px-6 flex gap-4 text-xs font-bold">
                {[
                  { id: "conecta", label: "1. CONECTA (Enganche y Problema)" },
                  { id: "comprende", label: "2. COMPRENDE (Demostración Visual)" },
                  { id: "resuelve", label: "3. RESUELVE (Ejercicios Adaptativos)" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStagingTab(tab.id as any)}
                    className={`py-3 transition border-b-2 ${
                      stagingTab === tab.id
                        ? "border-amber-500 text-amber-400"
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Contents Preview */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. CONECTA */}
                {stagingTab === "conecta" && (
                  <div className="space-y-6 max-w-3xl">
                    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                        Problema de la Vida Real
                      </span>
                      <h3 className="text-base font-bold text-white">
                        {stagedContent?.conecta?.problem_title || "Problema de Aplicación"}
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                        {stagedContent?.conecta?.hook_story || selectedTopic.description}
                      </p>
                    </div>

                    <div className="bg-indigo-950/30 p-5 rounded-2xl border border-indigo-900/40 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                        Pregunta Detonante / Activadora
                      </span>
                      <p className="text-sm font-semibold text-indigo-200">
                        {stagedContent?.conecta?.driving_question ||
                          "¿Cómo podemos determinar la medida exacta sin herramientas complejas?"}
                      </p>
                    </div>

                    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Pregunta para Hipótesis del Estudiante
                      </span>
                      <p className="text-xs text-slate-300">
                        {stagedContent?.conecta?.hypothesis_prompt ||
                          "¿Cuál es tu primera intuición o estimación de la medida?"}
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. COMPRENDE */}
                {stagingTab === "comprende" && (
                  <div className="space-y-6 max-w-3xl">
                    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                        Puente Conceptual
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {stagedContent?.comprende?.conceptual_bridge ||
                          "Construcción formal de la relación matemática."}
                      </p>
                    </div>

                    {/* Microcheck diagnostic */}
                    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
                      <h4 className="text-xs font-bold text-white flex items-center gap-2">
                        <span>🧪 Micro-comprobación Diagnóstica</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          (Preguntas diagnósticas para saltar a RESUELVE)
                        </span>
                      </h4>
                      <div className="space-y-3">
                        {stagedContent?.comprende?.microcheck_questions?.map((q: any, idx: number) => (
                          <div key={idx} className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 text-xs space-y-2">
                            <p className="font-semibold text-slate-200">
                              {idx + 1}. {q.question}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              {q.options?.map((opt: string, oIdx: number) => (
                                <div
                                  key={oIdx}
                                  className={`p-2 rounded-lg border ${
                                    oIdx === q.correct_index
                                      ? "bg-emerald-950/40 border-emerald-700 text-emerald-300 font-semibold"
                                      : "bg-slate-800 border-slate-700 text-slate-400"
                                  }`}
                                >
                                  {opt} {oIdx === q.correct_index && "✓ (Correcta)"}
                                </div>
                              ))}
                            </div>
                            {q.rationale && (
                              <p className="text-[10px] text-slate-400 italic">
                                Justificación: {q.rationale}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Proof steps */}
                    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3">
                      <h4 className="text-xs font-bold text-white">
                        📐 Demostración Geométrica Paso a Paso
                      </h4>
                      <div className="space-y-2">
                        {stagedContent?.comprende?.proof_steps?.map((step: any, idx: number) => (
                          <div key={idx} className="p-3 bg-slate-800/30 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                            <div>
                              <p className="font-bold text-slate-200">{step.title}</p>
                              <p className="text-[11px] text-slate-400">{step.description}</p>
                            </div>
                            {step.formula && (
                              <span className="font-mono text-amber-400 bg-slate-900 px-2 py-1 rounded text-xs">
                                {step.formula}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. RESUELVE */}
                {stagingTab === "resuelve" && (
                  <div className="space-y-4 max-w-3xl">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Banco de Ejercicios Adaptativos Multinivel
                      </h4>
                      <span className="text-xs text-slate-500">
                        {stagedContent?.resuelve?.exercises?.length ?? 0} ejercicios generados
                      </span>
                    </div>

                    <div className="space-y-3">
                      {stagedContent?.resuelve?.exercises?.map((ex: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {ex.level}
                              </span>
                              <h5 className="font-bold text-white mt-1.5">{ex.title}</h5>
                            </div>
                            <span className="font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded text-[11px]">
                              Respuesta: {ex.correct_answer} {ex.unit}
                            </span>
                          </div>

                          <p className="text-slate-300 leading-relaxed">{ex.statement}</p>

                          {/* Hints preview */}
                          <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/60 text-[11px] space-y-1">
                            <span className="text-amber-400 font-semibold block">Pistas Progresivas:</span>
                            <p className="text-slate-400">1. {ex.hints?.level_1}</p>
                            <p className="text-slate-400">2. {ex.hints?.level_2}</p>
                            <p className="text-slate-400">3. {ex.hints?.level_3}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Pane: AI Pedagogical Copilot Chat */}
            <div className="w-96 bg-slate-900 flex flex-col shrink-0">
              <div className="p-4 border-b border-slate-800 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs">
                  ✨
                </div>
                <div>
                  <h3 className="font-bold text-xs text-white">Copiloto Curricular IA</h3>
                  <p className="text-[10px] text-slate-400">Pídele cambios antes de publicar</p>
                </div>
              </div>

              {/* Messages list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
                {copilotMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      msg.role === "teacher" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`p-3 rounded-2xl max-w-[90%] leading-relaxed ${
                        msg.role === "teacher"
                          ? "bg-amber-500 text-slate-950 font-medium rounded-tr-none"
                          : "bg-slate-800 text-slate-200 border border-slate-700/80 rounded-tl-none"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {refiningAI && (
                  <div className="flex items-center gap-2 text-xs text-amber-400 italic py-2 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>El Copiloto IA está aplicando las modificaciones...</span>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleRefineWithCopilot} className="p-3 border-t border-slate-800 bg-slate-950/60">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={
                      isTeacherManager
                        ? "Ej. Cambia el ejercicio 2 para que use una cometa..."
                        : "Solo lectura (requiere Profesor Gestor)"
                    }
                    disabled={!isTeacherManager || refiningAI}
                    value={copilotInput}
                    onChange={(e) => setCopilotInput(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!isTeacherManager || !copilotInput.trim() || refiningAI}
                    className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold transition"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </main>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
            Selecciona un tema o genera uno nuevo con IA para comenzar.
          </div>
        )}
      </div>

      {/* Modal: New Unit */}
      {showUnitModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-white">➕ Crear Nueva Unidad Curricular</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Título de la Unidad</label>
                <input
                  type="text"
                  placeholder="Ej. Geometría y Medida: Triángulos"
                  value={newUnitTitle}
                  onChange={(e) => setNewUnitTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="font-bold text-slate-300 block mb-1">Trimestre Asignado</label>
                <select
                  value={newUnitTrimester}
                  onChange={(e) => setNewUnitTrimester(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value={1}>1.er Trimestre</option>
                  <option value={2}>2.° Trimestre</option>
                  <option value={3}>3.er Trimestre</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-300 block mb-1">Descripción / Objetivos</label>
                <textarea
                  rows={3}
                  placeholder="Breve descripción del alcance temático..."
                  value={newUnitDesc}
                  onChange={(e) => setNewUnitDesc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowUnitModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateUnit}
                disabled={creatingUnit || !newUnitTitle.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold disabled:opacity-50"
              >
                {creatingUnit ? "Creando..." : "Crear Unidad"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Generate Topic with AI */}
      {showAIGenerateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-sm shadow-md">
                ✨
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Generar Tema Curricular con IA</h3>
                <p className="text-xs text-slate-400">
                  El agente diseñará CONECTA, COMPRENDE y RESUELVE según la especificación v2.4
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Título del Tema Matemático</label>
                <input
                  type="text"
                  placeholder="Ej. Teorema de Tales y Proporcionalidad Geométrica"
                  value={aiTopicTitle}
                  onChange={(e) => setAiTopicTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Unidad Curricular Destino</label>
                <select
                  value={aiUnitId}
                  onChange={(e) => setAiUnitId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">Seleccionar unidad...</option>
                  {currentTrimesterUnits.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Contexto Real Deseado (Para CONECTA)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Medición de sombras de pirámides, navegación marítima o cálculo estructural..."
                  value={aiContextDesc}
                  onChange={(e) => setAiContextDesc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Prerrequisitos / Microcompetencias Previas (Separadas por coma)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Razón y proporción, Segmentos proporcionales"
                  value={aiPrereqs}
                  onChange={(e) => setAiPrereqs(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAIGenerateModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerateAITopic}
                disabled={generatingAI || !aiTopicTitle.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold disabled:opacity-50 shadow-lg shadow-amber-500/20"
              >
                {generatingAI ? "Generando Propuesta Pedagógica..." : "Generar con IA"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
