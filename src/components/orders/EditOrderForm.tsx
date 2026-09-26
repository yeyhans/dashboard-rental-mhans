import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Plus, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { STATUS_OPTIONS, enteredStatus, statusBadgeClass } from '@/lib/orderStatus';
import { computeOrderTotals } from '@/lib/pricing';

// Types
interface LineItem {
  id?: number;
  name: string;
  product_id?: number;
  quantity: number;
  subtotal: string | number;
  total: string | number;
  price?: string | number;
  sku?: string;
}

interface OrderData {
  id: number;
  status: string;
  currency?: string;
  date_created: string;
  date_modified?: string;
  date_completed?: string | null;
  total: number;
  customer_id?: number;
  
  // Billing information
  billing_first_name?: string;
  billing_last_name?: string;
  billing_company?: string;
  billing_address_1?: string;
  billing_city?: string;
  billing_email?: string;
  billing_phone?: string;
  
  // Project information
  order_proyecto?: string;
  order_fecha_inicio?: string;
  order_fecha_termino?: string;
  num_jornadas?: number;
  company_rut?: string;
  
  // Retirement information
  order_retire_name?: string;
  order_retire_phone?: string;
  order_retire_rut?: string;
  order_comments?: string;
  
  // Financial calculations
  calculated_subtotal?: number;
  calculated_discount?: number;
  calculated_iva?: number;
  calculated_total?: number;
  shipping_total?: number | string;
  reserve_type?: string | null;
  reserve_value?: number | string | null;
  
  // Line items
  line_items?: LineItem[];
  
  // Payment information
  payment_method?: string;
  payment_method_title?: string;
  transaction_id?: string;
  customer_note?: string;
  
  // Status flags
  correo_enviado?: boolean;
  pago_completo?: boolean | string;
}

