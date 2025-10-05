// frontend/src/pages/SearchPage.tsx
import { useState, useMemo } from "react";
import Navbar from "../components/Navbar";

interface SearchMeta {
  paper_id: string;
  title: string;
  section?: string;
  chunk_id?: number;
}

interface SearchResult {
  score: number;
  meta: SearchMeta;
  snippet: string | null;
}

interface PaperJSON {
  paper_id?: string;
  title?: string;
  link?: string;
  sections?: { [sectionName: string]: string };
  illustrations?: string[];
}

// --- helper: highlight function ---
function highlightText(text: string, query: string) {
  if (!text || !query) return text;
  // split query into tokens, escape regex
  const tokens = Array.from(new Set(query.trim().toLowerCase().split(/\s+/)));
  if (tokens.length === 0) return text;
  // build regex safely
  const re = new RegExp(`(${tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})`, "gi");
  return text.replace(re, "<mark>$1</mark>");
}

// small helper to build PMC link
function getPaperLink(paper_id?: string) {
  if (!paper_id) return "#";
  const m = paper_id.match(/(PMC\d+)/i);
  if (m) {
    return `https://www.ncbi.nlm.nih.gov/pmc/articles/${m[1]}/`;
  }
  return "#";
}

const PAGE_SIZE = 6;

