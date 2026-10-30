# Lacliso — Faturamento dos parceiros

Painel de faturamento dos parceiros do Lacliso (Laboratório Clínico de Sobral).

O `index.html` é só a tela de login: o painel e os números vêm **criptografados** dentro dele
(AES-GCM, chave derivada de usuário + senha com PBKDF2-SHA256, 600 mil iterações).
Sem a senha, nem o site nem o repositório mostram o faturamento.

## Como rodar

Publicado pelo GitHub Pages, ou localmente:

```bash
python3 -m http.server 8000
```

Depois acesse <http://localhost:8000> e entre com usuário e senha. A senha só é pedida de novo
quando a aba é fechada.

## Atualizar o painel ou trocar a senha

O painel em texto puro (`painel.html`) nunca vai para o git. Para editá-lo:

```bash
LACLISO_USUARIO=lacliso LACLISO_SENHA='senha-atual' node ferramentas/proteger.mjs abrir
```

Edite `painel.html` e criptografe de novo (com a mesma senha ou com uma nova):

```bash
LACLISO_USUARIO=lacliso LACLISO_SENHA='nova-senha' node ferramentas/proteger.mjs fechar
```

Depois faça commit só do `index.html`. Trocar a senha invalida a antiga para todo mundo.

## Onde ficam os dados

- Os **lançamentos** (aba Lançar) ficam no `localStorage` deste navegador (`lacliso-lanc`).
- Uma **planilha importada** (aba Dados) fica em `lacliso-dados`.
- **Baixar planilha** gera o `.xlsx` direto pelo navegador.

Outros navegadores ou computadores não veem esses dados; use Baixar/Importar planilha para levá-los.

Chart.js 4.4.1 e SheetJS 0.18.5 estão em `vendor/`. Só as fontes vêm do Google Fonts.
