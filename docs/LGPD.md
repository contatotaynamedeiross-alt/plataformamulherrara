# LGPD · Mapa de dados e regras

Documento técnico de apoio. A política de privacidade e os termos de uso precisam ser escritos ou
revisados por advogado antes do lançamento.

## Mapa de dados

| Dado | Finalidade | Base legal (LGPD) | Retenção |
| --- | --- | --- | --- |
| E-mail | Login e vínculo com a assinatura | Execução de contrato (art. 7º, V) | Enquanto a conta existir |
| Nome, negócio, faturamento, meta, travas, tempo | Personalizar o plano | Execução de contrato (art. 7º, V) | Enquanto a conta existir |
| Respostas do diagnóstico (inclui pergunta sobre fé) | Calcular o plano | **Consentimento específico** para dado sensível de convicção religiosa (art. 11, I) | Enquanto a conta existir ou até revogar |
| Missões, entregas do dia, pontos | Acompanhar evolução | Execução de contrato | Enquanto a conta existir |
| Status da assinatura | Liberar ou bloquear acesso | Execução de contrato | Anonimizado após exclusão; mantido por obrigação legal |
| Eventos da Greenn (sem dados pessoais) | Auditoria e reprocessamento | Legítimo interesse (art. 7º, IX) | 180 dias |
| Registro de auditoria (e-mail só em hash) | Segurança e prova de conformidade | Legítimo interesse / obrigação legal | 5 anos |

**Não coletamos:** CPF, endereço, telefone ou dados de cartão. A Greenn envia, mas o webhook descarta.

## Consentimentos

Registrados em `public.consents`, só acrescentando linhas (revogar = nova linha com `granted = false`).

| Finalidade (`purpose`) | Quando pedir | Obrigatório para |
| --- | --- | --- |
| `termos_uso` | Primeiro acesso | Usar o app |
| `politica_privacidade` | Primeiro acesso | Usar o app |
| `dados_sensiveis` | Antes do diagnóstico, com texto claro sobre a pergunta de fé | Salvar o diagnóstico (bloqueado no banco) |
| `comunicacoes` | Opcional | E-mails de marketing |

Toda mudança de texto gera nova `document_version` e novo pedido de consentimento.

## Direitos da titular (art. 18)

| Direito | Como atender |
| --- | --- |
| Acesso e portabilidade | `export_my_data()` (botão "Baixar meus dados") |
| Correção | Edição do perfil no app |
| Eliminação | Função `account-delete` (botão "Excluir minha conta") |
| Revogar consentimento | Nova linha em `consents` com `granted = false` |
| Informação sobre compartilhamento | Lista de operadores abaixo, na política de privacidade |

## Operadores (quem processa dados em nome da Rara IA)

| Operador | Uso | Observação |
| --- | --- | --- |
| Supabase | Banco, login, funções | Projeto na região São Paulo; empresa estrangeira, prever cláusulas de transferência internacional na política |
| Greenn | Pagamento | Controladora independente dos dados de pagamento |
| Provedor de SMTP | E-mails de login | Escolher e listar na política |
| Lovable / hospedagem do front | Entrega das telas | Não armazena dados das usuárias |
| Provedor de IA (Sprint 4) | Mentoras | Exigir contrato sem uso dos dados para treino |

## Antes do lançamento

- [ ] Política de privacidade e termos revisados por advogado
- [ ] Encarregado de dados (DPO) nomeado, com contato publicado
- [ ] Texto do consentimento de dados sensíveis aprovado
- [ ] `pg_cron` agendado para `private.purge_old_events()`
- [ ] Plano de incidente com responsáveis definidos

## Incidentes

Incidente com risco ou dano relevante às titulares deve ser comunicado à ANPD e às titulares
afetadas no prazo do regulamento da ANPD (Resolução CD/ANPD nº 15/2024: 3 dias úteis a partir do
conhecimento). Confirmar o prazo vigente com o jurídico.
