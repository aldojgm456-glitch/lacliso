// Protege o painel com usuários e senhas.
//
// O painel é criptografado com uma chave própria (AES-GCM); cada usuário guarda uma
// cópia dessa chave, criptografada com uma chave derivada do seu usuário + senha (PBKDF2).
//
//   node ferramentas/proteger.mjs abrir       index.html  -> painel.html (texto puro, fora do git)
//   node ferramentas/proteger.mjs fechar      painel.html -> index.html
//   node ferramentas/proteger.mjs adicionar   cria um usuário ou troca a senha dele
//   node ferramentas/proteger.mjs remover     remove um usuário
//   node ferramentas/proteger.mjs listar      mostra quantos usuários existem
//
// Quem roda informa um usuário que já existe em LACLISO_USUARIO e LACLISO_SENHA.
// "adicionar" lê NOVO_USUARIO e NOVA_SENHA; "remover" lê REMOVER_USUARIO.
// Sem index.html, "fechar" cria o primeiro usuário a partir de LACLISO_USUARIO e LACLISO_SENHA.
//
// Os index.html antigos continuam no histórico do git, e cada um abre com as senhas da época.
// Por isso remover alguém ou trocar uma senha gera uma chave nova para o painel: só quem roda
// o comando (e o usuário com a senha nova) recebe a chave nova; os demais precisam ser criados
// de novo com "adicionar".
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAINEL = join(RAIZ, "painel.html");
const INDEX = join(RAIZ, "index.html");
const LOGIN = join(RAIZ, "ferramentas", "login.html");
const ITERACOES = 600000;

const b64 = (u8) => Buffer.from(u8).toString("base64");
const deb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));
const aleatorio = (n) => crypto.getRandomValues(new Uint8Array(n));
const enc = new TextEncoder(), dec = new TextDecoder();

function erro(msg) {
  console.error(msg);
  process.exit(1);
}
function env(nome) {
  const v = process.env[nome];
  if (!v) erro(`Defina ${nome}.`);
  return v;
}

// As mesmas regras de ferramentas/login.html.
const normaliza = (usuario) => usuario.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
async function idDe(nome) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode("lacliso-usuario:" + nome)));
  return Buffer.from(h.slice(0, 16)).toString("hex");
}
async function chaveDoUsuario(nome, senha, salt, iter) {
  const base = await crypto.subtle.importKey("raw", enc.encode(nome + "\n" + senha.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
const chaveDoPainel = (raw) => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);

async function entrada(usuario, senha, rawPainel) {
  const nome = normaliza(usuario), salt = aleatorio(16), iv = aleatorio(12);
  const k = await chaveDoUsuario(nome, senha, salt, ITERACOES);
  const embrulho = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, rawPainel));
  return { id: await idDe(nome), iter: ITERACOES, salt: b64(salt), iv: b64(iv), k: b64(embrulho) };
}

function lePacote() {
  if (!existsSync(INDEX)) return null;
  const m = readFileSync(INDEX, "utf8").match(/const PACOTE=(\{.*?\});/s);
  if (!m) erro("index.html não tem um painel criptografado.");
  const p = JSON.parse(m[1]);
  if (p.v !== 2) erro("index.html está num formato antigo; abra-o com a versão anterior desta ferramenta.");
  return p;
}

// Devolve a chave do painel (bytes) usando o usuário e a senha de quem está rodando.
async function destrava(p) {
  const nome = normaliza(env("LACLISO_USUARIO")), senha = env("LACLISO_SENHA");
  const id = await idDe(nome);
  const u = p.usuarios.find((x) => x.id === id);
  if (!u) erro("Usuário ou senha incorretos.");
  try {
    const k = await chaveDoUsuario(nome, senha, deb64(u.salt), u.iter);
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deb64(u.iv) }, k, deb64(u.k)));
  } catch {
    erro("Usuário ou senha incorretos.");
  }
}

function grava(p, html) {
  const i = html.indexOf('<span class="logo">'), j = html.indexOf("</svg></span>", i);
  const logo = i < 0 || j < 0 ? "" : html.slice(i, j + "</svg></span>".length);
  const login = readFileSync(LOGIN, "utf8")
    .replace("<!--LOGO-->", () => logo)
    .replace("/*PACOTE*/null", () => JSON.stringify(p));
  writeFileSync(INDEX, login);
}

