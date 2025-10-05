#!/usr/bin/env python3
# scripts/extract_text.py
"""
Fetch PMC pages from CSV (data/SB_publication_PMC.csv), extract Abstract / Results / Conclusion,
and write one JSON per paper into data/texts/<paper_id>.json

Assumptions:
- CSV has columns: Title, Link
- Links are PMC article pages (HTML), e.g. https://www.ncbi.nlm.nih.gov/pmc/articles/PMCxxxxxx/
"""
import os
import time
import json
import re
import pandas as pd
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from tqdm import tqdm

CSV_PATH = os.path.join("data", "SB_publication_PMC.csv")
OUT_DIR = os.path.join("data", "texts")
os.makedirs(OUT_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": "space-bio-hackathon-bot/1.0 (+https://example.org/)"
}

def safe_filename(s):
    return re.sub(r"[^\w\-_.]", "_", s)[:160]

def fetch_html(url, timeout=20):
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        if r.status_code == 200:
            return r.text
        else:
            print(f"Non-200 {r.status_code} for {url}")
            return None
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def extract_sections_from_pmc_html(html):
    """
    Parse PMC article HTML and extract Abstract, Results, Conclusions/Discussion, and filtered figure/image URLs.
    Returns dict with keys 'Abstract','Results','Conclusion','figures'
    """
    soup = BeautifulSoup(html, "lxml")
    text_by_section = {"Abstract": "", "Results": "", "Conclusion": ""}
    figures = []
    figure_containers = soup.find_all(["figure", "div"], class_=re.compile(r"fig|figure", re.I))

    # Abstract: look for tag with id 'abstract' or <abstract> element
    abstract = soup.find(id=re.compile(r"abstract", re.I)) or soup.find("abstract")
    if abstract:
        text_by_section["Abstract"] = " ".join(abstract.stripped_strings)

    # Some PMC pages have sections with headings; find headings that match Results or Conclusion
    for header in soup.find_all(re.compile("^h[1-6]$")):
        heading = header.get_text(separator=" ").strip().lower()
        if "result" in heading and not text_by_section["Results"]:
            # collect next sibling paragraphs until next header of same level
            parts = []
            sib = header.find_next_sibling()
            while sib and sib.name and not re.match(r"h[1-6]", sib.name):
                parts.append(" ".join(sib.stripped_strings))
                sib = sib.find_next_sibling()
            text_by_section["Results"] = " ".join([p for p in parts if p])
        if ("conclusion" in heading or "discussion" in heading) and not text_by_section["Conclusion"]:
            parts = []
            sib = header.find_next_sibling()
            while sib and sib.name and not re.match(r"h[1-6]", sib.name):
                parts.append(" ".join(sib.stripped_strings))
                sib = sib.find_next_sibling()
            text_by_section["Conclusion"] = " ".join([p for p in parts if p])

    # Fallbacks: try to find section by searching for 'Results' or 'Conclusion' headings anywhere
    if not text_by_section["Results"]:
        results_heading = soup.find(text=re.compile(r"\bResults\b", re.I))
        if results_heading:
            parent = results_heading.parent
            # gather following siblings text
            parts = []
            sib = parent.find_next_sibling()
            while sib:
                parts.append(" ".join(sib.stripped_strings))
                sib = sib.find_next_sibling()
            text_by_section["Results"] = " ".join(parts)

    if not text_by_section["Conclusion"]:
        concl_heading = soup.find(text=re.compile(r"\bConclusion[s]?\b|\bDiscussion\b", re.I))
        if concl_heading:
            parent = concl_heading.parent
            parts = []
            sib = parent.find_next_sibling()
            while sib:
                parts.append(" ".join(sib.stripped_strings))
                sib = sib.find_next_sibling()
            text_by_section["Conclusion"] = " ".join(parts)

    # As a last resort, try to get abstract text from meta tags or the first paragraphs
    if not text_by_section["Abstract"]:
        meta_desc = soup.find("meta", {"name": "description"})
        if meta_desc and meta_desc.get("content"):
            text_by_section["Abstract"] = meta_desc.get("content")

    # Filtered figure/image extraction
    for fig in figure_containers:
        imgs = fig.find_all("img")
        for img in imgs:
            src = img.get("src")
            alt = img.get("alt", "").lower()
            classes = " ".join(img.get("class", []))
            # Filter: must have 'fig' or 'figure' in alt/caption or parent, and not logo/advertisement/background
            parent_text = fig.get_text(" ", strip=True).lower()
            if src and src.startswith("http"):
                if (re.search(r"fig|figure", alt) or re.search(r"fig|figure", parent_text)) and not re.search(r"logo|advert|background|icon|spacer", alt+classes):
                    figures.append(src)
            elif src:
                if (re.search(r"fig|figure", alt) or re.search(r"fig|figure", parent_text)) and not re.search(r"logo|advert|background|icon|spacer", alt+classes):
                    figures.append(src)
    # Also catch any top-level images in the article body, but only if they pass filters
    for img in soup.find_all("img"):
        src = img.get("src")
        alt = img.get("alt", "").lower()
        classes = " ".join(img.get("class", []))
        if src and src.startswith("http") and src not in figures:
            # Only add if alt or parent text suggests it's a figure
            parent = img.find_parent(["figure", "div"])
            parent_text = parent.get_text(" ", strip=True).lower() if parent else ""
            if (re.search(r"fig|figure", alt) or re.search(r"fig|figure", parent_text)) and not re.search(r"logo|advert|background|icon|spacer", alt+classes):
                figures.append(src)

    # Clean up whitespace
    for k, v in text_by_section.items():
        text_by_section[k] = re.sub(r"\s+", " ", v).strip()

    return {**text_by_section, "figures": figures}

def main(limit=None, pause=0.6):
    df = pd.read_csv(CSV_PATH)
    if "Link" not in df.columns:
        print("CSV missing 'Link' column. Columns:", df.columns.tolist())
        return

    rows = df.itertuples(index=False)
    if limit:
        rows = list(rows)[:limit]

    for row in tqdm(rows):
        title = getattr(row, 'Title', None) or ""
        link = getattr(row, 'Link', None) or ""
        if not link or not link.startswith("http"):
            continue
        # create an id from the PMC url path (e.g., PMC4136787)
        parsed = urlparse(link)
        paper_id = safe_filename(parsed.path.replace("/", "_").strip("_"))
        out_path = os.path.join(OUT_DIR, f"{paper_id}.json")
        if os.path.exists(out_path):
            # skip if already fetched
            continue

        html = fetch_html(link)
        if not html:
            continue
        sections = extract_sections_from_pmc_html(html)
        payload = {
            "paper_id": paper_id,
            "title": title,
            "link": link,
            "sections": sections
        }
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        # polite pause to avoid hammering
        time.sleep(pause)

if __name__ == "__main__":
    # optional CLI: first argument is limit (int)
    import sys
    lim = int(sys.argv[1]) if len(sys.argv) > 1 else None
    main(limit=lim)
