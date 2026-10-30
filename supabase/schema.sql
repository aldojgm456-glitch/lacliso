-- Esquema do painel de faturamento dos parceiros do Lacliso.
-- Cole no SQL Editor do Supabase e execute. Pode rodar de novo sem problema.
-- Depois rode supabase/seed.sql (gerado por ferramentas/gerar-seed.mjs) para carregar os dados.

-- ---------------------------------------------------------------- tabelas

-- Parceiros e dados de logística (aba Logística Parceiros).
create table if not exists public.parceiros (
  nome          text primary key check (char_length(nome) between 1 and 80),
  contato       text,
  cidade        text,
  etiquetadora  text,
  logistica     text,
  centrifuga    text
);

-- Base de faturamento mensal (planilha original). Somente leitura para o painel.
create table if not exists public.faturamento (
  mes       text not null check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  parceiro  text not null references public.parceiros (nome) on update cascade on delete cascade,
  bruto     numeric(14,2),
  liquido   numeric(14,2),
  insumos   numeric(14,2),
  primary key (mes, parceiro)
);

-- Observações financeiras por parceiro (aba Financeiro).
create table if not exists public.notas (
  parceiro  text primary key references public.parceiros (nome) on update cascade on delete cascade,
  mes       text check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  texto     text not null
);

-- Plano de ação.
create table if not exists public.plano_acao (
  id           integer generated always as identity primary key,
  ordem        integer not null,
  objetivo     text not null,
  como         text,
  responsavel  text,
  inicio       date,
  fim          date,
  status       text,
  percentual   numeric(4,3) check (percentual between 0 and 1),
  andamento    text
);

-- Avisos sobre a limpeza dos dados: anomalias removidas e valores corrigidos.
create table if not exists public.ajustes_dados (
  id              integer generated always as identity primary key,
  tipo            text not null check (tipo in ('anomalia', 'correcao')),
  descricao       text not null,
  valor_original  text,
  valor_corrigido numeric
);

-- Lançamentos feitos no painel (aba Lançar mês). Valem no lugar da base para o mesmo mês e parceiro.
create table if not exists public.lancamentos (
  mes            text not null check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  parceiro       text not null check (char_length(parceiro) between 1 and 80),
  bruto          numeric(14,2) check (bruto   between 0 and 100000000),
  liquido        numeric(14,2) check (liquido between 0 and 100000000),
  insumos        numeric(14,2) check (insumos between 0 and 100000000),
  atualizado_em  timestamptz not null default now(),
  primary key (mes, parceiro)
);

-- ------------------------------------------------------- acesso (RLS)
-- O painel usa a chave pública (anon). Ela fica dentro do painel, que só abre com usuário e senha,
-- mas quem a obtiver consegue ler o banco: por isso as tabelas de base ficam SOMENTE LEITURA e só
-- "lancamentos" aceita escrita. Para exigir login no próprio banco, use o Supabase Auth e troque
-- "to anon, authenticated" por "to authenticated" nas políticas abaixo.

alter table public.parceiros     enable row level security;
alter table public.faturamento   enable row level security;
alter table public.notas         enable row level security;
alter table public.plano_acao    enable row level security;
alter table public.ajustes_dados enable row level security;
alter table public.lancamentos   enable row level security;

revoke all on public.parceiros, public.faturamento, public.notas, public.plano_acao,
              public.ajustes_dados, public.lancamentos from anon, authenticated;
grant select on public.parceiros, public.faturamento, public.notas, public.plano_acao,
                public.ajustes_dados, public.lancamentos to anon, authenticated;
grant insert, update, delete on public.lancamentos to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['parceiros', 'faturamento', 'notas', 'plano_acao', 'ajustes_dados', 'lancamentos'] loop
    execute format('drop policy if exists leitura on public.%I', t);
    execute format('create policy leitura on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

drop policy if exists escrita_insere on public.lancamentos;
drop policy if exists escrita_altera on public.lancamentos;
drop policy if exists escrita_apaga  on public.lancamentos;
create policy escrita_insere on public.lancamentos for insert to anon, authenticated with check (true);
create policy escrita_altera on public.lancamentos for update to anon, authenticated using (true) with check (true);
create policy escrita_apaga  on public.lancamentos for delete to anon, authenticated using (true);

-- Atualiza a data do lançamento a cada alteração.
create or replace function public.lancamentos_atualizado() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists lancamentos_atualizado on public.lancamentos;
create trigger lancamentos_atualizado before insert or update on public.lancamentos
  for each row execute function public.lancamentos_atualizado();
