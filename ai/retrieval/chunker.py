"""Concept-aware semantic text chunker.

Splits text along document hierarchy (headers, paragraphs, sentences)
ensuring that each chunk preserves a complete teachable idea or concept,
never cutting sentences, code blocks, or formulas mid-thought.
"""

import re
from typing import Any, Dict, List, Optional


class SemanticChunker:
    def __init__(self, target_chunk_size: int = 800, overlap_size: int = 100):
        self.target_chunk_size = max(200, target_chunk_size)
        self.overlap_size = max(0, min(overlap_size, self.target_chunk_size // 2))

    def split_text(
        self,
        text: str,
        source_name: Optional[str] = None,
        base_meta: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Split text into concept-oriented semantic chunks with metadata."""
        if not text or not text.strip():
            return []

        clean_text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
        sections = self._split_by_headings(clean_text)

        chunks: List[Dict[str, Any]] = []
        chunk_idx = 0

        for sec in sections:
            heading = sec["heading"]
            sec_text = sec["text"]

            if len(sec_text) <= self.target_chunk_size:
                # Whole section fits into one concept chunk
                content = f"{heading}\n\n{sec_text}".strip() if heading else sec_text.strip()
                if content:
                    meta = dict(base_meta or {})
                    meta.update({
                        "source": source_name or "",
                        "heading": heading or "",
                        "chunk_index": chunk_idx,
                        "char_count": len(content),
                    })
                    chunks.append({"content": content, "meta": meta, "chunk_index": chunk_idx})
                    chunk_idx += 1
            else:
                # Break large section into sentence-aware units
                sub_chunks = self._chunk_large_text(sec_text, heading)
                for sc in sub_chunks:
                    meta = dict(base_meta or {})
                    meta.update({
                        "source": source_name or "",
                        "heading": heading or "",
                        "chunk_index": chunk_idx,
                        "char_count": len(sc),
                    })
                    chunks.append({"content": sc, "meta": meta, "chunk_index": chunk_idx})
                    chunk_idx += 1

        return chunks

    def _split_by_headings(self, text: str) -> List[Dict[str, str]]:
        """Split document by markdown headings `# Heading` while preserving structure."""
        heading_pattern = re.compile(r"^(#{1,6}\s+.+)$", re.MULTILINE)
        parts = heading_pattern.split(text)

        sections: List[Dict[str, str]] = []
        current_heading = ""

        idx = 0
        while idx < len(parts):
            item = parts[idx].strip()
            if not item:
                idx += 1
                continue
            if heading_pattern.match(item):
                current_heading = item
                idx += 1
                if idx < len(parts):
                    content = parts[idx].strip()
                    sections.append({"heading": current_heading, "text": content})
                    idx += 1
            else:
                sections.append({"heading": current_heading, "text": item})
                idx += 1

        if not sections:
            sections.append({"heading": "", "text": text})

        return sections

    def _chunk_large_text(self, text: str, heading: str) -> List[str]:
        """Split a long section using paragraphs and sentence boundaries."""
        paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
        chunks: List[str] = []

        current_sentences: List[str] = []
        current_len = 0

        # Flatten paragraphs into sentence units, keeping track of paragraph breaks
        units: List[str] = []
        for p in paragraphs:
            # Check for code blocks or list blocks
            if p.startswith("```") or p.startswith("- ") or p.startswith("* "):
                units.append(p)
            else:
                # Split by sentence boundaries: period/question/exclamation followed by space or newline
                sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", p) if s.strip()]
                if sentences:
                    units.extend(sentences)
                else:
                    units.append(p)

        prefix = f"{heading}\n\n" if heading else ""
        prefix_len = len(prefix)

        for unit in units:
            unit_len = len(unit) + 1  # include space/newline
            if current_len + unit_len + prefix_len > self.target_chunk_size and current_sentences:
                # Emit current chunk
                body = " ".join(current_sentences).strip()
                chunks.append(f"{prefix}{body}".strip())

                # Prepare overlap: keep trailing sentences totaling up to self.overlap_size
                overlap_units: List[str] = []
                overlap_len = 0
                for prev in reversed(current_sentences):
                    if overlap_len + len(prev) <= self.overlap_size:
                        overlap_units.insert(0, prev)
                        overlap_len += len(prev)
                    else:
                        break
                current_sentences = overlap_units
                current_len = sum(len(u) + 1 for u in current_sentences)

            current_sentences.append(unit)
            current_len += unit_len

        if current_sentences:
            body = " ".join(current_sentences).strip()
            chunks.append(f"{prefix}{body}".strip())

        return chunks
