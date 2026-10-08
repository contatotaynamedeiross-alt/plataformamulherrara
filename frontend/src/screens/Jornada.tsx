import { useState } from "react";
import { supabase } from "../lib/supabase";
import Chat, { type Msg } from "../components/Chat";

const PILARES = [
  { id: "identidade", label: "Identidade" },
  { id: "posicionamento", label: "Posicionamento" },
  { id: "produto", label: "Produto" },
  { id: "marketing_vendas", label: "Marketing" },
  { id: "marca_pessoal", label: "Marca" },
] as const;

type PilarId = (typeof PILARES)[number]["id"];

const BOAS_VINDAS: Record<PilarId, string> = {
  identidade: "Olá. Estou aqui para explorar com você quem você é e o que te move. Como posso ajudar hoje?",
  posicionamento: "Vamos afinar seu posicionamento. O que você quer que as pessoas lembrem de você? Me conte.",
  produto: "Produto é clareza. Vamos trabalhar o que você entrega e para quem. Por onde começamos?",
  marketing_vendas: "Marketing é a arte de ser encontrada por quem precisa de você. O que está travando suas vendas?",
  marca_pessoal: "Sua marca pessoal é a soma de como você aparece para o mundo. Vamos construir isso juntas?",
};

export default function Jornada() {
  const [pilar, setPilar] = useState<PilarId>("identidade");
  const [historico, setHistorico] = useState<Record<PilarId, Msg[]>>(
    Object.fromEntries(PILARES.map((p) => [p.id, [{ role: "assistant" as const, content: BOAS_VINDAS[p.id] }]])) as Record<PilarId, Msg[]>
  );
  const [sending, setSending] = useState(false);
  const [erro, setErro] = useState("");

  const msgs = historico[pilar];

  const handleSend = async (text: string) => {
    setErro("");
    const newMsg: Msg = { role: "user", content: text };
    setHistorico((h) => ({ ...h, [pilar]: [...h[pilar], newMsg] }));
    setSending(true);

    const { data, error } = await supabase.functions.invoke("jornada-chat", {
      body: { pilar, mensagem: text },
    });

    setSending(false);
    if (error || !data?.resposta) {
      setErro("Não foi possível obter resposta. Tente novamente.");
    } else {
      const reply: Msg = { role: "assistant", content: data.resposta as string };
      setHistorico((h) => ({ ...h, [pilar]: [...h[pilar], reply] }));
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
          Jornada Rara
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
          {PILARES.map((p) => (
            <button
              key={p.id}
              onClick={() => setPilar(p.id)}
              style={{
                flexShrink: 0,
                padding: "7px 14px",
                borderRadius: 20,
                border: "1.5px solid",
                borderColor: pilar === p.id ? "var(--chocolate)" : "rgba(61,31,13,0.2)",
                background: pilar === p.id ? "var(--chocolate)" : "transparent",
                color: pilar === p.id ? "var(--creme)" : "var(--chocolate)",
                fontFamily: "'Jost', sans-serif",
                fontSize: 13,
                fontWeight: pilar === p.id ? 500 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <p style={{ padding: "4px 20px", fontSize: 12, color: "#c0392b" }}>{erro}</p>
      )}

      <div style={{ flex: 1, overflow: "hidden" }}>
        <Chat
          messages={msgs}
          onSend={handleSend}
          sending={sending}
          placeholder={`Converse sobre ${PILARES.find((p) => p.id === pilar)?.label.toLowerCase()}...`}
        />
      </div>
    </div>
  );
}
