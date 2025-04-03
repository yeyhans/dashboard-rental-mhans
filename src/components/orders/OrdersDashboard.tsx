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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '../ui/sheet';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { Order, LineItem } from '../../types/order';
import type { Product } from '../../types/product';
import { ChevronRight, RefreshCw, Search, FileText, FileCheck, Plus, Trash2 } from 'lucide-react';
import CreateOrderForm from './CreateOrderForm';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

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
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState<NewOrderForm>({
    customer_id: '',
    billing: {
      first_name: '',
      last_name: '',
      company: '',
      email: '',
      phone: '',
      address_1: '',
      city: ''
    },
    metadata: {
      order_proyecto: '',
      order_fecha_inicio: '',
      order_fecha_termino: '',
      num_jornadas: '',
      company_rut: '',
      calculated_subtotal: '0',
      calculated_discount: '0',
      calculated_iva: '0',
      calculated_total: '0'
    },
    line_items: []
  });
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
      const response = await fetch(`/api/woo/get-orders?${params}`);
      const data = await response.json();
      
      if (data.success) {
        console.log('Orders received:', data.data.orders.length);
        console.log('Total pages:', data.data.totalPages);
        console.log('Total orders:', data.data.total);
        
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
    }
    setIsInitialLoad(false);
  }, [currentPage, statusFilter, searchTerm]);

  // Función para recargar los datos
  const refreshData = () => {
    loadOrders(currentPage, statusFilter, searchTerm);
  };

  // No need to filter orders locally as they are filtered on the server
  const filteredOrders = orders;

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

  const OrderDetailsDialog = ({ order }: { order: Order }) => {
    return (
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
              <div className="mt-1 flex items-center gap-2">
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={order.status}
                  onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                  disabled={loading}
                >
                  {Object.entries(statusTranslations).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                )}
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
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium">Información del Cliente</h4>
            </div>
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
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium">Información del Proyecto</h4>
            </div>
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
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium">Productos</h4>
            </div>
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
                      <TableCell className="text-right font-medium">
                        ${formatCurrency(parseFloat(item.price) * item.quantity)}
                      </TableCell>
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
  };

  const handleOrderCreated = (newOrder: Order) => {
    setOrders([newOrder, ...orders]);
    setTotal(total + 1);
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
                    {statusTranslations[order.status] || order.status}
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
                    <a href={`/orders/${order.id}`} className="no-underline">
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
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
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
            
            <div className="flex gap-2 order-1 sm:order-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newPage = Math.max(1, currentPage - 1);
                  setCurrentPage(newPage);
                }}
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
                onClick={() => {
                  const newPage = Math.min(totalPages, currentPage + 1);
                  setCurrentPage(newPage);
                }}
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