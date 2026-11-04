"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, TrendingUp, AlertCircle, CheckCircle, BookOpen, LogOut, Sparkles } from 'lucide-react';
import { api, getToken, getUser, removeToken } from '../../lib/api';

export default function TeacherDashboard() {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [summary, setSummary] = useState<any>(null);
  const [matrix, setMatrix] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Socratic Tutor Model State
  const [currentModel, setCurrentModel] = useState<string>('gpt-4o-mini');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini');
  const [savingModel, setSavingModel] = useState(false);
  const [modelSuccessMsg, setModelSuccessMsg] = useState<string | null>(null);

  const loadTeacherData = async () => {
    try {
      const u = getUser();
      setCurrentUser(u);

      // Fetch user's classrooms
      const clList: any[] = await (await fetch('/api/v1/classrooms/', {
        headers: { Authorization: `Bearer ${getToken()}` },
      })).json();

      setClassrooms(clList);
      const classId = clList.length > 0 ? clList[0].id : '';
      setSelectedClassId(classId);

      if (classId) {
        const sumData = await api.getTeacherSummary(classId, 'MATH-PITAGORAS');
        setSummary(sumData);
        const matData = await api.getTeacherMatrix(classId, 'MATH-PITAGORAS');
        setMatrix(matData);
      }
    } catch (err) {
      console.error("Error loading teacher analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadModelConfig = async () => {
    try {
      const data = await api.getTutorModel();
      setCurrentModel(data.current_model || 'gpt-4o-mini');
      setSelectedModel(data.current_model || 'gpt-4o-mini');
      setAvailableModels(data.available_models || []);
    } catch (err) {
      console.error("Error loading tutor model config:", err);
    }
  };

  const handleUpdateModel = async (modelToSave: string) => {
    setSavingModel(true);
    setModelSuccessMsg(null);
    try {
      await api.updateTutorModel(modelToSave);
      setCurrentModel(modelToSave);
      setSelectedModel(modelToSave);
      setModelSuccessMsg(`Modelo configurado exitosamente: ${modelToSave}`);
      setTimeout(() => setModelSuccessMsg(null), 5000);
    } catch (err: any) {
      alert("Error al actualizar el modelo: " + (err.message || err));
    } finally {
      setSavingModel(false);
    }
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    loadTeacherData();
    loadModelConfig();
  }, [router]);

  const handleClassChange = async (id: string) => {
    setSelectedClassId(id);
    setLoading(true);
    try {
      const sumData = await api.getTeacherSummary(id, 'MATH-PITAGORAS');
      setSummary(sumData);
      const matData = await api.getTeacherMatrix(id, 'MATH-PITAGORAS');
      setMatrix(matData);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    removeToken();
    router.push('/login');
  };

  // State Color Legend (Spec Section 14.4)
  const stateColors: Record<string, { label: string; bg: string; text: string }> = {
    no_explorado: { label: "No explorado", bg: "bg-slate-100", text: "text-slate-500" },
    en_proceso: { label: "En proceso", bg: "bg-amber-100", text: "text-amber-800" },
    aprendido: { label: "Aprendido", bg: "bg-blue-100", text: "text-blue-800" },
    aprendido_pendiente_verificacion: { label: "Pendiente Verif.", bg: "bg-purple-100", text: "text-purple-800" },
    dominado: { label: "Dominado", bg: "bg-emerald-100", text: "text-emerald-800" },
    requiere_revision: { label: "Requiere Revisión", bg: "bg-rose-100", text: "text-rose-800" },
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              🎓
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 leading-tight">Panel Docente · Analíticas de Aula</h1>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    currentUser?.is_admin || currentUser?.role === "admin"
                      ? "bg-rose-100 text-rose-700 border-rose-200"
                      : currentUser?.role === "teacher_manager"
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-blue-100 text-blue-800 border-blue-200"
                  }`}
                >
                  {currentUser?.is_admin || currentUser?.role === "admin"
                    ? "Administrador"
                    : currentUser?.role === "teacher_manager"
                    ? "Profesor Gestor"
                    : "Profesor"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {currentUser?.name || "Docente"} · Monitoreo y Progreso en Tiempo Real
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {(currentUser?.is_admin || currentUser?.role === "admin") && (
              <button
                onClick={() => router.push("/admin")}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center space-x-1.5 transition-colors shadow-xs"
              >
                <span>⚙️ Admin</span>
              </button>
            )}

            <button
              onClick={() => router.push("/teacher/curriculum")}
              className={`px-3 py-2 font-semibold text-xs rounded-xl border flex items-center space-x-1.5 transition-colors ${
                currentUser?.role === "teacher_manager" || currentUser?.is_admin || currentUser?.role === "admin"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700 shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>
                {currentUser?.role === "teacher_manager" || currentUser?.is_admin || currentUser?.role === "admin"
                  ? "Estudio Curricular (IA)"
                  : "Currículo (Solo Lectura)"}
              </span>
            </button>

            <button
              onClick={() => router.push("/student")}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
            >
              Vista Estudiante
            </button>

            <button
              onClick={handleLogout}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-red-600"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Class Selector Bar */}
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aula activa:</span>
            <select
              value={selectedClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-slate-400">Actualizado en tiempo real</span>
        </div>

        {/* Tutor Model Configuration Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-200 font-bold text-lg">
              🤖
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">Motor de Inteligencia Artificial del Tutor Socrático</h3>
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold">
                  Activo: {currentModel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Controla el modelo LLM que guía el razonamiento pedagógico y las intervenciones sobre el lienzo de los estudiantes.
              </p>
              {modelSuccessMsg && (
                <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center space-x-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{modelSuccessMsg}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick preset buttons */}
            <div className="flex items-center space-x-1.5 mr-2">
              {['gpt-4o-mini', 'gpt-4o', 'gpt-4.1'].map((m) => (
                <button
                  key={m}
                  onClick={() => handleUpdateModel(m)}
                  disabled={savingModel}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    currentModel === m
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {m === 'gpt-4o-mini' ? '⚡ 4o-mini' : m === 'gpt-4o' ? '🧠 4o' : '🚀 4.1'}
                </button>
              ))}
            </div>

            {/* Dropdown of all available models */}
            <div className="flex items-center space-x-2">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={savingModel}
                className="max-w-[200px] px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                  </option>
                ))}
              </select>

              {selectedModel !== currentModel && (
                <button
                  onClick={() => handleUpdateModel(selectedModel)}
                  disabled={savingModel}
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  {savingModel ? 'Guardando...' : 'Aplicar'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 1. Summary Cards (Spec Section 14.2) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Estudiantes</p>
              <h3 className="text-2xl font-extrabold text-slate-900">{summary?.total_students || 0}</h3>
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center space-x-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Dominio Medio</p>
              <h3 className="text-2xl font-extrabold text-slate-900">{summary?.average_mastery || 0}%</h3>
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center space-x-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Listos para Avanzar</p>
              <h3 className="text-2xl font-extrabold text-emerald-600">{summary?.ready_to_advance || 0}</h3>
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center space-x-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Requieren Apoyo</p>
              <h3 className="text-2xl font-extrabold text-rose-600">{summary?.need_support || 0}</h3>
            </div>
          </div>
        </div>

        {/* 2. Microcompetency Bar Chart (Spec Section 14.3) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          <h2 className="text-base font-bold text-slate-900 mb-1">
            Dominio de Clase por Microcompetencia (PIT-01 a PIT-10)
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            Porcentaje de alumnos que han alcanzado estado Aprendido o Dominado en cada habilidad atómica.
          </p>

          <div className="space-y-3">
            {summary?.skills_chart?.map((sk: any) => {
              const pct = sk.mastery_percentage || 0;
              const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-slate-300";
              return (
                <div key={sk.code} className="flex flex-col sm:flex-row sm:items-center text-xs gap-2">
                  <div className="w-64 font-medium text-slate-700 truncate" title={`${sk.code}: ${sk.name}`}>
                    <strong className="text-slate-900">{sk.code}</strong> · {sk.name}
                  </div>
                  <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.max(5, pct)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-bold text-slate-800">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Mastery Matrix (Spec Section 14.4) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Matriz de Dominio del Aula
              </h2>
              <p className="text-xs text-slate-500">
                Detalle del progreso individual de cada alumno en cada microcompetencia.
              </p>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              {Object.entries(stateColors).map(([k, v]) => (
                <span key={k} className={`px-2 py-0.5 rounded-full font-bold ${v.bg} ${v.text}`}>
                  {v.label}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="p-3 sticky left-0 bg-slate-50">Estudiante</th>
                  {matrix?.microcompetencies?.map((m: any) => (
                    <th key={m.code} className="p-3 text-center whitespace-nowrap" title={m.name}>
                      {m.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrix?.matrix?.map((st: any) => (
                  <tr key={st.student_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-semibold text-slate-900 sticky left-0 bg-white shadow-2xs whitespace-nowrap">
                      {st.student_name}
                      <span className="block text-[10px] text-slate-400 font-normal">{st.student_email}</span>
                    </td>
                    {matrix?.microcompetencies?.map((m: any) => {
                      const skillData = st.skills[m.code] || { state: "no_explorado", domain_d: 0 };
                      const style = stateColors[skillData.state] || stateColors.no_explorado;
                      return (
                        <td key={m.code} className="p-2 text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded-md text-[10px] font-bold ${style.bg} ${style.text}`}
                            title={`D: ${skillData.domain_d}% · ${skillData.attempts} intentos`}
                          >
                            {skillData.domain_d > 0 ? `${skillData.domain_d}%` : "—"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
