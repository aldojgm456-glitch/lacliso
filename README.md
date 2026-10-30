# Lacliso — Faturamento dos parceiros

Painel de faturamento dos parceiros do Lacliso (Laboratório Clínico de Sobral).

O `index.html` é só a tela de login: o painel e os números vêm **criptografados** dentro dele.
O painel tem uma chave própria (AES-GCM), e cada usuário guarda uma cópia dela criptografada com
o seu usuário + senha (PBKDF2-SHA256, 600 mil iterações). Sem uma senha válida, nem o site nem o
repositório mostram o faturamento, e os nomes dos usuários também não aparecem no arquivo.

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
LACLISO_USUARIO='seu usuário' LACLISO_SENHA='sua senha' NOVO_USUARIO='Fulano' NOVA_SENHA='senha-dele' node ferramentas/proteger.mjs adicionar
```

Remover um usuário:

```bash
LACLISO_USUARIO='seu usuário' LACLISO_SENHA='sua senha' REMOVER_USUARIO='Fulano' node ferramentas/proteger.mjs remover
```

Depois faça commit do `index.html`.

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

## Onde ficam os dados

- Os **lançamentos** (aba Lançar) ficam no `localStorage` deste navegador (`lacliso-lanc`).
- Uma **planilha importada** (aba Dados) fica em `lacliso-dados`.
- **Baixar planilha** gera o `.xlsx` direto pelo navegador.

Outros navegadores ou computadores não veem esses dados; use Baixar/Importar planilha para levá-los.

Chart.js 4.4.1 e SheetJS 0.18.5 estão em `vendor/`. Só as fontes vêm do Google Fonts.
