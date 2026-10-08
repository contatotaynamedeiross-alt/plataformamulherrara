import type { AcessoInfo } from "../App";

const planoLabel: Record<string, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
};

const statusLabel: Record<string, { label: string; color: string }> = {
  ativo: { label: "Ativa", color: "#2d7a4f" },
  suspenso: { label: "Suspensa", color: "#c07a1e" },
  cancelado: { label: "Cancelada", color: "#c0392b" },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(iso)
  );
}

export default function Dashboard({ acesso }: { acesso: AcessoInfo }) {
  const st = acesso.status ? statusLabel[acesso.status] : { label: "—", color: "inherit" };

  return (
    <div style={{ padding: "28px 20px" }}>
      <h2
        style={{
          fontFamily: "'Bodoni Moda', serif",
          fontSize: 26,
          fontWeight: 600,
          color: "var(--chocolate)",
          marginBottom: 4,
        }}
      >
        Bem-vinda de volta.
      </h2>
      <p style={{ fontSize: 14, color: "#6b4a35", marginBottom: 28 }}>
        Sua jornada continua aqui.
      </p>

      <div
        style={{
          background: "#fff",
          borderRadius: "var(--radius)",
          padding: "20px 20px",
          boxShadow: "0 2px 12px var(--sombra)",
          marginBottom: 24,
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ouro)",
            marginBottom: 16,
          }}
        >
          Sua assinatura
        </p>
        <Row label="Plano" value={acesso.plano ? planoLabel[acesso.plano] ?? acesso.plano : "—"} />
        <Row
          label="Status"
          value={
            <span style={{ color: st.color, fontWeight: 500 }}>
              {st.label}
            </span>
          }
        />
        <Row label="Válido até" value={formatDate(acesso.data_fim)} last />
      </div>

      <div
        style={{
          background: "var(--chocolate)",
          borderRadius: "var(--radius)",
          padding: "24px 20px",
          color: "var(--creme)",
        }}
      >
        <p
          style={{
            fontFamily: "'Bodoni Moda', serif",
            fontStyle: "italic",
            fontSize: 16,
            lineHeight: 1.7,
            marginBottom: 8,
          }}
        >
          "O posicionamento certo não grita. Ele ressoa."
        </p>
        <p style={{ fontSize: 12, color: "var(--ouro)", letterSpacing: "0.06em" }}>— Rara IA</p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  last,
}: {
  label: string;
  value: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: last ? "none" : "1px solid rgba(61,31,13,0.07)",
      }}
    >
      <span style={{ fontSize: 13, color: "#6b4a35" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--chocolate)" }}>{value}</span>
    </div>
  );
}
