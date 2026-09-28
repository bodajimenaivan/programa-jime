// Carga un espacio de demo: `npm run seed`
// Usuario: demo@grilla.app / demo1234
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { MIGRATION } from "../src/lib/db/migration.ts";

const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "grilla.db"));
db.pragma("foreign_keys = ON");
db.exec(MIGRATION);

const id = (n = 12) => crypto.randomBytes(n).toString("base64url");
const hex = () => crypto.randomBytes(16).toString("hex");
const now = Date.now();
const TZ = process.env.DEFAULT_TIMEZONE || "America/Argentina/Buenos_Aires";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
function monthsAgo(n: number) {
  const [y, m] = today.split("-").map(Number);
  const idx = y * 12 + (m - 1) - n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

// ---------- limpiar demo anterior ----------
const EMAIL = "demo@grilla.app";
const prev = db.prepare("SELECT workspace_id FROM users WHERE email = ?").get(EMAIL) as { workspace_id: string } | undefined;
if (prev) {
  const files = db.prepare("SELECT id FROM media WHERE workspace_id = ?").all(prev.workspace_id) as { id: string }[];
  for (const f of files) fs.rmSync(path.join(UPLOAD_DIR, f.id), { force: true });
  db.prepare("DELETE FROM media WHERE workspace_id = ?").run(prev.workspace_id);
  db.prepare("DELETE FROM tasks WHERE workspace_id = ?").run(prev.workspace_id);
  db.prepare("DELETE FROM workspaces WHERE id = ?").run(prev.workspace_id);
}

// ---------- espacio y usuarios ----------
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync("demo1234", salt, 64);
const ws = id();
const me = id();
const mate = id();
db.prepare("INSERT INTO workspaces VALUES (?,?,?,?)").run(ws, "Estudio Nube", TZ, now);
const insUser = db.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?,?)");
insUser.run(me, ws, "Sofía Paz", EMAIL, `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`, "#FF5B2E", "owner", now);
insUser.run(mate, ws, "Tomás Ríos", "tomas@grilla.app", `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`, "#1F6FEB", "member", now);

// ---------- imágenes de demo (SVG generado) ----------
type Art = { bg: string; fg: string; accent: string; kicker: string; title: string; layout: "circle" | "stripes" | "split" | "grid" | "big" | "arch" };