async function cifraPainel(raw, html) {
  const iv = aleatorio(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await chaveDoPainel(raw), enc.encode(html)));
  return { iv: b64(iv), ct: b64(ct) };
}
async function decifraPainel(raw, p) {
  return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deb64(p.iv) }, await chaveDoPainel(raw), deb64(p.ct)));
}

// Criptografa o painel com uma chave nova e a entrega só aos usuários de "manter".
async function rotaciona(p, rawAntiga, manter, msg, removidos = 0) {
  const html = await decifraPainel(rawAntiga, p);
  const raw = aleatorio(32), antes = p.usuarios.length;
  p.usuarios = await Promise.all(manter.map((u) => entrada(u.usuario, u.senha, raw)));
  Object.assign(p, await cifraPainel(raw, html));
  grava(p, html);
  const fora = antes - p.usuarios.length - removidos;
  console.log(`${msg} O painel ganhou uma chave nova; usuários com acesso agora: ${p.usuarios.length}.`);
  if (fora > 0) console.log(`Atenção: ${fora} outro(s) usuário(s) perderam o acesso e precisam ser criados de novo com "adicionar".`);
}

const comandos = {
  async abrir() {
    const p = lePacote() ?? erro("Não há index.html.");
    writeFileSync(PAINEL, await decifraPainel(await destrava(p), p));
    console.log('painel.html aberto. Ele fica fora do git; edite e rode "fechar" de novo.');
  },
  async fechar() {
    if (!existsSync(PAINEL)) erro('Não há painel.html; rode "abrir" antes.');
    const html = readFileSync(PAINEL, "utf8");
    let p = lePacote(), raw;
    if (p) raw = await destrava(p);
    else {
      raw = aleatorio(32);
      p = { v: 2, usuarios: [await entrada(env("LACLISO_USUARIO"), env("LACLISO_SENHA"), raw)] };
    }
    Object.assign(p, await cifraPainel(raw, html));
    grava(p, html);
    console.log(`index.html gerado com ${p.usuarios.length} usuário(s).`);
  },
  async adicionar() {
    const p = lePacote() ?? erro('Não há index.html; rode "fechar" antes.');
    const raw = await destrava(p);
    const nome = normaliza(env("NOVO_USUARIO")), id = await idDe(nome);
    if (!p.usuarios.some((x) => x.id === id)) {
      p.usuarios.push(await entrada(nome, env("NOVA_SENHA"), raw));
      grava(p, await decifraPainel(raw, p));
      console.log(`Usuário criado: "${nome}". Total: ${p.usuarios.length}.`);
      return;
    }
    // Trocar a senha: a senha antiga ainda abre os index.html do histórico, então a chave muda.
    const eu = normaliza(env("LACLISO_USUARIO"));
    const manter = [{ usuario: nome, senha: env("NOVA_SENHA") }];
    if (eu !== nome) manter.push({ usuario: eu, senha: env("LACLISO_SENHA") });
    await rotaciona(p, raw, manter, `Senha de "${nome}" trocada.`);
  },
  async remover() {
    const p = lePacote() ?? erro("Não há index.html.");
    const raw = await destrava(p);
    const nome = normaliza(env("REMOVER_USUARIO")), id = await idDe(nome);
    if (!p.usuarios.some((x) => x.id === id)) erro("Esse usuário não existe.");
    if (nome === normaliza(env("LACLISO_USUARIO"))) erro("Rode este comando com outro usuário: não dá para remover a si mesmo.");
    await rotaciona(p, raw, [{ usuario: env("LACLISO_USUARIO"), senha: env("LACLISO_SENHA") }], `Usuário "${nome}" removido.`, 1);
  },
  async listar() {
    const p = lePacote() ?? erro("Não há index.html.");
    console.log(`${p.usuarios.length} usuário(s). Os nomes não ficam no arquivo, só um resumo (hash) de cada um.`);
  },
};

const cmd = comandos[process.argv[2]];
if (!cmd) erro("Uso: node ferramentas/proteger.mjs abrir|fechar|adicionar|remover|listar");
await cmd();
