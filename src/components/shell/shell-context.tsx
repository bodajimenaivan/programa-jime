"use client";

import { createContext, useContext } from "react";
import type { Network } from "@/lib/db/schema";

export type ShellClient = {
  id: string;
  name: string;
  handle: string;
  color: string;
  avatarId: string | null;
  networks: Network[];
  attention: number;
};

type ShellCtx = { clients: ShellClient[]; active: ShellClient | null };
export const ShellContext = createContext<ShellCtx>({ clients: [], active: null });
export const useShell = () => useContext(ShellContext);
