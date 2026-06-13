"use client";

import { createContext, useContext } from "react";
import type { Theme } from "@/lib/color";

const Ctx = createContext<Theme>("night");

/** Current UI theme, for color choices that React must re-render on
 *  (the `data-theme` attribute alone wouldn't trigger a re-render). */
export function useTheme(): Theme {
  return useContext(Ctx);
}

export function ThemeProvider({
  theme,
  children,
}: {
  theme: Theme;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={theme}>{children}</Ctx.Provider>;
}
