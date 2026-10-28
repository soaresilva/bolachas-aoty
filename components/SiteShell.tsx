import type { ReactNode } from "react";

/** The bolachas.org frame for public pages: navy header and footer bands
 * around a steel-blue page, like the main site. */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-steel text-black">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <a href="https://bolachas.org" className="text-xl font-bold tracking-tight hover:text-sky sm:text-2xl">
            bolachas.org
          </a>
          {/* Same links as bolachas.org's main menu. */}
          <nav className="flex gap-5 text-base font-medium text-sky">
            <a href="https://www.facebook.com/bolachasorg/" className="hidden hover:underline sm:inline">Facebook</a>
            <a href="https://www.instagram.com/bolachasorg/" className="hover:underline">Instagram</a>
            <a href="https://bolachas.org/?cat=2347" className="hidden hover:underline md:inline">Bolachas Now Playing</a>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="bg-navy text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-8 text-sm sm:px-6">
          <a href="https://bolachas.org" className="font-bold hover:text-sky">bolachas.org</a>
          <span className="text-white/60">Leaving a trail of crumbs since 2006</span>
        </div>
      </footer>
    </div>
  );
}
