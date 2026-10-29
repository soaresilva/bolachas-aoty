import { Suspense } from "react";
import { adminYear, adminYears } from "@/lib/config";
import { getDb } from "@/lib/db";
import { listYears } from "@/lib/repo";
import { AdminApp } from "./AdminApp";
import { requireAdminPage } from "./gate";

async function Gate({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await requireAdminPage();
  const year = adminYear((await searchParams).year);
  const years = adminYears(await listYears(getDb()), year);
  return <AdminApp key={year} year={year} years={years} />;
}

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="p-6 text-zinc-500">Loading…</p>}>
      <Gate searchParams={searchParams} />
    </Suspense>
  );
}
