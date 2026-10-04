-- =====================================================================
-- Rara IA · Conteúdo do Método (Trilha 1)
-- Mudanças de conteúdo entram por nova migração, revisada no GitHub.
-- =====================================================================

insert into public.stages (id, slug, name, short_name) values
  (1, 'identidade',     'Identidade',     'Identidade'),
  (2, 'mentalidade',    'Mentalidade',    'Mentalidade'),
  (3, 'proposito',      'Propósito',      'Propósito'),
  (4, 'produto',        'Produto',        'Produto'),
  (5, 'posicionamento', 'Posicionamento', 'Posição'),
  (6, 'vendas',         'Vendas',         'Vendas');

insert into public.diagnostic_questions (id, stage_id, position, statement, is_sensitive) values
  (1,  1, 1, 'Eu sei explicar com clareza o valor único que eu carrego.', false),
  (2,  1, 2, 'Eu gosto da mulher que vejo no espelho e da imagem que transmito.', false),
  (3,  2, 1, 'Eu acredito que posso ser grande no que faço.', false),
  (4,  2, 2, 'Quando surge uma oportunidade maior, eu me sinto pronta para dar o salto.', false),
  (5,  3, 1, 'Eu sei qual legado quero deixar e por que faço o que faço.', false),
  (6,  3, 2, 'Eu entrego meus projetos a Deus e sinto direção para este tempo.', true),
  (7,  4, 1, 'Eu tenho uma oferta principal clara, e não um monte de serviços soltos.', false),
  (8,  4, 2, 'Eu cobro o valor que o meu trabalho realmente vale.', false),
  (9,  5, 1, 'Quem chega ao meu perfil entende rápido o que eu faço e para quem.', false),
  (10, 5, 2, 'Meu perfil transmite autoridade e um padrão premium.', false),
  (11, 6, 1, 'Meu conteúdo traz clientes novos, além das indicações.', false),
  (12, 6, 2, 'Eu me sinto segura para conduzir uma conversa de venda de alto valor.', false);

insert into public.archetypes (stage_id, name, description, next_leap, tay_message) values
  (1, 'A Essência', 'Você sabe quem é e reconhece o valor que carrega. Essa firmeza sustenta tudo o que você constrói.',
      'reconhecer e comunicar o valor único que você carrega',
      'Antes da primeira venda, vem o seu valor. Nos próximos 30 dias, você vai se reencontrar com a mulher única que você é, e isso muda tudo o que vem depois.'),
  (2, 'A Visionária', 'Você enxerga longe e acredita no tamanho dos seus sonhos. Sua coragem abre portas antes de todo mundo.',
      'acreditar que pode ser grande e dar o próximo passo, mesmo sem se sentir 100% pronta',
      'Você já tem o que precisa para ser grande. Agora vamos treinar a coragem de agir como a mulher que você está se tornando.'),
  (3, 'A Guardiã do Legado', 'Você sabe por que faz o que faz e caminha com direção. Seu trabalho tem raiz e tem sentido.',
      'clarear o porquê e o legado que guiam o seu negócio',
      'Quando o porquê fica claro, a direção aparece. Vamos entregar este tempo a Deus e desenhar o legado que você veio deixar.'),
  (4, 'A Criadora', 'Você transforma o que sabe em entrega de valor. Seus talentos já têm forma de negócio.',
      'transformar seus talentos em uma oferta principal, com o preço que você merece',
      'Seu talento já vale muito. Agora vamos transformar o que você sabe em uma oferta clara, com o preço que você merece.'),
  (5, 'A Referência', 'Quem te encontra percebe autoridade e padrão. Sua imagem já fala antes de você.',
      'fazer o seu perfil comunicar autoridade e padrão premium no primeiro olhar',
      'Você já tem valor e oferta. Agora o mundo precisa enxergar isso no primeiro olhar para o seu perfil.'),
  (6, 'A Estrategista', 'Você conduz conversas com segurança e sabe transformar interesse em decisão.',
      'transformar conteúdo em clientes, com histórias e conversas de alto valor',
      'Chegou a hora de vender com elegância: histórias reais, conversas de valor e clientes que não dependem só de indicação.');

insert into public.levels (min_points, name) values
  (0, 'Dama'), (80, 'Baronesa'), (200, 'Condessa'), (400, 'Duquesa'), (700, 'Imperatriz');

insert into public.daily_offerings (weekday, text) values
  (0, 'Senhor, eu entrego este dia em Tuas mãos. Mostra o que esperas de mim neste tempo.'),
  (1, 'Hoje eu escolho servir a minha cliente com excelência e confiar no processo.'),
  (2, 'Que eu tenha coragem de dar o próximo passo, mesmo antes de me sentir pronta.'),
  (3, 'Eu entrego meus projetos a Deus e recebo direção, paz e clareza.'),
  (4, 'Que a minha história alcance hoje a mulher que precisa dela.'),
  (5, 'Eu reconheço o meu valor e cobro o que o meu trabalho vale.'),
  (6, 'Mais impacto, menos esforço: que eu use bem o meu tempo hoje.');