const SearchPage = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // modal state for paper detail (unchanged)
  const [selectedPaper, setSelectedPaper] = useState<PaperJSON | null>(null);
  const [paperLoading, setPaperLoading] = useState(false);
  const [paperError, setPaperError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // summary state
  const [paperSummary, setPaperSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // pagination
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil((totalCount ?? results.length) / PAGE_SIZE ));

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setPage(1);
    setTotalCount(null);

    try {
      const response = await fetch(`http://127.0.0.1:8000/search?q=${encodeURIComponent(query)}&k=50`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      setResults(data.results || []);
      setTotalCount((data.results || []).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch results");
      setResults([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // open paper modal (unchanged)
  const openPaper = async (paperId: string) => {
    setPaperLoading(true);
    setPaperError(null);
    setSelectedPaper(null);
    setShowModal(true);
    setPaperSummary(null);
    setSummaryLoading(true);
    setSummaryError(null);
    // Extract just the PMC ID if needed
    const m = paperId.match(/PMC\d+/i);
    const cleanId = m ? m[0] : paperId;
    try {
      const resp = await fetch(`http://127.0.0.1:8000/paper/${encodeURIComponent(cleanId)}`);
      if (!resp.ok) {
        if (resp.status === 404) throw new Error("Paper not found on server");
        throw new Error(`Paper API error: ${resp.status}`);
      }
      const j = await resp.json();
      console.log("[DEBUG] Paper response:", j); // <-- log raw response
      setSelectedPaper(j);
    } catch (err) {
      setPaperError(err instanceof Error ? err.message : "Failed to load paper");
    } finally {
      setPaperLoading(false);
    }
    // Fetch flexible summary
    try {
      const resp = await fetch(`http://127.0.0.1:8000/paper_summarized/${encodeURIComponent(cleanId)}`);
      if (!resp.ok) {
        if (resp.status === 404) throw new Error("Summary not found");
        throw new Error(`Summary API error: ${resp.status}`);
      }
      const j = await resp.json();
      setPaperSummary(j.summary || null);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Failed to load summary");
      setPaperSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPaper(null);
    setPaperError(null);
  };

  const renderSnippet = (r: SearchResult) => {
    if (r.snippet && r.snippet.trim().length > 0) {
      const s = r.snippet.trim();
      return s.length > 400 ? s.slice(0, 400) + "..." : s;
    }
    const title = r.meta?.title ?? "Untitled";
    const section = r.meta?.section ? ` (${r.meta.section})` : "";
    return `${title}${section}`;
  };

  // pagination: compute visible results
  const visibleResults = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return results.slice(start, start + PAGE_SIZE);
  }, [results, page]);

  // copy paper link helper
  const copyLink = async (paperId?: string) => {
    try {
      const url = getPaperLink(paperId);
      if (!url || url === "#") throw new Error("No public link");
      await navigator.clipboard.writeText(url);
      alert("Copied original article link to clipboard.");
    } catch (err) {
      alert("Unable to copy link.");
    }
  };

  // --- styles kept minimal, can reuse your existing ones ---
  const containerStyle: React.CSSProperties = { minHeight: "100vh", background: "none" };
  const mainStyle: React.CSSProperties = { maxWidth: "900px", margin: "0 auto", padding: "3rem 1.5rem", color: "#fff", textShadow: "0 1px 8px #000a" };
  const headingStyle: React.CSSProperties = { fontSize: "2rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem", textShadow: "0 2px 12px #000c" };
  const subtitleStyle: React.CSSProperties = { fontSize: "1.125rem", color: "#f3f3f3", marginBottom: "2rem" };
  const formStyle: React.CSSProperties = { display: "flex", gap: "0.75rem", marginBottom: "2.5rem" };
  const inputWrapperStyle: React.CSSProperties = { flex: 1 };
  const resultCardStyle: React.CSSProperties = { backgroundColor: "hsl(var(--card-bg))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", padding: "1.25rem", marginBottom: "0.75rem" };
  const resultTitleStyle: React.CSSProperties = { fontSize: "1.05rem", fontWeight: 600, color: "hsl(var(--text-primary))", marginBottom: "0.4rem", cursor: "pointer", textDecoration: "underline" };
  const metaStyle: React.CSSProperties = { fontSize: "0.85rem", color: "hsl(var(--text-muted))", marginBottom: "0.6rem" };
  const snippetStyle: React.CSSProperties = { fontSize: "0.95rem", color: "hsl(var(--text-secondary))", lineHeight: 1.6 };

  return (
    <div style={containerStyle}>
      <Navbar />
      <main style={mainStyle}>
        <h1 style={headingStyle}>Search Research Papers</h1>
        <p style={subtitleStyle}>Find relevant academic papers and research documents</p>
        {/* Instruction box */}
        <div style={{ background: "#2563eb22", border: "1px solid #2563eb66", borderRadius: 6, padding: "1rem 1.2rem", marginBottom: "2rem", color: "#e0e0e0" }}>
          <strong>How to use this page:</strong>
          <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
            <li>Enter keywords or topics in the search box above.</li>
            <li>Click <b>Search</b> to find relevant research papers.</li>
            <li>Click <b>View details</b> to see summaries and figures for each paper.</li>
            <li>Use <b>Copy original link</b> or <b>Open original</b> to access the full article.</li>
          </ul>
        </div>

        <form onSubmit={handleSearch} style={formStyle}>
          <div style={inputWrapperStyle}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your search query..."
              className="input"
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {error && <div style={{ padding: 12, background: "#ffeef0", color: "#8b0000" }}>{error}</div>}

        {/* show counts and pager controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>{totalCount !== null ? `${totalCount} results` : results.length ? `${results.length} candidates` : "No results yet"}</div>
          <div>
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
            <span style={{ margin: "0 8px" }}>{page}/{pages}</span>
            <button className="btn btn-sm" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>Next</button>
          </div>
        </div>

        {loading && <div>Loading results…</div>}

        {!loading && visibleResults.length === 0 && query && <div style={{ padding: 16 }}>No matches found.</div>}

        <div>
          {visibleResults.map((r, idx) => (
            <div key={`${r.meta.paper_id}-${r.meta.chunk_id}-${idx}`} style={resultCardStyle}>
              <h3
                style={resultTitleStyle}
                onClick={() => openPaper(r.meta.paper_id)}
                title="Click to view full paper sections"
                dangerouslySetInnerHTML={{ __html: highlightText(r.meta.title || "Untitled", query) }}
              />
              <div style={metaStyle}>
                {r.meta.section && <span>Section: {r.meta.section} • </span>}
                <span>Score: {r.score.toFixed(3)}</span>
              </div>
              <div style={snippetStyle} dangerouslySetInnerHTML={{ __html: highlightText(renderSnippet(r), query) }} />
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-sm" onClick={() => openPaper(r.meta.paper_id)} style={{ marginRight: 8 }}>View details</button>
                <button className="btn btn-ghost btn-sm" onClick={() => copyLink(r.meta.paper_id)}>Copy original link</button>
                <a href={getPaperLink(r.meta.paper_id)} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 12 }}>Open original</a>
              </div>
            </div>
          ))}
        </div>

        {/* Modal (same as previous) */}
        {showModal && (
          <div style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
          }} onClick={closeModal}>
            <div style={{ width: "min(1000px,95%)", maxHeight: "90vh", overflow: "auto", backgroundColor: "white", borderRadius: 8, padding: 16 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>{selectedPaper?.title ?? "Loading..."}</h3>
                <button onClick={closeModal} className="btn btn-ghost">Close</button>
              </div>
              {paperLoading && <div>Loading paper...</div>}
              {paperError && (
                <div style={{ color: "red", marginBottom: 12 }}>
                  {paperError === "Paper not found on server"
                    ? "This paper's details could not be found. It may not have been extracted yet."
                    : paperError}
                </div>
              )}
              {/* --- flexible summary block --- */}
              {!summaryLoading && paperSummary && (
                <div style={{ background: "#f6f8fa", borderRadius: 6, padding: 12, marginBottom: 16 }}>
                  <strong>Summary</strong>
                  <div style={{ marginTop: 10 }}>
                    {paperSummary.split(/\n|(?<=\.)\s+/).map((p, i) => (
                      <p key={i} style={{ marginBottom: 12, color: "hsl(var(--text-secondary))" }}>{p}</p>
                    ))}
                  </div>
                  {/* --- DEBUG: show illustrations array --- */}
                  {selectedPaper && (
                    <pre style={{ fontSize: 12, color: '#888', background: '#f9f9f9', padding: 8, borderRadius: 4, marginBottom: 8 }}>
                      Illustrations: {JSON.stringify(selectedPaper.illustrations)}
                    </pre>
                  )}
                  {/* Illustrations block */}
                  {selectedPaper && selectedPaper.illustrations && selectedPaper.illustrations.length > 0 && (
                    <div style={{ marginTop: 18 }}>
                      <strong>Illustrations</strong>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: 8 }}>
                        {selectedPaper.illustrations.slice(0, 6).map((imgUrl: string, idx: number) => (
                          <a href={imgUrl} target="_blank" rel="noopener noreferrer" key={idx} style={{ textDecoration: "none" }}>
                            <img
                              src={imgUrl}
                              alt={`Figure ${idx + 1}`}
                              style={{ maxWidth: "180px", maxHeight: "140px", borderRadius: 4, boxShadow: "0 1px 6px #0002", transition: "transform 0.2s", cursor: "pointer" }}
                              onMouseOver={e => (e.currentTarget.style.transform = "scale(1.08)")}
                              onMouseOut={e => (e.currentTarget.style.transform = "scale(1)")}
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {summaryLoading && <div>Loading summary...</div>}
              {summaryError && (
                <div style={{ color: "#8b0000", marginBottom: 12 }}>
                  {summaryError === "Summary not found"
                    ? "No summary available for this paper."
                    : summaryError}
                </div>
              )}
              {/* --- end summary block --- */}
              {!paperLoading && selectedPaper && selectedPaper.link && (
                <div style={{ marginBottom: 8 }}>
                  <a href={selectedPaper.link} target="_blank" rel="noopener noreferrer">Open the original article</a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchPage;
