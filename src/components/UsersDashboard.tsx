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
import type { User } from '../types/user';
import { ChevronRight, ExternalLink, RefreshCw, Search } from 'lucide-react';

interface UsersDashboardProps {
  initialUsers: User[];
  initialTotal: string;
  initialTotalPages: string;
}

const customerTypeColors: Record<string, string> = {
  'natural': 'bg-blue-100 text-blue-800',
  'empresa': 'bg-purple-100 text-purple-800',
  '': 'bg-gray-100 text-gray-800'
};

const UsersDashboard = ({ 
  initialUsers,
  initialTotal,
  initialTotalPages 
}: UsersDashboardProps) => {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(parseInt(initialTotalPages || '1'));
  const [total, setTotal] = useState(parseInt(initialTotal || '0'));
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const perPage = 10;

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

  // Función para cargar los datos con filtros
  const loadUsers = async (page: number, type: string = '') => {
    try {
      setIsInitialLoad(false);
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
      });

      if (type) {
        params.append('role', type);
      }

      const response = await fetch(`/api/wp/get-users?${params}`);
      const data = await response.json();
      
      if (data.users) {
        setUsers(data.users);
        setTotal(parseInt(data.total || '0'));
        setTotalPages(parseInt(data.totalPages || '1'));
      } else {
        setError('Error al cargar los usuarios');
      }
    } catch (err) {
      setError('Error al cargar los usuarios');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Efecto para cargar datos cuando cambian los filtros o la página
  useEffect(() => {
    if (!isInitialLoad) {
      loadUsers(currentPage, typeFilter);
    }
  }, [currentPage, typeFilter]);

  // Función para recargar los datos
  const refreshData = () => {
    loadUsers(currentPage, typeFilter);
  };

  // Filter users based on search term and type
  const filteredUsers = users.filter(user => {
    const searchMatch = 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.billing_company && user.billing_company.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const typeMatch = typeFilter ? user.customer_type === typeFilter : true;
    
    return searchMatch && typeMatch;
  });

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const UserDetailsDialog = ({ user }: { user: User }) => (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] md:w-auto p-4 md:p-6">
      <DialogHeader>
        <DialogTitle className="text-foreground text-xl">Detalles del Usuario</DialogTitle>
        <DialogDescription>
          Información completa del usuario registrado el {formatDate(user.registered_date)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Información Principal */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-foreground">Información Principal</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
            <div>
              <Label className="text-foreground font-medium">Nombre</Label>
              <div className="mt-1 text-foreground">{user.first_name} {user.last_name}</div>
            </div>
            <div>
              <Label className="text-foreground font-medium">Usuario</Label>
              <div className="mt-1 text-foreground">{user.username}</div>
            </div>
            <div>
              <Label className="text-foreground font-medium">Email</Label>
              <div className="mt-1 text-foreground break-words">{user.email}</div>
            </div>
            <div>
              <Label className="text-foreground font-medium">Teléfono</Label>
              <div className="mt-1 text-foreground">{user.billing_phone || '-'}</div>
            </div>
            <div>
              <Label className="text-foreground font-medium">RUT</Label>
              <div className="mt-1 text-foreground">{user.rut || '-'}</div>
            </div>
            <div>
              <Label className="text-foreground font-medium">Fecha de Nacimiento</Label>
              <div className="mt-1 text-foreground">{formatDate(user.birth_date)}</div>
            </div>
            <div>
              <Label className="text-foreground font-medium">Instagram</Label>
              <div className="mt-1 text-foreground">{user.instagram || '-'}</div>
            </div>
            <div>
              <Label className="text-foreground font-medium">Tipo de Cliente</Label>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${customerTypeColors[user.customer_type] || 'bg-gray-100 text-gray-800'}`}>
                  {user.customer_type || 'No especificado'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dirección */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-foreground">Dirección</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
            <div>
              <Label className="text-foreground font-medium">Dirección</Label>
              <div className="mt-1 text-foreground">{user.billing_address_1 || '-'}</div>
            </div>
            <div>
              <Label className="text-foreground font-medium">Ciudad</Label>
              <div className="mt-1 text-foreground">{user.billing_city || '-'}</div>
            </div>
            <div>
              <Label className="text-foreground font-medium">País</Label>
              <div className="mt-1 text-foreground">{user.billing_country || '-'}</div>
            </div>
          </div>
        </div>

        {/* Información de Empresa (solo si es tipo empresa) */}
        {user.customer_type === 'empresa' && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground">Información de Empresa</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
              <div>
                <Label className="text-foreground font-medium">Empresa</Label>
                <div className="mt-1 text-foreground">{user.billing_company || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">RUT Empresa</Label>
                <div className="mt-1 text-foreground">{user.company_rut || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Ciudad Empresa</Label>
                <div className="mt-1 text-foreground">{user.company_city || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Dirección Empresa</Label>
                <div className="mt-1 text-foreground">{user.company_address || '-'}</div>
              </div>
              {user.company_erut && (
                <div className="col-span-2">
                  <Label className="text-foreground font-medium">E-RUT</Label>
                  <div className="mt-1">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => window.open(user.company_erut, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver E-RUT
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Documentos */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-foreground">Documentos</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
            {user.image_direccion && (
              <div>
                <Label className="text-foreground font-medium">Comprobante de Dirección</Label>
                <div className="mt-1">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => window.open(user.image_direccion, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver Comprobante
                  </Button>
                </div>
              </div>
            )}
            {user.image_rut && (
              <div>
                <Label className="text-foreground font-medium">RUT (Frontal)</Label>
                <div className="mt-1">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => window.open(user.image_rut, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver RUT Frontal
                  </Button>
                </div>
              </div>
            )}
            {user.image_rut_ && (
              <div>
                <Label className="text-foreground font-medium">RUT (Dorso)</Label>
                <div className="mt-1">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => window.open(user.image_rut_, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver RUT Dorso
                  </Button>
                </div>
              </div>
            )}
            {user.url_user_contrato && (
              <div>
                <Label className="text-foreground font-medium">Contrato</Label>
                <div className="mt-1">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => window.open(user.url_user_contrato, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver Contrato
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Firma */}
        {user.user_signature && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground">Firma</h4>
            <div className="bg-card p-4 rounded-lg border">
              <img 
                src={user.user_signature} 
                alt="Firma del usuario" 
                className="max-h-20 object-contain"
              />
            </div>
          </div>
        )}

        {/* Términos y Condiciones */}
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            <Label className="text-foreground font-medium">Términos Aceptados:</Label>
            <span className={user.terms_accepted === '1' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
              {user.terms_accepted === '1' ? 'Sí' : 'No'}
            </span>
          </div>
        </div>
      </div>
    </DialogContent>
  );

  // Render loading state
  if (loading && !isInitialLoad) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2 text-foreground">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-md">
        <p>{error}</p>
      </div>
    );
  }

  // Render the table rows or mobile cards for each user
  const renderUserItems = () => {
    if (filteredUsers.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No se encontraron usuarios
        </div>
      );
    }

    // Mobile view - Card layout
    if (isMobileView) {
      return (
        <div className="space-y-4">
          {filteredUsers.map((user) => (
            <Card key={user.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${customerTypeColors[user.customer_type] || 'bg-gray-100 text-gray-800'}`}>
                    {user.customer_type || 'No especificado'}
                  </span>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">{formatDate(user.registered_date)}</div>
                  </div>
                </div>
                
                <h3 className="font-semibold text-foreground text-lg mb-1">{user.first_name} {user.last_name}</h3>
                <p className="text-sm text-muted-foreground mb-2">@{user.username}</p>
                
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium text-foreground break-words">{user.email}</p>
                  </div>
                  {user.billing_company && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Empresa</p>
                      <p className="text-sm font-medium text-foreground truncate">{user.billing_company}</p>
                    </div>
                  )}
                </div>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setSelectedUser(user)}>
                      Ver detalles <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </DialogTrigger>
                  {selectedUser && <UserDetailsDialog user={selectedUser} />}
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    // Desktop view - Table layout
    return (
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-foreground font-semibold">Tipo</TableHead>
              <TableHead className="text-foreground font-semibold">Nombre</TableHead>
              <TableHead className="text-foreground font-semibold">Email</TableHead>
              <TableHead className="text-foreground font-semibold">Registro</TableHead>
              <TableHead className="text-foreground font-semibold">Empresa</TableHead>
              <TableHead className="text-right text-foreground font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${customerTypeColors[user.customer_type] || 'bg-gray-100 text-gray-800'}`}>
                    {user.customer_type || 'No especificado'}
                  </span>
                </TableCell>
                <TableCell className="text-foreground">
                  <div className="font-medium">{user.first_name} {user.last_name}</div>
                  <div className="text-sm text-muted-foreground">@{user.username}</div>
                </TableCell>
                <TableCell className="text-foreground">{user.email}</TableCell>
                <TableCell className="text-foreground">{formatDate(user.registered_date)}</TableCell>
                <TableCell className="text-foreground">{user.billing_company || '-'}</TableCell>
                <TableCell className="text-right">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setSelectedUser(user)}>
                        Ver detalles
                      </Button>
                    </DialogTrigger>
                    {selectedUser && <UserDetailsDialog user={selectedUser} />}
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-xl">Usuarios</CardTitle>
          <CardDescription>
            Gestiona y visualiza todos los usuarios registrados {total > 0 ? `(${total} en total)` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                id="search" 
                placeholder="Buscar por nombre, email, empresa..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-foreground pl-10"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="w-full sm:flex-1">
                <select
                  id="type"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setCurrentPage(1); // Reset to first page when filter changes
                  }}
                >
                  <option value="">Todos los tipos</option>
                  <option value="natural">Persona Natural</option>
                  <option value="empresa">Empresa</option>
                </select>
              </div>
              
              <Button 
                className="w-full sm:w-auto" 
                onClick={refreshData}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {loading ? 'Actualizando...' : 'Actualizar'}
              </Button>
            </div>
          </div>

          {/* Users table or cards */}
          {renderUserItems()}

          {/* Pagination */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground order-2 sm:order-1">
              Mostrando {filteredUsers.length} {totalPages > 1 ? `de ${total}` : ''} usuarios
            </div>
            <div className="flex gap-2 order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loading}
              >
                Anterior
              </Button>
              
              <div className="flex items-center px-3 h-9 border rounded-md">
                <span className="text-sm font-medium">
                  {currentPage} / {totalPages}
                </span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || loading || totalPages <= 1}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersDashboard; 