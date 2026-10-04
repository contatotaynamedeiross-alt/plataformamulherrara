// Respostas HTTP com cabeçalhos de segurança e CORS restrito ao domínio do app.

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`variavel de ambiente ausente: ${name}`);
  return v;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

export function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
}

/** Lê o corpo com limite de tamanho para não aceitar payloads gigantes. */
export async function readLimited(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return null;
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength > maxBytes) return null;
  return new TextDecoder().decode(buf);
}

/** Log sem dados pessoais: só ids técnicos e resultados. */
export function log(event: string, data: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...data }));
}
