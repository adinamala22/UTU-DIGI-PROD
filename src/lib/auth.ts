import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";

export const SESSION_COOKIE = "utu_admin";
const MAX_AGE = 60 * 60 * 12; // 12h

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

export async function createSession(admin: { id: string; email: string }) {
  const token = await new SignJWT({ email: admin.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function verifySessionToken(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { id: payload.sub as string, email: payload.email as string };
  } catch {
    return null;
  }
}

export async function getAdmin() {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Use at the top of every admin server action / page. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function checkCredentials(email: string, password: string) {
  const user = await db.adminUser.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) {
    await bcrypt.compare(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva"); // timing
    return null;
  }
  return (await bcrypt.compare(password, user.passwordHash)) ? user : null;
}

export async function audit(actor: string, action: string, target?: string, meta?: object) {
  await db.auditLog.create({ data: { actor, action, target, meta } }).catch(() => {});
}
