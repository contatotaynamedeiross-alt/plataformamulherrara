import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITE_DIARIO,
  MENTORAS,
  isMentora,
  getSystemPrompt,
  podeUsarMentora,
  usoRestante,
  validarInput,
} from '../../supabase/functions/_shared/mentora.ts';

describe('isMentora', () => {
  it('aceita valores válidos', () => {
    for (const m of MENTORAS) {
      assert.ok(isMentora(m));
    }
  });

  it('rejeita valores inválidos', () => {
    assert.ok(!isMentora('vendas'));
    assert.ok(!isMentora(''));
    assert.ok(!isMentora('NEGOCIO'));
  });
});

describe('getSystemPrompt', () => {
  it('retorna prompt para cada mentora', () => {
    for (const m of MENTORAS) {
      const p = getSystemPrompt(m);
      assert.ok(p.length > 20);
    }
  });

  it('lança erro para mentora inválida', () => {
    assert.throws(() => getSystemPrompt('invalida'), /Mentora inválida/);
  });
});

describe('podeUsarMentora', () => {
  it('permite quando não há uso hoje', () => {
    assert.ok(podeUsarMentora(null));
  });

  it('permite quando abaixo do limite', () => {
    assert.ok(podeUsarMentora({ contagem: LIMITE_DIARIO - 1 }));
  });

  it('bloqueia quando no limite', () => {
    assert.ok(!podeUsarMentora({ contagem: LIMITE_DIARIO }));
  });

  it('bloqueia quando acima do limite', () => {
    assert.ok(!podeUsarMentora({ contagem: LIMITE_DIARIO + 5 }));
  });
});

describe('usoRestante', () => {
  it('retorna limite total quando não há uso', () => {
    assert.equal(usoRestante(null), LIMITE_DIARIO);
  });

  it('calcula corretamente', () => {
    assert.equal(usoRestante({ contagem: 5 }), LIMITE_DIARIO - 5);
  });

  it('nunca retorna negativo', () => {
    assert.equal(usoRestante({ contagem: LIMITE_DIARIO + 10 }), 0);
  });
});

describe('validarInput', () => {
  it('aceita input válido', () => {
    const erros = validarInput({ mentora: 'negocio', mensagem: 'Preciso de ajuda' });
    assert.equal(erros.length, 0);
  });

  it('rejeita body nulo', () => {
    const erros = validarInput(null);
    assert.equal(erros.length, 1);
    assert.equal(erros[0].field, 'body');
  });

  it('rejeita mentora inválida', () => {
    const erros = validarInput({ mentora: 'vendas', mensagem: 'oi' });
    assert.ok(erros.some(e => e.field === 'mentora'));
  });

  it('rejeita mensagem vazia', () => {
    const erros = validarInput({ mentora: 'marketing', mensagem: '   ' });
    assert.ok(erros.some(e => e.field === 'mensagem'));
  });

  it('rejeita mensagem muito longa', () => {
    const erros = validarInput({ mentora: 'mindset', mensagem: 'x'.repeat(2001) });
    assert.ok(erros.some(e => e.field === 'mensagem'));
  });

  it('acumula múltiplos erros', () => {
    const erros = validarInput({ mentora: 'invalida', mensagem: '' });
    assert.ok(erros.length >= 2);
  });

  it('aceita todas as mentoras válidas', () => {
    for (const m of MENTORAS) {
      const erros = validarInput({ mentora: m, mensagem: 'Olá' });
      assert.equal(erros.length, 0, `Falhou para mentora: ${m}`);
    }
  });
});
