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
import type { Order } from '../types/order';

interface AdminDashboardProps {
  initialOrders: Order[];
  initialTotal: string;
  initialTotalPages: string;
  initialPage?: string;
  initialStatus?: string;
  initialPerPage?: string;
}

const statusColors: Record<string, string> = {
  'pending': 'bg-yellow-100 text-yellow-800',
  'processing': 'bg-blue-100 text-blue-800',
  'on-hold': 'bg-purple-100 text-purple-800',
  'completed': 'bg-green-100 text-green-800',
  'cancelled': 'bg-red-100 text-red-800',
  'refunded': 'bg-gray-100 text-gray-800',
  'failed': 'bg-red-100 text-red-800',
  'trash': 'bg-gray-100 text-gray-800',
  'auto-draft': 'bg-gray-100 text-gray-800'
};

const AdminDashboard = ({ 
  initialOrders,
  initialTotal,
  initialTotalPages,
  initialPage = '1',
  initialStatus = '',
  initialPerPage = '10'
}: AdminDashboardProps) => {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [currentPage, setCurrentPage] = useState(parseInt(initialPage));
  const [totalPages, setTotalPages] = useState(parseInt(initialTotalPages));
  const [total, setTotal] = useState(parseInt(initialTotal));
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const perPage = parseInt(initialPerPage);

  // Función para cargar los datos con filtros
  const loadOrders = async (page: number, status: string = '') => {
    try {
      setIsInitialLoad(false);
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
      });

      if (status) {
        params.append('status', status);
      }

      const response = await fetch(`/api/woo/get-orders?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setOrders(data.data.orders);
        setTotal(parseInt(data.data.total));
        setTotalPages(parseInt(data.data.totalPages));
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error al cargar los pedidos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Efecto para cargar datos cuando cambian los filtros o la página
  useEffect(() => {
    if (!isInitialLoad) {
      loadOrders(currentPage, statusFilter);
    }
  }, [currentPage, statusFilter]);

  // Función para recargar los datos
  const refreshData = () => {
    loadOrders(currentPage, statusFilter);
  };

  // Filter orders based on search term and status
  const filteredOrders = orders.filter(order => {
    const searchMatch = 
      order.billing.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.billing.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.metadata.order_proyecto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.billing.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const statusMatch = statusFilter ? order.status === statusFilter : true;
    
    return searchMatch && statusMatch;
  });

  // Get unique statuses from orders
  const uniqueStatuses = [...new Set(orders.map(order => order.status))];

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const OrderDetailsDialog = ({ order }: { order: Order }) => (
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-foreground">Detalles del Pedido</DialogTitle>
        <DialogDescription>
          Información completa del pedido realizado el {formatDate(order.date_created)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Estado y Fechas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-foreground">Estado</Label>
            <div className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
              {order.status}
            </div>
          </div>
          <div>
            <Label className="text-foreground">Fecha de Creación</Label>
            <div className="mt-1 text-foreground">{formatDate(order.date_created)}</div>
          </div>
          <div>
            <Label className="text-foreground">Última Modificación</Label>
            <div className="mt-1 text-foreground">{formatDate(order.date_modified)}</div>
          </div>
        </div>

        {/* Información del Cliente */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-foreground">Información del Cliente</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg">
            <div>
              <Label className="text-foreground">Nombre</Label>
              <div className="mt-1 text-foreground">{order.billing.first_name} {order.billing.last_name}</div>
            </div>
            <div>
              <Label className="text-foreground">Empresa</Label>
              <div className="mt-1 text-foreground">{order.billing.company || '-'}</div>
            </div>
            <div>
              <Label className="text-foreground">Email</Label>
              <div className="mt-1 text-foreground">{order.billing.email}</div>
            </div>
            <div>
              <Label className="text-foreground">Teléfono</Label>
              <div className="mt-1 text-foreground">{order.billing.phone}</div>
            </div>
            <div>
              <Label className="text-foreground">Dirección</Label>
              <div className="mt-1 text-foreground">{order.billing.address_1}</div>
            </div>
            <div>
              <Label className="text-foreground">Ciudad</Label>
              <div className="mt-1 text-foreground">{order.billing.city}</div>
            </div>
          </div>
        </div>

        {/* Información del Proyecto */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-foreground">Información del Proyecto</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg">
            <div>
              <Label className="text-foreground">Proyecto</Label>
              <div className="mt-1 text-foreground">{order.metadata.order_proyecto}</div>
            </div>
            <div>
              <Label className="text-foreground">RUT Empresa</Label>
              <div className="mt-1 text-foreground">{order.metadata.company_rut}</div>
            </div>
            <div>
              <Label className="text-foreground">Fecha Inicio</Label>
              <div className="mt-1 text-foreground">{order.metadata.order_fecha_inicio}</div>
            </div>
            <div>
              <Label className="text-foreground">Fecha Término</Label>
              <div className="mt-1 text-foreground">{order.metadata.order_fecha_termino}</div>
            </div>
            <div>
              <Label className="text-foreground">Número de Jornadas</Label>
              <div className="mt-1 text-foreground">{order.metadata.num_jornadas}</div>
            </div>
          </div>
        </div>

        {/* Productos */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-foreground">Productos</h4>
          <div className="bg-card p-4 rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">Producto</TableHead>
                  <TableHead className="text-foreground">SKU</TableHead>
                  <TableHead className="text-foreground">Cantidad</TableHead>
                  <TableHead className="text-foreground">Precio</TableHead>
                  <TableHead className="text-foreground">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.line_items.map((item, index) => (
                  <TableRow key={`${item.product_id}-${index}`}>
                    <TableCell className="text-foreground">
                      <div className="flex items-center gap-2">
                        {item.image && (
                          <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded" />
                        )}
                        <span>{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">{item.sku}</TableCell>
                    <TableCell className="text-foreground">{item.quantity}</TableCell>
                    <TableCell className="text-foreground">${item.price}</TableCell>
                    <TableCell className="text-foreground">${parseFloat(item.price.toString()) * item.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Resumen de Costos */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-foreground">Resumen de Costos</h4>
          <div className="bg-card p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-foreground">
              <span>Subtotal</span>
              <span>${order.metadata.calculated_subtotal}</span>
            </div>
            <div className="flex justify-between text-foreground">
              <span>Descuento</span>
              <span>${order.metadata.calculated_discount}</span>
            </div>
            <div className="flex justify-between text-foreground">
              <span>IVA</span>
              <span>${order.metadata.calculated_iva}</span>
            </div>
            <div className="flex justify-between font-bold text-foreground">
              <span>Total</span>
              <span>${order.metadata.calculated_total}</span>
            </div>
          </div>
        </div>

        {/* Enlaces a PDFs */}
        <div className="space-y-2">
          {order.metadata.pdf_on_hold_url && (
            <div>
              <a 
                href={order.metadata.pdf_on_hold_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80"
              >
                Ver PDF de Presupuesto
              </a>
            </div>
          )}
          {order.metadata.pdf_processing_url && (
            <div>
              <a 
                href={order.metadata.pdf_processing_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80"
              >
                Ver PDF de Contrato
              </a>
            </div>
          )}
        </div>
      </div>
    </DialogContent>
  );

  if (loading && !isInitialLoad) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2 text-foreground">Cargando pedidos...</p>
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
          <CardTitle className="text-foreground">Pedidos</CardTitle>
          <CardDescription>
            Gestiona y visualiza todos los pedidos ({total} en total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="search" className="mb-2 text-foreground">Buscar</Label>
              <Input 
                id="search" 
                placeholder="Buscar por cliente, proyecto, email..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-foreground"
              />
            </div>
            <div className="w-full sm:w-48">
              <Label htmlFor="status" className="mb-2 text-foreground">Estado</Label>
              <select
                id="status"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1); // Reset to first page when filter changes
                }}
              >
                <option value="">Todos</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
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

          {/* Orders table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">Estado</TableHead>
                  <TableHead className="text-foreground">Cliente</TableHead>
                  <TableHead className="text-foreground">Proyecto</TableHead>
                  <TableHead className="text-foreground">Fecha</TableHead>
                  <TableHead className="text-foreground">Total</TableHead>
                  <TableHead className="text-right text-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => (
                    <TableRow key={`${order.customer_id}-${order.date_created}`}>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                          {order.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-foreground">
                        <div className="font-medium">{order.billing.first_name} {order.billing.last_name}</div>
                        <div className="text-sm text-muted-foreground">{order.billing.email}</div>
                      </TableCell>
                      <TableCell className="text-foreground">{order.metadata.order_proyecto}</TableCell>
                      <TableCell className="text-foreground">{formatDate(order.date_created)}</TableCell>
                      <TableCell className="text-foreground">${order.metadata.calculated_total}</TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                              Ver detalles
                            </Button>
                          </DialogTrigger>
                          {selectedOrder && <OrderDetailsDialog order={selectedOrder} />}
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      No se encontraron pedidos
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Mostrando {orders.length} de {total} pedidos
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
                disabled={currentPage === totalPages || loading}
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

export default AdminDashboard;