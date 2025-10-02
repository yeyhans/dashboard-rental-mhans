import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '../ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { 
  RefreshCw, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Tag, 
  TrendingUp,
  Users,
  Calendar,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '../../types/database';
import CreateCouponForm from '../coupons/CreateCouponForm';
import EditCouponForm from '../coupons/EditCouponForm';

// Helper function to get authentication headers
function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  
  try {
    // Get access token from cookie (this is how the system stores auth)
    const cookies = document.cookie.split('; ');
    const accessTokenCookie = cookies.find(row => row.startsWith('sb-access-token='));
    
    if (accessTokenCookie) {
      const token = accessTokenCookie.split('=')[1];
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (error) {
    console.error('Error in getAuthHeaders:', error);
  }
  
  return headers;
}

type Coupon = Database['public']['Tables']['coupons']['Row'];

interface CouponStats {
  totalCoupons: number;
  activeCoupons: number;
  usedCoupons: number;
  expiredCoupons: number;
  totalDiscount: string;
  usageRate: string;
}

interface CouponsResponse {
  coupons: Coupon[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  searchTerm?: string;
}

interface CouponsDashboardProps {
  initialCoupons?: Coupon[];
  initialStats?: CouponStats | null;
  initialTotal?: number;
}

const CouponsDashboard = ({ 
  initialCoupons = [],
  initialStats = null,
  initialTotal = 0
}: CouponsDashboardProps) => {
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);
  const [stats, setStats] = useState<CouponStats | null>(initialStats);
  const [loading, setLoading] = useState(initialCoupons.length === 0);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(Math.ceil(initialTotal / 20));
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Fetch coupons
  const fetchCoupons = async (page = 1, search = '', status = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });
      
      if (search) params.append('search', search);
      if (status) params.append('status', status);

      const headers = getAuthHeaders();
      const response = await fetch(`/api/coupons?${params}`, {
        headers,
        credentials: 'include'
      });
      const result = await response.json();

      if (result.success) {
        const data: CouponsResponse = result.data;
        setCoupons(data.coupons);
        setTotalPages(data.totalPages);
        setCurrentPage(data.page);
      } else {
        toast.error('Error al cargar los cupones');
      }
    } catch (error) {
      console.error('Error fetching coupons:', error);
      toast.error('Error al cargar los cupones');
    } finally {
      setLoading(false);
    }
  };

  // Fetch coupon statistics
  const fetchStats = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch('/api/coupons/stats', {
        headers,
        credentials: 'include'
      });
      const result = await response.json();

      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error fetching coupon stats:', error);
    }
  };

  // Delete coupon
  const deleteCoupon = async (couponId: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este cupón?')) {
      return;
    }

    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/coupons/${couponId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include'
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Cupón eliminado correctamente');
        fetchCoupons(currentPage, searchTerm, selectedStatus);
        fetchStats();
      } else {
        toast.error('Error al eliminar el cupón');
      }
    } catch (error) {
      console.error('Error deleting coupon:', error);
      toast.error('Error al eliminar el cupón');
    }
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchCoupons(1, searchTerm, selectedStatus);
  };

  // Handle status filter
  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status);
    setCurrentPage(1);
    fetchCoupons(1, searchTerm, status);
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('es-CL')}`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL');
  };

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'publish':
        return <Badge variant="default" className="bg-green-500">Activo</Badge>;
      case 'draft':
        return <Badge variant="secondary">Borrador</Badge>;
      case 'private':
        return <Badge variant="outline">Privado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Get discount type label
  const getDiscountTypeLabel = (type: string) => {
    switch (type) {
      case 'percent':
        return 'Porcentaje';
      case 'fixed_cart':
        return 'Monto fijo';
      case 'fixed_product':
        return 'Producto fijo';
      default:
        return type;
    }
  };

  // Check if coupon is expired
  const isCouponExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  useEffect(() => {
    // Solo cargar datos si no tenemos datos iniciales
    if (initialCoupons.length === 0) {
      fetchCoupons();
    }
    if (!initialStats) {
      fetchStats();
    }
  }, [initialCoupons.length, initialStats]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Cupones</h1>
          <p className="text-muted-foreground">
            Administra cupones de descuento y promociones
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Crear Cupón
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Cupón</DialogTitle>
              <DialogDescription>
                Complete los campos para crear un nuevo cupón de descuento
              </DialogDescription>
            </DialogHeader>
            <CreateCouponForm 
              onSuccess={() => {
                setIsCreateDialogOpen(false);
                fetchCoupons(currentPage, searchTerm, selectedStatus);
                fetchStats();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cupones</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCoupons}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cupones Activos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeCoupons}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cupones Usados</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.usedCoupons}</div>
              <p className="text-xs text-muted-foreground">
                {stats.usageRate}% de uso
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Descuento Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalDiscount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedStatus === '' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStatusFilter('')}
              >
                Todos
              </Button>
              <Button
                variant={selectedStatus === 'publish' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStatusFilter('publish')}
              >
                Activos
              </Button>
              <Button
                variant={selectedStatus === 'draft' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStatusFilter('draft')}
              >
                Borradores
              </Button>
            </div>

            <div className="flex gap-2">
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  placeholder="Buscar cupones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
                <Button type="submit" size="icon" variant="outline">
                  <Search className="h-4 w-4" />
                </Button>
              </form>
              <Button
                onClick={() => {
                  fetchCoupons(currentPage, searchTerm, selectedStatus);
                  fetchStats();
                }}
                size="icon"
                variant="outline"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Cargando cupones...</span>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descuento</TableHead>
                    <TableHead>Usos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Expira</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded text-sm">
                            {coupon.code}
                          </code>
                          {isCouponExpired(coupon.date_expires) && (
                            <Badge variant="destructive" className="text-xs">
                              Expirado
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate">
                          {coupon.description || 'Sin descripción'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getDiscountTypeLabel(coupon.discount_type)}
                      </TableCell>
                      <TableCell>
                        {coupon.discount_type === 'percent' 
                          ? `${coupon.amount}%` 
                          : formatCurrency(coupon.amount)
                        }
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{coupon.usage_count}</div>
                          {coupon.usage_limit && (
                            <div className="text-muted-foreground">
                              / {coupon.usage_limit}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(coupon.status)}
                      </TableCell>
                      <TableCell>
                        {coupon.date_expires ? (
                          <div className="text-sm">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {formatDate(coupon.date_expires)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Sin límite</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingCoupon(coupon);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteCoupon(coupon.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newPage = currentPage - 1;
                      setCurrentPage(newPage);
                      fetchCoupons(newPage, searchTerm, selectedStatus);
                    }}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  
                  <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newPage = currentPage + 1;
                      setCurrentPage(newPage);
                      fetchCoupons(newPage, searchTerm, selectedStatus);
                    }}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cupón</DialogTitle>
            <DialogDescription>
              Modifique los campos del cupón según sea necesario
            </DialogDescription>
          </DialogHeader>
          {editingCoupon && (
            <EditCouponForm 
              coupon={editingCoupon}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                setEditingCoupon(null);
                fetchCoupons(currentPage, searchTerm, selectedStatus);
                fetchStats();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CouponsDashboard;
