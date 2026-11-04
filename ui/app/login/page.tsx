"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';
import { api, setToken, setUser, getUser } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiredNotice, setExpiredNotice] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('expired=true')) {
      setExpiredNotice(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.login(email.trim(), password);
      if (res.token) {
        const role = (res as any).role || getUser()?.role;
        if (role === 'teacher' || role === 'admin') {
          router.push('/teacher');
        } else {
          router.push('/student');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error de credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoUser = async (demoEmail: string, demoRole: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(demoEmail, 'Password123!');
      if (res.token) {
        const role = (res as any).role || getUser()?.role;
        if (role === 'teacher' || role === 'admin') {
          router.push('/teacher');
        } else {
          router.push('/student');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error de credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
      <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-100">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-2xl shadow-md mb-3">
            π
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Open TutorAI LMS</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Plataforma Agéntica de Matemática · Cero Clics</p>
        </div>

        {expiredNotice && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs mb-4 flex items-start space-x-2 font-medium animate-in fade-in">
            <span className="text-base shrink-0">⚠️</span>
            <span>Tu sesión ha expirado por inactividad o seguridad. Por favor, ingresa tus credenciales nuevamente.</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs mb-6 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ej. estudiante1@gmail.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center space-x-2 mt-2"
          >
            <span>{loading ? "Iniciando..." : "Entrar a la Plataforma"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo Users Switcher */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Acceso Rápido de Prueba
          </p>
          <div className="flex justify-center space-x-2">
            <button
              onClick={() => handleDemoUser('estudiante1@gmail.com', 'student')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              👦 Estudiante (Mateo)
            </button>
            <button
              onClick={() => handleDemoUser('vacamacho@gmail.com', 'teacher')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              👨‍🏫 Profesor (Diego)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
