"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Compass, 
  RotateCcw, 
  Layers, 
  Eye, 
  EyeOff, 
  Maximize2, 
  Minimize2, 
  Sparkles, 
  Check, 
  Sliders, 
  Plus, 
  Minus,
  HelpCircle
} from 'lucide-react';
import { MathText } from '../ui/MathText';

export type CanvasMode = 'geometria' | 'algebra' | 'funciones' | 'trigonometria' | 'ecuaciones' | 'proporciones';

interface NativeGeoGebraCanvasProps {
  mode?: CanvasMode;
  initialParams?: Record<string, any>;
  highlightedElement?: string | null;
  agentAction?: any;
  onParamChange?: (params: Record<string, any>) => void;
  isFullscreen?: boolean;
}

export const NativeGeoGebraCanvas: React.FC<NativeGeoGebraCanvasProps> = ({
  mode = 'geometria',
  initialParams = {},
  highlightedElement = null,
  agentAction = null,
  onParamChange,
  isFullscreen = false,
}) => {
  // ── Geometry Mode State (Right Triangle / Pythagoras) ────────────────────────
  const [catetoA, setCatetoA] = useState<number>(initialParams.cateto_a ?? 6); // Horizontal base
  const [catetoB, setCatetoB] = useState<number>(initialParams.cateto_b ?? 8); // Vertical height
  const [showSquares, setShowSquares] = useState<boolean>(true);
  const [showAngleLabels, setShowAngleLabels] = useState<boolean>(true);

  // ── Algebra Mode State (Area Model (x+a)(x+b)) ──────────────────────────────
  const [valX, setValX] = useState<number>(initialParams.x ?? 3);
  const [valA, setValA] = useState<number>(initialParams.a ?? 2);
  const [valB, setValB] = useState<number>(initialParams.b ?? 4);

  // ── Functions Mode State (y = mx + b) ───────────────────────────────────────
  const [slopeM, setSlopeM] = useState<number>(initialParams.m ?? 2);
  const [interceptB, setInterceptB] = useState<number>(initialParams.b ?? 1);

  // ── Trigonometry Mode State (Unit Circle) ───────────────────────────────────
  const [angleDeg, setAngleDeg] = useState<number>(initialParams.angulo ?? 45);

  // ── Equations Balance Mode State ────────────────────────────────────────────
  const [eqCoefA, setEqCoefA] = useState<number>(initialParams.coef_a ?? 2);
  const [eqConstB, setEqConstB] = useState<number>(initialParams.const_b ?? 4);
  const [eqRightC, setEqRightC] = useState<number>(initialParams.right_c ?? 10);
  const [eqStudentX, setEqStudentX] = useState<number>(3);

  // Socratic Agent Control: Listen to agent tool invocations
  useEffect(() => {
    if (!agentAction) return;
    if (agentAction.accion === 'ajustar_parametro_simulador' && agentAction.parametros_simulador) {
      const p = agentAction.parametros_simulador;
      if (p.cateto_a !== undefined) setCatetoA(Number(p.cateto_a));
      if (p.cateto_b !== undefined) setCatetoB(Number(p.cateto_b));
      if (p.x !== undefined) setValX(Number(p.x));
      if (p.a !== undefined) setValA(Number(p.a));
      if (p.b !== undefined) setValB(Number(p.b));
      if (p.m !== undefined) setSlopeM(Number(p.m));
      if (p.intercept_b !== undefined || p.b !== undefined) setInterceptB(Number(p.intercept_b ?? p.b));
      if (p.angulo !== undefined) setAngleDeg(Number(p.angulo));
    }
  }, [agentAction]);

  // Calculations for Geometry Mode
  const hipotenusaC = Math.sqrt(catetoA * catetoA + catetoB * catetoB);
  const areaA = catetoA * catetoA;
  const areaB = catetoB * catetoB;
  const areaC = hipotenusaC * hipotenusaC;
  const angleAlpha = Math.atan2(catetoB, catetoA) * (180 / Math.PI);
  const angleBeta = 90 - angleAlpha;

  // Notify parent of state changes
  useEffect(() => {
    if (onParamChange) {
      if (mode === 'geometria') {
        onParamChange({
          cateto_a: catetoA,
          cateto_b: catetoB,
          hipotenusa_c: Number(hipotenusaC.toFixed(2)),
          area_a: areaA,
          area_b: areaB,
          area_c: Number(areaC.toFixed(2)),
          angulo_alpha: Number(angleAlpha.toFixed(1)),
        });
      } else if (mode === 'algebra') {
        onParamChange({
          x: valX,
          a: valA,
          b: valB,
          area_total: (valX + valA) * (valX + valB),
        });
      } else if (mode === 'funciones') {
        onParamChange({
          m: slopeM,
          b: interceptB,
        });
      } else if (mode === 'trigonometria') {
        const rad = (angleDeg * Math.PI) / 180;
        onParamChange({
          angulo: angleDeg,
          sin: Number(Math.sin(rad).toFixed(3)),
          cos: Number(Math.cos(rad).toFixed(3)),
          tan: Number(Math.tan(rad).toFixed(3)),
        });
      }
    }
  }, [catetoA, catetoB, valX, valA, valB, slopeM, interceptB, angleDeg, mode, onParamChange]);

  // Highlight helper
  const isTargetHighlighted = (target: string): boolean => {
    if (!highlightedElement) return false;
    const h = highlightedElement.toLowerCase();
    const t = target.toLowerCase();
    if (h === t) return true;
    if (h === 'simulador' || h === 'diagrama') return true;
    if (t === 'cateto_a' && (h.includes('base') || h.includes('horizontal') || h.includes('cateto_a') || h.includes('pared_8m') || h.includes('lado_a'))) return true;
    if (t === 'cateto_b' && (h.includes('altura') || h.includes('vertical') || h.includes('cateto_b') || h.includes('pared_6m') || h.includes('lado_b'))) return true;
    if (t === 'hipotenusa' && (h.includes('hipotenusa') || h.includes('diagonal') || h.includes('lado_c'))) return true;
    if (t === 'angulo_recto' && (h.includes('angulo') || h.includes('recto') || h.includes('90'))) return true;
    if (t === 'cuadrados' && (h.includes('area') || h.includes('cuadrado') || h.includes('demostracion'))) return true;
    return false;
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden relative font-sans">
      {/* Canvas Top Bar */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center font-bold text-white shadow-xs">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-200 tracking-wide uppercase text-[11px]">
            Lienzo Matemático Nativo
          </span>
          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold">
            Motor GeoGebra React v2.4
          </span>
        </div>

        {/* Action badges and controls */}
        <div className="flex items-center space-x-2">
          {mode === 'geometria' && (
            <button
              onClick={() => setShowSquares(!showSquares)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                showSquares 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {showSquares ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>{showSquares ? "Cuadrados Activos" : "Ocultar Cuadrados"}</span>
            </button>
          )}

          <button
            onClick={() => {
              setCatetoA(6);
              setCatetoB(8);
              setValX(3);
              setValA(2);
              setValB(4);
              setSlopeM(2);
              setInterceptB(1);
              setAngleDeg(45);
            }}
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Restablecer valores"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* SVG Mathematical Viewport */}
        <div className="flex-1 flex items-center justify-center p-3 relative overflow-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
          {/* Mode 1: Geometry (Right Triangle & Pythagoras) */}
          {mode === 'geometria' && (
            <svg 
              viewBox="-40 -60 480 440" 
              className="w-full h-full max-h-[460px] drop-shadow-md select-none"
            >
              <defs>
                {/* Patterns & Grids */}
                <pattern id="native-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" strokeWidth="0.5" opacity="0.4" />
                </pattern>
                {/* Gradient for Hypotenuse Square */}
                <linearGradient id="hypoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#b45309" stopOpacity="0.15" />
                </linearGradient>
                {/* Gradient for Cateto A Square */}
                <linearGradient id="catAGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.15" />
                </linearGradient>
                {/* Gradient for Cateto B Square */}
                <linearGradient id="catBGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#047857" stopOpacity="0.15" />
                </linearGradient>
              </defs>

              <rect x="-40" y="-60" width="480" height="440" fill="url(#native-grid)" />

              {/* Triangle scale geometry (Origin C at (100, 260)) */}
              {(() => {
                const ox = 110;
                const oy = 260;
                const scale = 14; // pixels per unit
                const bx = ox + catetoA * scale;
                const by = oy;
                const ax = ox;
                const ay = oy - catetoB * scale;

                // Square on Cateto A (Horizontal, below BC)
                const sqA_y = oy + catetoA * scale;

                // Square on Cateto B (Vertical, left of AC)
                const sqB_x = ox - catetoB * scale;

                // Square on Hypotenuse (Perpendicular vector from AB)
                const dx = bx - ax;
                const dy = by - ay;
                const p3x = bx + dy;
                const p3y = by - dx;
                const p4x = ax + dy;
                const p4y = ay - dx;

                return (
                  <g>
                    {/* Pythagoras Squares */}
                    {showSquares && (
                      <g className="transition-all duration-300">
                        {/* Square on side a */}
                        <polygon
                          points={`${ox},${oy} ${bx},${by} ${bx},${sqA_y} ${ox},${sqA_y}`}
                          fill="url(#catAGrad)"
                          stroke={isTargetHighlighted('cateto_a') ? "#fbbf24" : "#3b82f6"}
                          strokeWidth={isTargetHighlighted('cateto_a') ? 3 : 1.5}
                          strokeDasharray="4 2"
                        />
                        <text
                          x={ox + (catetoA * scale) / 2}
                          y={oy + (catetoA * scale) / 2 + 5}
                          textAnchor="middle"
                          fill="#93c5fd"
                          fontSize="11"
                          fontWeight="bold"
                        >
                          a² = {areaA}
                        </text>

                        {/* Square on side b */}
                        <polygon
                          points={`${ox},${oy} ${ax},${ay} ${sqB_x},${ay} ${sqB_x},${oy}`}
                          fill="url(#catBGrad)"
                          stroke={isTargetHighlighted('cateto_b') ? "#fbbf24" : "#10b981"}
                          strokeWidth={isTargetHighlighted('cateto_b') ? 3 : 1.5}
                          strokeDasharray="4 2"
                        />
                        <text
                          x={ox - (catetoB * scale) / 2}
                          y={oy - (catetoB * scale) / 2 + 5}
                          textAnchor="middle"
                          fill="#6ee7b7"
                          fontSize="11"
                          fontWeight="bold"
                        >
                          b² = {areaB}
                        </text>

                        {/* Square on hypotenuse c */}
                        <polygon
                          points={`${ax},${ay} ${bx},${by} ${p3x},${p3y} ${p4x},${p4y}`}
                          fill="url(#hypoGrad)"
                          stroke={isTargetHighlighted('hipotenusa') ? "#fbbf24" : "#f59e0b"}
                          strokeWidth={isTargetHighlighted('hipotenusa') ? 3.5 : 1.5}
                        />
                        <text
                          x={(ax + bx + p3x + p4x) / 4}
                          y={(ay + by + p3y + p4y) / 4 + 4}
                          textAnchor="middle"
                          fill="#fcd34d"
                          fontSize="12"
                          fontWeight="bold"
                        >
                          c² = {areaC.toFixed(0)}
                        </text>
                      </g>
                    )}

                    {/* Triangle Main Shading */}
                    <polygon
                      points={`${ox},${oy} ${bx},${by} ${ax},${ay}`}
                      fill="#1e1b4b"
                      fillOpacity="0.7"
                      stroke="#4338ca"
                      strokeWidth="2"
                    />

                    {/* Right Angle Symbol at (ox, oy) */}
                    <g className={isTargetHighlighted('angulo_recto') ? "animate-pulse" : ""}>
                      <rect
                        x={ox}
                        y={oy - 18}
                        width="18"
                        height="18"
                        fill="none"
                        stroke={isTargetHighlighted('angulo_recto') ? "#fbbf24" : "#94a3b8"}
                        strokeWidth="2"
                      />
                      <circle
                        cx={ox + 9}
                        cy={oy - 9}
                        r="2"
                        fill={isTargetHighlighted('angulo_recto') ? "#fbbf24" : "#94a3b8"}
                      />
                    </g>

                    {/* Side a (Cateto Horizontal BC) */}
                    <line
                      x1={ox}
                      y1={oy}
                      x2={bx}
                      y2={by}
                      stroke={isTargetHighlighted('cateto_a') ? "#fbbf24" : "#3b82f6"}
                      strokeWidth={isTargetHighlighted('cateto_a') ? 5 : 3.5}
                      strokeLinecap="round"
                    />
                    <text
                      x={ox + (catetoA * scale) / 2}
                      y={oy + 22}
                      textAnchor="middle"
                      fill={isTargetHighlighted('cateto_a') ? "#fbbf24" : "#93c5fd"}
                      fontSize="13"
                      fontWeight="bold"
                    >
                      a = {catetoA} m
                    </text>

                    {/* Side b (Cateto Vertical AC) */}
                    <line
                      x1={ox}
                      y1={oy}
                      x2={ax}
                      y2={ay}
                      stroke={isTargetHighlighted('cateto_b') ? "#fbbf24" : "#10b981"}
                      strokeWidth={isTargetHighlighted('cateto_b') ? 5 : 3.5}
                      strokeLinecap="round"
                    />
                    <text
                      x={ox - 22}
                      y={oy - (catetoB * scale) / 2}
                      textAnchor="middle"
                      fill={isTargetHighlighted('cateto_b') ? "#fbbf24" : "#6ee7b7"}
                      fontSize="13"
                      fontWeight="bold"
                    >
                      b = {catetoB} m
                    </text>

                    {/* Hypotenuse c (Diagonal AB) */}
                    <line
                      x1={ax}
                      y1={ay}
                      x2={bx}
                      y2={by}
                      stroke={isTargetHighlighted('hipotenusa') ? "#fbbf24" : "#f59e0b"}
                      strokeWidth={isTargetHighlighted('hipotenusa') ? 5.5 : 4}
                      strokeLinecap="round"
                    />
                    <text
                      x={(ax + bx) / 2 + 18}
                      y={(ay + by) / 2 - 12}
                      textAnchor="middle"
                      fill={isTargetHighlighted('hipotenusa') ? "#fbbf24" : "#fcd34d"}
                      fontSize="14"
                      fontWeight="extrabold"
                    >
                      c = {hipotenusaC.toFixed(2)} m
                    </text>

                    {/* Interactive Vertex Handles */}
                    {/* Vertex C (Right Angle) */}
                    <circle cx={ox} cy={oy} r="6" fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
                    <text x={ox - 14} y={oy + 14} fill="#94a3b8" fontSize="11" fontWeight="bold">C (90°)</text>

                    {/* Vertex B (Horizontal Cateto end) */}
                    <circle 
                      cx={bx} 
                      cy={by} 
                      r="8" 
                      fill="#3b82f6" 
                      stroke="#ffffff" 
                      strokeWidth="2.5" 
                      className="cursor-ew-resize hover:scale-125 transition-transform" 
                    />
                    <text x={bx + 12} y={by + 4} fill="#60a5fa" fontSize="12" fontWeight="bold">B</text>

                    {/* Vertex A (Vertical Cateto end) */}
                    <circle 
                      cx={ax} 
                      cy={ay} 
                      r="8" 
                      fill="#10b981" 
                      stroke="#ffffff" 
                      strokeWidth="2.5" 
                      className="cursor-ns-resize hover:scale-125 transition-transform" 
                    />
                    <text x={ax - 12} y={ay - 10} fill="#34d399" fontSize="12" fontWeight="bold">A</text>
                  </g>
                );
              })()}
            </svg>
          )}

          {/* Mode 2: Area Model Algebra (x+a)(x+b) */}
          {mode === 'algebra' && (
            <svg viewBox="-20 -20 400 360" className="w-full h-full max-h-[440px] select-none">
              {(() => {
                const ox = 50;
                const oy = 50;
                const scale = 22;
                const wX = valX * scale;
                const wA = valA * scale;
                const hX = valX * scale;
                const hB = valB * scale;

                return (
                  <g>
                    {/* Quadrant 1: x * x = x^2 */}
                    <rect x={ox} y={oy} width={wX} height={hX} fill="#1d4ed8" fillOpacity="0.4" stroke="#3b82f6" strokeWidth="2" />
                    <text x={ox + wX / 2} y={oy + hX / 2 + 5} textAnchor="middle" fill="#93c5fd" fontSize="14" fontWeight="bold">x² ({valX * valX})</text>

                    {/* Quadrant 2: a * x */}
                    <rect x={ox + wX} y={oy} width={wA} height={hX} fill="#047857" fillOpacity="0.4" stroke="#10b981" strokeWidth="2" />
                    <text x={ox + wX + wA / 2} y={oy + hX / 2 + 5} textAnchor="middle" fill="#6ee7b7" fontSize="13" fontWeight="bold">{valA}x ({valA * valX})</text>

                    {/* Quadrant 3: b * x */}
                    <rect x={ox} y={oy + hX} width={wX} height={hB} fill="#0f766e" fillOpacity="0.4" stroke="#14b8a6" strokeWidth="2" />
                    <text x={ox + wX / 2} y={oy + hX + hB / 2 + 5} textAnchor="middle" fill="#5eead4" fontSize="13" fontWeight="bold">{valB}x ({valB * valX})</text>

                    {/* Quadrant 4: a * b */}
                    <rect x={ox + wX} y={oy + hX} width={wA} height={hB} fill="#b45309" fillOpacity="0.4" stroke="#f59e0b" strokeWidth="2" />
                    <text x={ox + wX + wA / 2} y={oy + hX + hB / 2 + 5} textAnchor="middle" fill="#fcd34d" fontSize="13" fontWeight="bold">{valA * valB}</text>

                    {/* Labels on Top (Base = x + a) */}
                    <text x={ox + wX / 2} y={oy - 12} textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="bold">x = {valX}</text>
                    <text x={ox + wX + wA / 2} y={oy - 12} textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="bold">+{valA}</text>

                    {/* Labels on Left (Height = x + b) */}
                    <text x={ox - 14} y={oy + hX / 2 + 4} textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="bold">x = {valX}</text>
                    <text x={ox - 14} y={oy + hX + hB / 2 + 4} textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="bold">+{valB}</text>
                  </g>
                );
              })()}
            </svg>
          )}

          {/* Mode 3: Functions (Linear graph y = mx + b) */}
          {mode === 'funciones' && (
            <svg viewBox="-200 -180 400 360" className="w-full h-full max-h-[440px] select-none">
              {/* Axes X and Y */}
              <line x1="-180" y1="0" x2="180" y2="0" stroke="#475569" strokeWidth="2" />
              <line x1="0" y1="-160" x2="0" y2="160" stroke="#475569" strokeWidth="2" />

              {/* Ticks */}
              {[-6, -4, -2, 2, 4, 6].map((n) => (
                <g key={n}>
                  <line x1={n * 24} y1="-4" x2={n * 24} y2="4" stroke="#64748b" strokeWidth="1.5" />
                  <text x={n * 24} y="16" fill="#64748b" fontSize="10" textAnchor="middle">{n}</text>
                  <line x1="-4" y1={-n * 24} x2="4" y2={-n * 24} stroke="#64748b" strokeWidth="1.5" />
                  <text x="-12" y={-n * 24 + 4} fill="#64748b" fontSize="10" textAnchor="middle">{n}</text>
                </g>
              ))}

              {/* Line y = mx + b */}
              {(() => {
                const x1 = -7;
                const y1 = slopeM * x1 + interceptB;
                const x2 = 7;
                const y2 = slopeM * x2 + interceptB;
                const scale = 24;

                return (
                  <g>
                    <line
                      x1={x1 * scale}
                      y1={-y1 * scale}
                      x2={x2 * scale}
                      y2={-y2 * scale}
                      stroke="#38bdf8"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    {/* Y-intercept point (0, b) */}
                    <circle cx="0" cy={-interceptB * scale} r="6" fill="#f43f5e" stroke="#fff" strokeWidth="2" />
                    <text x="14" y={-interceptB * scale + 4} fill="#fda4af" fontSize="11" fontWeight="bold">
                      (0, {interceptB})
                    </text>
                  </g>
                );
              })()}
            </svg>
          )}

          {/* Mode 4: Trigonometry Unit Circle */}
          {mode === 'trigonometria' && (
            <svg viewBox="-180 -180 360 360" className="w-full h-full max-h-[440px] select-none">
              {(() => {
                const r = 120;
                const rad = (angleDeg * Math.PI) / 180;
                const px = r * Math.cos(rad);
                const py = -r * Math.sin(rad);

                return (
                  <g>
                    {/* Axes */}
                    <line x1="-160" y1="0" x2="160" y2="0" stroke="#475569" strokeWidth="1.5" />
                    <line x1="0" y1="-160" x2="0" y2="160" stroke="#475569" strokeWidth="1.5" />

                    {/* Unit Circle */}
                    <circle cx="0" cy="0" r={r} fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeDasharray="4 2" />

                    {/* Triangle formed inside */}
                    <polygon points={`0,0 ${px},0 ${px},${py}`} fill="#3b82f6" fillOpacity="0.2" stroke="#3b82f6" strokeWidth="1" />

                    {/* Cosine projection (horizontal) */}
                    <line x1="0" y1="0" x2={px} y2="0" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />

                    {/* Sine projection (vertical) */}
                    <line x1={px} y1="0" x2={px} y2={py} stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />

                    {/* Radius vector */}
                    <line x1="0" y1="0" x2={px} y2={py} stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />

                    {/* Point P */}
                    <circle cx={px} cy={py} r="7" fill="#f8fafc" stroke="#f59e0b" strokeWidth="3" />

                    {/* Value badges */}
                    <text x={px / 2} y="18" fill="#34d399" fontSize="11" fontWeight="bold" textAnchor="middle">
                      cos(θ) = {Math.cos(rad).toFixed(2)}
                    </text>
                    <text x={px + (px >= 0 ? 12 : -12)} y={py / 2} fill="#f87171" fontSize="11" fontWeight="bold" textAnchor={px >= 0 ? "start" : "end"}>
                      sin(θ) = {Math.sin(rad).toFixed(2)}
                    </text>
                  </g>
                );
              })()}
            </svg>
          )}

          {/* Mode 5: Equations Balance */}
          {mode === 'ecuaciones' && (
            <svg viewBox="-200 -120 400 260" className="w-full h-full max-h-[440px] select-none">
              {(() => {
                const leftWeight = eqCoefA * eqStudentX + eqConstB;
                const rightWeight = eqRightC;
                const diff = leftWeight - rightWeight;
                const tilt = Math.max(-15, Math.min(15, diff * 3));
                const isBalanced = leftWeight === rightWeight;

                return (
                  <g>
                    {/* Base Fulcrum */}
                    <polygon points="0,50 -35,110 35,110" fill="#334155" stroke="#64748b" strokeWidth="2" />
                    <circle cx="0" cy="50" r="6" fill="#f59e0b" />

                    {/* Tilting Beam */}
                    <g transform={`rotate(${tilt}, 0, 50)`}>
                      <line x1="-150" y1="50" x2="150" y2="50" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />

                      {/* Left Pan */}
                      <line x1="-130" y1="50" x2="-130" y2="85" stroke="#64748b" strokeWidth="2" />
                      <line x1="-130" y1="85" x2="-90" y2="85" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
                      <line x1="-130" y1="85" x2="-170" y2="85" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />

                      {/* Right Pan */}
                      <line x1="130" y1="50" x2="130" y2="85" stroke="#64748b" strokeWidth="2" />
                      <line x1="130" y1="85" x2="90" y2="85" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
                      <line x1="130" y1="85" x2="170" y2="85" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
                    </g>

                    {/* Status Badge */}
                    <text x="0" y="-30" textAnchor="middle" fill={isBalanced ? "#34d399" : "#fcd34d"} fontSize="14" fontWeight="bold">
                      {isBalanced ? "✓ ¡Balanza en Equilibrio Perfecto!" : diff > 0 ? "El platillo izquierdo pesa más" : "El platillo derecho pesa más"}
                    </text>
                  </g>
                );
              })()}
            </svg>
          )}
        </div>

        {/* Dynamic Controls Side Panel */}
        <div className="w-full lg:w-72 bg-slate-900/90 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 space-y-4 text-xs shrink-0 overflow-y-auto">
          <div className="flex items-center space-x-2 text-slate-300 font-bold uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800">
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span>Controles Interactivos</span>
          </div>

          {/* Controls for Geometry */}
          {mode === 'geometria' && (
            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between font-bold mb-1">
                  <span className={isTargetHighlighted('cateto_a') ? "text-amber-400" : "text-blue-400"}>
                    Cateto A (Horizontal):
                  </span>
                  <span className="font-mono text-slate-100">{catetoA} m</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="16"
                  step="1"
                  value={catetoA}
                  onChange={(e) => setCatetoA(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
              </div>

              <div>
                <div className="flex justify-between font-bold mb-1">
                  <span className={isTargetHighlighted('cateto_b') ? "text-amber-400" : "text-emerald-400"}>
                    Cateto B (Vertical):
                  </span>
                  <span className="font-mono text-slate-100">{catetoB} m</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="16"
                  step="1"
                  value={catetoB}
                  onChange={(e) => setCatetoB(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
              </div>

              {/* Real-time deduction box */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Cálculo Pitagórico en Vivo:
                </span>
                <div className="font-mono text-xs text-amber-300 font-bold">
                  {catetoA}² + {catetoB}² = {areaA} + {areaB} = {areaC}
                </div>
                <div className="text-[11px] text-emerald-400 font-bold">
                  c = √{areaC} = {hipotenusaC.toFixed(2)} m
                </div>
              </div>
            </div>
          )}

          {/* Controls for Algebra */}
          {mode === 'algebra' && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between font-bold mb-1 text-slate-300">
                  <span>Variable x:</span>
                  <span className="font-mono text-blue-400">{valX}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={valX}
                  onChange={(e) => setValX(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-bold mb-1 text-slate-300">
                  <span>Término a:</span>
                  <span className="font-mono text-emerald-400">+{valA}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={valA}
                  onChange={(e) => setValA(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-bold mb-1 text-slate-300">
                  <span>Término b:</span>
                  <span className="font-mono text-amber-400">+{valB}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={valB}
                  onChange={(e) => setValB(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-[11px] text-slate-200">
                Área Total = ({valX}+{valA})({valX}+{valB}) = {(valX + valA) * (valX + valB)}
              </div>
            </div>
          )}

          {/* Controls for Functions */}
          {mode === 'funciones' && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between font-bold mb-1 text-slate-300">
                  <span>Pendiente (m):</span>
                  <span className="font-mono text-sky-400">{slopeM}</span>
                </div>
                <input
                  type="range"
                  min="-4"
                  max="4"
                  step="0.5"
                  value={slopeM}
                  onChange={(e) => setSlopeM(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-bold mb-1 text-slate-300">
                  <span>Ordenada al origen (b):</span>
                  <span className="font-mono text-rose-400">{interceptB}</span>
                </div>
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="1"
                  value={interceptB}
                  onChange={(e) => setInterceptB(Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs text-sky-300 font-bold text-center">
                y = {slopeM}x {interceptB >= 0 ? `+ ${interceptB}` : `- ${Math.abs(interceptB)}`}
              </div>
            </div>
          )}

          {/* Controls for Trigonometry */}
          {mode === 'trigonometria' && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between font-bold mb-1 text-slate-300">
                  <span>Ángulo θ:</span>
                  <span className="font-mono text-amber-400">{angleDeg}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={angleDeg}
                  onChange={(e) => setAngleDeg(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 font-mono text-xs">
                <div className="text-emerald-400">cos({angleDeg}°) = {Math.cos((angleDeg * Math.PI) / 180).toFixed(3)}</div>
                <div className="text-red-400">sin({angleDeg}°) = {Math.sin((angleDeg * Math.PI) / 180).toFixed(3)}</div>
                <div className="text-violet-400">tan({angleDeg}°) = {Math.tan((angleDeg * Math.PI) / 180).toFixed(3)}</div>
              </div>
            </div>
          )}

          {/* Controls for Equations */}
          {mode === 'ecuaciones' && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between font-bold mb-1 text-slate-300">
                  <span>Valor de x a probar:</span>
                  <span className="font-mono text-blue-400">{eqStudentX}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={eqStudentX}
                  onChange={(e) => setEqStudentX(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-xs">
                <div className="font-bold text-slate-300">Ecuación: {eqCoefA}x + {eqConstB} = {eqRightC}</div>
                <div className="text-blue-300 font-mono">Izquierda: {eqCoefA}({eqStudentX}) + {eqConstB} = {eqCoefA * eqStudentX + eqConstB}</div>
                <div className="text-emerald-300 font-mono">Derecha: {eqRightC}</div>
              </div>
            </div>
          )}

          {/* Agent Guidance Alert inside Simulator */}
          <div className="p-2.5 rounded-xl bg-blue-950/50 border border-blue-800/60 text-[11px] text-blue-200 flex items-start space-x-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <span>
              El Tutor Socrático puede manipular estos controles directamente para ilustrarte teoremas.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