insert into public.plan_tasks (id, stage_id, week, week_title, position, description) values
  ('identidade-1-1', 1, 1, 'Reencontro com o seu valor', 1, 'Liste 10 conquistas da sua vida, inclusive as pequenas'),
  ('identidade-1-2', 1, 1, 'Reencontro com o seu valor', 2, 'Pergunte a 3 clientes ou amigas: o que você vê em mim que eu não vejo?'),
  ('identidade-1-3', 1, 1, 'Reencontro com o seu valor', 3, 'Escreva sua frase de valor: eu ajudo ___ a ___ porque ___'),
  ('identidade-2-1', 1, 2, 'Sua história como tesouro', 1, 'Desenhe sua linha do tempo com 5 viradas'),
  ('identidade-2-2', 1, 2, 'Sua história como tesouro', 2, 'Conte uma dessas viradas em um story ou post'),
  ('identidade-2-3', 1, 2, 'Sua história como tesouro', 3, 'Anote as reações e mensagens que chegaram'),
  ('identidade-3-1', 1, 3, 'Imagem que comunica valor', 1, 'Separe 3 looks da mulher que você está se tornando'),
  ('identidade-3-2', 1, 3, 'Imagem que comunica valor', 2, 'Faça um ensaio simples com luz natural'),
  ('identidade-3-3', 1, 3, 'Imagem que comunica valor', 3, 'Atualize sua foto de perfil'),
  ('identidade-4-1', 1, 4, 'Decisão de valor', 1, 'Revise seu preço à luz da sua frase de valor'),
  ('identidade-4-2', 1, 4, 'Decisão de valor', 2, 'Escreva uma carta para você daqui a 1 ano'),
  ('identidade-4-3', 1, 4, 'Decisão de valor', 3, 'Compartilhe um aprendizado com outra Rara'),

  ('mentalidade-1-1', 2, 1, 'Mapa de crenças', 1, 'Escreva 5 frases que você repete sobre dinheiro e sucesso'),
  ('mentalidade-1-2', 2, 1, 'Mapa de crenças', 2, 'Para cada uma, escreva a nova verdade'),
  ('mentalidade-1-3', 2, 1, 'Mapa de crenças', 3, 'Leia as novas verdades em voz alta toda manhã'),
  ('mentalidade-2-1', 2, 2, 'Coragem em doses', 1, 'Faça 1 ação por dia que te tira da zona de conforto'),
  ('mentalidade-2-2', 2, 2, 'Coragem em doses', 2, 'Registre como se sentiu depois de cada uma'),
  ('mentalidade-2-3', 2, 2, 'Coragem em doses', 3, 'Celebre as 7 ações no fim da semana'),
  ('mentalidade-3-1', 2, 3, 'Ambiente de grandeza', 1, 'Estude a rotina de 3 mulheres que já vivem o que você quer'),
  ('mentalidade-3-2', 2, 3, 'Ambiente de grandeza', 2, 'Corte um hábito de consumo que te diminui'),
  ('mentalidade-3-3', 2, 3, 'Ambiente de grandeza', 3, 'Leia 10 páginas por dia de um livro de mentalidade'),
  ('mentalidade-4-1', 2, 4, 'O próximo salto', 1, 'Defina o salto dos próximos 90 dias'),
  ('mentalidade-4-2', 2, 4, 'O próximo salto', 2, 'Escreva o primeiro passo e a data dele'),
  ('mentalidade-4-3', 2, 4, 'O próximo salto', 3, 'Conte o seu compromisso para uma Rara'),

  ('proposito-1-1', 3, 1, 'Por que eu faço', 1, 'Responda: que dor eu já venci e hoje ajudo outras a vencer?'),
  ('proposito-1-2', 3, 1, 'Por que eu faço', 2, 'Escreva sua missão em uma frase'),
  ('proposito-1-3', 3, 1, 'Por que eu faço', 3, 'Ore ou medite pedindo direção para este tempo'),
  ('proposito-2-1', 3, 2, 'Legado', 1, 'Escreva como quer ser lembrada pelas clientes e pela família'),
  ('proposito-2-2', 3, 2, 'Legado', 2, 'Liste 3 impactos que quer gerar em 5 anos'),
  ('proposito-2-3', 3, 2, 'Legado', 3, 'Escolha um deles para começar este mês'),
  ('proposito-3-1', 3, 3, 'Futuro desenhado', 1, 'Descreva um dia comum da sua vida daqui a 3 anos'),
  ('proposito-3-2', 3, 3, 'Futuro desenhado', 2, 'Monte um painel visual da sua versão mais próspera'),
  ('proposito-3-3', 3, 3, 'Futuro desenhado', 3, 'Coloque o painel onde você o veja todos os dias'),
  ('proposito-4-1', 3, 4, 'Propósito que vende', 1, 'Conte em um conteúdo por que você faz o que faz'),
  ('proposito-4-2', 3, 4, 'Propósito que vende', 2, 'Ligue o seu propósito à sua oferta principal'),
  ('proposito-4-3', 3, 4, 'Propósito que vende', 3, 'Agradeça e registre as respostas que chegarem'),

  ('produto-1-1', 4, 1, 'Inventário de talentos', 1, 'Liste habilidades, experiências e resultados que você já entregou'),
  ('produto-1-2', 4, 1, 'Inventário de talentos', 2, 'Marque o que as pessoas mais pedem para você'),
  ('produto-1-3', 4, 1, 'Inventário de talentos', 3, 'Marque o que você mais ama entregar'),
  ('produto-2-1', 4, 2, 'Oferta principal', 1, 'Escolha uma transformação principal para vender'),
  ('produto-2-2', 4, 2, 'Oferta principal', 2, 'Defina para quem ela é, e para quem não é'),
  ('produto-2-3', 4, 2, 'Oferta principal', 3, 'Escreva o antes e o depois da sua cliente'),
  ('produto-3-1', 4, 3, 'Formato e preço', 1, 'Escolha o formato: mentoria, serviço, programa ou produto'),
  ('produto-3-2', 4, 3, 'Formato e preço', 2, 'Calcule o preço pelo valor da transformação, não pelas horas'),
  ('produto-3-3', 4, 3, 'Formato e preço', 3, 'Crie 2 condições de pagamento'),
  ('produto-4-1', 4, 4, 'Validação', 1, 'Apresente a oferta para 5 pessoas do seu público'),
  ('produto-4-2', 4, 4, 'Validação', 2, 'Anote objeções e perguntas'),
  ('produto-4-3', 4, 4, 'Validação', 3, 'Ajuste a oferta e feche a primeira venda'),

  ('posicionamento-1-1', 5, 1, 'Clareza de perfil', 1, 'Reescreva a bio: o que faz, para quem e qual resultado'),
  ('posicionamento-1-2', 5, 1, 'Clareza de perfil', 2, 'Organize os destaques: Sobre, Resultados, Oferta'),
  ('posicionamento-1-3', 5, 1, 'Clareza de perfil', 3, 'Fixe 3 posts que contam quem você é'),
  ('posicionamento-2-1', 5, 2, 'Linha editorial', 1, 'Defina 3 temas: sua história, seu método, resultados de clientes'),
  ('posicionamento-2-2', 5, 2, 'Linha editorial', 2, 'Planeje os 12 conteúdos do mês'),
  ('posicionamento-2-3', 5, 2, 'Linha editorial', 3, 'Grave tudo em lote, em um único dia'),
  ('posicionamento-3-1', 5, 3, 'Autoridade', 1, 'Publique 2 depoimentos ou bastidores de resultado'),
  ('posicionamento-3-2', 5, 3, 'Autoridade', 2, 'Compartilhe uma opinião firme sobre o seu mercado'),
  ('posicionamento-3-3', 5, 3, 'Autoridade', 3, 'Faça uma live ou aula curta'),
  ('posicionamento-4-1', 5, 4, 'Padrão premium', 1, 'Revise fotos, cores e capas para um padrão único'),
  ('posicionamento-4-2', 5, 4, 'Padrão premium', 2, 'Retire o que não combina com a mulher que você é hoje'),
  ('posicionamento-4-3', 5, 4, 'Padrão premium', 3, 'Peça a 3 pessoas a percepção do seu perfil'),

  ('vendas-1-1', 6, 1, 'Conteúdo que conta história', 1, 'Escreva 3 histórias reais com antes, virada e depois'),
  ('vendas-1-2', 6, 1, 'Conteúdo que conta história', 2, 'Publique uma por dia com um convite claro no final'),
  ('vendas-1-3', 6, 1, 'Conteúdo que conta história', 3, 'Responda pessoalmente quem reagir'),
  ('vendas-2-1', 6, 2, 'Conversas que vendem', 1, 'Liste 20 pessoas que já demonstraram interesse'),
  ('vendas-2-2', 6, 2, 'Conversas que vendem', 2, 'Envie uma mensagem pessoal para cada uma, sem copiar e colar'),
  ('vendas-2-3', 6, 2, 'Conversas que vendem', 3, 'Agende as conversas da semana'),
  ('vendas-3-1', 6, 3, 'Conversa de alto valor', 1, 'Conduza com o roteiro: situação, desafio, impacto e desejo'),
  ('vendas-3-2', 6, 3, 'Conversa de alto valor', 2, 'Apresente a oferta só depois de entender a dor'),
  ('vendas-3-3', 6, 3, 'Conversa de alto valor', 3, 'Ofereça condições que cabem nela, sem baixar o seu valor'),
  ('vendas-4-1', 6, 4, 'Seu canal de vendas', 1, 'Transforme as perguntas recebidas em conteúdo'),
  ('vendas-4-2', 6, 4, 'Seu canal de vendas', 2, 'Crie uma sequência de follow-up de 3 toques'),
  ('vendas-4-3', 6, 4, 'Seu canal de vendas', 3, 'Meça conversas, propostas e vendas da semana');
