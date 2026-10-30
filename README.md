# Lacliso — Faturamento dos parceiros

Painel de faturamento dos parceiros do Lacliso (Laboratório Clínico de Sobral).

O `index.html` é só a tela de login: o painel e os números vêm **criptografados** dentro dele.
O painel tem uma chave própria (AES-GCM). Cada usuário tem um par de chaves RSA: a pública fica
no arquivo e a privada vai criptografada com o seu usuário + senha (PBKDF2-SHA256, 600 mil
iterações); a chave do painel é entregue a cada um pela chave pública. Sem uma senha válida, nem
o site nem o repositório mostram o faturamento. Os nomes dos usuários não aparecem no arquivo,
mas quem adivinhar um nome consegue confirmar que ele existe; a proteção está na senha, e por isso
a ferramenta exige senhas de pelo menos 12 caracteres (para aceitar uma mais curta, defina
`PERMITIR_SENHA_CURTA=1` no comando; não recomendado, porque o arquivo é público).

O usuário não diferencia maiúsculas nem espaços extras; a senha diferencia.

## Como rodar

Publicado pelo GitHub Pages, ou localmente:

```bash
python3 -m http.server 8000
```

Depois acesse <http://localhost:8000> e entre com usuário e senha. A senha só é pedida de novo
quando a aba é fechada.

## Usuários

Todo comando é rodado por um usuário que já existe (`LACLISO_USUARIO` e `LACLISO_SENHA`).

Criar um usuário, ou trocar a senha de um que já existe:

```bash
LACLISO_USUARIO='seu usuário' LACLISO_SENHA='sua senha' NOVO_USUARIO='Fulano' NOVA_SENHA='uma-senha-longa-dele' node ferramentas/proteger.mjs adicionar
```

Remover um usuário:

```bash
LACLISO_USUARIO='seu usuário' LACLISO_SENHA='sua senha' REMOVER_USUARIO='Fulano' node ferramentas/proteger.mjs remover
```

Depois faça commit do `index.html`.

Os `index.html` antigos continuam no histórico do git e abrem com as senhas da época. Por isso,
ao **remover alguém ou trocar uma senha**, o painel ganha uma chave nova, entregue
automaticamente a todos os outros usuários: ninguém mais perde o acesso, e a senha antiga ou o
usuário removido só abrem as versões antigas.

## Atualizar o painel

O painel em texto puro (`painel.html`) nunca vai para o git. Para editá-lo:

```bash
LACLISO_USUARIO='seu usuário' LACLISO_SENHA='sua senha' node ferramentas/proteger.mjs abrir
```

Edite `painel.html` e criptografe de novo (os usuários continuam os mesmos):

```bash
LACLISO_USUARIO='seu usuário' LACLISO_SENHA='sua senha' node ferramentas/proteger.mjs fechar
```

Depois faça commit só do `index.html`.

## Banco de dados (Supabase)

Os dados do painel (faturamento mensal, parceiros e contatos, observações, plano de ação, avisos e
os lançamentos da aba Lançar) ficam num projeto do Supabase. As tabelas e as regras de acesso estão
em `supabase/schema.sql`.

1. No Supabase, abra **SQL Editor**, cole `supabase/schema.sql` e execute.
2. Gere e carregue os dados atuais. O arquivo tem faturamento e contatos em texto puro, por isso
   **não vai para o git**:

   ```bash
   LACLISO_USUARIO='seu usuário' LACLISO_SENHA='sua senha' node ferramentas/proteger.mjs abrir
   node ferramentas/gerar-seed.mjs
   ```

   Cole `supabase/seed.sql` no SQL Editor e execute (pode repetir sem duplicar). Depois apague o arquivo.
3. Em `painel.html`, preencha `SUPABASE.chave` com a chave **pública** do projeto (Project Settings,
   API Keys: `anon` ou `publishable`; nunca a `service_role`), rode `proteger.mjs fechar` e faça
   commit do `index.html`.

Enquanto a chave estiver vazia, ou se o banco estiver fora do ar, o painel mostra os dados embutidos
e os lançamentos ficam só no navegador (ou ficam desativados, se o banco estiver configurado mas não responder).

**Segurança.** A chave pública fica dentro do painel, que só abre com usuário e senha, mas quem a
obtiver consegue ler o banco. Por isso as tabelas de base são somente leitura para ela e só
`lancamentos` aceita escrita. Para exigir login no próprio banco, use o Supabase Auth e troque
`to anon, authenticated` por `to authenticated` nas políticas de `schema.sql`.

A planilha importada na aba Dados continua valendo só no navegador de quem importou; ela não grava no banco.

## Onde ficam os dados

- Com o banco configurado: no Supabase, compartilhados por todos os usuários. Os lançamentos novos de
  outras pessoas aparecem em até 30 segundos.
- Sem banco: os lançamentos ficam no `localStorage` do navegador (`lacliso-lanc`).
- Uma **planilha importada** (aba Dados) fica em `lacliso-dados`, só neste navegador.
- **Baixar planilha** gera o `.xlsx` direto pelo navegador.

Chart.js 4.4.1 e SheetJS 0.18.5 estão em `vendor/`. Só as fontes vêm do Google Fonts.
