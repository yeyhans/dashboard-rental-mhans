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
import { ChevronRight, RefreshCw, Search, FileText, FileCheck } from 'lucide-react';

// Helper function to format currency with thousands separator
const formatCurrency = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

interface OrdersDashboardProps {
  initialOrders: Order[];
  initialTotal: string;
  initialTotalPages: string;
  initialPage?: string;
  initialStatus?: string;
  initialPerPage?: string;
}

const statusColors: Record<string, string> = {
  'pending': 'bg-yellow-200 text-yellow-900',
  'processing': 'bg-blue-200 text-blue-900',
  'on-hold': 'bg-purple-200 text-purple-900',
  'completed': 'bg-green-200 text-green-900',
  'cancelled': 'bg-red-200 text-red-900',
  'refunded': 'bg-gray-200 text-gray-900',
  'failed': 'bg-red-200 text-red-900',
  'trash': 'bg-gray-200 text-gray-900',
  'auto-draft': 'bg-gray-200 text-gray-900'
};

const OrdersDashboard = ({ 
  initialOrders,
  initialTotal,
  initialTotalPages,
  initialPage = '1',
  initialStatus = '',
  initialPerPage = '10'
}: OrdersDashboardProps) => {
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
  const [isMobileView, setIsMobileView] = useState(false);
  const perPage = parseInt(initialPerPage);

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
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] md:w-auto p-4 md:p-6">
      <DialogHeader>
        <DialogTitle className="text-xl">Detalles del Pedido</DialogTitle>
        <DialogDescription>
          Información completa del pedido realizado el {formatDate(order.date_created)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Estado y Fechas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="font-medium">Estado</Label>
            <div className={`mt-1 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
              {order.status}
            </div>
          </div>
          <div>
            <Label className="font-medium">Fecha de Creación</Label>
            <div className="mt-1">{formatDate(order.date_created)}</div>
          </div>
          <div>
            <Label className="font-medium">Última Modificación</Label>
            <div className="mt-1">{formatDate(order.date_modified)}</div>
          </div>
        </div>

        {/* Información del Cliente */}
        <div>
          <h4 className="text-sm font-medium mb-2">Información del Cliente</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
            <div>
              <Label className="font-medium">Nombre</Label>
              <div className="mt-1">{order.billing.first_name} {order.billing.last_name}</div>
            </div>
            <div>
              <Label className="font-medium">Empresa</Label>
              <div className="mt-1">{order.billing.company || '-'}</div>
            </div>
            <div>
              <Label className="font-medium">Email</Label>
              <div className="mt-1 break-words">{order.billing.email}</div>
            </div>
            <div>
              <Label className="font-medium">Teléfono</Label>
              <div className="mt-1">{order.billing.phone}</div>
            </div>
            <div>
              <Label className="font-medium">Dirección</Label>
              <div className="mt-1">{order.billing.address_1}</div>
            </div>
            <div>
              <Label className="font-medium">Ciudad</Label>
              <div className="mt-1">{order.billing.city}</div>
            </div>
          </div>
        </div>

        {/* Información del Proyecto */}
        <div>
          <h4 className="text-sm font-medium mb-2">Información del Proyecto</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
            <div>
              <Label className="font-medium">Proyecto</Label>
              <div className="mt-1">{order.metadata.order_proyecto}</div>
            </div>
            <div>
              <Label className="font-medium">RUT Empresa</Label>
              <div className="mt-1">{order.metadata.company_rut}</div>
            </div>
            <div>
              <Label className="font-medium">Fecha Inicio</Label>
              <div className="mt-1">{order.metadata.order_fecha_inicio}</div>
            </div>
            <div>
              <Label className="font-medium">Fecha Término</Label>
              <div className="mt-1">{order.metadata.order_fecha_termino}</div>
            </div>
            <div>
              <Label className="font-medium">Número de Jornadas</Label>
              <div className="mt-1">{order.metadata.num_jornadas}</div>
            </div>
          </div>
        </div>

        {/* Productos */}
        <div>
          <h4 className="text-sm font-medium mb-2">Productos</h4>
          <div className="bg-card p-4 rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Producto</TableHead>
                  <TableHead className="font-semibold">SKU</TableHead>
                  <TableHead className="font-semibold text-center">Cant.</TableHead>
                  <TableHead className="font-semibold text-right">Precio</TableHead>
                  <TableHead className="font-semibold text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.line_items.map((item, index) => (
                  <TableRow key={`${item.product_id}-${index}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {item.image && (
                          <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded" />
                        )}
                        <span>{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">${formatCurrency(item.price)}</TableCell>
                    <TableCell className="text-right font-medium">${formatCurrency(parseFloat(item.price.toString()) * item.quantity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Resumen de Costos */}
        <div>
          <h4 className="text-sm font-medium mb-2">Resumen de Costos</h4>
          <div className="bg-card p-4 rounded-lg border space-y-2">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${formatCurrency(order.metadata.calculated_subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Descuento</span>
              <span>${formatCurrency(order.metadata.calculated_discount)}</span>
            </div>
            <div className="flex justify-between">
              <span>IVA</span>
              <span>${formatCurrency(order.metadata.calculated_iva)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>${formatCurrency(order.metadata.calculated_total)}</span>
            </div>
          </div>
        </div>

        {/* Enlaces a PDFs */}
        <div className="space-y-2">
          {order.metadata.pdf_on_hold_url && (
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => window.open(order.metadata.pdf_on_hold_url, '_blank')}
            >
              Ver PDF de Presupuesto
            </Button>
          )}
          {order.metadata.pdf_processing_url && (
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => window.open(order.metadata.pdf_processing_url, '_blank')}
            >
              Ver PDF de Contrato
            </Button>
          )}
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
          <p className="mt-2 text-foreground">Cargando pedidos...</p>
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

  // Render the table rows or mobile cards for each order
  const renderOrderItems = () => {
    if (filteredOrders.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No se encontraron pedidos
        </div>
      );
    }

    // Mobile view - Card layout
    if (isMobileView) {
      return (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={`${order.customer_id}-${order.date_created}`} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                    {order.status}
                  </span>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">{formatDate(order.date_created)}</div>
                  </div>
                </div>
                
                <h3 className="font-semibold text-foreground text-lg mb-1">{order.billing.first_name} {order.billing.last_name}</h3>
                <p className="text-sm text-muted-foreground mb-2">{order.billing.email}</p>
                
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Proyecto</p>
                    <p className="text-sm font-medium text-foreground truncate">{order.metadata.order_proyecto}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-bold text-foreground">${formatCurrency(order.metadata.calculated_total)}</p>
                  </div>
                </div>
                
                <div className="mt-2 flex gap-2">
                  {order.metadata.pdf_on_hold_url && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="flex-1 bg-blue-200 text-blue-900 hover:bg-blue-300"
                      onClick={() => window.open(order.metadata.pdf_on_hold_url, '_blank')}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  )}
                  {order.metadata.pdf_processing_url && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="flex-1 bg-green-200 text-green-900 hover:bg-green-300"
                      onClick={() => window.open(order.metadata.pdf_processing_url, '_blank')}
                    >
                      <FileCheck className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setSelectedOrder(order)}>
                      Ver detalles <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </DialogTrigger>
                  {selectedOrder && <OrderDetailsDialog order={selectedOrder} />}
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
              <TableHead className="text-foreground font-semibold">Estado</TableHead>
              <TableHead className="text-foreground font-semibold">Cliente</TableHead>
              <TableHead className="text-foreground font-semibold">Proyecto</TableHead>
              <TableHead className="text-foreground font-semibold">Fecha</TableHead>
              <TableHead className="text-foreground font-semibold text-right">Total</TableHead>
              <TableHead className="text-right text-foreground font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.map((order) => (
              <TableRow key={`${order.customer_id}-${order.date_created}`}>
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                    {order.status}
                  </span>
                </TableCell>
                <TableCell className="text-foreground">
                  <div className="font-medium">{order.billing.first_name} {order.billing.last_name}</div>
                  <div className="text-sm text-muted-foreground">{order.billing.email}</div>
                </TableCell>
                <TableCell className="text-foreground font-medium">{order.metadata.order_proyecto}</TableCell>
                <TableCell className="text-foreground">{formatDate(order.date_created)}</TableCell>
                <TableCell className="text-foreground text-right font-bold">${formatCurrency(order.metadata.calculated_total)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-row gap-2 justify-end">
                    {order.metadata.pdf_on_hold_url && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="bg-blue-200 text-blue-900 hover:bg-blue-300"
                        onClick={() => window.open(order.metadata.pdf_on_hold_url, '_blank')}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                    {order.metadata.pdf_processing_url && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="bg-green-200 text-green-900 hover:bg-green-300"
                        onClick={() => window.open(order.metadata.pdf_processing_url, '_blank')}
                      >
                        <FileCheck className="h-4 w-4" />
                      </Button>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                          Ver detalles
                        </Button>
                      </DialogTrigger>
                      {selectedOrder && <OrderDetailsDialog order={selectedOrder} />}
                    </Dialog>
                  </div>
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
          <CardTitle className="text-foreground text-xl">Pedidos</CardTitle>
          <CardDescription>
            Gestiona y visualiza todos los pedidos ({total} en total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                id="search" 
                placeholder="Buscar por cliente, proyecto, email..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-foreground pl-10"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="w-full sm:flex-1">
                <select
                  id="status"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1); // Reset to first page when filter changes
                  }}
                >
                  <option value="">Todos los estados</option>
                  {uniqueStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
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

          {/* Orders table or cards */}
          {renderOrderItems()}

          {/* Pagination */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground order-2 sm:order-1">
              Mostrando {filteredOrders.length} de {total} pedidos
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

export default OrdersDashboard;