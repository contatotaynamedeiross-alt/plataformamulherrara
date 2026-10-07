import type { Screen } from "../App";

interface Props {
  current: Screen;
  onChange: (s: Screen) => void;
}

const items: { id: Screen; label: string; icon: string }[] = [
  { id: "dashboard", label: "Início", icon: "◈" },
  { id: "diagnostico", label: "Diagnóstico", icon: "◎" },
  { id: "jornada", label: "Jornada", icon: "◇" },
  { id: "mentoras", label: "Mentoras", icon: "◉" },
];

export default function Nav({ current, onChange }: Props) {
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 480,
        background: "var(--chocolate)",
        display: "flex",
        borderTop: "none",
        zIndex: 20,
      }}
    >
      {items.map((item) => {
        const active = current === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "12px 4px 10px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              color: active ? "var(--ouro)" : "rgba(245,239,230,0.5)",
              transition: "color 0.15s",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
            <span
              style={{
                fontSize: 10,
                fontFamily: "'Jost', sans-serif",
                fontWeight: active ? 600 : 400,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
