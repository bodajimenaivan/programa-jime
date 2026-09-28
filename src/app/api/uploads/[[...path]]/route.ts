import { tusServer } from "@/lib/tus";

// Endpoint tus (subidas reanudables por partes). Cada PATCH trae un pedazo de ~8 MB,
// así un video de 1 GB sobrevive a cortes de wifi sin volver a empezar.
export const dynamic = "force-dynamic";

function handler(req: Request) {
  return tusServer().handleWeb(req);
}

export { handler as GET, handler as POST, handler as PATCH, handler as HEAD, handler as DELETE, handler as OPTIONS };
