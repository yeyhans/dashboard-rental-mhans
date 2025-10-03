import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Edit, Package, Image as ImageIcon, Hash, Save, X, Tag, Truck, Plus, Minus, Trash2, FileText, FileCheck, Mail, Send, Paperclip, MapPin, CheckCircle, Camera, Eye } from 'lucide-react';
import EditOrderForm from './EditOrderForm';
import { CouponSelector } from './CouponSelector';
import { ProductSelector } from './ProductSelector';
import { ShippingService, type ShippingMethod, formatShippingCost, formatDeliveryTime } from '../../services/shippingService';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { apiClient } from '@/services/apiClient';
import type { Database } from '@/types/database';
import { toast } from 'sonner';
import { WarrantyImageUpload } from './WarrantyImageUpload';
import { generateOrderProcessingPdfFromId, generateBudgetPdfFromId } from '@/lib/orderPdfGenerationService';
import { createEventFromOrder, openGoogleCalendar } from '@/lib/simpleCalendar';
import { sendManualEmail, validateManualEmailData, type ManualEmailData } from '@/services/manualEmailService';


type Coupon = Database['public']['Tables']['coupons']['Row'];

// Enhanced interfaces using proper database types
type DatabaseOrder = Database['public']['Tables']['orders']['Row'];
type DatabaseProduct = Database['public']['Tables']['products']['Row'];

interface EnhancedLineItem {
  id?: number;
  name: string;
  product_id: number;
  quantity: number;
  subtotal: string | number;
  total: string | number;
  price?: string | number;
  sku?: string;
  images?: string[];
  description?: string;
  short_description?: string;
  stock_status?: string;
}

