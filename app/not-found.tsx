import Link from "next/link";
import { SiteShell } from "@/components/SiteShell";

export default function NotFound() {
  return (
    <SiteShell>
      <main className="mx-auto max-w-4xl px-4 py-24 text-center">
        <p className="text-2xl font-extrabold tracking-tight">No list here (yet).</p>
        <Link href="/" className="mt-6 inline-block bg-black px-4 py-2 font-medium text-sky hover:bg-navy hover:text-white">
          Latest list
        </Link>
      </main>
    </SiteShell>
  );
}
