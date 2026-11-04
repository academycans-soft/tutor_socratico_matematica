"""AI Curriculum and Content Generator Service for Open TutorAI LMS.

Generates complete pedagogical packages (CONECTA -> COMPRENDE -> RESUELVE)
based on specification v2.4, enables conversational staging refinement,
and generates real-time infinite practice exercises.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy.orm import Session

from ai.providers.config_service import ProviderConfigService
from data import models

log = logging.getLogger(__name__)

SIMULATORS_CATALOG: Dict[str, Dict[str, Any]] = {
    "algebra": {
        "type": "geogebra",
        "url": "https://www.geogebra.org/material/iframe/id/kewx4c4c/width/700/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false",
        "title": "Simulador GeoGebra: Modelo de Áreas y Factorización de Polinomios",
        "instructions": (
            "Usa el modelo geométrico de áreas para descomponer binomios y trinomios en rectángulos parciales. "
            "Observa cómo $(x+a)(x+b)$ o las diferencias de cuadrados se representan visualmente como suma de áreas."
        ),
        "controls": [
            {"param": "base_x", "label": "Base (x + a)", "default": 2, "min": 1, "max": 6},
            {"param": "altura_x", "label": "Altura (x + b)", "default": 3, "min": 1, "max": 6},
        ],
    },
    "geometria": {
        "type": "geogebra",
        "url": "https://www.geogebra.org/material/iframe/id/v895s35a/width/700/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false",
        "title": "Simulador GeoGebra: Triángulos Rectángulos y Teoremas Métricos",
        "instructions": (
            "Manipula los catetos o arrastra los vértices en tiempo real para observar cómo varía la hipotenusa, "
            "los ángulos agudos y la relación fundamental $a^2 + b^2 = c^2$."
        ),
        "controls": [
            {"param": "cateto_a", "label": "Cateto A (m)", "default": 6, "min": 1, "max": 20},
            {"param": "cateto_b", "label": "Cateto B (m)", "default": 8, "min": 1, "max": 20},
        ],
    },
    "ecuaciones": {
        "type": "geogebra",
        "url": "https://www.geogebra.org/material/iframe/id/j28rfe5f/width/700/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false",
        "title": "Simulador GeoGebra: Balanza de Igualdad y Despeje de Ecuaciones",
        "instructions": (
            "Equilibra la balanza colocando términos en cada platillo. "
            "Aplica operaciones idénticas en ambos lados para despejar la incógnita paso a paso."
        ),
        "controls": [
            {"param": "coef_x", "label": "Término en x", "default": 2, "min": 1, "max": 6},
            {"param": "constante", "label": "Constante numérica", "default": 6, "min": -10, "max": 15},
        ],
    },
    "funciones": {
        "type": "geogebra",
        "url": "https://www.geogebra.org/material/iframe/id/m5c9m467/width/700/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false",
        "title": "Simulador GeoGebra: Graficador de Rectas, Pendiente y Ordenada al Origen",
        "instructions": (
            "Modifica la pendiente m y la ordenada b en $y = mx + b$. "
            "Observa al instante la inclinación y el desplazamiento de la recta en el plano cartesiano."
        ),
        "controls": [
            {"param": "m", "label": "Pendiente (m)", "default": 2, "min": -5, "max": 5, "step": 0.5},
            {"param": "b", "label": "Ordenada al origen (b)", "default": 1, "min": -10, "max": 10},
        ],
    },
    "fracciones": {
        "type": "geogebra",
        "url": "https://www.geogebra.org/material/iframe/id/dsmfqe2z/width/700/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false",
        "title": "Simulador GeoGebra: Modelos Visuales de Fracciones y Razones",
        "instructions": "Empareja representaciones geométricas de áreas con sus valores numéricos fraccionarios y porcentuales.",
        "controls": [
            {"param": "num", "label": "Numerador", "default": 3, "min": 1, "max": 12},
            {"param": "den", "label": "Denominador", "default": 4, "min": 1, "max": 12},
        ],
    },
    "probabilidad": {
        "type": "geogebra",
        "url": "https://www.geogebra.org/material/iframe/id/a74z6e5u/width/700/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false",
        "title": "Simulador GeoGebra: Distribución de Probabilidad y Frecuencias",
        "instructions": "Simula eventos aleatorios y descubre cómo emerge la distribución de datos a partir del azar en GeoGebra.",
        "controls": [
            {"param": "filas", "label": "Ensayos", "default": 10, "min": 4, "max": 50},
        ],
    },
    "trigonometria": {
        "type": "geogebra",
        "url": "https://www.geogebra.org/material/iframe/id/c9r8kcvu/width/700/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false",
        "title": "Simulador GeoGebra: Círculo Trigonométrico y Razones Seno/Coseno/Tangente",
        "instructions": "Gira el radio vector sobre la circunferencia unitaria y observa cómo varían las proyecciones seno, coseno y tangente en tiempo real.",
        "controls": [
            {"param": "angulo", "label": "Ángulo θ (°)", "default": 45, "min": 0, "max": 360},
        ],
    },
    "proporciones": {
        "type": "geogebra",
        "url": "https://www.geogebra.org/material/iframe/id/dsmfqe2z/width/700/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/false/ctl/false",
        "title": "Simulador GeoGebra: Proporciones, Razones y Teorema de Tales",
        "instructions": "Ajusta las razones numéricas y comprueba visualmente la equivalencia de razones geométricas.",
        "controls": [
            {"param": "razon_a", "label": "Razón A", "default": 2, "min": 1, "max": 10},
            {"param": "razon_b", "label": "Razón B", "default": 5, "min": 1, "max": 10},
        ],
    },
}


def resolve_simulator_for_topic(title: str, unit: str = "", description: str = "") -> Dict[str, Any]:
    """Resolves the best matching GeoGebra interactive simulator for any curriculum topic."""
    text = f"{title} {unit} {description}".lower()
    if any(k in text for k in ["trigonometr", "seno", "coseno", "tangente", "circulo unitario"]):
        return SIMULATORS_CATALOG["trigonometria"]
    if any(k in text for k in ["proporcion", "escala", "regla de tres", "semejanza"]):
        return SIMULATORS_CATALOG["proporciones"]
    if any(k in text for k in ["factor", "binomio", "polinomio", "producto", "notable", "algebra", "trinomio", "expresion", "cuadrado"]):
        return SIMULATORS_CATALOG["algebra"]
    if any(k in text for k in ["pitagora", "triang", "angulo", "geometr", "medida", "distancia", "vector", "hipotenusa", "cateto"]):
        return SIMULATORS_CATALOG["geometria"]
    if any(k in text for k in ["ecuacion", "sistema", "despeje", "igualdad", "inecuacion"]):
        return SIMULATORS_CATALOG["ecuaciones"]
    if any(k in text for k in ["funcion", "lineal", "recta", "pendiente", "grafic", "coordenad"]):
        return SIMULATORS_CATALOG["funciones"]
    if any(k in text for k in ["fraccion", "racional", "razon"]):
        return SIMULATORS_CATALOG["fracciones"]
    if any(k in text for k in ["probab", "estadist", "frecuencia", "azar", "muestra", "dato"]):
        return SIMULATORS_CATALOG["probabilidad"]
    return SIMULATORS_CATALOG["algebra"]


CURRICULUM_AI_SYSTEM_PROMPT = """Eres el Diseñador Pedagógico Curricular de Alta Fidelidad de Open TutorAI CE,
diseñado según la especificación de diseño pedagógico v2.4 (Diego Rodríguez y Gabriela Jácome).

