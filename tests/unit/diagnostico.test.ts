import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularNivel, calcularResultado, type Resposta } from '../../supabase/functions/_shared/diagnostico.ts';

// Helper: gera respostas com pontuação uniforme por área
function respostasUniformes(pontos: number): Resposta[] {
  const areas = ['identidade','posicionamento','produto','marketing','marca'] as const;
  return areas.flatMap((area, ai) =>
    [1, 2, 3].map((posicao, pi) => ({
      pergunta_id: ai * 3 + pi + 1,
      area,
      pontos,
    }))
  );
}

describe('calcularNivel', () => {
  it('0 pts → Iniciante',            () => assert.equal(calcularNivel(0),  'Iniciante'));
  it('11 pts → Iniciante',           () => assert.equal(calcularNivel(11), 'Iniciante'));
  it('12 pts → Em Desenvolvimento',  () => assert.equal(calcularNivel(12), 'Em Desenvolvimento'));
  it('24 pts → Em Desenvolvimento',  () => assert.equal(calcularNivel(24), 'Em Desenvolvimento'));
  it('25 pts → Avançada',            () => assert.equal(calcularNivel(25), 'Avançada'));
  it('35 pts → Avançada',            () => assert.equal(calcularNivel(35), 'Avançada'));
  it('36 pts → Rara',                () => assert.equal(calcularNivel(36), 'Rara'));
  it('45 pts → Rara',                () => assert.equal(calcularNivel(45), 'Rara'));
});

describe('calcularResultado', () => {
  it('todas as respostas 0 → total 0, nível Iniciante', () => {
    const r = calcularResultado(respostasUniformes(0));
    assert.equal(r.total, 0);
    assert.equal(r.nivel, 'Iniciante');
    assert.equal(r.pts_identidade,     0);
    assert.equal(r.pts_posicionamento, 0);
    assert.equal(r.pts_produto,        0);
    assert.equal(r.pts_marketing,      0);
    assert.equal(r.pts_marca,          0);
  });

  it('todas as respostas 3 → total 45, nível Rara', () => {
    const r = calcularResultado(respostasUniformes(3));
    assert.equal(r.total, 45);
    assert.equal(r.nivel, 'Rara');
    assert.equal(r.pts_identidade,     9);
    assert.equal(r.pts_posicionamento, 9);
    assert.equal(r.pts_produto,        9);
    assert.equal(r.pts_marketing,      9);
    assert.equal(r.pts_marca,          9);
  });

  it('todas as respostas 1 → total 15, nível Em Desenvolvimento', () => {
    const r = calcularResultado(respostasUniformes(1));
    assert.equal(r.total, 15);
    assert.equal(r.nivel, 'Em Desenvolvimento');
  });

  it('todas as respostas 2 → total 30, nível Avançada', () => {
    const r = calcularResultado(respostasUniformes(2));
    assert.equal(r.total, 30);
    assert.equal(r.nivel, 'Avançada');
  });

  it('pontuação mista calcula por área corretamente', () => {
    const respostas: Resposta[] = [
      // identidade: 3+2+1 = 6
      { pergunta_id: 1, area: 'identidade',     pontos: 3 },
      { pergunta_id: 2, area: 'identidade',     pontos: 2 },
      { pergunta_id: 3, area: 'identidade',     pontos: 1 },
      // posicionamento: 0+0+0 = 0
      { pergunta_id: 4, area: 'posicionamento', pontos: 0 },
      { pergunta_id: 5, area: 'posicionamento', pontos: 0 },
      { pergunta_id: 6, area: 'posicionamento', pontos: 0 },
      // produto: 3+3+3 = 9
      { pergunta_id: 7, area: 'produto',        pontos: 3 },
      { pergunta_id: 8, area: 'produto',        pontos: 3 },
      { pergunta_id: 9, area: 'produto',        pontos: 3 },
      // marketing: 1+1+1 = 3
      { pergunta_id: 10, area: 'marketing',     pontos: 1 },
      { pergunta_id: 11, area: 'marketing',     pontos: 1 },
      { pergunta_id: 12, area: 'marketing',     pontos: 1 },
      // marca: 2+2+2 = 6
      { pergunta_id: 13, area: 'marca',         pontos: 2 },
      { pergunta_id: 14, area: 'marca',         pontos: 2 },
      { pergunta_id: 15, area: 'marca',         pontos: 2 },
    ];
    const r = calcularResultado(respostas);
    assert.equal(r.pts_identidade,     6);
    assert.equal(r.pts_posicionamento, 0);
    assert.equal(r.pts_produto,        9);
    assert.equal(r.pts_marketing,      3);
    assert.equal(r.pts_marca,          6);
    assert.equal(r.total, 24);
    assert.equal(r.nivel, 'Em Desenvolvimento');
  });

  it('pontuação inválida (> 3) lança erro', () => {
    assert.throws(
      () => calcularResultado([{ pergunta_id: 1, area: 'identidade', pontos: 4 }]),
      /Pontuação inválida/,
    );
  });

  it('pontuação inválida (< 0) lança erro', () => {
    assert.throws(
      () => calcularResultado([{ pergunta_id: 1, area: 'identidade', pontos: -1 }]),
      /Pontuação inválida/,
    );
  });
});
