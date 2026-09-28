import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AuthFrame } from "./auth-frame";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getUser()) redirect("/calendario");
  return <AuthFrame>{children}</AuthFrame>;
}
