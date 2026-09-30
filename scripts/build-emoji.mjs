// Genera src/lib/emoji-data.json (emojis con nombres en español) a partir de emojibase-data.
// Se corre a mano solo si se quiere actualizar: node scripts/build-emoji.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const data = JSON.parse(readFileSync(require.resolve("emojibase-data/es/data.json"), "utf8"));

// Hasta Emoji 15: lo que ya se ve bien en casi todos los celulares.
const MAX_VERSION = 15;
const groups = Array.from({ length: 10 }, () => []);
for (const e of data.sort((a, b) => a.order - b.order)) {
  if (e.group === undefined || e.group === 2 || e.version > MAX_VERSION) continue;
  const words = [e.label, ...(e.tags ?? [])].join(" ").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const skins = (e.skins ?? []).filter((s) => !s.hexcode.includes("-1F3FB-1F3FC") && s.hexcode.split("-").filter((h) => /^1F3F[B-F]$/.test(h)).length === 1);
  const row = [e.emoji, [...new Set(words.split(/[\s:,]+/))].join(" ")];
  if (skins.length === 5) row.push(skins.map((s) => s.emoji));
  groups[e.group].push(row);
}
writeFileSync(new URL("../src/lib/emoji-data.json", import.meta.url), JSON.stringify(groups.filter((_, i) => i !== 2)));
console.log(groups.map((g) => g.length));
