import { useState, useEffect, useMemo } from 'react';
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
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

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

// Helper function to get payment status key from boolean
const getPaymentStatusKey = (status: boolean | string): string => {
  if (typeof status === 'boolean') {
    return status ? 'true' : 'false';
  }
  return status === 'true' ? 'true' : 'false';
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
  // State for all orders (never changes after initial load)
  const [allOrders] = useState<Order[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
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
  
  // Client-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20); // Items per page

  // Filter and sort orders on the client side
  const filteredAndSortedOrders = useMemo(() => {
    let filtered = allOrders;
    
    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = allOrders.filter(order => {
        const client = (order.billing_company || `${order.billing_first_name} ${order.billing_last_name}`).toLowerCase();
        const project = (order.order_proyecto || '').toLowerCase();
        const orderId = order.id.toString();
        
        return client.includes(searchLower) || 
               project.includes(searchLower) || 
               orderId.includes(searchLower);
      });
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue: any, bValue: any;
      switch (sortBy) {
        case 'client':
          aValue = a.billing_company || `${a.billing_first_name} ${a.billing_last_name}`;
          bValue = b.billing_company || `${b.billing_first_name} ${b.billing_last_name}`;
          break;
        case 'status':
          aValue = a.pago_completo ? 1 : 0;
          bValue = b.pago_completo ? 1 : 0;
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
      
      // String comparison
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [allOrders, searchTerm, sortBy, sortDirection]);
  
  // Paginate the filtered results
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAndSortedOrders.slice(startIndex, endIndex);
  }, [filteredAndSortedOrders, currentPage, pageSize]);
  
  // Calculate total pages based on filtered results
  const totalPages = Math.ceil(filteredAndSortedOrders.length / pageSize);

  // Update URL to reflect current filters (optional, for bookmarking)
  const updateURL = () => {
    const url = new URL(window.location.href);
    
    if (searchTerm) {
      url.searchParams.set('search', searchTerm);
    } else {
      url.searchParams.delete('search');
    }
    
    url.searchParams.set('sortBy', sortBy);
    url.searchParams.set('sortDirection', sortDirection);
    url.searchParams.set('page', currentPage.toString());
    
    window.history.replaceState({}, '', url.toString());
  };

  // Initialize URL parameters from current URL
  useEffect(() => {
    const url = new URL(window.location.href);
    const urlSearch = url.searchParams.get('search') || '';
    const urlSortBy = url.searchParams.get('sortBy') as 'date' | 'client' | 'status' | 'id' || 'date';
    const urlSortDirection = url.searchParams.get('sortDirection') as 'asc' | 'desc' || 'desc';
    const urlPage = parseInt(url.searchParams.get('page') || '1', 10);
    
    setSearchTerm(urlSearch);
    setSortBy(urlSortBy);
    setSortDirection(urlSortDirection);
    setCurrentPage(urlPage);
  }, []);

  // Update URL when filters change
  useEffect(() => {
    updateURL();
  }, [searchTerm, sortBy, sortDirection, currentPage]);
  
  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Refresh data by reloading the page (since data comes from server)
  const refreshData = () => {
    window.location.reload();
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
  const handleUpdatePaymentStatus = async (orderId: number, currentStatus: boolean | string) => {
    try {
      setUpdatingOrderId(orderId);
      // Invertir el estado actual
      const currentBool = typeof currentStatus === 'boolean' ? currentStatus : currentStatus === 'true';
      const newStatus = !currentBool;
      
      const headers = getAuthHeaders();
      const response = await fetch(`/api/orders/update/${orderId}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          pago_completo: newStatus
        })
      });

      if (response.ok) {
        // Update the order in allOrders state to reflect the change
        // Since we can't directly mutate allOrders (it's const), we need to update the component
        // The change will be reflected when the user refreshes or navigates
        console.log(`Estado de pago actualizado para la orden ${orderId}`);
        
        // Show success message
        setError(null);
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

      const headers = getAuthHeaders();
      const response = await fetch(`/api/orders/update/${orderId}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          orden_compra: orderFields.oc || '',
          numero_factura: orderFields.factura || ''
        })
      });

      if (response.ok) {
        const ocValue = orderFields.oc || '';
        const facturaValue = orderFields.factura || '';
        
        // The changes are saved to the database
        // Local state for editable fields is already updated
        
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
    // Search is handled automatically by the useMemo hook
    // Just ensure we're on page 1
    setCurrentPage(1);
  };
  
  // Handle sorting
  const handleSort = (column: 'date' | 'client' | 'status' | 'id') => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  // Removed toggleSortDirection as it's not currently used in the UI

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Tabla de Pagos</CardTitle>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={loading}
                title="Actualizar datos"
              >
                Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Buscar por cliente, proyecto o ID..."
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
                  <TableHead 
                    className="w-[180px] cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('client')}
                    title="Ordenar por cliente"
                  >
                    Cliente {sortBy === 'client' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('id')}
                    title="Ordenar por ID"
                  >
                    ID Orden {sortBy === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>OC</TableHead>
                  <TableHead>N° Factura</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('status')}
                    title="Ordenar por estado de pago"
                  >
                    Estado Pago {sortBy === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4">
                      {loading ? 'Cargando...' : searchTerm ? 'No se encontraron órdenes que coincidan con la búsqueda' : 'No se encontraron órdenes'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.billing_company || `${order.billing_first_name} ${order.billing_last_name}`}
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
                      <TableCell>{order.order_proyecto || '-'}</TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">
                              ${formatCurrency(order.calculated_total || order.total || '0')}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Subtotal: ${formatCurrency(order.calculated_subtotal || '0')}</p>
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
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentStatusColors[getPaymentStatusKey(order.pago_completo)]}`}
                          onClick={() => handleUpdatePaymentStatus(order.id, order.pago_completo)}
                          style={{ cursor: 'pointer' }}
                        >
                          {paymentStatusText[getPaymentStatusKey(order.pago_completo)]}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {order.new_pdf_processing_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(order.new_pdf_processing_url, '_blank')}
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
              Mostrando {paginatedOrders.length} de {filteredAndSortedOrders.length} resultados
              {searchTerm && (
                <span className="ml-2">
                  (filtrados de {allOrders.length} total)
                </span>
              )}
              {totalPages > 1 && (
                <span className="ml-2">
                  - Página {currentPage} de {totalPages}
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