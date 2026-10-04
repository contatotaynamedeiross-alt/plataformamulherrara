# Rara IA — Mapa LGPD

## Quem trata os dados

**Controladora:** [Nome da empresa / Tayna Deiros]
**DPO (Encarregado):** [Nomear antes do lançamento]
**Operadora:** Supabase Inc. (infraestrutura), Greenn (pagamentos)

---

## Dados coletados e por quê

| Dado            | Origem  | Finalidade                          | Base legal (LGPD)          | Armazenado? |
|-----------------|---------|-------------------------------------|----------------------------|-------------|
| Nome completo   | Greenn  | Personalizar experiência            | Contrato (art. 7, V)       | ✅ profiles |
| E-mail          | Greenn  | Autenticação, comunicação           | Contrato (art. 7, V)       | ✅ profiles |
| Status assinatura | Greenn | Controlar acesso à plataforma      | Contrato (art. 7, V)       | ✅ subscriptions |
| ID do pedido    | Greenn  | Idempotência, suporte               | Contrato (art. 7, V)       | ✅ subscriptions |
| CPF             | Greenn  | —                                   | —                          | ❌ descartado |
| Endereço        | Greenn  | —                                   | —                          | ❌ descartado |
| Telefone        | Greenn  | —                                   | —                          | ❌ descartado |
| Respostas ao diagnóstico | App | Gerar plano personalizado     | Legítimo interesse + Consentimento | ✅ diagnostics |
| **Crença/fé** (diagnóstico) | App | Personalizar plano | **Consentimento explícito (art. 11)** | ✅ só com consent_id |
| Missões, pontos, medalhas | App | Engajamento | Contrato (art. 7, V)   | ✅ missions/points/medals |
| Consentimentos  | App     | Registro legal                      | Obrigação legal (art. 7, II) | ✅ consents |

---

## Dado sensível: crença/fé

A pergunta sobre crença religiosa revela **convicção religiosa**, dado sensível pela LGPD (art. 5, II).

**Tratamento:**
1. Antes de exibir a pergunta, o front mostra aviso claro e pede consentimento explícito.
2. Usuária clica "Aceito" → front chama RPC `record_consent('diagnostic_sensitive_v1', '1.0', true)`.
3. Só então o diagnóstico é enviado com `contains_sensitive: true` e o `consent_id` retornado.
4. Trigger no banco bloqueia INSERT com `contains_sensitive = true` e `consent_id = null`.

**Revogar consentimento:** usuária chama `record_consent(..., false)`. Nova linha é inserida com `accepted = false`. Sistema não solicita mais o dado sensível.

---

## Direitos das titulares (art. 18)

| Direito                        | Como exercer na plataforma |
|--------------------------------|----------------------------|
| Confirmação de tratamento      | Seção "Meus dados" no app  |
| Acesso aos dados               | Botão "Baixar meus dados" → RPC `export_my_data()` |
| Correção                       | Editar perfil no app       |
| Anonimização / bloqueio        | [Implementar Sprint 2]     |
| Eliminação                     | Botão "Excluir conta" → Edge Function `account-delete` |
| Portabilidade                  | Arquivo JSON gerado por `export_my_data()` |
| Revogação de consentimento     | Seção "Consentimentos" no app |
| Informação sobre compartilhamento | Política de privacidade |
| Revisão de decisão automatizada | [Implementar Sprint 3]    |

---

## Retenção e descarte

| Dado                | Retenção          | Descarte |
|---------------------|-------------------|----------|
| Perfil + assinatura | Enquanto conta ativa + 5 anos (obrigação contábil) | DELETE via account-delete |
| Diagnósticos        | 2 anos            | [Job de purge — Sprint 2] |
| Audit log           | 1 ano             | [Job de purge — Sprint 2] |
| processed_events    | 30 dias           | `private.purge_old_events()` via pg_cron |

---

## Transferência internacional

- **Supabase (AWS São Paulo — sa-east-1):** dados processados no Brasil.
- **Greenn:** empresa brasileira; dados de pagamento ficam na Greenn.

---

## Ações antes do lançamento

- [ ] Contratar advogado para revisar política de privacidade e termos de uso
- [ ] Nomear DPO e publicar contato no site
- [ ] Registrar na ANPD (quando obrigatório para o porte da empresa)
- [ ] Revisar este mapa após qualquer nova coleta de dados
