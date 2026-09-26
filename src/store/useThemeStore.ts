import { create } from "zustand";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "picagent-theme";

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return "light";
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
}

interface ThemeStore {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>((set) => {
  const theme = getInitialTheme();
  applyTheme(theme);
  return {
    theme,
    setTheme: (nextTheme) => {
      applyTheme(nextTheme);
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, nextTheme);
      set({ theme: nextTheme });
    },
    toggleTheme: () => {
      const nextTheme = useThemeStore.getState().theme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, nextTheme);
      set({ theme: nextTheme });
    },
  };
});
