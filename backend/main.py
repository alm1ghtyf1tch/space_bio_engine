# backend/main.py
import os
import glob
import json
from typing import List, Optional
from fastapi import FastAPI, Query, HTTPException, Body
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import numpy as np
import faiss
from fastapi.middleware.cors import CORSMiddleware
from transformers import pipeline

# ----- CONFIG -----
EMBEDDINGS_DIR = os.path.join("data", "embeddings")
TEXTS_DIR = os.path.join("data", "texts")
MODEL_NAME = "all-MiniLM-L6-v2"
DEFAULT_K = 5
FEEDBACK_PATH = os.path.join("data", "feedback.json")
def _append_feedback(obj):
    try:
        if os.path.exists(FEEDBACK_PATH):
            arr = json.load(open(FEEDBACK_PATH, encoding="utf-8"))
        else:
            arr = []
        arr.append(obj)
        json.dump(arr, open(FEEDBACK_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False

app = FastAPI(title="SpaceBio Engine (Simple API)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",
        "https://space-bio-engine-beta.vercel.app"
    ],  # Allow Vercel frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load summarization pipeline once at startup
summarizer = pipeline("summarization", model="facebook/bart-large-cnn", device=-1)  # Force CPU to avoid MPS errors on Mac

# ----- UTIL: find index and metadata paths -----
def find_index_and_metadata():
    # look for any .index file in embeddings dir (handles your spacebar.index)
    idx_files = glob.glob(os.path.join(EMBEDDINGS_DIR, "*.index"))
    if not idx_files:
        raise FileNotFoundError(f"No .index file found in {EMBEDDINGS_DIR}.")
    index_path = idx_files[0]
    meta_path_candidates = [
        os.path.join(EMBEDDINGS_DIR, "metadata.json"),
        os.path.join(EMBEDDINGS_DIR, "metadata.json".lower())
    ]
    metadata_path = None
    for c in meta_path_candidates:
        if os.path.exists(c):
            metadata_path = c
            break
    if metadata_path is None:
        # fallback: try any .json in embeddings directory
        jsons = glob.glob(os.path.join(EMBEDDINGS_DIR, "*.json"))
        if jsons:
            metadata_path = jsons[0]
        else:
            raise FileNotFoundError(f"No metadata json found in {EMBEDDINGS_DIR}.")
    sample_passages_path = os.path.join(EMBEDDINGS_DIR, "sample_passages.json")
    return index_path, metadata_path, (sample_passages_path if os.path.exists(sample_passages_path) else None)

INDEX_PATH, METADATA_PATH, SAMPLE_PASSAGES_PATH = find_index_and_metadata()

# ----- LOAD MODEL + INDEX + METADATA -----
print("Loading embedding model:", MODEL_NAME)
model = SentenceTransformer(MODEL_NAME)

print("Loading FAISS index:", INDEX_PATH)
index = faiss.read_index(INDEX_PATH)

print("Loading metadata:", METADATA_PATH)
with open(METADATA_PATH, "r", encoding="utf-8") as f:
    metadata = json.load(f)

sample_passages = {}
if SAMPLE_PASSAGES_PATH:
    with open(SAMPLE_PASSAGES_PATH, "r", encoding="utf-8") as f:
        sample_passages = json.load(f)

# ----- small helpers -----
def get_snippet_for_index(idx: int) -> Optional[str]:
    try:
        return sample_passages.get("passages", [])[idx]
    except Exception:
        return None

def get_text_record_link(paper_id: str) -> Optional[str]:
    # attempt to load the JSON saved in data/texts/<paper_id>.json and return its "link" if present
    candidate = os.path.join(TEXTS_DIR, f"{paper_id}.json")
    if os.path.exists(candidate):
        try:
            j = json.load(open(candidate, encoding="utf-8"))
            return j.get("link") or j.get("url") or None
        except Exception:
            return None
    return None

# naive polarity detection (rule-based)
def detect_polarity_from_text(text: str) -> str:
    if not text:
        return "unclear"
    t = text.lower()
    # strong indicators of increase
    inc_keywords = ["increase", "increased", "enhanced", "higher", "improved", "promote", "stimulat"]
    dec_keywords = ["decrease", "decreased", "reduced", "reduction", "inhibit", "lower", "suppres"]
    no_effect_phrases = ["no significant", "no effect", "not significantly", "no change", "no difference"]
    for ph in no_effect_phrases:
        if ph in t:
            return "no_effect"
    for kw in inc_keywords:
        if kw in t:
            return "increase"
    for kw in dec_keywords:
        if kw in t:
            return "decrease"
    return "unclear"

def aggregate_polarities(pol_list: List[str]):
    counts = {}
    for p in pol_list:
        counts[p] = counts.get(p, 0) + 1
    # determine primary polarity and confidence
    total = sum(counts.values()) or 1
    sorted_counts = sorted(counts.items(), key=lambda x: x[1], reverse=True)
    primary, primary_count = sorted_counts[0]
    primary_pct = primary_count / total
    # verdict rules
    if primary == "unclear" and total <= 2:
        verdict = "Insufficient evidence"
    elif primary_pct >= 0.7:
        verdict = "Agree"
    elif primary_pct >= 0.45:
        verdict = "Mixed"
    else:
        verdict = "Mixed"
    return {"counts": counts, "primary": primary, "pct": primary_pct, "verdict": verdict}

# ----- API MODELS -----
class EvidenceCard(BaseModel):
    paper_id: str
    title: Optional[str]
    section: Optional[str]
    snippet: Optional[str]
    link: Optional[str]

class QAResponse(BaseModel):
    query: str
    answer: str
    verdict: str
    confidence: float
    evidence: List[EvidenceCard]

# ----- ENDPOINTS -----
@app.get("/health")
def health():
    return {"status": "ok", "num_passages": len(metadata)}

@app.get("/search")
def search(q: str = Query(..., description="Query string"), k: int = Query(DEFAULT_K)):
    q_emb = model.encode([q]).astype("float32")
    D, I = index.search(q_emb, k)
    results = []
    for dist, idx in zip(D[0], I[0]):
        meta = metadata[idx] if idx < len(metadata) else {}
        snippet = get_snippet_for_index(idx)
        # if snippet missing, we can try to load the section from data/texts (fallback; slower)
        results.append({
            "score": float(dist),
            "meta": meta,
            "snippet": snippet
        })
    return {"query": q, "k": k, "results": results}

@app.get("/qa", response_model=QAResponse)
def qa(q: str = Query(..., description="Question / Query"), k: int = Query(10, description="Number of passages to retrieve")):
    # 1) retrieve top-k passages
    q_emb = model.encode([q]).astype("float32")
    D, I = index.search(q_emb, k)
    evidence = []
    polarities = []
    titles_seen = set()
    for dist, idx in zip(D[0], I[0]):
        if idx >= len(metadata):
            continue
        meta = metadata[idx]
        pid = meta.get("paper_id") or f"idx_{idx}"
        title = meta.get("title") or None
        section = meta.get("section") or None
        snippet = get_snippet_for_index(idx) or meta.get("excerpt") or ""
        link = get_text_record_link(pid)
        if title and title not in titles_seen:
            titles_seen.add(title)
        p = detect_polarity_from_text(snippet)
        polarities.append(p)
        evidence.append({"paper_id": pid, "title": title, "section": section, "snippet": snippet, "link": link})

    # 2) aggregate polarities into verdict
    agg = aggregate_polarities(polarities)
    verdict = agg["verdict"]
    confidence = round(float(agg["pct"]), 3)

    # 3) generate short answer sentence (naive)
    primary = agg["primary"]
    if verdict == "Insufficient evidence":
        answer = "There is not enough clear information in the retrieved passages to form a confident conclusion."
    elif verdict == "Agree":
        if primary == "increase":
            answer = "Most retrieved studies report an increase or enhancement for the queried phenomenon."
        elif primary == "decrease":
            answer = "Most retrieved studies report a decrease or inhibition for the queried phenomenon."
        elif primary == "no_effect":
            answer = "Most retrieved studies report no significant effect for the queried phenomenon."
        else:
            answer = "Most retrieved passages share a common direction, but it is described in qualitative terms."
    else:
        # Mixed
        answer = "The literature is mixed: retrieved passages show varying outcomes (increase, decrease, or no effect). See evidence below."

    # limit evidence to top 6
    evidence_limited = [EvidenceCard(**e) for e in evidence[:6]]
    return {"query": q, "answer": answer, "verdict": verdict, "confidence": confidence, "evidence": evidence_limited}

@app.get("/paper/{paper_id}")
def get_paper(paper_id: str):
    """
    Return the JSON file saved by extract_text.py for the requested paper_id.
    Accepts either 'PMCxxxxxx' or 'pmc_articles_PMCxxxxxx' as paper_id.
    """
    # Always check both possible filename patterns
    candidates = [
        os.path.join("data", "texts", f"{paper_id}.json"),
        os.path.join("data", "texts", f"pmc_articles_{paper_id}.json"),
        os.path.join("data", "texts", f"{paper_id.lower()}.json"),
        os.path.join("data", "texts", f"pmc_articles_{paper_id.lower()}.json")
    ]
    path = next((p for p in candidates if os.path.exists(p)), None)
    if not path:
        raise HTTPException(status_code=404, detail="paper not found")
    try:
        with open(path, "r", encoding="utf-8") as f:
            j = json.load(f)
        # Ensure illustrations is a list
        if "illustrations" in j:
            if isinstance(j["illustrations"], tuple):
                j["illustrations"] = list(j["illustrations"])
            elif isinstance(j["illustrations"], str):
                import ast
                try:
                    val = ast.literal_eval(j["illustrations"])
                    if isinstance(val, (list, tuple)):
                        j["illustrations"] = list(val)
                    else:
                        j["illustrations"] = []
                except Exception:
                    j["illustrations"] = []
        return j
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"error reading paper: {e}")
    
@app.post("/feedback")
def feedback(payload: dict = Body(...)):
    """
    Accepts JSON like: {"paper_id":"pmc_articles_PMC3603133","type":"useful|not_useful|wrong","note":"optional note"}
    Stores into data/feedback.json
    """
    ok = _append_feedback(payload)
    if not ok:
        raise HTTPException(status_code=500, detail="Could not save feedback")
    return {"status":"ok"}


@app.get("/search_metadata")
def search_metadata():
    """
    Return small stats: counts per section in metadata (fast summary)
    """
    counts = {}
    for m in metadata:
        sec = m.get("section") or "unknown"
        counts[sec] = counts.get(sec, 0) + 1
    return {"num_passages": len(metadata), "by_section": counts}

def summarize_text_local(text: str, max_length: int = 120, min_length: int = 40) -> str:
    max_chunk = 1024
    if not text or len(text.strip()) < 50:
        return "No sufficient text to summarize."
    if len(text) > max_chunk:
        text = text[:max_chunk]
    try:
        summary = summarizer(text, max_length=max_length, min_length=min_length, do_sample=False)
        return summary[0]['summary_text']
    except Exception as e:
        print(f"Summarization error: {e}")
        return "Error: Could not generate summary."

def summarize_text_flexible(text: str, max_length: int = 1000, min_length: int = 200) -> str:
    max_chunk = 2048
    if not text or len(text.strip()) < 50:
        return "No sufficient text to summarize."
    if len(text) > max_chunk:
        text = text[:max_chunk]
    try:
        summary = summarizer(text, max_length=max_length, min_length=min_length, do_sample=False)
        return summary[0]['summary_text']
    except Exception as e:
        print(f"Summarization error: {e}")
        return "Error: Could not generate summary."

def clean_text_for_summary(text: str) -> str:
    import re
    # Remove parenthetical citations with 'et al.' and year
    text = re.sub(r'\(.*?et al\.,? ?\d{4}.*?\)', '', text)
    # Remove all URLs
    text = re.sub(r'https?://\S+', '', text)
    # Remove any remaining parenthetical citations (e.g., (Author, Year))
    text = re.sub(r'\([^)]+\d{4}[^)]*\)', '', text)
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

@app.get("/paper_summarized/{paper_id}")
def get_paper_summarized(paper_id: str):
    # Normalize paper_id for candidate filenames
    pid_variants = [paper_id, paper_id.lower()]
    if not paper_id.startswith("pmc_articles_"):
        pid_variants += [f"pmc_articles_{paper_id}", f"pmc_articles_{paper_id.lower()}"]
    candidates = [os.path.join("data", "texts", f"{pid}.json") for pid in pid_variants]
    path = next((p for p in candidates if os.path.exists(p)), None)
    print(f"[DEBUG] Reading file: {path}")
    if not path:
        raise HTTPException(status_code=404, detail="paper not found")
    try:
        with open(path, "r", encoding="utf-8") as f:
            j = json.load(f)
        print(f"[DEBUG] Top-level keys: {list(j.keys())}")
        # Try to get figures from top-level, then from sections
        illustrations = []
        figures_top = j.get("figures")
        figures_sections = None
        sections = j.get("sections", {})
        if not figures_top and isinstance(sections, dict):
            figures_sections = sections.get("figures")
        print(f"[DEBUG] Figures found (top-level): {figures_top}")
        print(f"[DEBUG] Figures found (sections): {figures_sections}")
        if isinstance(figures_top, list):
            illustrations = figures_top
        elif isinstance(figures_sections, list):
            illustrations = figures_sections
        # Only join string values for summary
        full_text = "\n\n".join(str(v) for v in sections.values() if isinstance(v, str))
        # Clean text before summarization
        cleaned_text = clean_text_for_summary(full_text)
        summary = summarize_text_flexible(cleaned_text)
        # Also extract image URLs from section text
        for sec in sections.values():
            if isinstance(sec, str) and "http" in sec:
                import re
                urls = re.findall(r'(https?://[^\s]+\.(?:png|jpg|jpeg|gif))', sec)
                illustrations.extend(urls)
        illustrations = [url for url in set(illustrations) if url]
        print(f"[DEBUG] Final illustrations returned: {illustrations}")
        return {
            "paper_id": paper_id,
            "title": j.get("title"),
            "summary": summary,
            "link": j.get("link"),
            "illustrations": illustrations[:6]
        }
    except Exception as e:
        print(f"Summary endpoint error for {paper_id}: {e}")
        return {
            "paper_id": paper_id,
            "title": None,
            "summary": f"Error: Could not generate summary. ({e})",
            "link": None,
            "illustrations": []
        }