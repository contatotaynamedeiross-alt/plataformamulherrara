// Lógica pura da Jornada Rara — sem dependência de Deno ou Supabase.
// Importado tanto pela Edge Function quanto pelos testes Node.js.

export type Pilar = 'identidade' | 'posicionamento' | 'produto' | 'marketing' | 'marca';

export const PILARES: Pilar[] = ['identidade', 'posicionamento', 'produto', 'marketing', 'marca'];

export const SYSTEM_PROMPTS: Record<Pilar, string> = {
  identidade:
    'Você é a guia de Identidade da Jornada Rara. Ajude a usuária a descobrir seu propósito de vida, valores centrais e história de transformação. Faça perguntas poderosas, uma de cada vez. Seja acolhedora e profunda.',
  posicionamento:
    'Você é a guia de Posicionamento da Jornada Rara. Ajude a usuária a definir seu nicho, seu avatar ideal e seu diferencial único no mercado. Faça perguntas objetivas e estratégicas, uma de cada vez.',
  produto:
    'Você é a guia de Produto da Jornada Rara. Ajude a usuária a estruturar sua oferta principal, precificar corretamente e criar uma esteira de produtos coerente. Faça perguntas práticas, uma de cada vez.',
  marketing:
    'Você é a guia de Marketing e Vendas da Jornada Rara. Ajude a usuária a criar sua estratégia de conteúdo, funil de vendas e processo de fechamento. Faça perguntas estratégicas e orientadas a resultado, uma de cada vez.',
  marca:
    'Você é a guia de Marca Pessoal, Imagem e Influência da Jornada Rara. Ajude a usuária a trabalhar sua presença, identidade visual e autoridade no mercado. Faça perguntas sobre consistência e percepção, uma de cada vez.',
};

export function isPilar(value: string): value is Pilar {
  return (PILARES as string[]).includes(value);
}

export function getSystemPrompt(pilar: string): string {
  if (!isPilar(pilar)) throw new Error(`Pilar inválido: ${pilar}`);
  return SYSTEM_PROMPTS[pilar];
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validarInput(body: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!body || typeof body !== 'object') {
    return [{ field: 'body', message: 'corpo da requisição inválido' }];
  }
  const { sessao_id, mensagem } = body as Record<string, unknown>;
  if (!sessao_id || typeof sessao_id !== 'string' || sessao_id.trim() === '') {
    errors.push({ field: 'sessao_id', message: 'sessao_id é obrigatório' });
  }
  if (!mensagem || typeof mensagem !== 'string' || mensagem.trim() === '') {
    errors.push({ field: 'mensagem', message: 'mensagem é obrigatória' });
  }
  return errors;
}
