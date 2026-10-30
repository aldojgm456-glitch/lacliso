// Gera supabase/seed.sql com os dados que hoje estão dentro do painel (painel.html).
//
//   node ferramentas/gerar-seed.mjs
//
// O seed tem faturamento e contatos em texto puro. Por isso ele fica fora do git (.gitignore):
// cole o conteúdo no SQL Editor do Supabase e apague o arquivo depois, se quiser.
// Pode ser executado várias vezes no banco (faz upsert), mas só acrescenta e atualiza:
// linhas que você apagou da planilha continuam no banco até serem removidas à mão.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAINEL = join(RAIZ, "painel.html");
const SAIDA = join(RAIZ, "supabase", "seed.sql");

let html;
try { html = readFileSync(PAINEL, "utf8"); }
catch { console.error('Não há painel.html; rode "node ferramentas/proteger.mjs abrir" antes.'); process.exit(1); }
const linha = html.split("\n").find((l) => l.startsWith("const ORIGINAL = "));
if (!linha) { console.error("painel.html não tem o bloco ORIGINAL."); process.exit(1); }
const O = JSON.parse(linha.slice("const ORIGINAL = ".length).replace(/;\s*$/, ""));

const txt = (v) => (v == null || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => (v == null ? "null" : String(v));
const data = (br) => { // "16/09/2024" -> '2024-09-16'
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br || "");
  return m ? `'${m[3]}-${m[2]}-${m[1]}'` : "null";
};
const valores = (rows) => rows.map((r) => `  (${r.join(", ")})`).join(",\n");

const nomes = [...new Set(O.rows.map((r) => r[1]))].sort((a, b) => a.localeCompare(b, "pt-BR"));
const semParceiro = [...Object.keys(O.log), ...Object.keys(O.notes)].filter((n) => !nomes.includes(n));
if (semParceiro.length) nomes.push(...new Set(semParceiro));

const sql = [];
sql.push("-- Dados do painel de faturamento dos parceiros. GERADO por ferramentas/gerar-seed.mjs; NÃO versionar.");
sql.push("-- Rode supabase/schema.sql antes. Este arquivo pode ser executado de novo (faz upsert).\n");
sql.push("begin;\n");

sql.push("insert into public.parceiros (nome, contato, cidade, etiquetadora, logistica, centrifuga) values");
sql.push(valores(nomes.map((n) => { const l = O.log[n] || {}; return [txt(n), txt(l.contato), txt(l.local), txt(l.etiquetadora), txt(l.logistica), txt(l.centrifuga)]; })));
sql.push("on conflict (nome) do update set contato = excluded.contato, cidade = excluded.cidade,\n  etiquetadora = excluded.etiquetadora, logistica = excluded.logistica, centrifuga = excluded.centrifuga;\n");

sql.push("insert into public.faturamento (mes, parceiro, bruto, liquido, insumos) values");
sql.push(valores(O.rows.map((r) => [txt(r[0]), txt(r[1]), num(r[2]), num(r[3]), num(r[4])])));
sql.push("on conflict (mes, parceiro) do update set bruto = excluded.bruto, liquido = excluded.liquido, insumos = excluded.insumos;\n");

const notas = Object.entries(O.notes);
if (notas.length) {
  sql.push("insert into public.notas (parceiro, mes, texto) values");
  sql.push(valores(notas.map(([p, n]) => [txt(p), txt(n.m), txt(n.t)])));
  sql.push("on conflict (parceiro) do update set mes = excluded.mes, texto = excluded.texto;\n");
}

// Plano e ajustes não têm chave natural: são recarregados por inteiro.
sql.push("delete from public.plano_acao;");
sql.push("insert into public.plano_acao (ordem, objetivo, como, responsavel, inicio, fim, status, percentual, andamento) values");
sql.push(valores(O.plan.map((a, i) => [i + 1, txt(a.o), txt(a.como), txt(a.quem), data(a.ini), data(a.fim), txt(a.status), num(a.pct), txt(a.obs)])) + ";\n");

sql.push("delete from public.ajustes_dados;");
sql.push("insert into public.ajustes_dados (tipo, descricao, valor_original, valor_corrigido) values");
sql.push(valores([
  ...O.anom.map((t) => [txt("anomalia"), txt(t), "null", "null"]),
  ...O.fixes.map((f) => [txt("correcao"), txt(f[0]), txt(f[1]), num(f[2])]),
]) + ";\n");

sql.push("commit;");
mkdirSync(dirname(SAIDA), { recursive: true });
writeFileSync(SAIDA, sql.join("\n") + "\n");
console.log(`supabase/seed.sql gerado: ${nomes.length} parceiros, ${O.rows.length} linhas de faturamento, ${notas.length} notas, ${O.plan.length} ações, ${O.anom.length + O.fixes.length} ajustes.`);
