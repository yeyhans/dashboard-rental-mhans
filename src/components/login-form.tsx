import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [theme, setTheme] = React.useState<"light" | "dark">("light")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string>("")
  
  React.useEffect(() => {
    // Check for theme on mount and set state
    const isDark = document.documentElement.classList.contains("dark")
    setTheme(isDark ? "dark" : "light")
    
    // Set up mutation observer to watch for class changes on html element
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          const isDark = document.documentElement.classList.contains("dark")
          setTheme(isDark ? "dark" : "light")
        }
      })
    })
    
    observer.observe(document.documentElement, { attributes: true })
    
    return () => {
      observer.disconnect()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    
    const formData = new FormData(e.currentTarget)
    
    try {
      const response = await fetch("/api/signin", {
        method: "POST",
        body: formData,
      })
      
      if (response.ok) {
        // Redirect will be handled by the API
        window.location.href = "/dashboard"
      } else {
        const errorText = await response.text()
        setError(errorText || "Error al iniciar sesión")
      }
    } catch (err) {
      setError("Error de conexión. Por favor, intenta de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6 bg-card p-8 rounded-lg shadow-lg border", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            {theme === "light" ? (
              <img
                src="/logo-white.png"
                alt="Mario Hans Logo"
                className="h-16 w-auto"
                width={97}
                height={64}
              />
            ) : (
              <img
                src="/logo-black.png" 
                alt="Mario Hans Logo"
                className="h-16 w-auto"
                width={97}
                height={64}
              />
            )}
            <h1 className="text-xl font-bold text-foreground">Bienvenido al mundo de Mario Hans</h1>
          </div>
          
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}
          
          <div className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-foreground">Correo electrónico</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="ejemplo@correo.com"
                required
                disabled={isLoading}
                className="bg-background text-foreground border-input"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-foreground">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                disabled={isLoading}
                className="bg-background text-foreground border-input"
              />
            </div>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
