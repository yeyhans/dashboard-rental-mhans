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
import type { Order } from '../../types/order';
import { RefreshCw, Search } from 'lucide-react';

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
  initialTotalPages: string;
  initialPage?: string;
  initialStatus?: string;
  initialPerPage?: string;
}

const PaymentsTable = ({ 
  initialOrders,
  initialTotal,
  initialTotalPages,
  initialPage = '1',
  initialStatus = '',
  initialPerPage = '10'
}: PaymentsTableProps) => {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(parseInt(initialPage));
  const [totalPages, setTotalPages] = useState(parseInt(initialTotalPages));
  const [total, setTotal] = useState(parseInt(initialTotal));
  const [editableFields, setEditableFields] = useState<{[key: string]: {oc?: string, factura?: string}}>({}); 
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  const perPage = parseInt(initialPerPage);

  // Actualizar la URL para reflejar los filtros actuales
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

  // Función para cargar los datos con filtros
  const loadOrders = async (page: number, status: string = '', search: string = '') => {
    try {
      setLoading(true);
      setError(null); // Limpiar errores previos
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
        
        // Ordenar por ID para mantener consistencia
        mergedOrders.sort((a: Order, b: Order) => a.id - b.id);
        
        setOrders(mergedOrders);
        setTotalPages(parseInt(wooData.data.totalPages));
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
        
        updateURL(page, status, search);
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

  // Efecto para cargar los datos cuando cambian los filtros
  useEffect(() => {
    loadOrders(currentPage);
  }, [currentPage]);

  const refreshData = () => {
    loadOrders(currentPage, '', searchTerm);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
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
    loadOrders(1, '', searchTerm);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Tabla de Pagos</CardTitle>
          <Button
            variant="outline"
            size="icon"
            onClick={refreshData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
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
                    <TableCell>{order.id}</TableCell>
                    <TableCell>{order.metadata?.order_proyecto || '-'}</TableCell>
                    <TableCell>
                      ${formatCurrency(order.metadata?.calculated_total || '0')}
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => saveFieldChanges(order.id)}
                        disabled={updatingOrderId === order.id}
                      >
                        {updatingOrderId === order.id ? 'Guardando...' : 'Guardar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Mostrando {orders.length} de {total} resultados
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
            >
              Anterior
            </Button>
            <div className="text-sm">
              Página {currentPage} de {totalPages || 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentsTable; 