REGLAS DE ORO DE NARRATIVA, ENGANCHE Y RIGOR MATEMÁTICO:
1. PROHIBICIÓN ABSOLUTA de frases genéricas, aburridas o académicas como:
   - "En un escenario de aplicación cotidiana para estudiantes..."
   - "Un problema del contexto real para aprender matemáticas..."
   - "Los estudiantes deben calcular..."
2. TODA narrativa en CONECTA debe ser CINEMATOGRÁFICA, INMERSIVA y CON PERSONAJES Y ROLES REALES:
   - Protagonistas concretos (ej. desarrolladores de videojuegos, ingenieros aeroespaciales, arquitectas bioclimáticas, diseñadores de skateparks, bioinformáticos, sound designers).
   - Un dilema tangible con datos numéricos exactos y una necesidad real de calcular sin tanteo.
   - Una misión interactiva en el SIMULADOR DIGITAL (GeoGebra / Lienzo Nativo) que invite al alumno a explorar y probar antes de formalizar.
3. EN COMPRENDE (Demostración y Construcción del Modelo):
   - NUNCA des explicaciones telegráficas de una sola línea.
   - Desarrolla al menos 4 pasos progresivos de razonamiento que expliquen el PORQUÉ y conecten la visualización del simulador con el álgebra/geometría formal.
   - Emplea siempre fórmulas matemáticas en formato LaTeX estándar ($$A = (x+a)(x+b)$$).
4. EN RESUELVE:
   - 4 ejercicios adaptativos en progresión: Nivel 1 (Básico), Nivel 2 (Intermedio), Nivel 3 (Avanzado), Nivel 4 (Desafío de Modelación).
   - Cada ejercicio con valores numéricos coherentes, pistas pedagógicas socráticas y solución paso a paso.

RESPONDE EXCLUSIVAMENTE CON UN OBJETO JSON VÁLIDO SIN MARKDOWN EXTERNO.
"""

REALTIME_EXERCISE_PROMPT = """Eres el Generador de Ejercicios en Tiempo Real de Open TutorAI.
Genera UN nuevo ejercicio matemático original, creativo y no repetitivo para el tema especificado.
El ejercicio DEBE tener:
- id: identificador único generado
- title: título del problema
- statement: enunciado claro y contextualizado
- level: nivel ('basico', 'intermedio', 'avanzado', 'desafio')
- figure_type: tipo de diagrama ('triangle_direct', 'diagonal_bar', 'ladder', 'ramp', 'shadow', 'cable')
- data_params: valores de los lados y datos para renderizar el diagrama 2D
- correct_answer: respuesta numérica (ej. '10', '8.65', '12')
- acceptable_range: rango [min, max] con tolerancia ±0.1
- unit: unidad ('m', 'cm', 'km', etc.)
- hints: { 'level_1': 'pista conceptual', 'level_2': 'pista con fórmula', 'level_3': 'pista de cálculo' }
- solution_steps: lista de 3 pasos de solución en LaTeX

