"""Curriculum and Roadmap management service."""

import math
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from data import models


class CurriculumService:
    def __init__(self, db: Session):
        self.db = db

    def seed_default_math_curriculum(self) -> None:
        """Seeds grades 2 EGB to 3 BGU and the official Pythagoras pilot topic."""
        # 1. Ensure Grades exist
        grades_data = [
            ("2.° EGB", "EGB Elemental", 1),
            ("3.° EGB", "EGB Elemental", 2),
            ("4.° EGB", "EGB Elemental", 3),
            ("5.° EGB", "EGB Media", 4),
            ("6.° EGB", "EGB Media", 5),
            ("7.° EGB", "EGB Media", 6),
            ("8.° EGB", "EGB Superior", 7),
            ("9.° EGB", "EGB Superior", 8),
            ("10.° EGB", "EGB Superior", 9),
            ("1.° BGU", "Bachillerato", 10),
            ("2.° BGU", "Bachillerato", 11),
            ("3.° BGU", "Bachillerato", 12),
        ]

        grade_map = {}
        for name, group, order in grades_data:
            grade = self.db.query(models.CurriculumGrade).filter_by(name=name).first()
            if not grade:
                grade = models.CurriculumGrade(name=name, level_group=group, order_index=order)
                self.db.add(grade)
                self.db.flush()
            grade_map[name] = grade

        # 2. Ensure Unit for 9.° / 10.° EGB Geometría y Medida
        egb_9 = grade_map.get("9.° EGB")
        unit = (
            self.db.query(models.CurriculumUnit)
            .filter_by(grade_id=egb_9.id, title="Geometría y Medida: Triángulos y Teoremas")
            .first()
        )
        if not unit:
            unit = models.CurriculumUnit(
                grade_id=egb_9.id,
                title="Geometría y Medida: Triángulos y Teoremas",
                description="Relaciones métricas, semejanza, congruencia y Teorema de Pitágoras.",
                order_index=1,
            )
            self.db.add(unit)
            self.db.flush()

        # 3. Ensure Official Pythagoras Topic
        topic = (
            self.db.query(models.CurriculumTopic)
            .filter_by(code="MATH-PITAGORAS")
            .first()
        )
        if not topic:
            topic = models.CurriculumTopic(
                code="MATH-PITAGORAS",
                unit_id=unit.id,
                title="Teorema de Pitágoras",
                subtitle="Descubre cómo relacionar las longitudes de un triángulo rectángulo",
                description=(
                    "Módulo piloto con secuencia prescriptiva CONECTA -> COMPRENDE -> RESUELVE, "
                    "demostración geométrica interactiva y práctica adaptativa."
                ),
                stage_initial="CONECTA",
                order_index=1,
                meta={
                    "pilot": True,
                    "target_grade": "9.° EGB / 10.° EGB",
                    "domain_weights": {"R": 0.55, "I": 0.20, "A": 0.15, "V": 0.10},
                    "threshold_learned": 60,
                    "threshold_pending_verify": 80,
                    "consecutive_to_advance": 2,
                    "errors_to_hint": 2,
                },
            )
            self.db.add(topic)
            self.db.flush()

        # 4. Seed Microcompetencies PIT-01 to PIT-10 (Exact Spec section 11 & 14.1)
        skills_spec = [
            ("PIT-01", "Reconoce un triángulo rectángulo", "Identifica ángulos rectos de 90° en diversas orientaciones.", [], 1),
            ("PIT-02", "Identifica catetos e hipotenusa", "Distingue los lados adyacentes al ángulo recto y el lado opuesto mayor.", ["PIT-01"], 2),
            ("PIT-03", "Comprende el significado geométrico de elevar una longitud al cuadrado en el contexto de áreas", "Relaciona a² con el área del cuadrado sobre el lado a.", ["PIT-02"], 3),
            ("PIT-04", "Comprende la deducción del teorema mediante el reordenamiento de cuatro triángulos congruentes", "Visualiza la equivalencia de áreas mediante la descomposición algebraica.", ["PIT-03"], 4),
            ("PIT-05", "Interpreta la relación a² + b² = c²", "Formaliza algebraicamente la relación entre catetos e hipotenusa.", ["PIT-04"], 5),
            ("PIT-06", "Calcula la hipotenusa", "Aplica c = √(a² + b²) dados ambos catetos.", ["PIT-05"], 6),
            ("PIT-07", "Calcula un cateto", "Aplica a = √(c² - b²) dadas la hipotenusa y un cateto.", ["PIT-05"], 7),
            ("PIT-08", "Reconoce cuándo corresponde aplicar el teorema en una situación contextual", "Discierne situaciones reales con triángulos rectángulos implícitos.", ["PIT-06", "PIT-07"], 8),
            ("PIT-09", "Modela y resuelve una situación aplicada", "Plantea variables, ejecuta el cálculo y responde con unidades reales.", ["PIT-08"], 9),
            ("PIT-10", "Verifica si tres longitudes pueden corresponder a un triángulo rectángulo", "Aplica el recíproco del teorema: comprueba si a² + b² = c².", ["PIT-06", "PIT-07"], 10),
        ]

        for code, name, desc, prereqs, order in skills_spec:
            m = (
                self.db.query(models.Microcompetency)
                .filter_by(topic_id=topic.id, code=code)
                .first()
            )
            if not m:
                m = models.Microcompetency(
                    code=code,
                    topic_id=topic.id,
                    topic_code="MATH-PITAGORAS",
                    name=name,
                    description=desc,
                    prerequisites=prereqs,
                    order_index=order,
                )
                self.db.add(m)

        # 5. Seed Exercise Bank (Microcheck, Básico, Intermedio, Avanzado, Desafío)
        exercises_spec = [
            # Microcomprobación (4 ítems: PIT-01, PIT-02, PIT-06, PIT-07)
            {
                "level": "microcheck",
                "microcompetency_codes": ["PIT-01"],
                "title": "Verificación de Triángulo Rectángulo",
                "statement": "¿Cuál de las siguientes condiciones define obligatoriamente a un triángulo rectángulo?",
                "figure_type": "triangle_options",
                "correct_answer": "Tiene exactamente un ángulo interior de 90°",
                "unit": "",
                "hints": {},
            },
            {
                "level": "microcheck",
                "microcompetency_codes": ["PIT-02"],
                "title": "Identificación de Hipotenusa",
                "statement": "En un triángulo rectángulo con lados m, n y p, donde el ángulo recto se encuentra entre m y n, ¿cuál es la hipotenusa?",
                "figure_type": "triangle_letters",
                "correct_answer": "p",
                "unit": "",
                "hints": {},
            },
            {
                "level": "microcheck",
                "microcompetency_codes": ["PIT-06"],
                "title": "Cálculo Rápido de Hipotenusa",
                "statement": "Si los catetos de un triángulo miden 3 cm y 4 cm, ¿cuánto mide la hipotenusa?",
                "figure_type": "triangle_345",
                "correct_answer": "5",
                "unit": "cm",
                "acceptable_range": [4.9, 5.1],
                "hints": {},
            },
            {
                "level": "microcheck",
                "microcompetency_codes": ["PIT-07"],
                "title": "Cálculo Rápido de Cateto",
                "statement": "La hipotenusa de un triángulo mide 10 m y uno de sus catetos mide 6 m. ¿Cuánto mide el otro cateto?",
                "figure_type": "triangle_6_10",
                "correct_answer": "8",
                "unit": "m",
                "acceptable_range": [7.9, 8.1],
                "hints": {},
            },
            # Básico: Aplicación Directa (PIT-06, PIT-07)
            {
                "level": "basico",
                "microcompetency_codes": ["PIT-06"],
                "title": "Cálculo de Hipotenusa: Triángulo Rectángulo",
                "statement": "En un triángulo rectángulo, los catetos miden a = 6 m y b = 8 m. Calcula la longitud de la hipotenusa c.",
                "figure_type": "triangle_direct",
                "data_params": {"a": 6, "b": 8},
                "correct_answer": "10",
                "unit": "m",
                "acceptable_range": [9.9, 10.1],
                "hints": {
                    "level_1": "Recuerda la relación del teorema: c² = a² + b².",
                    "level_2": "Sustituye los valores: c² = 6² + 8² = 36 + 64 = 100.",
                    "level_3": "Para hallar c, calcula la raíz cuadrada de 100: c = √100 = 10 m.",
                },
                "solution_steps": ["c² = 6² + 8²", "c² = 36 + 64 = 100", "c = √100 = 10 m"],
            },
            {
                "level": "basico",
                "microcompetency_codes": ["PIT-07"],
                "title": "Cálculo de Cateto Desconocido",
                "statement": "En un triángulo rectángulo, la hipotenusa mide c = 13 cm y uno de sus catetos mide a = 5 cm. ¿Cuál es la medida del otro cateto b?",
                "figure_type": "triangle_direct",
                "data_params": {"c": 13, "a": 5},
                "correct_answer": "12",
                "unit": "cm",
                "acceptable_range": [11.9, 12.1],
                "hints": {
                    "level_1": "Al despejar un cateto, restamos: b² = c² - a².",
                    "level_2": "Calcula los cuadrados: b² = 13² - 5² = 169 - 25 = 144.",
                    "level_3": "Obtén la raíz de 144: b = √144 = 12 cm.",
                },
                "solution_steps": ["b² = 13² - 5²", "b² = 169 - 25 = 144", "b = √144 = 12 cm"],
            },
            {
                "level": "basico",
                "microcompetency_codes": ["PIT-06"],
                "title": "Hipotenusa con Catetos Múltiples de 3 y 4",
                "statement": "Calcula la hipotenusa de un triángulo rectángulo cuyos catetos miden a = 9 m y b = 12 m.",
                "figure_type": "triangle_direct",
                "data_params": {"a": 9, "b": 12},
                "correct_answer": "15",
                "unit": "m",
                "acceptable_range": [14.9, 15.1],
                "hints": {
                    "level_1": "Plantea c² = 9² + 12².",
                    "level_2": "9² = 81 y 12² = 144. La suma es 225.",
                    "level_3": "c = √225 = 15 m.",
                },
                "solution_steps": ["c² = 81 + 144 = 225", "c = √225 = 15 m"],
            },
            # Intermedio: Interpretación y Contexto (PIT-08, PIT-09)
            {
                "level": "intermedio",
                "microcompetency_codes": ["PIT-08", "PIT-09"],
                "title": "Longitud de Barra Diagonal de Soporte",
                "statement": "Una barra diagonal une dos puntos separados horizontalmente 4.8 m y verticalmente 7.2 m. ¿Qué longitud mínima debe tener la barra?",
                "figure_type": "diagonal_bar",
                "data_params": {"dx": 4.8, "dy": 7.2},
                "correct_answer": "8.65",
                "unit": "m",
                "acceptable_range": [8.6, 8.7],
                "hints": {
                    "level_1": "La separación horizontal y vertical forman los dos catetos de un triángulo rectángulo imaginario.",
                    "level_2": "La longitud de la barra es la hipotenusa: L² = (4.8)² + (7.2)² = 23.04 + 51.84 = 74.88.",
                    "level_3": "Calcula la raíz cuadrada de 74.88: L ≈ 8.65 m.",
                },
                "solution_steps": ["L = √(4.8² + 7.2²)", "L = √(23.04 + 51.84) = √74.88", "L ≈ 8.65 m"],
            },
            # Avanzado: Modelación (PIT-09)
            {
                "level": "avanzado",
                "microcompetency_codes": ["PIT-09"],
                "title": "Seguridad de Escalera de Trabajo",
                "statement": "Una escalera debe alcanzar una ventana situada a 3.06 m de altura. Por normas de seguridad, la base debe colocarse a 4.20 m de la pared. ¿Qué longitud mínima debe tener la escalera?",
                "figure_type": "ladder",
                "data_params": {"height": 3.06, "base": 4.20},
                "correct_answer": "5.20",
                "unit": "m",
                "acceptable_range": [5.15, 5.25],
                "hints": {
                    "level_1": "Identifica la figura que forman el suelo, la pared y la escalera.",
                    "level_2": "La altura (3.06 m) y la distancia al suelo (4.20 m) son los catetos. La escalera es la hipotenusa.",
                    "level_3": "Longitud = √(3.06² + 4.20²) = √(9.3636 + 17.64) = √27.0036 ≈ 5.20 m.",
                },
                "solution_steps": ["L² = 3.06² + 4.20²", "L² = 9.3636 + 17.64 = 27.0036", "L ≈ 5.20 m"],
            },
            # Desafío: Problema No Rutinario (El Estanque - Spec Section 10.4)
            {
                "level": "desafio",
                "microcompetency_codes": ["PIT-09"],
                "title": "El Problema del Estanque y la Planta Acuática",
                "statement": (
                    "Un estanque tiene 10 m de ancho. Una planta acuática nace exactamente en el centro del fondo. "
                    "Cuando está completamente vertical, sobresale 1 m por encima de la superficie del agua. "
                    "Si se inclina hacia cualquiera de los bordes, su extremo coincide exactamente con el borde a nivel "
                    "de la superficie. ¿Cuál es la longitud total de la planta?"
                ),
                "figure_type": "pond",
                "data_params": {"width": 10, "overflow": 1},
                "correct_answer": "13",
                "unit": "m",
                "acceptable_range": [12.9, 13.1],
                "hints": {
                    "level_1": (
                        "Si el ancho es 10 m y la planta nace en el centro, la distancia del centro al borde es de 5 m (un cateto). "
                        "Llama x a la profundidad del agua (segundo cateto)."
                    ),
                    "level_2": (
                        "Dado que la planta sobresale 1 m verticalmente, su longitud total es (x + 1). "
                        "Al inclinarse al borde, la hipotenusa es esa misma longitud total: (x + 1)."
                    ),
                    "level_3": (
                        "Plantea el teorema: x² + 5² = (x + 1)² -> x² + 25 = x² + 2x + 1 -> 25 = 2x + 1 -> 2x = 24 -> x = 12 m. "
                        "¡OJO! 12 m es la profundidad del agua, la longitud de la planta es x + 1."
                    ),
                },
                "solution_steps": [
                    "Cateto horizontal = 10 / 2 = 5 m",
                    "Cateto vertical = profundidad = x",
                    "Hipotenusa = longitud de la planta = x + 1",
                    "x² + 5² = (x + 1)² => x² + 25 = x² + 2x + 1",
                    "2x = 24 => x = 12 m (profundidad)",
                    "Longitud total de la planta = x + 1 = 12 + 1 = 13 m",
                ],
            },
        ]

        for ex in exercises_spec:
            existing = (
                self.db.query(models.ExerciseItem)
                .filter_by(topic_id=topic.id, title=ex["title"])
                .first()
            )
            if not existing:
                item = models.ExerciseItem(
                    topic_id=topic.id,
                    topic_code="MATH-PITAGORAS",
                    level=ex["level"],
                    microcompetency_codes=ex["microcompetency_codes"],
                    title=ex["title"],
                    statement=ex["statement"],
                    figure_type=ex.get("figure_type"),
                    data_params=ex.get("data_params"),
                    correct_answer=ex["correct_answer"],
                    acceptable_range=ex.get("acceptable_range"),
                    unit=ex.get("unit"),
                    hints=ex.get("hints"),
                    solution_steps=ex.get("solution_steps"),
                )
                self.db.add(item)

        self.db.commit()

    def get_full_curriculum_roadmap(self) -> List[Dict[str, Any]]:
        """Returns the full hierarchical curriculum for the LMS."""
        grades = (
            self.db.query(models.CurriculumGrade)
            .order_index_by(models.CurriculumGrade.order_index)
            if hasattr(models.CurriculumGrade, "order_index_by")
            else self.db.query(models.CurriculumGrade)
            .order_by(models.CurriculumGrade.order_index)
            .all()
        )
        if not grades:
            self.seed_default_math_curriculum()
            grades = self.db.query(models.CurriculumGrade).order_by(models.CurriculumGrade.order_index).all()
        return [g.to_dict() for g in grades]

    def get_topic_by_code(self, code: str) -> Optional[models.CurriculumTopic]:
        return self.db.query(models.CurriculumTopic).filter_by(code=code).first()

    def list_units(self, grade_id: Optional[str] = None) -> List[models.CurriculumUnit]:
        query = self.db.query(models.CurriculumUnit)
        if grade_id:
            query = query.filter_by(grade_id=grade_id)
        return query.order_by(models.CurriculumUnit.order_index).all()

    def create_unit(
        self,
        grade_id: str,
        title: str,
        description: Optional[str] = None,
        trimester: int = 1,
        order_index: int = 1,
    ) -> models.CurriculumUnit:
        unit = models.CurriculumUnit(
            grade_id=grade_id,
            title=title,
            description=description,
            trimester=trimester,
            order_index=order_index,
        )
        self.db.add(unit)
        self.db.commit()
        self.db.refresh(unit)
        return unit

    def update_unit(self, unit_id: str, data: Dict[str, Any]) -> Optional[models.CurriculumUnit]:
        unit = self.db.query(models.CurriculumUnit).filter_by(id=unit_id).first()
        if not unit:
            return None
        if "title" in data and data["title"]:
            unit.title = data["title"]
        if "description" in data:
            unit.description = data["description"]
        if "trimester" in data and data["trimester"] is not None:
            unit.trimester = int(data["trimester"])
        if "order_index" in data and data["order_index"] is not None:
            unit.order_index = int(data["order_index"])
        self.db.commit()
        self.db.refresh(unit)
        return unit

    def delete_unit(self, unit_id: str) -> bool:
        unit = self.db.query(models.CurriculumUnit).filter_by(id=unit_id).first()
        if not unit:
            return False
        # Cleanly delete each topic in this unit first
        for t in list(unit.topics):
            self.delete_topic(t.code)
        self.db.delete(unit)
        self.db.commit()
        return True

    def create_custom_topic(self, teacher_id: str, data: Dict[str, Any]) -> models.CurriculumTopic:
        """Allows teachers or coordinators to author their own custom curriculum topics."""
        topic = models.CurriculumTopic(
            code=data["code"],
            unit_id=data.get("unit_id"),
            title=data["title"],
            subtitle=data.get("subtitle"),
            description=data.get("description"),
            stage_initial=data.get("stage_initial", "CONECTA"),
            order_index=data.get("order_index", 1),
            author_id=teacher_id,
            meta=data.get("meta", {}),
        )
        self.db.add(topic)
        self.db.flush()

        # Add microcompetencies if provided
        for idx, m in enumerate(data.get("microcompetencies", [])):
            micro = models.Microcompetency(
                code=m["code"],
                topic_id=topic.id,
                topic_code=topic.code,
                name=m["name"],
                description=m.get("description"),
                prerequisites=m.get("prerequisites", []),
                order_index=idx + 1,
            )
            self.db.add(micro)

        self.db.commit()
        self.db.refresh(topic)
        return topic

    def create_staged_topic(
        self,
        author_id: str,
        unit_id: Optional[str],
        code: str,
        title: str,
        subtitle: Optional[str],
        description: Optional[str],
        staged_content: Dict[str, Any],
        stage_initial: str = "CONECTA",
    ) -> models.CurriculumTopic:
        """Saves an AI-generated topic package in staging_review state."""
        existing = self.db.query(models.CurriculumTopic).filter_by(code=code).first()
        if existing:
            existing.unit_id = unit_id or existing.unit_id
            existing.title = title
            existing.subtitle = subtitle
            existing.description = description
            existing.staged_content = staged_content
            existing.status = "staging_review"
            self.db.commit()
            self.db.refresh(existing)
            return existing

        topic = models.CurriculumTopic(
            code=code,
            unit_id=unit_id,
            title=title,
            subtitle=subtitle,
            description=description,
            stage_initial=stage_initial,
            order_index=1,
            status="staging_review",
            author_id=author_id,
            staged_content=staged_content,
            meta={"ai_generated": True},
        )
        self.db.add(topic)
        self.db.commit()
        self.db.refresh(topic)
        return topic

    def update_staged_content(
        self, topic_code: str, staged_content: Dict[str, Any]
    ) -> Optional[models.CurriculumTopic]:
        topic = self.db.query(models.CurriculumTopic).filter_by(code=topic_code).first()
        if not topic:
            return None
        topic.staged_content = staged_content
        self.db.commit()
        self.db.refresh(topic)
        return topic

    def approve_and_publish_topic(self, topic_code: str) -> Optional[models.CurriculumTopic]:
        """Approves staged content and populates official Microcompetency and ExerciseItem records."""
        topic = self.db.query(models.CurriculumTopic).filter_by(code=topic_code).first()
        if not topic:
            return None

        topic.status = "published"
        staged = topic.staged_content or {}

        # 1. Process Microcompetencies
        micro_data = staged.get("microcompetencies", [])
        for idx, m in enumerate(micro_data):
            code = m.get("code")
            if not code:
                continue
            existing_mc = (
                self.db.query(models.Microcompetency)
                .filter_by(topic_id=topic.id, code=code)
                .first()
            )
            if not existing_mc:
                mc = models.Microcompetency(
                    code=code,
                    topic_id=topic.id,
                    topic_code=topic.code,
                    name=m.get("name", code),
                    description=m.get("description"),
                    prerequisites=m.get("prerequisites", []),
                    order_index=idx + 1,
                )
                self.db.add(mc)
            else:
                existing_mc.name = m.get("name", existing_mc.name)
                existing_mc.description = m.get("description", existing_mc.description)
                existing_mc.prerequisites = m.get("prerequisites", existing_mc.prerequisites)

        # 2. Process Exercises from RESUELVE
        exercises_data = staged.get("resuelve", {}).get("exercises", [])
        default_mc_codes = [m["code"] for m in micro_data[:2]] if micro_data else ["MC-01"]
        for ex in exercises_data:
            stmt = ex.get("statement", "")
            if not stmt:
                continue
            existing_ex = (
                self.db.query(models.ExerciseItem)
                .filter_by(topic_id=topic.id, statement=stmt)
                .first()
            )
            if not existing_ex:
                item = models.ExerciseItem(
                    topic_id=topic.id,
                    topic_code=topic.code,
                    level=ex.get("level", "basico"),
                    microcompetency_codes=ex.get("microcompetency_codes") or default_mc_codes,
                    title=ex.get("title", "Ejercicio"),
                    statement=stmt,
                    figure_type=ex.get("figure_type"),
                    data_params=ex.get("data_params"),
                    correct_answer=str(ex.get("correct_answer", "")),
                    acceptable_range=ex.get("acceptable_range"),
                    unit=ex.get("unit"),
                    hints=ex.get("hints"),
                    solution_steps=ex.get("solution_steps"),
                )
                self.db.add(item)

        self.db.commit()
        self.db.refresh(topic)
        return topic

    def update_topic(self, topic_code: str, data: Dict[str, Any]) -> Optional[models.CurriculumTopic]:
        """Updates basic attributes of a curriculum topic."""
        topic = self.db.query(models.CurriculumTopic).filter_by(code=topic_code).first()
        if not topic:
            return None
        if "title" in data and data["title"]:
            topic.title = data["title"].strip()
        if "subtitle" in data:
            topic.subtitle = data["subtitle"]
        if "description" in data:
            topic.description = data["description"]
        if "unit_id" in data:
            topic.unit_id = data["unit_id"]
        if "order_index" in data and data["order_index"] is not None:
            topic.order_index = int(data["order_index"])
        if "status" in data and data["status"]:
            topic.status = data["status"]
        if "stage_initial" in data and data["stage_initial"]:
            topic.stage_initial = data["stage_initial"]

        self.db.commit()
        self.db.refresh(topic)
        return topic

    def delete_topic(self, topic_code: str) -> bool:
        """Deletes a topic along with any student skill states, events, and related items."""
        topic = self.db.query(models.CurriculumTopic).filter_by(code=topic_code).first()
        if not topic:
            return False

        from sqlalchemy import text
        try:
            self.db.execute(text("DELETE FROM student_skill_states WHERE topic_code = :tcode"), {"tcode": topic_code})
            self.db.execute(text("DELETE FROM pedagogical_events WHERE topic_code = :tcode"), {"tcode": topic_code})
        except Exception:
            pass

        self.db.delete(topic)
        self.db.commit()
        return True
