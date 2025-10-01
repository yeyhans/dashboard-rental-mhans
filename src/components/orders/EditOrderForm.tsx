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

// Status options
const statusOptions = [
  { value: 'pending', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'processing', label: 'En proceso', color: 'bg-blue-100 text-blue-800' },
  { value: 'on-hold', label: 'En espera', color: 'bg-gray-100 text-gray-800' },
  { value: 'completed', label: 'Completado', color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'Cancelado', color: 'bg-red-100 text-red-800' },
  { value: 'refunded', label: 'Reembolsado', color: 'bg-purple-100 text-purple-800' },
  { value: 'failed', label: 'Fallido', color: 'bg-red-100 text-red-800' }
];

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
  }, [formData.line_items, formData.order_fecha_inicio, formData.order_fecha_termino]);

  const calculateDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 1;
    
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return 1;
      }
      
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(1, days);
    } catch (error) {
      console.error('Error calculating days:', error);
      return 1;
    }
  };

  const calculateTotals = () => {
    const lineItems = formData.line_items || [];
    const numDays = calculateDays(formData.order_fecha_inicio || '', formData.order_fecha_termino || '');
    
    // Calculate base subtotal (before multiplying by days)
    const baseSubtotal = lineItems.reduce((sum, item) => {
      const price = typeof item.price === 'string' ? parseFloat(item.price) : (item.price || 0);
      return sum + (price * item.quantity);
    }, 0);
    
    // Calculate subtotal (after multiplying by days)
    const subtotal = Math.round((baseSubtotal * numDays) * 100) / 100;
    
    // Get current discount
    const discount = formData.calculated_discount || 0;
    
    // Calculate IVA (19%)
    const iva = Math.round((subtotal * 0.19) * 100) / 100;
    
    // Calculate total
    const total = Math.round((subtotal - discount + iva) * 100) / 100;
    
    setFormData(prev => ({
      ...prev,
      num_jornadas: numDays,
      calculated_subtotal: subtotal,
      calculated_iva: iva,
      calculated_total: total,
      total: total
    }));
  };

  const handleInputChange = (field: keyof OrderData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };


  const handleSave = async () => {
    try {
      await onSave(formData);
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
