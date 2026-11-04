"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { audit, checkCredentials, createSession, destroySession } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

export async function login(_: unknown, fd: FormData) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`login:${ip}`, 5, 15 * 60_000)) return { error: "Too many attempts. Try again in 15 minutes." };
  const email = String(fd.get("email") ?? "");
  const password = String(fd.get("password") ?? "");
  const user = await checkCredentials(email, password);
  if (!user) return { error: "Invalid email or password" };
  await createSession(user);
  await audit(user.email, "login");
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}
