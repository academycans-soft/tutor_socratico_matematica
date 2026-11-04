"""Socratic Agent for interactive mathematical tutoring with real-time canvas control."""

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
import httpx
from sqlalchemy.orm import Session

from ai.providers.config_service import ProviderConfigService

log = logging.getLogger(__name__)

SOCRATIC_SYSTEM_PROMPT = """Eres el Tutor Socrático de Matemáticas de Open TutorAI, diseñado según la especificación pedagógica v2.4 (Diego Rodríguez y Gabriela Jácome).

TIENES CONTROL TOTAL Y DIRECTO DEL LIENZO ACTIVO DEL ESTUDIANTE:
El estudiante NO debe navegar menús ni buscar contenidos. Tú tienes las llaves del escenario dinámico.
Estás conectado en tiempo real a lo que el estudiante tiene proyectado en su pantalla en este preciso instante.
Si el estudiante tiene dudas visuales, pide ver una demostración, no entiende de dónde sale la fórmula o requiere observar un cateto/hipotenusa específico, DEBES invocar la herramienta `modificar_lienzo` para proyectarle la escena adecuada, cambiar el paso de la animación o iluminar el elemento visual en su pantalla.

TUS REGLAS INQUEBRANTABLES:
1. NUNCA des la respuesta numérica final ni resuelvas el ejercicio por el estudiante, sin importar cuánto insista.
2. Si el estudiante formula una pregunta o se equivoca, guía su razonamiento mediante preguntas socráticas cortas (máximo 2 párrafos) y pistas progresivas.
3. Categoriza internamente los errores del estudiante y guíalo en consecuencia:
   - Aritmético: por ejemplo, planteó bien 6² + 8² pero calculó 8² = 16 en lugar de 64. Concéntrate en ese cálculo específico, no le hagas repetir todo el tema.
   - Algebraico: por ejemplo, al despejar un cateto sumó en vez de restar (b² = c² + a² en vez de c² - a²).
   - De Modelación: por ejemplo, en un problema aplicado no reconoció cuál lado es la hipotenusa o confundió la profundidad con la longitud (como en el Desafío del Estanque).
   - Conceptual: por ejemplo, intentó aplicar Pitágoras a un triángulo que no tiene ángulo de 90°.
4. Si el estudiante dice "no entiendo" o pide ayuda, pregúntale qué datos identifica primero en el lienzo o qué lado forma la esquina de 90°, o proyéctale el recurso visual pertinente.
5. Emplea siempre formato matemático LaTeX delimitado con signos de dólar ($a^2 + b^2 = c^2$, $\\sqrt{100} = 10$).
6. Mantén un tono académico, motivador, empático y en español contemporáneo. Sé breve y estimulante.
7. Si tu motor no soporta ejecución nativa de herramientas, puedes incluir tu acción de control del lienzo en tu respuesta con el formato exacto: `[ACCION: {"accion": "resaltar_elemento", "elemento_a_resaltar": "pared_6m"}]` o `[ACCION: {"accion": "mostrar_paso_demostracion", "paso_demostracion": 3}]` o `[ACCION: {"accion": "cambiar_escena", "escena": "scene_3_proof"}]`.
8. REGLA FUNDAMENTAL DE ETAPAS (CERO RETROCESOS EN RESUELVE):
   - Cuando el estudiante se encuentre en la etapa RESUELVE resolviendo un problema práctico (`scene_5_exercise`):
     ¡ESTÁ ESTRICTAMENTE PROHIBIDO usar `cambiar_escena` para regresar a `COMPRENDE` o a `scene_3_proof` a menos que el alumno te pida explícitamente "regresar a la demostración teórica" o "volver a comprende"!
   - Si el estudiante te dice: "¿puedes mostrar gráficamente este problema?", "cómo se ve", "dibújalo", "hazme un gráfico de este problema":
     ¡NO LO CAMBIES DE ESCENA! El lienzo del ejercicio en RESUELVE YA TIENE su propio diagrama geométrico 2D interactivo con los datos del problema (cateto horizontal, cateto vertical e hipotenusa).
     Responde socráticamente describiendo ese diagrama del ejercicio: por ejemplo, "Fíjate en el diagrama que tienes en pantalla: la separación horizontal y la vertical forman los dos catetos en ángulo recto, y la barra diagonal une ambos puntos como la hipotenusa. ¿Cuál lado está opuesto al ángulo de 90°?".
     Invoca `modificar_lienzo` con `resaltar_elemento` ('cateto_a', 'cateto_b', 'hipotenusa_c', 'angulo_recto' o 'diagrama') para iluminar la figura en su pantalla.
"""

