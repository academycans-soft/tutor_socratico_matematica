"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, Sparkles, Bot, User } from 'lucide-react';
import { MathText } from '../ui/MathText';
import { api } from '../../lib/api';

interface Message {
  id: string;
  sender: 'tutor' | 'student';
  text: string;
  timestamp: string;
  isProactive?: boolean;
  badgeText?: string;
}

export interface ProactiveInterventionData {
  id?: string;
  text: string;
  action?: any;
  badgeText?: string;
  suggestedPrompts?: string[];
}

interface SocraticCopilotProps {
  topicCode: string;
  currentStage: string;
  currentScene: string;
  currentLevel: string;
  canvasState?: any;
  onExecuteCanvasAction?: (action: any) => void;
  proactiveIntervention?: ProactiveInterventionData | null;
  isThinkingProactively?: boolean;
}

export const SocraticCopilot: React.FC<SocraticCopilotProps> = ({
  topicCode,
  currentStage,
  currentScene,
  currentLevel,
  canvasState,
  onExecuteCanvasAction,
  proactiveIntervention,
  isThinkingProactively,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'tutor',
      text: "¡Hola! Soy tu tutor socrático. Estoy aquí para acompañarte paso a paso sin resolver los problemas por ti. Si tienes dudas con el escenario, cuéntame qué observas o qué hipótesis tienes.",
      timestamp: 'Ahora',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false); // SILENCIADO POR DEFECTO PER USER INSTRUCTION
  const [quickPrompts, setQuickPrompts] = useState<string[]>([
    "¿Cómo empiezo?",
    "Dame una pista conceptual",
    "¿Cuál es la hipotenusa?",
    "Revisar mi cálculo",
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastProactiveIdRef = useRef<string | null>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Text to Speech
  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    // Strip LaTeX markers for cleaner speech
    const cleanText = text.replace(/\$/g, '').replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 sobre $2');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Handle proactive intervention from the canvas stage
  useEffect(() => {
    if (!proactiveIntervention || !proactiveIntervention.text) return;
    const interventionId = proactiveIntervention.id || `${Date.now()}-${proactiveIntervention.text.slice(0, 15)}`;
    if (lastProactiveIdRef.current === interventionId) return;
    lastProactiveIdRef.current = interventionId;

    const tutorMsg: Message = {
      id: interventionId,
      sender: 'tutor',
      text: proactiveIntervention.text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isProactive: true,
      badgeText: proactiveIntervention.badgeText || '💡 Pista Socrática',
    };

    setMessages((prev) => [...prev, tutorMsg]);

    if (proactiveIntervention.suggestedPrompts && proactiveIntervention.suggestedPrompts.length > 0) {
      setQuickPrompts(proactiveIntervention.suggestedPrompts);
    }

    if (proactiveIntervention.action && onExecuteCanvasAction) {
      onExecuteCanvasAction(proactiveIntervention.action);
    }

    if (voiceEnabled) {
      speakText(proactiveIntervention.text);
    }
  }, [proactiveIntervention, onExecuteCanvasAction, voiceEnabled]);

  // Web Speech API Voice Recognition
  const toggleListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("El reconocimiento de voz no está soportado en este navegador. Usa Chrome o Edge.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch (_) {
      setIsListening(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isSending) return;

    const studentMsg: Message = {
      id: Date.now().toString(),
      sender: 'student',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, studentMsg]);
    setInputText('');
    setIsSending(true);

    const history = messages.slice(-6).map((m) => ({
      role: m.sender === 'student' ? 'user' : 'assistant',
      content: m.text,
    }));

    try {
      const res = await api.sendChatMessage(topicCode, text, {
        active_stage: currentStage,
        active_scene: currentScene,
        current_level: currentLevel,
        history,
        ...canvasState,
      });

      // If tutor decided to manipulate the canvas via tool calling
      if (res.action && onExecuteCanvasAction) {
        onExecuteCanvasAction(res.action);
      }

      const tutorReply = res.reply || "Sigue reflexionando sobre las relaciones de los catetos.";
      const tutorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'tutor',
        text: tutorReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, tutorMsg]);

      // If voice enabled by user, read aloud
      if (voiceEnabled) {
        speakText(tutorReply);
      }
    } catch (err: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'tutor',
        text: "Hubo una pausa en la conexión con el tutor. Analiza los datos del lienzo e inténtalo de nuevo.",
        timestamp: 'Ahora',
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Copilot Header */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Tutor Socrático</h3>
            <p className="text-[11px] text-slate-400">Guía y mediación pedagógica</p>
          </div>
        </div>

        {/* Audio Toggle (Muted by default) */}
        <button
          onClick={() => {
            const next = !voiceEnabled;
            setVoiceEnabled(next);
            if (!next && typeof window !== 'undefined') window.speechSynthesis?.cancel();
          }}
          className={`p-2 rounded-lg transition-colors flex items-center space-x-1.5 text-xs font-semibold ${
            voiceEnabled
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-slate-800 text-slate-400 hover:text-slate-200"
          }`}
          title={voiceEnabled ? "Voz activada (clic para silenciar)" : "Voz silenciada (clic para activar lectura)"}
        >
          {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span className="hidden sm:inline">{voiceEnabled ? "Voz activa" : "Silenciado"}</span>
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'student' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center space-x-1.5 mb-1 px-1">
              <span className="text-[11px] font-semibold text-slate-400">
                {m.sender === 'student' ? 'Tú' : 'Tutor'} · {m.timestamp}
              </span>
              {m.sender === 'tutor' && (
                <button
                  onClick={() => speakText(m.text)}
                  className="text-slate-400 hover:text-blue-600 p-0.5"
                  title="Escuchar este mensaje"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {m.isProactive && (
              <div className="flex items-center space-x-1 mb-1 px-1">
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 rounded-full border border-amber-200 shadow-xs animate-in fade-in">
                  <Sparkles className="w-2.5 h-2.5 text-amber-600 animate-pulse" />
                  <span>{m.badgeText || "Intervención del Tutor"}</span>
                </span>
              </div>
            )}

            <div
              className={`p-3.5 rounded-2xl max-w-[90%] text-sm leading-relaxed shadow-xs transition-all ${
                m.sender === 'student'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : m.isProactive
                  ? 'bg-gradient-to-br from-amber-50/90 via-white to-slate-50 border border-amber-300/80 text-slate-800 rounded-tl-none ring-2 ring-amber-200/50'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
              }`}
            >
              <MathText content={m.text} />
            </div>
          </div>
        ))}
        {(isSending || isThinkingProactively) && (
          <div className="flex items-center space-x-2 text-xs text-slate-500 p-2 bg-blue-50/60 rounded-xl border border-blue-100">
            <Sparkles className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span className="font-medium">
              {isThinkingProactively
                ? "El tutor está analizando tu avance en el lienzo..."
                : "El tutor está formulando una pregunta socrática..."}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="p-2 bg-white border-t border-slate-100 flex items-center space-x-1.5 overflow-x-auto text-[11px]">
        {quickPrompts.map((q) => (
          <button
            key={q}
            onClick={() => handleSend(q)}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-full whitespace-nowrap transition-colors border border-slate-200/70"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-3 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          <button
            type="button"
            onClick={toggleListening}
            className={`p-2.5 rounded-xl transition-all ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
            title="Hablar al tutor por voz"
          >
            {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isListening ? "Escuchando tu voz..." : "Escribe tu duda o reflexión al tutor..."}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-colors shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
