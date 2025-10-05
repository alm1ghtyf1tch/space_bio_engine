// frontend/src/pages/LandingPage.tsx
import Navbar from "../components/Navbar";

const LandingPage = () => {
  return (
    <div style={{ minHeight: "100vh", background: "none" }}>
      <Navbar />
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 1.5rem", color: "#fff", textShadow: "0 1px 8px #000a" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 700, marginBottom: 16, color: "#fff", textShadow: "0 2px 12px #000c" }}>Welcome to Research Assistant</h1>
        <p style={{ fontSize: "1.2rem", marginBottom: 24, color: "#f3f3f3" }}>
          <strong>Who we are:</strong> <span style={{ color: "#e0e0e0" }}>A team of space biology enthusiasts and developers building tools to make research easier and more accessible.</span>
        </p>
        <p style={{ fontSize: "1.1rem", marginBottom: 24, color: "#f3f3f3" }}>
          <strong>What this platform does:</strong> <span style={{ color: "#e0e0e0" }}>Search, summarize, and answer questions about space biology research papers. Designed for students, scientists, and anyone curious about space life sciences.</span>
        </p>
        <div style={{ margin: "2.5rem 0" }}>
          <a href="/search" className="btn" style={{ fontSize: "1.1rem", padding: "0.75rem 2rem", color: "#fff", background: "#2563eb", borderRadius: 6, boxShadow: "0 2px 8px #0006" }}>Start Searching</a>
        </div>
        <div style={{ marginTop: 40, color: "#e0e0e0" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 600, color: "#fff", textShadow: "0 1px 8px #000a" }}>How to use:</h2>
          <ul style={{ marginTop: 12, lineHeight: 1.7 }}>
            <li>Use the Search page to find and explore research papers.</li>
            <li>Use the Q&A page to ask questions and get evidence-based answers from research.</li>
            <li>Navigation is simple: use the top bar to switch between pages.</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
