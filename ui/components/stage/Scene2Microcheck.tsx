"use client";

import React, { useState } from 'react';
import { CheckCircle2, ArrowRight, XCircle, ArrowLeft } from 'lucide-react';
import { MathText } from '../ui/MathText';

interface Scene2MicrocheckProps {
  onSubmit: (answers: Record<string, string>) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const Scene2Microcheck: React.FC<Scene2MicrocheckProps> = ({
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [ans1, setAns1] = useState('');
  const [ans2, setAns2] = useState('');
  const [ans3, setAns3] = useState('');
  const [ans4, setAns4] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      "PIT-01": ans1,
      "PIT-02": ans2,
      "PIT-06": ans3,
      "PIT-07": ans4,
    });
  };

  const isComplete = ans1 && ans2 && ans3.trim() && ans4.trim();

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="px-3 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-full border border-purple-200 uppercase tracking-wider">
          Microcomprobación · Ya conozco esto
        </span>
        <button
          onClick={onCancel}
          className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver</span>
        </button>
      </div>

      <h2 className="text-xl font-bold text-slate-900 mb-2">
        Comprobación de Prerrequisitos de Entrada
      </h2>
      <p className="text-slate-600 text-xs md:text-sm mb-6 leading-relaxed">
        Responde estas 4 preguntas breves para validar tus conocimientos previos. Si obtienes al menos 3 aciertos, podrás pasar directamente a la práctica básica.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Item 1: PIT-01 */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <label className="block text-sm font-semibold text-slate-800 mb-2">
            1. ¿Cuál de las siguientes condiciones define obligatoriamente a un triángulo rectángulo?
          </label>
          <div className="space-y-2 text-sm text-slate-700">
            {[
              "Tiene los tres lados de igual longitud",
              "Tiene exactamente un ángulo interior de 90°",
              "La suma de dos de sus ángulos es menor a 45°",
            ].map((opt) => (
              <label key={opt} className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="pit01"
                  value={opt}
                  checked={ans1 === opt}
                  onChange={(e) => setAns1(e.target.value)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Item 2: PIT-02 */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <label className="block text-sm font-semibold text-slate-800 mb-2">
            2. En un triángulo rectángulo con lados <MathText content="$m$" />, <MathText content="$n$" /> y <MathText content="$p$" />, donde el ángulo recto se encuentra entre <MathText content="$m$" /> y <MathText content="$n$" />, ¿cuál es la hipotenusa?
          </label>
          <div className="flex space-x-4 text-sm text-slate-700">
            {["m", "n", "p"].map((letter) => (
              <label key={letter} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="pit02"
                  value={letter}
                  checked={ans2 === letter}
                  onChange={(e) => setAns2(e.target.value)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="font-semibold italic">{letter}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Item 3: PIT-06 */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <label className="block text-sm font-semibold text-slate-800 mb-2">
            3. Si los catetos de un triángulo rectángulo miden 3 cm y 4 cm, ¿cuánto mide la hipotenusa?
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={ans3}
              onChange={(e) => setAns3(e.target.value)}
              placeholder="Escribe el número"
              className="w-36 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-500">cm</span>
          </div>
        </div>

        {/* Item 4: PIT-07 */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <label className="block text-sm font-semibold text-slate-800 mb-2">
            4. La hipotenusa de un triángulo rectángulo mide 10 m y uno de sus catetos mide 6 m. ¿Cuánto mide el otro cateto?
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={ans4}
              onChange={(e) => setAns4(e.target.value)}
              placeholder="Escribe el número"
              className="w-36 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-500">m</span>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!isComplete || loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-sm flex items-center space-x-2"
          >
            <span>{loading ? "Comprobando..." : "Comprobar Respuestas"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
