// Protege o painel com usuário e senha.
//
//   node ferramentas/proteger.mjs fechar   painel.html  -> index.html (criptografado)
//   node ferramentas/proteger.mjs abrir    index.html   -> painel.html (texto puro, fora do git)
//
// Usuário e senha vêm de LACLISO_USUARIO e LACLISO_SENHA. Para trocar a senha:
// "abrir" com a senha atual e "fechar" com a nova.
import { readFileSync, writeFileSync } from "node:fs";
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

function credenciais() {
  const usuario = process.env.LACLISO_USUARIO, senha = process.env.LACLISO_SENHA;
  if (!usuario || !senha) {
    console.error("Defina LACLISO_USUARIO e LACLISO_SENHA.");
    process.exit(1);
  }
  return { usuario, senha };
}

// Mesma derivação de ferramentas/login.html.
async function chave(usuario, senha, salt, iter) {
  const base = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(usuario.trim().toLowerCase() + "\n" + senha), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

function pacoteDe(html) {
  const m = html.match(/const PACOTE=(\{.*?\});/s);
  if (!m) throw new Error("index.html não tem um painel criptografado.");
  return JSON.parse(m[1]);
}

async function fechar() {
  const { usuario, senha } = credenciais();
  const painel = readFileSync(PAINEL, "utf8");
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await chave(usuario, senha, salt, ITERACOES);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(painel)));
  const pacote = { v: 1, iter: ITERACOES, salt: b64(salt), iv: b64(iv), ct: b64(ct) };

  const i = painel.indexOf('<span class="logo">'), j = painel.indexOf("</svg></span>", i);
  const logo = i < 0 || j < 0 ? "" : painel.slice(i, j + "</svg></span>".length);
  const login = readFileSync(LOGIN, "utf8")
    .replace("<!--LOGO-->", () => logo)
    .replace("/*PACOTE*/null", () => JSON.stringify(pacote));
  writeFileSync(INDEX, login);
  console.log(`index.html gerado (${(login.length / 1024).toFixed(0)} KB) para o usuário "${usuario.trim().toLowerCase()}".`);
}

async function abrir() {
  const { usuario, senha } = credenciais();
  const p = pacoteDe(readFileSync(INDEX, "utf8"));
  const k = await chave(usuario, senha, deb64(p.salt), p.iter);
  let html;
  try {
    html = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deb64(p.iv) }, k, deb64(p.ct)));
  } catch {
    console.error("Usuário ou senha incorretos.");
    process.exit(1);
  }
  writeFileSync(PAINEL, html);
  console.log("painel.html aberto. Ele fica fora do git; edite e rode \"fechar\" de novo.");
}

const cmd = process.argv[2];
if (cmd === "fechar") await fechar();
else if (cmd === "abrir") await abrir();
else {
  console.error("Uso: node ferramentas/proteger.mjs fechar|abrir");
  process.exit(1);
}