interface EnhancedOrder extends Omit<DatabaseOrder, 'line_items' | 'pago_completo'> {
  line_items?: EnhancedLineItem[];
  customer?: {
    id?: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  pago_completo?: boolean | string | null;
}

interface WPOrderResponse {
  orders: {
    success: boolean;
    orders: EnhancedOrder[];
  }
}


function ProcessOrder({ order, sessionData, allProducts }: { order: WPOrderResponse, sessionData?: any, allProducts?: DatabaseProduct[] }) {

  const orderData = order?.orders?.orders?.[0];
  
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productsData, setProductsData] = useState<DatabaseProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  // Financial editing states
  const [isEditingFinancials, setIsEditingFinancials] = useState(false);
  const [editedShipping, setEditedShipping] = useState(orderData?.shipping_total?.toString() || '0');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponDiscountAmount, setCouponDiscountAmount] = useState(0);
  const [savingFinancials, setSavingFinancials] = useState(false);
  
  // Shipping method states (siguiendo patrón de CreateOrderForm)
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<ShippingMethod | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'shipping'>(
    orderData?.shipping_total && parseFloat(orderData.shipping_total.toString()) > 0 ? 'shipping' : 'pickup'
  );
  
  // Product editing states
  const [editedProducts, setEditedProducts] = useState<EnhancedLineItem[]>([]);
  const [showProductSelector, setShowProductSelector] = useState(false);
  // editedManualDiscount removed - no longer using manual discounts
  
  // Warranty photos states
  const [warrantyPhotos, setWarrantyPhotos] = useState<string[]>([]);
  
  // Order PDF generation states
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingBudget, setGeneratingBudget] = useState(false);
  
  // Manual email states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailData, setEmailData] = useState({
    subject: '',
    message: '',
    emailType: 'availability_confirmation' as 'availability_confirmation' | 'order_update' | 'warranty_photos' | 'custom',
    includeBudget: false,
    includeContract: false,
    selectedBudgetUrls: [] as string[] // For multiple budget selection
  });
  
  // Initialize coupon, shipping and product state from order data
  useEffect(() => {
    console.log('🔄 Initializing order data values:', {
      orderId: orderData?.id,
      coupon_lines: orderData?.coupon_lines,
      shipping_total: orderData?.shipping_total,
      calculated_discount: orderData?.calculated_discount,
      shipping_lines: orderData?.shipping_lines
    });
    
    if (orderData?.coupon_lines) {
      try {
        const couponLines = typeof orderData.coupon_lines === 'string' 
          ? JSON.parse(orderData.coupon_lines) 
          : orderData.coupon_lines;
        
        console.log('🎫 Parsed coupon_lines:', couponLines);
        
        if (Array.isArray(couponLines) && couponLines.length > 0) {
          const firstCoupon = couponLines[0];
          // Reconstruct coupon object from stored data
          if (firstCoupon.id && firstCoupon.code) {
            console.log('✅ Applying coupon from order data:', firstCoupon.code, 'discount:', firstCoupon.discount);
            setAppliedCoupon({
              id: firstCoupon.id,
              code: firstCoupon.code,
              amount: firstCoupon.amount,
              discount_type: firstCoupon.discount_type,
              description: null,
              date_created: new Date().toISOString(),
              date_modified: new Date().toISOString(),
              date_expires: null,
              usage_count: 0,
              usage_limit: null,
              usage_limit_per_user: null,
              status: 'publish',
              minimum_amount: null,
              maximum_amount: null,
              individual_use: false,
              exclude_sale_items: false,
              created_by: null,
              metadata: {}
            } as Coupon);
            setCouponDiscountAmount(parseFloat(firstCoupon.discount || '0'));
          }
        }
      } catch (error) {
        console.error('❌ Error parsing coupon_lines:', error);
      }
    }
    
    // Initialize shipping total
    if (orderData?.shipping_total) {
      console.log('🚚 Setting shipping total from order data:', orderData.shipping_total);
      setEditedShipping(orderData.shipping_total.toString());
    }
    
    // Initialize calculated_discount if it exists (for display purposes)
    // Note: Manual discount editing was removed, but we still need to show existing values
    if (orderData?.calculated_discount) {
      console.log('💰 Found existing calculated_discount:', orderData.calculated_discount);
      // The calculated_discount is now handled automatically through coupon calculations
      // but we log it for reference
    }
    
    console.log('ℹ️ Order data initialization completed');
  }, [orderData]);

  if (!order || !order.orders) {
    console.log('No order data received');
    return (
      <div className="mt-6 p-4 bg-destructive/10 text-destructive rounded-md">
        No se encontraron datos de la orden
      </div>
    );
  }

  if (!order.orders.orders || !Array.isArray(order.orders.orders)) {
    console.log('Orders array is missing or invalid');
    return (
      <div className="mt-6 p-4 bg-destructive/10 text-destructive rounded-md">
        Estructura de datos inválida
      </div>
    );
  }

  // orderData is now defined above in useEffect
  
  if (!orderData) {
    console.log('No order found in array');
    return (
      <div className="mt-6 p-4 bg-destructive/10 text-destructive rounded-md">
        No se encontraron datos de la orden
      </div>
    );
  }

  // Load product details for enhanced display
  useEffect(() => {
    const loadProductDetails = async () => {
      if (!orderData?.line_items || orderData.line_items.length === 0) return;
      
      setLoadingProducts(true);
      try {
        const productIds = orderData.line_items
          .map(item => {
            // Ensure we convert to number if it's a string
            const id = item.product_id;
            const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
            console.log(`🔍 Processing item "${item.name}": product_id=${id} (${typeof id}) → ${numericId} (${typeof numericId})`);
            return numericId;
          })
          .filter((id): id is number => {
            const isValid = id && !isNaN(id);
            if (!isValid) {
              console.warn(`❌ Invalid product_id filtered out: ${id}`);
            }
            return isValid;
          });
        
        if (productIds.length > 0) {
          console.log('🔄 Loading product details for IDs:', productIds);
          const response = await apiClient.post('/api/products/batch', { ids: productIds });
          const result = await apiClient.handleJsonResponse<{success: boolean, data: DatabaseProduct[]}>(response);
          
          if (result.success) {
            console.log('✅ Products loaded successfully:', result.data?.length || 0, 'products');
            console.log('📦 Loaded product IDs:', result.data?.map(p => p.id) || []);
            console.log('📊 Product stock status:', result.data?.map(p => ({ id: p.id, name: p.name, stock_status: p.stock_status })) || []);
            
            // Check for missing products
            const loadedIds = (result.data || []).map(p => p.id).filter((id): id is number => id !== undefined);
            const missingIds = productIds.filter(id => !loadedIds.includes(id));
            if (missingIds.length > 0) {
              console.warn('⚠️ Products not found in database:', missingIds);
            }
            
            setProductsData(result.data || []);
          } else {
            console.error('❌ Failed to load products:', result);
          }
        }
      } catch (error) {
        console.error('Error loading product details:', error);
      } finally {
        setLoadingProducts(false);
      }
    };

    loadProductDetails();
  }, [orderData?.line_items]);

  
  // Enhanced order data display with all available information
  const getCustomerName = () => {
    if (orderData.customer) {
      return `${orderData.customer.first_name} ${orderData.customer.last_name}`;
    }
    return `${orderData.billing_first_name || ''} ${orderData.billing_last_name || ''}`;
  };
  
  const getCustomerEmail = () => {
    return orderData.customer?.email || orderData.billing_email || 'No disponible';
  };

  // Enhanced product display helpers
  const getProductDetails = useCallback((productId: number) => {
    return productsData.find(p => p.id === productId);
  }, [productsData]);

  const parseProductImages = useCallback((images: any): string[] => {
    if (!images) return [];
    
    try {
      if (typeof images === 'string') {
        const parsed = JSON.parse(images);
        if (Array.isArray(parsed)) {
          return parsed.map(img => typeof img === 'string' ? img : img.src || img.url || '').filter(Boolean);
        }
        if (parsed.src || parsed.url) {
          return [parsed.src || parsed.url];
        }
      }
      
      if (Array.isArray(images)) {
        return images.map(img => typeof img === 'string' ? img : img.src || img.url || '').filter(Boolean);
      }
      
      if (images.src || images.url) {
        return [images.src || images.url];
      }
    } catch (error) {
      console.warn('Error parsing product images:', error);
    }
    
    return [];
  }, []);


  // Fix payment status comparison
  const isPaymentComplete = useMemo(() => {
    const paymentStatus = orderData.pago_completo;
    return paymentStatus === true || 
           paymentStatus === 'true' || 
           paymentStatus === 'completo' ||
           paymentStatus === 'completed';
  }, [orderData.pago_completo]);

  // Status translations and colors
  const statusTranslations: { [key: string]: string } = {
    'pending': 'Pendiente',
    'processing': 'En proceso',
    'on-hold': 'En espera',
    'completed': 'Completado',
    'cancelled': 'Cancelado',
    'refunded': 'Reembolsado',
    'failed': 'Fallido'
  };

  const statusColors: { [key: string]: string } = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'processing': 'bg-blue-100 text-blue-800',
    'on-hold': 'bg-gray-100 text-gray-800',
    'completed': 'bg-green-100 text-green-800',
    'cancelled': 'bg-red-100 text-red-800',
    'refunded': 'bg-purple-100 text-purple-800',
    'failed': 'bg-red-100 text-red-800'
  };

  const handleSaveOrder = async (updatedOrder: any) => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/orders/update/${orderData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedOrder)
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Pedido actualizado correctamente');
        setIsEditing(false);
        // Reload the page to show updated data
        window.location.reload();
      } else {
        alert(`Error al actualizar: ${result.message}`);
      }
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Error al actualizar el pedido');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  // Financial editing handlers
  const handleCouponApplied = (coupon: Coupon, discountAmount: number) => {
    setAppliedCoupon(coupon);
    setCouponDiscountAmount(discountAmount);
    toast.success(`Cupón aplicado: ${coupon.code}`, {
      description: `Descuento de $${discountAmount.toLocaleString('es-CL')}`
    });
  };

  const handleCouponRemoved = () => {
    setAppliedCoupon(null);
    setCouponDiscountAmount(0);
    toast.info('Cupón removido');
  };

  // Funciones de cálculo siguiendo la misma lógica que CreateOrderForm.tsx
  const calculateProductsSubtotal = (lineItems: any[], numDays: number) => {
    // 1. Subtotal de productos (precio × cantidad × días)
    const dailySubtotal = lineItems.reduce((sum, item) => {
      const price = parseFloat(item.price?.toString() || '0');
      const quantity = parseInt(item.quantity?.toString() || '0');
      return sum + (price * quantity);
    }, 0);
    return dailySubtotal * numDays;
  };

  const calculateCalculatedSubtotal = (
    productsSubtotal: number, 
    shippingTotal: number, 
    couponDiscount: number
  ) => {
    // 2. CALCULATED_SUBTOTAL = subtotal productos + envío - descuento cupón
    return productsSubtotal + shippingTotal - couponDiscount;
  };

  const calculateCalculatedIVA = (calculatedSubtotal: number, applyIva: boolean = true) => {
    // 3. CALCULATED_IVA = calculated_subtotal × 0.19 (solo si apply_iva es true)
    return applyIva ? calculatedSubtotal * 0.19 : 0;
  };

  const calculateCalculatedTotal = (calculatedSubtotal: number, calculatedIva: number) => {
    // 4. CALCULATED_TOTAL = calculated_subtotal + calculated_iva
    return calculatedSubtotal + calculatedIva;
  };

  // Función para actualizar todos los cálculos siguiendo la fórmula correcta
  const updateAllCalculations = (
    lineItems: any[], 
    numDays: number,
    shipping: number = 0,
    couponDiscount: number = 0
  ) => {
    // 1. Subtotal de productos
    const productsSubtotal = calculateProductsSubtotal(lineItems, numDays);
    
    // 2. CALCULATED_SUBTOTAL = productos + envío - descuento cupón
    const calculatedSubtotal = calculateCalculatedSubtotal(productsSubtotal, shipping, couponDiscount);
    
    // 3. CALCULATED_IVA = calculated_subtotal × 0.19
    const calculatedIva = calculateCalculatedIVA(calculatedSubtotal, true);
    
    // 4. CALCULATED_TOTAL = calculated_subtotal + calculated_iva
    const calculatedTotal = calculateCalculatedTotal(calculatedSubtotal, calculatedIva);



    return {
      products_subtotal: productsSubtotal,
      calculated_subtotal: calculatedSubtotal,
      calculated_discount: couponDiscount, // El descuento aplicado (principalmente cupones)
      calculated_iva: calculatedIva,
      calculated_total: calculatedTotal
    };
  };

  const calculateEditedSubtotal = () => {
    // Para compatibilidad con código existente - solo subtotal de productos
    const numDays = parseInt(orderData.num_jornadas?.toString() || '1');
    return calculateProductsSubtotal(editedProducts, numDays);
  };

  const calculateUpdatedTotal = () => {
    // Usar las nuevas funciones de cálculo
    const numDays = parseInt(orderData.num_jornadas?.toString() || '1');
    const shipping = parseFloat(editedShipping || '0');
    const calculations = updateAllCalculations(
      editedProducts,
      numDays,
      shipping,
      couponDiscountAmount
    );
    return calculations.calculated_total;
  };

  const handleSaveFinancials = async () => {
    try {
      setSavingFinancials(true);
      
      // Usar las nuevas funciones de cálculo siguiendo CreateOrderForm.tsx
      const numDays = parseInt(orderData.num_jornadas?.toString() || '1');
      const shipping = parseFloat(editedShipping || '0');
      const calculations = updateAllCalculations(
        editedProducts,
        numDays,
        shipping,
        couponDiscountAmount
      );
      
      // Prepare updated order data
      const updatedOrderData = {
        id: orderData.id,
        line_items: editedProducts.map(item => ({
          id: item.id,
          name: item.name,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          subtotal: item.subtotal,
          sku: item.sku
        })),
        // Usar los cálculos actualizados siguiendo la fórmula de CreateOrderForm
        calculated_subtotal: calculations.calculated_subtotal,
        calculated_discount: calculations.calculated_discount, // Descuento aplicado (cupones)
        calculated_iva: calculations.calculated_iva,
        shipping_total: shipping,
        coupon_lines: appliedCoupon ? [{
          id: appliedCoupon.id,
          code: appliedCoupon.code,
          discount: couponDiscountAmount,
          discount_type: appliedCoupon.discount_type,
          amount: appliedCoupon.amount,
          meta_data: {
            coupon_id: appliedCoupon.id.toString(),
            coupon_amount: appliedCoupon.amount.toString(),
            original_amount: calculations.products_subtotal.toString(),
            applied_to: "cart_total",
            usage_count: 1
          }
        }] : [],
        // Shipping lines profesional usando el método seleccionado
        shipping_lines: deliveryMethod === 'shipping' && selectedShippingMethod ? [{
          ...ShippingService.createShippingLine(
            selectedShippingMethod,
            {
              first_name: orderData.billing_first_name || '',
              last_name: orderData.billing_last_name || '',
              address_1: orderData.billing_address_1 || '',
              city: orderData.billing_city || '',
              phone: orderData.billing_phone || ''
            }
          ),
          meta_data: {
            ...ShippingService.createShippingLine(selectedShippingMethod).meta_data,
            delivery_method: deliveryMethod
          }
        }] : [],
        calculated_total: calculations.calculated_total
      };

      const response = await fetch(`/api/orders/${orderData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionData?.access_token && {
            'Authorization': `Bearer ${sessionData.access_token}`
          })
        },
        credentials: 'include',
        body: JSON.stringify(updatedOrderData)
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Pedido actualizado correctamente');
        setIsEditingFinancials(false);
        // Reload the page to show updated data
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        throw new Error(result.error || 'Error al actualizar');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Error al actualizar el pedido');
    } finally {
      setSavingFinancials(false);
    }
  };

  const handleCancelFinancialEdit = () => {
    // Reset to original values
    setEditedShipping(orderData?.shipping_total?.toString() || '0');
    // Force refresh from enhanced line items to ensure we have current data
    console.log('🔄 Resetting editedProducts from enhancedLineItems');
    console.log('📦 Available enhanced items:', enhancedLineItems.length);
    setEditedProducts([...enhancedLineItems]);
    
    // Reset coupon to original state
    if (orderData?.coupon_lines) {
      try {
        const couponLines = typeof orderData.coupon_lines === 'string' 
          ? JSON.parse(orderData.coupon_lines) 
          : orderData.coupon_lines;
        
        if (Array.isArray(couponLines) && couponLines.length > 0) {
          const firstCoupon = couponLines[0];
          if (firstCoupon.id && firstCoupon.code) {
            setAppliedCoupon({
              id: firstCoupon.id,
              code: firstCoupon.code,
              amount: firstCoupon.amount,
              discount_type: firstCoupon.discount_type,
              description: null,
              date_created: new Date().toISOString(),
              date_modified: new Date().toISOString(),
              date_expires: null,
              usage_count: 0,
              usage_limit: null,
              usage_limit_per_user: null,
              status: 'publish',
              minimum_amount: null,
              maximum_amount: null,
              individual_use: false,
              exclude_sale_items: false,
              created_by: null,
              metadata: {}
            } as Coupon);
            setCouponDiscountAmount(parseFloat(firstCoupon.discount || '0'));
          }
        } else {
          setAppliedCoupon(null);
          setCouponDiscountAmount(0);
        }
      } catch (error) {
        console.error('Error resetting coupon:', error);
        setAppliedCoupon(null);
        setCouponDiscountAmount(0);
      }
    } else {
      setAppliedCoupon(null);
      setCouponDiscountAmount(0);
    }
    
    // Reset shipping states
    setDeliveryMethod(
      orderData?.shipping_total && parseFloat(orderData.shipping_total.toString()) > 0 ? 'shipping' : 'pickup'
    );
    setSelectedShippingMethod(null);
    setShippingMethods([]);
    
    setIsEditingFinancials(false);
    setShowProductSelector(false);
    toast.info('Cambios cancelados');
  };

  // Funciones de manejo de shipping (siguiendo patrón de CreateOrderForm)
  const loadShippingMethods = async () => {
    setShippingLoading(true);
    try {
      const shippingResult = await ShippingService.getAllShippingMethods(1, 100, true); // Solo métodos habilitados
      if (shippingResult.shippingMethods && shippingResult.shippingMethods.length > 0) {
        setShippingMethods(shippingResult.shippingMethods);
        
        // Si estamos en modo shipping y no hay método seleccionado, seleccionar el primero
        if (deliveryMethod === 'shipping' && !selectedShippingMethod) {
          const defaultMethod = shippingResult.shippingMethods[0];
          if (defaultMethod) {
            setSelectedShippingMethod(defaultMethod);
            setEditedShipping(defaultMethod.cost.toString());
          }
        }
      }
    } catch (shippingError) {
      console.error('Error loading shipping methods:', shippingError);
      // Fallback a métodos por defecto
      const defaultMethods: ShippingMethod[] = [
        {
          id: 2,
          name: 'Envío Estándar',
          description: 'Envío estándar a todo Chile',
          cost: 5000,
          shipping_type: 'flat_rate',
          enabled: true,
          min_amount: null,
          max_amount: null,
          available_regions: null,
          excluded_regions: null,
          estimated_days_min: 2,
          estimated_days_max: 4,
          requires_address: true,
          requires_phone: true,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      setShippingMethods(defaultMethods);
      if (deliveryMethod === 'shipping' && !selectedShippingMethod) {
        const firstMethod = defaultMethods[0];
        if (firstMethod) {
          setSelectedShippingMethod(firstMethod);
          setEditedShipping(firstMethod.cost.toString());
        }
      }
    } finally {
      setShippingLoading(false);
    }
  };

  const handleShippingMethodSelect = (method: ShippingMethod) => {
    setSelectedShippingMethod(method);
    setEditedShipping(method.cost.toString());
  };

  const handleDeliveryMethodChange = (method: 'pickup' | 'shipping') => {
    setDeliveryMethod(method);
    if (method === 'pickup') {
      setSelectedShippingMethod(null);
      setEditedShipping('0');
    } else if (method === 'shipping' && shippingMethods.length > 0) {
      // Auto-seleccionar el primer método disponible cuando se cambia a shipping
      const firstMethod = shippingMethods[0];
      if (firstMethod) {
        setSelectedShippingMethod(firstMethod);
        setEditedShipping(firstMethod.cost.toString());
      }
    }
  };

  // Cargar métodos de envío cuando se entra en modo de edición (basic loading)
  useEffect(() => {
    if (isEditingFinancials && shippingMethods.length === 0) {
      loadShippingMethods();
    }
  }, [isEditingFinancials, shippingMethods.length]);

  // Enhanced line items with product details
  const enhancedLineItems = useMemo(() => {
    if (!orderData.line_items) return [];
    
    return orderData.line_items.map((item) => {
      const numericProductId = typeof item.product_id === 'string' ? parseInt(item.product_id, 10) : item.product_id;
      const productDetails = getProductDetails(numericProductId || 0);
      const images = productDetails ? parseProductImages(productDetails.images) : [];
      
      // Calculate proper total and subtotal
      const unitPrice = parseFloat(item.price?.toString() || '0');
      const quantity = parseInt(item.quantity?.toString() || '1');
      const calculatedTotal = unitPrice * quantity;
      

      // Log when product details are not found
      if (!productDetails && item.product_id) {
        console.warn(`⚠️ Product details not found for ID: ${item.product_id} (${item.name})`);
        console.log('📋 Available product IDs:', productsData.map(p => p.id));
      }
      
      return {
        ...item,
        product_id: numericProductId || 0, // Ensure product_id is always a number
        price: unitPrice, // Ensure price is a number
        quantity: quantity, // Ensure quantity is a number
        total: calculatedTotal, // Calculate total properly
        subtotal: calculatedTotal, // Calculate subtotal properly
        images,
        description: productDetails?.description || '',
        short_description: productDetails?.short_description || '',
        stock_status: productDetails?.stock_status || (item.product_id ? 'not_found' : 'unknown')
      };
    });
  }, [orderData.line_items, getProductDetails, parseProductImages, productsData]);

  // Initialize edited products from enhanced line items when they change
  useEffect(() => {
    if (enhancedLineItems.length > 0 && editedProducts.length === 0) {
      console.log('🔄 Initializing editedProducts from enhancedLineItems');
      console.log('📦 Enhanced items:', enhancedLineItems.length);
      console.log('🖼️ Images in enhanced items:', enhancedLineItems.map(item => ({ name: item.name, images: item.images?.length || 0 })));
      setEditedProducts([...enhancedLineItems]);
    }
  }, [enhancedLineItems, editedProducts.length]);

  // Force refresh editedProducts when entering edit mode
  useEffect(() => {
    if (isEditingFinancials && enhancedLineItems.length > 0) {
      console.log('🔄 Refreshing editedProducts for edit mode with enhanced data');
      console.log('📦 Enhanced items:', enhancedLineItems.length);
      console.log('🖼️ Images in enhanced items:', enhancedLineItems.map(item => ({ name: item.name, images: item.images?.length || 0 })));
      setEditedProducts([...enhancedLineItems]);
    }
  }, [isEditingFinancials, enhancedLineItems]);

  // Initialize shipping method from existing shipping_lines when entering edit mode
  useEffect(() => {
    if (isEditingFinancials && orderData?.shipping_lines && !selectedShippingMethod) {
      try {
        const shippingLines = typeof orderData.shipping_lines === 'string' 
          ? JSON.parse(orderData.shipping_lines) 
          : orderData.shipping_lines;
        
        if (Array.isArray(shippingLines) && shippingLines.length > 0) {
          const firstShippingLine = shippingLines[0];
          console.log('🚚 Initializing shipping method from existing shipping_lines:', firstShippingLine);
          
          // Crear un método de envío temporal basado en los datos existentes
          const existingMethod: ShippingMethod = {
            id: firstShippingLine.method_id || 0,
            name: firstShippingLine.method_title || 'Método Existente',
            description: firstShippingLine.method_title || '',
            cost: parseFloat(firstShippingLine.total || '0'),
            shipping_type: 'flat_rate', // Use valid shipping type
            enabled: true,
            min_amount: null,
            max_amount: null,
            available_regions: null,
            excluded_regions: null,
            estimated_days_min: 2,
            estimated_days_max: 5,
            requires_address: true,
            requires_phone: true,
            metadata: firstShippingLine.meta_data || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          setSelectedShippingMethod(existingMethod);
          setEditedShipping(existingMethod.cost.toString());
          
          // Determinar el método de entrega basado en el costo
          if (existingMethod.cost > 0) {
            setDeliveryMethod('shipping');
          } else {
            setDeliveryMethod('pickup');
          }
        }
      } catch (error) {
        console.error('Error parsing shipping_lines:', error);
      }
    }
  }, [isEditingFinancials, orderData?.shipping_lines, selectedShippingMethod]);

  // Use products from props (loaded server-side with proper authentication)
  const availableProducts = allProducts || [];


  // Product editing handlers
  const handleAddProduct = (product: DatabaseProduct, quantity: number) => {
    const newItem: EnhancedLineItem = {
      id: Date.now(), // Temporary ID for new items
      name: product.name || '',
      product_id: product.id || 0,
      quantity: quantity,
      price: product.price || product.regular_price || 0,
      total: (product.price || product.regular_price || 0) * quantity,
      subtotal: (product.price || product.regular_price || 0) * quantity,
      sku: product.sku || '',
      images: product.images ? (typeof product.images === 'string' ? JSON.parse(product.images) : product.images) : [],
      description: product.description || '',
      short_description: product.short_description || '',
      stock_status: product.stock_status || 'instock'
    };
    
    setEditedProducts(prev => [...prev, newItem]);
    toast.success(`Producto agregado: ${product.name || 'Producto'} (x${quantity})`);
  };

  const handleRemoveProductFromSelector = (index: number) => {
    const item = editedProducts[index];
    if (!item) return;
    
    const productName = item.name;
    setEditedProducts(prev => prev.filter((_, i) => i !== index));
    toast.info(`Producto removido: ${productName}`);
  };

  const handleQuantityChange = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    setEditedProducts(prev => {
      const updated = [...prev];
      const item = updated[index];
      if (!item) return prev;
      
      const unitPrice = parseFloat(item.price?.toString() || '0');
      
      updated[index] = {
        ...item,
        quantity: newQuantity,
        total: unitPrice * newQuantity,
        subtotal: unitPrice * newQuantity
      };
      
      return updated;
    });
  };

  const handleRemoveProduct = (index: number) => {
    const item = editedProducts[index];
    if (!item) return;
    
    const productName = item.name;
    setEditedProducts(prev => prev.filter((_, i) => i !== index));
    toast.info(`Producto removido: ${productName}`);
  };

  // Initialize warranty photos from order data
  useEffect(() => {
    if (orderData?.fotos_garantia) {
      const photos = Array.isArray(orderData.fotos_garantia) 
        ? orderData.fotos_garantia 
        : Object.values(orderData.fotos_garantia);
      setWarrantyPhotos(photos.filter(Boolean));
    }
  }, [orderData?.fotos_garantia]);

  // Handle warranty photos update
  const handleWarrantyPhotosUpdate = (newPhotos: string[]) => {
    setWarrantyPhotos(newPhotos);
    // Optionally reload the page to sync with server state
    // setTimeout(() => {
    //   window.location.reload();
    // }, 1000);
  };

  // Order PDF generation function
  const handleGenerateOrderPdf = async () => {
    if (!orderData?.id) {
      toast.error('ID de orden no disponible');
      return;
    }

    setGeneratingPdf(true);
    try {
      console.log('🚀 Generating order processing PDF for order:', orderData.id);
      
      const result = await generateOrderProcessingPdfFromId(
        orderData.id,
        true, // uploadToR2
        false // sendEmail (not needed for admin generation)
      );

      if (result.success) {
        toast.success('Contrato de procesamiento generado exitosamente');
        console.log('✅ PDF generated successfully:', result.pdfUrl);
        
        // Crear recordatorio en Google Calendar (solución simple)
        try {
          console.log('📅 Creating calendar reminder for order:', orderData.id);
          const eventData = createEventFromOrder(orderData);
          
          // Abrir Google Calendar automáticamente para agregar el evento
          openGoogleCalendar(eventData);
          
          toast.success('Recordatorio de calendario creado', {
            description: `Se abrió Google Calendar para agregar el evento de la orden #${orderData.id}`
          });
          
          console.log('✅ Calendar reminder opened successfully');
        } catch (calendarError) {
          console.error('💥 Error creating calendar reminder:', calendarError);
          toast.warning('No se pudo abrir el recordatorio de calendario');
        }
        
        // Reload the page to show the new PDF URL
        setTimeout(() => {
          window.location.reload();
        }, 2000); // Aumentado para mostrar mensajes de calendario
      } else {
        throw new Error(result.message || 'Error al generar el contrato');
      }
    } catch (error) {
      console.error('💥 Error generating order PDF:', error);
      toast.error(error instanceof Error ? error.message : 'Error al generar el contrato');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Budget PDF generation function
  const handleGenerateBudgetPdf = async () => {
    if (!orderData?.id) {
      toast.error('ID de orden no disponible');
      return;
    }

    setGeneratingBudget(true);
    try {
      console.log('🚀 Generating budget PDF for order:', orderData.id);
      
      const result = await generateBudgetPdfFromId(
        orderData.id,
        true, // uploadToR2
        false // sendEmail (not needed for admin generation)
      );

      if (result.success) {
        toast.success('Presupuesto generado exitosamente');
        console.log('✅ Budget PDF generated successfully:', result.pdfUrl);
        
        // Reload the page to show the new PDF URL
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        throw new Error(result.message || 'Error al generar el presupuesto');
      }
    } catch (error) {
      console.error('💥 Error generating budget PDF:', error);
      toast.error(error instanceof Error ? error.message : 'Error al generar el presupuesto');
    } finally {
      setGeneratingBudget(false);
    }
  };

  // Update Budget PDF function - generates a new budget and appends to URL history
  const handleUpdateBudgetPdf = async () => {
    if (!orderData?.id) {
      toast.error('ID de orden no disponible');
      return;
    }

    setGeneratingBudget(true);
    try {
      console.log('🔄 Updating budget PDF for order:', orderData.id);
      
      const result = await generateBudgetPdfFromId(
        orderData.id,
        true, // uploadToR2
        false // sendEmail (not needed for admin generation)
      );

      if (result.success) {
        toast.success('Presupuesto actualizado exitosamente');
        console.log('✅ Budget PDF updated successfully:', result.pdfUrl);
        
        // Reload the page to show the updated PDF URL history
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        throw new Error(result.message || 'Error al actualizar el presupuesto');
      }
    } catch (error) {
      console.error('💥 Error updating budget PDF:', error);
      toast.error(error instanceof Error ? error.message : 'Error al actualizar el presupuesto');
    } finally {
      setGeneratingBudget(false);
    }
  };

  // Helper function to get available budget URLs
  const getAvailableBudgetUrls = (): string[] => {
    if (!orderData?.new_pdf_on_hold_url) return [];
    return orderData.new_pdf_on_hold_url
      .split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0);
  };

  // Manual email handlers
  const handleSendManualEmail = async () => {
    if (!orderData?.id) {
      toast.error('ID de orden no disponible');
      return;
    }

    const customerEmail = getCustomerEmail();
    const customerName = getCustomerName();
    
    if (customerEmail === 'No disponible') {
      toast.error('Email del cliente no disponible');
      return;
    }

    // Get warranty photos if email type is warranty_photos
    const warrantyPhotos = emailData.emailType === 'warranty_photos' && orderData.fotos_garantia 
      ? (Array.isArray(orderData.fotos_garantia) ? orderData.fotos_garantia.filter((url): url is string => typeof url === 'string') : [])
      : [];

    // Prepare email data
    const manualEmailData: ManualEmailData = {
      to: customerEmail,
      customerName: customerName,
      orderId: orderData.id,
      projectName: orderData.order_proyecto || 'Proyecto de Arriendo',
      subject: emailData.subject,
      message: emailData.message,
      emailType: emailData.emailType,
      attachments: emailData.selectedBudgetUrls.length > 0 || emailData.includeContract || warrantyPhotos.length > 0 ? {
        ...(emailData.selectedBudgetUrls.length > 0 && { budgetUrls: emailData.selectedBudgetUrls }),
        ...(emailData.includeContract && orderData.new_pdf_processing_url && { contractUrl: orderData.new_pdf_processing_url }),
        ...(warrantyPhotos.length > 0 && { warrantyPhotos })
      } : undefined
    };

    // Validate email data
    const validation = validateManualEmailData(manualEmailData);
    if (!validation.isValid) {
      validation.errors.forEach(error => toast.error(error));
      return;
    }

    setSendingEmail(true);
    try {
      console.log('📧 Sending manual email:', manualEmailData);
      
      const result = await sendManualEmail(manualEmailData);

      if (result.success) {
        toast.success('Correo enviado exitosamente');
        setShowEmailModal(false);
        // Reset form
        setEmailData({
          subject: '',
          message: '',
          emailType: 'availability_confirmation',
          includeBudget: false,
          includeContract: false,
          selectedBudgetUrls: []
        });
      } else {
        throw new Error(result.message || 'Error al enviar el correo');
      }
    } catch (error) {
      console.error('💥 Error sending manual email:', error);
      toast.error(error instanceof Error ? error.message : 'Error al enviar el correo');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCancelEmail = () => {
    setShowEmailModal(false);
    setEmailData({
      subject: '',
      message: '',
      emailType: 'availability_confirmation',
      includeBudget: false,
      includeContract: false,
      selectedBudgetUrls: []
    });
  };

  const generateEmailSubject = () => {
    const orderId = orderData?.id;
    const projectName = orderData?.order_proyecto || 'Proyecto';
    
    switch (emailData.emailType) {
      case 'availability_confirmation':
        return `✅ Confirmación de Disponibilidad - ${projectName} (Orden #${orderId})`;
      case 'order_update':
        return `📋 Actualización de Pedido - ${projectName} (Orden #${orderId})`;
      case 'warranty_photos':
        return `📸 Fotos de Garantía - ${projectName} (Orden #${orderId})`;
      default:
        return `📧 Comunicación - ${projectName} (Orden #${orderId})`;
    }
  };

  const generateEmailMessage = () => {
    const customerName = getCustomerName();
    const projectName = orderData?.order_proyecto || 'su proyecto';
    const orderId = orderData?.id;
    
    switch (emailData.emailType) {
      case 'availability_confirmation':
        return `Nos complace confirmar la disponibilidad de los equipos para ${projectName} (Orden #${orderId}).\n\nTodos los productos solicitados están disponibles para las fechas indicadas. Procederemos con la preparación de los equipos según lo acordado.`;
      case 'order_update':
        return `Hemos revisado tu pedido ${projectName} (Orden #${orderId}) y realizado algunas modificaciones, que detallamos a continuación:.\n\n[Describa aquí los cambios o actualizaciones realizadas]\n\n`;
      case 'warranty_photos':
        return `Adjuntamos las fotos del pedido ${projectName} (Orden #${orderId}) en donde los equipos fueron retirados hoy como registro de su estado y entrega.\n\nRecuerda respetar las condiciones del arriendo y coordinar la devolución, con horario máximo hasta la <strong>1 PM del día siguiente</strong> al término de tu jornada de arriendo.`;
      default:
        return `Le escribimos en relación a su pedido ${projectName} (Orden #${orderId}).\n\n[Escriba aquí su mensaje personalizado]\n\n`;
    }
  };

  // Auto-generate subject and message when email type changes
  const handleEmailTypeChange = (newType: typeof emailData.emailType) => {
    // Temporarily update emailData for generation functions
    const originalType = emailData.emailType;
    emailData.emailType = newType;
    
    const newSubject = generateEmailSubject();
    const newMessage = generateEmailMessage();
    
    // Restore original type
    emailData.emailType = originalType;
    
    setEmailData(prev => ({
      ...prev,
      emailType: newType,
      subject: prev.subject === '' ? newSubject : prev.subject,
      message: prev.message === '' ? newMessage : prev.message
    }));
  };

  if (!orderData) {
    console.log('No order found in array');
    return (
      <div className="mt-6 p-4 bg-destructive/10 text-destructive rounded-md">
        No se encontraron datos de la orden
      </div>
    );
  }

  // If in editing mode, show the edit form
  if (isEditing) {
    return (
      <div className="mt-6">
        <EditOrderForm
          order={orderData as any}
          onSave={handleSaveOrder}
          onCancel={handleCancelEdit}
          loading={loading}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Header with Edit Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Detalles del Pedido #{orderData.id}</h2>
        <Button
          onClick={() => setIsEditing(true)}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <Edit className="w-4 h-4" />
          Editar Pedido
        </Button>
      </div>


      {/* Order Status and Payment Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Estado del Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={statusColors[orderData.status] || 'bg-gray-100 text-gray-800'}>
              {statusTranslations[orderData.status] || orderData.status}
            </Badge>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Estado de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                isPaymentComplete ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              <span className="text-sm font-medium">
                {isPaymentComplete ? 'Pagado' : 'Pendiente'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Order Information Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Order Info */}
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="font-medium">ID:</span>
              <span>{orderData.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Fecha Creación:</span>
              <span>{new Date(orderData.date_created).toLocaleDateString('es-ES')}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Total:</span>
              <span className="font-bold">${orderData.calculated_total || orderData.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Moneda:</span>
              <span>{orderData.currency || 'CLP'}</span>
            </div>
            {orderData.payment_method && (
              <div className="flex justify-between">
                <span className="font-medium">Método de pago:</span>
                <span>{orderData.payment_method_title || orderData.payment_method}</span>
              </div>
            )}
            {orderData.transaction_id && (
              <div className="flex justify-between">
                <span className="font-medium">ID Transacción:</span>
                <span>{orderData.transaction_id}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="font-medium">Cliente:</span>
              <span>{getCustomerName()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Email:</span>
              <span>{getCustomerEmail()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">ID Cliente:</span>
              <span>{orderData.customer_id || orderData.customer?.id || 'N/A'}</span>
            </div>
            {orderData.billing_phone && (
              <div className="flex justify-between">
                <span className="font-medium">Teléfono:</span>
                <span>{orderData.billing_phone}</span>
              </div>
            )}
            {orderData.billing_company && (
              <div className="flex justify-between">
                <span className="font-medium">Empresa:</span>
                <span>{orderData.billing_company}</span>
              </div>
            )}
            {orderData.company_rut && (
              <div className="flex justify-between">
                <span className="font-medium">RUT Empresa:</span>
                <span>{orderData.company_rut}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Project Information */}
      {(orderData.order_proyecto || orderData.order_fecha_inicio || orderData.order_fecha_termino) && (
        <Card>
          <CardHeader>
            <CardTitle>Información del Proyecto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {orderData.order_proyecto && (
                <div>
                  <span className="font-medium text-sm text-muted-foreground">Proyecto:</span>
                  <p>{orderData.order_proyecto}</p>
                </div>
              )}
              {orderData.order_fecha_inicio && (
                <div>
                  <span className="font-medium text-sm text-muted-foreground">Fecha Inicio:</span>
                  <p>{orderData.order_fecha_inicio}</p>
                </div>
              )}
              {orderData.order_fecha_termino && (
                <div>
                  <span className="font-medium text-sm text-muted-foreground">Fecha Término:</span>
                  <p>{orderData.order_fecha_termino}</p>
                </div>
              )}
              {orderData.num_jornadas && (
                <div>
                  <span className="font-medium text-sm text-muted-foreground">Jornadas:</span>
                  <p>{orderData.num_jornadas}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/*PDF View */}
      <Card>
          <CardHeader>
            <CardTitle>Documentación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 flex-wrap">
              {orderData.new_pdf_on_hold_url && (() => {
                const budgetUrls = orderData.new_pdf_on_hold_url.split(',').filter(url => url.trim());
                const latestUrl = budgetUrls[budgetUrls.length - 1]?.trim();
                
                return (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="bg-blue-200 text-blue-900 hover:bg-blue-300"
                      onClick={() => window.open(latestUrl, '_blank')}
                      title={`Ver presupuesto más reciente (${budgetUrls.length > 1 ? `Versión ${budgetUrls.length} de ${budgetUrls.length}` : 'Versión única'})`}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Presupuesto {budgetUrls.length > 1 && `(v${budgetUrls.length})`}
                    </Button>
                    
                    {budgetUrls.length > 1 && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Historial:</span>
                        {budgetUrls.slice(0, -1).map((url, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                            onClick={() => window.open(url.trim(), '_blank')}
                            title={`Ver versión ${index + 1} del presupuesto`}
                          >
                            v{index + 1}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
              
              {orderData.new_pdf_processing_url && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="bg-green-200 text-green-900 hover:bg-green-300"
                  onClick={() => window.open(orderData.new_pdf_processing_url, '_blank')}
                  title="Ver contrato de procesamiento"
                >
                  <FileCheck className="h-4 w-4 mr-2" />
                  Contrato
                </Button>
              )}
              
              {!orderData.new_pdf_processing_url && (
                <Button 
                  variant="default" 
                  size="sm"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg"
                  onClick={handleGenerateOrderPdf}
                  disabled={generatingPdf}
                  title="Generar contrato de procesamiento"
                >
                  {generatingPdf ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generando...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generar Contrato
                    </>
                  )}
                </Button>
              )}
              
              {!orderData.new_pdf_on_hold_url && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-gradient-to-r from-green-600 to-teal-600 text-white hover:from-green-700 hover:to-teal-700 shadow-lg border-0"
                  onClick={handleGenerateBudgetPdf}
                  disabled={generatingBudget}
                  title="Generar presupuesto"
                >
                  {generatingBudget ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generando...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generar Presupuesto
                    </>
                  )}
                </Button>
              )}

              {orderData.new_pdf_on_hold_url && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:from-orange-700 hover:to-amber-700 shadow-lg border-0"
                  onClick={handleUpdateBudgetPdf}
                  disabled={generatingBudget}
                  title="Actualizar presupuesto - Genera una nueva versión y mantiene el historial"
                >
                  {generatingBudget ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Actualizando...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Actualizar Presupuesto
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

      {/* Manual Email Communication Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Comunicación Manual
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEmailModal(true)}
              className="flex items-center gap-2 bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
            >
              <Send className="w-4 h-4" />
              Enviar Correo
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">📧 Envío de Correos al Cliente</h4>
              <p className="text-sm text-blue-700 mb-3">
                Envíe correos personalizados al cliente para confirmar disponibilidad, 
                actualizar el estado del pedido o comunicar información importante.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded border">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium text-sm">Cliente:</span>
                  </div>
                  <p className="text-sm text-gray-700">{getCustomerName()}</p>
                  <p className="text-xs text-gray-500">{getCustomerEmail()}</p>
                </div>
                
                <div className="bg-white p-3 rounded border">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="font-medium text-sm">Documentos Disponibles:</span>
                  </div>
                  <div className="space-y-1">
                    {orderData.new_pdf_on_hold_url && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <FileText className="w-3 h-3" />
                        Presupuesto PDF
                      </div>
                    )}
                    {orderData.new_pdf_processing_url && (
                      <div className="flex items-center gap-1 text-xs text-blue-600">
                        <FileCheck className="w-3 h-3" />
                        Contrato PDF
                      </div>
                    )}
                    {!orderData.new_pdf_on_hold_url && !orderData.new_pdf_processing_url && (
                      <span className="text-xs text-gray-500">Sin documentos generados</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-3 flex items-center gap-2 text-xs text-blue-600">
                <Paperclip className="w-3 h-3" />
                <span>Los documentos disponibles pueden adjuntarse automáticamente al correo</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Enviar Correo Manual
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEmail}
                disabled={sendingEmail}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              {/* Recipient Info */}
              <div className="bg-gray-50 p-3 rounded-lg border">
                <div className="text-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-gray-700">Para:</span>
                    <span className="text-gray-600">{getCustomerEmail()}</span>
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-gray-700">Cliente:</span>
                    <span className="text-gray-600">{getCustomerName()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">Orden:</span>
                    <span className="text-gray-600">#{orderData.id} - {orderData.order_proyecto || 'Proyecto de Arriendo'}</span>
                  </div>
                </div>
              </div>
              
              {/* Email Type Selection */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Tipo de Correo</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                  <Button
                    variant={emailData.emailType === 'availability_confirmation' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleEmailTypeChange('availability_confirmation')}
                    disabled={sendingEmail}
                    className="justify-start h-auto p-3"
                  >
                    <div className="text-left">
                      <div className="font-medium">✅ Confirmación</div>
                      <div className="text-xs opacity-70">Disponibilidad confirmada</div>
                    </div>
                  </Button>
                  <Button
                    variant={emailData.emailType === 'order_update' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleEmailTypeChange('order_update')}
                    disabled={sendingEmail}
                    className="justify-start h-auto p-3"
                  >
                    <div className="text-left">
                      <div className="font-medium">📋 Actualización</div>
                      <div className="text-xs opacity-70">Cambios en el pedido</div>
                    </div>
                  </Button>
                  <Button
                    variant={emailData.emailType === 'warranty_photos' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleEmailTypeChange('warranty_photos')}
                    disabled={sendingEmail}
                    className="justify-start h-auto p-3"
                  >
                    <div className="text-left">
                      <div className="font-medium">📸 Fotos Garantía</div>
                      <div className="text-xs opacity-70">Imágenes del rental</div>
                    </div>
                  </Button>
                  <Button
                    variant={emailData.emailType === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleEmailTypeChange('custom')}
                    disabled={sendingEmail}
                    className="justify-start h-auto p-3"
                  >
                    <div className="text-left">
                      <div className="font-medium">📧 Personalizado</div>
                      <div className="text-xs opacity-70">Mensaje libre</div>
                    </div>
                  </Button>
                </div>
              </div>
              
              {/* Subject */}
              <div>
                <Label htmlFor="email-subject" className="text-sm font-medium mb-2 block">
                  Asunto del Correo
                </Label>
                <Input
                  id="email-subject"
                  value={emailData.subject}
                  onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder={generateEmailSubject()}
                  disabled={sendingEmail}
                  className="w-full"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEmailData(prev => ({ ...prev, subject: generateEmailSubject() }))}
                  disabled={sendingEmail}
                  className="mt-1 h-6 px-2 text-xs text-blue-600 hover:text-blue-700"
                >
                  Usar asunto sugerido
                </Button>
              </div>
              
              {/* Message */}
              <div>
                <Label htmlFor="email-message" className="text-sm font-medium mb-2 block">
                  Mensaje
                </Label>
                <textarea
                  id="email-message"
                  value={emailData.message}
                  onChange={(e) => setEmailData(prev => ({ ...prev, message: e.target.value }))}
                  placeholder={generateEmailMessage()}
                  disabled={sendingEmail}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEmailData(prev => ({ ...prev, message: generateEmailMessage() }))}
                  disabled={sendingEmail}
                  className="mt-1 h-6 px-2 text-xs text-blue-600 hover:text-blue-700"
                >
                  Usar mensaje sugerido
                </Button>
                <span className="text-xs text-gray-500">Ya está incluida la bienvenida y despedida personalizada en el correo.</span>
              </div>
              
              {/* Attachments */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Documentos a Adjuntar</Label>
                <div className="space-y-3">
                  {/* Budget PDFs Selection */}
                  {orderData.new_pdf_on_hold_url && (() => {
                    const availableBudgets = getAvailableBudgetUrls();
                    return availableBudgets.length > 0 && (
                      <div className="border rounded-lg p-3 bg-green-50">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">
                            Presupuestos Disponibles ({availableBudgets.length})
                          </span>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {availableBudgets.map((budgetUrl, index) => {
                            const isSelected = emailData.selectedBudgetUrls.includes(budgetUrl);
                            return (
                              <label 
                                key={index} 
                                className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-white transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const newSelected = e.target.checked
                                      ? [...emailData.selectedBudgetUrls, budgetUrl]
                                      : emailData.selectedBudgetUrls.filter(url => url !== budgetUrl);
                                    setEmailData(prev => ({ ...prev, selectedBudgetUrls: newSelected }));
                                  }}
                                  disabled={sendingEmail}
                                  className="rounded"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900">
                                    Presupuesto {index + 1}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {budgetUrl.split('/').pop()?.split('?')[0] || 'presupuesto.pdf'}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    window.open(budgetUrl, '_blank');
                                  }}
                                  className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                                >
                                  <FileText className="w-3 h-3" />
                                </Button>
                              </label>
                            );
                          })}
                        </div>
                        {emailData.selectedBudgetUrls.length > 0 && (
                          <div className="mt-2 text-xs text-green-700 bg-green-100 px-2 py-1 rounded">
                            ✓ {emailData.selectedBudgetUrls.length} presupuesto(s) seleccionado(s)
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Contract PDF Selection */}
                  {orderData.new_pdf_processing_url && (
                    <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={emailData.includeContract}
                        onChange={(e) => setEmailData(prev => ({ ...prev, includeContract: e.target.checked }))}
                        disabled={sendingEmail}
                        className="rounded"
                      />
                      <FileCheck className="w-4 h-4 text-blue-600" />
                      <span className="text-sm">Incluir Contrato PDF</span>
                    </label>
                  )}

                  {/* Warranty Photos Section - Only show for warranty_photos email type */}
                  {emailData.emailType === 'warranty_photos' && orderData.fotos_garantia && (() => {
                    const warrantyPhotos = Array.isArray(orderData.fotos_garantia) 
                      ? orderData.fotos_garantia.filter((url): url is string => typeof url === 'string') 
                      : [];
                    return warrantyPhotos.length > 0 ? (
                      <div className="border rounded-lg p-3 bg-purple-50">
                        <div className="flex items-center gap-2 mb-2">
                          <Camera className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-800">
                            Fotos de Garantía ({warrantyPhotos.length})
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                          {warrantyPhotos.map((photoUrl, index) => {
                            const urlString = typeof photoUrl === 'string' ? photoUrl : '';
                            return (
                              <div key={index} className="relative group">
                                <img
                                  src={urlString}
                                  alt={`Foto de garantía ${index + 1}`}
                                  className="w-full h-20 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => window.open(urlString, '_blank')}
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded flex items-center justify-center">
                                  <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded">
                          ✓ {warrantyPhotos.length} foto(s) de garantía se incluirán automáticamente
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-amber-600 p-2 border border-amber-200 bg-amber-50 rounded">
                        ⚠️ No hay fotos de garantía disponibles para esta orden
                      </div>
                    );
                  })()}

                  {/* No documents available */}
                  {!orderData.new_pdf_on_hold_url && !orderData.new_pdf_processing_url && emailData.emailType !== 'warranty_photos' && (
                    <div className="text-sm text-gray-500 p-2 border border-dashed rounded">
                      No hay documentos disponibles para adjuntar
                    </div>
                  )}
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleCancelEmail}
                  disabled={sendingEmail}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSendManualEmail}
                  disabled={sendingEmail || !emailData.subject.trim() || !emailData.message.trim()}
                  className="flex items-center gap-2"
                >
                  {sendingEmail ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Enviar Correo
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Products Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Productos del Pedido <span className="text-sm text-muted-foreground">({orderData.line_items?.length || 0})</span>
            {isEditing && (
              <Badge variant="secondary" className="ml-auto">
                Modo Edición - Información Detallada
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>

          {loadingProducts ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-16 w-16 rounded" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : enhancedLineItems.length > 0 ? (
            <div className="space-y-4">
              {enhancedLineItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="flex-shrink-0">
                      {item.images && item.images.length > 0 ? (
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                          <img
                            src={item.images[0]}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden absolute inset-0 bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-gray-400" />
                          </div>
                          {item.images.length > 1 && (
                            <Badge className="absolute -top-1 -right-1 text-xs">
                              +{item.images.length - 1}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center border">
                          <ImageIcon className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-lg truncate">{item.name}</h4>
                          {item.sku && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              SKU: {item.sku}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold">
                            {new Intl.NumberFormat('es-CL', {
                              style: 'currency',
                              currency: orderData.currency || 'CLP'
                            }).format(Number(item.quantity) * Number(item.price))}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {item.quantity} × {new Intl.NumberFormat('es-CL', {
                              style: 'currency',
                              currency: orderData.currency || 'CLP'
                            }).format(Number(item.price))}
                          </p>
                        </div>
                      </div>
                      
                      {/* Additional Details - Always Shown */}
                      <div className="mt-3 space-y-2">
                          
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant={
                              item.stock_status === 'instock' ? 'default' : 
                              item.stock_status === 'not_found' ? 'destructive' : 
                              'secondary'
                            }>
                              Stock: {
                                item.stock_status === 'instock' ? 'Disponible' :
                                item.stock_status === 'not_found' ? 'Producto no encontrado' :
                                item.stock_status === 'outofstock' ? 'Sin stock' :
                                item.stock_status === 'onbackorder' ? 'En pedido' :
                                'Estado desconocido'
                              }
                            </Badge>
                            <Badge variant="outline">
                              Cantidad: {item.quantity}
                            </Badge>
                            {item.product_id > 0 && (
                              <Badge variant="outline">
                                ID: {item.product_id}
                              </Badge>
                            )}
                          </div>

                        </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Package className="w-6 h-6 text-gray-400" />
              </div>
              <p className="font-medium">No hay productos en este pedido</p>
              <p className="text-sm mt-1">Los productos aparecerán aquí una vez que sean agregados</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Enhanced Financial Summary with Editable Coupons and Shipping */}
      {(orderData.calculated_subtotal || orderData.calculated_discount || orderData.calculated_iva || orderData.shipping_total || orderData.coupon_lines) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                💰 {isEditingFinancials ? 'Editor de Pedido Completo' : 'Resumen Financiero Detallado'}
              </span>
              <div className="flex items-center gap-2">
                {!isEditingFinancials ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingFinancials(true)}
                    className="flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Editar Pedido
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveFinancials}
                      disabled={savingFinancials}
                      className="flex items-center gap-2 text-green-700 border-green-300 hover:bg-green-50"
                    >
                      <Save className="w-4 h-4" />
                      {savingFinancials ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelFinancialEdit}
                      className="flex items-center gap-2 text-red-700 border-red-300 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Editable Products Section */}
              {isEditingFinancials && (
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-purple-600" />
                      <Label className="text-purple-700 font-medium">Productos del Pedido</Label>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowProductSelector(true)}
                      disabled={savingFinancials}
                      className="flex items-center gap-2 text-purple-700 border-purple-300 hover:bg-purple-100"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar Producto
                    </Button>
                  </div>
                  
                  {/* Product Selector Modal */}
                  {showProductSelector && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold">Seleccionar Producto</h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowProductSelector(false)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <ProductSelector
                          products={availableProducts.map(product => ({
                            ...product,
                            images: product.images ? (typeof product.images === 'string' ? JSON.parse(product.images) : product.images) : null
                          }))}
                          lineItems={editedProducts.map(item => ({
                            id: item.id,
                            product_id: item.product_id,
                            product_name: item.name,
                            product_price: parseFloat(item.price?.toString() || '0'),
                            quantity: item.quantity,
                            total: parseFloat(item.total?.toString() || '0'),
                            sku: item.sku,
                            image: item.images && item.images.length > 0 ? (typeof item.images[0] === 'string' ? item.images[0] : item.images[0]?.src || item.images[0]?.url) : undefined,
                            meta_data: {}
                          }))}
                          onAddProduct={handleAddProduct}
                          onRemoveProduct={handleRemoveProductFromSelector}
                          mode="edit"
                          loading={loadingProducts}
                          currency="CLP"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Edited Products List */}
                  <div className="space-y-3">
                    {editedProducts.map((item, index) => {
                      // Debug logging for images
                      console.log(`🖼️ Product ${index}: "${item.name}"`);
                      console.log(`   - Images array:`, item.images);
                      console.log(`   - Images length:`, item.images?.length || 0);
                      console.log(`   - First image:`, item.images?.[0]);
                      
                      const imageUrl = item.images && item.images.length > 0 
                        ? (typeof item.images[0] === 'string' 
                            ? item.images[0] 
                            : item.images[0]?.src || item.images[0]?.url || item.images[0])
                        : null;
                      
                      console.log(`   - Final image URL:`, imageUrl);
                      
                      return (
                        <div key={`${item.product_id}-${index}`} className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                          {/* Product Image */}
                          <div className="flex-shrink-0">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={item.name}
                                className="w-12 h-12 object-cover rounded border"
                                onError={(e) => {
                                  console.error(`❌ Image failed to load: ${imageUrl}`);
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                                onLoad={() => {
                                  console.log(`✅ Image loaded successfully: ${imageUrl}`);
                                }}
                              />
                            ) : null}
                            <div className={`w-12 h-12 bg-gray-100 rounded border flex items-center justify-center ${imageUrl ? 'hidden' : ''}`}>
                              <ImageIcon className="w-6 h-6 text-gray-400" />
                            </div>
                          </div>
                        
                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{item.name}</h4>
                          {item.sku && (
                            <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            ${parseFloat(item.price?.toString() || '0').toLocaleString('es-CL')} c/u
                          </p>
                        </div>
                        
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuantityChange(index, item.quantity - 1)}
                            disabled={item.quantity <= 1 || savingFinancials}
                            className="w-8 h-8 p-0"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuantityChange(index, item.quantity + 1)}
                            disabled={savingFinancials}
                            className="w-8 h-8 p-0"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        {/* Total */}
                        <div className="text-right">
                          <p className="font-medium">
                            ${parseFloat(item.total?.toString() || '0').toLocaleString('es-CL')}
                          </p>
                        </div>
                        
                        {/* Remove Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveProduct(index)}
                          disabled={savingFinancials}
                          className="w-8 h-8 p-0 text-red-600 border-red-300 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                    })}
                    
                    {editedProducts.length === 0 && (
                      <div className="text-center py-6 text-muted-foreground">
                        <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p>No hay productos seleccionados</p>
                        <p className="text-sm">Haz clic en "Agregar Producto" para comenzar</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Subtotal Display */}
                  <div className="mt-4 pt-3 border-t border-purple-200">
                    <div className="flex justify-between items-center font-medium">
                      <span className="text-purple-700">Subtotal de Productos:</span>
                      <span className="text-purple-700">
                        ${calculateEditedSubtotal().toLocaleString('es-CL')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Subtotal de Productos (solo mostrar en modo lectura) */}
              {!isEditingFinancials && orderData.calculated_subtotal && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Subtotal de Productos:</span>
                  <span className="font-medium">${(() => {
                    const numDays = parseInt(orderData.num_jornadas?.toString() || '1');
                    const productsSubtotal = calculateProductsSubtotal(enhancedLineItems, numDays);
                    return productsSubtotal.toLocaleString('es-CL');
                  })()}</span>
                </div>
              )}
              
              
              {/* Editable Coupon Section */}
              {isEditingFinancials ? (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-green-600" />
                    <Label className="text-green-700 font-medium">Cupón de Descuento</Label>
                  </div>
                  <CouponSelector
                    subtotal={(() => {
                      // Usar el subtotal de productos (sin envío ni cupones) para validar cupones
                      const numDays = parseInt(orderData.num_jornadas?.toString() || '1');
                      return calculateProductsSubtotal(editedProducts, numDays);
                    })()}
                    onCouponApplied={handleCouponApplied}
                    onCouponRemoved={handleCouponRemoved}
                    appliedCoupon={appliedCoupon}
                    appliedDiscountAmount={couponDiscountAmount}
                    userId={orderData.customer_id}
                    accessToken={sessionData?.access_token}
                    disabled={savingFinancials}
                  />
                </div>
              ) : (
                // Display applied coupons (read-only)
                orderData.coupon_lines && (() => {
                  try {
                    const couponLines = typeof orderData.coupon_lines === 'string' 
                      ? JSON.parse(orderData.coupon_lines) 
                      : orderData.coupon_lines;
                    
                    if (Array.isArray(couponLines) && couponLines.length > 0) {
                      return couponLines.map((coupon: any, index: number) => (
                        <div key={index} className="flex justify-between items-center bg-green-50 p-3 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2">
                            <span className="text-green-700">🎫 Cupón Aplicado:</span>
                            <Badge variant="secondary" className="bg-green-100 text-green-800 font-mono">
                              {coupon.code}
                            </Badge>
                            <span className="text-xs text-green-600">
                              ({coupon.discount_type === 'percent' 
                                ? `${coupon.amount}%` 
                                : `$${coupon.amount.toLocaleString('es-CL')}`
                              })
                            </span>
                          </div>
                          <span className="font-medium text-green-600">
                            -${parseFloat(coupon.discount || 0).toLocaleString('es-CL')}
                          </span>
                        </div>
                      ));
                    }
                  } catch (error) {
                    console.error('Error parsing coupon_lines:', error);
                  }
                  return null;
                })()
              )}
              
              {/* Calculated Discount Display */}
              {(() => {
                const numDays = parseInt(orderData.num_jornadas?.toString() || '1');
                const shipping = parseFloat(editedShipping || '0');
                
                if (isEditingFinancials) {
                  const calculations = updateAllCalculations(
                    editedProducts,
                    numDays,
                    shipping,
                    couponDiscountAmount
                  );
                  return calculations.calculated_discount > 0 ? (
                    <div className="flex justify-between items-center bg-orange-50 p-3 rounded-lg border border-orange-200">
                      <span className="text-orange-700 font-medium">💰 Descuento Total Aplicado:</span>
                      <span className="font-medium text-orange-700">
                        -${calculations.calculated_discount.toLocaleString('es-CL')}
                      </span>
                    </div>
                  ) : null;
                } else {
                  // En modo lectura, mostrar el descuento calculado original si existe
                  return orderData.calculated_discount && parseFloat(orderData.calculated_discount.toString()) > 0 ? (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Descuento Total Aplicado:</span>
                      <span className="font-medium text-orange-600">
                        -${parseFloat(orderData.calculated_discount.toString()).toLocaleString('es-CL')}
                      </span>
                    </div>
                  ) : null;
                }
              })()}
              
              {/* Delivery Method & Shipping Section */}
              {isEditingFinancials ? (
                <div className="space-y-4">
                  {/* Método de Entrega */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-medium text-sm mb-3">¿Cómo desea entregar el pedido?</h4>
                    <RadioGroup
                      value={deliveryMethod}
                      onValueChange={handleDeliveryMethodChange}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    >
                      <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                        <RadioGroupItem value="pickup" id="pickup-edit" />
                        <div className="flex-1">
                          <Label htmlFor="pickup-edit" className="flex items-center space-x-2 cursor-pointer">
                            <MapPin className="h-4 w-4" />
                            <span className="font-medium">Retiro en tienda</span>
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            El cliente retira el pedido en tienda (Gratis)
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                        <RadioGroupItem value="shipping" id="shipping-edit" />
                        <div className="flex-1">
                          <Label htmlFor="shipping-edit" className="flex items-center space-x-2 cursor-pointer">
                            <Truck className="h-4 w-4" />
                            <span className="font-medium">Envío a domicilio</span>
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            Envío del pedido a la dirección del cliente
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Selector de Métodos de Envío (solo si se selecciona shipping) */}
                  {deliveryMethod === 'shipping' && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
                        <Truck className="h-4 w-4 text-blue-600" />
                        Método de Envío
                      </h4>
                      {shippingLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                          Cargando métodos de envío...
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          {shippingMethods.map((method) => {
                            const numDays = parseInt(orderData.num_jornadas?.toString() || '1');
                            const productsSubtotal = calculateProductsSubtotal(editedProducts, numDays);
                            const validation = ShippingService.validateShippingMethod(method, productsSubtotal);
                            const isSelected = selectedShippingMethod?.id === method.id;
                            
                            return (
                              <div
                                key={method.id}
                                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                                  isSelected 
                                    ? 'border-primary bg-primary/5' 
                                    : validation.isValid 
                                      ? 'border-border hover:border-primary/50' 
                                      : 'border-border bg-muted/50 cursor-not-allowed opacity-60'
                                }`}
                                onClick={() => validation.isValid && handleShippingMethodSelect(method)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                                    }`}>
                                      {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{method.name}</span>
                                        <span className="text-sm font-semibold text-green-600">
                                          {formatShippingCost(method.cost)}
                                        </span>
                                      </div>
                                      {method.description && (
                                        <p className="text-sm text-muted-foreground">{method.description}</p>
                                      )}
                                      <p className="text-xs text-muted-foreground">
                                        Entrega: {formatDeliveryTime(method.estimated_days_min, method.estimated_days_max)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                {!validation.isValid && validation.message && (
                                  <div className="mt-2 text-xs text-destructive">
                                    {validation.message}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {shippingMethods.length === 0 && !shippingLoading && (
                            <div className="text-sm text-muted-foreground text-center py-4">
                              No hay métodos de envío disponibles
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                // Display shipping cost (read-only)
                orderData.shipping_total && parseFloat(orderData.shipping_total.toString()) > 0 && (
                  <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-700">🚚 Costo de Envío:</span>
                    </div>
                    <span className="font-medium text-blue-600">
                      +${parseFloat(orderData.shipping_total.toString()).toLocaleString('es-CL')}
                    </span>
                  </div>
                )
              )}
              
              {/* Subtotal Calculado (productos + envío - cupón) */}
              {(() => {
                const numDays = parseInt(orderData.num_jornadas?.toString() || '1');
                const shipping = parseFloat(editedShipping || '0');
                
                if (isEditingFinancials) {
                  const calculations = updateAllCalculations(
                    editedProducts,
                    numDays,
                    shipping,
                    couponDiscountAmount
                  );
                  return (
                    <div className="flex justify-between items-center bg-blue-50 p-2 rounded">
                      <span className="text-blue-700 font-medium">Subtotal Calculado:</span>
                      <span className="font-medium text-blue-700">
                        ${calculations.calculated_subtotal.toLocaleString('es-CL')}
                      </span>
                    </div>
                  );
                } else {
                  // En modo lectura, mostrar el subtotal calculado original
                  return orderData.calculated_subtotal ? (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Subtotal Calculado:</span>
                      <span className="font-medium">
                        ${parseFloat(orderData.calculated_subtotal.toString()).toLocaleString('es-CL')}
                      </span>
                    </div>
                  ) : null;
                }
              })()}
              
              {/* IVA */}
              {(() => {
                const numDays = parseInt(orderData.num_jornadas?.toString() || '1');
                const shipping = parseFloat(editedShipping || '0');
                
                if (isEditingFinancials) {
                  const calculations = updateAllCalculations(
                    editedProducts,
                    numDays,
                    shipping,
                    couponDiscountAmount
                  );
                  return calculations.calculated_iva > 0;
                } else {
                  return orderData.calculated_iva && parseFloat(orderData.calculated_iva.toString()) > 0;
                }
              })() && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">IVA (19%):</span>
                  <span className="font-medium">
                    ${(() => {
                      if (isEditingFinancials) {
                        const numDays = parseInt(orderData.num_jornadas?.toString() || '1');
                        const shipping = parseFloat(editedShipping || '0');
                        const calculations = updateAllCalculations(
                          editedProducts,
                          numDays,
                          shipping,
                          couponDiscountAmount
                        );
                        return calculations.calculated_iva.toLocaleString('es-CL');
                      } else {
                        return parseFloat(orderData.calculated_iva?.toString() || '0').toLocaleString('es-CL');
                      }
                    })()}
                  </span>
                </div>
              )}
              
              {/* Separator */}
              <div className="border-t border-gray-200 my-3"></div>
              
              {/* Final Total */}
              <div className="flex justify-between items-center font-bold text-lg bg-gray-50 p-3 rounded-lg">
                <span className="text-gray-900">💵 Total Final:</span>
                <span className="text-green-600 text-xl">
                  ${calculateUpdatedTotal().toLocaleString('es-CL')}
                </span>
              </div>
              

              
              {/* Currency Information */}
              <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                💱 Moneda: {orderData.currency || 'CLP'} | 
                📅 Última actualización: {new Date(orderData.date_modified).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Warranty Photos Section */}
      <WarrantyImageUpload
        orderId={orderData?.id || null}
        currentImages={warrantyPhotos}
        onImagesUpdate={handleWarrantyPhotosUpdate}
      />
    </div>
  );
}

export default ProcessOrder;
