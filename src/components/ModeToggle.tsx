import * as React from "react"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const [theme, setThemeState] = React.useState<"light" | "dark">("light")

  React.useEffect(() => {
    // Check localStorage first, then system preference
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null
    const isDarkMode = savedTheme === "dark" || 
      (savedTheme === null && 
       window.matchMedia("(prefers-color-scheme: dark)").matches)
    
    setThemeState(isDarkMode ? "dark" : "light")
    document.documentElement.classList[isDarkMode ? "add" : "remove"]("dark")
  }, [])

  React.useEffect(() => {
    const isDark = theme === "dark"
    document.documentElement.classList[isDark ? "add" : "remove"]("dark")
    localStorage.setItem("theme", theme)
  }, [theme])

  const toggleTheme = () => {
    setThemeState(theme === "light" ? "dark" : "light")
  }

  return (
    <Button variant="outline" size="icon" onClick={toggleTheme}>
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
