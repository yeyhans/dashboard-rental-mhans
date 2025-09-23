import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { OrderNotes } from './OrderNotes';
import { OrderCostSummary } from './OrderCostSummary';
import { ProductSelector } from './ProductSelector';
import { OrderStatusManager } from './OrderStatusManager';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const SaveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17,21 17,13 7,13 7,21" />
    <polyline points="7,3 7,8 15,8" />
  </svg>
);

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

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

// Payment status colors (agregado)
const paymentStatusColors: { [key: string]: string } = {
  'true': 'bg-[#c6e1c6] text-[#5b841b]',
  'false': 'bg-[#f8dda7] text-[#94660c]'
};

// Payment status text (agregado)
const paymentStatusText: { [key: string]: string } = {
  'true': 'Pagado',
  'false': 'Pendiente'
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


interface LineItem {
  id?: number;
  name: string;
  product_id?: number;
  variation_id?: number;
  quantity: number;
  subtotal: string | number;
  subtotal_tax?: string | number;
  total: string | number;
  total_tax?: string | number;
  price?: string | number;
  sku?: string;
  meta_data?: any[];
}

interface Metadata {
  id?: number;
  key: string;
  value: any;
}

interface Order {
  id: number;
  status: string;
  currency?: string;
  date_created: string;
  date_modified?: string;
  date_completed?: string | null;
  total: number;
  subtotal?: number;
  discount_total?: number;
  tax_total?: number;
  shipping_total?: number;
  customer_id?: number;
  user_profiles?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  billing_first_name?: string;
  billing_last_name?: string;
  billing_company?: string;
  billing_address_1?: string;
  billing_address_2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postcode?: string;
  billing_country?: string;
  billing_email?: string;
  billing_phone?: string;
  shipping_first_name?: string;
  shipping_last_name?: string;
  shipping_company?: string;
  shipping_address_1?: string;
  shipping_address_2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_postcode?: string;
  shipping_country?: string;
  payment_method?: string;
  payment_method_title?: string;
  transaction_id?: string;
  customer_note?: string;
  line_items?: string | LineItem[];
  tax_lines?: string | any[];
  refunds?: string | any[];
  meta_data?: string | Metadata[];
  metadata?: any;
  order_proyecto?: string;
  order_fecha_inicio?: string;
  order_fecha_termino?: string;
  order_fecha_retiro?: string;
  company_rut?: string;
  num_jornadas?: number;
  pdf_url?: string;
  pdf_on_hold_url?: string;
  new_pdf_url?: string;
  new_pdf_on_hold_url?: string;
  correo_enviado?: boolean;
  pago_completo?: boolean;
  billing?: {
    first_name?: string;
    last_name?: string;
    company?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    email?: string;
    phone?: string;
  };
}

interface OrderDetailsProps {
  order: Order;
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
  // Debug para ver qué valores se reciben
  console.log('OrderDetails recibió:', {
    pago_completo: rawOrder.pago_completo,
    orden_compra: rawOrder.orden_compra,
    numero_factura: rawOrder.numero_factura,
    tipo_pago_completo: typeof rawOrder.pago_completo
  });

  const [isEditingPayment, setIsEditingPayment] = useState(false);
  // Estado para manejar pago_completo como 'true'/'false' en formato string
  const [paymentStatus, setPaymentStatus] = useState<string>(() => {
    if (typeof rawOrder.pago_completo === 'boolean') {
      return rawOrder.pago_completo ? 'true' : 'false';
    } else if (typeof rawOrder.pago_completo === 'string') {
      return rawOrder.pago_completo === 'true' ? 'true' : 'false';
    }
    return 'false'; // Valor por defecto
  });
  
  // Nuevos estados para OC y número de factura
  const [ordenCompra, setOrdenCompra] = useState<string>(rawOrder.orden_compra || '');
  const [numeroFactura, setNumeroFactura] = useState<string>(rawOrder.numero_factura || '');

  // Effect para actualizar los estados cuando cambian las props
  useEffect(() => {
    console.log('Props de orden actualizadas:', {
      pago_completo: rawOrder.pago_completo,
      orden_compra: rawOrder.orden_compra,
      numero_factura: rawOrder.numero_factura
    });
    
    // Actualizar status de pago
    if (typeof rawOrder.pago_completo === 'boolean') {
      setPaymentStatus(rawOrder.pago_completo ? 'true' : 'false');
    } else if (typeof rawOrder.pago_completo === 'string') {
      setPaymentStatus(rawOrder.pago_completo === 'true' ? 'true' : 'false');
    }
    
    // Actualizar OC y factura
    if (rawOrder.orden_compra) setOrdenCompra(rawOrder.orden_compra);
    if (rawOrder.numero_factura) setNumeroFactura(rawOrder.numero_factura);
  }, [rawOrder.pago_completo, rawOrder.orden_compra, rawOrder.numero_factura]);

  const handlePaymentUpdate = async (isPaymentComplete: boolean) => {
    console.log('Actualizando estado de pago:', { 
      isPaymentComplete, 
      ordenCompra, 
      numeroFactura,
      orderId: rawOrder.id 
    });
    
    try {
      // Simplificar: solo enviar true/false como string
      const paymentValue = isPaymentComplete ? 'true' : 'false';
      
      // Preparar los datos a enviar
      const metaData = [
        { key: 'pago_completo', value: paymentValue }
      ];
      
      // Agregar orden_compra y numero_factura solo si tienen valor
      if (ordenCompra.trim()) {
        metaData.push({ key: 'orden_compra', value: ordenCompra.trim() });
      }
      
      if (numeroFactura.trim()) {
        metaData.push({ key: 'numero_factura', value: numeroFactura.trim() });
      }
      
      console.log('Enviando meta_data a WooCommerce:', metaData);
      
      // Actualización en WooCommerce
      const wooResponse = await fetch(`/api/woo/update-orders`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: rawOrder.id,
          meta_data: metaData
        })
      });

      if (!wooResponse.ok) {
        console.error('Error en respuesta de WooCommerce:', await wooResponse.text());
        throw new Error('Error al actualizar el estado de pago en WooCommerce');
      }

      // Preparar datos para WordPress
      const wpData: {
        pago_completo: string;
        orden_compra?: string;
        numero_factura?: string;
      } = {
        pago_completo: paymentValue
      };
      
      // Agregar OC y factura solo si tienen valor
      if (ordenCompra.trim()) {
        wpData.orden_compra = ordenCompra.trim();
      }
      
      if (numeroFactura.trim()) {
        wpData.numero_factura = numeroFactura.trim();
      }
      
      console.log('Enviando datos a WordPress:', wpData);
      
      // Actualización en WordPress
      const wpResponse = await fetch(`/api/wp/update-order/${rawOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wpData)
      });

      if (!wpResponse.ok) {
        console.error('Error en respuesta de WordPress:', await wpResponse.text());
        throw new Error('Error al actualizar el estado de pago en WordPress');
      }
      
      const wpResponseData = await wpResponse.json();
      console.log('Respuesta de la API WordPress:', wpResponseData);

      const wooResponseData = await wooResponse.json();
      console.log('Respuesta de la API Woo:', wooResponseData);

      if (wooResponseData.success) {
        // Actualizar estados locales
        setPaymentStatus(isPaymentComplete ? 'true' : 'false');
        setIsEditingPayment(false);
        
        // Mensaje de éxito
        alert('Estado de pago actualizado correctamente');
        
        // Recargar la página para mostrar los datos actualizados
        window.location.reload();
      } else {
        alert(`Error al actualizar en WooCommerce: ${wooResponseData.message}`);
      }
    } catch (err) {
      console.error('Error al actualizar el estado de pago', err);
      alert('Error al actualizar el estado de pago: ' + (err instanceof Error ? err.message : 'Error desconocido'));
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

    // Transform line items - handle both array and JSON string formats
    let lineItemsArray = [];
    if (rawOrder.line_items) {
      if (typeof rawOrder.line_items === 'string') {
        try {
          lineItemsArray = JSON.parse(rawOrder.line_items);
        } catch (e) {
          console.error('Error parsing line_items JSON:', e);
          lineItemsArray = [];
        }
      } else if (Array.isArray(rawOrder.line_items)) {
        lineItemsArray = rawOrder.line_items;
      }
    }
    
    const lineItems: LineItem[] = lineItemsArray.map((item: any) => ({
      id: item.id || Math.random(),
      name: item.name || 'Producto sin nombre',
      product_id: item.product_id || item.id,
      sku: item.sku || '',
      price: item.price || '0',
      quantity: item.quantity || 1,
      image: item.image?.src || item.image || ''
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
      date_modified: rawOrder.date_modified || rawOrder.date_created,
      customer_id: rawOrder.customer_id,
      billing: {
        first_name: rawOrder.billing?.first_name || rawOrder.billing_first_name || '',
        last_name: rawOrder.billing?.last_name || rawOrder.billing_last_name || '',
        company: rawOrder.billing?.company || rawOrder.billing_company || '',
        address_1: rawOrder.billing?.address_1 || rawOrder.billing_address_1 || '',
        city: rawOrder.billing?.city || rawOrder.billing_city || '',
        email: rawOrder.billing?.email || rawOrder.billing_email || '',
        phone: rawOrder.billing?.phone || rawOrder.billing_phone || ''
      },
      metadata,
      line_items: lineItems,
      pago_completo: rawOrder.pago_completo?.toString() || 'false'
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

    // Get the first available image with proper fallback
    let productImage = '';
    if (product.images && product.images.length > 0 && product.images[0]) {
      productImage = product.images[0].src || '';
    }

    const newItem: LineItem = {
      product_id: product.id.toString(),
      quantity: quantity,
      sku: product.sku,
      price: product.price,
      name: product.name,
      image: productImage
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
            <EditIcon />
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
            <EditIcon />
          </Button>
        )}
      </div>
      <div className="bg-card rounded-lg border">
        {isEditingProducts && transformedOrder && editedOrderData ? (
          <ProductSelector
            products={products.map(p => {
              // Properly transform images to match EnhancedProduct interface
              let transformedImages = null;
              if (p.images) {
                try {
                  let imageData;
                  if (typeof p.images === 'string') {
                    imageData = JSON.parse(p.images);
                  } else {
                    imageData = p.images;
                  }
                  
                  // Ensure images array has the correct structure
                  if (Array.isArray(imageData)) {
                    transformedImages = imageData.map((img, index) => ({
                      id: img.id || index,
                      src: img.src || img.url || img,
                      alt: img.alt || p.name || 'Product image'
                    }));
                  } else if (imageData.src || imageData.url) {
                    // Single image object
                    transformedImages = [{
                      id: imageData.id || 0,
                      src: imageData.src || imageData.url,
                      alt: imageData.alt || p.name || 'Product image'
                    }];
                  }
                } catch (error) {
                  console.warn('Error parsing product images for product', p.id, error);
                  transformedImages = null;
                }
              }
              
              return {
                ...p,
                images: transformedImages
              };
            })}
            lineItems={transformedOrder.line_items.map(item => ({
              id: item.id || Math.random(),
              product_id: typeof item.product_id === 'string' ? parseInt(item.product_id) : (item.product_id || 0),
              product_name: item.name || '',
              product_price: typeof item.price === 'string' ? parseFloat(item.price) : (item.price || 0),
              quantity: item.quantity || 1,
              total: (typeof item.price === 'string' ? parseFloat(item.price) : (item.price || 0)) * (item.quantity || 1),
              sku: item.sku || '',
              image: item.image || ''
            }))}
            numDays={parseInt(editedOrderData.metadata.num_jornadas) || 0}
            onAddProduct={(product, quantity) => {
              handleAddProduct(product, quantity);
            }}
            onRemoveProduct={handleRemoveProduct}
            onUpdateProduct={(itemId, updates) => {
              if (handleUpdateProduct) {
                const convertedUpdates = {
                  ...updates,
                  price: updates.product_price?.toString(),
                  name: updates.product_name
                };
                handleUpdateProduct(itemId, convertedUpdates);
              }
            }}
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

    const baseSubtotal = (transformedOrder.line_items as any[])?.reduce(
      (sum: number, item: any) => sum + (parseFloat(item.price) * item.quantity), 0
    ).toString() || '0';

    if (isEditingOrder && editedOrderData) {
      return (
        <OrderCostSummary
          baseSubtotal={baseSubtotal}
          subtotal={(editedOrderData as any).metadata.calculated_subtotal}
          discount={(editedOrderData as any).metadata.calculated_discount}
          iva={(editedOrderData as any).metadata.calculated_iva}
          total={(editedOrderData as any).metadata.calculated_total}
          shipping={transformedOrder.shipping_total?.toString() || '0'}
          numDays={parseInt((editedOrderData as any).metadata.num_jornadas)}
          onDiscountChange={handleDiscountChange}
          onShippingChange={(value: string) => {
            if (editedOrderData) {
              const numDays = parseInt((editedOrderData as any).metadata.num_jornadas) || 1;
              const subtotalNum = parseFloat((editedOrderData as any).metadata.calculated_subtotal) || 0;
              const discountNum = parseFloat((editedOrderData as any).metadata.calculated_discount) || 0;
              const shippingNum = parseFloat(value) || 0;
              const ivaNum = parseFloat((editedOrderData as any).metadata.calculated_iva) || 0;
              
              const newTotal = subtotalNum - discountNum + shippingNum + ivaNum;
              
              setEditedOrderData({
                ...editedOrderData,
                shipping_total: parseFloat(value),
                calculated_total: newTotal
              });
            }
          }}
          onTotalChange={handleIvaChange}
          mode="edit"
          loading={loading}
          showCoupons={false}
          showShipping={true}
        />
      );
    }

    // Helper function to format currency
    const formatCurrency = (value: string | number) => {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };

    // Get shipping total from order
    const shippingTotal = transformedOrder.shipping_total?.toString() || '0';
    
    // Get coupon information from coupon_lines
    let couponDiscount = '0';
    let appliedCouponCode = '';
    
    if (transformedOrder.coupon_lines) {
      try {
        const couponLines = typeof transformedOrder.coupon_lines === 'string' 
          ? JSON.parse(transformedOrder.coupon_lines) 
          : transformedOrder.coupon_lines;
        
        if (Array.isArray(couponLines) && couponLines.length > 0) {
          const firstCoupon = couponLines[0];
          couponDiscount = firstCoupon.discount?.toString() || '0';
          appliedCouponCode = firstCoupon.code || '';
        }
      } catch (error) {
        console.error('Error parsing coupon_lines:', error);
      }
    }

    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium mb-2">Resumen de Costos</h4>
        <div className="space-y-2 bg-muted/50 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <span>Valor Base</span>
            <span>${formatCurrency(baseSubtotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Subtotal con Jornadas</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">x {(transformedOrder as any).metadata?.num_jornadas || transformedOrder.num_jornadas} jornadas</span>
              <span>${formatCurrency(transformedOrder.calculated_subtotal)}</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span>Descuento Manual</span>
            <span className="text-red-600">-${formatCurrency(transformedOrder.calculated_discount)}</span>
          </div>
          {parseFloat(couponDiscount) > 0 && (
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span>Cupón</span>
                {appliedCouponCode && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    {appliedCouponCode}
                  </span>
                )}
              </span>
              <span className="text-green-600">-${formatCurrency(couponDiscount)}</span>
            </div>
          )}
          {parseFloat(shippingTotal) > 0 && (
            <div className="flex justify-between items-center">
              <span>Envío</span>
              <span className="text-blue-600">${formatCurrency(shippingTotal)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>IVA (19%)</span>
            <span>${formatCurrency(transformedOrder.calculated_iva)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
            <span>Total</span>
            <span className="text-green-600">${formatCurrency(transformedOrder.calculated_total)}</span>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced order management functions
  const handleStatusChange = async (orderId: number, newStatus: string, reason?: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, reason })
      });
      
      if (!response.ok) throw new Error('Failed to update status');
      
      // Reload page to show updated data
      window.location.reload();
    } catch (error) {
      console.error('Error updating status:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async (orderId: number, emailType: string, customMessage?: string) => {
    const response = await fetch(`/api/orders/${orderId}/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: emailType, message: customMessage })
    });
    
    if (!response.ok) throw new Error('Failed to send email');
  };

  const handleGenerateDocument = async (orderId: number, documentType: string) => {
    const response = await fetch(`/api/orders/${orderId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: documentType })
    });
    
    if (!response.ok) throw new Error('Failed to generate document');
    
    // Open generated document
    const result = await response.json();
    if (result.url) {
      window.open(result.url, '_blank');
    }
  };

  const handleDuplicateOrder = async (orderId: number) => {
    const response = await fetch(`/api/orders/${orderId}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) throw new Error('Failed to duplicate order');
    
    const result = await response.json();
    if (result.newOrderId) {
      window.location.href = `/orders/${result.newOrderId}`;
    }
  };

  const handleRecalculateOrder = async (orderId: number) => {
    if (!transformedOrder || !editedOrderData) return;
    
    // Trigger recalculation with current line items
    updateCalculations(transformedOrder.line_items);
  };

  return (
    <div className="space-y-6">
      {/* Header with navigation and quick actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.href = '/orders'}
              >
                ← Volver a pedidos
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Pedido #{order.id}</h1>
                <p className="text-sm text-muted-foreground">
                  Creado el {formatDate(order.date_created)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {(isEditingOrder || isEditingProducts) && (
                <>
                  <Button
                    onClick={handleSaveOrderChanges}
                    disabled={loading}
                    size="sm"
                  >
                    <SaveIcon />
                    Guardar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditingOrder(false);
                      setIsEditingProducts(false);
                      setEditedOrderData(null);
                    }}
                    disabled={loading}
                    size="sm"
                  >
                    Cancelar
                  </Button>
                </>
              )}
              <Badge className={`${statusColors[order.status] || 'bg-gray-100 text-gray-800'} border`}>
                {statusTranslations[order.status] || order.status}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main content with tabs */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Detalles</TabsTrigger>
          <TabsTrigger value="status">Estado</TabsTrigger>
          <TabsTrigger value="actions">Acciones</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>
        
        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="font-medium">Estado Actual</Label>
                  <div className="mt-1">
                    <Badge className={`${statusColors[order.status] || 'bg-gray-100 text-gray-800'} border`}>
                      {statusTranslations[order.status] || order.status}
                    </Badge>
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
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isEditingPayment ? (
                        <div className="flex flex-col w-full gap-2">
                          <div className="flex items-center w-full gap-2">
                            <div className="flex items-center gap-2">
                              <label className="inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer"
                                  checked={paymentStatus === 'true'}
                                  onChange={(e) => setPaymentStatus(e.target.checked ? 'true' : 'false')}
                                />
                                <div className="relative w-11 h-6 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                <span className="ml-3 text-sm font-medium">
                                  {paymentStatus === 'true' ? 'Pagado' : 'No pagado'}
                                </span>
                              </label>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Orden de Compra</Label>
                              <Input
                                type="text"
                                value={ordenCompra}
                                onChange={(e) => setOrdenCompra(e.target.value)}
                                placeholder="OC"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Número de Factura</Label>
                              <Input
                                type="text"
                                value={numeroFactura}
                                onChange={(e) => setNumeroFactura(e.target.value)}
                                placeholder="Factura"
                                className="mt-1"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center gap-2">
                              <div 
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentStatusColors[paymentStatus]}`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => setIsEditingPayment(true)}
                              >
                                {paymentStatusText[paymentStatus]}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => {
                        if (isEditingPayment) {
                          handlePaymentUpdate(paymentStatus === 'true');
                        }
                        setIsEditingPayment(!isEditingPayment);
                      }}
                    >
                      {isEditingPayment ? <SaveIcon /> : <EditIcon />}
                    </Button>
                  </div>
                  
                  {/* Información de OC y Factura (visible cuando no está editando) */}
                  {!isEditingPayment && (
                    <div className="space-y-2 p-3 rounded-md">
                      <h5 className="text-sm font-medium">Información de Facturación</h5>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Orden de Compra</Label>
                          <div className={`mt-1 p-2 border rounded ${ordenCompra ? '' : 'text-gray-400 italic'}`}>
                            {ordenCompra || 'No especificado'}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Número de Factura</Label>
                          <div className={`mt-1 p-2 border rounded ${numeroFactura ? '' : 'text-gray-400 italic'}`}>
                            {numeroFactura || 'No especificado'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
        </TabsContent>
        
        <TabsContent value="status">
          <OrderStatusManager
            orderId={order.id}
            currentStatus={order.status}
            paymentStatus={paymentStatus === 'true' ? 'paid' : 'pending'}
            onStatusChange={handleStatusChange}
            onPaymentStatusChange={async (orderId, status) => {
              await handlePaymentUpdate(status === 'paid');
            }}
            loading={loading}
          />
        </TabsContent>
        
        <TabsContent value="actions">
          <OrderActions
            orderId={order.id}
            orderStatus={order.status}
            customerEmail={order.billing.email}
            total={parseFloat(order.metadata.calculated_total) || 0}
            currency="CLP"
            onRefresh={() => window.location.reload()}
            onDuplicate={handleDuplicateOrder}
            onSendEmail={handleSendEmail}
            onGenerateDocument={handleGenerateDocument}
            onRecalculate={handleRecalculateOrder}
            loading={loading}
            allowDangerousActions={true}
          />
        </TabsContent>
        
        <TabsContent value="history">
          <OrderHistory
            orderId={order.id}
            loading={loading}
            showFilters={true}
            maxHeight="600px"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrderDetails;