// Compila la versión PHP (Hostinger): las mismas pantallas de src/, con el backend en hostinger/public/api.
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "../..");
const shims = path.resolve(here, "src/shims");
const actions = path.resolve(here, "src/actions");

// Las Server Actions de Next se reemplazan por llamadas a la API PHP.
const REDIRECTS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/src\/app\/\(app\)\/actions\/(posts|clients|tasks|metrics)\.ts$/, (m) => `${actions}/${m[1]}.ts`],
  [/src\/app\/\(auth\)\/actions\.ts$/, () => `${actions}/auth.ts`],
  [/src\/app\/p\/actions\.ts$/, () => `${actions}/portal.ts`],
];

function nextShims(): Plugin {
  return {
    name: "grilla-next-shims",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (source === "next/link") return `${shims}/next-link.tsx`;
      if (source === "next/navigation") return `${shims}/next-navigation.ts`;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;
      for (const [re, to] of REDIRECTS) {
        const m = resolved.id.match(re);
        if (m) return to(m);
      }
      return resolved;
    },
  };
}

export default defineConfig({
  root: here,
  base: "./",
  plugins: [nextShims(), react(), tailwind()],
  resolve: { alias: { "@": path.join(root, "src") } },
  define: {
    "process.env.NEXT_PUBLIC_MAX_UPLOAD_MB": JSON.stringify("1024"),
  },
  build: {
    outDir: path.resolve(here, "../public/assets"),
    assetsDir: "",
    emptyOutDir: true,
    manifest: true,
    chunkSizeWarningLimit: 900,
  },
});
