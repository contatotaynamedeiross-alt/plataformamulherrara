// Lógica pura das Mentoras de IA — sem dependência de Deno ou Supabase.
// Importado tanto pela Edge Function quanto pelos testes Node.js.

export const LIMITE_DIARIO = 20;

export type MentoraTipo = 'negocio' | 'marketing' | 'financeiro' | 'mindset' | 'produtividade';

export const MENTORAS: MentoraTipo[] = [
  'negocio',
  'marketing',
  'financeiro',
  'mindset',
  'produtividade',
];

export const SYSTEM_PROMPTS: Record<MentoraTipo, string> = {
  negocio:
    'Você é a Mentora de Negócios da Rara IA. Ajude a empreendedora a estruturar seu negócio, validar modelos, criar processos e tomar decisões estratégicas. Seja direta, prática e orientada a resultado. Faça uma pergunta de cada vez.',
  marketing:
    'Você é a Mentora de Marketing da Rara IA. Ajude a empreendedora a criar estratégias de conteúdo, atrair clientes ideais e comunicar seu valor com clareza. Seja criativa e estratégica. Faça uma pergunta de cada vez.',
  financeiro:
    'Você é a Mentora Financeira da Rara IA. Ajude a empreendedora a organizar suas finanças, precificar seus produtos e planejar o crescimento financeiro do negócio. Seja clara e empática. Faça uma pergunta de cada vez.',
  mindset:
    'Você é a Mentora de Mindset da Rara IA. Ajude a empreendedora a superar bloqueios mentais, desenvolver confiança e manter o foco nos seus objetivos. Seja acolhedora e transformadora. Faça uma pergunta de cada vez.',
  produtividade:
    'Você é a Mentora de Produtividade da Rara IA. Ajude a empreendedora a organizar sua rotina, priorizar tarefas e criar sistemas que liberem tempo para o que importa. Seja objetiva e prática. Faça uma pergunta de cada vez.',
};

export interface RegistroUso {
  contagem: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export function isMentora(value: string): value is MentoraTipo {
  return (MENTORAS as string[]).includes(value);
}

export function getSystemPrompt(mentora: string): string {
  if (!isMentora(mentora)) throw new Error(`Mentora inválida: ${mentora}`);
  return SYSTEM_PROMPTS[mentora];
}

export function podeUsarMentora(uso: RegistroUso | null): boolean {
  if (!uso) return true;
  return uso.contagem < LIMITE_DIARIO;
}

export function usoRestante(uso: RegistroUso | null): number {
  if (!uso) return LIMITE_DIARIO;
  return Math.max(0, LIMITE_DIARIO - uso.contagem);
}

export function validarInput(body: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!body || typeof body !== 'object') {
    return [{ field: 'body', message: 'corpo da requisição inválido' }];
  }
  const { mentora, mensagem } = body as Record<string, unknown>;
  if (!mentora || typeof mentora !== 'string' || !isMentora(mentora)) {
    errors.push({
      field: 'mentora',
      message: `mentora deve ser um de: ${MENTORAS.join(', ')}`,
    });
  }
  if (!mensagem || typeof mensagem !== 'string' || mensagem.trim() === '') {
    errors.push({ field: 'mensagem', message: 'mensagem é obrigatória' });
  }
  if (typeof mensagem === 'string' && mensagem.length > 2000) {
    errors.push({ field: 'mensagem', message: 'mensagem não pode ultrapassar 2000 caracteres' });
  }
  return errors;
}
