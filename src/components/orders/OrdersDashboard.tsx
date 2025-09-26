import React, { useState, useEffect } from 'react';
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


interface SessionData {
  access_token: string;
  user: any; // Usar any para compatibilidad con el tipo User de Supabase
}

interface OrdersDashboardProps {
  initialOrders: Order[];
  initialTotal: string;
  sessionData: SessionData;
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
  sessionData
}: OrdersDashboardProps) => {
  // All orders loaded from server
  const [allOrders, setAllOrders] = useState<Order[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isMobileView, setIsMobileView] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [total, setTotal] = useState(parseInt(initialTotal));

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

  // Filter orders based on search and status
  const filteredOrders = React.useMemo(() => {
    return allOrders.filter(order => {
      // Filter by search term
      const matchesSearch = !searchTerm || 
        (order.billing?.first_name && order.billing.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order.billing?.last_name && order.billing.last_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order.billing?.email && order.billing.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order.metadata?.order_proyecto && order.metadata.order_proyecto.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order.id && order.id.toString().includes(searchTerm));
      
      // Filter by status
      const matchesStatus = !statusFilter || order.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [allOrders, searchTerm, statusFilter]);

  // Calculate pagination
  const totalFilteredOrders = filteredOrders.length;
  const totalPages = Math.ceil(totalFilteredOrders / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // Initialize filters from URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    const statusParam = urlParams.get('status');
    const searchParam = urlParams.get('search');
    
    if (pageParam) {
      const page = parseInt(pageParam);
      if (page > 0) setCurrentPage(page);
    }
    if (statusParam) setStatusFilter(statusParam);
    if (searchParam) setSearchTerm(searchParam);
  }, []);

  // Reset page when search or status changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);


  // Get unique statuses from filtered orders
  const uniqueStatuses = Array.from(new Set(allOrders.map(order => order.status)));

  // Function to refresh data (placeholder for future implementation)
  const refreshData = () => {
    // For now, this is a placeholder since we're using static data
    // In a real implementation, this would reload data from the server
    console.log('Refreshing data...');
  };

  // Function to update URL with current filters
  const updateURLWithFilters = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('page', currentPage.toString());
    
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
    
    window.history.pushState({}, '', url.toString());
  };

  // Update URL when filters change
  useEffect(() => {
    updateURLWithFilters();
  }, [currentPage, statusFilter, searchTerm]);

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
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Update the order in the local state
        setAllOrders(allOrders.map((order: Order) => 
          order.id === orderId ? { ...order, status: newStatus } : order
        ));
      } else {
        setError(data.error || 'Error al actualizar el estado del pedido');
      }
    } catch (err) {
      setError('Error al actualizar el estado del pedido');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  const handleOrderCreated = (newOrder: any) => {
    // Transform the new order to match the expected structure
    const transformedOrder: Order = {
      ...newOrder,
      // Create metadata object from direct properties for backward compatibility
      metadata: {
        order_proyecto: newOrder.order_proyecto || '',
        order_fecha_inicio: newOrder.order_fecha_inicio || '',
        order_fecha_termino: newOrder.order_fecha_termino || '',
        num_jornadas: newOrder.num_jornadas?.toString() || '',
        calculated_subtotal: newOrder.calculated_subtotal?.toString() || '0',
        calculated_discount: newOrder.calculated_discount?.toString() || '0',
        calculated_iva: newOrder.calculated_iva?.toString() || '0',
        calculated_total: newOrder.calculated_total?.toString() || '0',
        company_rut: newOrder.company_rut || '',
        pdf_on_hold_url: newOrder.pdf_on_hold_url || '',
        pdf_processing_url: newOrder.pdf_processing_url || '',
        order_retire_name: newOrder.order_retire_name || '',
        order_retire_rut: newOrder.order_retire_rut || '',
        order_retire_phone: newOrder.order_retire_phone || '',
        order_comments: newOrder.order_comments || ''
      },
      // Create billing object from direct properties
      billing: {
        first_name: newOrder.billing_first_name || '',
        last_name: newOrder.billing_last_name || '',
        company: newOrder.billing_company || '',
        address_1: newOrder.billing_address_1 || '',
        city: newOrder.billing_city || '',
        email: newOrder.billing_email || '',
        phone: newOrder.billing_phone || ''
      },
      // Set default values for missing properties
      fotos_garantia: newOrder.fotos_garantia || [],
      correo_enviado: newOrder.correo_enviado || false,
      pago_completo: newOrder.pago_completo || false
    };

    setAllOrders([transformedOrder, ...allOrders]);
    setTotal(total + 1);
  };

  // Función para manejar el cambio de página
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage && !loading) {
      setCurrentPage(newPage);
    }
  };

  // Render loading state
  if (loading) {
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
          {currentOrders.map((order) => (
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
                    <p className="text-sm font-medium text-foreground truncate">{order.metadata?.order_proyecto || ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-bold text-foreground">${formatCurrency(order.metadata?.calculated_total || '0')}</p>
                  </div>
                </div>
                
                <div className="mt-2 flex gap-2">

                  {order.metadata?.pdf_on_hold_url && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="flex-1 bg-blue-200 text-blue-900 hover:bg-blue-300"
                      onClick={() => window.open(order.metadata.pdf_on_hold_url, '_blank')}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  )}
                  {order.metadata?.pdf_processing_url && (
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
            {currentOrders.map((order) => (
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
                              total: order.metadata?.calculated_total || '0',
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
                <TableCell className="text-foreground font-medium">{order.metadata?.order_proyecto || ''}</TableCell>
                <TableCell className="text-foreground">{formatDate(order.date_created)}</TableCell>
                <TableCell className="text-foreground text-right font-bold">${formatCurrency(order.metadata?.calculated_total || '0')}</TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-row gap-2 justify-end">
                    {order.metadata?.pdf_on_hold_url && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="bg-blue-200 text-blue-900 hover:bg-blue-300"
                        onClick={() => window.open(order.metadata.pdf_on_hold_url, '_blank')}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                    {order.metadata?.pdf_processing_url && (
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
                  onChange={(e) => setStatusFilter(e.target.value)}
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

              <CreateOrderForm onOrderCreated={handleOrderCreated} sessionData={sessionData} />
            </div>
          </div>

          {/* Orders table or cards */}
          {renderOrderItems()}

          {/* Pagination */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground order-2 sm:order-1">
              Mostrando {Math.min(startIndex + 1, totalFilteredOrders)}-{Math.min(endIndex, totalFilteredOrders)} de {totalFilteredOrders} pedidos filtrados ({total} total)
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