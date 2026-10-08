import { useState } from "react";
import { supabase } from "../lib/supabase";
import Chat, { type Msg } from "../components/Chat";

const MENTORAS = [
  { id: "negocio", label: "Negócio", descricao: "Estratégia e modelo de negócio" },
  { id: "marketing", label: "Marketing", descricao: "Atração, conteúdo e audiência" },
  { id: "financeiro", label: "Financeiro", descricao: "Precificação e fluxo de caixa" },
  { id: "mindset", label: "Mindset", descricao: "Crenças e bloqueios internos" },
  { id: "produtividade", label: "Produtividade", descricao: "Foco e gestão de energia" },
] as const;

type MentoraId = (typeof MENTORAS)[number]["id"];

const BOAS_VINDAS: Record<MentoraId, string> = {
  negocio: "Olá. Sou sua mentora de negócios. Vamos trabalhar sua estratégia e modelo de receita. O que você precisa clarear hoje?",
  marketing: "Aqui é seu espaço de marketing. Conteúdo, posicionamento, audiência — o que está te travando?",
  financeiro: "Dinheiro é clareza. Me conte onde está o nó: precificação, fluxo, ou outro ponto?",
  mindset: "Às vezes o maior obstáculo é interno. O que está passando pela sua cabeça ultimamente?",
  produtividade: "Produtividade não é fazer mais — é fazer o que importa. O que está roubando seu foco?",
};

export default function Mentoras() {
  const [mentora, setMentora] = useState<MentoraId>("negocio");
  const [historico, setHistorico] = useState<Record<MentoraId, Msg[]>>(
    Object.fromEntries(
      MENTORAS.map((m) => [m.id, [{ role: "assistant" as const, content: BOAS_VINDAS[m.id] }]])
    ) as Record<MentoraId, Msg[]>
  );
  const [restantes, setRestantes] = useState<Record<MentoraId, number | null>>(
    Object.fromEntries(MENTORAS.map((m) => [m.id, null])) as Record<MentoraId, number | null>
  );
  const [sending, setSending] = useState(false);
  const [erro, setErro] = useState("");

  const msgs = historico[mentora];
  const qtdRestante = restantes[mentora];

  const handleSend = async (text: string) => {
    setErro("");
    const newMsg: Msg = { role: "user", content: text };
    setHistorico((h) => ({ ...h, [mentora]: [...h[mentora], newMsg] }));
    setSending(true);

    const { data, error } = await supabase.functions.invoke("mentora-ia", {
      body: { mentora, mensagem: text },
    });

    setSending(false);

    if (error) {
      const msg = (error as { message?: string }).message ?? "";
      if (msg.includes("limite") || msg.includes("429")) {
        setErro("Você atingiu o limite de mensagens para hoje. Volte amanhã.");
      } else {
        setErro("Não foi possível obter resposta. Tente novamente.");
      }
      return;
    }

    if (data?.resposta) {
      const reply: Msg = { role: "assistant", content: data.resposta as string };
      setHistorico((h) => ({ ...h, [mentora]: [...h[mentora], reply] }));
    }
    if (typeof data?.mensagens_restantes === "number") {
      setRestantes((r) => ({ ...r, [mentora]: data.mensagens_restantes as number }));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)" }}>
      <div style={{ padding: "16px 20px 0" }}>
        <h2
          style={{
            fontFamily: "'Bodoni Moda', serif",
            fontSize: 20,
            color: "var(--chocolate)",
            marginBottom: 12,
          }}
        >
          Mentoras de IA
        </h2>
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 8,
            scrollbarWidth: "none",
          }}
        >
          {MENTORAS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMentora(m.id)}
              style={{
                flexShrink: 0,
                padding: "7px 14px",
                borderRadius: 20,
                border: "1.5px solid",
                borderColor: mentora === m.id ? "var(--ouro)" : "rgba(61,31,13,0.2)",
                background: mentora === m.id ? "var(--ouro)" : "transparent",
                color: mentora === m.id ? "#fff" : "var(--chocolate)",
                fontFamily: "'Jost', sans-serif",
                fontSize: 13,
                fontWeight: mentora === m.id ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {(erro || qtdRestante !== null) && (
        <div style={{ padding: "6px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {erro ? (
            <p style={{ fontSize: 12, color: "#c0392b" }}>{erro}</p>
          ) : (
            <span />
          )}
          {qtdRestante !== null && !erro && (
            <span
              style={{
                fontSize: 12,
                color: qtdRestante > 5 ? "#6b4a35" : "#c07a1e",
                fontWeight: 500,
              }}
            >
              {qtdRestante} {qtdRestante === 1 ? "mensagem restante" : "mensagens restantes"} hoje
            </span>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflow: "hidden" }}>
        <Chat
          messages={msgs}
          onSend={handleSend}
          sending={sending}
          placeholder={`Fale com a mentora de ${MENTORAS.find((m) => m.id === mentora)?.label.toLowerCase()}...`}
        />
      </div>
    </div>
  );
}
