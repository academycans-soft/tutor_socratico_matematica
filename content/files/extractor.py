"""Text extraction utilities for various document formats."""

import csv
import io
import json
import logging
import os
import re
import zlib
from html.parser import HTMLParser
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)


class _HTMLTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.reset()
        self.fed = []
        self._skip = False

    def handle_starttag(self, tag, attrs):
        if tag.lower() in ("script", "style", "noscript"):
            self._skip = True
        elif tag.lower() in ("p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "br", "tr"):
            self.fed.append("\n")

    def handle_endtag(self, tag):
        if tag.lower() in ("script", "style", "noscript"):
            self._skip = False
        elif tag.lower() in ("p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr"):
            self.fed.append("\n")

    def handle_data(self, d):
        if not self._skip:
            self.fed.append(d)

    def get_data(self) -> str:
        text = "".join(self.fed)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()


def extract_html_text(html_content: str) -> str:
    parser = _HTMLTextExtractor()
    try:
        parser.feed(html_content)
        return parser.get_data()
    except Exception as exc:
        log.warning("HTML parsing error: %s. Using regex fallback.", exc)
        cleaned = re.sub(r"<(script|style).*?</\1>", "", html_content, flags=re.DOTALL | re.IGNORECASE)
        cleaned = re.sub(r"<[^>]+>", " ", cleaned)
        return re.sub(r"\s+", " ", cleaned).strip()


def extract_pdf_text_builtin(data: bytes) -> List[Dict[str, Any]]:
    """Extract text from PDF streams using standard zlib and BT...ET blocks."""
    # First attempt: if pypdf or PyPDF2 exists, use it
    for mod_name in ("pypdf", "PyPDF2"):
        try:
            pypdf = __import__(mod_name)
            reader = pypdf.PdfReader(io.BytesIO(data))
            results = []
            for i, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                if text.strip():
                    results.append({"page": i + 1, "text": text.strip()})
            if results:
                return results
        except Exception:
            pass

    # Built-in pure python stream extractor
    results = []
    # Find streams
    stream_pattern = re.compile(rb"stream\r?\n(.*?)\r?\nendstream", re.DOTALL)
    streams = stream_pattern.findall(data)

    extracted_pages_text = []
    page_text_acc = []

    for stream_data in streams:
        decompressed = b""
        try:
            decompressed = zlib.decompress(stream_data)
        except Exception:
            try:
                # Try raw deflate
                decompressed = zlib.decompress(stream_data, -15)
            except Exception:
                decompressed = stream_data

        try:
            text_str = decompressed.decode("latin1")
        except Exception:
            text_str = ""

        # Extract strings in BT ... ET blocks
        # e.g., (text) Tj or [(te)(xt)] TJ
        tj_simple = re.findall(r"\(([^)]+)\)\s*Tj", text_str)
        tj_array = re.findall(r"\[(.*?)\]\s*TJ", text_str, re.DOTALL)

        extracted_words = []
        if tj_simple:
            extracted_words.extend(tj_simple)
        if tj_array:
            for arr in tj_array:
                parts = re.findall(r"\(([^)]+)\)", arr)
                if parts:
                    extracted_words.append("".join(parts))

        if extracted_words:
            chunk = " ".join(extracted_words).strip()
            if len(chunk) > 10:
                page_text_acc.append(chunk)

    if page_text_acc:
        full_text = "\n\n".join(page_text_acc)
        results.append({"page": 1, "text": full_text})
    else:
        # Fallback to readable ASCII strings of sufficient length
        ascii_strings = re.findall(rb"[\x20-\x7E\r\n\t]{6,}", data)
        readable_text = "\n".join(
            s.decode("latin1", errors="ignore")
            for s in ascii_strings
            if not s.startswith(rb"%PDF") and not s.startswith(rb"obj") and not s.startswith(rb"endobj")
        )
        if readable_text.strip():
            results.append({"page": 1, "text": readable_text.strip()})

    return results


class FileExtractor:
    """Universal text extractor for user uploads and documents."""

    @staticmethod
    def extract(content: bytes, filename: str, content_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Extract structured text sections from file contents.

        Returns a list of dicts: [{"text": str, "page": Optional[int], "heading": Optional[str]}]
        """
        ext = os.path.splitext(filename or "")[1].lower()

        # PDF files
        if ext == ".pdf" or (content_type and "pdf" in content_type.lower()):
            pdf_sections = extract_pdf_text_builtin(content)
            if pdf_sections:
                return pdf_sections
            return [{"text": "", "page": 1}]

        # HTML files
        if ext in (".html", ".htm") or (content_type and "html" in content_type.lower()):
            raw_text = content.decode("utf-8", errors="replace")
            cleaned = extract_html_text(raw_text)
            return [{"text": cleaned, "page": 1}]

        # JSON files
        if ext == ".json" or (content_type and "json" in content_type.lower()):
            try:
                raw_text = content.decode("utf-8", errors="replace")
                data = json.loads(raw_text)
                formatted = json.dumps(data, indent=2, ensure_ascii=False)
                return [{"text": formatted, "page": 1}]
            except Exception:
                pass

        # CSV files
        if ext == ".csv" or (content_type and "csv" in content_type.lower()):
            try:
                raw_text = content.decode("utf-8", errors="replace")
                reader = csv.reader(io.StringIO(raw_text))
                lines = [", ".join(row) for row in reader if row]
                return [{"text": "\n".join(lines), "page": 1}]
            except Exception:
                pass

        # Plain text, markdown, code, and default fallback
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text = content.decode("latin1")
            except Exception:
                text = content.decode("utf-8", errors="replace")

        # Normalize line endings
        text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
        return [{"text": text, "page": 1}]

    @classmethod
    def extract_full_text(cls, content: bytes, filename: str, content_type: Optional[str] = None) -> str:
        sections = cls.extract(content, filename, content_type)
        return "\n\n".join(s["text"] for s in sections if s.get("text")).strip()
