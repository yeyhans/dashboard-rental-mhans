import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "./ui/alert"
import { Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react"

// Validation schema
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "El correo electrónico es requerido")
    .email("Formato de correo electrónico inválido")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128, "La contraseña es demasiado larga"),
  rememberMe: z.boolean().optional().default(false)
})

type LoginFormData = z.infer<typeof loginSchema>

interface LoginResponse {
  success: boolean
  data?: {
    user: {
      id: string
      email: string
      role: string
      created_at: string
      last_sign_in_at?: string
      email_confirmed_at?: string
    }
    session: {
      access_token?: string
      refresh_token?: string
      expires_at?: number
      expires_in?: number
      token_type?: string
    }
    preferences: {
      remember_me: boolean
      session_duration: number
      expires_at: string
    }
  }
  error?: string
  code?: string
  message?: string
}

interface LoginFormProps extends Omit<React.ComponentPropsWithoutRef<"div">, "onError"> {
  onSuccess?: (data: LoginResponse['data']) => void
  onError?: (error: string, code?: string) => void
  redirectUrl?: string
}

export function LoginForm({
  className,
  onSuccess,
  onError,
  redirectUrl = "/dashboard",
  ...props
}: LoginFormProps) {
  const [theme, setTheme] = React.useState<"light" | "dark">("light")
  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false
    }
  })

  const watchedEmail = watch("email")
  const watchedPassword = watch("password")
  
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

  // Clear messages when user starts typing
  React.useEffect(() => {
    if (watchedEmail || watchedPassword) {
      setError(null)
      setSuccess(null)
    }
  }, [watchedEmail, watchedPassword])

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result: LoginResponse = await response.json()

      if (!response.ok || !result.success) {
        const errorMessage = result.error || 'Error desconocido durante el inicio de sesión'
        setError(errorMessage)
        onError?.(errorMessage, result.code)
        return
      }

      // Success
      setSuccess(result.message || 'Inicio de sesión exitoso')
      onSuccess?.(result.data)
      

      // Redirect after short delay to show success message
      setTimeout(() => {
        window.location.href = redirectUrl
      }, 1500)

    } catch (err) {
      const errorMessage = 'Error de conexión. Por favor, verifique su conexión a internet.'
      setError(errorMessage)
      onError?.(errorMessage, 'NETWORK_ERROR')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormReset = () => {
    reset()
    setError(null)
    setSuccess(null)
  }

  return (
    <div className={cn("flex flex-col gap-6 bg-card p-8 rounded-lg shadow-lg border max-w-md mx-auto", className)} {...props}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col items-center gap-3">
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
            <div className="text-center">
              <h1 className="text-xl font-bold text-foreground">Panel de Administración</h1>
              <p className="text-sm text-muted-foreground mt-1">Acceso exclusivo para administradores</p>
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-4">
            {/* Email Field */}
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-foreground font-medium">
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@mariohans.com"
                autoComplete="email"
                disabled={isLoading}
                className={cn(
                  "bg-background text-foreground border-input transition-colors",
                  errors.email && "border-red-500 focus-visible:ring-red-500"
                )}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-foreground font-medium">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className={cn(
                    "bg-background text-foreground border-input pr-10 transition-colors",
                    errors.password && "border-red-500 focus-visible:ring-red-500"
                  )}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center space-x-2">
              <input
                id="rememberMe"
                type="checkbox"
                disabled={isLoading}
                className="rounded border-input text-primary focus:ring-primary disabled:opacity-50"
                {...register("rememberMe")}
              />
              <Label 
                htmlFor="rememberMe" 
                className="text-sm text-muted-foreground cursor-pointer select-none"
              >
                Mantener sesión iniciada
              </Label>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={isLoading || isSubmitting}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar sesión"
              )}
            </Button>

            {/* Reset Button */}
            {(watchedEmail || watchedPassword) && (
              <Button 
                type="button" 
                variant="outline"
                onClick={handleFormReset}
                disabled={isLoading}
                className="w-full"
              >
                Limpiar formulario
              </Button>
            )}
          </div>

          {/* Security Notice */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Acceso seguro protegido con autenticación de dos factores
            </p>
          </div>
        </div>
      </form>
    </div>
  )
}
