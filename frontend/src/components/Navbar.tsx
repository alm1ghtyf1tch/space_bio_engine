import { Link, useLocation } from "react-router-dom";

const Navbar = () => {
  const location = useLocation();

  const navStyle: React.CSSProperties = {
    borderBottom: "1px solid hsl(var(--border))",
    backgroundColor: "hsl(var(--background))",
    position: "sticky",
    top: 0,
    zIndex: 100,
  };

  const containerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1rem 1.5rem",
    maxWidth: "1200px",
    margin: "0 auto",
  };

  const logoStyle: React.CSSProperties = {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "hsl(var(--primary))",
    textDecoration: "none",
  };

  const navLinksStyle: React.CSSProperties = {
    display: "flex",
    gap: "2rem",
  };

  const linkStyle = (isActive: boolean): React.CSSProperties => ({
    color: isActive ? "hsl(var(--primary))" : "hsl(var(--text-secondary))",
    textDecoration: "none",
    fontWeight: 500,
    fontSize: "0.9375rem",
    transition: "color 0.2s ease",
  });

  return (
    <nav style={navStyle}>
      <div style={containerStyle}>
        <Link to="/" style={logoStyle}>
          Research Assistant
        </Link>
        <div style={navLinksStyle}>
          <Link
            to="/"
            style={linkStyle(location.pathname === "/")}
          >
            Home
          </Link>
          <Link
            to="/search"
            style={linkStyle(location.pathname === "/search")}
          >
            Search
          </Link>
          <Link
            to="/qa"
            style={linkStyle(location.pathname === "/qa")}
          >
            Q&A
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
