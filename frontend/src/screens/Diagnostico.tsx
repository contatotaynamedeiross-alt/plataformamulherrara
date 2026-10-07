import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Pergunta {
  id: number;
  ordem: number;
  texto: string;
  pilar: string;
}

interface Resultado {
  foco: string;
  forca: string;
  [key: string]: unknown;
}

const NIVEL: Record<number, string> = {
  1: "Iniciante",
  2: "Em Desenvolvimento",
  3: "Em Desenvolvimento",
  4: "Avançada",
  5: "Rara",
};

const ESCALA = [
  { v: 1, label: "Discordo totalmente" },
  { v: 2, label: "Discordo" },
  { v: 3, label: "Neutro" },
  { v: 4, label: "Concordo" },
  { v: 5, label: "Concordo totalmente" },
];

export default function Diagnostico() {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    supabase
      .from("diagnostico_perguntas")
      .select("*")
      .order("ordem")
      .then(({ data, error }) => {
        if (!error && data) setPerguntas(data as Pergunta[]);
        setLoading(false);
      });
  }, []);

  const progress = perguntas.length
    ? Math.round((Object.keys(respostas).length / perguntas.length) * 100)
    : 0;

  const completo = perguntas.length > 0 && Object.keys(respostas).length === perguntas.length;

  const handleEnviar = async () => {
    if (!completo) return;
    setSalvando(true);
    setErro("");
    const pRespostas = perguntas.map((p) => respostas[p.id]);
    const { data, error } = await supabase.rpc("submit_diagnostic", {
      answers: pRespostas,
    });
    setSalvando(false);
    if (error) {
      setErro("Erro ao salvar. Tente novamente.");
    } else {
      setResultado(data as Resultado);
    }
  };

  if (loading) return <LoadingMsg />;

  if (resultado) return <Resultado resultado={resultado} />;

  return (
    <div style={{ padding: "24px 20px" }}>
      <h2
        style={{
          fontFamily: "'Bodoni Moda', serif",
          fontSize: 22,
          color: "var(--chocolate)",
          marginBottom: 6,
        }}
      >
        Diagnóstico Raro
      </h2>
      <p style={{ fontSize: 13, color: "#6b4a35", marginBottom: 20 }}>
        Responda com honestidade. Não há respostas certas.
      </p>

      <div
        style={{
          height: 4,
          background: "rgba(61,31,13,0.1)",
          borderRadius: 4,
          marginBottom: 24,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "var(--ouro)",
            borderRadius: 4,
            transition: "width 0.3s",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {perguntas.map((p, i) => (
          <div
            key={p.id}
            style={{
              background: "#fff",
              borderRadius: "var(--radius)",
              padding: "18px 16px",
              boxShadow: "0 1px 6px var(--sombra)",
            }}
          >
            <p
              style={{
                fontSize: 13,
                color: "var(--ouro)",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {i + 1} de {perguntas.length}
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--chocolate)", marginBottom: 16 }}>
              {p.texto}
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              {ESCALA.map((e) => (
                <button
                  key={e.v}
                  onClick={() => setRespostas((r) => ({ ...r, [p.id]: e.v }))}
                  title={e.label}
                  style={{
                    flex: 1,
                    aspectRatio: "1",
                    border: respostas[p.id] === e.v ? "2px solid var(--ouro)" : "2px solid rgba(61,31,13,0.15)",
                    borderRadius: 8,
                    background: respostas[p.id] === e.v ? "var(--ouro)" : "transparent",
                    color: respostas[p.id] === e.v ? "#fff" : "var(--chocolate)",
                    fontFamily: "'Jost', sans-serif",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {e.v}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {erro && <p style={{ color: "#c0392b", fontSize: 13, marginTop: 16 }}>{erro}</p>}

      <button
        onClick={handleEnviar}
        disabled={!completo || salvando}
        style={{
          display: "block",
          width: "100%",
          marginTop: 28,
          padding: "15px",
          background: completo ? "var(--chocolate)" : "rgba(61,31,13,0.3)",
          color: "var(--creme)",
          border: "none",
          borderRadius: "var(--radius)",
          fontSize: 15,
          fontFamily: "'Jost', sans-serif",
          fontWeight: 500,
          cursor: completo && !salvando ? "pointer" : "not-allowed",
        }}
      >
        {salvando ? "Calculando..." : "Ver meu diagnóstico"}
      </button>
    </div>
  );
}

function Resultado({ resultado }: { resultado: Resultado }) {
  const pilares = [
    "Identidade",
    "Posicionamento",
    "Produto",
    "Marketing / Vendas",
    "Marca Pessoal",
  ];

  return (
    <div style={{ padding: "24px 20px" }}>
      <h2
        style={{
          fontFamily: "'Bodoni Moda', serif",
          fontSize: 22,
          color: "var(--chocolate)",
          marginBottom: 6,
        }}
      >
        Seu diagnóstico
      </h2>

      <div
        style={{
          background: "var(--chocolate)",
          borderRadius: "var(--radius)",
          padding: "20px",
          marginBottom: 24,
          color: "var(--creme)",
        }}
      >
        {resultado.foco && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: "var(--ouro)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
              Seu foco
            </p>
            <p style={{ fontFamily: "'Bodoni Moda', serif", fontSize: 18 }}>{resultado.foco as string}</p>
          </div>
        )}
        {resultado.forca && (
          <div>
            <p style={{ fontSize: 11, color: "var(--ouro)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
              Sua força
            </p>
            <p style={{ fontFamily: "'Bodoni Moda', serif", fontSize: 18 }}>{resultado.forca as string}</p>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {pilares.map((pilar) => {
          const key = pilar.toLowerCase().replace(/\s*\/\s*/g, "_").replace(/\s+/g, "_");
          const nota = typeof resultado[key] === "number" ? (resultado[key] as number) : null;
          const nivel = nota !== null ? NIVEL[Math.round(nota)] ?? "—" : "—";
          const pct = nota !== null ? ((nota - 1) / 4) * 100 : 0;

          return (
            <div
              key={pilar}
              style={{
                background: "#fff",
                borderRadius: "var(--radius)",
                padding: "14px 16px",
                boxShadow: "0 1px 6px var(--sombra)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--chocolate)" }}>{pilar}</span>
                <span style={{ fontSize: 13, color: "var(--ouro)", fontWeight: 600 }}>{nivel}</span>
              </div>
              {nota !== null && (
                <div style={{ height: 4, background: "rgba(61,31,13,0.1)", borderRadius: 4 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: "var(--ouro)",
                      borderRadius: 4,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadingMsg() {
  return (
    <div style={{ padding: "60px 20px", textAlign: "center", color: "#6b4a35", fontSize: 14 }}>
      Carregando perguntas...
    </div>
  );
}
