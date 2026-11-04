"""Unit and integration tests for the RAG pipeline components:
FileExtractor, SemanticChunker, VectorStore, WebSearch, and RetrievalService.
"""

import asyncio
import unittest
from unittest.mock import AsyncMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from ai.retrieval.chunker import SemanticChunker
from ai.retrieval.service import RetrievalService
from ai.retrieval.vector_store import VectorStore, fallback_text_embedding, cosine_similarity
from ai.retrieval.web_search import WebSearchEngine
from content.files.extractor import FileExtractor
from content.files.service import FilesService
from data.database import Base
from data.models import *


class TestFileExtractor(unittest.TestCase):
    def test_extract_txt(self):
        content = b"Line 1\nLine 2\nLine 3"
        sections = FileExtractor.extract(content, "sample.txt", "text/plain")
        self.assertEqual(len(sections), 1)
        self.assertIn("Line 1", sections[0]["text"])

    def test_extract_html(self):
        content = b"<html><head><title>Test</title></head><body><h1>Chapter 1</h1><p>Content paragraph.</p></body></html>"
        text = FileExtractor.extract_full_text(content, "page.html", "text/html")
        self.assertIn("Chapter 1", text)
        self.assertIn("Content paragraph.", text)
        self.assertNotIn("<p>", text)

    def test_extract_json(self):
        content = b'{"name": "Biology 101", "topics": ["cells", "genetics"]}'
        text = FileExtractor.extract_full_text(content, "course.json", "application/json")
        self.assertIn("Biology 101", text)
        self.assertIn("cells", text)

    def test_extract_csv(self):
        content = b"Name,Grade\nAlice,100\nBob,95"
        text = FileExtractor.extract_full_text(content, "grades.csv", "text/csv")
        self.assertIn("Alice", text)
        self.assertIn("100", text)


class TestSemanticChunker(unittest.TestCase):
    def test_chunk_with_headings(self):
        chunker = SemanticChunker(target_chunk_size=300, overlap_size=50)
        doc = """# Introduction to Physics
Physics is the natural science of matter, its fundamental constituents, and its motion through space and time.

## Classical Mechanics
Classical mechanics deals with the motion of bodies under the influence of a system of forces."""
        chunks = chunker.split_text(doc, source_name="physics.md")
        self.assertEqual(len(chunks), 2)
        self.assertIn("Introduction to Physics", chunks[0]["content"])
        self.assertIn("Classical Mechanics", chunks[1]["content"])
        self.assertEqual(chunks[0]["meta"]["source"], "physics.md")

    def test_chunk_large_paragraph_sentence_aware(self):
        chunker = SemanticChunker(target_chunk_size=200, overlap_size=40)
        long_text = (
            "Sentence one discusses photosynthesis in plant leaves. "
            "Sentence two explains how sunlight is absorbed by chlorophyll. "
            "Sentence three details the creation of ATP energy carriers. "
            "Sentence four concludes the light-dependent reaction cycle."
        )
        chunks = chunker.split_text(long_text, source_name="bio.txt")
        self.assertGreaterEqual(len(chunks), 2)
        for c in chunks:
            self.assertTrue(c["content"].endswith("."))


class TestVectorStore(unittest.TestCase):
    def test_embedding_and_similarity(self):
        vec1 = fallback_text_embedding("Photosynthesis in plants using sunlight")
        vec2 = fallback_text_embedding("Plants use light energy for photosynthesis")
        vec3 = fallback_text_embedding("Quantum computing with superconducting qubits")

        sim_related = cosine_similarity(vec1, vec2)
        sim_unrelated = cosine_similarity(vec1, vec3)

        self.assertGreater(sim_related, sim_unrelated)
        self.assertGreater(sim_related, 0.3)

    def test_save_and_search_chunks(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        db = sessionmaker(bind=engine)()

        vs = VectorStore()
        chunks = [
            {"content": "Mitochondria are the powerhouse of the eukaryotic cell.", "meta": {"topic": "biology"}},
            {"content": "Newton's second law states that Force equals mass times acceleration.", "meta": {"topic": "physics"}},
        ]

        saved = vs.save_chunks(db, chunks, collection_name="science")
        self.assertEqual(len(saved), 2)

        results = vs.search(db, query="What is the powerhouse of the cell?", top_k=1, collection_name="science")
        self.assertEqual(len(results), 1)
        self.assertIn("Mitochondria", results[0]["content"])
        self.assertGreater(results[0]["score"], 0.0)


class TestWebSearchEngine(unittest.TestCase):
    def test_search_tavily_mock(self):
        async def _run():
            with patch("httpx.AsyncClient.post") as mock_post:
                mock_post.return_value = AsyncMock(
                    status_code=200,
                    json=lambda: {
                        "results": [
                            {"title": "Result 1", "url": "https://example.com/1", "content": "Snippet 1"}
                        ]
                    },
                )
                res = await WebSearchEngine.search_tavily("test query", "fake-key", count=1)
                self.assertEqual(len(res), 1)
                self.assertEqual(res[0]["title"], "Result 1")
                self.assertEqual(res[0]["snippet"], "Snippet 1")
        asyncio.run(_run())


class TestRetrievalServiceIntegration(unittest.TestCase):
    def test_process_file_and_query(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        db = sessionmaker(bind=engine)()

        fs = FilesService(db)
        frec = fs.upload(
            user_id="user1",
            filename="calculus.txt",
            content_type="text/plain",
            contents=b"Derivatives measure the instantaneous rate of change of a function. Integrals measure accumulated area under a curve.",
        )

        rs = RetrievalService(db)
        proc = rs.process_file(frec.id, collection_name="math")
        self.assertTrue(proc["status"])
        self.assertGreaterEqual(proc["chunk_count"], 1)

        query_res = rs.query_doc("math", "instantaneous rate of change")
        self.assertGreaterEqual(len(query_res["results"]), 1)
        self.assertIn("Derivatives", query_res["results"][0]["content"])


if __name__ == "__main__":
    unittest.main()
