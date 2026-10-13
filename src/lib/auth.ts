import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { userForToken, type CurrentUser } from "./auth-core";

export const COOKIE = "wk_session";

export async function getUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return userForToken(getDb(), token);
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const u = await requireUser();
  if (!u.isAdmin) redirect("/app");
  return u;
}
