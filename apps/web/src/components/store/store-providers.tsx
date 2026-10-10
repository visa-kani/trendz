"use client";

import type { ReactNode } from "react";
import { CartDrawerProvider } from "./cart-drawer";
import { MotionProvider } from "./motion";

/**
 * Client-side context for the storefront: lazy animation engine and the
 * slide-in bag. The `store-theme` wrapper scopes storefront-only styling
 * (gold serif headings) so the admin and POS keep their plain UI type.
 */
export function StoreProviders({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <div className="store-theme">
        <CartDrawerProvider>{children}</CartDrawerProvider>
      </div>
    </MotionProvider>
  );
}
