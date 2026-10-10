"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { applyAppearance } from "@/lib/theme";
import type { StoreConfig } from "@/lib/types";

/**
 * Keeps the page in step with the theme saved in Admin → Appearance.
 *
 * The server already paints the saved theme (see the root layout), and saving
 * a theme drops the server's cached pages. This is the safety net for HTML
 * that is still out of date (pages built before the API was reachable, or a
 * cache that could not be dropped): it re-applies the theme from the shared
 * store-config query, which the API never lets a browser reuse unchecked.
 */
export function ThemeSync() {
  const { data: appearance } = useQuery({
    queryKey: ["store-config"],
    queryFn: () => api.get<StoreConfig>("/store/config"),
    staleTime: 300_000,
    select: (c) => c.appearance,
  });
  const { mode, brandColor, textColor } = appearance ?? {};

  useEffect(() => {
    if (mode && brandColor) applyAppearance({ mode, brandColor, textColor });
  }, [mode, brandColor, textColor]);

  return null;
}
