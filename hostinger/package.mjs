// Arma hostinger/dist/grilla-hostinger.zip listo para subir por el Administrador de archivos de Hostinger.
// Si existe hostinger/config.local.php (no se sube a git), se incluye como config.php.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const pub = path.join(here, "public");
const dist = path.join(here, "dist");
const stage = path.join(dist, "grilla");

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

const skip = (rel) =>
  rel === "config.php" ||
  rel === "assets/index.html" ||
  (rel.startsWith("data/") && !["data/.htaccess", "data/index.html"].includes(rel));

function copy(dir) {
  for (const entry of fs.readdirSync(path.join(pub, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (skip(rel)) continue;
    const from = path.join(pub, rel);
    const to = path.join(stage, rel);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copy(rel);
    } else fs.copyFileSync(from, to);
  }
}
copy("");
fs.mkdirSync(path.join(stage, "data/uploads"), { recursive: true });
// La carpeta de datos queda bloqueada desde afuera (además de la regla en .htaccess principal).
fs.writeFileSync(
  path.join(stage, "data/.htaccess"),
  "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n",
);
fs.writeFileSync(path.join(stage, "data/index.html"), "");

const local = path.join(here, "config.local.php");
const withConfig = fs.existsSync(local);
if (withConfig) fs.copyFileSync(local, path.join(stage, "config.php"));

if (!fs.existsSync(path.join(stage, "assets/.vite/manifest.json"))) {
  console.error("Falta compilar: corré `npm run build:hostinger`.");
  process.exit(1);
}

execFileSync("zip", ["-qr", "../grilla-hostinger.zip", "."], { cwd: stage });
console.log(`Listo: hostinger/dist/grilla-hostinger.zip ${withConfig ? "(con config.php)" : "(sin config.php: copiá config.sample.php)"}`);
