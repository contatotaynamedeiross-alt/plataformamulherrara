import { useRef, useEffect, useState } from "react";

export interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  messages: Msg[];
  onSend: (text: string) => Promise<void>;
  sending: boolean;
  placeholder?: string;
  extra?: React.ReactNode;
}

export default function Chat({ messages, onSend, sending, placeholder, extra }: Props) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const submit = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setText("");
    await onSend(t);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {extra && <div style={{ padding: "0 20px 8px" }}>{extra}</div>}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {messages.map((m, i) => (
          <Bubble key={i} msg={m} />
        ))}
        {sending && (
          <div style={{ alignSelf: "flex-start" }}>
            <Typing />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "12px 20px",
          borderTop: "1px solid rgba(61,31,13,0.1)",
          background: "var(--creme)",
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder ?? "Digite sua mensagem..."}
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            border: "1px solid rgba(61,31,13,0.2)",
            borderRadius: 10,
            padding: "10px 14px",
            fontFamily: "'Jost', sans-serif",
            fontSize: 14,
            color: "var(--chocolate)",
            background: "#fff",
            outline: "none",
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={submit}
          disabled={!text.trim() || sending}
          style={{
            background: "var(--chocolate)",
            color: "var(--creme)",
            border: "none",
            borderRadius: 10,
            padding: "10px 18px",
            fontFamily: "'Jost', sans-serif",
            fontWeight: 500,
            fontSize: 14,
            cursor: "pointer",
            opacity: !text.trim() || sending ? 0.5 : 1,
            transition: "opacity 0.15s",
          }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "80%",
        background: isUser ? "var(--chocolate)" : "#fff",
        color: isUser ? "var(--creme)" : "var(--chocolate)",
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        padding: "10px 14px",
        fontSize: 14,
        lineHeight: 1.6,
        boxShadow: "0 1px 4px var(--sombra)",
        whiteSpace: "pre-wrap",
      }}
    >
      {msg.content}
    </div>
  );
}

function Typing() {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "16px 16px 16px 4px",
        padding: "12px 16px",
        display: "flex",
        gap: 5,
        boxShadow: "0 1px 4px var(--sombra)",
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--ouro)",
            display: "inline-block",
            animation: `bounce 1.2s ${i * 0.2}s infinite ease-in-out`,
          }}
        />
      ))}
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}
