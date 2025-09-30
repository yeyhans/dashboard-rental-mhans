import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from './ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription } from './ui/alert';
import EditUserDialog from './EditUserDialog';
import { toast } from 'sonner';
import type { UserProfile } from '../types/user';
import { 
  ChevronRight, 
  ExternalLink, 
  RefreshCw, 
  Search, 
  Users, 
  FileText, 
  CheckCircle, 
  Clock,
  AlertCircle,
  UserCheck,
  Edit
} from 'lucide-react';

interface UsersDashboardProps {
  initialUsers: UserProfile[];
  initialTotal: number;
  sessionToken: string;
}

// Helper function to enhance user data with computed properties
const enhanceUser = (user: UserProfile) => ({
  ...user,
  fullName: `${user.nombre || ''} ${user.apellido || ''}`.trim(),
  displayName: user.nombre || user.email || 'Usuario sin nombre',
  hasContract: Boolean(user.url_user_contrato),
  hasAcceptedTerms: Boolean(user.terminos_aceptados),
  registrationStatus: user.terminos_aceptados && user.url_user_contrato ? 'complete' : 
                     user.terminos_aceptados ? 'incomplete' : 'pending',
  completionPercentage: calculateCompletionPercentage(user)
});

// Calculate user profile completion percentage
const calculateCompletionPercentage = (user: UserProfile): number => {
  const fields = [
    user.nombre, user.apellido, user.email, user.rut, user.telefono,
    user.direccion, user.ciudad, user.fecha_nacimiento, user.instagram,
    user.usuario, user.empresa_nombre, user.pais, user.tipo_cliente
  ];
  const filledFields = fields.filter(field => field && field.toString().trim() !== '').length;
  return Math.round((filledFields / fields.length) * 100);
};

const statusColors: Record<string, string> = {
  'complete': 'bg-green-100 text-green-800',
  'incomplete': 'bg-yellow-100 text-yellow-800',
  'pending': 'bg-blue-100 text-blue-800',
  '': 'bg-gray-100 text-gray-800'
};

