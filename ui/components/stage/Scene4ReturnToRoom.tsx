"use client";

import React from 'react';
import { ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { MathText } from '../ui/MathText';

interface Scene4ReturnToRoomProps {
  onStartPractice: () => void;
}

export const Scene4ReturnToRoom: React.FC<Scene4ReturnToRoomProps> = ({ onStartPractice }) => {
  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200 uppercase tracking-wider">
          Resolución del Caso Inicial
        </span>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        Comprobación de la Habitación con Pitágoras
      </h2>
      <p className="text-slate-600 text-sm md:text-base leading-relaxed mb-6">
        Aplicamos la fórmula deducida a las paredes de <strong>6 m</strong> y <strong>8 m</strong> para calcular cuánto debería medir exactamente la diagonal si la esquina fuera de 90°:
      </p>

      {/* Math Resolution Box */}
      <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl mb-6 text-center space-y-2">
        <div className="text-lg font-bold text-slate-800">
          <MathText content="$$6^2 + 8^2 = c^2 \implies 36 + 64 = c^2 \implies 100 = c^2$$" />
        </div>
        <div className="text-xl font-extrabold text-blue-600">
          <MathText content="$$c = \sqrt{100} = 10\text{ m}$$" />
        </div>
      </div>

      {/* Comparison Table (Spec Section 8) */}
      <div className="overflow-hidden border border-slate-200 rounded-xl mb-6">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
            <tr>
              <th className="p-3.5">Medición</th>
              <th className="p-3.5">Valor</th>
              <th className="p-3.5">Interpretación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="bg-white">
              <td className="p-3.5 font-medium text-slate-800">Diagonal Esperada</td>
              <td className="p-3.5 font-bold text-emerald-600">10,00 m</td>
              <td className="p-3.5 text-slate-600">Si las paredes formaran exactamente 90°.</td>
            </tr>
            <tr className="bg-amber-50/50">
              <td className="p-3.5 font-medium text-slate-800">Diagonal Medida en la Obra</td>
              <td className="p-3.5 font-bold text-amber-600">10,18 m</td>
              <td className="p-3.5 text-slate-600">Medición real obtenida con la cinta métrica.</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Conclusion Alert */}
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 mb-6">
        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="text-sm text-rose-900 leading-relaxed">
          <strong>Conclusión pedagógica:</strong> Las longitudes medidas no corresponden a un triángulo rectángulo.
          Por tanto, <strong>las paredes no forman un ángulo de 90°</strong>. ¡El constructor debe corregir el descuadre de las paredes antes de seguir colocando baldosas!
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="flex justify-end">
        <button
          onClick={onStartPractice}
          className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md flex items-center space-x-2 text-base"
        >
          <span>Practicar en Resuelve</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
