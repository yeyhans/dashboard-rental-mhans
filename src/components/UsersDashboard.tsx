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
import { toast } from 'sonner';
import type { UserProfile } from '../types/user';
import { 
  RefreshCw, 
  Search, 
  Users, 
  AlertCircle
} from 'lucide-react';

// Import new components
import UserFilters from './users/UserFilters';
import UserDetailsDialog from './users/UserDetailsDialog';
import UserStatsCards from './users/UserStatsCards';
import UserTableView from './users/UserTableView';
import UserCardView from './users/UserCardView';
import UserLoadingSkeleton from './users/UserLoadingSkeleton';
import UserEmptyState from './users/UserEmptyState';
import UserPagination from './users/UserPagination';
import { calculateCompletionPercentage } from './users/utils/userUtils';

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
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [completionFilter, setCompletionFilter] = useState<{min: number, max: number}>({min: 0, max: 100});
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('all');

  // Initialize mobile view detection
  useEffect(() => {
    console.log('🔑 Session token available for UsersDashboard');
    
    const checkIfMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, [sessionToken]);

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

  // Handle view details
  const handleViewDetails = (user: UserProfile) => {
    setSelectedUser(user);
  };

  // Handle close details dialog
  const handleCloseDetails = () => {
    setSelectedUser(null);
  };

  // Refresh data - reload the page to get fresh server-side data
  const refreshData = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  // Check if there are active filters
  const hasActiveFilters = searchTerm || completionFilter.min > 0 || completionFilter.max < 100 || clientTypeFilter !== 'all';

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
      <UserStatsCards 
        users={allUsers}
        initialTotal={initialTotal}
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
            Gestiona y visualiza todos los usuarios registrados {initialTotal > 0 ? `(${initialTotal} en total)` : ''}
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
              
              <Button 
                onClick={refreshData}
                disabled={loading}
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Actualizando...' : 'Actualizar'}
              </Button>
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
            initialTotal={initialTotal}
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
    </div>
  );
};

export default UsersDashboard;
