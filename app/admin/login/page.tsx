import { Suspense } from "react";
import { LoginError } from "./LoginError";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm px-4 pt-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Bolachas · admin</p>
      <form method="post" action="/api/auth/login" className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-zinc-400">Password</span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-400"
          />
        </label>
        <Suspense>
          <LoginError />
        </Suspense>
        <button className="w-full rounded-md bg-zinc-100 px-3 py-2 font-medium text-zinc-900 hover:bg-white">Log in</button>
      </form>
    </main>
  );
}
