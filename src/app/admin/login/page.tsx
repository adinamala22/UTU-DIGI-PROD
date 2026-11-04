"use client";
import { useActionState } from "react";
import { Lock } from "lucide-react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form action={action} className="card w-full max-w-sm space-y-4 p-8">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand"><Lock className="h-6 w-6 text-white" /></span>
          <h1 className="mt-4 text-xl font-black text-white">Store Admin</h1>
        </div>
        <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" autoComplete="username" /></label>
        <label className="block"><span className="label">Password</span><input name="password" type="password" required className="input" autoComplete="current-password" /></label>
        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
        <button disabled={pending} className="btn-primary w-full">{pending ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
