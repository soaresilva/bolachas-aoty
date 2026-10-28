import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-4xl px-4 pt-20 text-zinc-400">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Bolachas</p>
      <p className="mt-4 text-lg">No list here (yet).</p>
      <Link href="/" className="mt-6 inline-block text-zinc-200 underline underline-offset-4">Latest list</Link>
    </main>
  );
}
