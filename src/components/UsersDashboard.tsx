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
  const perPage = 10;

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
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-foreground">Detalles del Usuario</DialogTitle>
        <DialogDescription>
          Información completa del usuario registrado el {formatDate(user.registered_date)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Información Principal */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-foreground">Información Principal</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg">
            <div>
              <Label className="text-foreground">Nombre</Label>
              <div className="mt-1 text-foreground">{user.first_name} {user.last_name}</div>
            </div>
            <div>
              <Label className="text-foreground">Usuario</Label>
              <div className="mt-1 text-foreground">{user.username}</div>
            </div>
            <div>
              <Label className="text-foreground">Email</Label>
              <div className="mt-1 text-foreground">{user.email}</div>
            </div>
            <div>
              <Label className="text-foreground">Teléfono</Label>
              <div className="mt-1 text-foreground">{user.billing_phone || '-'}</div>
            </div>
            <div>
              <Label className="text-foreground">RUT</Label>
              <div className="mt-1 text-foreground">{user.rut || '-'}</div>
            </div>
            <div>
              <Label className="text-foreground">Fecha de Nacimiento</Label>
              <div className="mt-1 text-foreground">{formatDate(user.birth_date)}</div>
            </div>
            <div>
              <Label className="text-foreground">Instagram</Label>
              <div className="mt-1 text-foreground">{user.instagram || '-'}</div>
            </div>
            <div>
              <Label className="text-foreground">Tipo de Cliente</Label>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${customerTypeColors[user.customer_type] || 'bg-gray-100 text-gray-800'}`}>
                  {user.customer_type || 'No especificado'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dirección */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-foreground">Dirección</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg">
            <div>
              <Label className="text-foreground">Dirección</Label>
              <div className="mt-1 text-foreground">{user.billing_address_1 || '-'}</div>
            </div>
            <div>
              <Label className="text-foreground">Ciudad</Label>
              <div className="mt-1 text-foreground">{user.billing_city || '-'}</div>
            </div>
            <div>
              <Label className="text-foreground">País</Label>
              <div className="mt-1 text-foreground">{user.billing_country || '-'}</div>
            </div>
          </div>
        </div>

        {/* Información de Empresa (solo si es tipo empresa) */}
        {user.customer_type === 'empresa' && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground">Información de Empresa</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg">
              <div>
                <Label className="text-foreground">Empresa</Label>
                <div className="mt-1 text-foreground">{user.billing_company || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground">RUT Empresa</Label>
                <div className="mt-1 text-foreground">{user.company_rut || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground">Ciudad Empresa</Label>
                <div className="mt-1 text-foreground">{user.company_city || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground">Dirección Empresa</Label>
                <div className="mt-1 text-foreground">{user.company_address || '-'}</div>
              </div>
              {user.company_erut && (
                <div className="col-span-2">
                  <Label className="text-foreground">E-RUT</Label>
                  <div className="mt-1">
                    <a 
                      href={user.company_erut} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80"
                    >
                      Ver E-RUT
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Documentos */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-foreground">Documentos</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg">
            {user.image_direccion && (
              <div>
                <Label className="text-foreground">Comprobante de Dirección</Label>
                <div className="mt-1">
                  <a 
                    href={user.image_direccion} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"
                  >
                    Ver Comprobante
                  </a>
                </div>
              </div>
            )}
            {user.image_rut && (
              <div>
                <Label className="text-foreground">RUT (Frontal)</Label>
                <div className="mt-1">
                  <a 
                    href={user.image_rut} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"
                  >
                    Ver RUT Frontal
                  </a>
                </div>
              </div>
            )}
            {user.image_rut_ && (
              <div>
                <Label className="text-foreground">RUT (Dorso)</Label>
                <div className="mt-1">
                  <a 
                    href={user.image_rut_} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"
                  >
                    Ver RUT Dorso
                  </a>
                </div>
              </div>
            )}
            {user.url_user_contrato && (
              <div>
                <Label className="text-foreground">Contrato</Label>
                <div className="mt-1">
                  <a 
                    href={user.url_user_contrato} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"
                  >
                    Ver Contrato
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Firma */}
        {user.user_signature && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground">Firma</h4>
            <div className="bg-card p-4 rounded-lg">
              <img 
                src={user.user_signature} 
                alt="Firma del usuario" 
                className="max-h-20 object-contain"
              />
            </div>
          </div>
        )}

        {/* Términos y Condiciones */}
        <div className="bg-card p-4 rounded-lg">
          <div className="flex items-center gap-2">
            <Label className="text-foreground">Términos Aceptados:</Label>
            <span className={user.terms_accepted === '1' ? 'text-green-600' : 'text-red-600'}>
              {user.terms_accepted === '1' ? 'Sí' : 'No'}
            </span>
          </div>
        </div>
      </div>
    </DialogContent>
  );

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

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-md">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Usuarios</CardTitle>
          <CardDescription>
            Gestiona y visualiza todos los usuarios registrados {total > 0 ? `(${total} en total)` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="search" className="mb-2 text-foreground">Buscar</Label>
              <Input 
                id="search" 
                placeholder="Buscar por nombre, email, empresa..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-foreground"
              />
            </div>
            <div className="w-full sm:w-48">
              <Label htmlFor="type" className="mb-2 text-foreground">Tipo de Cliente</Label>
              <select
                id="type"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1); // Reset to first page when filter changes
                }}
              >
                <option value="">Todos</option>
                <option value="natural">Persona Natural</option>
                <option value="empresa">Empresa</option>
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <Label className="mb-2 text-foreground">&nbsp;</Label>
              <Button 
                className="w-full" 
                onClick={refreshData}
                disabled={loading}
              >
                {loading ? 'Actualizando...' : 'Actualizar'}
              </Button>
            </div>
          </div>

          {/* Users table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">Tipo</TableHead>
                  <TableHead className="text-foreground">Nombre</TableHead>
                  <TableHead className="text-foreground">Email</TableHead>
                  <TableHead className="text-foreground">Registro</TableHead>
                  <TableHead className="text-foreground">Empresa</TableHead>
                  <TableHead className="text-right text-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${customerTypeColors[user.customer_type] || 'bg-gray-100 text-gray-800'}`}>
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      No se encontraron usuarios
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Mostrando {filteredUsers.length} {totalPages > 1 ? `de ${total}` : ''} usuarios
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loading}
              >
                Anterior
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
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