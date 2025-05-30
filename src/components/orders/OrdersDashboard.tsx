import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';


import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { Order } from '../../types/order';
import { ChevronRight, RefreshCw, Search, FileText, FileCheck } from 'lucide-react';
import CreateOrderForm from './CreateOrderForm';
import ProcessOrder from "./ProcessOrder";

// Helper function to format currency with thousands separator
const formatCurrency = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Status translations and colors based on WooCommerce
const statusTranslations: { [key: string]: string } = {
  'pending': 'Pendiente',
  'processing': 'En proceso',
  'on-hold': 'En espera',
  'completed': 'Completado',
  'cancelled': 'Cancelado',
  'refunded': 'Reembolsado',
  'failed': 'Fallido',
  'trash': 'Papelera',
  'auto-draft': 'Borrador'
};

const statusColors: { [key: string]: string } = {
  'pending': 'bg-[#f8dda7] text-[#94660c]',
  'processing': 'bg-[#c6e1c6] text-[#5b841b]', 
  'on-hold': 'bg-[#e5e5e5] text-[#777777]',
  'completed': 'bg-[#c8d7e1] text-[#2e4453]',
  'cancelled': 'bg-[#eba3a3] text-[#761919]',
  'refunded': 'bg-[#e5e5e5] text-[#777777]',
  'failed': 'bg-[#eba3a3] text-[#761919]',
  'trash': 'bg-[#e5e5e5] text-[#777777]',
  'auto-draft': 'bg-[#e5e5e5] text-[#777777]'
};

// Payment status colors and text
const paymentStatusColors: { [key: string]: string } = {
  'true': 'bg-[#c6e1c6] text-[#5b841b]',
  'false': 'bg-[#f8dda7] text-[#94660c]'
};

// Payment status text
const paymentStatusText: { [key: string]: string } = {
  'true': 'Pagado',
  'false': 'Pendiente'
};

interface OrdersDashboardProps {
  initialOrders: Order[];
  initialTotal: string;
  initialTotalPages: string;
  initialPage?: string;
  initialStatus?: string;
  initialPerPage?: string;
}

