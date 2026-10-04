# Guia do Lovable

Como construir as telas no Lovable usando este back-end, sem abrir brechas.

## Regras para o Lovable (cole no "Knowledge" do projeto)

```
Este app usa um back-end Supabase já pronto. Siga estas regras sempre:
1. Use apenas o cliente supabase-js com a chave pública (anon). Nunca use a service_role key.
2. Não crie tabelas, políticas nem migrações pelo Lovable. Mudanças de banco são feitas no GitHub,
   na pasta supabase/migrations, com testes.
3. Para gravar diagnóstico, missões e entrega do dia, use SOMENTE as funções RPC:
   submit_diagnostic, set_task_completion, mark_daily_offering. Nunca faça insert direto nessas tabelas.
4. Para pontos, título, sequência e status de acesso, use SOMENTE a RPC get_my_progress.
5. Login apenas por link mágico (signInWithOtp com shouldCreateUser: false). Não existe cadastro aberto.
6. Identidade visual: design system "Rara IA" (couro chocolate, cetim, ouro, Bodoni Moda + Jost,
   camafeu, pérolas; nunca coroa, nunca emoji).
7. Textos em português do Brasil, no tom de mentora: elegante, direto, sempre com o próximo passo.
```

## Chamadas prontas

```ts
// Login (só quem já foi convidada pela compra)
await supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
});

// Consentimentos (primeiro acesso e antes do diagnóstico)
await supabase.from("consents").insert([
  { purpose: "termos_uso", document_version: "v1", granted: true },
  { purpose: "politica_privacidade", document_version: "v1", granted: true },
]);
await supabase.from("consents").insert({ purpose: "dados_sensiveis", document_version: "v1", granted: true });

// Mapa (perfil)
await supabase.from("profiles").update({
  display_name: "Ana", business: "Consultora de imagem",
  revenue_now: "5k_20k", revenue_goal: "50k",
  blockers: ["conteudo_que_vende", "so_indicacao"], time_per_day: "30min",
}).eq("id", user.id);

// Conteúdo
const { data: perguntas } = await supabase.from("diagnostic_questions").select("*").order("id");
const { data: tarefas } = await supabase.from("plan_tasks").select("*").eq("stage_id", focus).order("week").order("position");
const { data: perfil } = await supabase.from("archetypes").select("*").eq("stage_id", strength).single();

// Diagnóstico (12 respostas de 1 a 5, na ordem das perguntas)
const { data: resultado, error } = await supabase.rpc("submit_diagnostic", { p_answers: respostas });
// erros possíveis: consentimento_necessario, assinatura_inativa, respostas_invalidas, limite_diario

// Missões e entrega do dia
await supabase.rpc("set_task_completion", { p_task_id: "mentalidade-1-1", p_done: true });
await supabase.rpc("mark_daily_offering");

// Painel
const { data: progresso } = await supabase.rpc("get_my_progress");
// { has_access, points, level, next_level, points_to_next, streak_days, offered_today,
//   diagnostic_id, focus_stage, strength_stage, scores, tasks_done, tasks_total }

// LGPD
const { data: meusDados } = await supabase.rpc("export_my_data");
await supabase.functions.invoke("account-delete", { body: { confirm: "EXCLUIR" } });
```

## Valores aceitos

| Campo | Valores |
| --- | --- |
| `revenue_now` | `nao_fatura`, `ate_5k`, `5k_20k`, `20k_50k`, `acima_50k` |
| `revenue_goal` | `20k`, `50k`, `100k`, `acima_100k` |
| `blockers` (até 2) | `conteudo_que_vende`, `so_indicacao`, `nao_sabe_vender`, `cobrar_valor`, `sem_tempo`, `sem_foco`, `nao_se_sente_pronta` |
| `time_per_day` | `15min`, `30min`, `1h` |

## Telas da Sprint 2 (base: protótipo da Trilha 1)

1. Login por link mágico e tela "acesso inativo" (quando `has_access` for falso), com link para a página de assinatura na Asaas.
2. Boas-vindas com consentimentos de termos e privacidade.
3. Mapa em 3 passos (grava em `profiles`).
4. Consentimento de dados sensíveis, depois Diagnóstico Raro (12 afirmações).
5. Resultado: Medalhão de Evolução, perfil Rara, força, próximo salto e mensagem da Tay.
6. Início: entrega do dia, missão de hoje, título, pontos e sequência.
7. Jornada: plano de 30 dias com missões e próximos ciclos.
8. Minha conta: baixar meus dados e excluir conta.
