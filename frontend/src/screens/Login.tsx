import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (err) {
      setError("Não foi possível enviar o link. Verifique o e-mail e tente novamente.");
    } else {
      setSent(true);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--creme)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <h1
          style={{
            fontFamily: "'Bodoni Moda', serif",
            fontSize: 40,
            fontWeight: 600,
            color: "var(--chocolate)",
            letterSpacing: "0.04em",
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          Rara IA
        </h1>
        <p
          style={{
            textAlign: "center",
            color: "var(--ouro)",
            fontFamily: "'Bodoni Moda', serif",
            fontStyle: "italic",
            fontSize: 15,
            marginBottom: 48,
          }}
        >
          Sua mentora estratégica
        </p>

        {sent ? (
          <div
            style={{
              background: "#fff",
              borderRadius: "var(--radius)",
              padding: "32px 24px",
              textAlign: "center",
              boxShadow: "0 2px 16px var(--sombra)",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 16 }}>✉</div>
            <h2
              style={{
                fontFamily: "'Bodoni Moda', serif",
                fontSize: 20,
                marginBottom: 12,
                color: "var(--chocolate)",
              }}
            >
              Link enviado
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#6b4a35" }}>
              Verifique sua caixa de entrada em <strong>{email}</strong>. Clique no link para
              acessar a plataforma.
            </p>
            <button
              onClick={() => setSent(false)}
              style={{
                marginTop: 24,
                background: "none",
                border: "none",
                fontSize: 13,
                color: "var(--ouro)",
                cursor: "pointer",
                fontFamily: "'Jost', sans-serif",
                textDecoration: "underline",
              }}
            >
              Usar outro e-mail
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--chocolate)",
                  marginBottom: 8,
                }}
              >
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  border: "1.5px solid rgba(61,31,13,0.2)",
                  borderRadius: "var(--radius)",
                  fontSize: 15,
                  fontFamily: "'Jost', sans-serif",
                  color: "var(--chocolate)",
                  background: "#fff",
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--ouro)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(61,31,13,0.2)")}
              />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: "#c0392b", marginBottom: 12 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                background: "var(--chocolate)",
                color: "var(--creme)",
                border: "none",
                borderRadius: "var(--radius)",
                fontSize: 15,
                fontFamily: "'Jost', sans-serif",
                fontWeight: 500,
                letterSpacing: "0.04em",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                !loading && ((e.target as HTMLButtonElement).style.background = "var(--ouro)")
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLButtonElement).style.background = "var(--chocolate)")
              }
            >
              {loading ? "Enviando..." : "Entrar com link mágico"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