interface EditOrderFormProps {
  order: OrderData;
  onSave: (updatedOrder: OrderData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

// Las ocho etapas del canónico, con el color de estado que les corresponde.
const statusOptions = STATUS_OPTIONS.map(option => ({
  ...option,
  color: statusBadgeClass(option.value),
}));

const EditOrderForm: React.FC<EditOrderFormProps> = ({ order, onSave, onCancel, loading = false }) => {
  const [formData, setFormData] = useState<OrderData>(order);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [productQuantity, setProductQuantity] = useState<number>(1);

  // Load products for selection
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/products/simple?limit=1000');
        const result = await response.json();
        
        if (result.success && result.data.products) {
          setProducts(result.data.products);
        }
      } catch (error) {
        console.error('Error loading products:', error);
      }
    };
    loadProducts();
  }, []);

  // Calculate totals when line items or dates change
  useEffect(() => {
    calculateTotals();
  }, [formData.line_items, formData.order_fecha_inicio, formData.order_fecha_termino, formData.shipping_total]);

  // `apply_iva` has no column: an order that already had a taxable base but no IVA is exempt.
  const applyIva = (Number(order.calculated_iva) || 0) > 0 || (Number(order.calculated_subtotal) || 0) <= 0;

  // Preview only: the server recomputes and persists these figures with the same pricing module.
  const calculateTotals = () => {
    try {
      const totals = computeOrderTotals({
        lineItems: (formData.line_items || []).map(item => ({ price: item.price ?? 0, quantity: item.quantity })),
        startDate: formData.order_fecha_inicio || null,
        endDate: formData.order_fecha_termino || null,
        jornadas: formData.num_jornadas || 1,
        shippingTotal: formData.shipping_total ?? 0,
        discount: formData.calculated_discount ?? 0,
        applyIva,
      });

      setFormData(prev => ({
        ...prev,
        num_jornadas: totals.jornadas,
        calculated_subtotal: totals.net,
        calculated_discount: totals.discount,
        calculated_iva: totals.iva,
        calculated_total: totals.total,
        total: totals.total
      }));
    } catch (error) {
      console.error('[EditOrderForm] No se pudieron calcular los montos:', { orderId: formData.id, error });
    }
  };

  const handleInputChange = (field: keyof OrderData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };


  const handleSave = async () => {
    try {
      // El pedido ENTRA a una etapa terminal. `failed` era el literal de la salida fallida y
      // después de 0003 no vuelve a existir: su etapa es `cancelled`.
      const statusChangedToCompleted = enteredStatus(order.status, formData.status, 'completed');
      const statusChangedToFailed = enteredStatus(order.status, formData.status, 'cancelled');

      // Save the order first
      await onSave(formData);

      // If status changed to completed, send notification email
      if (statusChangedToCompleted) {
        if (!formData.billing_email) {
          toast.warning('⚠️ No se pudo enviar notificación', {
            description: 'La orden no tiene un email de cliente configurado',
            duration: 5000
          });
          return;
        }
        
        console.log('📧 Order status changed to completed, sending notification email...');
        
        try {
          const emailPayload = {
            orderData: {
              id: formData.id,
              status: formData.status,
              date_created: formData.date_created,
              date_completed: new Date().toISOString(),
              customer_id: formData.customer_id?.toString() || '',
              total: formData.total?.toString() || formData.calculated_total?.toString() || '0',
              
              // Billing information
              billing_first_name: formData.billing_first_name,
              billing_last_name: formData.billing_last_name,
              billing_company: formData.billing_company,
              billing_email: formData.billing_email,
              billing_phone: formData.billing_phone,
              
              // Project information
              order_proyecto: formData.order_proyecto,
              order_fecha_inicio: formData.order_fecha_inicio,
              order_fecha_termino: formData.order_fecha_termino,
              num_jornadas: formData.num_jornadas,
              
              // Line items (simplified for email)
              line_items: formData.line_items?.map(item => ({
                name: item.name,
                quantity: item.quantity,
                sku: item.sku
              }))
            },
            emailType: 'order_completed' as const
          };

          const response = await fetch('/api/emails/send-order-completed-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailPayload)
          });

          const result = await response.json();
          
          if (result.success) {
            console.log('✅ Order completed notification sent successfully:', result.emailId);
            toast.success('📧 Correo de orden completada enviado', {
              description: `Notificación enviada a ${formData.billing_email}`,
              duration: 5000
            });
          } else {
            console.error('❌ Failed to send order completed notification:', result.error);
            toast.error('Error al enviar notificación', {
              description: 'No se pudo enviar el correo de orden completada',
              duration: 5000
            });
          }
        } catch (emailError) {
          console.error('💥 Error sending order completed notification:', emailError);
          // Don't throw here - we don't want to fail the order save if email fails
        }
      }

      // If status changed to failed, send failure notification email
      if (statusChangedToFailed) {
        if (!formData.billing_email) {
          toast.warning('⚠️ No se pudo enviar notificación de fallo', {
            description: 'La orden no tiene un email de cliente configurado',
            duration: 5000
          });
          return;
        }
        
        console.log('📧 Order status changed to failed, sending failure notification email...');
        
        try {
          const emailPayload = {
            orderData: {
              id: formData.id,
              status: formData.status,
              date_created: formData.date_created,
              date_modified: new Date().toISOString(),
              customer_id: formData.customer_id?.toString() || '',
              total: formData.total?.toString() || formData.calculated_total?.toString() || '0',
              
              // Billing information
              billing_first_name: formData.billing_first_name,
              billing_last_name: formData.billing_last_name,
              billing_company: formData.billing_company,
              billing_email: formData.billing_email,
              billing_phone: formData.billing_phone,
              
              // Project information
              order_proyecto: formData.order_proyecto,
              order_fecha_inicio: formData.order_fecha_inicio,
              order_fecha_termino: formData.order_fecha_termino,
              num_jornadas: formData.num_jornadas,
              
              // Line items (simplified for email)
              line_items: formData.line_items?.map(item => ({
                name: item.name,
                quantity: item.quantity,
                sku: item.sku
              }))
            },
            emailType: 'order_failed' as const,
            failureReason: 'La orden no pudo ser procesada correctamente. Nuestro equipo está trabajando para resolver el problema.'
          };

          const response = await fetch('/api/emails/send-order-failed-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailPayload)
          });

          const result = await response.json();
          
          if (result.success) {
            console.log('✅ Order failed notification sent successfully:', result.emailId);
            toast.error('📧 Notificación de fallo enviada', {
              description: `Cliente notificado del problema en ${formData.billing_email}`,
              duration: 5000
            });
          } else {
            console.error('❌ Failed to send order failed notification:', result.error);
            toast.error('Error al enviar notificación de fallo', {
              description: 'No se pudo notificar al cliente del problema',
              duration: 5000
            });
          }
        } catch (emailError) {
          console.error('💥 Error sending order failed notification:', emailError);
          toast.error('Error crítico en notificación', {
            description: 'Fallo al enviar notificación de orden fallida',
            duration: 5000
          });
          // Don't throw here - we don't want to fail the order save if email fails
        }
      }
    } catch (error) {
      console.error('Error saving order:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Editar Pedido #{order.id}</h2>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={loading}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="customer">Cliente</TabsTrigger>
          <TabsTrigger value="project">Proyecto</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Estado</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          <div className="flex items-center gap-2">
                            <Badge className={status.color}>{status.label}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="payment_method">Método de Pago</Label>
                  <Input
                    id="payment_method"
                    value={formData.payment_method || ''}
                    onChange={(e) => handleInputChange('payment_method', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="transaction_id">ID de Transacción</Label>
                  <Input
                    id="transaction_id"
                    value={formData.transaction_id || ''}
                    onChange={(e) => handleInputChange('transaction_id', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="pago_completo">Estado de Pago</Label>
                  <Select 
                    value={formData.pago_completo?.toString() || 'false'} 
                    onValueChange={(value) => handleInputChange('pago_completo', value === 'true')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Pagado</SelectItem>
                      <SelectItem value="false">Pendiente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="customer_note">Notas del Cliente</Label>
                <Textarea
                  id="customer_note"
                  value={formData.customer_note || ''}
                  onChange={(e) => handleInputChange('customer_note', e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="billing_first_name">Nombre</Label>
                  <Input
                    id="billing_first_name"
                    value={formData.billing_first_name || ''}
                    onChange={(e) => handleInputChange('billing_first_name', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="billing_last_name">Apellido</Label>
                  <Input
                    id="billing_last_name"
                    value={formData.billing_last_name || ''}
                    onChange={(e) => handleInputChange('billing_last_name', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="billing_company">Empresa</Label>
                  <Input
                    id="billing_company"
                    value={formData.billing_company || ''}
                    onChange={(e) => handleInputChange('billing_company', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="billing_email">Email</Label>
                  <Input
                    id="billing_email"
                    type="email"
                    value={formData.billing_email || ''}
                    onChange={(e) => handleInputChange('billing_email', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="billing_phone">Teléfono</Label>
                  <Input
                    id="billing_phone"
                    value={formData.billing_phone || ''}
                    onChange={(e) => handleInputChange('billing_phone', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="billing_address_1">Dirección</Label>
                  <Input
                    id="billing_address_1"
                    value={formData.billing_address_1 || ''}
                    onChange={(e) => handleInputChange('billing_address_1', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="billing_city">Ciudad</Label>
                  <Input
                    id="billing_city"
                    value={formData.billing_city || ''}
                    onChange={(e) => handleInputChange('billing_city', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="company_rut">RUT Empresa</Label>
                  <Input
                    id="company_rut"
                    value={formData.company_rut || ''}
                    onChange={(e) => handleInputChange('company_rut', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="project" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Información del Proyecto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="order_proyecto">Nombre del Proyecto</Label>
                  <Input
                    id="order_proyecto"
                    value={formData.order_proyecto || ''}
                    onChange={(e) => handleInputChange('order_proyecto', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="order_fecha_inicio">Fecha de Inicio</Label>
                  <Input
                    id="order_fecha_inicio"
                    type="date"
                    value={formData.order_fecha_inicio || ''}
                    onChange={(e) => handleInputChange('order_fecha_inicio', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="order_fecha_termino">Fecha de Término</Label>
                  <Input
                    id="order_fecha_termino"
                    type="date"
                    value={formData.order_fecha_termino || ''}
                    onChange={(e) => handleInputChange('order_fecha_termino', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="num_jornadas">Número de Jornadas</Label>
                  <Input
                    id="num_jornadas"
                    type="number"
                    value={formData.num_jornadas || 0}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>

                <div>
                  <Label htmlFor="order_retire_name">Nombre del Retiro</Label>
                  <Input
                    id="order_retire_name"
                    value={formData.order_retire_name || ''}
                    onChange={(e) => handleInputChange('order_retire_name', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="order_retire_phone">Teléfono del Retiro</Label>
                  <Input
                    id="order_retire_phone"
                    value={formData.order_retire_phone || ''}
                    onChange={(e) => handleInputChange('order_retire_phone', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="order_retire_rut">RUT del Retiro</Label>
                  <Input
                    id="order_retire_rut"
                    value={formData.order_retire_rut || ''}
                    onChange={(e) => handleInputChange('order_retire_rut', e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="order_comments">Comentarios</Label>
                  <Textarea
                    id="order_comments"
                    value={formData.order_comments || ''}
                    onChange={(e) => handleInputChange('order_comments', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EditOrderForm;
