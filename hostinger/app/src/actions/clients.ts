import { mutate } from "../api";

export type ClientFormState = { error?: string; ok?: boolean } | undefined;

export async function switchClient(clientId: string) {
  await mutate("switchClient", [clientId]);
}

export async function saveClient(_prev: ClientFormState, form: FormData): Promise<ClientFormState> {
  try {
    return await mutate<ClientFormState>("saveClient", [
      {
        id: form.get("id") ?? "",
        name: form.get("name") ?? "",
        handle: form.get("handle") ?? "",
        color: form.get("color") ?? "",
        avatarId: form.get("avatarId") ?? "",
        networks: form.getAll("networks"),
      },
    ]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar." };
  }
}

export async function archiveClient(clientId: string) {
  await mutate("archiveClient", [clientId]);
}

export async function resetShareLink(clientId: string) {
  await mutate("resetShareLink", [clientId]);
}
