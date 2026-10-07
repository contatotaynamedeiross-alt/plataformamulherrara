// Lógica pura de cálculo do diagnóstico — sem dependência de Deno ou Supabase.
// Importado tanto pela Edge Function quanto pelos testes Node.js.

export type Area = 'identidade' | 'posicionamento' | 'produto' | 'marketing' | 'marca';
export type Nivel = 'Iniciante' | 'Em Desenvolvimento' | 'Avançada' | 'Rara';

export interface Resposta {
  pergunta_id: number;
  area: Area;
  pontos: number; // 0–3
}

export interface ResultadoDiagnostico {
  pts_identidade: number;
  pts_posicionamento: number;
  pts_produto: number;
  pts_marketing: number;
  pts_marca: number;
  total: number;
  nivel: Nivel;
}

export function calcularNivel(total: number): Nivel {
  if (total >= 36) return 'Rara';
  if (total >= 25) return 'Avançada';
  if (total >= 12) return 'Em Desenvolvimento';
  return 'Iniciante';
}

export function calcularResultado(respostas: Resposta[]): ResultadoDiagnostico {
  const soma: Record<Area, number> = {
    identidade: 0,
    posicionamento: 0,
    produto: 0,
    marketing: 0,
    marca: 0,
  };

  for (const r of respostas) {
    if (r.pontos < 0 || r.pontos > 3) {
      throw new Error(`Pontuação inválida ${r.pontos} na pergunta ${r.pergunta_id}`);
    }
    soma[r.area] += r.pontos;
  }

  const total =
    soma.identidade +
    soma.posicionamento +
    soma.produto +
    soma.marketing +
    soma.marca;

  return {
    pts_identidade:     soma.identidade,
    pts_posicionamento: soma.posicionamento,
    pts_produto:        soma.produto,
    pts_marketing:      soma.marketing,
    pts_marca:          soma.marca,
    total,
    nivel: calcularNivel(total),
  };
}
