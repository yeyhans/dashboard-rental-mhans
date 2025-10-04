# Users Dashboard Components

Esta carpeta contiene todos los componentes relacionados con la gestión de usuarios, organizados de manera modular para mejorar la experiencia de desarrollo.

## 📁 Estructura de Archivos

```
users/
├── utils/
│   └── userUtils.ts          # Funciones utilitarias compartidas
├── UserFilters.tsx           # Componente de filtros avanzados (accordion)
├── UserDetailsDialog.tsx     # Modal de detalles del usuario
├── UserStatsCards.tsx        # Tarjetas de estadísticas
├── UserTableView.tsx         # Vista de tabla (desktop)
├── UserCardView.tsx          # Vista de tarjetas (móvil)
├── UserLoadingSkeleton.tsx   # Skeleton de carga
├── UserEmptyState.tsx        # Estado vacío
├── UserPagination.tsx        # Componente de paginación
├── index.ts                  # Exportaciones centralizadas
└── README.md                 # Esta documentación
```

## 🧩 Componentes

### **UserFilters.tsx**
Componente de filtros avanzados con accordion que incluye:
- Filtro por tipo de cliente (Individual, Empresa, Sin Definir)
- Filtro por porcentaje de completitud del perfil
- Botones de acceso rápido
- Indicador de filtros activos

**Props:**
```typescript
interface UserFiltersProps {
  clientTypeFilter: string;
  setClientTypeFilter: (value: string) => void;
  completionFilter: { min: number; max: number };
  setCompletionFilter: (value: { min: number; max: number }) => void;
}
```

### **UserDetailsDialog.tsx**
Modal completo con información detallada del usuario:
- Información personal y de contacto
- Estado de completitud del perfil
- Campos faltantes para completar al 100%
- Documentos y contratos
- Información de empresa (si aplica)

**Props:**
```typescript
interface UserDetailsDialogProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
}
```

### **UserStatsCards.tsx**
Tarjetas de estadísticas del dashboard:
- Total de usuarios
- Usuarios con contratos
- Usuarios con términos aceptados
- Página actual

**Props:**
```typescript
interface UserStatsCardsProps {
  users: UserProfile[];
  initialTotal: number;
  currentPage: number;
}
```

### **UserTableView.tsx**
Vista de tabla para desktop con:
- Información resumida de usuarios
- Acciones (Ver detalles, Editar)
- Indicadores de estado
- Porcentaje de completitud

**Props:**
```typescript
interface UserTableViewProps {
  users: UserProfile[];
  onUserUpdated: (user: UserProfile) => void;
  onViewDetails: (user: UserProfile) => void;
  sessionToken: string;
}
```

### **UserCardView.tsx**
Vista de tarjetas para móvil con:
- Diseño responsive
- Barra de progreso de completitud
- Información compacta
- Acciones optimizadas para móvil

**Props:**
```typescript
interface UserCardViewProps {
  users: UserProfile[];
  onUserUpdated: (user: UserProfile) => void;
  onViewDetails: (user: UserProfile) => void;
  sessionToken: string;
}
```

### **UserLoadingSkeleton.tsx**
Componente de skeleton para estados de carga.

### **UserEmptyState.tsx**
Estado vacío cuando no hay usuarios o resultados de búsqueda.

**Props:**
```typescript
interface UserEmptyStateProps {
  searchTerm: string;
}
```

### **UserPagination.tsx**
Componente completo de paginación con:
- Navegación por páginas
- Selector de elementos por página
- Información de resultados
- Botones de navegación rápida

**Props:**
```typescript
interface UserPaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalFilteredUsers: number;
  initialTotal: number;
  startIndex: number;
  endIndex: number;
  loading: boolean;
  hasActiveFilters: boolean;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
}
```

## 🛠️ Utilidades (userUtils.ts)

### **calculateCompletionPercentage(user: UserProfile): number**
Calcula el porcentaje de completitud del perfil basándose en:
- Campos requeridos para todos los usuarios (15 campos)
- Campos adicionales para empresas (5 campos extra)
- Instagram como campo opcional

### **enhanceUser(user: UserProfile)**
Enriquece los datos del usuario con propiedades calculadas:
- `fullName`: Nombre completo
- `displayName`: Nombre para mostrar
- `hasContract`: Si tiene contrato firmado
- `hasAcceptedTerms`: Si aceptó términos
- `registrationStatus`: Estado del registro
- `completionPercentage`: Porcentaje de completitud

### **getMissingFields(user: UserProfile): string[]**
Retorna lista de campos faltantes para completar el perfil al 100%.

### **formatDate(dateString: string | null): string**
Formatea fechas al formato español (DD/MM/YYYY).

### **statusColors**
Mapeo de colores para diferentes estados de usuario.

## 🚀 Uso

### Importación Individual
```typescript
import UserFilters from './users/UserFilters';
import UserDetailsDialog from './users/UserDetailsDialog';
```

### Importación Centralizada
```typescript
import { 
  UserFilters, 
  UserDetailsDialog, 
  calculateCompletionPercentage 
} from './users';
```

### Ejemplo de Uso en UsersDashboard
```typescript
const UsersDashboard = ({ initialUsers, initialTotal, sessionToken }) => {
  // ... estado y lógica

  return (
    <div className="space-y-6">
      <UserStatsCards 
        users={allUsers}
        initialTotal={initialTotal}
        currentPage={currentPage}
      />
      
      <Card>
        <CardContent>
          <UserFilters
            clientTypeFilter={clientTypeFilter}
            setClientTypeFilter={setClientTypeFilter}
            completionFilter={completionFilter}
            setCompletionFilter={setCompletionFilter}
          />
          
          {isMobileView ? (
            <UserCardView {...props} />
          ) : (
            <UserTableView {...props} />
          )}
          
          <UserPagination {...paginationProps} />
        </CardContent>
      </Card>
      
      <UserDetailsDialog
        user={selectedUser}
        isOpen={!!selectedUser}
        onClose={handleCloseDetails}
      />
    </div>
  );
};
```

## ✅ Beneficios de la Refactorización

### **Mantenibilidad**
- Cada componente tiene una responsabilidad específica
- Fácil localización y modificación de funcionalidades
- Código más legible y organizado

### **Reutilización**
- Componentes pueden usarse en otras partes de la aplicación
- Lógica compartida centralizada en utilidades
- Interfaces bien definidas

### **Testing**
- Cada componente puede probarse de forma aislada
- Mocking más sencillo de dependencias
- Cobertura de pruebas más granular

### **Performance**
- Componentes más pequeños = re-renders más eficientes
- Lazy loading potencial de componentes no críticos
- Mejor tree-shaking

### **Experiencia de Desarrollo**
- Navegación más rápida entre archivos
- IntelliSense más preciso
- Menos conflictos en control de versiones
- Onboarding más fácil para nuevos desarrolladores

## 🔄 Migración

El componente original `UsersDashboard.tsx` ha sido respaldado como `UsersDashboardOld.tsx` y reemplazado con la nueva versión modular que utiliza todos estos componentes.

La funcionalidad se mantiene 100% compatible, pero ahora con mejor organización y mantenibilidad.