const UsersDashboard = ({ 
  initialUsers,
  initialTotal,
  sessionToken
}: UsersDashboardProps) => {
  // All users loaded from server
  const [allUsers, setAllUsers] = useState<UserProfile[]>(initialUsers);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  // const [stats] = useState<UserStats | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);

  // Detect mobile view
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // Filter users based on search term
  const filteredUsers = allUsers.filter(user => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      user.nombre?.toLowerCase().includes(searchLower) ||
      user.apellido?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.rut?.toLowerCase().includes(searchLower) ||
      user.empresa_nombre?.toLowerCase().includes(searchLower) ||
      user.usuario?.toLowerCase().includes(searchLower) ||
      user.instagram?.toLowerCase().includes(searchLower) ||
      user.ciudad?.toLowerCase().includes(searchLower) ||
      user.pais?.toLowerCase().includes(searchLower) ||
      user.tipo_cliente?.toLowerCase().includes(searchLower)
    );
  });

  // Calculate pagination
  const totalFilteredUsers = filteredUsers.length;
  const totalPages = Math.ceil(totalFilteredUsers / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
  };

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Handle user update
  const handleUserUpdated = (updatedUser: UserProfile) => {
    setAllUsers(prevUsers => 
      prevUsers.map(user => 
        user.user_id === updatedUser.user_id ? updatedUser : user
      )
    );
    toast.success('Usuario actualizado correctamente');
  };

  // Refresh data - reload the page to get fresh server-side data
  const refreshData = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
          <Skeleton className="h-8 w-[100px]" />
        </div>
      ))}
    </div>
  );

  // User details dialog component
  const UserDetailsDialog = ({ user }: { user: UserProfile }) => {
    const enhanced = enhanceUser(user);
    
    return (
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] md:w-auto p-4 md:p-6">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">
            Detalles del Usuario - {enhanced.fullName}
          </DialogTitle>
          <DialogDescription>
            Información completa del usuario registrado el {formatDate(user.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Perfil Completo</p>
                    <p className="text-2xl font-bold">{enhanced.completionPercentage}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Contrato</p>
                    <Badge variant={enhanced.hasContract ? "default" : "secondary"}>
                      {enhanced.hasContract ? 'Firmado' : 'Pendiente'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium">Estado</p>
                    <Badge className={statusColors[enhanced.registrationStatus]}>
                      {enhanced.registrationStatus === 'complete' ? 'Completo' :
                       enhanced.registrationStatus === 'incomplete' ? 'Incompleto' : 'Pendiente'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Personal Information */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground">Información Personal</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
              <div>
                <Label className="text-foreground font-medium">Nombre Completo</Label>
                <div className="mt-1 text-foreground">{enhanced.fullName}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Email</Label>
                <div className="mt-1 text-foreground break-words">{user.email}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">RUT</Label>
                <div className="mt-1 text-foreground">{user.rut || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Teléfono</Label>
                <div className="mt-1 text-foreground">{user.telefono || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Fecha de Nacimiento</Label>
                <div className="mt-1 text-foreground">{formatDate(user.fecha_nacimiento)}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Instagram</Label>
                <div className="mt-1 text-foreground">{user.instagram || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Usuario</Label>
                <div className="mt-1 text-foreground">{user.usuario || '-'}</div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground">Dirección</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
              <div>
                <Label className="text-foreground font-medium">Dirección</Label>
                <div className="mt-1 text-foreground">{user.direccion || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Ciudad</Label>
                <div className="mt-1 text-foreground">{user.ciudad || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">País</Label>
                <div className="mt-1 text-foreground">{user.pais || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Tipo Cliente</Label>
                <div className="mt-1 text-foreground">{user.tipo_cliente || '-'}</div>
              </div>
            </div>
          </div>

          {/* Company Information */}
          {(user.empresa_nombre || user.empresa_rut || user.empresa_ciudad || user.empresa_direccion) && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-foreground">Información de Empresa</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
                <div>
                  <Label className="text-foreground font-medium">Nombre de Empresa</Label>
                  <div className="mt-1 text-foreground">{user.empresa_nombre || '-'}</div>
                </div>
                <div>
                  <Label className="text-foreground font-medium">RUT de Empresa</Label>
                  <div className="mt-1 text-foreground">{user.empresa_rut || '-'}</div>
                </div>
                <div>
                  <Label className="text-foreground font-medium">Ciudad de Empresa</Label>
                  <div className="mt-1 text-foreground">{user.empresa_ciudad || '-'}</div>
                </div>
                <div>
                  <Label className="text-foreground font-medium">Dirección de Empresa</Label>
                  <div className="mt-1 text-foreground">{user.empresa_direccion || '-'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Document URLs */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
              {user.url_empresa_erut && (
                <div>
                  <Label className="text-foreground font-medium">E-RUT Empresa</Label>
                  <div className="mt-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => user.url_empresa_erut && window.open(user.url_empresa_erut, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver E-RUT
                    </Button>
                  </div>
                </div>
              )}
              {user.new_url_e_rut_empresa && (
                <div>
                  <Label className="text-foreground font-medium">Nuevo E-RUT Empresa</Label>
                  <div className="mt-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => user.new_url_e_rut_empresa && window.open(user.new_url_e_rut_empresa, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver Nuevo E-RUT
                    </Button>
                  </div>
                </div>
              )}
              {user.url_rut_anverso && (
                <div>
                  <Label className="text-foreground font-medium">RUT Anverso</Label>
                  <div className="mt-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => user.url_rut_anverso && window.open(user.url_rut_anverso, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver RUT Anverso
                    </Button>
                  </div>
                </div>
              )}
              {user.url_rut_reverso && (
                <div>
                  <Label className="text-foreground font-medium">RUT Reverso</Label>
                  <div className="mt-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => user.url_rut_reverso && window.open(user.url_rut_reverso, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver RUT Reverso
                    </Button>
                  </div>
                </div>
              )}
              {user.url_firma && (
                <div>
                  <Label className="text-foreground font-medium">Firma</Label>
                  <div className="mt-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => user.url_firma && window.open(user.url_firma, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver Firma
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Information */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Estado del Usuario
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
              <div>
                <Label className="text-foreground font-medium">Términos Aceptados</Label>
                <div className="mt-1">
                  <Badge variant={user.terminos_aceptados ? "default" : "secondary"}>
                    {user.terminos_aceptados ? 'Sí' : 'No'}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Fecha de Creación</Label>
                <div className="mt-1 text-foreground">{formatDate(user.created_at)}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Última Actualización</Label>
                <div className="mt-1 text-foreground">{formatDate(user.updated_at)}</div>
              </div>
            </div>
          </div>


          {/* Contract Information */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Información de Contrato
            </h4>
            <div className="bg-card p-4 rounded-lg border space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-foreground font-medium">Términos Aceptados:</Label>
                <Badge variant={enhanced.hasAcceptedTerms ? "default" : "secondary"}>
                  {enhanced.hasAcceptedTerms ? 'Sí' : 'No'}
                </Badge>
              </div>
              
              {user.url_user_contrato && (
                <div>
                  <Label className="text-foreground font-medium">Contrato</Label>
                  <div className="mt-1">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => user.url_user_contrato && window.open(user.url_user_contrato, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver Contrato
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </DialogContent>
    );
  };

  // Statistics cards - temporarily disabled due to authentication issues
  const StatsCards = () => {
    // TODO: Re-enable when authentication is properly configured
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Usuarios</p>
                <p className="text-2xl font-bold">{initialTotal}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Con Contratos</p>
                <p className="text-2xl font-bold">
                  {allUsers.filter(u => u.url_user_contrato).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Términos Aceptados</p>
                <p className="text-2xl font-bold">
                  {allUsers.filter(u => u.terminos_aceptados).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Página Actual</p>
                <p className="text-2xl font-bold">{currentPage}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Render user items (table or cards)
  const renderUserItems = () => {
    if (loading) {
      return <LoadingSkeleton />;
    }

    if (currentUsers.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{searchTerm ? 'No se encontraron usuarios que coincidan con la búsqueda' : 'No hay usuarios disponibles'}</p>
          {searchTerm && (
            <p className="text-sm mt-2">Intenta con otros términos de búsqueda</p>
          )}
        </div>
      );
    }

    // Mobile view - Card layout
    if (isMobileView) {
      return (
        <div className="space-y-4">
          {currentUsers.map((user) => {
            const enhanced = enhanceUser(user);
            return (
              <Card key={user.user_id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <Badge className={statusColors[enhanced.registrationStatus]}>
                      {enhanced.registrationStatus === 'complete' ? 'Completo' :
                       enhanced.registrationStatus === 'incomplete' ? 'Incompleto' : 'Pendiente'}
                    </Badge>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">{formatDate(user.created_at)}</div>
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-foreground text-lg mb-1">{enhanced.fullName}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{user.email}</p>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">RUT</p>
                      <p className="text-sm font-medium text-foreground">{user.rut || '-'}</p>
                    </div>
                    {user.empresa_nombre && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Empresa</p>
                        <p className="text-sm font-medium text-foreground truncate">{user.empresa_nombre}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setSelectedUser(user)}>
                          Ver detalles <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                      </DialogTrigger>
                      {selectedUser && <UserDetailsDialog user={selectedUser} />}
                    </Dialog>
                    <EditUserDialog 
                      user={user} 
                      onUserUpdated={handleUserUpdated}
                      sessionToken={sessionToken}
                      trigger={
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      );
    }

    // Desktop view - Table layout
    return (
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-foreground font-semibold">Estado</TableHead>
              <TableHead className="text-foreground font-semibold">Nombre</TableHead>
              <TableHead className="text-foreground font-semibold">Email</TableHead>
              <TableHead className="text-foreground font-semibold">RUT</TableHead>
              <TableHead className="text-foreground font-semibold">Empresa</TableHead>
              <TableHead className="text-foreground font-semibold">Registro</TableHead>
              <TableHead className="text-right text-foreground font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentUsers.map((user) => {
              const enhanced = enhanceUser(user);
              return (
                <TableRow key={user.user_id}>
                  <TableCell>
                    <Badge className={statusColors[enhanced.registrationStatus]}>
                      {enhanced.registrationStatus === 'complete' ? 'Completo' :
                       enhanced.registrationStatus === 'incomplete' ? 'Incompleto' : 'Pendiente'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground">
                    <div className="font-medium">{enhanced.fullName}</div>
                    <div className="text-sm text-muted-foreground">
                      Perfil {enhanced.completionPercentage}% completo
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground">{user.email}</TableCell>
                  <TableCell className="text-foreground">{user.rut || '-'}</TableCell>
                  <TableCell className="text-foreground">{user.empresa_nombre || '-'}</TableCell>
                  <TableCell className="text-foreground">{formatDate(user.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setSelectedUser(user)}>
                            Ver detalles
                          </Button>
                        </DialogTrigger>
                        {selectedUser && <UserDetailsDialog user={selectedUser} />}
                      </Dialog>
                      <EditUserDialog 
                        user={user} 
                        onUserUpdated={handleUserUpdated}
                        sessionToken={sessionToken}
                        trigger={
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  // Render error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <StatsCards />

      {/* Main Content */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-xl flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gestión de Usuarios
          </CardTitle>
          <CardDescription>
            Gestiona y visualiza todos los usuarios registrados {initialTotal > 0 ? `(${initialTotal} en total)` : ''}
            {searchTerm && (
              <span className="block text-sm mt-1">
                Mostrando {totalFilteredUsers} resultados para "{searchTerm}"
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por nombre, email, RUT, empresa..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-foreground pl-10"
                />
              </div>
              
              <Button 
                onClick={refreshData}
                disabled={loading}
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Actualizando...' : 'Actualizar'}
              </Button>
            </div>
          </div>

          {/* Users table or cards */}
          {renderUserItems()}

          {/* Pagination and Controls */}
          <div className="mt-6 space-y-4">
            {/* Items per page selector */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Mostrar:</Label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="px-3 py-1 border rounded-md text-sm bg-background"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-muted-foreground">por página</span>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1}-{Math.min(endIndex, totalFilteredUsers)} de {totalFilteredUsers} usuarios
                {searchTerm && ` (filtrados de ${initialTotal} total)`}
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1 || loading}
                  >
                    Primera
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1 || loading}
                  >
                    Anterior
                  </Button>
                  
                  {/* Page numbers */}
                  <div className="flex items-center gap-1 mx-2">
                    {(() => {
                      const pages = [];
                      const maxVisiblePages = 5;
                      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                      
                      // Adjust start if we're near the end
                      if (endPage - startPage + 1 < maxVisiblePages) {
                        startPage = Math.max(1, endPage - maxVisiblePages + 1);
                      }
                      
                      // Show first page and ellipsis if needed
                      if (startPage > 1) {
                        pages.push(
                          <Button
                            key={1}
                            variant={1 === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(1)}
                            className="w-9 h-9 p-0"
                          >
                            1
                          </Button>
                        );
                        if (startPage > 2) {
                          pages.push(
                            <span key="ellipsis1" className="px-2 text-muted-foreground">
                              ...
                            </span>
                          );
                        }
                      }
                      
                      // Show visible page range
                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <Button
                            key={i}
                            variant={i === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(i)}
                            className="w-9 h-9 p-0"
                          >
                            {i}
                          </Button>
                        );
                      }
                      
                      // Show last page and ellipsis if needed
                      if (endPage < totalPages) {
                        if (endPage < totalPages - 1) {
                          pages.push(
                            <span key="ellipsis2" className="px-2 text-muted-foreground">
                              ...
                            </span>
                          );
                        }
                        pages.push(
                          <Button
                            key={totalPages}
                            variant={totalPages === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(totalPages)}
                            className="w-9 h-9 p-0"
                          >
                            {totalPages}
                          </Button>
                        );
                      }
                      
                      return pages;
                    })()}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages || loading}
                  >
                    Siguiente
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages || loading}
                  >
                    Última
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersDashboard;
