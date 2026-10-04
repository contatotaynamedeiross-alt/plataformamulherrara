# Segurança

## Como reportar uma falha

Envie para o e-mail de segurança definido pela Rara IA (preencher antes do lançamento), sem abrir
issue pública. Respondemos em até 2 dias úteis.

## Controles em vigor

| Risco | Controle | Onde é testado |
| --- | --- | --- |
| Uma usuária ler ou alterar dados de outra | RLS em todas as tabelas; políticas por `auth.uid()` | `tests/db/10_security_test.sql` |
| Acesso anônimo a dados | `anon` sem nenhum privilégio de tabela | idem |
| Forjar pontos, acesso ou diagnóstico pelo navegador | Escrita só por RPC `SECURITY DEFINER`; colunas protegidas por GRANT | idem |
| Funções privilegiadas sequestradas por `search_path` | Toda função `SECURITY DEFINER` com `search_path = ''` | idem (teste automático) |
| Webhook falso liberando acesso | Token secreto de 64 caracteres na URL, comparação em tempo constante, lista de produtos permitidos | `tests/unit/greenn.test.ts` |
| Webhook repetido ou fora de ordem | Chave de idempotência única e comparação de `updated_at` | `tests/db/` |
| Payload gigante derrubando a função | Limite de 64 KB | código |
| Chave vazada no Git | Varredura com gitleaks na esteira; `.env` no `.gitignore` | CI |
| Contas falsas | Cadastro fechado; entrada só por convite após pagamento | configuração do Supabase |
| Força bruta no login | Link mágico, sem senha; limites do Supabase Auth | configuração |
| Vazamento por logs | Logs só com ids técnicos; e-mail apenas em hash na auditoria | código |
| Perda de dados | Backups diários do Supabase (plano Pro) | configuração |

## Risco residual conhecido

A Greenn não assina os webhooks (sem HMAC). Quem descobrir a URL com o token poderia simular uma
compra. Mitigações: token longo e secreto, troca imediata se houver suspeita, lista de produtos
permitidos e conferência periódica de assinaturas ativas contra o painel da Greenn. Se a Greenn
passar a oferecer assinatura ou lista de IPs, adotar.

## Rotina

- Trocar `GREENN_WEBHOOK_TOKEN` a cada 6 meses ou em qualquer suspeita (novo segredo → atualizar a URL na Greenn).
- Revisar quem é admin a cada mês.
- Rodar o Security Advisor do Supabase a cada sprint e antes de cada lançamento.
- Toda mudança entra por pull request com a esteira verde.

## Resposta a incidente

1. Conter: trocar chaves e tokens, desativar a função afetada.
2. Avaliar: quais dados, quantas titulares, desde quando (`private.audit_log`, logs das funções).
3. Comunicar: à ANPD e às titulares afetadas no prazo legal quando houver risco ou dano relevante
   (ver `docs/LGPD.md`).
4. Corrigir, escrever um teste que reproduza o problema e registrar o aprendizado.
