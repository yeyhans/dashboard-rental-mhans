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
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import type { Order } from '../../types/order';
import { RefreshCw, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

// Helper function to format currency with thousands separator
const formatCurrency = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Payment status colors
const paymentStatusColors: { [key: string]: string } = {
  'true': 'bg-[#c6e1c6] text-[#5b841b]',
  'false': 'bg-[#f8dda7] text-[#94660c]'
};

// Payment status text
const paymentStatusText: { [key: string]: string } = {
  'true': 'Pagado',
  'false': 'Pendiente'
};

interface PaymentsTableProps {
  initialOrders: Order[];
  initialTotal: string;
  initialStatus?: string;
}

const PaymentsTable = ({ 
  initialOrders,
  initialTotal
}: PaymentsTableProps) => {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [total, setTotal] = useState(parseInt(initialTotal));
  const [editableFields, setEditableFields] = useState<{[key: string]: {oc?: string, factura?: string}}>(() => {
    // Inicializar campos editables con los datos iniciales
    const initialEditableFields: {[key: string]: {oc?: string, factura?: string}} = {};
    initialOrders.forEach((order: any) => {
      initialEditableFields[order.id] = {
        oc: order.orden_compra || '',
        factura: order.numero_factura || ''
      };
    });
    return initialEditableFields;
  }); 
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'client' | 'status' | 'id'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20); // Items per page

  // Calculate total pages
  const totalPages = Math.ceil(total / pageSize);

  // Actualizar la URL para reflejar los filtros actuales
  const updateURL = (status: string = '', search: string = '', sortBy: string = 'date', sortDirection: string = 'desc', page: number = 1) => {
    const url = new URL(window.location.href);
    
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
    
    url.searchParams.set('sortBy', sortBy);
    url.searchParams.set('sortDirection', sortDirection);
    url.searchParams.set('page', page.toString());
    
    window.history.pushState({}, '', url.toString());
  };

  // Función para cargar los datos con filtros
  const loadOrders = async (status: string = '', search: string = '', sortByParam: string = sortBy, sortDirectionParam: string = sortDirection, page: number = currentPage) => {
    try {
      setLoading(true);
      setError(null); // Limpiar errores previos
      const params = new URLSearchParams();

      if (status) {
        params.append('status', status);
      }

      if (search) {
        params.append('search', search);
      }
      
      // Add pagination parameters
      params.append('page', page.toString());
      params.append('per_page', pageSize.toString());
      
      // Fetch orders data from both APIs in parallel
      const [wooResponse, wpResponse] = await Promise.all([
        fetch(`/api/woo/get-orders?${params}`),
        fetch(`/api/wp/get-orders?${params}`)
      ]);
      
      if (!wooResponse.ok) {
        throw new Error('Error al obtener datos de WooCommerce');
      }
      
      if (!wpResponse.ok) {
        throw new Error('Error al obtener datos de WordPress');
      }
      
      const wooData = await wooResponse.json();
      const wpData = await wpResponse.json();
      
      if (wooData.success) {
        // Verificar que wpData tenga la estructura correcta
        const wpOrders = wpData.success && wpData.data && Array.isArray(wpData.data.orders) 
          ? wpData.data.orders 
          : [];
        
        // Create a map of WordPress orders by order ID for fast lookup
        const wpOrdersMap: Record<string, any> = {};
        wpOrders.forEach((wpOrder: any) => {
          if (wpOrder.id) {
            // Asegurar que el ID se maneje como número para comparaciones consistentes
            const orderId = typeof wpOrder.id === 'string' ? parseInt(wpOrder.id, 10) : wpOrder.id;
            wpOrdersMap[orderId] = wpOrder;
          }
        });

        console.log(wpData);
        
        // Merge WordPress data into WooCommerce orders
        const mergedOrders = wooData.data.orders.map((order: any) => {
          // Asegurar que el ID se maneje como número para comparaciones consistentes
          const orderId = typeof order.id === 'string' ? parseInt(order.id, 10) : order.id;
          
          // Get matching WordPress order data if exists
          const wpOrder = wpOrdersMap[orderId] || {};
          
          return {
            ...order,
            id: orderId, // Asegurar que el ID sea consistente
            fotos_garantia: wpOrder.fotos_garantia || [],
            correo_enviado: wpOrder.correo_enviado || false,
            pago_completo: wpOrder.pago_completo || 'false',
            orden_compra: wpOrder.orden_compra || '',
            numero_factura: wpOrder.numero_factura || ''
          };
        });
        
        // Ordenar en frontend según sortBy y sortDirection
        let mergedSortedOrders = [...mergedOrders];
        mergedSortedOrders.sort((a: Order, b: Order) => {
          let aValue: any, bValue: any;
          switch (sortByParam) {
            case 'client':
              aValue = a.billing?.company || `${a.billing?.first_name} ${a.billing?.last_name}`;
              bValue = b.billing?.company || `${b.billing?.first_name} ${b.billing?.last_name}`;
              break;
            case 'status':
              // Convert pago_completo to number for logical sorting: 'true' -> 1, 'false' -> 0
              aValue = a.pago_completo === 'true' ? 1 : 0;
              bValue = b.pago_completo === 'true' ? 1 : 0;
              break;
            case 'date':
              aValue = a.date_created;
              bValue = b.date_created;
              break;
            case 'id':
              aValue = a.id;
              bValue = b.id;
              break;
            default:
              aValue = a.id;
              bValue = b.id;
          }
          if (aValue === undefined || aValue === null) aValue = '';
          if (bValue === undefined || bValue === null) bValue = '';
          if (sortByParam === 'id') {
            return sortDirectionParam === 'asc' ? aValue - bValue : bValue - aValue;
          }
          if (sortByParam === 'date') {
            return sortDirectionParam === 'asc'
              ? new Date(aValue).getTime() - new Date(bValue).getTime()
              : new Date(bValue).getTime() - new Date(aValue).getTime();
          }
          // For status, compare as numbers
          if (sortByParam === 'status') {
            return sortDirectionParam === 'asc' ? aValue - bValue : bValue - aValue;
          }
          // String comparison
          if (aValue < bValue) return sortDirectionParam === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortDirectionParam === 'asc' ? 1 : -1;
          return 0;
        });
        setOrders(mergedSortedOrders);
        setTotal(parseInt(wooData.data.total));
        
        // Initialize editable fields
        const initialEditableFields: {[key: string]: {oc?: string, factura?: string}} = {};
        mergedOrders.forEach((order: any) => {
          initialEditableFields[order.id] = {
            oc: order.orden_compra || '',
            factura: order.numero_factura || ''
          };
        });
        setEditableFields(initialEditableFields);
        
        updateURL(status, search, sortByParam, sortDirectionParam, page);
      } else {
        setError('Error al cargar datos de WooCommerce');
      }
    } catch (err) {
      console.error('Error loading orders:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  // Efecto para cargar todos los datos al montar el componente
  useEffect(() => {
    // Solo cargar datos si no hay datos iniciales o si están vacíos
    if (initialOrders.length === 0) {
      loadOrders('', '', sortBy, sortDirection, currentPage);
    } else {
      // Si tenemos datos iniciales, aplicar el ordenamiento
      let sortedOrders = [...initialOrders];
      sortedOrders.sort((a: Order, b: Order) => {
        let aValue: any, bValue: any;
        switch (sortBy) {
          case 'client':
            aValue = a.billing?.company || `${a.billing?.first_name} ${a.billing?.last_name}`;
            bValue = b.billing?.company || `${b.billing?.first_name} ${b.billing?.last_name}`;
            break;
          case 'status':
            aValue = a.pago_completo === 'true' ? 1 : 0;
            bValue = b.pago_completo === 'true' ? 1 : 0;
            break;
          case 'date':
            aValue = a.date_created;
            bValue = b.date_created;
            break;
          case 'id':
            aValue = a.id;
            bValue = b.id;
            break;
          default:
            aValue = a.id;
            bValue = b.id;
        }
        if (aValue === undefined || aValue === null) aValue = '';
        if (bValue === undefined || bValue === null) bValue = '';
        if (sortBy === 'id') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        if (sortBy === 'date') {
          return sortDirection === 'asc'
            ? new Date(aValue).getTime() - new Date(bValue).getTime()
            : new Date(bValue).getTime() - new Date(aValue).getTime();
        }
        if (sortBy === 'status') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
      setOrders(sortedOrders);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo ejecutar al montar

  // Efecto para cargar los datos cuando cambian los filtros
  useEffect(() => {
    loadOrders('', searchTerm, sortBy, sortDirection, currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortDirection, currentPage]);

  const refreshData = () => {
    loadOrders('', searchTerm, sortBy, sortDirection, currentPage);
  };

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleFirstPage = () => handlePageChange(1);
  const handleLastPage = () => handlePageChange(totalPages);
  const handlePreviousPage = () => handlePageChange(currentPage - 1);
  const handleNextPage = () => handlePageChange(currentPage + 1);

  // Generate page numbers for pagination controls
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages around current page
      let start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      let end = Math.min(totalPages, start + maxVisiblePages - 1);
      
      // Adjust start if we're near the end
      if (end === totalPages) {
        start = Math.max(1, end - maxVisiblePages + 1);
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  // Manejar cambios en campos editables
  const handleFieldChange = (orderId: number, field: 'oc' | 'factura', value: string) => {
    setEditableFields(prev => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value
      }
    }));
  };

  // Actualizar el estado de pago de una orden
  const handleUpdatePaymentStatus = async (orderId: number, currentStatus: string) => {
    try {
      setUpdatingOrderId(orderId);
      // Invertir el estado actual
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
        // Actualizar el estado local
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === orderId 
              ? { ...order, pago_completo: newStatus } 
              : order
          )
        );
        console.log(`Estado de pago actualizado para la orden ${orderId}`);
      } else {
        const errorData = await response.json();
        console.error('Error al actualizar estado de pago:', errorData);
        setError(`Error al actualizar estado de pago: ${errorData.message || 'Error desconocido'}`);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error al actualizar estado de pago');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Guardar cambios en los campos OC y Factura
  const saveFieldChanges = async (orderId: number) => {
    try {
      setUpdatingOrderId(orderId);
      const orderFields = editableFields[orderId];
      
      if (!orderFields) {
        console.error('No se encontraron campos editables para esta orden');
        return;
      }

      // Encontrar orden actual para mantener estado pago_completo
      const currentOrder = orders.find(order => order.id === orderId);
      if (!currentOrder) {
        console.error('No se encontró la orden actual');
        return;
      }

      // Usar pago_completo como el campo principal que WordPress acepta
      // y pasar orden_compra y numero_factura como metadatos adicionales
      const response = await fetch(`/api/wp/update-order/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pago_completo: currentOrder.pago_completo, // Mantener el valor actual
          orden_compra: orderFields.oc || '',
          numero_factura: orderFields.factura || ''
        })
      });

          if (response.ok) {
      const ocValue = orderFields.oc || '';
      const facturaValue = orderFields.factura || '';
      
      // Actualizar el estado local de órdenes
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { 
                ...order, 
                orden_compra: ocValue,
                numero_factura: facturaValue
              } 
            : order
        )
      );
      
      // También actualizar el estado de campos editables para que se refleje en la UI
      setEditableFields(prev => ({
        ...prev,
        [orderId]: {
          ...prev[orderId],
          oc: ocValue,
          factura: facturaValue
        }
      }));
      
      console.log(`Campos actualizados para la orden ${orderId}`);
      } else {
        const errorData = await response.json();
        console.error('Error al guardar campos:', errorData);
        setError(`Error al guardar campos: ${errorData.message || 'Error desconocido'}`);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error al guardar campos');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page when searching
    loadOrders('', searchTerm, sortBy, sortDirection, 1);
  };

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Tabla de Pagos</CardTitle>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={refreshData}
                disabled={loading}
                title="Actualizar datos"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Buscar por cliente o proyecto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              <Button type="submit" size="icon" variant="ghost">
                <Search className="h-4 w-4" />
              </Button>
            </form>
          </div>

          {error && <div className="text-red-500 mb-4">{error}</div>}
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Cliente</TableHead>
                  <TableHead>ID Orden</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>OC</TableHead>
                  <TableHead>N° Factura</TableHead>
                  <TableHead>Estado Pago</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4">
                      {loading ? 'Cargando...' : 'No se encontraron órdenes'}
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.billing?.company || `${order.billing?.first_name} ${order.billing?.last_name}`}
                      </TableCell>
                      <TableCell>
                        <a 
                          href={`/orders/${order.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
                          tabIndex={0}
                          aria-label={`Ver detalles de la orden ${order.id}`}
                        >
                          {order.id}
                        </a>
                      </TableCell>
                      <TableCell>{order.metadata?.order_proyecto || '-'}</TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">
                              ${formatCurrency(order.metadata?.calculated_total || '0')}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Subtotal: ${formatCurrency(order.metadata?.calculated_subtotal || '0')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editableFields[order.id]?.oc || ''}
                          onChange={(e) => handleFieldChange(order.id, 'oc', e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editableFields[order.id]?.factura || ''}
                          onChange={(e) => handleFieldChange(order.id, 'factura', e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <div 
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentStatusColors[order.pago_completo]}`}
                          onClick={() => handleUpdatePaymentStatus(order.id, order.pago_completo)}
                          style={{ cursor: 'pointer' }}
                        >
                          {paymentStatusText[order.pago_completo]}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {order.metadata?.pdf_processing_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(order.metadata.pdf_processing_url, '_blank')}
                              title="Ver PDF"
                            >
                              Ver PDF
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => saveFieldChanges(order.id)}
                            disabled={updatingOrderId === order.id}
                          >
                            {updatingOrderId === order.id ? 'Guardando...' : 'Guardar'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Información de resultados */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Mostrando {orders.length} de {total} resultados
              {totalPages > 1 && (
                <span className="ml-2">
                  (Página {currentPage} de {totalPages})
                </span>
              )}
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleFirstPage}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {getPageNumbers().map((page) => (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLastPage}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default PaymentsTable; 