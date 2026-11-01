"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Өнгөний горим солих"
      title="Өнгөний горим солих"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="theme-icon theme-icon-sun" size={18} aria-hidden="true" />
      <Moon className="theme-icon theme-icon-moon" size={18} aria-hidden="true" />
    </button>
  );
}
