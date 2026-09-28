import { mutate } from "../api";

type Kind = "approved" | "changes" | "comment";

export async function clientFeedback(token: string, postId: string, kind: Kind, name: string, body: string) {
  try {
    return await mutate<{ ok?: boolean; error?: string }>("clientFeedback", [token, postId, kind, name, body]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo enviar." };
  }
}
