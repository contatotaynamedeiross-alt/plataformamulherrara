-- =====================================================================
-- Sprint 1 · Diagnóstico Raro de Posicionamento
-- 5 áreas × 3 perguntas × 3 pts máx = 45 pts total
-- Níveis: Iniciante 0-11 | Em Desenvolvimento 12-24 | Avançada 25-35 | Rara 36-45
-- =====================================================================

-- -------------------------------------------------------------------
-- Tabelas
-- -------------------------------------------------------------------

create table public.diagnostico_perguntas (
  id          smallint primary key,
  area        text     not null check (area in ('identidade','posicionamento','produto','marketing','marca')),
  posicao     smallint not null check (posicao between 1 and 3),
  enunciado   text     not null,
  unique (area, posicao)
);
alter table public.diagnostico_perguntas enable row level security;
-- leitura pública para usuárias autenticadas (é conteúdo do app)
create policy "perguntas_leitura" on public.diagnostico_perguntas
  for select to authenticated using (true);

-- -------------------------------------------------------------------

create table public.diagnostico_respostas (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  pergunta_id  smallint    not null references public.diagnostico_perguntas(id),
  pontos       smallint    not null check (pontos between 0 and 3),
  respondido_em timestamptz not null default now(),
  unique (user_id, pergunta_id)
);
alter table public.diagnostico_respostas enable row level security;
create policy "respostas_owner" on public.diagnostico_respostas
  for all to authenticated
  using  (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -------------------------------------------------------------------

create table public.diagnostico_resultado (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  pts_identidade smallint    not null,
  pts_posicionamento smallint not null,
  pts_produto    smallint    not null,
  pts_marketing  smallint    not null,
  pts_marca      smallint    not null,
  total          smallint    not null,
  nivel          text        not null check (nivel in ('Iniciante','Em Desenvolvimento','Avançada','Rara')),
  calculado_em   timestamptz not null default now()
);
alter table public.diagnostico_resultado enable row level security;
create policy "resultado_owner" on public.diagnostico_resultado
  for all to authenticated
  using  (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -------------------------------------------------------------------
-- RPC: salvar diagnóstico (service_role)
-- -------------------------------------------------------------------

create or replace function public.salvar_diagnostico(
  p_user_id          uuid,
  p_pts_identidade   smallint,
  p_pts_posicionamento smallint,
  p_pts_produto      smallint,
  p_pts_marketing    smallint,
  p_pts_marca        smallint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total  smallint;
  v_nivel  text;
  v_id     uuid;
begin
  v_total := p_pts_identidade + p_pts_posicionamento + p_pts_produto + p_pts_marketing + p_pts_marca;

  v_nivel := case
    when v_total >= 36 then 'Rara'
    when v_total >= 25 then 'Avançada'
    when v_total >= 12 then 'Em Desenvolvimento'
    else 'Iniciante'
  end;

  insert into public.diagnostico_resultado
    (user_id, pts_identidade, pts_posicionamento, pts_produto, pts_marketing, pts_marca, total, nivel)
  values
    (p_user_id, p_pts_identidade, p_pts_posicionamento, p_pts_produto, p_pts_marketing, p_pts_marca, v_total, v_nivel)
  returning id into v_id;

  return jsonb_build_object(
    'id',    v_id,
    'total', v_total,
    'nivel', v_nivel
  );
end;
$$;

revoke all on function public.salvar_diagnostico(uuid, smallint, smallint, smallint, smallint, smallint)
  from public, anon, authenticated;
grant execute on function public.salvar_diagnostico(uuid, smallint, smallint, smallint, smallint, smallint)
  to service_role;

-- -------------------------------------------------------------------
-- Conteúdo: 15 perguntas (3 por área)
-- -------------------------------------------------------------------

insert into public.diagnostico_perguntas (id, area, posicao, enunciado) values
  -- Identidade
  (1,  'identidade',     1, 'Eu sei explicar com clareza quem eu sou e o que me diferencia das outras profissionais da minha área.'),
  (2,  'identidade',     2, 'Eu me sinto segura e orgulhosa da imagem que transmito online e presencialmente.'),
  (3,  'identidade',     3, 'Eu conheço minhas fortalezas únicas e as uso como base do meu negócio.'),
  -- Posicionamento
  (4,  'posicionamento', 1, 'Quem chega ao meu perfil entende imediatamente o que eu faço e para quem eu faço.'),
  (5,  'posicionamento', 2, 'Eu tenho uma mensagem consistente que aparece em todos os canais onde estou presente.'),
  (6,  'posicionamento', 3, 'Eu sou reconhecida como referência na minha área pelo meu público.'),
  -- Produto
  (7,  'produto',        1, 'Eu tenho uma oferta principal clara, com preço definido e resultado específico para a cliente.'),
  (8,  'produto',        2, 'Eu cobro o valor que o meu trabalho realmente vale e me sinto confortável com isso.'),
  (9,  'produto',        3, 'Minhas clientes entendem com facilidade o que recebem ao comprar o meu serviço ou produto.'),
  -- Marketing / Vendas
  (10, 'marketing',      1, 'Meu conteúdo atrai clientes novas além das indicações.'),
  (11, 'marketing',      2, 'Eu me sinto segura para conduzir uma conversa de venda de alto valor até o fechamento.'),
  (12, 'marketing',      3, 'Eu tenho um processo de vendas que funciona de forma previsível.'),
  -- Marca Pessoal
  (13, 'marca',          1, 'Minha presença visual (fotos, cores, design) transmite o nível que eu quero ser percebida.'),
  (14, 'marca',          2, 'Eu apareço com consistência e frequência nas redes sociais.'),
  (15, 'marca',          3, 'Pessoas me indicam espontaneamente por causa da forma como me apresento ao mercado.');
