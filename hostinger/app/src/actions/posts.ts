import type { Network, PostFormat, PostMetrics, PostStatus } from "@/lib/db/schema";
import { mutate, rpc } from "../api";
import { hashtagStats, type TagSource } from "@/lib/hashtags";

export type PostInput = {
  id?: string;
  clientId: string;
  title: string;
  caption: string;
  format: PostFormat;
  networks: Network[];
  date: string;
  time: string | null;
  status: PostStatus;
  notes: string;
  mediaIds: string[];
};

export async function savePost(input: PostInput): Promise<{ id: string } | { error: string }> {
  try {
    return await mutate("savePost", [input]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar." };
  }
}

export const deletePost = (id: string) => mutate<void>("deletePost", [id]);
export const movePost = (id: string, date: string) => mutate<void>("movePost", [id, date]);
export const setPostStatus = (id: string, status: PostStatus) => mutate<void>("setPostStatus", [id, status]);
export const addTeamComment = (postId: string, body: string) => mutate<void>("addTeamComment", [postId, body]);
export const savePostMetrics = (postId: string, metrics: PostMetrics) => mutate<void>("savePostMetrics", [postId, metrics]);
export const duplicatePost = (id: string) => mutate<{ id: string }>("duplicatePost", [id]);

// Solo lectura: el servidor manda los textos y el cálculo se hace acá.
export const hashtagData = async (clientId: string) => hashtagStats(await rpc<TagSource[]>("hashtagData", [clientId]));
