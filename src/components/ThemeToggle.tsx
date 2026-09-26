import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "../store/useThemeStore";

export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const nextLabel = theme === "dark" ? "切换到亮色模式" : "切换到暗色模式";
  return <button className="theme-toggle" type="button" aria-label={nextLabel} title={nextLabel} onClick={toggleTheme}>{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</button>;
}