CANVAS_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "modificar_lienzo",
            "description": (
                "Modifica o proyecta dinámicamente un recurso, escena o elemento en el Lienzo Activo "
                "del estudiante para ilustrar una explicación socrática."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "accion": {
                        "type": "string",
                        "enum": [
                            "cambiar_escena",
                            "resaltar_elemento",
                            "mostrar_paso_demostracion",
                            "mostrar_pista",
                            "abrir_simulador",
                            "ajustar_parametro_simulador",
                        ],
                        "description": "Tipo de acción a realizar sobre el lienzo dinámico",
                    },
                    "etapa": {
                        "type": "string",
                        "enum": ["CONECTA", "COMPRENDE", "RESUELVE"],
                        "description": "Etapa pedagógica hacia la cual mover el lienzo",
                    },
                    "escena": {
                        "type": "string",
                        "enum": [
                            "scene_0_intro",
                            "scene_1_room",
                            "scene_1_diagonal_reveal",
                            "scene_2_entry",
                            "scene_2_microcheck",
                            "scene_3_proof",
                            "scene_4_room_resolution",
                            "scene_5_exercise",
                        ],
                        "description": "Escena específica a proyectar en el lienzo",
                    },
                    "elemento_a_resaltar": {
                        "type": "string",
                        "description": "Elemento visual que el tutor desea iluminar o resaltar en el lienzo (ej. 'simulador', 'mision_simulador', 'hipotesis', 'paso_demostracion', 'formula', 'cateto_a', 'cateto_b', 'hipotenusa_c')",
                    },
                    "paso_demostracion": {
                        "type": "integer",
                        "description": "Si la escena es la demostración geométrica o conceptual, número de paso a proyectar",
                    },
                    "parametros_simulador": {
                        "type": "object",
                        "description": "Parámetros o variables que el tutor sugiere manipular en el simulador digital",
                    },
                },
                "required": ["accion"],
            },
        },
    }
]


