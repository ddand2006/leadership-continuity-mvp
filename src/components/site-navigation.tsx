"use client";

import { usePathname } from "next/navigation";

// Use the actual client route as well as the server hint: some hosting proxies
// do not preserve the x-pathname request header on the initial page request.
export function SiteNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return pathname.startsWith("/partners/") ? null : children;
}
