import { useState, useEffect } from 'react';
import type { Order, Metadata, LineItem } from '../../types/order';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
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
import { Label } from '../ui/label';
import { FileText, FileCheck, ChevronLeft } from 'lucide-react';


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

// Helper function to format currency with thousands separator
const formatCurrency = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

interface OrderDetailsProps {
  order: any; // Raw WooCommerce API response
}

const OrderDetails = ({ order: rawOrder }: OrderDetailsProps) => {
  const [loading, setLoading] = useState(false);
  const [transformedOrder, setTransformedOrder] = useState<Order | null>(null);

  // Transform the raw WooCommerce order data to match our Order type
  useEffect(() => {
    if (!rawOrder) return;

    const getMetaValue = (key: string): string => {
      const meta = rawOrder.meta_data?.find((m: any) => m.key === key);
      return meta?.value || '';
    };

    // Transform line items
    const lineItems: LineItem[] = rawOrder.line_items.map((item: any) => ({
      id: item.id,
      name: item.name,
      product_id: item.product_id,
      sku: item.sku || '',
      price: item.price || '0',
      quantity: item.quantity,
      image: item.image?.src || ''
    }));

    // Extract metadata
    const metadata: Metadata = {
      order_fecha_inicio: getMetaValue('order_fecha_inicio'),
      order_fecha_termino: getMetaValue('order_fecha_termino'),
      num_jornadas: getMetaValue('num_jornadas'),
      calculated_subtotal: getMetaValue('calculated_subtotal'),
      calculated_discount: getMetaValue('calculated_discount'),
      calculated_iva: getMetaValue('calculated_iva'),
      calculated_total: getMetaValue('calculated_total'),
      company_rut: getMetaValue('company_rut'),
      order_proyecto: getMetaValue('order_proyecto'),
      pdf_on_hold_url: getMetaValue('_pdf_on_hold_url'),
      pdf_processing_url: getMetaValue('_pdf_processing_url')
    };

    const order: Order = {
      id: rawOrder.id,
      status: rawOrder.status,
      date_created: rawOrder.date_created,
      date_modified: rawOrder.date_modified,
      customer_id: rawOrder.customer_id,
      billing: {
        first_name: rawOrder.billing.first_name,
        last_name: rawOrder.billing.last_name,
        company: rawOrder.billing.company || '',
        address_1: rawOrder.billing.address_1 || '',
        city: rawOrder.billing.city || '',
        email: rawOrder.billing.email || '',
        phone: rawOrder.billing.phone || ''
      },
      metadata,
      line_items: lineItems
    };

    setTransformedOrder(order);
  }, [rawOrder]);

  // Add function to handle order status updates
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
        // Reload the page to show updated status
        window.location.reload();
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (err) {
      console.error('Error al actualizar el estado del pedido', err);
      alert('Error al actualizar el estado del pedido');
    } finally {
      setLoading(false);
    }
  };

  if (!transformedOrder) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2 text-foreground">Cargando detalles del pedido...</p>
        </div>
      </div>
    );
  }

  const order = transformedOrder;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center mb-4">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => window.location.href = '/orders'}
            >
              <ChevronLeft className="h-4 w-4" />
              Volver a pedidos
            </Button>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-md text-sm font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                {statusTranslations[order.status] || order.status}
              </div>
            </div>
          </div>
          <CardTitle className="text-xl">Detalles del Pedido #{order.id}</CardTitle>
          <CardDescription>
            Información completa del pedido realizado el {formatDate(order.date_created)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
                className="w-full justify-start gap-2"
                onClick={() => window.open(order.metadata.pdf_on_hold_url, '_blank')}
              >
                <FileText className="h-4 w-4" />
                Ver PDF de Presupuesto
              </Button>
            )}
            {order.metadata.pdf_processing_url && (
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => window.open(order.metadata.pdf_processing_url, '_blank')}
              >
                <FileCheck className="h-4 w-4" />
                Ver PDF de Contrato
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderDetails; 