def _build_stage_and_scene_context(
    stage: str,
    scene: str,
    level: str,
    proof_step: int,
    exercise: Optional[Dict[str, Any]],
    recent_error: Optional[str],
    highlighted_element: Optional[str] = None,
    topic_data: Optional[Dict[str, Any]] = None,
) -> str:
    """Generates an exhaustive, high-resolution context prompt describing the exact active visual state."""
    scene_normalized = scene
    if "scene_3" in scene:
        scene_normalized = "scene_3_proof"
    elif "scene_4" in scene:
        scene_normalized = "scene_4_room_resolution"
    elif "scene_2_comprende_entry" in scene or "scene_2_entry" in scene:
        scene_normalized = "scene_2_entry"

    desc = [
        f"\n--- ESTADO DEL LIENZO ACTIVO FRENTE AL ESTUDIANTE ---",
        f"- Etapa Pedagógica: {stage}",
        f"- Escena Activa: {scene}",
        f"- Nivel de Dificultad: {level}",
    ]

    if topic_data and topic_data.get("code") != "MATH-PITAGORAS":
        staged = topic_data.get("staged_content") or {}
        conecta = staged.get("conecta") or {}
        comprende = staged.get("comprende") or {}
        resuelve = staged.get("resuelve") or {}
        simulator = staged.get("simulator") or conecta.get("simulator") or comprende.get("simulator")

        desc.append(f"- Tema Curricular Activo: {topic_data.get('title')}")
        if topic_data.get("subtitle"):
            desc.append(f"- Subtítulo / Problema detonante: {topic_data.get('subtitle')}")
        if highlighted_element:
            desc.append(f"- Elemento visual resaltado en el lienzo: {highlighted_element}")
        if recent_error:
            desc.append(f"- ALERTA PEDAGÓGICA (Error reciente del alumno): {recent_error}")

        if simulator:
            desc.append(
                f"\n--- SIMULADOR INTERACTIVO ACTIVO (GeoGebra / Lienzo Nativo del Sistema) ---\n"
                f"- Título del Simulador: {simulator.get('title')}\n"
                f"- Tipo de Motor: {simulator.get('type')}\n"
                f"- Instrucción de Manipulación: {simulator.get('instructions')}\n"
                f"REGLA DE MEDIACIÓN CON EL SIMULADOR:\n"
                f"El estudiante tiene incrustado un laboratorio interactivo en su pantalla. Puedes sugerirle mover controles específicos "
                f"o invocar la herramienta `modificar_lienzo` con `accion: 'abrir_simulador'` o `accion: 'resaltar_elemento', elemento_a_resaltar: 'simulador'` "
                f"para centrar su atención en la experimentación visual."
            )

        desc.append("\nDESCRIPCIÓN DE LO QUE EL ESTUDIANTE TIENE EN SU LIENZO:")
        if stage == "CONECTA":
            desc.append(f"El estudiante está en la etapa CONECTA analizando el caso introductorio de '{topic_data.get('title')}'.")
            if conecta.get("problem_title"):
                desc.append(f"  * Situación / Título: {conecta.get('problem_title')}")
            if conecta.get("hook_story") or conecta.get("context_story"):
                desc.append(f"  * Historia y contexto real: {conecta.get('hook_story') or conecta.get('context_story')}")
            if conecta.get("simulator_mission"):
                desc.append(f"  * Misión en el Simulador: {conecta.get('simulator_mission')}")
            if conecta.get("driving_question"):
                desc.append(f"  * Pregunta detonante: {conecta.get('driving_question')}")
            if conecta.get("reveal_insight"):
                desc.append(f"  * Hallazgo / Insight pedagógico: {conecta.get('reveal_insight')}")
            desc.append("Acompaña al estudiante con preguntas socráticas para motivar su hipótesis y la exploración en el simulador sin revelarle la respuesta.")
        elif stage == "COMPRENDE":
            desc.append(f"El estudiante está en la etapa COMPRENDE aprendiendo los fundamentos de '{topic_data.get('title')}'.")
            if comprende.get("conceptual_bridge") or comprende.get("conceptual_core"):
                desc.append(f"  * Fundamento conceptual: {comprende.get('conceptual_bridge') or comprende.get('conceptual_core')}")
            proof_steps = comprende.get("proof_steps") or []
            if proof_steps:
                desc.append(f"  * Pasos analíticos de demostración ({len(proof_steps)} pasos):")
                for ps in proof_steps:
                    desc.append(f"    - Paso {ps.get('step_number', '')}: {ps.get('title', '')} -> {ps.get('description') or ps.get('explanation', '')}")
            microchecks = comprende.get("microcheck_questions") or comprende.get("microchecks") or []
            if microchecks:
                desc.append(f"  * Micro-comprobaciones diagnósticas: {len(microchecks)} preguntas.")
            desc.append("Resuelve dudas conceptuales conectando la demostración formal con la manipulación del simulador.")
        elif stage == "RESUELVE":
            desc.append(f"El estudiante está en la etapa RESUELVE resolviendo ejercicios prácticos de '{topic_data.get('title')}'.")
            if exercise:
                desc.append(f"  * Título del ejercicio: {exercise.get('title')}")
                desc.append(f"  * Enunciado: {exercise.get('statement')}")
                if exercise.get("hints"):
                    desc.append(f"  * Pistas pedagógicas disponibles: {exercise.get('hints')}")
            else:
                exs = resuelve.get("exercises") or []
                if exs:
                    desc.append(f"  * Banco de ejercicios: {len(exs)} problemas generados por IA.")
            desc.append("PROHIBIDO dar el resultado directo. Proporciona pistas socráticas guiadas.")
        return "\n".join(desc)

    if highlighted_element:
        desc.append(f"- Elemento visual que está palpitando en color dorado en el lienzo: {highlighted_element}")

    if recent_error:
        desc.append(f"- ALERTA PEDAGÓGICA (Error reciente del alumno): {recent_error}")

    desc.append("\nDESCRIPCIÓN DETALLADA DE LO QUE EL ESTUDIANTE VE EN ESTE MOMENTO EN SU PANTALLA:")

    if scene_normalized == "scene_0_intro":
        desc.append(
            "El estudiante se encuentra en la tarjeta inicial de bienvenida. "
            "Se presenta a Pitágoras de Samos y la pregunta detonante de la vida real: "
            "'¿Cómo saber con exactitud si dos paredes forman un ángulo recto sin usar un transportador?'. "
            "Invítalo a pulsar 'Comenzar Recorrido' para entrar a la habitación descuadrada."
        )
    elif scene_normalized == "scene_1_room":
        desc.append(
            "El estudiante ve el plano cenital (gráfico SVG 2D) de una habitación con dos paredes perpendiculares:\n"
            "  * Pared vertical izquierda: mide exactamente 6 m (etiqueta '6 m').\n"
            "  * Pared horizontal inferior: mide exactamente 8 m (etiqueta '8 m').\n"
            "  * Esquina entre ambas paredes: tiene un marcador rojo discontinuo con la duda '¿90°?'.\n"
            "  * Suelo: patrón de baldosas desalineadas (rotadas 2.5°) que no encajan entre sí.\n"
            "  * Pregunta en pantalla: ¿Cómo podríamos comprobar si las paredes forman un ángulo de 90° usando solo mediciones de longitud en el piso?\n"
            "  * Puedes invocar `modificar_lienzo` con `resaltar_elemento` para iluminar 'pared_6m', 'pared_8m' o 'angulo_recto', "
            "o revelar la diagonal con 'diagonal_real'."
        )
    elif scene_normalized == "scene_1_diagonal_reveal":
        desc.append(
            "El estudiante ve el plano de la habitación donde se ha trazado la diagonal entre los extremos de las paredes:\n"
            "  * Pared vertical: 6 m.\n"
            "  * Pared horizontal: 8 m.\n"
            "  * Línea diagonal medida en el piso: mide 10,18 m (etiqueta 'Diagonal: 10,18 m').\n"
            "  * Pregunta detonante: 'Si las paredes formaran exactamente 90°, ¿cuánto debería medir esa diagonal?'.\n"
            "  * Tú sabes que si el ángulo fuera recto de 90°, por el Teorema de Pitágoras la diagonal debería medir √(6² + 8²) = √(36 + 64) = √100 = 10,00 m exactos. "
            "Como mide 10,18 m, ¡las paredes están torcidas y descuadradas! Guía socráticamente al estudiante a reflexionar sobre esta discrepancia."
        )
    elif scene_normalized == "scene_2_entry":
        desc.append(
            "El estudiante ve la transición a la etapa COMPRENDE. Se muestran ternas pitagóricas conocidas en tarjetas interactivas "
            "(3-4-5, 6-8-10, 5-12-13) y la relación entre lados enteros. Hay un botón para realizar el micro-chequeo diagnóstico "
            "antes de pasar a la demostración visual formal."
        )
    elif scene_normalized == "scene_2_microcheck":
        desc.append(
            "El estudiante está resolviendo el micro-chequeo conceptual interactivo con 3 preguntas:\n"
            "  1. ¿En qué tipo de triángulo se puede aplicar el Teorema de Pitágoras? (Solo en triángulos rectángulos con ángulo de 90°).\n"
            "  2. ¿Cuál es el lado opuesto al ángulo de 90°? (La hipotenusa, que siempre es el lado de mayor longitud).\n"
            "  3. Si los catetos miden 3 y 4, ¿la hipotenusa puede medir 4 o menos? (No, debe ser estrictamente mayor a 4).\n"
            "Si el estudiante tiene dudas, no le des las opciones directamente; pregúntale por la definición geométrica de triángulo rectángulo y catetos."
        )
    elif scene_normalized == "scene_3_proof":
        desc.append(
            f"El estudiante está interactuando con la Demostración Geométrica Dinámica de Bhaskara. Paso actual en pantalla: {proof_step} de 5.\n"
            "  * Paso 1: Triángulo rectángulo base con catetos 'a' (amarillo) y 'b' (azul) e hipotenusa 'c' (verde).\n"
            "  * Paso 2: 4 triángulos congruentes rotados formando un gran cuadrado exterior, dejando un cuadrado central inclinado de lado 'c'.\n"
            "  * Paso 3: El cuadrado exterior tiene lado (a + b). Su área total es A = (a + b)² = a² + 2ab + b².\n"
            "  * Paso 4: La misma área descompuesta en 5 piezas: 4 triángulos (4 * ab/2 = 2ab) + el cuadrado central (c²). Es decir: A = 2ab + c².\n"
            "  * Paso 5: Al igualar ambas expresiones: a² + 2ab + b² = 2ab + c². Restando 2ab a ambos lados, queda demostrado que a² + b² = c².\n"
            "  * PUEDES CONTROLAR LA DEMOSTRACIÓN: invoca `modificar_lienzo` con `mostrar_paso_demostracion` (1 al 5) o `resaltar_elemento` "
            "('cuadrado_central', 'triangulos', 'cateto_a', 'cateto_b', 'hipotenusa_c') para acompañar tu explicación visual."
        )
    elif scene_normalized == "scene_4_room_resolution":
        desc.append(
            "El estudiante regresó al caso de la habitación con la fórmula ya deducida. El lienzo muestra el cálculo formal:\n"
            "  c = √(6² + 8²) = √(36 + 64) = √100 = 10,00 m.\n"
            "  Al comparar 10,00 m (teórico para 90°) con 10,18 m (medición real en el piso), se confirma que las paredes NO están a escuadra. "
            "El estudiante tiene disponible el botón para pasar a la práctica adaptativa en RESUELVE."
        )
    elif scene_normalized == "scene_5_exercise":
        desc.append(
            f"El estudiante está resolviendo un ejercicio de práctica en la etapa RESUELVE.\n"
            f"- Nivel de dominio: {level}\n"
        )
        if exercise:
            desc.append(
                f"- Título del ejercicio: {exercise.get('title')}\n"
                f"- Enunciado en pantalla: {exercise.get('statement')}\n"
                f"- Tipo de diagrama geométrico en pantalla: {exercise.get('figure_type')}\n"
                f"- Medidas y parámetros del diagrama: {exercise.get('data_params')}\n"
                f"- Unidad de medida: {exercise.get('unit', '')}\n"
                f"- Pistas configuradas: {exercise.get('hints')}\n"
            )
        desc.append(
            "¡ATENCIÓN! EL ESTUDIANTE YA TIENE PROYECTADO UN DIAGRAMA GEOMÉTRICO 2D INTERACTIVO DE ESTE PROBLEMA EN SU PANTALLA.\n"
            "Si el estudiante pide: '¿puedes mostrarme gráficamente cómo se ve?', 'hazme un dibujo', 'dibújalo', o pregunta por la figura:\n"
            "1. NO uses `cambiar_escena` hacia la demostración geométrica (`scene_3_proof`) ni hacia COMPRENDE. El estudiante debe permanecer en RESUELVE.\n"
            "2. Describe el diagrama del problema en pantalla: explica qué medida es el cateto horizontal (base), cuál es el cateto vertical (altura), y cómo la hipotenusa es la diagonal (barra o escalera) opuesta al ángulo de 90°.\n"
            "3. Utiliza la acción `resaltar_elemento` con 'cateto_a', 'cateto_b', 'hipotenusa_c', 'angulo_recto' o 'diagrama' para iluminar la figura en su pantalla.\n"
            "4. NUNCA des el resultado numérico final. Guíalo preguntándole qué datos identifica en el diagrama y si la incógnita que busca es la hipotenusa o un cateto."
        )

    return "\n".join(desc)


