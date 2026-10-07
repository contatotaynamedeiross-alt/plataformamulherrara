const LINK_VENDAS = "https://rara.com.br/assinar";

export default function AcessoInativo({ onSignOut }: { onSignOut: () => void }) {
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
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontFamily: "'Bodoni Moda', serif",
          fontSize: 28,
          color: "var(--chocolate)",
          marginBottom: 16,
        }}
      >
        Acesso inativo
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.8, color: "#6b4a35", maxWidth: 340, marginBottom: 36 }}>
        Sua assinatura não está ativa. Para continuar acessando as mentoras e a jornada, ative seu
        plano agora.
      </p>
      <a
        href={LINK_VENDAS}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          background: "var(--chocolate)",
          color: "var(--creme)",
          padding: "14px 32px",
          borderRadius: "var(--radius)",
          fontFamily: "'Jost', sans-serif",
          fontWeight: 500,
          fontSize: 15,
          textDecoration: "none",
          marginBottom: 20,
          letterSpacing: "0.04em",
        }}
      >
        Assinar agora
      </a>
      <button
        onClick={onSignOut}
        style={{
          background: "none",
          border: "none",
          fontSize: 13,
          color: "var(--ouro)",
          cursor: "pointer",
          fontFamily: "'Jost', sans-serif",
          textDecoration: "underline",
        }}
      >
        Sair
      </button>
    </div>
  );
}
