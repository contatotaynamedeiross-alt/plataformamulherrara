// Lógica pura de verificação de acesso — sem dependência de Deno ou Supabase.
// Importado tanto pela Edge Function quanto pelos testes Node.js.

export type StatusAssinante = 'ativo' | 'suspenso' | 'cancelado';

export interface RegistroAssinante {
  plano:    string;
  status:   StatusAssinante;
  data_fim: string | null;
}

export interface RespostaAcesso {
  tem_acesso: boolean;
  plano?:     string;
  data_fim?:  string;
}

export function verificarAcesso(assinante: RegistroAssinante | null): RespostaAcesso {
  if (!assinante || assinante.status !== 'ativo') {
    return { tem_acesso: false };
  }
  return {
    tem_acesso: true,
    plano:      assinante.plano,
    ...(assinante.data_fim ? { data_fim: assinante.data_fim } : {}),
  };
}