// Interface for new order form
interface NewOrderForm {
  customer_id: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    email: string;
    phone: string;
    address_1: string;
    city: string;
  };
  metadata: {
    order_proyecto: string;
    order_fecha_inicio: string;
    order_fecha_termino: string;
    num_jornadas: string;
    company_rut: string;
    calculated_subtotal: string;
    calculated_discount: string;
    calculated_iva: string;
    calculated_total: string;
  };
  line_items: Array<{
    product_id: string;
    quantity: number;
    sku: string;
    price: string;
    name: string;
  }>;
}

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
  const [isMobileView, setIsMobileView] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

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
  const loadOrders = async (page: number, status: string = '', search: string = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
      });

      if (status) {
        params.append('status', status);
      }

      if (search) {
        params.append('search', search);
      }

      console.log('Fetching orders with params:', params.toString());
      
      // Fetch orders data from both APIs in parallel
      const [wooResponse, wpResponse] = await Promise.all([
        fetch(`/api/woo/get-orders?${params}`),
        fetch(`/api/wp/get-orders?${params}`)
      ]);
      
      const wooData = await wooResponse.json();
      const wpData = await wpResponse.json();
      
      if (wooData.success) {
        console.log('Orders received:', wooData.data.orders.length);
        console.log('Total pages:', wooData.data.totalPages);
        console.log('Total orders:', wooData.data.total);
        
        // Verificar que wpData tenga la estructura correcta
        const wpOrders = wpData.success && wpData.data && Array.isArray(wpData.data.orders) 
          ? wpData.data.orders 
          : [];
        
        // Create a map of WordPress orders by order ID for fast lookup
        const wpOrdersMap: Record<string, any> = {};
        wpOrders.forEach((wpOrder: any) => {
          if (wpOrder.id) {
            wpOrdersMap[wpOrder.id] = wpOrder;
          }
        });
        
        // Merge WordPress data into WooCommerce orders - siguiendo mismo patrón de index.astro
        const mergedOrders = wooData.data.orders.map((order: any) => {
          // Get matching WordPress order data if exists
          const wpOrder = wpOrdersMap[order.id] || {};
          
          // Return merged order with pago_completo from WordPress data
          return {
            ...order,
            fotos_garantia: wpOrder.fotos_garantia || [],
            correo_enviado: wpOrder.correo_enviado || false,
            pago_completo: wpOrder.pago_completo ? 'true' : 'false'
          };
        });
        
        setOrders(mergedOrders);
        setTotal(parseInt(wooData.data.total));
        setTotalPages(parseInt(wooData.data.totalPages));
        
        // Scroll al inicio de la tabla/listado cuando cambia la página
        const tableElement = document.querySelector('.border.overflow-hidden');
        if (tableElement) {
          tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else {
        setError(wooData.message);
      }
    } catch (err) {
      setError('Error al cargar los pedidos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Función para actualizar la URL con los parámetros actuales
  const updateURL = (page: number, status: string = '', search: string = '') => {
    const url = new URL(window.location.href);
    url.searchParams.set('page', page.toString());
    
    if (status) {
      url.searchParams.set('status', status);
    } else {
      url.searchParams.delete('status');
    }
    
    if (search) {
      url.searchParams.set('search', search);
    } else {
      url.searchParams.delete('search');
    }
    
    window.history.pushState({}, '', url.toString());
  };

  // Efecto para cargar datos cuando cambian los filtros o la página
  useEffect(() => {
    if (!isInitialLoad) {
      loadOrders(currentPage, statusFilter, searchTerm);
      updateURL(currentPage, statusFilter, searchTerm);
    } else {
      // Asegurarse de que la URL refleja los valores iniciales en la carga inicial
      updateURL(currentPage, statusFilter, searchTerm);
      setIsInitialLoad(false);
    }
  }, [currentPage, statusFilter, searchTerm]);

  // Función para recargar los datos
  const refreshData = () => {
    loadOrders(currentPage, statusFilter, searchTerm);
  };

  // No need to filter orders locally as they are filtered on the server
  const filteredOrders = orders;

  // Get unique statuses from orders
  const uniqueStatuses = Array.from(new Set(orders.map(order => order.status)));

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Add new function to handle order status updates
  const handleStatusUpdate = async (orderId: number, newStatus: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/woo/update-orders`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: orderId,
          status: newStatus
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Update the order in the local state
        setOrders(orders.map(order => 
          order.id === orderId ? { ...order, status: newStatus } : order
        ));
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error al actualizar el estado del pedido');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Add new function to handle payment status update
  const handleUpdatePaymentStatus = async (orderId: number, currentStatus: string) => {
    try {
      setUpdatingOrderId(orderId);
      // Invert the current status
      const newStatus = currentStatus === 'true' ? 'false' : 'true';
      
      const response = await fetch(`/api/wp/update-order/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pago_completo: newStatus
        })
      });

      if (response.ok) {
        // Update local state
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === orderId 
              ? { ...order, pago_completo: newStatus } 
              : order
          )
        );
        console.log(`Payment status updated for order ${orderId}`);
      } else {
        const errorData = await response.json();
        console.error('Error updating payment status:', errorData);
        setError(`Error updating payment status: ${errorData.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error updating payment status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleOrderCreated = (newOrder: Order) => {
    setOrders([newOrder, ...orders]);
    setTotal(total + 1);
  };

  // Función para manejar el cambio de página
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage && !loading) {
      // Crear una nueva URL con los parámetros actuales
      const url = new URL(window.location.href);
      url.searchParams.set('page', newPage.toString());
      
      if (statusFilter) {
        url.searchParams.set('status', statusFilter);
      } else {
        url.searchParams.delete('status');
      }
      
      if (searchTerm) {
        url.searchParams.set('search', searchTerm);
      } else {
        url.searchParams.delete('search');
      }
      
      // Redirigir a la nueva URL para forzar una recarga completa
      window.location.href = url.toString();
    }
  };

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
      <div className="p-4 bg-destructive/10 text-destructive">
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
                    {statusTranslations[order.status] || order.status}
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
                <div 
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentStatusColors[order.pago_completo]}`}
                  onClick={() => handleUpdatePaymentStatus(order.id, order.pago_completo)}
                  style={{ cursor: 'pointer' }}
                >
                  {paymentStatusText[order.pago_completo]}
                </div>
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
                <a href={`/orders/${order.id}`} className="no-underline w-full block mt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                  >
                    Ver detalles <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    // Desktop view - Table layout
    return (
      <div className="border overflow-hidden">
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
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        onClick={() => setSelectedOrder(order)}
                        variant="ghost"
                        size="sm"
                        className={`${statusColors[order.status] || 'bg-gray-100 text-gray-800'} hover:opacity-80`}
                      >
                        {statusTranslations[order.status] || order.status}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Detalles del Proceso - Orden #{order.id}</DialogTitle>
                      </DialogHeader>
                      <ProcessOrder
                        order={{
                          orders: {
                            success: true,
                            orders: [{
                              id: order.id,
                              status: order.status,
                              date_created: order.date_created,
                              total: order.metadata.calculated_total,
                              customer: {
                                first_name: order.billing.first_name,
                                last_name: order.billing.last_name,
                                email: order.billing.email
                              },
                              fotos_garantia: [],
                              correo_enviado: false,
                              pago_completo: (order.status === 'completed').toString()
                            }]
                          }
                        }}
                      />
                    </DialogContent>
                  </Dialog>
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
                  <div 
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentStatusColors[order.pago_completo]}`}
                    onClick={() => handleUpdatePaymentStatus(order.id, order.pago_completo)}
                    style={{ cursor: 'pointer' }}
                  >
                    {paymentStatusText[order.pago_completo]}
                  </div>
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
                    <a href={`/orders/${order.id}`} className="no-underline" target="_blank">
                      <Button 
                        variant="outline" 
                        size="sm"
                      >
                        Ver detalles
                      </Button>
                    </a>
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
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="search" 
                  placeholder="Buscar por cliente, proyecto, email..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-foreground pl-10"
                />
              </div>
              
              <div className="w-full sm:w-48">
                <select
                  id="status"
                  className="flex h-9 w-full border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">Todos los estados</option>
                  {uniqueStatuses.map(status => (
                    <option key={status} value={status}>{statusTranslations[status] || status}</option>
                  ))}
                </select>
              </div>
              
              <Button 
                className="w-full sm:w-auto" 
                onClick={refreshData}
                disabled={loading}
                variant="outline"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {loading ? 'Actualizando...' : 'Actualizar'}
              </Button>

              <CreateOrderForm onOrderCreated={handleOrderCreated} />
            </div>
          </div>

          {/* Orders table or cards */}
          {renderOrderItems()}

          {/* Pagination */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground order-2 sm:order-1">
              Mostrando {filteredOrders.length} de {total} pedidos
            </div>
            
            <div className="flex flex-wrap justify-center gap-2 order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="px-3"
                aria-label="Página anterior"
              >
                Anterior
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Calculamos las páginas a mostrar
                  let pageToShow;
                  if (totalPages <= 5) {
                    // Si hay 5 o menos páginas, mostramos todas
                    pageToShow = i + 1;
                  } else if (currentPage <= 3) {
                    // Si estamos en las primeras páginas
                    pageToShow = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    // Si estamos en las últimas páginas
                    pageToShow = totalPages - 4 + i;
                  } else {
                    // Estamos en medio, mostramos 2 antes y 2 después
                    pageToShow = currentPage - 2 + i;
                  }

                  return (
                    <Button
                      key={pageToShow}
                      variant={currentPage === pageToShow ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageToShow)}
                      disabled={loading}
                      className="w-9 h-9 hidden sm:flex items-center justify-center"
                      aria-label={`Ir a página ${pageToShow}`}
                      aria-current={currentPage === pageToShow ? "page" : undefined}
                    >
                      {pageToShow}
                    </Button>
                  );
                })}
                
                {/* En móvil mostramos el indicador de página actual */}
                <div className="sm:hidden flex items-center px-3 h-9 border rounded">
                  <span className="text-sm font-medium">
                    {currentPage} / {totalPages}
                  </span>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
                className="px-3"
                aria-label="Página siguiente"
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