function svg(a: Art, w: number, h: number) {
  const lines = a.title.split("\n");
  const size = Math.round(w * (lines.length > 2 ? 0.085 : 0.1));
  const text = lines
    .map((l, i) => `<text x="${w * 0.08}" y="${h * 0.62 + i * size * 1.05}" font-size="${size}" font-weight="800" letter-spacing="-2" fill="${a.fg}">${l}</text>`)
    .join("");
  const shapes: Record<Art["layout"], string> = {
    circle: `<circle cx="${w * 0.72}" cy="${h * 0.28}" r="${w * 0.3}" fill="${a.accent}"/><circle cx="${w * 0.72}" cy="${h * 0.28}" r="${w * 0.12}" fill="${a.bg}"/>`,
    stripes: Array.from({ length: 7 }, (_, i) => `<rect x="${w * 0.08 + i * w * 0.12}" y="${h * 0.1}" width="${w * 0.06}" height="${h * 0.38}" rx="${w * 0.03}" fill="${i % 2 ? a.accent : a.fg}" opacity="${i % 2 ? 1 : 0.15}"/>`).join(""),
    split: `<rect x="0" y="0" width="${w}" height="${h * 0.48}" fill="${a.accent}"/><circle cx="${w * 0.5}" cy="${h * 0.48}" r="${w * 0.16}" fill="${a.fg}"/>`,
    grid: Array.from({ length: 9 }, (_, i) => `<rect x="${w * 0.08 + (i % 3) * w * 0.15}" y="${h * 0.1 + Math.floor(i / 3) * w * 0.15}" width="${w * 0.12}" height="${w * 0.12}" rx="${w * 0.03}" fill="${i === 4 ? a.accent : a.fg}" opacity="${i === 4 ? 1 : 0.18}"/>`).join(""),
    big: `<text x="${w * 0.04}" y="${h * 0.46}" font-size="${w * 0.52}" font-weight="900" fill="${a.accent}" letter-spacing="-12">${a.kicker.slice(0, 2)}</text>`,
    arch: `<path d="M${w * 0.18} ${h * 0.5} V${h * 0.3} A${w * 0.32} ${w * 0.32} 0 0 1 ${w * 0.82} ${h * 0.3} V${h * 0.5} Z" fill="${a.accent}"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif">
<rect width="${w}" height="${h}" fill="${a.bg}"/>${shapes[a.layout]}
<text x="${w * 0.08}" y="${h * 0.56}" font-size="${w * 0.032}" font-weight="700" letter-spacing="3" fill="${a.fg}" opacity="0.7">${a.kicker.toUpperCase()}</text>
${text}</svg>`;
}

const insMedia = db.prepare(
  "INSERT INTO media (id, workspace_id, post_id, kind, mime, filename, size, width, height, duration, poster_id, position, status, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
);
function addArt(postId: string | null, a: Art, pos: number, vertical: boolean) {
  const [w, h] = vertical ? [1080, 1920] : [1080, 1350];
  const body = svg(a, w, h);
  const mid = hex();
  fs.writeFileSync(path.join(UPLOAD_DIR, mid), body);
  insMedia.run(mid, ws, postId, "image", "image/svg+xml", `${a.title.split("\n")[0].toLowerCase().replace(/\W+/g, "-")}.svg`, Buffer.byteLength(body), w, h, null, null, pos, "ready", me, now);
  return mid;
}

// ---------- clientes ----------
const insClient = db.prepare("INSERT INTO clients VALUES (?,?,?,?,?,?,?,?,?,?,?)");
type C = { id: string; name: string; handle: string; color: string; networks: string[]; logo?: Art };
const clients: C[] = [
  { id: id(), name: "Café Tostado", handle: "cafetostado", color: "#C2410C", networks: ["instagram", "tiktok"] },
  { id: id(), name: "Pilates Norte", handle: "pilatesnorte", color: "#1E9E63", networks: ["instagram", "facebook"] },
  { id: id(), name: "Nómade Viajes", handle: "nomadeviajes", color: "#1F6FEB", networks: ["instagram", "tiktok", "linkedin"] },
  { id: id(), name: "Don Julio Verdulería", handle: "donjulio.verde", color: "#A16207", networks: ["instagram"] },
];
clients.forEach((c, i) => {
  // Avatar simple: iniciales sobre color
  const initials = c.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  const body = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" font-family="Helvetica, Arial, sans-serif"><rect width="200" height="200" fill="${c.color}"/><circle cx="150" cy="50" r="60" fill="#fff" opacity=".14"/><text x="100" y="128" text-anchor="middle" font-size="84" font-weight="800" fill="#fff" letter-spacing="-4">${initials}</text></svg>`;
  const avatar = hex();
  fs.writeFileSync(path.join(UPLOAD_DIR, avatar), body);
  insMedia.run(avatar, ws, "avatar", "image", "image/svg+xml", "avatar.svg", body.length, 200, 200, null, null, 0, "ready", me, now);
  insClient.run(c.id, ws, c.name, c.handle, c.color, avatar, JSON.stringify(c.networks), id(18), i, null, now);
});
const [cafe, pilates, nomade] = clients;

// ---------- piezas ----------
const insPost = db.prepare("INSERT INTO posts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
const insComment = db.prepare("INSERT INTO comments VALUES (?,?,?,?,?,?,?,?)");

type P = {
  client: C;
  day: number;
  time: string | null;
  title: string;
  caption: string;
  format: "post" | "carousel" | "reel" | "story" | "tiktok";
  status: "draft" | "review" | "changes" | "approved" | "scheduled" | "published";
  networks?: string[];
  art: Art[];
  metrics?: Record<string, number>;
  comments?: [kind: "comment" | "approved" | "changes", who: "client" | "team", body: string][];
};

const CREAM = "#F3E9DC", ESPRESSO = "#2B1A12", ORANGE = "#E4572E";
const posts: P[] = [
  {
    client: cafe, day: -24, time: "09:00", title: "Blend de temporada", format: "post", status: "published",
    caption: "Llegó el blend de primavera: notas a durazno, miel y cacao. Lo tostamos el lunes, lo servimos desde hoy.\n\n#cafedeespecialidad #buenosaires",
    art: [{ bg: CREAM, fg: ESPRESSO, accent: ORANGE, kicker: "Nuevo blend", title: "Primavera\nen taza", layout: "circle" }],
    metrics: { reach: 8420, likes: 612, comments: 48, saves: 131, shares: 37, views: 0 },
  },
  {
    client: cafe, day: -20, time: "18:30", title: "5 errores al moler café", format: "carousel", status: "published",
    caption: "Guardalo para tu próxima molienda. El número 3 lo hacemos todos.\n\n#baristatips #cafe",
    art: [
      { bg: ESPRESSO, fg: CREAM, accent: ORANGE, kicker: "Guía rápida", title: "5 errores\nal moler\ncafé", layout: "grid" },
      { bg: CREAM, fg: ESPRESSO, accent: ORANGE, kicker: "Error 1", title: "Moler\ncon días de\nanticipación", layout: "big" },
      { bg: CREAM, fg: ESPRESSO, accent: "#7A9E7E", kicker: "Error 2", title: "Usar la\nmisma molienda\npara todo", layout: "stripes" },
    ],
    metrics: { reach: 12930, likes: 954, comments: 61, saves: 802, shares: 210, views: 0 },
  },
  {
    client: cafe, day: -13, time: "12:00", title: "Detrás de escena: tostado", format: "reel", status: "published",
    caption: "Un lunes en la tostadora, en 30 segundos. Subí el volumen.",
    art: [{ bg: "#1A120D", fg: CREAM, accent: ORANGE, kicker: "Reel", title: "Así se\ntuesta un\nlunes", layout: "arch" }],
    metrics: { reach: 22100, likes: 1840, comments: 92, saves: 240, shares: 380, views: 41200 },
  },
  {
    client: cafe, day: -6, time: "10:00", title: "Martes 2x1 flat white", format: "story", status: "published",
    caption: "", art: [{ bg: ORANGE, fg: "#fff", accent: ESPRESSO, kicker: "Solo martes", title: "2x1 en\nflat white", layout: "split" }],
  },
  {
    client: cafe, day: -1, time: "19:00", title: "Encuesta: ¿dulce o amargo?", format: "story", status: "scheduled",
    caption: "", art: [{ bg: CREAM, fg: ESPRESSO, accent: "#F2B134", kicker: "Encuesta", title: "¿Dulce\no amargo?", layout: "circle" }],
  },
  {
    client: cafe, day: 0, time: "09:30", title: "Receta V60 paso a paso", format: "carousel", status: "approved",
    caption: "15 g de café, 250 ml de agua a 93°. El resto, en las fotos. ¿Lo probás el finde?\n\n#v60 #pourover",
    art: [
      { bg: "#E9F0E6", fg: "#1F2B1E", accent: "#7A9E7E", kicker: "Receta", title: "V60 en\n4 pasos", layout: "arch" },
      { bg: "#E9F0E6", fg: "#1F2B1E", accent: "#7A9E7E", kicker: "Paso 1", title: "Enjuagá\nel filtro", layout: "big" },
    ],
    comments: [["approved", "client", "Divino, sale así."]],
  },
  {
    client: cafe, day: 2, time: "13:00", title: "Medialunas de manteca", format: "post", status: "changes",
    caption: "Las de siempre, recién salidas. Pedilas con tu café de la mañana hasta las 11.",
    art: [{ bg: "#F7D774", fg: ESPRESSO, accent: "#fff", kicker: "Mañanas", title: "Medialunas\nrecién\nhechas", layout: "circle" }],
    comments: [
      ["changes", "client", "¿Podemos probar con una foto con más luz? Y agregar que también hay de grasa."],
      ["comment", "team", "Dale, el jueves hacemos foto nueva en el local y te la mando."],
    ],
  },
  {
    client: cafe, day: 4, time: "18:00", title: "Reel: latte art en cámara lenta", format: "reel", status: "review",
    caption: "Tres segundos de paciencia. #latteart",
    art: [{ bg: "#2B1A12", fg: "#fff", accent: "#E4572E", kicker: "Reel", title: "Latte art\nen slow", layout: "stripes" }],
  },
  {
    client: cafe, day: 7, time: "09:00", title: "Nuevo horario de domingo", format: "post", status: "review",
    caption: "Desde este domingo abrimos de 9 a 14. Vení a desayunar sin apuro.",
    art: [{ bg: ESPRESSO, fg: CREAM, accent: "#F2B134", kicker: "Novedad", title: "Domingos\n9 a 14 h", layout: "grid" }],
  },
  {
    client: cafe, day: 10, time: "20:00", title: "TikTok: qué pide cada barista", format: "tiktok", status: "draft",
    caption: "Le preguntamos al equipo qué se toma cuando nadie mira.", networks: ["tiktok"],
    art: [],
  },
  {
    client: cafe, day: 15, time: null, title: "Sorteo aniversario", format: "carousel", status: "draft",
    caption: "", art: [],
  },
  {
    client: pilates, day: 1, time: "08:00", title: "Clase de prueba gratis", format: "post", status: "review",
    caption: "Tu primera clase va por nuestra cuenta. Reservá por DM.",
    art: [{ bg: "#E6F2EC", fg: "#12372A", accent: "#1E9E63", kicker: "Primera clase", title: "Probá\ngratis", layout: "arch" }],
  },
  {
    client: pilates, day: 3, time: "19:00", title: "Reel reformer", format: "reel", status: "changes",
    caption: "Core, respiración y paciencia.",
    art: [{ bg: "#12372A", fg: "#E6F2EC", accent: "#9BE3B8", kicker: "Reel", title: "Reformer\n101", layout: "stripes" }],
    comments: [["changes", "client", "Prefiero que no aparezca la recepción, ¿se puede recortar?"]],
  },
  {
    client: nomade, day: 5, time: "11:00", title: "Patagonia en otoño", format: "carousel", status: "approved",
    caption: "Salidas grupales de abril, cupos limitados.",
    art: [{ bg: "#DCE7FF", fg: "#0B1F4B", accent: "#1F6FEB", kicker: "Salidas", title: "Patagonia\nen otoño", layout: "circle" }],
  },
];

for (const p of posts) {
  const pid = id();
  const date = addDays(today, p.day);
  insPost.run(
    pid, ws, p.client.id, p.title, p.caption, p.format, JSON.stringify(p.networks ?? ["instagram"]), date, p.time, p.status, "",
    p.metrics ? JSON.stringify(p.metrics) : null, me, now - 86400000 * 5, now - 86400000,
  );
  p.art.forEach((a, i) => addArt(pid, a, i, ["reel", "story", "tiktok"].includes(p.format)));
  let t = now - 3600000 * 20;
  for (const [kind, who, body] of p.comments ?? []) {
    insComment.run(id(), pid, who, who === "client" ? "Luli" : "Sofía Paz", who === "team" ? me : null, kind, body, (t += 3600000 * 3));
  }
}

// ---------- tareas ----------
const insTask = db.prepare("INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
const tasks: [C, string, string, "todo" | "doing" | "review" | "done", "low" | "normal" | "high", number | null, string | null][] = [
  [cafe, "Sesión de fotos: medialunas con luz natural", "Jueves 9 h en el local. Llevar reflector.", "todo", "high", 3, me],
  [cafe, "Guion TikTok “qué pide cada barista”", "", "todo", "normal", 6, mate],
  [cafe, "Grilla de octubre para aprobar", "Mandar link el viernes.", "doing", "high", 2, me],
  [cafe, "Editar reel latte art", "Cámara lenta al 40 %, audio en tendencia.", "doing", "normal", 1, mate],
  [cafe, "Responder comentarios del carrusel", "", "review", "low", 0, mate],
  [cafe, "Informe de métricas de agosto", "", "done", "normal", -10, me],
  [cafe, "Actualizar destacadas", "", "done", "low", -4, mate],
  [pilates, "Recortar reel reformer", "Sacar la recepción del plano.", "todo", "high", 1, mate],
  [pilates, "Planificar mes de noviembre", "", "doing", "normal", 12, me],
];
tasks.forEach(([c, title, desc, status, prio, due, who], i) => {
  insTask.run(id(), ws, c.id, title, desc, status, prio, due === null ? null : addDays(today, due), who, null, i, now, now);
});

// ---------- métricas mensuales ----------
const insMetric = db.prepare("INSERT INTO metrics VALUES (?,?,?,?,?,?,?,?,?)");
const series = (base: number, growth: number, noise: number) =>
  Array.from({ length: 6 }, (_, i) => Math.round(base * (1 + growth) ** i + (Math.sin(i * 2.1) * noise)));
const add = (c: C, network: string, followers: number[], reach: number[], interactions: number[]) => {
  followers.forEach((f, i) => {
    const month = monthsAgo(5 - i);
    insMetric.run(id(), c.id, network, month, f, reach[i], Math.round(reach[i] * 1.6), interactions[i], Math.round(reach[i] * 0.04));
  });
};
add(cafe, "instagram", series(9800, 0.045, 60), series(31000, 0.08, 2500), series(2100, 0.07, 180));
add(cafe, "tiktok", series(2100, 0.16, 40), series(18000, 0.2, 3000), series(1400, 0.18, 200));
add(pilates, "instagram", series(3100, 0.03, 20), series(8200, 0.05, 700), series(540, 0.04, 40));
add(pilates, "facebook", series(1900, 0.01, 10), series(2600, 0.02, 200), series(120, 0.02, 15));

console.log(`Listo. Entrá con ${EMAIL} / demo1234  (${posts.length} piezas, ${clients.length} clientes)`);
