"use client";

import type { ReactNode } from "react";
import { CartDrawerProvider } from "./cart-drawer";
import { MotionProvider } from "./motion";

/** Client-side context for the storefront: lazy animation engine and the slide-in bag. */
export function StoreProviders({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <CartDrawerProvider>{children}</CartDrawerProvider>
    </MotionProvider>
  );
}
