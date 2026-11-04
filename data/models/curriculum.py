"""Curricular Graph, Pedagogical State Machine, and Exercise Bank models."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from data.database import Base


class CurriculumGrade(Base):
    __tablename__ = "curriculum_grades"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)  # e.g., "8.° EGB", "1.° BGU"
    level_group = Column(String(50), nullable=False)  # "EGB Media", "EGB Superior", "BGU"
    order_index = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    units = relationship("CurriculumUnit", back_populates="grade", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        all_units = [u.to_dict() for u in sorted(self.units, key=lambda x: x.order_index)] if self.units else []
        trimesters_map = {1: [], 2: [], 3: []}
        for u in all_units:
            trim = u.get("trimester", 1)
            trimesters_map.setdefault(trim, []).append(u)
        trimesters = [
            {"number": 1, "name": "1.er Trimestre", "units": trimesters_map.get(1, [])},
            {"number": 2, "name": "2.° Trimestre", "units": trimesters_map.get(2, [])},
            {"number": 3, "name": "3.er Trimestre", "units": trimesters_map.get(3, [])},
        ]
        return {
            "id": self.id,
            "name": self.name,
            "level_group": self.level_group,
            "order_index": self.order_index,
            "trimesters": trimesters,
            "units": all_units,
        }


class CurriculumUnit(Base):
    __tablename__ = "curriculum_units"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    grade_id = Column(String(36), ForeignKey("curriculum_grades.id"), nullable=False, index=True)
    trimester = Column(Integer, default=1, nullable=False)  # 1, 2, or 3
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    grade = relationship("CurriculumGrade", back_populates="units")
    topics = relationship("CurriculumTopic", back_populates="unit", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "grade_id": self.grade_id,
            "trimester": self.trimester or 1,
            "title": self.title,
            "description": self.description,
            "order_index": self.order_index,
            "topics": [t.to_dict() for t in sorted(self.topics, key=lambda x: x.order_index)] if self.topics else [],
        }


class CurriculumTopic(Base):
    __tablename__ = "curriculum_topics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(50), unique=True, nullable=False, index=True)  # e.g., "MATH-PITAGORAS"
    unit_id = Column(String(36), ForeignKey("curriculum_units.id"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    subtitle = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    stage_initial = Column(String(50), default="CONECTA", nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    status = Column(String(50), default="published", nullable=False)  # draft, staging_review, published
    author_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    staged_content = Column(JSON, nullable=True)  # AI-generated content package awaiting review/approval
    meta = Column(JSON, nullable=True)  # Pilot configs, parameters, assets
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    unit = relationship("CurriculumUnit", back_populates="topics")
    microcompetencies = relationship("Microcompetency", back_populates="topic", cascade="all, delete-orphan")
    exercises = relationship("ExerciseItem", back_populates="topic", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "code": self.code,
            "unit_id": self.unit_id,
            "title": self.title,
            "subtitle": self.subtitle,
            "description": self.description,
            "stage_initial": self.stage_initial,
            "order_index": self.order_index,
            "status": self.status or "published",
            "author_id": self.author_id,
            "staged_content": self.staged_content,
            "meta": self.meta or {},
            "microcompetencies": [m.to_dict() for m in sorted(self.microcompetencies, key=lambda x: x.order_index)] if self.microcompetencies else [],
            "exercises_count": len(self.exercises) if self.exercises else 0,
        }


class Microcompetency(Base):
    __tablename__ = "microcompetencies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(50), nullable=False, index=True)  # e.g., "PIT-01"
    topic_id = Column(String(36), ForeignKey("curriculum_topics.id"), nullable=False, index=True)
    topic_code = Column(String(50), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    prerequisites = Column(JSON, default=list, nullable=False)  # List[str] codes e.g. ["PIT-01"]
    order_index = Column(Integer, default=0, nullable=False)

    topic = relationship("CurriculumTopic", back_populates="microcompetencies")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "code": self.code,
            "topic_code": self.topic_code,
            "name": self.name,
            "description": self.description,
            "prerequisites": self.prerequisites or [],
            "order_index": self.order_index,
        }


class StudentSkillState(Base):
    __tablename__ = "student_skill_states"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    topic_code = Column(String(50), nullable=False, index=True)
    microcompetency_code = Column(String(50), nullable=False, index=True)
    state = Column(
        String(50),
        default="no_explorado",
        nullable=False,
    )  # no_explorado, en_proceso, aprendido, aprendido_pendiente_verificacion, dominado, requiere_revision
    domain_index_d = Column(Float, default=0.0, nullable=False)
    recent_r = Column(Float, default=0.0, nullable=False)
    independence_i = Column(Float, default=0.0, nullable=False)
    advanced_a = Column(Float, default=0.0, nullable=False)
    verification_v = Column(Float, default=0.0, nullable=False)
    attempts_count = Column(Integer, default=0, nullable=False)
    hints_used_count = Column(Integer, default=0, nullable=False)
    consecutive_correct = Column(Integer, default=0, nullable=False)
    consecutive_errors = Column(Integer, default=0, nullable=False)
    current_level = Column(String(50), default="basico", nullable=False)  # basico, intermedio, avanzado, desafio
    active_stage = Column(String(50), default="CONECTA", nullable=False)  # CONECTA, COMPRENDE, RESUELVE
    active_scene = Column(String(50), default="intro", nullable=False)
    last_evaluated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "topic_code": self.topic_code,
            "microcompetency_code": self.microcompetency_code,
            "state": self.state,
            "domain_index_d": round(self.domain_index_d, 2),
            "recent_r": round(self.recent_r, 2),
            "independence_i": round(self.independence_i, 2),
            "advanced_a": round(self.advanced_a, 2),
            "verification_v": round(self.verification_v, 2),
            "attempts_count": self.attempts_count,
            "hints_used_count": self.hints_used_count,
            "consecutive_correct": self.consecutive_correct,
            "consecutive_errors": self.consecutive_errors,
            "current_level": self.current_level,
            "active_stage": self.active_stage,
            "active_scene": self.active_scene,
            "last_evaluated_at": self.last_evaluated_at.isoformat() if self.last_evaluated_at else None,
        }


class PedagogicalEvent(Base):
    __tablename__ = "pedagogical_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    topic_code = Column(String(50), nullable=False, index=True)
    event_type = Column(
        String(50),
        nullable=False,
        index=True,
    )  # topic_started, microcheck_completed, resource_opened, resource_repeated, exercise_presented,
    # answer_submitted, hint_requested, exercise_completed, level_changed, skill_state_changed, topic_mastered
    event_data = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "topic_code": self.topic_code,
            "event_type": self.event_type,
            "event_data": self.event_data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ExerciseItem(Base):
    __tablename__ = "exercise_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    topic_id = Column(String(36), ForeignKey("curriculum_topics.id"), nullable=False, index=True)
    topic_code = Column(String(50), nullable=False, index=True)
    level = Column(
        String(50),
        nullable=False,
        index=True,
    )  # microcheck, basico, intermedio, avanzado, desafio
    microcompetency_codes = Column(JSON, default=list, nullable=False)  # List[str]
    title = Column(String(255), nullable=False)
    statement = Column(Text, nullable=False)
    figure_type = Column(String(100), nullable=True)  # room, triangle, ladder, diagonal_bar, pond
    data_params = Column(JSON, default=dict, nullable=True)  # dynamic parameters for problem generator
    correct_answer = Column(String(100), nullable=False)
    acceptable_range = Column(JSON, nullable=True)  # [min, max] or [acceptable numeric values]
    unit = Column(String(50), nullable=True)  # e.g., "m", "cm", "unidades"
    hints = Column(JSON, default=dict, nullable=True)  # {"level_1": "...", "level_2": "...", "level_3": "..."}
    solution_steps = Column(JSON, default=list, nullable=True)  # List[str]
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    topic = relationship("CurriculumTopic", back_populates="exercises")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "topic_code": self.topic_code,
            "level": self.level,
            "microcompetency_codes": self.microcompetency_codes,
            "title": self.title,
            "statement": self.statement,
            "figure_type": self.figure_type,
            "data_params": self.data_params or {},
            "correct_answer": self.correct_answer,
            "acceptable_range": self.acceptable_range,
            "unit": self.unit,
            "hints": self.hints or {},
            "solution_steps": self.solution_steps or [],
        }
