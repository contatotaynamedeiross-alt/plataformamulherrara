import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import type { User } from "@supabase/supabase-js";
import Login from "./screens/Login";
import Dashboard from "./screens/Dashboard";
import Diagnostico from "./screens/Diagnostico";
import Jornada from "./screens/Jornada";
import Mentoras from "./screens/Mentoras";
import AcessoInativo from "./screens/AcessoInativo";
import Nav from "./components/Nav";

export type Screen = "dashboard" | "diagnostico" | "jornada" | "mentoras";

export interface AcessoInfo {
  tem_acesso: boolean;
  plano: string | null;
  status: string | null;
  data_fim: string | null;
}

const S: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  maxWidth: 480,
  margin: "0 auto",
  background: "var(--creme)",
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [acesso, setAcesso] = useState<AcessoInfo | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session) setAcesso(null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.functions.invoke("verificar-acesso")
      .then(({ data }) => {
        if (data) {
          setAcesso({
            tem_acesso: !!data.tem_acesso,
            plano: data.plano ?? null,
            status: data.tem_acesso ? "ativo" : "cancelado",
            data_fim: data.data_fim ?? null,
          });
        } else {
          setAcesso({ tem_acesso: false, plano: null, status: null, data_fim: null });
        }
      })
      .catch(() => setAcesso({ tem_acesso: false, plano: null, status: null, data_fim: null }));
  }, [user]);

  const signOut = () => supabase.auth.signOut();

  if (loading) return <Splash />;
  if (!user) return <Login />;
  if (!acesso) return <Splash />;
  if (!acesso.tem_acesso) return <AcessoInativo onSignOut={signOut} />;

  return (
    <div style={S}>
      <Header onSignOut={signOut} />
      <main style={{ flex: 1, overflowY: "auto", padding: "0 0 80px" }}>
        {screen === "dashboard" && <Dashboard acesso={acesso} />}
        {screen === "diagnostico" && <Diagnostico />}
        {screen === "jornada" && <Jornada />}
        {screen === "mentoras" && <Mentoras />}
      </main>
      <Nav current={screen} onChange={setScreen} />
    </div>
  );
}

function Header({ onSignOut }: { onSignOut: () => void }) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 20px",
        borderBottom: "1px solid rgba(61,31,13,0.1)",
        background: "var(--creme)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontFamily: "'Bodoni Moda', serif",
          fontSize: 20,
          fontWeight: 600,
          color: "var(--chocolate)",
          letterSpacing: "0.04em",
        }}
      >
        Rara IA
      </span>
      <button
        onClick={onSignOut}
        style={{
          background: "none",
          border: "1px solid rgba(61,31,13,0.25)",
          borderRadius: 8,
          padding: "6px 14px",
          fontSize: 13,
          fontFamily: "'Jost', sans-serif",
          color: "var(--chocolate)",
          cursor: "pointer",
        }}
      >
        Sair
      </button>
    </header>
  );
}

function Splash() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--creme)",
      }}
    >
      <span
        style={{
          fontFamily: "'Bodoni Moda', serif",
          fontSize: 28,
          color: "var(--chocolate)",
          opacity: 0.5,
          letterSpacing: "0.06em",
        }}
      >
        Rara IA
      </span>
    </div>
  );
}
