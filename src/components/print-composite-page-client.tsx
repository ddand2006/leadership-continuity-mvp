"use client";

import { useEffect } from "react";

export function PrintCompositePageClient() {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      window.print();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, []);

  return null;
}
