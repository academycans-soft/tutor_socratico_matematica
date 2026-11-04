"""Pedagogical State Machine and Adaptive Assessment Service."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from data import models


class PedagogyService:
    def __init__(self, db: Session):
        self.db = db

    def get_or_init_student_state(self, user_id: str, topic_code: str) -> Dict[str, Any]:
        """Gets or initializes the student's mastery states and active stage/scene."""
        topic = self.db.query(models.CurriculumTopic).filter_by(code=topic_code).first()
        if not topic:
            from .curriculum_service import CurriculumService
            CurriculumService(self.db).seed_default_math_curriculum()
            topic = self.db.query(models.CurriculumTopic).filter_by(code=topic_code).first()

        microcompetencies = (
            self.db.query(models.Microcompetency)
            .filter_by(topic_code=topic_code)
            .order_by(models.Microcompetency.order_index)
            .all()
        )

        skill_states = (
            self.db.query(models.StudentSkillState)
            .filter_by(user_id=user_id, topic_code=topic_code)
            .all()
        )
        state_map = {s.microcompetency_code: s for s in skill_states}

        # Initialize missing microcompetencies
        new_states = []
        for m in microcompetencies:
            if m.code not in state_map:
                s = models.StudentSkillState(
                    user_id=user_id,
                    topic_code=topic_code,
                    microcompetency_code=m.code,
                    state="no_explorado",
                    domain_index_d=0.0,
                    active_stage="CONECTA",
                    active_scene="scene_0_intro",
                    current_level="basico",
                )
                self.db.add(s)
                new_states.append(s)
                state_map[m.code] = s

        if new_states:
            self.db.commit()

        # Representative stage/scene is taken from the first skill state
        first_state = list(state_map.values())[0] if state_map else None
        active_stage = first_state.active_stage if first_state else "CONECTA"
        active_scene = first_state.active_scene if first_state else "scene_0_intro"
        current_level = first_state.current_level if first_state else "basico"

        # Calculate ready_to_learn microcompetencies (prereqs met, not yet mastered)
        skills_output = []
        for m in microcompetencies:
            s = state_map[m.code]
            d_dict = s.to_dict()
            d_dict["name"] = m.name
            d_dict["description"] = m.description
            d_dict["prerequisites"] = m.prerequisites

            # Check if ready to learn
            prereqs_met = True
            for p in m.prerequisites:
                p_state = state_map.get(p)
                if not p_state or p_state.state in ("no_explorado", "en_proceso", "requiere_revision"):
                    prereqs_met = False
                    break
            d_dict["ready_to_learn"] = prereqs_met and s.state != "dominado"
            skills_output.append(d_dict)

        # Average D
        explored = [s.domain_index_d for s in state_map.values() if s.state != "no_explorado"]
        avg_d = sum(explored) / len(explored) if explored else 0.0

        return {
            "user_id": user_id,
            "topic_code": topic_code,
            "topic_title": topic.title if topic else "",
            "active_stage": active_stage,
            "active_scene": active_scene,
            "current_level": current_level,
            "average_domain_d": round(avg_d, 2),
            "skills": skills_output,
        }

    def record_event(self, user_id: str, topic_code: str, event_type: str, data: Dict[str, Any]) -> None:
        """Records a pedagogical event in the audit trail."""
        evt = models.PedagogicalEvent(
            user_id=user_id,
            topic_code=topic_code,
            event_type=event_type,
            event_data=data,
        )
        self.db.add(evt)
        self.db.commit()

    def advance_stage_scene(self, user_id: str, topic_code: str, stage: str, scene: str) -> Dict[str, Any]:
        """Updates the active stage and scene across the student's skill states."""
        states = (
            self.db.query(models.StudentSkillState)
            .filter_by(user_id=user_id, topic_code=topic_code)
            .all()
        )
        for s in states:
            s.active_stage = stage
            s.active_scene = scene
            s.last_evaluated_at = datetime.utcnow()
        self.db.commit()

        self.record_event(
            user_id=user_id,
            topic_code=topic_code,
            event_type="resource_opened",
            data={"stage": stage, "scene": scene},
        )
        return {"stage": stage, "scene": scene}

    def submit_conecta_hypothesis(self, user_id: str, topic_code: str, hypothesis: str) -> Dict[str, Any]:
        """Saves student hypothesis for the room floor tiles situation (unscored participation)."""
        self.record_event(
            user_id=user_id,
            topic_code=topic_code,
            event_type="answer_submitted",
            data={"phase": "CONECTA", "hypothesis": hypothesis, "scored": False},
        )
        # Advance to diagonal reveal
        self.advance_stage_scene(user_id, topic_code, "CONECTA", "scene_1_diagonal_reveal")
        return {
            "status": "success",
            "message": "Hipótesis registrada.",
            "next_scene": "scene_1_diagonal_reveal",
            "measured_diagonal": 10.18,
        }

    def submit_microcheck(self, user_id: str, topic_code: str, answers: Dict[str, str]) -> Dict[str, Any]:
        """Evaluates the 4 microcheck items for 'Ya conozco esto' without hints (threshold 3/4)."""
        # Microcheck answers definition
        # PIT-01: Tiene exactamente un ángulo interior de 90°
        # PIT-02: p
        # PIT-06: 5
        # PIT-07: 8
        correct_map = {
            "PIT-01": ["90", "angulo recto", "rectangulo", "tiene exactamente un angulo interior de 90"],
            "PIT-02": ["p"],
            "PIT-06": ["5", "5cm", "5 cm"],
            "PIT-07": ["8", "8m", "8 m"],
        }

        results = {}
        correct_count = 0
        for code, expected_list in correct_map.items():
            user_val = str(answers.get(code, "")).strip().lower()
            is_correct = any(exp in user_val for exp in expected_list)
            results[code] = is_correct
            if is_correct:
                correct_count += 1

        approved = correct_count >= 3
        # Update skill states for the 4 entry skills
        for code in ("PIT-01", "PIT-02", "PIT-06", "PIT-07"):
            s = (
                self.db.query(models.StudentSkillState)
                .filter_by(user_id=user_id, topic_code=topic_code, microcompetency_code=code)
                .first()
            )
            if s:
                s.attempts_count += 1
                if results[code]:
                    s.state = "en_proceso"
                    s.domain_index_d = max(s.domain_index_d, 50.0)
                    s.recent_r = 75.0
                    s.independence_i = 100.0

        if approved:
            # Advance to RESUELVE Basic Level (never directly higher per spec)
            self.advance_stage_scene(user_id, topic_code, "RESUELVE", "scene_5_exercise")
            states = (
                self.db.query(models.StudentSkillState)
                .filter_by(user_id=user_id, topic_code=topic_code)
                .all()
            )
            for s in states:
                s.current_level = "basico"
            self.db.commit()
            next_stage = "RESUELVE"
            next_scene = "scene_5_exercise"
            message = f"¡Excelente! Aprobaste la microcomprobación ({correct_count}/4). Avanzas directamente a la práctica de RESUELVE."
        else:
            # Send to COMPRENDE proof entry
            self.advance_stage_scene(user_id, topic_code, "COMPRENDE", "scene_2_comprende_entry")
            next_stage = "COMPRENDE"
            next_scene = "scene_2_comprende_entry"
            message = f"Completaste la microcomprobación ({correct_count}/4). Para consolidar la base geométrica, iniciemos con la demostración en COMPRENDE."

        self.record_event(
            user_id=user_id,
            topic_code=topic_code,
            event_type="microcheck_completed",
            data={
                "correct_count": correct_count,
                "total": 4,
                "approved": approved,
                "results": results,
            },
        )

        return {
            "approved": approved,
            "correct_count": correct_count,
            "total": 4,
            "results": results,
            "next_stage": next_stage,
            "next_scene": next_scene,
            "message": message,
        }

    def get_current_adaptive_exercise(self, user_id: str, topic_code: str) -> Optional[Dict[str, Any]]:
        """Selects an exercise from the bank matching the student's current level."""
        first_state = (
            self.db.query(models.StudentSkillState)
            .filter_by(user_id=user_id, topic_code=topic_code)
            .first()
        )
        current_level = first_state.current_level if first_state else "basico"

        exercise = (
            self.db.query(models.ExerciseItem)
            .filter_by(topic_code=topic_code, level=current_level)
            .order_by(models.ExerciseItem.created_at)
            .first()
        )
        if not exercise:
            # Fallback to any non-microcheck exercise
            exercise = (
                self.db.query(models.ExerciseItem)
                .filter(models.ExerciseItem.topic_code == topic_code, models.ExerciseItem.level != "microcheck")
                .first()
            )

        if exercise:
            self.record_event(
                user_id=user_id,
                topic_code=topic_code,
                event_type="exercise_presented",
                data={"exercise_id": exercise.id, "level": exercise.level},
            )
            return exercise.to_dict()
        return None

    def submit_exercise_answer(
        self, user_id: str, topic_code: str, exercise_id: str, student_answer: str, hints_used: int = 0
    ) -> Dict[str, Any]:
        """Evaluates an exercise response and adapts level and domain indices."""
        exercise = self.db.query(models.ExerciseItem).filter_by(id=exercise_id).first()
        if not exercise:
            return {"error": "Exercise not found"}

        ans_clean = student_answer.strip().lower().replace(",", ".")
        correct_clean = exercise.correct_answer.strip().lower().replace(",", ".")

        # Special Case: Desafío del Estanque (Spec Section 10.4)
        # 12 is depth of water, NOT plant length (13)
        if exercise.level == "desafio" and ("12" in ans_clean and "13" not in ans_clean):
            self.record_event(
                user_id=user_id,
                topic_code=topic_code,
                event_type="answer_submitted",
                data={
                    "exercise_id": exercise.id,
                    "answer": student_answer,
                    "result": "incorrect_subgoal",
                    "error_type": "modeling",
                },
            )
            return {
                "correct": False,
                "error_type": "modeling",
                "feedback": (
                    "¡Cuidado! 12 m corresponde a la profundidad del estanque (el cateto vertical x), "
                    "pero la pregunta te pide la longitud total de la planta (la hipotenusa x + 1). "
                    "Suma 1 m a la profundidad para obtener la respuesta final."
                ),
            }

        # Check numeric tolerance or string match
        is_correct = False
        try:
            val_student = float(ans_clean.split()[0])
            val_correct = float(correct_clean.split()[0])
            if exercise.acceptable_range and len(exercise.acceptable_range) == 2:
                is_correct = exercise.acceptable_range[0] <= val_student <= exercise.acceptable_range[1]
            else:
                is_correct = abs(val_student - val_correct) <= 0.15
        except Exception:
            is_correct = correct_clean in ans_clean

        # Update Skill States
        states = (
            self.db.query(models.StudentSkillState)
            .filter_by(user_id=user_id, topic_code=topic_code)
            .all()
        )
        first_state = states[0] if states else None
        current_level = first_state.current_level if first_state else "basico"

        target_skills = exercise.microcompetency_codes or []
        for s in states:
            if s.microcompetency_code in target_skills or not target_skills:
                s.attempts_count += 1
                s.hints_used_count += hints_used

                if is_correct:
                    if hints_used == 0:
                        s.consecutive_correct += 1
                        s.consecutive_errors = 0
                        s.recent_r = min(100.0, s.recent_r + 25.0)
                        s.independence_i = 100.0
                    else:
                        s.consecutive_correct = 1
                        s.consecutive_errors = 0
                        s.recent_r = min(100.0, s.recent_r + 15.0)
                        s.independence_i = max(20.0, 100.0 - (hints_used * 25.0))

                    if current_level in ("avanzado", "desafio"):
                        s.advanced_a = min(100.0, s.advanced_a + 30.0)
                else:
                    s.consecutive_correct = 0
                    s.consecutive_errors += 1
                    s.recent_r = max(0.0, s.recent_r - 20.0)

                # Formula: D = 0.55R + 0.20I + 0.15A + 0.10V
                s.domain_index_d = (
                    0.55 * s.recent_r + 0.20 * s.independence_i + 0.15 * s.advanced_a + 0.10 * s.verification_v
                )

                # State Transitions based on D and Verification
                if s.domain_index_d == 0:
                    s.state = "no_explorado"
                elif s.domain_index_d < 60:
                    s.state = "en_proceso"
                elif 60 <= s.domain_index_d < 80:
                    s.state = "aprendido"
                elif 80 <= s.domain_index_d:
                    s.state = "aprendido_pendiente_verificacion"

        # Adaptive Level Progression: 2 consecutive correct without hints
        level_order = ["basico", "intermedio", "avanzado", "desafio"]
        next_level = current_level
        level_up = False

        max_consecutive = max((s.consecutive_correct for s in states), default=0)
        if is_correct and max_consecutive >= 2:
            curr_idx = level_order.index(current_level) if current_level in level_order else 0
            if curr_idx < len(level_order) - 1:
                next_level = level_order[curr_idx + 1]
                level_up = True
                for s in states:
                    s.current_level = next_level
                    s.consecutive_correct = 0
                self.record_event(
                    user_id=user_id,
                    topic_code=topic_code,
                    event_type="level_changed",
                    data={"from": current_level, "to": next_level, "reason": "2_consecutive_correct"},
                )

        self.db.commit()

        # Audit Event
        self.record_event(
            user_id=user_id,
            topic_code=topic_code,
            event_type="answer_submitted",
            data={
                "exercise_id": exercise_id,
                "answer": student_answer,
                "is_correct": is_correct,
                "hints_used": hints_used,
                "level": current_level,
            },
        )

        return {
            "correct": is_correct,
            "correct_answer": exercise.correct_answer,
            "solution_steps": exercise.solution_steps,
            "hints_used": hints_used,
            "current_level": next_level,
            "level_up": level_up,
            "feedback": (
                "¡Correcto! Excelente deducción."
                if is_correct
                else "No es el resultado esperado. Observa las pistas y comprueba los cálculos."
            ),
        }

    def get_teacher_class_summary(self, classroom_id: str, topic_code: str) -> Dict[str, Any]:
        """Computes summary metrics for a teacher's classroom on a topic."""
        members = (
            self.db.query(models.ClassroomMember)
            .filter_by(classroom_id=classroom_id, role="student")
            .all()
        )
        student_ids = [m.user_id for m in members]
        total_students = len(student_ids)

        if total_students == 0:
            return {
                "total_students": 0,
                "average_mastery": 0.0,
                "ready_to_advance": 0,
                "need_support": 0,
                "skills_chart": [],
            }

        states = (
            self.db.query(models.StudentSkillState)
            .filter(
                models.StudentSkillState.user_id.in_(student_ids),
                models.StudentSkillState.topic_code == topic_code,
            )
            .all()
        )

        # Average D per student
        student_averages = {}
        for s in states:
            student_averages.setdefault(s.user_id, []).append(s.domain_index_d)

        avg_list = [sum(v) / len(v) for v in student_averages.values() if v]
        overall_avg = sum(avg_list) / len(avg_list) if avg_list else 0.0

        ready_to_advance = sum(1 for a in avg_list if a >= 80.0)
        need_support = sum(1 for a in avg_list if a < 60.0)

        # Microcompetency breakdown (PIT-01..PIT-10)
        micros = (
            self.db.query(models.Microcompetency)
            .filter_by(topic_code=topic_code)
            .order_by(models.Microcompetency.order_index)
            .all()
        )
        skills_chart = []
        for m in micros:
            skill_states = [s for s in states if s.microcompetency_code == m.code]
            if skill_states:
                mastered_or_learned = sum(
                    1 for s in skill_states if s.state in ("aprendido", "aprendido_pendiente_verificacion", "dominado")
                )
                pct = round((mastered_or_learned / len(skill_states)) * 100, 1)
            else:
                pct = 0.0
            skills_chart.append({"code": m.code, "name": m.name, "mastery_percentage": pct})

        return {
            "classroom_id": classroom_id,
            "topic_code": topic_code,
            "total_students": total_students,
            "average_mastery": round(overall_avg, 1),
            "ready_to_advance": ready_to_advance,
            "need_support": need_support,
            "skills_chart": skills_chart,
        }

    def get_teacher_mastery_matrix(self, classroom_id: str, topic_code: str) -> Dict[str, Any]:
        """Builds the students x microcompetencies matrix with 6-state color coding."""
        members = (
            self.db.query(models.ClassroomMember)
            .filter_by(classroom_id=classroom_id, role="student")
            .all()
        )
        students = []
        micros = (
            self.db.query(models.Microcompetency)
            .filter_by(topic_code=topic_code)
            .order_by(models.Microcompetency.order_index)
            .all()
        )
        micro_codes = [m.code for m in micros]

        for m in members:
            user = self.db.query(models.User).filter_by(id=m.user_id).first()
            if not user:
                continue
            states = (
                self.db.query(models.StudentSkillState)
                .filter_by(user_id=user.id, topic_code=topic_code)
                .all()
            )
            state_dict = {s.microcompetency_code: s for s in states}

            skills_row = {}
            for c in micro_codes:
                st = state_dict.get(c)
                skills_row[c] = {
                    "state": st.state if st else "no_explorado",
                    "domain_d": round(st.domain_index_d, 1) if st else 0.0,
                    "attempts": st.attempts_count if st else 0,
                }

            students.append({
                "student_id": user.id,
                "student_name": user.name,
                "student_email": user.email,
                "skills": skills_row,
            })

        return {
            "classroom_id": classroom_id,
            "topic_code": topic_code,
            "microcompetencies": [{"code": m.code, "name": m.name} for m in micros],
            "matrix": students,
        }

    def get_student_overall_progress(self, user_id: str) -> Dict[str, Any]:
        """Returns the student's mastery summary across all topics they have engaged with or are in their curriculum."""
        states = (
            self.db.query(models.StudentSkillState)
            .filter_by(user_id=user_id)
            .all()
        )
        by_topic: Dict[str, List[models.StudentSkillState]] = {}
        for s in states:
            by_topic.setdefault(s.topic_code, []).append(s)

        progress: Dict[str, Dict[str, Any]] = {}
        completed_count = 0
        total_d = 0.0

        for topic_code, skill_states in by_topic.items():
            explored = [s.domain_index_d for s in skill_states if s.state != "no_explorado"]
            avg_d = sum(explored) / len(explored) if explored else 0.0

            # Compute coherent topic stage across all microcompetencies
            stages_rank = {"CONECTA": 1, "COMPRENDE": 2, "RESUELVE": 3, "COMPLETADO": 4}
            dominant_state = max(skill_states, key=lambda s: stages_rank.get(s.active_stage, 1)) if skill_states else None
            active_stage = dominant_state.active_stage if dominant_state else "CONECTA"
            active_scene = dominant_state.active_scene if dominant_state else "scene_0_intro"
            current_level = dominant_state.current_level if dominant_state else "basico"

            is_mastered = avg_d >= 80.0 or active_stage == "COMPLETADO" or (skill_states and all(s.state == "dominado" for s in skill_states))
            if is_mastered:
                completed_count += 1
            total_d += avg_d

            progress[topic_code] = {
                "topic_code": topic_code,
                "average_domain_d": round(avg_d, 2),
                "active_stage": active_stage,
                "active_scene": active_scene,
                "current_level": current_level,
                "is_mastered": is_mastered,
                "completed": is_mastered,
            }

        overall_avg_d = round(total_d / len(by_topic), 2) if by_topic else 0.0

        return {
            "user_id": user_id,
            "topics": progress,
            "overall_average_d": overall_avg_d,
            "completed_count": completed_count,
            "total_explored_topics": len(by_topic),
        }

    def mark_topic_completed(self, user_id: str, topic_code: str) -> Dict[str, Any]:
        """Validates that student completed the topic, sets mastery, and locks linear progression to practice-only mode."""
        states = (
            self.db.query(models.StudentSkillState)
            .filter_by(user_id=user_id, topic_code=topic_code)
            .all()
        )
        if not states:
            self.get_or_init_student_state(user_id=user_id, topic_code=topic_code)
            states = (
                self.db.query(models.StudentSkillState)
                .filter_by(user_id=user_id, topic_code=topic_code)
                .all()
            )

        for s in states:
            s.state = "dominado"
            s.active_stage = "COMPLETADO"
            s.active_scene = "completed"
            s.domain_index_d = max(s.domain_index_d, 85.0)
            s.last_evaluated_at = datetime.utcnow()
        self.db.commit()

        self.record_event(
            user_id=user_id,
            topic_code=topic_code,
            event_type="topic_mastered",
            data={"reason": "agent_validation_or_completion", "validated_d": 85.0},
        )

        return {
            "topic_code": topic_code,
            "status": "completed",
            "is_mastered": True,
            "average_domain_d": 85.0,
            "active_stage": "COMPLETADO",
        }

    def reset_student_topic_state(self, user_id: str, topic_code: str) -> Dict[str, Any]:
        """Resets the student's skill states for a topic back to the initial CONECTA stage."""
        states = (
            self.db.query(models.StudentSkillState)
            .filter_by(user_id=user_id, topic_code=topic_code)
            .all()
        )
        for s in states:
            s.state = "no_explorado"
            s.active_stage = "CONECTA"
            s.active_scene = "scene_0_intro"
            s.domain_index_d = 0.0
            s.recent_r = 0.0
            s.independence_i = 0.0
            s.advanced_a = 0.0
            s.verification_v = 0.0
            s.attempts_count = 0
            s.hints_used_count = 0
            s.consecutive_correct = 0
            s.consecutive_errors = 0
            s.current_level = "basico"
            s.last_evaluated_at = datetime.utcnow()
        self.db.commit()

        self.record_event(
            user_id=user_id,
            topic_code=topic_code,
            event_type="topic_started",
            data={"reason": "reset_to_start"},
        )

        return self.get_or_init_student_state(user_id=user_id, topic_code=topic_code)


