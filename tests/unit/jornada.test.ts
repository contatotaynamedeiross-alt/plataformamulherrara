import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSystemPrompt,
  isPilar,
  validarInput,
  PILARES,
} from '../../supabase/functions/_shared/jornada.ts';

describe('isPilar', () => {
  it('reconhece os 5 pilares válidos', () => {
    for (const pilar of PILARES) {
      assert.ok(isPilar(pilar), `${pilar} deve ser pilar válido`);
    }
  });

  it('rejeita string vazia', () => {
    assert.equal(isPilar(''), false);
  });

  it('rejeita pilar inexistente', () => {
    assert.equal(isPilar('financas'), false);
  });

  it('é case-sensitive', () => {
    assert.equal(isPilar('Identidade'), false);
    assert.equal(isPilar('MARKETING'), false);
  });
});

describe('getSystemPrompt', () => {
  it('retorna prompt não-vazio para cada pilar', () => {
    for (const pilar of PILARES) {
      const prompt = getSystemPrompt(pilar);
      assert.ok(typeof prompt === 'string' && prompt.length > 20,
        `prompt do pilar ${pilar} deve ser uma string longa`);
    }
  });

  it('prompt de identidade menciona Identidade', () => {
    assert.ok(getSystemPrompt('identidade').includes('Identidade'));
  });

  it('prompt de posicionamento menciona Posicionamento', () => {
    assert.ok(getSystemPrompt('posicionamento').includes('Posicionamento'));
  });

  it('prompt de produto menciona Produto', () => {
    assert.ok(getSystemPrompt('produto').includes('Produto'));
  });

  it('prompt de marketing menciona Marketing', () => {
    assert.ok(getSystemPrompt('marketing').includes('Marketing'));
  });

  it('prompt de marca menciona Marca', () => {
    assert.ok(getSystemPrompt('marca').includes('Marca'));
  });

  it('cada pilar tem prompt distinto', () => {
    const prompts = PILARES.map(p => getSystemPrompt(p));
    const unicos = new Set(prompts);
    assert.equal(unicos.size, PILARES.length, 'cada pilar deve ter prompt único');
  });

  it('lança erro para pilar inválido', () => {
    assert.throws(() => getSystemPrompt('outro'), /Pilar inválido/);
  });

  it('lança erro para string vazia', () => {
    assert.throws(() => getSystemPrompt(''), /Pilar inválido/);
  });
});

describe('validarInput', () => {
  it('aceita input completamente válido', () => {
    const erros = validarInput({ sessao_id: 'uuid-valido', mensagem: 'olá, quero começar' });
    assert.equal(erros.length, 0);
  });

  it('rejeita body nulo', () => {
    const erros = validarInput(null);
    assert.ok(erros.length > 0);
  });

  it('rejeita body não-objeto (número)', () => {
    const erros = validarInput(42);
    assert.ok(erros.length > 0);
  });

  it('rejeita body não-objeto (string)', () => {
    const erros = validarInput('texto');
    assert.ok(erros.length > 0);
  });

  it('rejeita sessao_id ausente', () => {
    const erros = validarInput({ mensagem: 'olá' });
    assert.ok(erros.some(e => e.field === 'sessao_id'));
  });

  it('rejeita sessao_id só com espaços', () => {
    const erros = validarInput({ sessao_id: '   ', mensagem: 'olá' });
    assert.ok(erros.some(e => e.field === 'sessao_id'));
  });

  it('rejeita sessao_id não-string', () => {
    const erros = validarInput({ sessao_id: 123, mensagem: 'olá' });
    assert.ok(erros.some(e => e.field === 'sessao_id'));
  });

  it('rejeita mensagem ausente', () => {
    const erros = validarInput({ sessao_id: 'uuid' });
    assert.ok(erros.some(e => e.field === 'mensagem'));
  });

  it('rejeita mensagem vazia', () => {
    const erros = validarInput({ sessao_id: 'uuid', mensagem: '' });
    assert.ok(erros.some(e => e.field === 'mensagem'));
  });

  it('rejeita mensagem só com espaços', () => {
    const erros = validarInput({ sessao_id: 'uuid', mensagem: '  ' });
    assert.ok(erros.some(e => e.field === 'mensagem'));
  });

  it('reporta ambos os erros quando os dois campos faltam', () => {
    const erros = validarInput({});
    assert.equal(erros.length, 2);
    assert.ok(erros.some(e => e.field === 'sessao_id'));
    assert.ok(erros.some(e => e.field === 'mensagem'));
  });
});