RESPONDE EXCLUSIVAMENTE CON EL OBJETO JSON DEL EJERCICIO.
"""


class CurriculumGeneratorService:
    def __init__(self, db: Session):
        self.db = db
        self.config_service = ProviderConfigService(db)

    def _get_active_model(self) -> str:
        """Retrieves active model from AppConfig or defaults to gpt-4o-mini."""
        try:
            cfg = self.db.query(models.AppConfig).filter_by(key="socratic_tutor_model").first()
            if cfg and cfg.value:
                if isinstance(cfg.value, dict) and cfg.value.get("model"):
                    return cfg.value["model"]
                elif isinstance(cfg.value, str):
                    return cfg.value
        except Exception:
            pass
        return "gpt-4o-mini"

    def _is_modern(self, model: str) -> bool:
        m = (model or "").lower()
        return any(k in m for k in ["o1", "o3", "gpt-5", "gpt-6", "luna", "reasoning"])

    async def _call_llm(self, messages: List[Dict[str, Any]], max_tokens: Optional[int] = None) -> Optional[str]:
        """Calls OpenAI LLM with self-healing parameters and no token restrictions by default."""
        selected_model = self._get_active_model()
        oa_cfg = self.config_service.get_openai()
        if not oa_cfg.get("ENABLE_OPENAI_API"):
            return None

        urls = oa_cfg.get("OPENAI_API_BASE_URLS") or []
        keys = oa_cfg.get("OPENAI_API_KEYS") or []
        if not urls:
            return None

        url = urls[0].rstrip("/")
        key = keys[0] if keys else ""
        headers = {"Authorization": f"Bearer {key}"} if key else {}

        is_modern = self._is_modern(selected_model)
        use_max_completion = is_modern
        include_temp = not is_modern
        set_reasoning_effort_none = is_modern

        for attempt in range(3):
            payload: Dict[str, Any] = {
                "model": selected_model,
                "messages": messages,
            }
            if max_tokens is not None:
                if use_max_completion:
                    payload["max_completion_tokens"] = max_tokens
                else:
                    payload["max_tokens"] = max_tokens

            if include_temp:
                payload["temperature"] = 0.3

            if set_reasoning_effort_none:
                payload["reasoning_effort"] = "none"

            try:
                async with httpx.AsyncClient(timeout=120) as client:
                    resp = await client.post(f"{url}/chat/completions", json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        content = data["choices"][0]["message"].get("content")
                        return content

                    err_text = resp.text.lower()
                    if resp.status_code == 400:
                        if "max_tokens" in err_text:
                            use_max_completion = True
                            continue
                        if "reasoning_effort" in err_text:
                            set_reasoning_effort_none = True
                            continue
                        if "temperature" in err_text:
                            include_temp = False
                            continue
            except Exception as exc:
                log.warning("Curriculum Generator LLM call failed: %s", exc)

        return None

    def _extract_json(self, text: str) -> Optional[Dict[str, Any]]:
        """Extracts JSON object from response text with self-healing."""
        if not text:
            return None
        raw = text.strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)

        # 1. Direct load with strict=False
        try:
            return json.loads(raw.strip(), strict=False)
        except Exception:
            pass

        # 2. Extract outermost { ... }
        match = re.search(r"(\{.*\})", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1), strict=False)
            except Exception:
                pass

        # 3. Clean invalid LaTeX unescaped backslashes inside strings
        try:
            cleaned = re.sub(r'\\(?![/"\\bfnrtu])', r'\\\\', raw)
            return json.loads(cleaned, strict=False)
        except Exception:
            pass

        # 4. Truncation self-healing: close unclosed strings, arrays, objects
        try:
            first_brace = raw.find("{")
            if first_brace != -1:
                chunk = raw[first_brace:]
                in_quote = False
                escaped = False
                for ch in chunk:
                    if ch == '\\' and not escaped:
                        escaped = True
                        continue
                    if ch == '"' and not escaped:
                        in_quote = not in_quote
                    escaped = False
                if in_quote:
                    chunk += '"'
                open_braces = chunk.count("{") - chunk.count("}")
                open_brackets = chunk.count("[") - chunk.count("]")
                chunk += "]" * max(0, open_brackets)
                chunk += "}" * max(0, open_braces)
                return json.loads(chunk, strict=False)
        except Exception:
            pass

        return None

    async def generate_topic_content(
        self,
        topic_title: str,
        grade_name: str,
        unit_title: str,
        description: str,
        objectives: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Generates a complete pedagogical package for a new topic with interactive simulator integration."""
        simulator = resolve_simulator_for_topic(topic_title, unit_title, description)

        prompt = (
            f"Diseña el contenido pedagógico completo, interactivo y específico para el siguiente tema de matemática:\n"
            f"- Título del Tema: {topic_title}\n"
            f"- Grado / Nivel: {grade_name}\n"
            f"- Unidad Curricular: {unit_title}\n"
            f"- Descripción / Propósito: {description}\n"
            f"- Simulador Interactivo Asociado: {simulator['title']} ({simulator['type'].upper()})\n"
            f"  * URL del simulador: {simulator['url']}\n"
            f"  * Instrucción de manipulación: {simulator['instructions']}\n"
        )
        if objectives:
            prompt += f"- Objetivos de Aprendizaje: {', '.join(objectives)}\n"

        prompt += """
Genera el contenido estructurado en el siguiente formato JSON exacto.
REGLAS CRÍTICAS:
- CONECTA DEBE incluir "simulator_mission": una instrucción concreta y emocionante de qué parámetros mover en el simulador para poner a prueba su hipótesis inicial.
- COMPRENDE DEBE contener al menos 4 pasos analíticos y una demostración que vincule lo observado en el simulador con las fórmulas algebraicas/geométricas formales ($$...$$).
- RESUELVE DEBE incluir 4 ejercicios en progresión: 'basico', 'intermedio', 'avanzado' y 'desafio'.

{
  "conecta": {
    "problem_title": "Título cinematográfico del problema real",
    "hook_story": "Narrativa inmersiva con protagonistas y un dilema numérico concreto (2 párrafos)",
    "driving_question": "¿Pregunta detonante esencial?",
    "simulator_mission": "Misión interactiva específica a realizar en el simulador digital",
    "dimensions": { "param_1": "valor", "param_2": "valor" },
    "hypothesis_prompt": "Pregunta de intuición inicial para el estudiante",
    "svg_scene_type": "room | diagonal_bar | ramp | ladder | balance | graph | grid",
    "svg_scene_data": { "param_1": 6, "param_2": 8 }
  },
  "comprende": {
    "conceptual_bridge": "Puente conceptual que conecta la intuición del simulador con el modelo formal",
    "microcheck_questions": [
      {
        "id": "mc-1",
        "question": "Pregunta diagnóstica conceptual",
        "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
        "correct_index": 0,
        "rationale": "Justificación socrática del por qué"
      }
    ],
    "proof_title": "Título de la Demostración o Construcción del Modelo",
    "proof_steps": [
      {
        "step_number": 1,
        "title": "Paso 1: Identificación y variables",
        "description": "Explicación detallada del primer paso",
        "formula": "$$fórmula_en_latex$$"
      },
      {
        "step_number": 2,
        "title": "Paso 2: Relación estructural",
        "description": "Explicación de la descomposición o teorema",
        "formula": "$$fórmula_en_latex$$"
      },
      {
        "step_number": 3,
        "title": "Paso 3: Desarrollo algebraico",
        "description": "Paso clave de deducción",
        "formula": "$$fórmula_en_latex$$"
      },
      {
        "step_number": 4,
        "title": "Paso 4: Generalización y conclusión",
        "description": "Formalización general del modelo",
        "formula": "$$fórmula_en_latex$$"
      }
    ],
    "resolution": {
      "statement": "Retorno con solución al dilema planteado en CONECTA",
      "formula_applied": "$$fórmula$$",
      "calculation": "Cálculo formal con los datos del caso inicial",
      "conclusion": "Respuesta exacta y su significado práctico"
    }
  },
  "resuelve": {
    "exercises": [
      {
        "level": "basico",
        "title": "Ejercicio Básico de Aplicación Directa",
        "statement": "Enunciado con contexto y datos numéricos claros",
        "figure_type": "formula_direct | graph | diagram",
        "data_params": { "a": 3, "b": 4 },
        "correct_answer": "5",
        "acceptable_range": [4.9, 5.1],
        "unit": "unidades",
        "hints": {
          "level_1": "Pista conceptual guiada",
          "level_2": "Pista con fórmula aplicada",
          "level_3": "Pista de cálculo intermedio"
        },
        "solution_steps": ["Paso 1", "Paso 2", "Paso 3"]
      }
    ]
  },
  "microcompetencies": [
    { "code": "MC-01", "name": "Identificación y representación del modelo", "prerequisites": [] },
    { "code": "MC-02", "name": "Resolución analítica y cálculo formal", "prerequisites": ["MC-01"] }
  ]
}
"""
        messages = [
            {"role": "system", "content": CURRICULUM_AI_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        raw = await self._call_llm(messages)
        parsed = self._extract_json(raw) if raw else None
        if not parsed:
            parsed = self._generate_fallback_scaffold(topic_title, grade_name, unit_title, description)

        # Guarantee interactive simulator presence across all layers
        parsed["simulator"] = simulator
        if "conecta" in parsed and isinstance(parsed["conecta"], dict):
            parsed["conecta"]["simulator"] = simulator
            if "simulator_mission" not in parsed["conecta"]:
                parsed["conecta"]["simulator_mission"] = (
                    f"Explora en el {simulator['title']} manipulando los controles interactivos para observar cómo cambian los valores."
                )
        if "comprende" in parsed and isinstance(parsed["comprende"], dict):
            parsed["comprende"]["simulator"] = simulator

        return parsed

    async def refine_staged_content(
        self,
        current_content: Dict[str, Any],
        user_instruction: str = "",
        teacher_feedback: str = "",
        instruction: str = "",
    ) -> Dict[str, Any]:
        """Conversational refinement of staged topic content."""
        prompt_instruction = user_instruction or teacher_feedback or instruction or ""
        prompt = (
            f"El profesor gestor ha revisado el contenido pedagógico actual y solicita la siguiente modificación:\n"
            f"Instrucción del profesor: \"{prompt_instruction}\"\n\n"
            f"Contenido actual en JSON:\n{json.dumps(current_content, ensure_ascii=False, indent=2)}\n\n"
            f"Aplica las modificaciones solicitadas y responde ÚNICAMENTE con el objeto JSON actualizado completo."
        )

        messages = [
            {"role": "system", "content": CURRICULUM_AI_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        raw = await self._call_llm(messages)
        parsed = self._extract_json(raw) if raw else None
        if parsed:
            # Preserve or re-attach simulator if omitted in refinement response
            if "simulator" in current_content and "simulator" not in parsed:
                parsed["simulator"] = current_content["simulator"]
            return parsed
        return current_content

    async def generate_realtime_practice_exercise(
        self,
        topic_title: str,
        topic_code: str = "",
        level: str = "intermedio",
        microcompetencies: Optional[List[str]] = None,
        student_level: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generates an infinite real-time practice exercise for a mastered topic."""
        active_level = student_level or level
        prompt = (
            f"Genera un ejercicio NUEVO, ORIGINAL y NO REPETITIVO para el tema '{topic_title}' ({topic_code}).\n"
            f"Nivel solicitado: {level}.\n"
            f"Asegúrate de incluir valores numéricos coherentes, diagrama 2D (figure_type), pistas progresivas y solución paso a paso en LaTeX."
        )

        messages = [
            {"role": "system", "content": REALTIME_EXERCISE_PROMPT},
            {"role": "user", "content": prompt},
        ]

        raw = await self._call_llm(messages)
        parsed = self._extract_json(raw) if raw else None
        if not parsed:
            import random
            a = random.choice([3, 5, 6, 7, 8, 9, 12])
            b = random.choice([4, 12, 8, 24, 15, 12, 16])
            c = round((a**2 + b**2)**0.5, 2)
            parsed = {
                "id": f"realtime-{random.randint(1000, 9999)}",
                "title": f"Práctica Infinita: Cálculo en Contexto ({a} y {b} m)",
                "statement": f"En una estructura de soporte, un puntal tiene una base de {a} m y una altura de {b} m. ¿Cuál es la longitud del puntal?",
                "level": level,
                "figure_type": "diagonal_bar",
                "data_params": {"dx": a, "dy": b},
                "correct_answer": str(int(c) if c.is_integer() else c),
                "acceptable_range": [round(c - 0.1, 2), round(c + 0.1, 2)],
                "unit": "m",
                "hints": {
                  "level_1": "Identifica los dos lados conocidos que forman el ángulo de 90°.",
                  "level_2": f"Aplica la relación fundamental: c² = {a}² + {b}² = {a**2} + {b**2}.",
                  "level_3": f"Calcula la raíz cuadrada de {a**2 + b**2}: c = {c} m."
                },
                "solution_steps": [f"c^2 = {a}^2 + {b}^2", f"c^2 = {a**2 + b**2}", f"c = {c}\\text{{ m}}"]
            }

        return parsed

    def _generate_fallback_scaffold(self, title: str, grade: str, unit: str, description: str = "") -> Dict[str, Any]:
        """Provides a complete, rich, domain-specific pedagogical package if LLM is temporarily unreachable."""
        simulator = resolve_simulator_for_topic(title, unit, description)
        text_lower = f"{title} {unit} {description}".lower()

        # Domain 1: Álgebra / Factorización / Binomios / Polinomios
        if any(k in text_lower for k in ["factor", "binomio", "polinomio", "notable", "algebra", "trinomio", "cuadrado"]):
            return {
                "simulator": simulator,
                "conecta": {
                    "problem_title": f"Hitboxes Modulares en Videojuegos: {title}",
                    "hook_story": (
                        f"En el estudio de desarrollo de videojuegos 'Pixel Forge', Sofía está diseñando el campo de fuerza expansivo "
                        f"de un personaje para estudiantes de {grade}. El escudo es un cuadrado que se expande a razón de (x + 4) metros por lado. "
                        f"Para calcular las colisiones a 60 fotogramas por segundo, el motor no puede procesar la fórmula como un bloque opaco: "
                        f"necesita descomponer el área total $(x + 4)^2$ en subcomponentes de área más ligeros para el procesador gráfico."
                    ),
                    "driving_question": "¿Cómo podemos descomponer geométricamente el área de un cuadrado de lado $(x + 4)$ en piezas simples sin multiplicar a ciegas?",
                    "simulator_mission": (
                        "Abre el Simulador GeoGebra de Modelo de Áreas o el Lienzo Nativo. Configura la base en (x + 4) y la altura en (x + 4). "
                        "Observa los 4 rectángulos que se forman: ¿cuántos cuadrados de x² hay, cuántos rectángulos de 4x y cuál es el área de la esquina constante?"
                    ),
                    "dimensions": {"lado_base": "x + 4", "termino_independiente": 4},
                    "hypothesis_prompt": "Si expandes $(x + 4)^2$, ¿crees que el resultado es simplemente $x^2 + 16$ o aparece algún término adicional?",
                    "reveal_insight": "¡Aparece el doble producto! Al multiplicar $(x+4)(x+4)$ obtenemos $x^2 + 4x + 4x + 16 = x^2 + 8x + 16$. El término $8x$ representa los dos rectángulos laterales del modelo visual.",
                    "svg_scene_type": "grid",
                    "svg_scene_data": {"dx": 4, "dy": 4}
                },
                "comprende": {
                    "simulator": simulator,
                    "conceptual_bridge": "Del modelo visual de rectángulos al álgebra formal: la propiedad distributiva demostrada geométricamente.",
                    "microcheck_questions": [
                        {
                            "id": "mc-1",
                            "question": "¿Por qué $(x + 4)^2$ NO es igual a $x^2 + 16$?",
                            "options": [
                                "Porque faltan los dos rectángulos cruzados de área $4x$, sumando $8x$",
                                "Porque el exponente 2 solo multiplica al primer término",
                                "Porque 4 al cuadrado es 8 y no 16",
                                "Porque en álgebra los binomios no se pueden elevar al cuadrado"
                            ],
                            "correct_index": 0,
                            "rationale": "Al multiplicar $(x+4)(x+4)$, cada término del primer binomio multiplica a cada término del segundo: $x\\cdot x + x\\cdot 4 + 4\\cdot x + 4\\cdot 4 = x^2 + 8x + 16$."
                        },
                        {
                            "id": "mc-2",
                            "question": "En la diferencia de cuadrados $(a+b)(a-b)$, ¿qué sucede con los términos cruzados?",
                            "options": [
                                "Se cancelan mutuamente porque $+ab - ab = 0$",
                                "Se duplican generando $2ab$",
                                "Se convierten en números negativos siempre",
                                "Forman un trinomio cuadrado perfecto"
                            ],
                            "correct_index": 0,
                            "rationale": "El producto $(a+b)(a-b) = a^2 - ab + ab - b^2$. Los términos opuestos $-ab$ y $+ab$ suman 0, dejando únicamente $a^2 - b^2$."
                        }
                    ],
                    "proof_title": f"Demostración Geométrica y Algebraica: {title}",
                    "proof_steps": [
                        {
                            "step_number": 1,
                            "title": "Construcción Geométrica del Cuadrado",
                            "description": "Dibujamos un cuadrado de lado $(a + b)$. Su área total por definición geométrica es $(a + b)^2$.",
                            "formula": "$$Area_{Total} = (a + b)^2$$"
                        },
                        {
                            "step_number": 2,
                            "title": "Partición en Cuatro Sub-regiones",
                            "description": "Dividimos cada lado en dos segmentos de longitud $a$ y $b$. Esto genera 1 cuadrado de área $a^2$, 1 cuadrado de área $b^2$ y 2 rectángulos de área $ab$.",
                            "formula": "$$Area_{Total} = a^2 + ab + ab + b^2$$"
                        },
                        {
                            "step_number": 3,
                            "title": "Reducción de Términos Semejantes",
                            "description": "Sumamos las dos regiones rectangulares idénticas $ab + ab = 2ab$.",
                            "formula": "$$(a + b)^2 = a^2 + 2ab + b^2$$"
                        },
                        {
                            "step_number": 4,
                            "title": "Regla de Factorización Inversa",
                            "description": "Para factorizar un trinomio cuadrado perfecto de la forma $x^2 + 2kx + k^2$, extraemos la raíz del primer y tercer término: $(x + k)^2$.",
                            "formula": "$$x^2 + 2kx + k^2 \\iff (x + k)^2$$"
                        }
                    ],
                    "resolution": {
                        "statement": "Retorno al problema del escudo en el motor de videojuegos.",
                        "formula_applied": "$$(x + 4)^2 = x^2 + 2(x)(4) + 4^2$$",
                        "calculation": "x^2 + 8x + 16",
                        "conclusion": "El motor de físicas divide la colisión en tres rutinas: un núcleo cuadrático x², dos franjas de expansión 8x y un offset constante de 16 píxeles."
                    }
                },
                "resuelve": {
                    "exercises": [
                        {
                            "level": "basico",
                            "title": "Nivel 1: Cuadrado de Binomio Directo",
                            "statement": "Expande la expresión algebraica $(x + 6)^2$. ¿Cuál es el coeficiente numérico del término lineal (el que acompaña a $x$)?",
                            "figure_type": "formula_direct",
                            "data_params": {"a": 1, "b": 6},
                            "correct_answer": "12",
                            "acceptable_range": [11.9, 12.1],
                            "unit": "",
                            "hints": {
                                "level_1": "Aplica la fórmula $(x + a)^2 = x^2 + 2ax + a^2$.",
                                "level_2": "El término lineal es $2 \\cdot a \\cdot x = 2 \\cdot 6 \\cdot x = 12x$.",
                                "level_3": "El coeficiente es el número que acompaña a x, es decir, 12."
                            },
                            "solution_steps": [
                                "(x + 6)^2 = x^2 + 2(x)(6) + 6^2",
                                "= x^2 + 12x + 36",
                                "Coeficiente lineal = 12"
                            ]
                        },
                        {
                            "level": "intermedio",
                            "title": "Nivel 2: Diferencia de Cuadrados",
                            "statement": "Factoriza la expresión $x^2 - 49$. Si se factoriza como $(x + k)(x - k)$, ¿cuál es el valor de $k$?",
                            "figure_type": "formula_direct",
                            "data_params": {"c": 49},
                            "correct_answer": "7",
                            "acceptable_range": [6.9, 7.1],
                            "unit": "",
                            "hints": {
                                "level_1": "Recuerda que $a^2 - b^2 = (a + b)(a - b)$.",
                                "level_2": "Identifica qué número al cuadrado da 49: $k = \\sqrt{49}$.",
                                "level_3": "7 por 7 es 49, por tanto k = 7."
                            },
                            "solution_steps": [
                                "x^2 - 49 = x^2 - 7^2",
                                "= (x + 7)(x - 7)",
                                "k = 7"
                            ]
                        },
                        {
                            "level": "avanzado",
                            "title": "Nivel 3: Factorización de Trinomio de la Forma x² + bx + c",
                            "statement": "Encuentra el valor positivo de $m$ tal que $x^2 + 9x + 20 = (x + 4)(x + m)$.",
                            "figure_type": "formula_direct",
                            "data_params": {"b": 9, "c": 20},
                            "correct_answer": "5",
                            "acceptable_range": [4.9, 5.1],
                            "unit": "",
                            "hints": {
                                "level_1": "Buscamos dos números que multiplicados den 20 y sumados den 9.",
                                "level_2": "Si uno de los números es 4, calcula $20 \\div 4$.",
                                "level_3": "4 + 5 = 9 y 4 * 5 = 20, por lo que m = 5."
                            },
                            "solution_steps": [
                                "x^2 + 9x + 20 = (x + 4)(x + 5)",
                                "m = 5"
                            ]
                        },
                        {
                            "level": "desafio",
                            "title": "Nivel 4: Desafío de Modelación Geométrica",
                            "statement": "Un terreno rectangular tiene un área dada por $A = x^2 + 8x + 15$. Si su ancho mide $(x + 3)$ metros y evaluamos el terreno cuando $x = 10$ metros, ¿cuántos metros cuadrados mide el terreno?",
                            "figure_type": "diagram",
                            "data_params": {"x": 10},
                            "correct_answer": "195",
                            "acceptable_range": [194.9, 195.1],
                            "unit": "m²",
                            "hints": {
                                "level_1": "Sustituye $x = 10$ directamente en la expresión $x^2 + 8x + 15$.",
                                "level_2": "Calcula $10^2 + 8(10) + 15 = 100 + 80 + 15$.",
                                "level_3": "100 + 80 + 15 = 195 m²."
                            },
                            "solution_steps": [
                                "A(10) = 10^2 + 8(10) + 15",
                                "A(10) = 100 + 80 + 15",
                                "Área = 195 m²"
                            ]
                        }
                    ]
                },
                "microcompetencies": [
                    {"code": "MC-01", "name": f"Visualización geométrica y desarrollo de binomios ({title})", "prerequisites": []},
                    {"code": "MC-02", "name": f"Factorización y resolución de expresiones algebraicas ({title})", "prerequisites": ["MC-01"]}
                ]
            }

        # Domain 2: Geometría / Triángulos / Medición
        elif any(k in text_lower for k in ["pitagora", "triang", "angulo", "geometr", "medida", "distancia", "vector", "hipotenusa"]):
            return {
                "simulator": simulator,
                "conecta": {
                    "problem_title": f"Misión de Rescate de Montaña: {title}",
                    "hook_story": (
                        f"Un equipo de rescate alpino necesita instalar con urgencia una tirolina de evacuación médica entre un risco escarpado "
                        f"y la estación base en el valle para estudiantes de {grade}. El risco se eleva exactamente 30 metros en vertical sobre el nivel de la base, "
                        f"y la distancia horizontal medida por GPS hasta el anclaje seguro en tierra es de 40 metros. Si compran un cable demasiado corto, la camilla "
                        f"no llegará; si es demasiado largo, se combará peligrosamente contra las rocas."
                    ),
                    "driving_question": "¿Cómo podemos calcular con precisión milimétrica la longitud exacta del cable tensor sin tener que escalar y medir a tientas?",
                    "simulator_mission": (
                        "Abre el Simulador GeoGebra interactivo. Ajusta el cateto vertical a 30 y el cateto horizontal a 40. "
                        "Observa cómo se forma el triángulo rectángulo con ángulo recto de 90° y verifica la hipotenusa resultante."
                    ),
                    "dimensions": {"altura_risco": "30 m", "distancia_horizontal": "40 m"},
                    "hypothesis_prompt": "Con 30 m de altura y 40 m horizontales, ¿el cable medirá más de 40 m? ¿Podría medir simplemente 70 m (30+40)?",
                    "reveal_insight": "¡La línea recta diagonal es siempre más corta que la suma de los dos catetos! Por el Teorema de Pitágoras: √(30² + 40²) = √(900 + 1600) = √2500 = 50 metros exactos.",
                    "svg_scene_type": "ramp",
                    "svg_scene_data": {"dx": 40, "dy": 30}
                },
                "comprende": {
                    "simulator": simulator,
                    "conceptual_bridge": "El triángulo rectángulo como base de la geometría métrica euclidiana y el cálculo de distancias euclidianas.",
                    "microcheck_questions": [
                        {
                            "id": "mc-1",
                            "question": "¿Cuál es la condición INDISPENSABLE para aplicar el Teorema de Pitágoras?",
                            "options": [
                                "El triángulo debe tener un ángulo recto exacto de 90°",
                                "Todos los lados deben ser números enteros",
                                "El triángulo debe ser equilátero",
                                "La hipotenusa debe ser menor que los catetos"
                            ],
                            "correct_index": 0,
                            "rationale": "El Teorema de Pitágoras solo es válido en triángulos rectángulos (con un ángulo de 90°)."
                        }
                    ],
                    "proof_title": f"Fundamento Geométrico y Teorema: {title}",
                    "proof_steps": [
                        {"step_number": 1, "title": "Identificación de Catetos e Hipotenusa", "description": "Los catetos $a$ y $b$ forman el ángulo de 90°. La hipotenusa $c$ es el lado opuesto más largo.", "formula": "$$\\angle C = 90^\\circ$$"},
                        {"step_number": 2, "title": "Construcción de Cuadrados sobre los Lados", "description": "Construimos un cuadrado de lado $a$ (área $a^2$) y otro de lado $b$ (área $b^2$).", "formula": "$$Area_a = a^2, \\quad Area_b = b^2$$"},
                        {"step_number": 3, "title": "Conservación del Área", "description": "La suma de las áreas de los cuadrados sobre los catetos equivale exactamente al área del cuadrado sobre la hipotenusa.", "formula": "$$a^2 + b^2 = c^2$$"},
                        {"step_number": 4, "title": "Cálculo de la Distancia Directa", "description": "Extrayendo la raíz cuadrada obtenemos la longitud lineal de la hipotenusa.", "formula": "$$c = \\sqrt{a^2 + b^2}$$"}
                    ],
                    "resolution": {
                        "statement": "Retorno al cálculo del cable de rescate.",
                        "formula_applied": "$$c = \\sqrt{30^2 + 40^2}$$",
                        "calculation": "c = √(900 + 1600) = √2500 = 50 m",
                        "conclusion": "El equipo debe cortar un cable de exactamente 50 metros para garantizar la tensión óptima de evacuación."
                    }
                },
                "resuelve": {
                    "exercises": [
                        {
                            "level": "basico",
                            "title": "Nivel 1: Cálculo de Hipotenusa",
                            "statement": "Un triángulo rectángulo tiene catetos de 6 m y 8 m. ¿Cuál es la longitud de la hipotenusa en metros?",
                            "figure_type": "triangle_direct",
                            "data_params": {"a": 6, "b": 8},
                            "correct_answer": "10",
                            "acceptable_range": [9.9, 10.1],
                            "unit": "m",
                            "hints": {
                                "level_1": "Aplica $c = \\sqrt{a^2 + b^2}$.",
                                "level_2": "Calcula $6^2 + 8^2 = 36 + 64 = 100$.",
                                "level_3": "La raíz cuadrada de 100 es 10."
                            },
                            "solution_steps": ["c^2 = 6^2 + 8^2 = 36 + 64 = 100", "c = √100 = 10 m"]
                        }
                    ]
                },
                "microcompetencies": [
                    {"code": "MC-01", "name": f"Identificación y construcción geométrica ({title})", "prerequisites": []},
                    {"code": "MC-02", "name": f"Cálculo métrico y modelación en contexto ({title})", "prerequisites": ["MC-01"]}
                ]
            }

        # Domain 3: Fallback universal enriquecido
        return {
            "simulator": simulator,
            "conecta": {
                "problem_title": f"Dilema Tecnológico y Científico: {title}",
                "hook_story": (
                    f"En el centro de innovación y robótica educativa, un equipo de estudiantes de {grade} está diseñando un sistema automatizado. "
                    f"Para calibrar los sensores y garantizar el funcionamiento de la unidad {unit}, necesitan modelar numéricamente el comportamiento de {title}. "
                    f"Los datos experimentales muestran una variación crítica entre los parámetros iniciales de 12 y 4 unidades. "
                    f"¿Cómo formular un modelo analítico exacto para predecir los resultados futuros sin recurrir al ensayo y error?"
                ),
                "driving_question": f"¿Cómo podemos determinar la relación matemática exacta que rige los datos de {title}?",
                "simulator_mission": (
                    f"Ingresa al {simulator['title']}. Ajusta los parámetros interactivos para reproducir las condiciones del problema y "
                    f"observa la respuesta del sistema en tiempo real."
                ),
                "dimensions": {"parametro_alfa": 12, "parametro_beta": 4},
                "hypothesis_prompt": f"¿Qué relación numérica o funcional crees que existe entre los datos de {title}?",
                "reveal_insight": f"La formalización rigurosa de {title} nos permite transformar observaciones empíricas en predicciones deterministas con precisión matemática.",
                "svg_scene_type": "grid",
                "svg_scene_data": {"dx": 12, "dy": 4}
            },
            "comprende": {
                "simulator": simulator,
                "conceptual_bridge": f"Formalización matemática de los principios esenciales de {title} para pasar del problema visual al modelo analítico formal.",
                "microcheck_questions": [
                    {
                        "id": "mc-1",
                        "question": f"¿Cuál es el objetivo principal al aplicar los métodos de {title}?",
                        "options": [
                            f"Modelar y resolver situaciones específicas de {unit} con rigor",
                            "Memorizar cálculos aislados sin contexto real",
                            "Descartar las relaciones numéricas entre variables",
                            "Adivinar resultados por tanteo"
                        ],
                        "correct_index": 0,
                        "rationale": f"El propósito formativo de {title} es modelar y resolver con precisión problemas matemáticos de {unit}."
                    }
                ],
                "proof_title": f"Desarrollo Conceptual y Demostración: {title}",
                "proof_steps": [
                    {"step_number": 1, "title": "Definición y Variables del Sistema", "description": f"Identificación de los parámetros iniciales y restricciones para {title}.", "formula": "$$x, y \\in \\mathbb{R}$$"},
                    {"step_number": 2, "title": "Planteamiento de la Ecuación Fundamental", "description": f"Establecimiento de las relaciones funcionales de {unit}.", "formula": "$$f(x) = y$$"},
                    {"step_number": 3, "title": "Deducción Analítica", "description": "Aplicación de transformaciones algebraicas para despejar las variables clave.", "formula": "$$x = \\frac{y}{k}$$"},
                    {"step_number": 4, "title": "Validación en Contexto Real", "description": "Verificación empírica de que la solución matemática satisface las condiciones del problema.", "formula": "$$Comprobación\\; \\checkmark$$"}
                ],
                "resolution": {
                    "statement": f"Aplicación del modelo de {title} a la situación inicial de CONECTA.",
                    "formula_applied": "$$Resultado = \\frac{12}{4}$$",
                    "calculation": "12 / 4 = 3 unidades",
                    "conclusion": f"El valor encontrado satisface exactamente las restricciones del sistema analizado para {title}."
                }
            },
            "resuelve": {
                "exercises": [
                    {
                        "level": "basico",
                        "title": f"Nivel 1: Aplicación Fundamental de {title}",
                        "statement": f"Aplica los conceptos de {title} para determinar el valor resultante dados los parámetros 12 y 4.",
                        "figure_type": "formula_direct",
                        "data_params": {"a": 12, "b": 4},
                        "correct_answer": "3",
                        "acceptable_range": [2.9, 3.1],
                        "unit": "unidades",
                        "hints": {
                            "level_1": f"Recuerda la relación fundamental de {title}.",
                            "level_2": "Plantea la ecuación correspondiente con los datos conocidos.",
                            "level_3": "Realiza la operación aritmética final: 12 dividido entre 4."
                        },
                        "solution_steps": [
                            f"Identificar datos para {title}",
                            "Plantear relación matemática",
                            "Resultado final = 3 unidades"
                        ]
                    }
                ]
            },
            "microcompetencies": [
                {"code": "MC-01", "name": f"Comprensión y modelación conceptual ({title})", "prerequisites": []},
                {"code": "MC-02", "name": f"Resolución y validación matemática ({title})", "prerequisites": ["MC-01"]}
            ]
        }
