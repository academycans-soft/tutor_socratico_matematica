"""Document chunk model for RAG and semantic retrieval."""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import Column, DateTime, Integer, JSON, String, Text

from data.database import Base


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_id = Column(String(36), nullable=True, index=True)
    collection_name = Column(String(255), nullable=True, index=True)
    chunk_index = Column(Integer, default=0, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(JSON, nullable=True)  # List[float] embedding vector
    meta = Column(JSON, nullable=True)  # {name, source, page, heading, ...}
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "file_id": self.file_id,
            "collection_name": self.collection_name,
            "chunk_index": self.chunk_index,
            "content": self.content,
            "meta": self.meta or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
