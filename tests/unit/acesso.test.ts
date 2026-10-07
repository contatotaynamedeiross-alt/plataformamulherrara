import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verificarAcesso } from '../../supabase/functions/_shared/acesso.ts';

describe('verificarAcesso', () => {
  it('retorna tem_acesso=false quando assinante é null (sem registro)', () => {
    const r = verificarAcesso(null);
    assert.equal(r.tem_acesso, false);
    assert.equal(r.plano, undefined);
    assert.equal(r.data_fim, undefined);
  });

  it('retorna tem_acesso=false quando status é suspenso', () => {
    const r = verificarAcesso({ plano: 'mensal', status: 'suspenso', data_fim: null });
    assert.equal(r.tem_acesso, false);
  });

  it('retorna tem_acesso=false quando status é cancelado', () => {
    const r = verificarAcesso({ plano: 'anual', status: 'cancelado', data_fim: null });
    assert.equal(r.tem_acesso, false);
  });

  it('retorna tem_acesso=true quando status é ativo', () => {
    const r = verificarAcesso({ plano: 'mensal', status: 'ativo', data_fim: null });
    assert.equal(r.tem_acesso, true);
  });

  it('inclui o plano na resposta quando ativo', () => {
    const r = verificarAcesso({ plano: 'trimestral', status: 'ativo', data_fim: null });
    assert.equal(r.plano, 'trimestral');
  });

  it('inclui data_fim quando presente e ativo', () => {
    const data = '2027-01-01T00:00:00Z';
    const r = verificarAcesso({ plano: 'anual', status: 'ativo', data_fim: data });
    assert.equal(r.data_fim, data);
  });

  it('não inclui data_fim quando ausente (null)', () => {
    const r = verificarAcesso({ plano: 'mensal', status: 'ativo', data_fim: null });
    assert.equal(r.data_fim, undefined);
  });

  it('suspenso com data_fim preenchida ainda retorna sem acesso', () => {
    const r = verificarAcesso({ plano: 'mensal', status: 'suspenso', data_fim: '2099-01-01T00:00:00Z' });
    assert.equal(r.tem_acesso, false);
    assert.equal(r.plano, undefined);
  });

  it('verifica todos os planos válidos', () => {
    for (const plano of ['mensal', 'trimestral', 'anual'] as const) {
      const r = verificarAcesso({ plano, status: 'ativo', data_fim: null });
      assert.equal(r.tem_acesso, true);
      assert.equal(r.plano, plano);
    }
  });
});
