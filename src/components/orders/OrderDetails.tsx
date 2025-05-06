import { useState, useEffect } from 'react';
import type { Order, Metadata, LineItem } from '../../types/order';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from '../ui/card';

import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { FileText, FileCheck, ChevronLeft, Save, X, Edit } from 'lucide-react';
import { ProductSelector } from './ProductSelector';
import { OrderCostSummary } from './OrderCostSummary';
import { OrderNotes } from './OrderNotes';

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

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};



interface OrderDetailsProps {
  order: {
    correo_enviado?: boolean;
    pago_completo?: string;
    meta_data?: any[];
    [key: string]: any;
  };
}


interface EditableOrderData {
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    city: string;
    email: string;
    phone: string;
  };
  metadata: Metadata;
}

const OrderDetails = ({ order: rawOrder }: OrderDetailsProps) => {
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  // Cambiar el estado para manejar string, inicializar con valor existente o cadena vacía
  const [paymentStatus, setPaymentStatus] = useState<string>(rawOrder.pago_completo || '');

  // Estado para mostrar detalles
  const [showPaymentDetails, setShowPaymentDetails] = useState(false); // Estado para mostrar detalles

  const handlePaymentUpdate = async (newStatus: string) => {
    if (!newStatus || newStatus.trim() === '') {
      alert('Por favor ingrese un estado de pago válido');
      return;
    }
    console.log('Actualizando estado de pago:', newStatus);
    try {
      // Actualización en WooCommerce y WordPress (mantener lógica existente, pero enviar string)
      console.log('Enviando solicitud de actualización a:', '/api/woo/update-orders');
      const wooResponse = await fetch(`/api/woo/update-orders`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: rawOrder.id,
          meta_data: [{ key: 'pago_completo', value: newStatus }] // Actualizar metadata
        })
      });

      console.log('Enviando solicitud de actualización a WordPress');
      const wpResponse = await fetch(`/api/wp/update-order/${rawOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pago_completo: newStatus
        })
      });

      if (!wpResponse.ok) {
        throw new Error('Error al actualizar el estado de pago en WordPress');
      }

      const wooData = await wooResponse.json();
      console.log('Respuesta de la API Woo:', wooData);

      if (wooData.success) {
        // Actualizar estado local y recargar si es necesario o manejar la UI
        setPaymentStatus(newStatus);
        setIsEditingPayment(false);
        // Opcional: window.location.reload(); si prefieres recargar la página
      } else {
        alert(`Error al actualizar en WooCommerce: ${wooData.message}`);
      }
    } catch (err) {
      console.error('Error al actualizar el estado de pago', err);
      alert('Error al actualizar el estado de pago');
    }
  };
  const [loading, setLoading] = useState(false);
  const [transformedOrder, setTransformedOrder] = useState<Order | null>(null);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editedOrderData, setEditedOrderData] = useState<EditableOrderData | null>(null);
  const [products, setProducts] = useState<any[]>([]); // Added for product selection
  const [isEditingProducts, setIsEditingProducts] = useState(false); // Added for product editing

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
      pdf_processing_url: getMetaValue('_pdf_processing_url'),
      order_retire_name: getMetaValue('order_retire_name'),
      order_retire_rut: getMetaValue('order_retire_rut'), 
      order_retire_phone: getMetaValue('order_retire_phone'),
      order_comments: getMetaValue('order_comments')
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
      line_items: lineItems,
      pago_completo: ''
    };

    setTransformedOrder(order);
  }, [rawOrder]);

  // Add function to handle order status updates
  const handleStatusUpdate = async (orderId: number, newStatus: string) => {
    try {
      setLoading(true);
      console.log('Enviando solicitud de actualización a:', '/api/woo/update-orders');
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
      console.log('Respuesta de la API:', data);
      
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

  // Update the handleOrderDataChange function for dates
  const handleOrderDataChange = (
    section: keyof EditableOrderData,
    field: string,
    value: string
  ) => {
    if (!editedOrderData) return;

    console.log(`Cambiando ${section}.${field} a: ${value}`);

    // Handle date changes to recalculate number of days and all totals
    if (section === 'metadata' && (field === 'order_fecha_inicio' || field === 'order_fecha_termino')) {
      // En este punto, vale la pena validar el formato de fecha
      if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        console.warn(`Formato de fecha potencialmente inválido: ${value}`);
      }

      // Calcular con los valores actualizados
      const startDate = field === 'order_fecha_inicio' ? value : editedOrderData.metadata.order_fecha_inicio;
      const endDate = field === 'order_fecha_termino' ? value : editedOrderData.metadata.order_fecha_termino;
      
      // Solo calcular si ambas fechas son válidas
      if (startDate && endDate) {
        console.log(`Recalculando con fechas actualizadas: inicio=${startDate}, termino=${endDate}`);
        const numDays = calculateDays(startDate, endDate);
        
        // Calcular todos los valores financieros con las líneas actuales
        if (transformedOrder) {
          // Calcular base subtotal (antes de multiplicar por días)
          const baseSubtotal = transformedOrder.line_items.reduce((sum, item) => 
            sum + (parseFloat(item.price) * item.quantity), 0);
          
          // Calcular subtotal (después de multiplicar por días) con precisión
          const subtotal = Math.round((baseSubtotal * numDays) * 100) / 100;
          
          // Obtener valores actuales con precisión
          const discount = Math.round((parseFloat(editedOrderData.metadata.calculated_discount) || 0) * 100) / 100;
          const currentIva = parseFloat(editedOrderData.metadata.calculated_iva) || 0;
          const applyIva = currentIva > 0;
          
          // Calcular IVA con precisión
          const iva = applyIva ? Math.round((subtotal * 0.19) * 100) / 100 : 0;
          
          // Calcular total con precisión
          const total = Math.round((subtotal - discount + iva) * 100) / 100;
          
          console.log(`Nuevos valores con fechas actualizadas:`, {
            numDays,
            baseSubtotal,
            subtotal,
            discount,
            applyIva,
            iva,
            total
          });
          
          // Actualizar el estado con todos los valores calculados de una vez
          setEditedOrderData({
            ...editedOrderData,
            metadata: {
              ...editedOrderData.metadata,
              [field]: value,
              num_jornadas: numDays.toString(),
              calculated_subtotal: subtotal.toString(),
              calculated_iva: iva.toString(),
              calculated_total: total.toString()
            }
          });
          
          return;
        }
      }
      
      // Si no podemos calcular (faltan fechas o productos), solo actualizar la fecha
      setEditedOrderData({
        ...editedOrderData,
        metadata: {
          ...editedOrderData.metadata,
          [field]: value
        }
      });
      
      return;
    }

    // For all other fields
    setEditedOrderData({
      ...editedOrderData,
      [section]: {
        ...editedOrderData[section],
        [field]: value
      }
    });
  };

  // Load products data for editing
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/woo/get-products');
        const data = await response.json();
      console.log('Respuesta de la API:', data);
        if (data.success) {
          setProducts(data.data.products);
        }
      } catch (err) {
        console.error('Error al cargar productos:', err);
      }
    };

    if (isEditingProducts) {
      loadProducts();
    }
  }, [isEditingProducts]);

  // Handle adding a product to the order
  const handleAddProduct = (product: any, quantity: number) => {
    if (!transformedOrder || !editedOrderData) return;

    const newItem: LineItem = {
      product_id: product.id.toString(),
      quantity: quantity,
      sku: product.sku,
      price: product.price,
      name: product.name,
      image: product.images?.[0]?.src || ''
    };

    const updatedItems = [...transformedOrder.line_items, newItem];
    setTransformedOrder({
      ...transformedOrder,
      line_items: updatedItems
    });

    // Update calculations
    updateCalculations(updatedItems);
  };

  // Handle removing a product from the order
  const handleRemoveProduct = (index: number) => {
    if (!transformedOrder || !editedOrderData) return;

    const updatedItems = transformedOrder.line_items.filter((_, i) => i !== index);
    setTransformedOrder({
      ...transformedOrder,
      line_items: updatedItems
    });

    // Update calculations
    updateCalculations(updatedItems);
  };

  // Handle updating a product in the order
  const handleUpdateProduct = (itemId: number, updates: Partial<LineItem>) => {
    if (!transformedOrder || !editedOrderData) return;

    const updatedItems = transformedOrder.line_items.map(item => {
      if (item.id === itemId) {
        return { ...item, ...updates };
      }
      return item;
    });

    setTransformedOrder({
      ...transformedOrder,
      line_items: updatedItems
    });

    // Update calculations
    updateCalculations(updatedItems);
  };

  // Calculate days between dates
  const calculateDays = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;
    
    try {
      console.log(`Calculando días entre ${startDate} y ${endDate}`);
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Verificar que las fechas sean válidas
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.error('Fechas inválidas al calcular días', { startDate, endDate });
        return 0;
      }
      
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both days
      console.log(`Días calculados: ${days}`);
      return days;
    } catch (error) {
      console.error('Error al calcular días', error);
      return 0;
    }
  };

  // Update all calculations
  const updateCalculations = (lineItems: LineItem[]) => {
    if (!editedOrderData) return;
    
    console.log('Actualizando cálculos con fechas:', {
      inicio: editedOrderData.metadata.order_fecha_inicio,
      termino: editedOrderData.metadata.order_fecha_termino
    });

    const numDays = calculateDays(
      editedOrderData.metadata.order_fecha_inicio,
      editedOrderData.metadata.order_fecha_termino
    );

    // Calculate base subtotal (before multiplying by days)
    const baseSubtotal = lineItems.reduce((sum, item) => 
      sum + (parseFloat(item.price) * item.quantity), 0);

    console.log(`Base subtotal: ${baseSubtotal}, Días: ${numDays}`);

    // Calculate subtotal (after multiplying by days) - round to 2 decimals
    const subtotal = Math.round((baseSubtotal * numDays) * 100) / 100;

    // Get current discount value - round to 2 decimals
    const discount = Math.round((parseFloat(editedOrderData.metadata.calculated_discount) || 0) * 100) / 100;
    
    // Check if IVA should be applied - this could come from metadata or checkbox state
    const currentIva = parseFloat(editedOrderData.metadata.calculated_iva) || 0;
    const applyIva = currentIva > 0;
    
    // Calculate IVA - round to 2 decimals
    const iva = applyIva ? Math.round((subtotal * 0.19) * 100) / 100 : 0;

    // Calculate total - round to 2 decimals
    const total = Math.round((subtotal - discount + iva) * 100) / 100;

    console.log('Nuevos valores calculados:', {
      numDays,
      baseSubtotal,
      subtotal,
      discount,
      applyIva,
      iva,
      total
    });

    // Update state with properly formatted values
    setEditedOrderData({
      ...editedOrderData,
      metadata: {
        ...editedOrderData.metadata,
        calculated_subtotal: subtotal.toString(),
        calculated_iva: iva.toString(),
        calculated_total: total.toString(),
        num_jornadas: numDays.toString()
      }
    });
  };

  // Handle discount change
  const handleDiscountChange = (value: string) => {
    if (!editedOrderData) return;

    console.log(`Actualizando descuento a: ${value}`);

    // Convertir valores a números con precisión de 2 decimales
    const subtotal = Math.round((parseFloat(editedOrderData.metadata.calculated_subtotal) || 0) * 100) / 100;
    const discount = Math.round((parseFloat(value) || 0) * 100) / 100;
    const iva = Math.round((parseFloat(editedOrderData.metadata.calculated_iva) || 0) * 100) / 100;
    
    // Calcular nuevo total
    const total = Math.round((subtotal - discount + iva) * 100) / 100;

    console.log('Nuevos valores con descuento:', {
      subtotal,
      discount,
      iva,
      total
    });

    // Actualizar state con los nuevos valores
    setEditedOrderData({
      ...editedOrderData,
      metadata: {
        ...editedOrderData.metadata,
        calculated_discount: discount.toString(),
        calculated_total: total.toString()
      }
    });
  };

  // Handle IVA changes
  const handleIvaChange = (newTotal: string, newIva: string) => {
    if (!editedOrderData) return;

    console.log(`Actualizando IVA en OrderDetails:`, {
      newIva: newIva,
      newTotal: newTotal
    });

    // Asegurar valores numéricos válidos con 2 decimales
    const ivaValue = Math.round((parseFloat(newIva) || 0) * 100) / 100;
    const totalValue = Math.round((parseFloat(newTotal) || 0) * 100) / 100;

    setEditedOrderData({
      ...editedOrderData,
      metadata: {
        ...editedOrderData.metadata,
        calculated_iva: ivaValue.toString(),
        calculated_total: totalValue.toString()
      }
    });
  };

  // Add this function to save all order changes
  const handleSaveOrderChanges = async () => {
    if (!transformedOrder || !editedOrderData) return;

    try {
      setLoading(true);

      // Log pre-update data for debugging
      console.log('Datos a actualizar:', {
        billing: editedOrderData.billing,
        metadata: editedOrderData.metadata,
        line_items: transformedOrder.line_items
      });

      const updatePayload = {
        billing: editedOrderData.billing,
        metadata: editedOrderData.metadata, // Enviar directamente como objeto
        line_items: transformedOrder.line_items.map(item => ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price
        }))
      };

      const response = await fetch(`/api/woo/update-order/${transformedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload)
      });

      const data = await response.json();
      console.log('Respuesta de la API:', data);
      
      if (data.success) {
        // Update the local state with new data
        setTransformedOrder(data.data);
        setIsEditingOrder(false);
        setIsEditingProducts(false);
        setEditedOrderData(null);
        // Mostrar un mensaje de éxito
        alert('Pedido actualizado correctamente');
      } else {
        console.error('Error en respuesta:', data);
        alert(`Error: ${data.message}`);
      }
    } catch (err) {
      console.error('Error al actualizar el pedido', err);
      alert('Error al actualizar el pedido');
    } finally {
      setLoading(false);
    }
  };

  // Update the useEffect to initialize editable order data
  useEffect(() => {
    if (transformedOrder && isEditingOrder && !editedOrderData) {
      setEditedOrderData({
        billing: { ...transformedOrder.billing },
        metadata: { 
          ...transformedOrder.metadata,
          // Preserve the calculated fields
          calculated_subtotal: transformedOrder.metadata.calculated_subtotal,
          calculated_discount: transformedOrder.metadata.calculated_discount,
          calculated_iva: transformedOrder.metadata.calculated_iva,
          calculated_total: transformedOrder.metadata.calculated_total,
          pdf_on_hold_url: transformedOrder.metadata.pdf_on_hold_url,
          pdf_processing_url: transformedOrder.metadata.pdf_processing_url
        }
      });
      
      // Also enable product editing when we're editing the order
      setIsEditingProducts(true);
    }
  }, [transformedOrder, isEditingOrder]);

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

  // Update the render section for client information
  const renderClientInfo = () => (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-medium">Información del Cliente</h4>
        {!isEditingOrder && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsEditingOrder(true);
              // Also enable product editing
              setIsEditingProducts(true);
              // This will trigger the useEffect to initialize the form data
            }}
            disabled={loading}
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
        {isEditingOrder && editedOrderData ? (
          <>
            <div>
              <Label className="font-medium">Nombre</Label>
              <Input
                value={editedOrderData.billing.first_name}
                onChange={(e) => handleOrderDataChange('billing', 'first_name', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-medium">Apellido</Label>
              <Input
                value={editedOrderData.billing.last_name}
                onChange={(e) => handleOrderDataChange('billing', 'last_name', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-medium">Empresa</Label>
              <Input
                value={editedOrderData.billing.company}
                onChange={(e) => handleOrderDataChange('billing', 'company', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-medium">Email</Label>
              <Input
                type="email"
                value={editedOrderData.billing.email}
                onChange={(e) => handleOrderDataChange('billing', 'email', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-medium">Teléfono</Label>
              <Input
                value={editedOrderData.billing.phone}
                onChange={(e) => handleOrderDataChange('billing', 'phone', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-medium">Dirección</Label>
              <Input
                value={editedOrderData.billing.address_1}
                onChange={(e) => handleOrderDataChange('billing', 'address_1', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-medium">Ciudad</Label>
              <Input
                value={editedOrderData.billing.city}
                onChange={(e) => handleOrderDataChange('billing', 'city', e.target.value)}
                className="mt-1"
              />
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );

  // Update the render section for project information
  const renderProjectInfo = () => (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-medium">Información del Proyecto</h4>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
        {isEditingOrder && editedOrderData ? (
          <>
            <div>
              <Label className="font-medium">Proyecto</Label>
              <Input
                value={editedOrderData.metadata.order_proyecto}
                onChange={(e) => handleOrderDataChange('metadata', 'order_proyecto', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-medium">RUT Empresa</Label>
              <Input
                value={editedOrderData.metadata.company_rut}
                onChange={(e) => handleOrderDataChange('metadata', 'company_rut', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-medium">Fecha Inicio</Label>
              <Input
                type="date"
                value={editedOrderData.metadata.order_fecha_inicio}
                onChange={(e) => handleOrderDataChange('metadata', 'order_fecha_inicio', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-medium">Fecha Término</Label>
              <Input
                type="date"
                value={editedOrderData.metadata.order_fecha_termino}
                onChange={(e) => handleOrderDataChange('metadata', 'order_fecha_termino', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="font-medium">Número de Jornadas</Label>
              <Input
                type="number"
                value={editedOrderData.metadata.num_jornadas}
                className="mt-1 bg-muted"
                disabled
                title="Este valor se calcula automáticamente basado en las fechas de inicio y término"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Calculado automáticamente basado en las fechas
              </p>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );

  const renderProductInfo = () => (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-medium">Productos</h4>
        {!isEditingProducts && !isEditingOrder && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsEditingProducts(true);
              if (!isEditingOrder) {
                setIsEditingOrder(true);
              }
            }}
            disabled={loading}
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="bg-card rounded-lg border">
        {isEditingProducts && transformedOrder && editedOrderData ? (
          <ProductSelector
            products={products}
            lineItems={transformedOrder.line_items}
            numDays={parseInt(editedOrderData.metadata.num_jornadas) || 0}
            onAddProduct={handleAddProduct}
            onRemoveProduct={handleRemoveProduct}
            onUpdateProduct={handleUpdateProduct}
            loading={loading}
            mode="edit"
          />
        ) : (
          <div className="p-4">
            <table className="w-full">
              <thead>
                <tr className="text-sm text-muted-foreground">
                  <th className="text-left font-medium pb-2">Producto</th>
                  <th className="text-left font-medium pb-2">SKU</th>
                  <th className="text-center font-medium pb-2">Cantidad</th>
                  <th className="text-right font-medium pb-2">Precio</th>
                  <th className="text-right font-medium pb-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {transformedOrder?.line_items.map((item, index) => {
                  const itemTotal = parseFloat(item.price) * item.quantity;
                  const numDays = parseInt(transformedOrder.metadata.num_jornadas) || 0;
                  const totalWithDays = numDays > 0 ? itemTotal * numDays : itemTotal;
                  
                  return (
                    <tr key={index} className="border-t">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {item.image && (
                            <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded" />
                          )}
                          <span>{item.name}</span>
                        </div>
                      </td>
                      <td className="py-3">{item.sku}</td>
                      <td className="py-3 text-center">{item.quantity}</td>
                      <td className="py-3 text-right">${(parseFloat(item.price)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</td>
                      <td className="py-3 text-right">
                        <div className="flex flex-col items-end">
                          <span>${(itemTotal).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</span>
                          {numDays > 0 && (
                            <span className="text-sm text-muted-foreground">
                              × {numDays} días = ${(totalWithDays).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {transformedOrder?.line_items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-muted-foreground">
                      No hay productos en este pedido
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderCostSummary = () => {
    if (!transformedOrder) return null;

    const baseSubtotal = transformedOrder.line_items.reduce(
      (sum, item) => sum + (parseFloat(item.price) * item.quantity), 0
    ).toString();

    if (isEditingOrder && editedOrderData) {
      return (
        <OrderCostSummary
          baseSubtotal={baseSubtotal}
          subtotal={editedOrderData.metadata.calculated_subtotal}
          discount={editedOrderData.metadata.calculated_discount}
          iva={editedOrderData.metadata.calculated_iva}
          total={editedOrderData.metadata.calculated_total}
          numDays={parseInt(editedOrderData.metadata.num_jornadas)}
          onDiscountChange={handleDiscountChange}
          onTotalChange={handleIvaChange}
          mode="edit"
          loading={loading}
        />
      );
    }

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium mb-2">Resumen de Costos</h4>
        <div className="space-y-2 bg-muted/50 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <span>Valor Base</span>
            <span>${baseSubtotal.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Subtotal con Jornadas</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">x {transformedOrder.metadata.num_jornadas} jornadas</span>
              <span>${transformedOrder.metadata.calculated_subtotal.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span>Descuento</span>
            <span>${transformedOrder.metadata.calculated_discount.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</span>
          </div>
          <div className="flex justify-between">
            <span>IVA (19%)</span>
            <span>${transformedOrder.metadata.calculated_iva.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
            <span>Total</span>
            <span>${transformedOrder.metadata.calculated_total.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <Button 
              variant="outline" 
              className="gap-2 w-full md:w-auto"
              onClick={() => window.location.href = '/orders'}
            >
              <ChevronLeft className="h-4 w-4" />
              Volver a pedidos
            </Button>
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
              {(isEditingOrder || isEditingProducts) && (
                <>
                  <Button
                    variant="outline"
                    className="gap-2 w-full md:w-auto"
                    onClick={handleSaveOrderChanges}
                    disabled={loading}
                  >
                    <Save className="h-4 w-4" />
                    Guardar Cambios
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 w-full md:w-auto"
                    onClick={() => {
                      setIsEditingOrder(false);
                      setIsEditingProducts(false);
                      setEditedOrderData(null);
                    }}
                    disabled={loading}
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                </>
              )}
              <div className={`px-3 py-1 rounded-md text-sm font-medium text-center ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <Label className="font-medium">Estado</Label>
              <div className="mt-1 flex items-center gap-2">
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={order.status}
                  onChange={(e) => handleStatusUpdate(Number(order.id), e.target.value)}
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

          {/* Estado del Proceso */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-medium">Estado del Proceso</h4>
            <div className="space-y-4">
              {/* Email Status */}
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${rawOrder.correo_enviado ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span>
                  Correo de confirmación: {rawOrder.correo_enviado ? 'Enviado' : 'Pendiente'}
                </span>
              </div>

              {/* Payment Status */}
              <div className="flex items-center gap-2">
                {isEditingPayment ? (
                  <Input
                    type="text"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    placeholder="Detalles del pago (ej: Transferencia #123)"
                  />
                ) : (
                  <>
                    <div className={`w-3 h-3 rounded-full ${paymentStatus ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span 
                      className={`cursor-pointer ${paymentStatus ? 'hover:underline' : ''}`}
                      onClick={() => paymentStatus && setShowPaymentDetails(true)} // Mostrar detalles al hacer clic si hay valor
                    >
                      Estado del pago: {paymentStatus ? 'Completo' : 'Pendiente'}
                    </span>
                    {/* Modal o Tooltip para mostrar detalles del pago */}
                    {showPaymentDetails && paymentStatus && (
                      <Dialog open={showPaymentDetails} onOpenChange={setShowPaymentDetails}>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Detalles del Pago</DialogTitle>
                          </DialogHeader>
                          <div className="py-4">
                            <p>{paymentStatus}</p>
                          </div>
                          <DialogFooter>
                            <Button onClick={() => setShowPaymentDetails(false)}>Cerrar</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => {
                    if (isEditingPayment) {
                      handlePaymentUpdate(paymentStatus); // Enviar el valor string
                    }
                    setIsEditingPayment(!isEditingPayment);
                  }}
                >
                  {isEditingPayment ? <Save className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Enlaces a PDFs */}
          <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
            {order.metadata.pdf_on_hold_url && (
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 h-auto py-3"
                onClick={() => window.open(order.metadata.pdf_on_hold_url, '_blank')}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="text-left">Ver PDF de Presupuesto</span>
              </Button>
            )}
            {order.metadata.pdf_processing_url && (
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 h-auto py-3"
                onClick={() => window.open(order.metadata.pdf_processing_url, '_blank')}
              >
                <FileCheck className="h-4 w-4 shrink-0" />
                <span className="text-left">Ver PDF de Contrato</span>
              </Button>
            )}
          </div>
          {/* Client Info */}
          {renderClientInfo()}

          {/* Project Info */}
          {renderProjectInfo()}

          {/* Product Info */}
          {renderProductInfo()}

          {/* Cost Summary */}
          {renderCostSummary()}
          


          {/* Notas */}
          <div className="space-y-2">
            <Label className="font-medium">Notas</Label>
            <OrderNotes orderId={transformedOrder.id.toString()} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderDetails;

// Asegúrate de importar Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter si no están ya importados
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../ui/dialog'; // Ajusta la ruta si es necesario