import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from './ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './ui/table';
import { toast } from 'sonner';
import type { UserProfile } from '../types/user';
import {
  RefreshCw,
  Search,
  Users,
  AlertCircle,
  AlertTriangle,
  UserPlus,
  Loader2
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

// Import new components
import UserFilters from './users/UserFilters';
import UserDetailsDialog from './users/UserDetailsDialog';
import UserStatsCards from './users/UserStatsCards';
import UserTableView from './users/UserTableView';
import UserCardView from './users/UserCardView';
import UserLoadingSkeleton from './users/UserLoadingSkeleton';
import UserEmptyState from './users/UserEmptyState';
import UserPagination from './users/UserPagination';
// Import CreateUserDialog
import CreateUserDialog from './CreateUserDialog';
import { calculateCompletionPercentage } from './users/utils/userUtils';

interface OrphanedAuthUser {
  auth_uid: string;
  email: string;
  created_at: string;
}

interface UsersDashboardProps {
  initialUsers: UserProfile[];
  initialTotal: number;
  sessionToken: string;
}

const UsersDashboard = ({
  initialUsers,
  initialTotal,
  sessionToken
}: UsersDashboardProps) => {
  // State management
  const [allUsers, setAllUsers] = useState<UserProfile[]>(initialUsers);
  const [totalUsers, setTotalUsers] = useState(initialTotal);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [completionFilter, setCompletionFilter] = useState<{ min: number, max: number }>({ min: 0, max: 100 });
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('all');

  // Orphaned users state
  const [orphanedUsers, setOrphanedUsers] = useState<OrphanedAuthUser[]>([]);
  const [showOrphanedDialog, setShowOrphanedDialog] = useState(false);
  const [creatingProfileFor, setCreatingProfileFor] = useState<string | null>(null);

  // Cargar todos los usuarios desde la API al montar el componente
  useEffect(() => {
    const fetchAllUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get('/api/users?page=1&limit=500');
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Error al cargar usuarios');
        setAllUsers(result.data.users || []);
        setTotalUsers(result.data.total || 0);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al cargar usuarios';
        console.error('[UsersDashboard] Error al cargar usuarios:', msg);
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchAllUsers();
  }, []);

  // Initialize mobile view detection
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

  // Fetch orphaned users on mount
  useEffect(() => {
    const fetchOrphaned = async () => {
      try {
        const response = await apiClient.get('/api/users/orphaned');
        const result = await response.json();
        if (result.success) {
          setOrphanedUsers(result.data);
        }
      } catch (err) {
        console.error('[UsersDashboard] Error al obtener usuarios huérfanos:', err);
      }
    };

    fetchOrphaned();
  }, []);

  // Create profile for an orphaned auth user
  const handleCreateProfileForOrphan = async (authUid: string, email: string) => {
    setCreatingProfileFor(authUid);
    try {
      const response = await apiClient.post('/api/users/orphaned', { auth_uid: authUid, email });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error al crear perfil');
      }

      toast.success(`Perfil creado para ${email}`);

      // Remove from orphaned list
      setOrphanedUsers(prev => prev.filter(u => u.auth_uid !== authUid));

      // Add new user to the main list
      setAllUsers(prev => [result.data, ...prev]);
      setTotalUsers(prev => prev + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(msg);
    } finally {
      setCreatingProfileFor(null);
    }
  };

  // Filter users based on search term, completion percentage, and client type
  const filteredUsers = allUsers.filter(user => {
    // Search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (
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
      if (!matchesSearch) return false;
    }

    // Client type filter
    if (clientTypeFilter !== 'all') {
      if (clientTypeFilter === 'individual' && user.tipo_cliente === 'empresa') return false;
      if (clientTypeFilter === 'empresa' && user.tipo_cliente !== 'empresa') return false;
      if (clientTypeFilter === 'undefined' && user.tipo_cliente) return false;
    }

    // Completion percentage filter
    const userCompletion = calculateCompletionPercentage(user);
    return userCompletion >= completionFilter.min && userCompletion <= completionFilter.max;
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

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, completionFilter, clientTypeFilter]);

  // Handle user update
  const handleUserUpdated = (updatedUser: UserProfile) => {
    setAllUsers(prevUsers =>
      prevUsers.map(user =>
        user.user_id === updatedUser.user_id ? updatedUser : user
      )
    );
    toast.success('Usuario actualizado correctamente');
  };

  // Handle user creation
  const handleUserCreated = (newUser: UserProfile) => {
    setAllUsers(prevUsers => [newUser, ...prevUsers]);
    setTotalUsers(prev => prev + 1);
    toast.success('Usuario creado correctamente');
  };

  // Handle view details
  const handleViewDetails = (user: UserProfile) => {
    setSelectedUser(user);
  };

  // Handle close details dialog
  const handleCloseDetails = () => {
    setSelectedUser(null);
  };

  // Refresh data - refetch desde la API
  const refreshData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/api/users?page=1&limit=500');
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Error al actualizar usuarios');
      setAllUsers(result.data.users || []);
      setTotalUsers(result.data.total || 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar usuarios';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Check if there are active filters
  const hasActiveFilters = Boolean(searchTerm || completionFilter.min > 0 || completionFilter.max < 100 || clientTypeFilter !== 'all');

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
      {/* Orphaned users alert */}
      {orphanedUsers.length > 0 && (
        <div className="mb-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="font-medium text-yellow-500">
                  {orphanedUsers.length} usuario(s) registrado(s) sin perfil
                </p>
                <p className="text-sm text-muted-foreground">
                  Estos usuarios se registraron pero no tienen perfil en el sistema
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowOrphanedDialog(true)}>
              Ver usuarios
            </Button>
          </div>
        </div>
      )}

      {/* Statistics */}
      <UserStatsCards
        users={allUsers}
        initialTotal={totalUsers}
        currentPage={currentPage}
      />

      {/* Main Content */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-xl flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gestión de Usuarios
          </CardTitle>
          <CardDescription>
            Gestiona y visualiza todos los usuarios registrados {totalUsers > 0 ? `(${totalUsers} en total)` : ''}
            {hasActiveFilters && (
              <span className="block text-sm mt-1">
                Mostrando {totalFilteredUsers} resultados
                {searchTerm && ` para "${searchTerm}"`}
                {clientTypeFilter !== 'all' &&
                  ` tipo ${clientTypeFilter === 'individual' ? 'Individual' :
                    clientTypeFilter === 'empresa' ? 'Empresa' : 'Sin Definir'}`
                }
                {(completionFilter.min > 0 || completionFilter.max < 100) &&
                  ` con perfil ${completionFilter.min}%-${completionFilter.max}%`
                }
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

              <div className="flex gap-2">
                <CreateUserDialog
                  onUserCreated={handleUserCreated}
                  sessionToken={sessionToken}
                />

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

            {/* Filters */}
            <UserFilters
              clientTypeFilter={clientTypeFilter}
              setClientTypeFilter={setClientTypeFilter}
              completionFilter={completionFilter}
              setCompletionFilter={setCompletionFilter}
            />
          </div>

          {/* Users content */}
          {loading ? (
            <UserLoadingSkeleton />
          ) : currentUsers.length === 0 ? (
            <UserEmptyState searchTerm={searchTerm} />
          ) : isMobileView ? (
            <UserCardView
              users={currentUsers}
              onUserUpdated={handleUserUpdated}
              onViewDetails={handleViewDetails}
              sessionToken={sessionToken}
            />
          ) : (
            <UserTableView
              users={currentUsers}
              onUserUpdated={handleUserUpdated}
              onViewDetails={handleViewDetails}
              sessionToken={sessionToken}
            />
          )}

          {/* Pagination */}
          <UserPagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalFilteredUsers={totalFilteredUsers}
            initialTotal={totalUsers}
            startIndex={startIndex}
            endIndex={endIndex}
            loading={loading}
            hasActiveFilters={hasActiveFilters}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      <UserDetailsDialog
        user={selectedUser}
        isOpen={!!selectedUser}
        onClose={handleCloseDetails}
      />

      {/* Orphaned Users Dialog */}
      <Dialog open={showOrphanedDialog} onOpenChange={setShowOrphanedDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Usuarios sin perfil
            </DialogTitle>
            <DialogDescription>
              Estos usuarios tienen cuenta de acceso pero no tienen perfil en el sistema.
              Creá un perfil básico para que aparezcan en la gestión de usuarios.
            </DialogDescription>
          </DialogHeader>

          {orphanedUsers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay usuarios huérfanos pendientes.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Fecha de registro</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphanedUsers.map(user => (
                  <TableRow key={user.auth_uid}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(user.created_at).toLocaleDateString('es-CL', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={creatingProfileFor === user.auth_uid}
                        onClick={() => handleCreateProfileForOrphan(user.auth_uid, user.email)}
                      >
                        {creatingProfileFor === user.auth_uid ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creando...
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Crear perfil
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersDashboard;