class SocraticAgent:
    def __init__(self, db: Session):
        self.db = db
        self.config_service = ProviderConfigService(db)

    def _is_modern_or_reasoning_model(self, model_name: str) -> bool:
        """Identifies models that use max_completion_tokens and do not support legacy max_tokens or temperature."""
        m = (model_name or "").lower()
        return any(
            token in m
            for token in [
                "o1",
                "o3",
                "gpt-5",
                "gpt-6",
                "luna",
                "reasoning",
                "preview",
            ]
        )

    async def _post_chat_completion(
        self,
        client: httpx.AsyncClient,
        url: str,
        headers: Dict[str, str],
        model: str,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        max_tokens_val: Optional[int] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Executes a chat completion call with automatic parameter adaptation and self-healing retries on 400."""
        is_modern = self._is_modern_or_reasoning_model(model)
        use_max_completion = is_modern
        include_temp = not is_modern
        set_reasoning_effort_none = is_modern
        include_tools = bool(tools)

        for attempt in range(4):
            payload: Dict[str, Any] = {
                "model": model,
                "messages": messages,
            }

            if max_tokens_val is not None:
                if use_max_completion:
                    payload["max_completion_tokens"] = max_tokens_val
                else:
                    payload["max_tokens"] = max_tokens_val

            if include_temp:
                payload["temperature"] = 0.35

            if set_reasoning_effort_none:
                payload["reasoning_effort"] = "none"

            if include_tools and tools:
                payload["tools"] = tools
                payload["tool_choice"] = "auto"

            try:
                resp = await client.post(
                    f"{url}/chat/completions",
                    json=payload,
                    headers=headers,
                )
            except Exception as exc:
                log.warning("HTTP connection error to LLM: %s", exc)
                return None, str(exc)

            if resp.status_code == 200:
                data = resp.json()
                choice = data["choices"][0]["message"]
                return choice, None

            err_text = resp.text.lower()
            log.warning(
                "OpenAI LLM attempt %d status %d for model '%s': %s",
                attempt + 1,
                resp.status_code,
                model,
                resp.text,
            )

            # Self-healing parameter adjustment for status 400
            if resp.status_code == 400:
                # 1. max_tokens vs max_completion_tokens mismatch
                if "max_tokens" in err_text and ("max_completion_tokens" in err_text or "unsupported" in err_text):
                    use_max_completion = True
                    continue
                if "max_completion_tokens" in err_text and "max_tokens" in err_text:
                    use_max_completion = False
                    continue

                # 2. reasoning_effort requirement
                if "reasoning_effort" in err_text:
                    set_reasoning_effort_none = True
                    continue

                # 3. temperature unsupported
                if "temperature" in err_text and ("unsupported" in err_text or "not supported" in err_text):
                    include_temp = False
                    continue

                # 4. tools / functions unsupported
                if ("tools" in err_text or "function" in err_text) and (
                    "unsupported" in err_text or "not supported" in err_text
                ):
                    include_tools = False
                    continue

            return None, resp.text

        return None, "Max retries exceeded"

    async def _call_llm(
        self, messages: List[Dict[str, Any]]
    ) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        """Calls the configured LLM provider with tools support and active canvas control.

        Returns (reply_text, action_dict).
        """
        # Determine active model configured in database
        selected_model = "gpt-4o-mini"
        try:
            from data.models import AppConfig
            cfg = self.db.query(AppConfig).filter_by(key="socratic_tutor_model").first()
            if cfg and cfg.value:
                if isinstance(cfg.value, dict) and cfg.value.get("model"):
                    selected_model = cfg.value["model"]
                elif isinstance(cfg.value, str):
                    selected_model = cfg.value
        except Exception:
            pass

        # 1. Try OpenAI-compatible provider
        try:
            oa_cfg = self.config_service.get_openai()
        except Exception:
            oa_cfg = {}
        if oa_cfg.get("ENABLE_OPENAI_API"):
            urls: list = oa_cfg.get("OPENAI_API_BASE_URLS") or []
            keys: list = oa_cfg.get("OPENAI_API_KEYS") or []
            if urls:
                url = urls[0].rstrip("/")
                key = keys[0] if keys else ""
                headers = {"Authorization": f"Bearer {key}"} if key else {}
                try:
                    async with httpx.AsyncClient(timeout=30) as client:
                        choice, err = await self._post_chat_completion(
                            client=client,
                            url=url,
                            headers=headers,
                            model=selected_model,
                            messages=messages,
                            tools=CANVAS_TOOLS,
                        )

                        if choice:
                            action = None
                            reply = choice.get("content") or ""

                            # Check for native function tool calls
                            if choice.get("tool_calls"):
                                tc = choice["tool_calls"][0]
                                try:
                                    action = json.loads(tc["function"]["arguments"])
                                except Exception:
                                    action = None

                                # Follow-up turn with tool result using selected_model
                                messages.append(choice)
                                messages.append(
                                    {
                                        "role": "tool",
                                        "tool_call_id": tc["id"],
                                        "content": json.dumps(
                                            {"status": "ok", "lienzo_actualizado": True}
                                        ),
                                    }
                                )
                                choice2, _ = await self._post_chat_completion(
                                    client=client,
                                    url=url,
                                    headers=headers,
                                    model=selected_model,
                                    messages=messages,
                                    tools=None,
                                )
                                if choice2 and choice2.get("content"):
                                    reply = choice2["content"]

                            # Fallback: check if the model embedded [ACCION: {...}] in plain text
                            if not action and ("[ACCION:" in reply or "[ACTION:" in reply):
                                match = re.search(r"\[(?:ACCION|ACTION):\s*(\{.*?\})\s*\]", reply, re.DOTALL)
                                if match:
                                    try:
                                        action = json.loads(match.group(1))
                                        reply = reply.replace(match.group(0), "").strip()
                                    except Exception:
                                        pass

                            return (reply.strip() if reply else None, action)
                        else:
                            log.warning("OpenAI LLM call returned no choice: %s", err)
                except Exception as exc:
                    log.warning("OpenAI LLM request failed: %s", exc)

        # 2. Try Ollama provider if enabled
        try:
            ol_cfg = self.config_service.get_ollama()
        except Exception:
            ol_cfg = {}
        if ol_cfg.get("ENABLE_OLLAMA_API"):
            urls = ol_cfg.get("OLLAMA_BASE_URLS") or []
            if urls:
                url = urls[0].rstrip("/")
                try:
                    async with httpx.AsyncClient(timeout=25) as client:
                        resp = await client.post(
                            f"{url}/v1/chat/completions",
                            json={
                                "model": "llama3",
                                "messages": messages,
                                "temperature": 0.35,
                            },
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            content = data["choices"][0]["message"]["content"]
                            return (content.strip(), None)
                        else:
                            log.warning("Ollama LLM status %s: %s", resp.status_code, resp.text)
                except Exception as exc:
                    log.warning("Ollama LLM request failed: %s", exc)

        return (None, None)

    async def chat_socratic(
        self,
        user_id: str,
        topic_code: str,
        message: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Generates a socratic tutor response with active stage awareness and control."""
        context = context or {}
        stage = context.get("active_stage", "CONECTA")
        scene = context.get("active_scene", "scene_0_intro")
        level = context.get("current_level", "basico")
        recent_error = context.get("recent_error")
        exercise = context.get("exercise")
        proof_step = context.get("proof_step", 1)
        highlighted_element = context.get("highlighted_element")

        topic_data = None
        if topic_code:
            try:
                from data import models
                topic = self.db.query(models.CurriculumTopic).filter_by(code=topic_code).first()
                if topic:
                    topic_data = topic.to_dict()
            except Exception as exc:
                log.warning("Could not fetch topic %s: %s", topic_code, exc)

        scene_context = _build_stage_and_scene_context(
            stage=stage,
            scene=scene,
            level=level,
            proof_step=proof_step,
            exercise=exercise,
            recent_error=recent_error,
            highlighted_element=highlighted_element,
            topic_data=topic_data,
        )

        system_instruction = SOCRATIC_SYSTEM_PROMPT + "\n\n" + scene_context

        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": system_instruction}
        ]

        history = context.get("history")
        if isinstance(history, list):
            for h in history[-6:]:
                role = "user" if h.get("role") in ["user", "student"] else "assistant"
                content = h.get("content") or h.get("text") or ""
                if content:
                    messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": message})

        # Call configured LLM with tool support and self-healing parameter adaptation
        reply, action = await self._call_llm(messages)

        if not reply:
            reply = self._generate_rule_based_fallback(stage, scene, level, message, recent_error)

        # GUARD RAIL: When student is practicing in RESUELVE, prevent accidental regression to COMPRENDE
        if stage == "RESUELVE" and action and action.get("accion") == "cambiar_escena":
            target_esc = action.get("escena", "")
            msg_l = message.lower()
            explicit_return = any(
                w in msg_l
                for w in [
                    "volver a la demostracion",
                    "ir a comprende",
                    "regresar a comprende",
                    "volver a comprende",
                    "explicame la teoria",
                    "teoria general",
                ]
            )
            if not explicit_return and (
                "scene_3" in target_esc or "scene_2" in target_esc or "scene_1" in target_esc
            ):
                log.info("Intercepted accidental scene regression in RESUELVE: staying in scene_5_exercise")
                action = {"accion": "resaltar_elemento", "elemento_a_resaltar": "diagrama"}

        # If action transitions stage or scene, reflect in output
        target_stage = (action.get("etapa") if action else None) or stage
        target_scene = (action.get("escena") if action else None) or scene

        return {
            "reply": reply,
            "stage": target_stage,
            "scene": target_scene,
            "action": action,
        }

    def _generate_rule_based_fallback(
        self, stage: str, scene: str, level: str, message: str, recent_error: Optional[str]
    ) -> str:
        msg_lower = message.lower()
        if "resultado" in msg_lower or "respuesta" in msg_lower or "dame la solucion" in msg_lower:
            return (
                "Como tutor socrático, no puedo darte la respuesta directa. "
                "Mi meta es que descubras el camino por ti mismo. "
                "Observa los datos que tienes: ¿cuál es el ángulo recto y cuáles son los lados que forman la $L$?"
            )
        if "pista" in msg_lower or "ayuda" in msg_lower or "no se" in msg_lower or "no entiendo" in msg_lower:
            if stage == "RESUELVE":
                return (
                    "¡Vamos paso a paso! Recuerda la relación fundamental del teorema: "
                    "$c^2 = a^2 + b^2$.\n\n"
                    "1. Identifica primero si lo que buscas es la hipotenusa (el lado más largo) o uno de los catetos.\n"
                    "2. Eleva al cuadrado los valores que conoces.\n"
                    "¿Cuánto te da el cuadrado del primer lado?"
                )
            elif stage == "CONECTA":
                return (
                    "Fíjate en las dos paredes de la habitación: miden 6 m y 8 m. "
                    "Si no tenemos un transportador de ángulos, ¿qué distancia podríamos medir en el piso "
                    "para comprobar si las paredes forman una esquina perfectamente cuadrada?"
                )
            else:
                return (
                    "Observa la animación en el lienzo: tenemos 4 triángulos rectángulos idénticos. "
                    "Al reordenarlos, ¿qué figura geométrica se forma en el centro?"
                )

        return (
            "Comprendo tu punto. Analicemos lo que tenemos en el escenario: "
            "¿qué relación observas entre las longitudes dadas y el área que encierran?"
        )

    async def generate_proactive_intervention(
        self,
        user_id: str,
        topic_code: str,
        event_type: str,
        event_payload: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Generates a proactive Socratic intervention when an action or state change occurs in the student canvas."""
        context = context or {}
        stage = context.get("active_stage", "CONECTA")
        scene = context.get("active_scene", "scene_0_intro")
        level = context.get("current_level", "basico")
        recent_error = context.get("recent_error")
        exercise = context.get("exercise")
        proof_step = context.get("proof_step", 1)
        highlighted_element = context.get("highlighted_element")

        topic_data = None
        if topic_code:
            try:
                from data import models
                topic = self.db.query(models.CurriculumTopic).filter_by(code=topic_code).first()
                if topic:
                    topic_data = topic.to_dict()
            except Exception as exc:
                log.warning("Could not fetch topic %s: %s", topic_code, exc)

        scene_context = _build_stage_and_scene_context(
            stage=stage,
            scene=scene,
            level=level,
            proof_step=proof_step,
            exercise=exercise,
            recent_error=recent_error,
            highlighted_element=highlighted_element,
            topic_data=topic_data,
        )

        proactive_instruction = self._build_proactive_instruction(
            event_type=event_type,
            payload=event_payload,
            stage=stage,
            scene=scene,
            topic_data=topic_data,
            exercise=exercise,
        )

        system_instruction = (
            SOCRATIC_SYSTEM_PROMPT
            + "\n\n"
            + scene_context
            + "\n\n"
            + "=== DIRECTIVA DE INTERVENCIÓN PROACTIVA ===\n"
            + "Has detectado un evento interactivo del estudiante en su lienzo en tiempo real.\n"
            + proactive_instruction
            + "\nREGLAS DE INTERVENCIÓN:\n"
            + "1. Sé breve, empático y socrático (1 a 2 párrafos concisos como máximo).\n"
            + "2. Utiliza formato matemático LaTeX delimitado con signos de dólar ($a^2+b^2=c^2$).\n"
            + "3. Si es conveniente que el estudiante enfoque su mirada en un elemento del lienzo, invoca la herramienta `modificar_lienzo`."
        )

        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": system_instruction},
            {
                "role": "user",
                "content": f"[EVENTO DEL LIENZO]: {event_type} con datos: {json.dumps(event_payload, ensure_ascii=False)}",
            },
        ]

        reply, action = await self._call_llm(messages)

        if not reply:
            reply, action = self._generate_rule_based_proactive_fallback(
                event_type=event_type,
                payload=event_payload,
                stage=stage,
                scene=scene,
                topic_data=topic_data,
                exercise=exercise,
            )

        suggested_prompts = self._generate_proactive_suggested_prompts(event_type, event_payload)

        target_stage = (action.get("etapa") if action else None) or stage
        target_scene = (action.get("escena") if action else None) or scene

        return {
            "reply": reply,
            "stage": target_stage,
            "scene": target_scene,
            "action": action,
            "suggested_prompts": suggested_prompts,
        }

    def _build_proactive_instruction(
        self,
        event_type: str,
        payload: Dict[str, Any],
        stage: str,
        scene: str,
        topic_data: Optional[Dict[str, Any]],
        exercise: Optional[Dict[str, Any]],
    ) -> str:
        if event_type == "exercise_evaluated":
            is_correct = payload.get("is_correct", False)
            ans = payload.get("student_answer", "")
            correct = payload.get("correct_answer", "")
            lvl = payload.get("level", "basico")
            level_up = payload.get("level_up", False)
            if not is_correct:
                return (
                    f"El estudiante envió una respuesta al ejercicio de nivel {lvl}: '{ans}'.\n"
                    f"La respuesta esperada era: '{correct}'.\n"
                    f"NO reveles la respuesta correcta directamente. Analiza si cometió un error de cálculo o si confundió un cateto con la hipotenusa. "
                    f"Formúlale una pregunta socrática o pista para que descubra su error. "
                    f"Puedes invocar `modificar_lienzo` con `resaltar_elemento` ('cateto_a', 'cateto_b', 'hipotenusa_c' o 'diagrama')."
                )
            else:
                return (
                    f"El estudiante respondió CORRECTAMENTE: '{ans}'.\n"
                    f"Nivel: {lvl}. Subió de nivel: {level_up}.\n"
                    f"Felicítalo brevemente por su razonamiento matemático (1-2 oraciones) y anímalo para el siguiente ejercicio."
                )

        elif event_type == "hypothesis_submitted":
            hypo = payload.get("hypothesis", "")
            return (
                f"El estudiante acaba de proponer su hipótesis para el problema detonante en CONECTA: '{hypo}'.\n"
                f"Valida el valor de su intuición sin darle la fórmula memorística. "
                f"Pregúntale qué figura geométrica u observación se obtendría al trazar la diagonal entre los extremos."
            )

        elif event_type == "microcheck_completed":
            c_count = payload.get("correct_count", 0)
            total = payload.get("total", 4)
            approved = payload.get("approved", False)
            next_stg = payload.get("next_stage", "COMPRENDE")
            return (
                f"El estudiante completó el microcheck diagnóstico con {c_count}/{total} aciertos (Aprobado: {approved}).\n"
                f"Se le redirige a la etapa: {next_stg}.\n"
                f"Explícale en 1 o 2 oraciones con empatía por qué esta ruta ({next_stg}) es la más adecuada para su aprendizaje."
            )

        elif event_type == "inactivity_nudge":
            sec = payload.get("seconds_idle", 45)
            return (
                f"El estudiante lleva {sec} segundos sin interactuar en la etapa {stage}, escena {scene}.\n"
                f"Ofrécele un recordatorio amable o una pregunta socrática sencilla que lo motive a dar el siguiente paso."
            )

        elif event_type == "stage_transition":
            return (
                f"El estudiante acaba de ingresar a la etapa {stage} ({scene}).\n"
                f"Dale una bienvenida motivadora y sintetiza el propósito de aprendizaje de esta etapa en 1 o 2 oraciones."
            )

        return "El estudiante realizó una acción en el lienzo. Ofrece orientación socrática pertinente."

    def _generate_rule_based_proactive_fallback(
        self,
        event_type: str,
        payload: Dict[str, Any],
        stage: str,
        scene: str,
        topic_data: Optional[Dict[str, Any]],
        exercise: Optional[Dict[str, Any]],
    ) -> Tuple[str, Optional[Dict[str, Any]]]:
        if event_type == "exercise_evaluated":
            is_correct = payload.get("is_correct", False)
            ans = str(payload.get("student_answer", "")).lower()
            lvl = payload.get("level", "basico")
            level_up = payload.get("level_up", False)

            if is_correct:
                if level_up:
                    return (
                        "¡Excelente deducción! Has resuelto este ejercicio con precisión y has subido de nivel. "
                        "Observa el nuevo reto que se ha proyectado en tu lienzo.",
                        {"accion": "resaltar_elemento", "elemento_a_resaltar": "diagrama"},
                    )
                return (
                    f"¡Muy bien pensado! Tu resultado es correcto. "
                    "Has aplicado correctamente la relación entre los lados.",
                    None,
                )
            else:
                # Estanque check
                if "12" in ans and "13" not in ans:
                    return (
                        "¡Atención con los datos del estanque! 12 m corresponde a la profundidad del agua (el cateto vertical $x$), "
                        "pero el problema pide la longitud total de la planta (la hipotenusa $x + 1$). "
                        "¿Cuánto obtienes al sumarle 1 a la profundidad?",
                        {"accion": "resaltar_elemento", "elemento_a_resaltar": "hipotenusa"},
                    )
                return (
                    "Revisemos tu planteamiento paso a paso: recuerda que en todo triángulo rectángulo se cumple $a^2 + b^2 = c^2$. "
                    "¿Has identificado si el valor que buscas es la hipotenusa (el lado opuesto al ángulo recto) o uno de los catetos? "
                    "Observa las medidas resaltadas en el diagrama.",
                    {"accion": "resaltar_elemento", "elemento_a_resaltar": "cateto_b"},
                )

        elif event_type == "hypothesis_submitted":
            return (
                "¡Qué buena intuición! Tu idea sobre cómo se conectan las medidas es el punto de partida ideal. "
                "Fíjate en la línea diagonal que atraviesa el piso: ¿qué figura geométrica se forma entre las dos paredes y esa diagonal?",
                {"accion": "resaltar_elemento", "elemento_a_resaltar": "pared_6m"},
            )

        elif event_type == "microcheck_completed":
            approved = payload.get("approved", False)
            c_count = payload.get("correct_count", 0)
            if approved:
                return (
                    "¡Brillante! Has superado la autoevaluación diagnóstica con éxito. "
                    "Como ya tienes claros los fundamentos teóricos, pasamos directamente a la etapa RESUELVE "
                    "para que apliques tus habilidades en problemas prácticos.",
                    {"accion": "cambiar_escena", "etapa": "RESUELVE", "escena": "scene_5_exercise"},
                )
            else:
                return (
                    f"Has obtenido {c_count} de 4 aciertos. Para asegurarnos de que tengas cimientos sólidos "
                    "y comprendas de dónde surge cada relación geométrica, exploremos la demostración en COMPRENDE.",
                    {"accion": "cambiar_escena", "etapa": "COMPRENDE", "escena": "scene_3_proof"},
                )

        elif event_type == "inactivity_nudge":
            if stage == "CONECTA":
                return (
                    "Veo que estás analizando el escenario. Observa las dos paredes que miden 6 m y 8 m: "
                    "¿qué distancia podríamos medir en el piso para comprobar si forman una esquina recta?",
                    {"accion": "resaltar_elemento", "elemento_a_resaltar": "pared_8m"},
                )
            elif stage == "COMPRENDE":
                return (
                    "Tómate tu tiempo para explorar la demostración. Observa cómo los cuatro triángulos rectángulos "
                    "reordenados forman un cuadrado central: ¿qué representa su área?",
                    {"accion": "resaltar_elemento", "elemento_a_resaltar": "paso_demostracion"},
                )
            else:
                return (
                    "Estoy aquí para guiarte si tienes dudas con el cálculo. "
                    "Dime: ¿cuáles lados forman el ángulo de 90° en este problema?",
                    {"accion": "resaltar_elemento", "elemento_a_resaltar": "diagrama"},
                )

        elif event_type == "stage_transition":
            if stage == "CONECTA":
                return (
                    "¡Bienvenido a la etapa CONECTA! Aquí exploramos una situación real antes de ver fórmulas. "
                    "Analiza el escenario y cuéntame qué hipótesis tienes.",
                    None,
                )
            elif stage == "COMPRENDE":
                return (
                    "Entramos a la etapa COMPRENDE. Aquí descubrirás por qué funciona este principio mediante "
                    "demostraciones visuales y analogías geométricas.",
                    None,
                )
            else:
                return (
                    "¡Llegamos a la etapa RESUELVE! Aquí pondrás a prueba tu capacidad de deducción con "
                    "ejercicios interactivos que se adaptan a tu nivel de dominio.",
                    None,
                )

        return (
            "Sigue explorando el lienzo. Si necesitas una pista o quieres contrastar tus ideas, avísame.",
            None,
        )

    def _generate_proactive_suggested_prompts(
        self, event_type: str, payload: Dict[str, Any]
    ) -> List[str]:
        if event_type == "exercise_evaluated":
            if not payload.get("is_correct", False):
                return [
                    "¿Por qué está mal mi cálculo?",
                    "¿Cuál es la hipotenusa aquí?",
                    "Dame una pista paso a paso",
                    "Muéstrame la fórmula",
                ]
            else:
                return [
                    "Siguiente ejercicio",
                    "¿Por qué se cumple esta relación?",
                    "Quiero un reto más difícil",
                ]
        elif event_type == "hypothesis_submitted":
            return [
                "¿Cómo se relaciona con la diagonal?",
                "¿Qué figura se forma?",
                "Pasar a la demostración",
            ]
        elif event_type == "microcheck_completed":
            return [
                "Explícame en qué fallé",
                "Comenzar los ejercicios",
                "Ver la demostración gráfica",
            ]
        elif event_type == "inactivity_nudge":
            return [
                "No sé por dónde empezar",
                "Explícame la figura",
                "Dame una pista",
                "¿Qué fórmula uso?",
            ]
        return [
            "¿Cómo empiezo?",
            "Dame una pista conceptual",
            "¿Cuál es la hipotenusa?",
            "Revisar mi cálculo",
        ]
