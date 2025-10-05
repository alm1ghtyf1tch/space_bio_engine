import { useState } from "react";
import Navbar from "../components/Navbar";
import EvidenceCard from "../components/EvidenceCard";

interface Evidence {
  paper_title: string;
  section?: string;
  snippet: string;
  link?: string;
}

interface QAResponse {
  answer: string;
  verdict: "Agree" | "Mixed" | "Insufficient";
  confidence?: number;
  evidence: Evidence[];
}

const QAPage = () => {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<QAResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch(`/qa?q=${encodeURIComponent(question)}&k=10`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get answer");
    } finally {
      setLoading(false);
    }
  };

  const getVerdictBadgeClass = (verdict: string) => {
    switch (verdict) {
      case "Agree":
        return "badge badge-success";
      case "Mixed":
        return "badge badge-warning";
      case "Insufficient":
        return "badge badge-neutral";
      default:
        return "badge badge-neutral";
    }
  };

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "none",
  };

  const mainStyle: React.CSSProperties = {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "3rem 1.5rem",
    color: "#fff",
    textShadow: "0 1px 8px #000a",
  };

  const headingStyle: React.CSSProperties = {
    fontSize: "2rem",
    fontWeight: 700,
    color: "#fff",
    marginBottom: "0.5rem",
    textShadow: "0 2px 12px #000c",
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: "1.125rem",
    color: "#f3f3f3",
    marginBottom: "2rem",
  };

  const formStyle: React.CSSProperties = {
    display: "flex",
    gap: "0.75rem",
    marginBottom: "2.5rem",
  };

  const inputWrapperStyle: React.CSSProperties = {
    flex: 1,
  };

  const answerCardStyle: React.CSSProperties = {
    backgroundColor: "hsl(var(--card-bg))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.5rem",
    padding: "1.5rem",
    marginBottom: "2rem",
  };

  const answerHeaderStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "1rem",
  };

  const answerTextStyle: React.CSSProperties = {
    fontSize: "1.0625rem",
    color: "hsl(var(--text-primary))",
    lineHeight: 1.7,
    marginBottom: "1rem",
  };

  const confidenceStyle: React.CSSProperties = {
    fontSize: "0.875rem",
    color: "hsl(var(--text-muted))",
  };

  const evidenceGridStyle: React.CSSProperties = {
    display: "grid",
    gap: "1rem",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
  };

  const errorStyle: React.CSSProperties = {
    padding: "1rem",
    backgroundColor: "hsl(0, 70%, 95%)",
    border: "1px solid hsl(0, 70%, 85%)",
    borderRadius: "0.375rem",
    color: "hsl(0, 70%, 45%)",
    marginBottom: "1.5rem",
  };

  return (
    <div style={containerStyle}>
      <Navbar />
      <main style={mainStyle}>
        <h1 style={headingStyle}>Question & Answer</h1>
        <p style={subtitleStyle}>
          Ask questions and get evidence-based answers from research
        </p>
        {/* Instruction box */}
        <div
          style={{
            background: "#2563eb22",
            border: "1px solid #2563eb66",
            borderRadius: 6,
            padding: "1rem 1.2rem",
            marginBottom: "2rem",
            color: "#e0e0e0",
          }}
        >
          <strong>How to use this page:</strong>
          <ul
            style={{
              marginTop: 8,
              marginBottom: 0,
              paddingLeft: 20,
            }}
          >
            <li>Type a research question in the box above.</li>
            <li>
              Click <b>Ask</b> to get an answer based on available research
              papers.
            </li>
            <li>
              Answers are generated using local AI models and research data.
            </li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={inputWrapperStyle}>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a research question..."
              className="input"
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Processing..." : "Ask"}
          </button>
        </form>

        {error && <div style={errorStyle}>Error: {error}</div>}

        {response && (
          <>
            <div style={answerCardStyle}>
              <div style={answerHeaderStyle}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Answer</h2>
                <span className={getVerdictBadgeClass(response.verdict)}>
                  {response.verdict}
                </span>
              </div>
              <p style={answerTextStyle}>{response.answer}</p>
              {response.confidence !== undefined && (
                <div style={confidenceStyle}>
                  Confidence: {(response.confidence * 100).toFixed(1)}%
                </div>
              )}
            </div>

            {response.evidence && response.evidence.length > 0 && (
              <div>
                <h2
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 600,
                    marginBottom: "1.5rem",
                  }}
                >
                  Supporting Evidence ({response.evidence.length})
                </h2>
                <div style={evidenceGridStyle}>
                  {response.evidence.map((evidence, index) => (
                    <EvidenceCard
                      key={index}
                      title={evidence.paper_title}
                      section={evidence.section}
                      snippet={evidence.snippet}
                      link={evidence.link}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default QAPage;
