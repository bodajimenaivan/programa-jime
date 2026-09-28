import { mutate } from "../api";

export type MemberInput = { id?: string; name: string; role: string; color: string; email: string; phone: string };

export async function saveMember(input: MemberInput): Promise<{ id: string } | { error: string }> {
  try {
    return await mutate("saveMember", [input]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar." };
  }
}

export const deleteMember = (id: string) => mutate<void>("deleteMember", [id]);
