"use client";

import { useSearchParams } from "next/navigation";

export function LoginError() {
  return useSearchParams().get("error") ? <p className="text-sm text-red-400">Wrong password.</p> : null;
}
