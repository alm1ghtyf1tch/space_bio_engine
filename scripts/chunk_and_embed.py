#!/usr/bin/env python3
# scripts/chunk_and_embed.py
"""
Read JSON files from data/texts/, chunk text, compute embeddings using sentence-transformers,
and save a FAISS index + metadata to data/embeddings/
"""
import os
import glob
import json
from sentence_transformers import SentenceTransformer
import numpy as np
import faiss
from tqdm import tqdm
import math

IN_DIR = os.path.join("data", "texts")
OUT_DIR = os.path.join("data", "embeddings")
os.makedirs(OUT_DIR, exist_ok=True)

MODEL_NAME = "all-MiniLM-L6-v2"
CHUNK_CHARS = 800  # approx 200-300 tokens (character-based chunking for speed)

def load_json_files(in_dir):
    files = sorted(glob.glob(os.path.join(in_dir, "*.json")))
    docs = []
    for p in files:
        try:
            j = json.load(open(p, encoding="utf-8"))
        except Exception as e:
            print("Error reading", p, e)
            continue
        docs.append(j)
    return docs

def chunk_text(text, size=CHUNK_CHARS):
    text = text.strip()
    if not text:
        return []
    chunks = []
    for i in range(0, len(text), size):
        chunk = text[i:i+size].strip()
        if len(chunk) >= 30:
            chunks.append(chunk)
    return chunks

def main():
    docs = load_json_files(IN_DIR)
    model = SentenceTransformer(MODEL_NAME)
    passages = []
    metadata = []
    for doc in docs:
        pid = doc.get("paper_id", "unknown")
        title = doc.get("title","")
        sections = doc.get("sections", {})
        for section_name, text in sections.items():
            if not text:
                continue
            chs = chunk_text(text, CHUNK_CHARS)
            for i, ch in enumerate(chs):
                passages.append(ch)
                metadata.append({
                    "paper_id": pid,
                    "title": title,
                    "section": section_name,
                    "chunk_id": i
                })

    if not passages:
        print("No passages found in", IN_DIR)
        return

    print(f"Computing embeddings for {len(passages)} passages using {MODEL_NAME} ...")
    embeddings = model.encode(passages, show_progress_bar=True, convert_to_numpy=True)
    embeddings = embeddings.astype("float32")
    dim = embeddings.shape[1]

    index = faiss.IndexFlatL2(dim)
    index.add(embeddings)
    faiss.write_index(index, os.path.join(OUT_DIR, "spacebio.index"))
    json.dump(metadata, open(os.path.join(OUT_DIR, "metadata.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    # Save a small sample of passages for debugging / frontend use
    json.dump({"passages": passages[:200]}, open(os.path.join(OUT_DIR, "sample_passages.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("Saved index and metadata to", OUT_DIR)

if __name__ == "__main__":
    main()
