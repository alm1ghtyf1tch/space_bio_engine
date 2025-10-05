interface EvidenceCardProps {
  title: string;
  section?: string;
  snippet: string;
  link?: string;
}

const EvidenceCard = ({ title, section, snippet, link }: EvidenceCardProps) => {
  const cardStyle: React.CSSProperties = {
    backgroundColor: "hsl(var(--card-bg))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.5rem",
    padding: "1.25rem",
    transition: "box-shadow 0.2s ease",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "1rem",
    fontWeight: 600,
    color: "hsl(var(--text-primary))",
    marginBottom: "0.5rem",
    lineHeight: 1.4,
  };

  const sectionStyle: React.CSSProperties = {
    fontSize: "0.8125rem",
    color: "hsl(var(--text-muted))",
    marginBottom: "0.75rem",
  };

  const snippetStyle: React.CSSProperties = {
    fontSize: "0.9375rem",
    color: "hsl(var(--text-secondary))",
    lineHeight: 1.6,
    marginBottom: "1rem",
  };

  const linkStyle: React.CSSProperties = {
    fontSize: "0.875rem",
    color: "hsl(var(--primary))",
    textDecoration: "none",
    fontWeight: 500,
  };

  return (
    <div style={cardStyle} className="card">
      <h3 style={titleStyle}>{title}</h3>
      {section && <div style={sectionStyle}>Section: {section}</div>}
      <p style={snippetStyle}>{snippet}</p>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          View source →
        </a>
      )}
    </div>
  );
};

export default EvidenceCard;
