# 🚀 Space Bio Engine

Space Bio Engine is an MVP web application that enables semantic search across NASA space biology publications and provides concise, plain-language summaries of research using an LLM. The goal is to make complex space bioscience research accessible and actionable — even for non-specialists and young learners.

Development crew - Inkarbay Abilmansur, Medethan Adina, Yeraliev Ulan

---

[![Made with FastAPI](https://img.shields.io/badge/backend-FastAPI-blue)](https://fastapi.tiangolo.com/) [![Frontend: React](https://img.shields.io/badge/frontend-React-%23282c34)](https://reactjs.org/) [![Embeddings: SentenceTransformers](https://img.shields.io/badge/embeddings-Sentence--Transformers-orange)](https://www.sbert.net/) [![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

---

## 🔎 Overview

Space Bio Engine allows users to:

- Perform **semantic search** over a curated collection of NASA Space Biology publications (vector search + FAISS).
- Click search results and view **structured, plain-language summaries** produced by an LLM (Intro → Key Points → Contrast/Limitations → Outro).
- Open or copy links to original publications for deeper inspection.
- Browse extracted sections (Abstract, Results, Conclusion) and view LLM-generated summaries side-by-side.

This MVP uses a FastAPI backend and a React + Vite frontend. The summarizer can use either OpenAI or a local Hugging Face transformer, depending on your configuration.

---

## ✨ Key Features

- 🔍 Natural-language semantic search (vector embeddings + FAISS)
- 🧠 LLM-based summarization in a structured format:
  - Intro (2–3 sentences)
  - Key points 1–3 (main findings)
  - Key point 4 (contrast / limitation / critical caveat)
  - Outro (summary)
  - Plain-language paraphrase suitable for ~6th-grade reading level
- 📄 Details view with toggle between **Original Extracted Sections** and **LLM Summary**
- 🔗 Buttons to **Open Original** and **Copy Original Link**
- 💾 Basic local caching of LLM summaries to reduce repeated model calls (configurable)

---

## 📦 Tech Stack

- **Frontend:** React + TypeScript + Vite  
- **Backend:** FastAPI (Python)  
- **Embeddings:** Sentence-Transformers (Hugging Face)  
- **Vector Search:** FAISS  
- **LLM Summarization:** OpenAI (optional) or Hugging Face Transformers with PyTorch  
- **Data:** 608 full-text NASA Space Biology publications (CSV + extracted JSONs)

---

## 🛠️ Local Development — Quick Start

### 1. Clone repository

```bash
git clone https://github.com/alm1ghtyf1tch/space_bio_engine.git
cd space_bio_engine
```

---

### 2. Backend (FastAPI)

1. Create & activate virtual environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate      # macOS / Linux
# venv\Scripts\activate       # Windows
```

2. Install Python dependencies

```bash
pip install -r requirements.txt
```

3. Create an env file (example, do not commit)

Create `backend/.env` (or set environment variables in your shell):

```env
# backend/.env (example)
OPENAI_API_KEY=sk-...
INDEX_PATH=data/embeddings/spacebio.index
METADATA_PATH=data/embeddings/metadata.json
```

* If using Hugging Face models locally, you do **not** need `OPENAI_API_KEY`.
* If using OpenAI, set `OPENAI_API_KEY` to your key (never commit it).

4. Run the backend (development)

```bash
uvicorn backend.main:app --reload --port 8000
```

Backend will be available at: `http://localhost:8000`

**Useful endpoints**

* `GET /health` — health check
* `GET /search?q=<query>&k=<k>` — vector search
* `GET /paper/{paper_id}` — return extracted JSON for paper
* `GET /summarize/{paper_id}` — summarized JSON (LLM-backed), cached in `data/summaries/`
* `POST /feedback` — save feedback locally (demo)

---

### 3. Frontend (React + Vite)

From project root or `frontend/`:

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at `http://localhost:8080` (or the port Vite uses).

**Development proxy:** `vite.config.js` is configured to proxy `/search`, `/paper`, `/summarize`, etc. to `http://localhost:8000` during local development — no CORS changes required.

---

## 🧠 LLM Summarization — How it works

1. The backend loads the extracted `data/texts/<paper_id>.json` which contains `title`, `link`, and `sections` (Abstract, Results, Conclusion, ...).
2. A summarization prompt is built from priority sections (Abstract, Results, Conclusion).
3. The backend calls the configured LLM (OpenAI or a Hugging Face model) to produce **JSON-only** structured output:

   ```json
   {
     "intro": "...",
     "key_points": ["...", "...", "...", "..."],
     "outro": "...",
     "plain_text": "..."
   }
   ```
4. The backend caches successful parsed summaries to `data/summaries/<paper_id>.json`.
5. The frontend fetches that summary and renders it in the modal. The user can toggle to view raw extracted sections.

### Option 1 — OpenAI

* Requires `OPENAI_API_KEY` in backend environment.
* Recommended models: `gpt-4`, `gpt-4o-mini`, or `gpt-3.5-turbo`.
* Pros: concise, high-quality outputs.
* Cons: usage costs.

### Option 2 — Hugging Face (local)

* Install PyTorch + Transformers in `backend/venv`.
* Example summarization model (CPU-friendly): `facebook/bart-large-cnn` or `sshleifer/distilbart-cnn-12-6` for faster, cheaper runs.
* Use `transformers.pipeline("summarization", model=...)`.
* Pros: no external API key or cost; fully local.
* Cons: may be slower and require more memory for larger models.

---

## ✅ Testing checklist

* [ ] Start backend: `uvicorn backend.main:app --reload --port 8000`
* [ ] Start frontend: `npm run dev` (in `frontend/`)
* [ ] Visit `http://localhost:8080` → try queries like `plant growth`, `microgravity`
* [ ] Click a result → open **View Details** → LLM summary should appear (or raw sections if no model configured)
* [ ] Confirm **Open Original** / **Copy Original Link** works

---

## 📦 Deployment notes (MVP)

* **Frontend:** Vercel or Netlify (set root directory to `frontend` if monorepo)
* **Backend:** Render, Railway, Fly, or a VPS. Ensure:

  * `uvicorn backend.main:app --host 0.0.0.0 --port $PORT` as start command
  * All index files (FAISS index, metadata, data/texts/) are available on the server OR downloaded on start from a storage bucket (S3/GDrive)
  * Set `OPENAI_API_KEY` (if using OpenAI) in service environment variables
  * Configure CORS in FastAPI to allow your frontend domain

**Important:** large binary files (FAISS index, embeddings) may exceed free repo limits — store them in cloud storage or use smaller test indexes for demo.

---

## ⚠️ Usage & Restrictions

This project is the intellectual property of **Abilmansur Inkarbay**.
You are **not allowed to copy, redistribute, or publish** this project — in whole or in part — as your own product, service, or submission.

While the code is publicly viewable for **learning and collaboration purposes**, any unauthorized **commercial use, rebranding, or claim of ownership** is strictly prohibited. If you wish to use any part of this project, please contact the author for explicit written permission.

---

## 🧾 License

This project is released under the **MIT License**. See `LICENSE` for details.

---

## 👥 Contributors

* **Abilmansur Inkarbay**
* **Medethan Adina**
* **Yeraliev Ulan**

---

## 🙏 Acknowledgements

* NASA Open Science Data Repository (OSDR) & NASA Space Life Sciences Library
* SentenceTransformers, FAISS, Hugging Face Transformers
* FastAPI, React, Vite and many open-source contributors

---

## 📬 Contact

If you need help running the project, want to contribute, or request permission to reuse parts of the code, contact:

**Abilmansur Inkarbay** — GitHub: [@alm1ghtyf1tch](https://github.com/alm1ghtyf1tch)

**My Email** — segathess@gmail.com

