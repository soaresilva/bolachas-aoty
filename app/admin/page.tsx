import { Suspense } from "react";
import { FEATURED_YEAR } from "@/lib/config";
import { AdminApp } from "./AdminApp";
import { requireAdminPage } from "./gate";

async function Gate() {
  await requireAdminPage();
  return <AdminApp year={FEATURED_YEAR} />;
}

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="p-6 text-zinc-500">Loading…</p>}>
      <Gate />
    </Suspense>
  );
}
