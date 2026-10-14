import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { AddressInput } from '@/components/ui/AddressInput';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Package, Image as ImageIcon, Save, X, Tag, Truck, Plus, Minus, Trash2, FileText, FileCheck, Mail, Send, MapPin, CheckCircle, Camera, Eye, Settings, Calendar, AlertTriangle, Percent, DollarSign, Loader2 } from 'lucide-react';
import EditOrderForm from './EditOrderForm';
import { apiErrorMessage } from '../../lib/apiError';
import { formatBusinessDate, formatBusinessDateTimeFull } from '../../lib/businessDay';
import { FetchTimeoutError, fetchWithTimeout } from '../../lib/fetchWithTimeout';
import { CouponSelector } from './CouponSelector';
import { ProductSelector } from './ProductSelector';
import { createShippingLine, fetchEnabledShippingMethods, validateShippingMethod, type ShippingMethod, formatShippingCost, formatDeliveryTime, getShippingTypeLabel } from '../../lib/orderShipping';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { apiClient } from '@/services/apiClient';
import OrderDriverField from '@/components/delivery/OrderDriverField';
import ReturnReportSummary from '@/components/checkin/ReturnReportSummary';
import OrderDiscountControl from '@/components/orders/OrderDiscountControl';
import { discountPercentPayload, initialManualDiscount, manualDiscountPricing, type ManualDiscountInput } from '@/lib/pricing';
import type { Database } from '@/types/database';
import { toast } from 'sonner';
import { formatCLP } from '../../lib/delivery';
import { WarrantyImageUpload } from './WarrantyImageUpload';
// generateBudgetPdfFromId removed - now using dedicated endpoint
import { createEventFromOrder, openGoogleCalendar } from '@/lib/simpleCalendar';
import { sendManualEmail, validateManualEmailData, type ManualEmailData } from '@/services/manualEmailService';
import { AdminCommunications } from './AdminCommunications';
import { useOrderNotifications } from '../../hooks/useOrderNotifications';
import { statusLabel } from '../../lib/orderStatus';
import { computeOrderTotals } from '../../lib/pricing';
import { StatusBadge } from '../shared/StatusBadge';
import { toBadgeTone } from './orderListMetrics';
import { budgetVersions, clientLine, orderFinancialSummary, orderItemRows, orderPaymentSummary, rentalDateParts } from './orderDetail';
import { DetailCard, canonPrimaryButtonClass, canonSecondaryButtonClass } from './detail/DetailCard';
import { OrderDetailHeader } from './detail/OrderDetailHeader';
import { OrderPipeline } from './detail/OrderPipeline';
import { OrderItemsTable } from './detail/OrderItemsTable';
import { BudgetVersionList } from './detail/BudgetVersionList';
import { OrderActionsCard, OrderClientCard, OrderDatesCard, OrderFinancialCard, OrderNoteBlock, OrderPaymentCard } from './detail/OrderSideCards';
import { OrderStatusQuickActions, readStatusChangeResponse, shouldOfferNotify, type StatusChangeOutcome, type StatusChangeRequest } from './OrderStatusQuickActions';

// Above the server-side budget (20 s email hop + 12 s worker) so the server's own error wins.
const SAVE_ORDER_TIMEOUT_MS = 45_000;


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


function ProcessOrder({ order, sessionData, allProducts, allShippingMethods }: {
  order: WPOrderResponse,
  sessionData?: any,
  allProducts?: DatabaseProduct[],
  allShippingMethods?: ShippingMethod[]
}) {

  const orderData = order?.orders?.orders?.[0];

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productsData, setProductsData] = useState<DatabaseProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Reserve configuration states
  const [reserveType, setReserveType] = useState<string>((orderData as any)?.reserve_type || 'percent');
  const [reserveValue, setReserveValue] = useState<string>(String((orderData as any)?.reserve_value ?? 25));
  const [savingReserve, setSavingReserve] = useState(false);

  // R-05: manual discount by % or by $ (no coupon). Starts from the stored percentage
  // (`orders.discount_percent`, migration 0019), else the stored flat amount of an order without
  // a coupon. The server recomputes the amount from the percentage on save. Declared with the
  // other state, before the early returns below.
  const [manualDiscount, setManualDiscount] = useState<ManualDiscountInput>(() => {
    const lines = typeof orderData?.coupon_lines === 'string'
      ? (() => { try { return JSON.parse(orderData.coupon_lines); } catch { return []; } })()
      : orderData?.coupon_lines;
    const hasStoredCoupon = Array.isArray(lines) && lines.length > 0;
    const storedAmount = hasStoredCoupon ? 0 : parseFloat(String(orderData?.calculated_discount ?? 0)) || 0;
    return initialManualDiscount(hasStoredCoupon ? null : (orderData as any)?.discount_percent, storedAmount);
  });
  // H-3: `discount_percent` is sent only once the admin touches the control.
  const [manualDiscountTouched, setManualDiscountTouched] = useState(false);

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
  const [shippingMethodsSource, setShippingMethodsSource] = useState<'database' | 'fallback' | null>(null);
  const [userHasChangedDeliveryMethod, setUserHasChangedDeliveryMethod] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'shipping'>(() => {
    // Determinar método de entrega inicial basado en shipping_lines existentes
    try {
      const shippingLines = typeof orderData?.shipping_lines === 'string'
        ? JSON.parse(orderData.shipping_lines)
        : orderData?.shipping_lines;

      if (Array.isArray(shippingLines) && shippingLines.length > 0) {
        const firstShippingLine = shippingLines[0];
        const metaData = firstShippingLine.meta_data || {};
        const deliveryMethodFromMeta = metaData.delivery_method || metaData['delivery_method'];
        const methodTitle = firstShippingLine.method_title || '';
        const methodId = firstShippingLine.method_id || '';
        const shippingType = metaData.shipping_type || '';

        // Detectar pickup por múltiples criterios
        const isPickupMethod = deliveryMethodFromMeta === 'pickup' ||
          shippingType === 'pickup' ||
          methodId === 'pickup' ||
          methodTitle.toLowerCase().includes('retiro') ||
          methodTitle.toLowerCase().includes('pickup');

        if (isPickupMethod) {
          return 'pickup';
        } else if (deliveryMethodFromMeta === 'shipping') {
          return 'shipping';
        }
      }
    } catch (error) {
      console.error('[ProcessOrder] Error al leer shipping_lines iniciales:', error);
    }

    // Fallback a la lógica original basada en shipping_total
    const fallbackMethod = orderData?.shipping_total && parseFloat(orderData.shipping_total.toString()) > 0 ? 'shipping' : 'pickup';
    return fallbackMethod;
  });
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');

  // IVA toggle state
  const [applyIva, setApplyIva] = useState<boolean>(() => {
    // Initialize based on whether calculated_iva > 0 in existing order
    if (orderData?.calculated_iva) {
      return parseFloat(orderData.calculated_iva.toString()) > 0;
    }
    return false;
  });

  // Custom shipping states
  const [showCustomShippingForm, setShowCustomShippingForm] = useState(false);
  const [customShippingData, setCustomShippingData] = useState({
    name: '',
    description: '',
    cost: '',
    estimated_days_min: '1',
    estimated_days_max: '3'
  });

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
    emailType: 'custom' as 'warranty_photos' | 'availability_confirmation' | 'order_update' | 'custom',
    selectedBudgetUrls: [] as string[],
    includeBudget: false,
    includeContract: false
  });

  // PDF deletion states
  const [deletingPdf, setDeletingPdf] = useState(false);

  // Product availability conflicts states
  const [productConflicts, setProductConflicts] = useState<any[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  // Order notifications hook
  const {
    notifyEmailSent,
    notifyEmailFailed,
    notifyStatusChange,
    notifyPdfGenerated
  } = useOrderNotifications({
    orderId: orderData?.id || 0,
    customerId: orderData?.customer_id?.toString() || '',
    customerName: `${orderData?.billing_first_name || ''} ${orderData?.billing_last_name || ''}`.trim(),
    customerEmail: orderData?.billing_email || '',
    adminId: sessionData?.user?.id || 'admin',
    adminName: sessionData?.user?.name || 'Administrador',
    adminEmail: sessionData?.user?.email || 'admin@rental.com'
  });

  useEffect(() => {


    if (orderData?.coupon_lines) {
      try {
        const couponLines = typeof orderData.coupon_lines === 'string'
          ? JSON.parse(orderData.coupon_lines)
          : orderData.coupon_lines;


        if (Array.isArray(couponLines) && couponLines.length > 0) {
          const firstCoupon = couponLines[0];
          // Reconstruct coupon object from stored data
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
        }
      } catch (error) {
        console.error('[ProcessOrder] Error al leer coupon_lines:', error);
      }
    }

    // Initialize shipping total
    if (orderData?.shipping_total) {
      setEditedShipping(orderData.shipping_total.toString());
    }

    // Initialize calculated_discount if it exists (for display purposes)
    // Note: Manual discount editing was removed, but we still need to show existing values
    if (orderData?.calculated_discount) {
      // The calculated_discount is now handled automatically through coupon calculations
      // but we log it for reference
    }

    // Initialize applyIva state based on calculated_iva
    if (orderData?.calculated_iva) {
      const ivaValue = parseFloat(orderData.calculated_iva.toString());
      const shouldApplyIva = ivaValue > 0;
      setApplyIva(shouldApplyIva);
    }

  }, [orderData]);

  if (!order || !order.orders) {
    return (
      <div className="mt-6 p-4 bg-destructive/10 text-destructive rounded-md">
        No se encontraron datos de la orden
      </div>
    );
  }

  if (!order.orders.orders || !Array.isArray(order.orders.orders)) {
    return (
      <div className="mt-6 p-4 bg-destructive/10 text-destructive rounded-md">
        Estructura de datos inválida
      </div>
    );
  }

  // orderData is now defined above in useEffect

  if (!orderData) {
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
            return numericId;
          })
          .filter((id): id is number => {
            const isValid = id && !isNaN(id);
            if (!isValid) {
            }
            return isValid;
          });

        if (productIds.length > 0) {
          const response = await apiClient.post('/api/products/batch', { ids: productIds });
          const result = await apiClient.handleJsonResponse<{ success: boolean, data: DatabaseProduct[] }>(response);

          if (result.success) {

            // Check for missing products
            const loadedIds = (result.data || []).map(p => p.id).filter((id): id is number => id !== undefined);
            const missingIds = productIds.filter(id => !loadedIds.includes(id));
            if (missingIds.length > 0) {
            }

            setProductsData(result.data || []);
          } else {
            console.error('[ProcessOrder] No se pudieron cargar los productos:', result?.error);
          }
        }
      } catch (error) {
        console.error('[ProcessOrder] Error al cargar el detalle de productos:', error);
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


  const handleSaveOrder = async (updatedOrder: any) => {
    try {
      setLoading(true);

      // Bounded and without native dialogs (A-03): a blocking `alert()` raised while `loading` was
      // still true froze the tab on "Guardando..." whenever the server answered with an error, and
      // a request that never answered kept it there for ever.
      const response = await fetchWithTimeout(
        `/api/orders/update/${orderData.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedOrder)
        },
        SAVE_ORDER_TIMEOUT_MS
      );

      const result = await response.json().catch(() => null);

      if (response.ok && result?.success) {
        if (typeof result.warning === 'string' && result.warning) {
          // Saved, but the customer email did not go out: a warning, never an error (D-9).
          toast.warning(result.warning, { duration: 8000 });
        } else {
          toast.success('Pedido actualizado correctamente');
        }
        setIsEditing(false);
        // Reload the page to show updated data
        setTimeout(() => window.location.reload(), result.warning ? 2500 : 800);
      } else {
        toast.error(apiErrorMessage(result, 'No se pudo actualizar el pedido'));
      }
    } catch (error) {
      console.error('[ProcessOrder] Error al actualizar el pedido:', error);
      toast.error(
        error instanceof FetchTimeoutError
          ? 'El servidor tardó demasiado en responder. Revisa el estado del pedido antes de reintentar.'
          : 'Error al actualizar el pedido'
      );
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

  const manualDiscountInputs = manualDiscountPricing(manualDiscount);

  // Order money with the shared pricing module (src/lib/pricing.ts). Preview only: the server
  // recomputes and persists the same figures when the order is saved.
  const updateAllCalculations = (
    lineItems: any[],
    numDays: number,
    shipping: number = 0,
    _couponDiscount: number = 0,
    applyIva: boolean = true
  ) => {
    try {
      const totals = computeOrderTotals({
        lineItems: lineItems.map(item => ({ price: item.price ?? 0, quantity: item.quantity ?? 0 })),
        jornadas: Math.max(1, numDays || 1),
        shippingTotal: shipping,
        coupon: appliedCoupon,
        discount: appliedCoupon ? null : manualDiscountInputs.discount,
        discountPercent: appliedCoupon ? null : manualDiscountInputs.discountPercent,
        applyIva,
      });
      return {
        products_subtotal: totals.productsSubtotal,
        calculated_subtotal: totals.net,
        calculated_discount: totals.discount,
        calculated_iva: totals.iva,
        calculated_total: totals.total
      };
    } catch {
      return { products_subtotal: 0, calculated_subtotal: 0, calculated_discount: 0, calculated_iva: 0, calculated_total: 0 };
    }
  };

  const calculateProductsSubtotal = (lineItems: any[], numDays: number) =>
    updateAllCalculations(lineItems, numDays).products_subtotal;

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
      couponDiscountAmount,
      applyIva
    );
    return calculations.calculated_total;
  };

  const handleSaveReserveConfig = async () => {
    const numValue = parseFloat(reserveValue);
    if (isNaN(numValue) || numValue < 0) {
      toast.error('El valor de reserva debe ser un número positivo');
      return;
    }
    if (reserveType === 'percent' && numValue > 100) {
      toast.error('El porcentaje no puede ser mayor a 100%');
      return;
    }

    try {
      setSavingReserve(true);
      const response = await fetch(`/api/orders/update/${orderData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reserve_type: reserveType, reserve_value: numValue })
      });

      if (response.ok) {
        toast.success('Configuración de reserva actualizada');
      } else {
        const errorData = await response.json();
        toast.error(`Error: ${errorData.message || 'Error desconocido'}`);
      }
    } catch (err) {
      console.error('[ProcessOrder] Error al guardar reserva:', err);
      toast.error('Error al guardar configuración de reserva');
    } finally {
      setSavingReserve(false);
    }
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
        couponDiscountAmount,
        applyIva
      );

      // Validar campos requeridos para métodos de envío (más flexible)
      if (deliveryMethod === 'shipping' && selectedShippingMethod) {

        // Solo validar si el método específicamente requiere estos campos Y están marcados como obligatorios
        if (selectedShippingMethod.requires_address && selectedShippingMethod.requires_address === true && !shippingAddress.trim()) {
          // Solo mostrar advertencia, no bloquear
          toast.warning('⚠️ Recomendación', {
            description: 'Se recomienda agregar una dirección de delivery',
            duration: 3000
          });
        }

        if (selectedShippingMethod.requires_phone && selectedShippingMethod.requires_phone === true && !shippingPhone.trim()) {
          // Solo mostrar advertencia, no bloquear
          toast.warning('⚠️ Recomendación', {
            description: 'Se recomienda agregar un teléfono de contacto',
            duration: 3000
          });
        }
      }

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
        // R-05: the percentage travels so the server recomputes; null clears it (flat or none).
        // H-3: only when the discount control was touched (see `discountPercentPayload`).
        discount_percent: discountPercentPayload(manualDiscount, {
          touched: manualDiscountTouched,
          couponApplied: Boolean(appliedCoupon),
        }),
        calculated_iva: calculations.calculated_iva,
        apply_iva: applyIva,
        shipping_total: deliveryMethod === 'pickup' ? 0 : shipping,
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
        // Shipping lines según método de entrega seleccionado
        shipping_lines: deliveryMethod === 'pickup' ? [{
          "id": "pickup_0",
          "taxes": [],
          "total": "0",
          "meta_data": {
            "shipping_type": "pickup",
            "delivery_method": "pickup",
            "pickup_location": "Tienda principal",
            "pickup_instructions": "Coordinar retiro con anticipación"
          },
          "method_id": "pickup",
          "total_tax": "0",
          "instance_id": "pickup_0",
          "method_type": "pickup",
          "method_title": "Retiro en tienda"
        }] : deliveryMethod === 'shipping' && selectedShippingMethod ? [{
          ...(selectedShippingMethod.metadata?.custom
            ? {
              // Método customizado - crear shipping line manualmente
              id: selectedShippingMethod.id,
              method_id: selectedShippingMethod.id,
              method_title: selectedShippingMethod.name,
              method_type: selectedShippingMethod.shipping_type,
              total: selectedShippingMethod.cost,
              taxes: [],
              meta_data: {
                estimated_delivery: formatDeliveryTime(selectedShippingMethod.estimated_days_min, selectedShippingMethod.estimated_days_max),
                delivery_method: deliveryMethod,
                shipping_address: shippingAddress.trim() || 'No especificada',
                shipping_phone: shippingPhone.trim() || 'No especificado',
                custom_shipping: true,
                tracking_number: null
              }
            }
            : {
              // Método estándar - usar createShippingLine
              ...createShippingLine(
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
                ...createShippingLine(selectedShippingMethod).meta_data,
                delivery_method: deliveryMethod,
                shipping_address: shippingAddress.trim() || 'No especificada',
                shipping_phone: shippingPhone.trim() || 'No especificado'
              }
            }
          )
        }] : [],
        calculated_total: calculations.calculated_total
      };


      // Con el nuevo sistema de autenticación, usamos cookies en lugar de Bearer token
      const response = await fetch(`/api/orders/${orderData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Esto envía las cookies de sesión automáticamente
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
        console.error('[ProcessOrder] Error en la respuesta al actualizar el pedido:', result.error);
        throw new Error(result.error || 'Error al actualizar');
      }
    } catch (error) {
      console.error('[ProcessOrder] Error al actualizar el pedido:', error);
      toast.error('Error al actualizar el pedido');
    } finally {
      setSavingFinancials(false);
    }
  };

  const handleCancelFinancialEdit = () => {
    // Reset to original values
    setEditedShipping(orderData?.shipping_total?.toString() || '0');
    // Force refresh from enhanced line items to ensure we have current data
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
        console.error('[ProcessOrder] Error al restablecer el cupón:', error);
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

    // Reset applyIva to original value from order
    if (orderData?.calculated_iva) {
      const ivaValue = parseFloat(orderData.calculated_iva.toString());
      setApplyIva(ivaValue > 0);
    } else {
      setApplyIva(false);
    }

    setIsEditingFinancials(false);
    setShowProductSelector(false);
    toast.info('Cambios cancelados');
  };

  // Funciones de manejo de shipping (siguiendo patrón de CreateOrderForm)
  const loadShippingMethods = async () => {
    setShippingLoading(true);
    try {
      // Usar métodos pasados como prop si están disponibles
      if (allShippingMethods && allShippingMethods.length > 0) {
        setShippingMethods(allShippingMethods);
        setShippingMethodsSource('database');

        // Si estamos en modo shipping y no hay método seleccionado, seleccionar el primero
        if (deliveryMethod === 'shipping' && !selectedShippingMethod) {
          const defaultMethod = allShippingMethods[0];
          if (defaultMethod) {
            setSelectedShippingMethod(defaultMethod);
            setEditedShipping(defaultMethod.cost.toString());
          }
        }
        return; // Salir temprano si usamos props
      }

      // Fallback: cargar desde API si no hay props
      // Solo métodos habilitados, vía la API protegida (T-05)
      const enabledMethods = await fetchEnabledShippingMethods();
      if (enabledMethods) {
        setShippingMethods(enabledMethods);
        setShippingMethodsSource('database');

        // Si estamos en modo shipping y no hay método seleccionado, seleccionar el primero
        if (deliveryMethod === 'shipping' && !selectedShippingMethod) {
          const defaultMethod = enabledMethods[0];
          if (defaultMethod) {
            setSelectedShippingMethod(defaultMethod);
            setEditedShipping(defaultMethod.cost.toString());
          }
        }
      }
    } catch (shippingError) {
      console.error('[ProcessOrder] Error al cargar los métodos de envío:', shippingError);
      // Fallback a métodos por defecto siguiendo la interfaz ShippingMethod
      const defaultMethods: ShippingMethod[] = [
        {
          id: 1,
          name: 'Delivery Gratis',
          description: 'Delivery gratuito para órdenes mayores a $50.000',
          cost: '0',
          shipping_type: 'free',
          enabled: true,
          min_amount: '50000',
          max_amount: null,
          available_regions: null,
          excluded_regions: null,
          estimated_days_min: '3',
          estimated_days_max: '5',
          requires_address: true,
          requires_phone: true,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: null
        },
        {
          id: 2,
          name: 'Delivery Estándar',
          description: 'Delivery estándar a todo Chile',
          cost: '5000',
          shipping_type: 'flat_rate',
          enabled: true,
          min_amount: null,
          max_amount: null,
          available_regions: null,
          excluded_regions: null,
          estimated_days_min: '2',
          estimated_days_max: '4',
          requires_address: true,
          requires_phone: true,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: null
        },
        {
          id: 3,
          name: 'Delivery Express',
          description: 'Entrega rápida en 24-48 horas',
          cost: '12000',
          shipping_type: 'express',
          enabled: true,
          min_amount: null,
          max_amount: null,
          available_regions: null,
          excluded_regions: null,
          estimated_days_min: '1',
          estimated_days_max: '2',
          requires_address: true,
          requires_phone: true,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: null
        }
      ];
      setShippingMethods(defaultMethods);
      setShippingMethodsSource('fallback');
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

    // Marcar que el usuario ha hecho un cambio manual
    setUserHasChangedDeliveryMethod(true);
    setDeliveryMethod(method);

    if (method === 'pickup') {
      setSelectedShippingMethod(null);
      setEditedShipping('0');
      toast.info('📦 Método cambiado a Retiro en tienda', {
        description: 'Los cambios se guardarán al hacer clic en "Guardar Cambios"',
        duration: 3000
      });
    } else if (method === 'shipping' && shippingMethods.length > 0) {
      // Auto-seleccionar el primer método disponible cuando se cambia a shipping
      const firstMethod = shippingMethods[0];
      if (firstMethod) {
        setSelectedShippingMethod(firstMethod);
        setEditedShipping(firstMethod.cost.toString());
        toast.info('🚚 Método cambiado a Delivery a domicilio', {
          description: `Método seleccionado: ${firstMethod.name}`,
          duration: 3000
        });
      }
    }
  };

  // Custom shipping handlers
  const handleCustomShippingSubmit = () => {
    if (!customShippingData.name || !customShippingData.cost) {
      alert('Por favor completa el nombre y costo del delivery customizado');
      return;
    }

    // Crear un método de envío temporal customizado
    const customMethod: ShippingMethod = {
      id: `custom_${Date.now()}`,
      name: customShippingData.name,
      description: customShippingData.description || 'Delivery personalizado',
      cost: customShippingData.cost,
      shipping_type: 'flat_rate',
      enabled: true,
      min_amount: null,
      max_amount: null,
      available_regions: null,
      excluded_regions: null,
      estimated_days_min: customShippingData.estimated_days_min,
      estimated_days_max: customShippingData.estimated_days_max,
      requires_address: true,
      requires_phone: true,
      metadata: { custom: true },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: null
    };

    // Agregar el método customizado a la lista
    setShippingMethods(prev => [...prev, customMethod]);

    // Seleccionar automáticamente el método customizado
    setSelectedShippingMethod(customMethod);
    setEditedShipping(customMethod.cost);

    // Limpiar el formulario y cerrarlo
    setCustomShippingData({
      name: '',
      description: '',
      cost: '',
      estimated_days_min: '1',
      estimated_days_max: '3'
    });
    setShowCustomShippingForm(false);
  };

  const handleCustomShippingCancel = () => {
    setCustomShippingData({
      name: '',
      description: '',
      cost: '',
      estimated_days_min: '1',
      estimated_days_max: '3'
    });
    setShowCustomShippingForm(false);
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
      setEditedProducts([...enhancedLineItems]);
    }
  }, [enhancedLineItems, editedProducts.length]);

  // Check for product availability conflicts when order data changes
  useEffect(() => {
    const checkConflicts = async () => {
      if (!orderData?.id || !orderData?.order_fecha_inicio || !orderData?.order_fecha_termino || !enhancedLineItems || enhancedLineItems.length === 0) return;

      setCheckingConflicts(true);
      try {
        const productIds = enhancedLineItems.map(item => Number(item.product_id)).filter(id => !isNaN(id) && id > 0);

        if (productIds.length === 0) {
          setCheckingConflicts(false);
          return;
        }

        const response = await fetch('/api/orders/check-conflicts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            currentOrderId: orderData.id,
            productIds,
            startDate: orderData.order_fecha_inicio,
            endDate: orderData.order_fecha_termino
          })
        });

        const result = await response.json();
        if (result.success && result.data) {
          setProductConflicts(result.data);
        }
      } catch (error) {
        console.error('[ProcessOrder] Error al verificar conflictos de productos:', error);
      } finally {
        setCheckingConflicts(false);
      }
    };

    checkConflicts();
  }, [orderData?.id, orderData?.order_fecha_inicio, orderData?.order_fecha_termino, enhancedLineItems]);

  // Force refresh editedProducts when entering edit mode
  useEffect(() => {
    if (isEditingFinancials && enhancedLineItems.length > 0) {
      setEditedProducts([...enhancedLineItems]);
    }
  }, [isEditingFinancials, enhancedLineItems]);

  // Initialize shipping method from existing shipping_lines when entering edit mode
  useEffect(() => {
    if (isEditingFinancials && orderData?.shipping_lines && !selectedShippingMethod && !userHasChangedDeliveryMethod) {
      try {
        const shippingLines = typeof orderData.shipping_lines === 'string'
          ? JSON.parse(orderData.shipping_lines)
          : orderData.shipping_lines;

        if (Array.isArray(shippingLines) && shippingLines.length > 0) {
          const firstShippingLine = shippingLines[0];

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

          // Determinar el método de entrega basado en metadata y características del shipping line
          const metaData = firstShippingLine.meta_data || {};
          const deliveryMethodFromMeta = metaData.delivery_method || metaData['delivery_method'];
          const methodTitle = firstShippingLine.method_title || '';
          const methodId = firstShippingLine.method_id || '';
          const shippingType = metaData.shipping_type || '';


          // Cargar dirección de envío si existe
          if (metaData.shipping_address) {
            setShippingAddress(metaData.shipping_address);
          }

          // Cargar teléfono de envío si existe
          if (metaData.shipping_phone) {
            setShippingPhone(metaData.shipping_phone);
          }

          // Detectar pickup por múltiples criterios
          const isPickupMethod = deliveryMethodFromMeta === 'pickup' ||
            shippingType === 'pickup' ||
            methodId === 'pickup' ||
            methodTitle.toLowerCase().includes('retiro') ||
            methodTitle.toLowerCase().includes('pickup');

          if (isPickupMethod) {
            setDeliveryMethod('pickup');
            setSelectedShippingMethod(null); // Clear shipping method for pickup
            setEditedShipping('0'); // Set shipping cost to 0 for pickup
          } else if (deliveryMethodFromMeta === 'shipping' || existingMethod.cost > 0) {
            setDeliveryMethod('shipping');
          } else {
            setDeliveryMethod('pickup');
            setSelectedShippingMethod(null);
            setEditedShipping('0');
          }
        }
      } catch (error) {
        console.error('[ProcessOrder] Error al leer shipping_lines:', error);
      }
    }
  }, [isEditingFinancials, orderData?.shipping_lines, selectedShippingMethod, userHasChangedDeliveryMethod]);

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

      // Same-origin with the session cookie: the route requires an admin session and reads the
      // order on the server (the browser's anon client cannot read `orders`).
      const response = await fetch('/api/order/generate-processing-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ order_id: orderData.id }),
      });
      const result = await response.json().catch(() => ({ success: false }));
      if (!response.ok) result.success = false;
      result.message = result.message || result.error;

      if (result.success) {
        toast.success('Contrato de procesamiento generado exitosamente');

        // Notificar al cliente sobre la generación del contrato
        await notifyPdfGenerated(
          'processing',
          result.pdfUrl || '',
          true
        );

        // Crear recordatorio en Google Calendar (solución simple)
        try {
          const eventData = createEventFromOrder(orderData);

          // Abrir Google Calendar automáticamente para agregar el evento
          openGoogleCalendar(eventData);

          toast.success('Recordatorio de calendario creado', {
            description: `Se abrió Google Calendar para agregar el evento de la orden #${orderData.id}`
          });

        } catch (calendarError) {
          console.error('[ProcessOrder] Error al crear el recordatorio de calendario:', calendarError);
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
      console.error('[ProcessOrder] Error al generar el PDF de la orden:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al generar el contrato';
      toast.error(errorMessage);

      // Notificar al cliente sobre el error en la generación
      await notifyPdfGenerated(
        'processing',
        '',
        false,
        errorMessage
      );
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Calendar event handler
  const handleAddToCalendar = () => {
    try {
      const eventData = createEventFromOrder(orderData);

      // Open Google Calendar
      openGoogleCalendar(eventData);

      toast.success('Calendario abierto', {
        description: `Agregando evento para orden #${orderData.id}`
      });

    } catch (error) {
      console.error('[ProcessOrder] Error al abrir el calendario:', error);
      toast.error('Error al abrir el calendario');
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

      // Usar el endpoint dedicado /api/orders/:id/generate-budget
      // sendEmail: false porque la notificación se envía manualmente desde el admin
      const response = await fetch(`/api/orders/${orderData.id}/generate-budget`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sendEmail: false }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al generar presupuesto');
      }

      const result = await response.json();

      if (result.success) {
        toast.success('Presupuesto generado exitosamente');

        // Notificar al cliente sobre la generación del presupuesto
        await notifyPdfGenerated(
          'budget',
          result.pdfUrl || '',
          true
        );

        // Reload the page to show the new PDF URL
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        throw new Error(result.message || 'Error al generar el presupuesto');
      }
    } catch (error) {
      console.error('[ProcessOrder] Error al generar el presupuesto:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al generar el presupuesto';
      toast.error(errorMessage);

      // Notificar al cliente sobre el error en la generación
      await notifyPdfGenerated(
        'budget',
        '',
        false,
        errorMessage
      );
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

      // Usar el endpoint dedicado /api/orders/:id/generate-budget
      // sendEmail: false porque la notificación se envía manualmente desde el admin
      const response = await fetch(`/api/orders/${orderData.id}/generate-budget`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sendEmail: false }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al actualizar presupuesto');
      }

      const result = await response.json();

      if (result.success) {
        toast.success('Presupuesto actualizado exitosamente');

        // Notificar al cliente sobre la actualización del presupuesto
        await notifyPdfGenerated(
          'budget',
          result.pdfUrl || '',
          true
        );

        // Reload the page to show the updated PDF URL history
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        throw new Error(result.message || 'Error al actualizar el presupuesto');
      }
    } catch (error) {
      console.error('[ProcessOrder] Error al actualizar el presupuesto:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al actualizar el presupuesto';
      toast.error(errorMessage);

      // Notificar al cliente sobre el error en la actualización
      await notifyPdfGenerated(
        'budget',
        '',
        false,
        errorMessage
      );
    } finally {
      setGeneratingBudget(false);
    }
  };

  // Delete Budget PDF function
  const handleDeleteBudgetPdf = async (budgetUrl: string) => {
    if (!orderData?.id) {
      toast.error('ID de orden no disponible');
      return;
    }

    // Confirmation dialog
    const confirmed = confirm('¿Eliminar este presupuesto? Esta acción actualizará la base de datos.');
    if (!confirmed) return;

    setDeletingPdf(true);
    try {

      const response = await fetch(`/api/orders/${orderData.id}/delete-pdf`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfType: 'budget',
          pdfUrl: budgetUrl
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al eliminar presupuesto');
      }

      const result = await response.json();

      if (result.success) {
        toast.success('Presupuesto eliminado exitosamente');

        // Reload the page to reflect changes
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        throw new Error(result.message || 'Error al eliminar el presupuesto');
      }
    } catch (error) {
      console.error('[ProcessOrder] Error al eliminar el presupuesto:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar el presupuesto';
      toast.error(errorMessage);
    } finally {
      setDeletingPdf(false);
    }
  };

  // Delete Contract PDF function
  const handleDeleteContractPdf = async () => {
    if (!orderData?.id) {
      toast.error('ID de orden no disponible');
      return;
    }

    // Confirmation dialog
    const confirmed = confirm('¿Eliminar contrato de procesamiento? Podrás regenerarlo después.');
    if (!confirmed) return;

    setDeletingPdf(true);
    try {

      const response = await fetch(`/api/orders/${orderData.id}/delete-pdf`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfType: 'contract'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al eliminar contrato');
      }

      const result = await response.json();

      if (result.success) {
        toast.success('Contrato eliminado exitosamente');

        // Reload the page to reflect changes
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        throw new Error(result.message || 'Error al eliminar el contrato');
      }
    } catch (error) {
      console.error('[ProcessOrder] Error al eliminar el contrato:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar el contrato';
      toast.error(errorMessage);
    } finally {
      setDeletingPdf(false);
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

  // Function to handle order status changes
  const handleStatusChange = async (request: StatusChangeRequest): Promise<StatusChangeOutcome> => {
    if (!orderData?.id) {
      toast.error('ID de orden no disponible');
      return { ok: false, error: 'ID de orden no disponible' };
    }

    const oldStatus = orderData.status || 'unknown';
    const { status: newStatus, reason } = request;

    try {
      // Antes esto solo notificaba: el comentario decía "aquí iría la lógica para actualizar el
      // estado" y el toast anunciaba un cambio que nunca ocurría. Al recargar, el admin veía el
      // estado anterior y volvía a intentarlo. El endpoint valida además la transición contra la
      // cadena del canónico, así que un salto ilegal se rechaza con un mensaje en español.
      const response = await fetch(`/api/orders/${orderData.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          ...(reason ? { reason } : {}),
          notify: request.notify === true,
          acknowledge_open_checkouts: request.acknowledgeOpenCheckouts === true,
        }),
      });
      const result = await response.json().catch(() => null);
      const outcome = readStatusChangeResponse(response.status, result);

      if (!outcome.ok) {
        // Units still out are a question for the admin (the quick actions ask it), not an error.
        if (outcome.code !== 'OPEN_CHECKOUTS') toast.error(outcome.error);
        return outcome;
      }

      // The chat note reaches the customer too: a jump without "Notificar al cliente" stays silent.
      if (request.notify === true || !shouldOfferNotify(oldStatus, newStatus)) await notifyStatusChange(
        oldStatus,
        newStatus,
        reason,
        `Cambio realizado desde el panel administrativo por ${sessionData?.user?.name || 'Administrador'}`
      );

      toast.success(`Estado cambiado de ${statusLabel(oldStatus)} a ${statusLabel(newStatus)}`);
      if (result?.warning) toast.warning(result.warning);

      // Recargar la página para mostrar el nuevo estado
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      return outcome;
    } catch (error) {
      console.error('[ProcessOrder] Error al cambiar el estado de la orden:', {
        orderId: orderData.id, oldStatus, newStatus, error,
      });
      const message = error instanceof Error ? error.message : 'Error al cambiar el estado de la orden';
      toast.error(message);
      return { ok: false, error: message };
    }
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

      const result = await sendManualEmail(manualEmailData);

      if (result.success) {
        toast.success('Correo enviado exitosamente');

        // Notificar al cliente a través del sistema de comunicaciones
        await notifyEmailSent(
          emailData.emailType,
          emailData.subject,
          customerEmail,
          emailData.message,
          [
            ...emailData.selectedBudgetUrls,
            ...(emailData.includeContract && orderData.new_pdf_processing_url ? [orderData.new_pdf_processing_url] : []),
            ...warrantyPhotos
          ].filter(Boolean)
        );

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
      console.error('[ProcessOrder] Error al enviar el correo manual:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al enviar el correo';
      toast.error(errorMessage);

      // Notificar al cliente sobre el error en el envío
      await notifyEmailFailed(
        emailData.emailType,
        emailData.subject,
        customerEmail,
        errorMessage,
        emailData.message
      );
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

  // Stock and availability-conflict lines under each product name in the items table.
  const renderItemDetails = (item: (typeof enhancedLineItems)[number]) => {
    const conflictsForProduct = productConflicts.filter(conflict =>
      conflict.conflictingProducts.some((p: any) => p.productId === Number(item.product_id))
    );
    const stockLabel =
      item.stock_status === 'instock' ? 'Disponible' :
        item.stock_status === 'not_found' ? 'Producto no encontrado' :
          item.stock_status === 'outofstock' ? 'Sin stock' :
            item.stock_status === 'onbackorder' ? 'En pedido' :
              'Estado desconocido';
    const stockTone =
      item.stock_status === 'instock' ? 'bg-[var(--color-ok-bg)] text-[var(--color-ok)]' :
        item.stock_status === 'not_found' ? 'bg-[var(--color-crit-bg)] text-[var(--color-crit)]' :
          'bg-[var(--color-neutral-bg)] text-[var(--color-neutral)]';

    return (
      <div className="mt-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className={`rounded-full px-[7px] py-px font-semibold ${stockTone}`}>Stock: {stockLabel}</span>
          {item.product_id > 0 && (
            <span className="font-mono text-[var(--color-text-faint)]">ID {item.product_id}</span>
          )}
        </div>
        {conflictsForProduct.length > 0 && (
          <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-warn-bg)] bg-[var(--color-warn-bg)] p-2.5 text-left">
            {conflictsForProduct.map((conflict, cIdx) => (
              <div key={cIdx} className="flex items-start gap-2 text-[11px] text-[var(--color-warn)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <span className="mb-0.5 block font-semibold">¡Alerta de coincidencia en fechas!</span>
                  Este equipo ya se encuentra procesado u ocupado para el proyecto <span className="font-medium">"{conflict.orderProject}"</span> (
                  <a href={`/orders/${conflict.orderId}`} target="_blank" rel="noopener noreferrer" className="mr-1 font-bold underline">
                    Orden #{conflict.orderId}
                  </a>
                  <StatusBadge variant="canon" tone={toBadgeTone(conflict.status)} label={statusLabel(conflict.status)} />
                  ) entre las fechas {rentalDateParts(conflict.startDate).date} y {rentalDateParts(conflict.endDate).date}.
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Canon RC2.1.2 detail view-model (pure helpers in `orderDetail.ts`).
  const itemTable = orderItemRows(enhancedLineItems, orderData.num_jornadas);
  const itemRows = enhancedLineItems.map((item, index) => ({
    ...itemTable.rows[index]!,
    key: `${item.product_id}-${index}`,
    imageUrl: item.images && item.images.length > 0 ? item.images[0] : undefined,
    details: renderItemDetails(item),
  }));
  const hasFinancialData = Boolean(orderData.calculated_subtotal || orderData.calculated_discount || orderData.calculated_iva || orderData.shipping_total || orderData.coupon_lines);
  const editNumDays = parseInt(orderData.num_jornadas?.toString() || '1');
  const editCalculations = updateAllCalculations(
    editedProducts,
    editNumDays,
    parseFloat(editedShipping || '0'),
    couponDiscountAmount,
    applyIva
  );
  const versions = budgetVersions(orderData.new_pdf_on_hold_url);
  const paymentSummary = orderPaymentSummary({
    total: parseFloat(String(orderData.calculated_total || 0)) || 0,
    reserveType,
    reserveValue,
    isPaid: isPaymentComplete,
  });
  const financialSummary = orderFinancialSummary(orderData, itemTable.total);
  const couponCodes = (() => {
    try {
      const lines = typeof orderData.coupon_lines === 'string' ? JSON.parse(orderData.coupon_lines) : orderData.coupon_lines;
      return Array.isArray(lines) ? lines.map((coupon: any) => String(coupon?.code ?? '')).filter(Boolean) : [];
    } catch {
      return [];
    }
  })();
  const shippingInfo = (() => {
    try {
      const lines = typeof orderData.shipping_lines === 'string' ? JSON.parse(orderData.shipping_lines) : orderData.shipping_lines;
      if (!Array.isArray(lines) || lines.length === 0) return null;
      const line = lines[0];
      return {
        isShipping: line?.meta_data?.delivery_method === 'shipping',
        isPickup: line?.meta_data?.delivery_method === 'pickup',
        methodTitle: line?.method_title || 'N/A',
        address: line?.meta_data?.shipping_address || '',
        phone: line?.meta_data?.shipping_phone || '',
        cost: parseFloat(line?.total || '0') || 0,
      };
    } catch {
      return null;
    }
  })();

  return (
    <div className="mt-2">
      <OrderDetailHeader
        orderId={orderData.id}
        project={orderData.order_proyecto}
        clientLine={clientLine(getCustomerName(), orderData.billing_company)}
        createdLabel={`Creado el ${formatBusinessDate(orderData.date_created ?? '')}`}
        status={orderData.status}
        actions={
          <>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={loading}
              className={canonSecondaryButtonClass}
            >
              <Edit className="h-3.5 w-3.5" aria-hidden="true" />
              Editar pedido
            </button>
            <button
              type="button"
              onClick={handleAddToCalendar}
              className={canonSecondaryButtonClass}
              title="Agregar recordatorio a Google Calendar"
            >
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              Calendario
            </button>
          </>
        }
      />

      <OrderPipeline status={orderData.status} />

      <div className="grid grid-cols-1 items-start gap-4 min-[1025px]:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-[14px]">
          {isEditingFinancials ? (
            <DetailCard
              title="Editor de pedido"
              icon={<Edit className="h-3.5 w-3.5" aria-hidden="true" />}
              actions={
                <>
                  <button
                    type="button"
                    onClick={handleSaveFinancials}
                    disabled={savingFinancials}
                    className={canonPrimaryButtonClass}
                  >
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    {savingFinancials ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelFinancialEdit}
                    className={canonSecondaryButtonClass}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Cancelar
                  </button>
                </>
              }
            >
            <div className="space-y-4">
              {/* Editable Products Section */}
              {isEditingFinancials && (
                <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <Label className="font-medium">Productos del Pedido</Label>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowProductSelector(true)}
                      disabled={savingFinancials}
                      className="flex items-center gap-2"
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

                      const imageUrl = item.images && item.images.length > 0
                        ? (typeof item.images[0] === 'string'
                          ? item.images[0]
                          : item.images[0]?.src || item.images[0]?.url || item.images[0])
                        : null;


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
                                  console.error('[ProcessOrder] No se pudo cargar la imagen del producto:', imageUrl);
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                                onLoad={() => {
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
                  <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
                    <div className="flex justify-between items-center font-medium">
                      <span>Subtotal de productos:</span>
                      <span className="font-mono">
                        ${calculateEditedSubtotal().toLocaleString('es-CL')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Editable Coupon Section */}
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <Label className="font-medium">Cupón de Descuento</Label>
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

              {/* R-05: descuento manual por % o $ (sin cupón) */}
                <OrderDiscountControl
                  idPrefix={`order-${orderData.id}`}
                  value={manualDiscount}
                  onChange={(next) => {
                    setManualDiscount(next);
                    setManualDiscountTouched(true);
                  }}
                  productsSubtotal={calculateEditedSubtotal()}
                  disabled={Boolean(appliedCoupon)}
                />

              {/* Calculated Discount Display */}
              {editCalculations.calculated_discount > 0 && (
                <div className="flex justify-between items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-3 text-sm">
                  <span className="font-medium text-[var(--color-text-secondary)]">Descuento total aplicado:</span>
                  <span className="font-mono font-medium text-[var(--color-ok)]">
                    -{formatCLP(editCalculations.calculated_discount)}
                  </span>
                </div>
              )}

              {/* Delivery Method & Shipping Section */}
                <div className="space-y-4">
                  {/* Método de Entrega */}
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-4">
                    <h4 className="font-medium text-sm mb-3">¿Cómo desea entregar el pedido?</h4>
                    <div className="mb-2 rounded bg-[var(--color-surface-2)] p-2 text-xs text-[var(--color-text-secondary)]">
                      <strong>Estado actual:</strong> {deliveryMethod === 'pickup' ? 'Retiro en tienda' : 'Delivery a domicilio'}
                    </div>
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
                            <span className="font-medium">Delivery a domicilio</span>
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            Delivery del pedido a la dirección del cliente
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Selector de Métodos de Envío (solo si se selecciona shipping) */}
                  {deliveryMethod === 'shipping' && (
                    <div className="space-y-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-4">
                      <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        Información de Delivery
                      </h4>

                      {/* Campos de dirección y teléfono según requisitos del método */}
                      {selectedShippingMethod?.requires_address && (
                        <div className="space-y-2">
                          <Label htmlFor="shippingAddressEdit" className="text-sm font-medium text-gray-700">
                            Dirección de delivery *
                          </Label>
                          <AddressInput
                            id="shippingAddressEdit"
                            placeholder="Dirección completa de delivery"
                            value={shippingAddress}
                            onChange={setShippingAddress}
                            onSelect={(address) => setShippingAddress(address.formattedAddress)}
                            className="w-full bg-white"
                            required
                          />
                          {shippingAddress && (
                            <p className="rounded bg-[var(--color-surface-2)] p-2 text-xs text-[var(--color-text-secondary)]">
                              <strong>Dirección guardada:</strong> {shippingAddress}
                            </p>
                          )}
                        </div>
                      )}

                      {selectedShippingMethod?.requires_phone && (
                        <div className="space-y-2">
                          <Label htmlFor="shippingPhoneEdit" className="text-sm font-medium text-gray-700">
                            Teléfono de contacto *
                          </Label>
                          <Input
                            id="shippingPhoneEdit"
                            type="tel"
                            placeholder="Teléfono para coordinar la entrega"
                            value={shippingPhone}
                            onChange={(e) => setShippingPhone(e.target.value)}
                            className="w-full bg-white"
                            required
                          />
                          {shippingPhone && (
                            <p className="rounded bg-[var(--color-surface-2)] p-2 text-xs text-[var(--color-text-secondary)]">
                              <strong>Teléfono guardado:</strong> {shippingPhone}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Información sobre campos requeridos */}
                      {selectedShippingMethod && (selectedShippingMethod.requires_address || selectedShippingMethod.requires_phone) && (
                        <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
                          <strong>Campos requeridos para este método de delivery:</strong>
                          <ul className="list-disc list-inside mt-1">
                            {selectedShippingMethod.requires_address && <li>Dirección de delivery</li>}
                            {selectedShippingMethod.requires_phone && <li>Teléfono de contacto</li>}
                          </ul>
                        </div>
                      )}
                      {shippingLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                          Cargando métodos de delivery...
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          {shippingMethods.map((method) => {
                            const numDays = parseInt(orderData.num_jornadas?.toString() || '1');
                            const productsSubtotal = calculateProductsSubtotal(editedProducts, numDays);
                            const validation = validateShippingMethod(method, productsSubtotal);
                            const isSelected = selectedShippingMethod?.id === method.id;

                            return (
                              <div
                                key={method.id}
                                className={`border rounded-lg p-3 cursor-pointer transition-colors ${isSelected
                                  ? 'border-primary bg-primary/5'
                                  : validation.isValid
                                    ? 'border-border hover:border-primary/50'
                                    : 'border-border bg-muted/50 cursor-not-allowed opacity-60'
                                  }`}
                                onClick={() => validation.isValid && handleShippingMethodSelect(method)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                                      }`}>
                                      {isSelected && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium">{method.name}</span>
                                        <Badge variant="outline" className="text-xs px-2 py-0.5">
                                          {getShippingTypeLabel(method.shipping_type)}
                                        </Badge>
                                        {method.metadata?.custom && (
                                          <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                            <Settings className="h-3 w-3 mr-1" />
                                            Personalizado
                                          </Badge>
                                        )}
                                        <span className="font-mono text-sm font-semibold">
                                          {formatShippingCost(method.cost)}
                                        </span>
                                      </div>
                                      {method.description && (
                                        <p className="text-sm text-muted-foreground">{method.description}</p>
                                      )}
                                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                        <span>Entrega: {formatDeliveryTime(method.estimated_days_min, method.estimated_days_max)}</span>
                                        {method.requires_address && (
                                          <span>Requiere dirección</span>
                                        )}
                                        {method.requires_phone && (
                                          <span>Requiere teléfono</span>
                                        )}
                                      </div>
                                      {(method.min_amount || method.max_amount) && (
                                        <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                          {method.min_amount && `Mín: ${formatShippingCost(method.min_amount)}`}
                                          {method.min_amount && method.max_amount && ' • '}
                                          {method.max_amount && `Máx: ${formatShippingCost(method.max_amount)}`}
                                        </div>
                                      )}
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
                              No hay métodos de delivery disponibles
                            </div>
                          )}

                          {/* Indicador de fuente de métodos */}
                          {shippingMethodsSource && (
                            <div className={`text-xs p-2 rounded mt-2 ${shippingMethodsSource === 'database'
                              ? 'bg-[var(--color-ok-bg)] text-[var(--color-ok)]'
                              : 'bg-[var(--color-warn-bg)] text-[var(--color-warn)]'
                              }`}>
                              {shippingMethodsSource === 'database' ? (
                                <>Métodos cargados desde base de datos ({shippingMethods.length} disponibles)</>
                              ) : (
                                <>Usando métodos de respaldo (base de datos no disponible)</>
                              )}
                            </div>
                          )}

                          {/* Botón para agregar envío customizado */}
                          <div className="mt-4 pt-3 border-t border-gray-200">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowCustomShippingForm(true)}
                              className="w-full flex items-center gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Crear Delivery Personalizado
                            </Button>
                          </div>

                          {/* Formulario de envío customizado */}
                          {showCustomShippingForm && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                              <h5 className="font-medium text-sm mb-3 flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                Crear Delivery Personalizado
                              </h5>

                              <div className="space-y-3">
                                <div>
                                  <Label htmlFor="customShippingName" className="text-xs font-medium">
                                    Nombre del delivery *
                                  </Label>
                                  <Input
                                    id="customShippingName"
                                    type="text"
                                    placeholder="Ej: Delivery Express Personalizado"
                                    value={customShippingData.name}
                                    onChange={(e) => setCustomShippingData(prev => ({ ...prev, name: e.target.value }))}
                                    className="mt-1"
                                  />
                                </div>

                                <div>
                                  <Label htmlFor="customShippingDescription" className="text-xs font-medium">
                                    Descripción
                                  </Label>
                                  <Input
                                    id="customShippingDescription"
                                    type="text"
                                    placeholder="Descripción del método de delivery"
                                    value={customShippingData.description}
                                    onChange={(e) => setCustomShippingData(prev => ({ ...prev, description: e.target.value }))}
                                    className="mt-1"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label htmlFor="customShippingCost" className="text-xs font-medium">
                                      Costo *
                                    </Label>
                                    <Input
                                      id="customShippingCost"
                                      type="number"
                                      placeholder="0"
                                      value={customShippingData.cost}
                                      onChange={(e) => setCustomShippingData(prev => ({ ...prev, cost: e.target.value }))}
                                      className="mt-1"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <Label htmlFor="customShippingMinDays" className="text-xs font-medium">
                                        Días mín.
                                      </Label>
                                      <Input
                                        id="customShippingMinDays"
                                        type="number"
                                        min="1"
                                        value={customShippingData.estimated_days_min}
                                        onChange={(e) => setCustomShippingData(prev => ({ ...prev, estimated_days_min: e.target.value }))}
                                        className="mt-1"
                                      />
                                    </div>

                                    <div>
                                      <Label htmlFor="customShippingMaxDays" className="text-xs font-medium">
                                        Días máx.
                                      </Label>
                                      <Input
                                        id="customShippingMaxDays"
                                        type="number"
                                        min="1"
                                        value={customShippingData.estimated_days_max}
                                        onChange={(e) => setCustomShippingData(prev => ({ ...prev, estimated_days_max: e.target.value }))}
                                        className="mt-1"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleCustomShippingSubmit}
                                    className="flex-1"
                                  >
                                    Crear Delivery
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCustomShippingCancel}
                                    className="flex-1"
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* R-06: conductor del despacho, guardado aparte en shipping_usage. */}
                      {orderData?.id && <OrderDriverField orderId={orderData.id} />}
                    </div>
                  )}
                </div>

              {/* Subtotal Calculado (productos + envío - cupón) */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Subtotal calculado:</span>
                <span className="font-mono font-medium">{formatCLP(editCalculations.calculated_subtotal)}</span>
              </div>

              {/* IVA Toggle Checkbox - Only visible when editing */}
                <div className="flex items-center justify-between gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="apply-iva-order"
                      checked={applyIva}
                      onCheckedChange={(checked) => setApplyIva(checked === true)}
                    />
                    <Label
                      htmlFor="apply-iva-order"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Incluir IVA (19%)
                    </Label>
                  </div>
                </div>

              {/* IVA */}
              {editCalculations.calculated_iva > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">IVA (19%):</span>
                  <span className="font-mono font-medium">{formatCLP(editCalculations.calculated_iva)}</span>
                </div>
              )}

              <div className="my-3 border-t border-[var(--color-border)]"></div>

              {/* Final Total */}
              <div className="flex justify-between items-center rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-3 text-base font-bold">
                <span className="text-[var(--color-text-primary)]">Total final:</span>
                <span className="font-mono text-[var(--color-text-primary)]">{formatCLP(calculateUpdatedTotal())}</span>
              </div>
            </div>
            </DetailCard>
          ) : (
            <DetailCard
              title="Equipos & Productos"
              icon={<Package className="h-3.5 w-3.5" aria-hidden="true" />}
              meta={`${enhancedLineItems.length} equipo${enhancedLineItems.length === 1 ? '' : 's'}`}
              actions={
                hasFinancialData ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingFinancials(true)}
                    className={canonSecondaryButtonClass}
                  >
                    <Edit className="h-3.5 w-3.5" aria-hidden="true" />
                    Editar
                  </button>
                ) : undefined
              }
              noPad
            >
              {loadingProducts ? (
                <div className="space-y-3 p-[14px]">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : itemRows.length > 0 ? (
                <OrderItemsTable rows={itemRows} total={itemTable.total} />
              ) : (
                <div className="px-[14px] py-10 text-center text-[var(--color-text-faint)]">
                  <Package className="mx-auto mb-3 h-8 w-8 opacity-40" aria-hidden="true" />
                  <p className="m-0 text-sm font-medium text-[var(--color-text-secondary)]">No hay productos en este pedido</p>
                  <p className="m-0 mt-1 text-xs">Usa Editar pedido para agregarlos.</p>
                </div>
              )}
            </DetailCard>
          )}

          <DetailCard
            title="Presupuestos y contrato"
            icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
            meta={versions.length > 0 ? `${versions.length} ${versions.length === 1 ? 'versión' : 'versiones'}` : undefined}
            noPad
          >
            {versions.length > 0 ? (
              <BudgetVersionList
                versions={versions}
                onOpen={(url) => window.open(url, '_blank')}
                onDelete={handleDeleteBudgetPdf}
                disabled={deletingPdf}
              />
            ) : (
              <p className="m-0 border-b border-[var(--color-border-soft)] px-[14px] py-3 text-xs text-[var(--color-text-faint)]">
                Sin presupuesto generado.
              </p>
            )}
            {orderData.new_pdf_processing_url && (
              <div className="flex items-center gap-2.5 border-t border-[var(--color-border-soft)] px-[14px] py-[9px]">
                <FileCheck className="h-3.5 w-3.5 text-[var(--color-text-faint)]" aria-hidden="true" />
                <span className="flex-1 text-xs text-[var(--color-text-primary)]">Contrato</span>
                <button
                  type="button"
                  onClick={() => window.open(orderData.new_pdf_processing_url || undefined, '_blank')}
                  className="whitespace-nowrap rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-[3px] text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
                >
                  Ver
                </button>
                <button
                  type="button"
                  onClick={handleDeleteContractPdf}
                  disabled={deletingPdf}
                  aria-label="Eliminar contrato"
                  title="Eliminar contrato"
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--color-crit)] hover:bg-[var(--color-crit-bg)] disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 border-t border-[var(--color-border)] bg-[var(--color-surface-soft)] px-[14px] py-2.5">
              {!orderData.new_pdf_on_hold_url ? (
                <button
                  type="button"
                  onClick={handleGenerateBudgetPdf}
                  disabled={generatingBudget}
                  className={canonSecondaryButtonClass}
                  title="Generar presupuesto"
                >
                  {generatingBudget ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FileText className="h-3.5 w-3.5" aria-hidden="true" />}
                  {generatingBudget ? 'Generando...' : 'Generar presupuesto'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleUpdateBudgetPdf}
                  disabled={generatingBudget}
                  className={canonSecondaryButtonClass}
                  title="Actualizar presupuesto - Genera una nueva versión y mantiene el historial"
                >
                  {generatingBudget ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FileText className="h-3.5 w-3.5" aria-hidden="true" />}
                  {generatingBudget ? 'Actualizando...' : 'Actualizar presupuesto'}
                </button>
              )}
              {!orderData.new_pdf_processing_url && (
                <button
                  type="button"
                  onClick={handleGenerateOrderPdf}
                  disabled={generatingPdf}
                  className={canonSecondaryButtonClass}
                  title="Generar contrato de procesamiento"
                >
                  {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FileCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                  {generatingPdf ? 'Generando...' : 'Generar contrato'}
                </button>
              )}
            </div>
          </DetailCard>

          <OrderNoteBlock text={orderData.order_comments} />

          {/* Warranty Photos Section */}
          <WarrantyImageUpload
            orderId={orderData?.id || null}
            currentImages={warrantyPhotos}
            onImagesUpdate={handleWarrantyPhotosUpdate}
          />

          {/* Admin Communications Section */}
          <AdminCommunications
            orderId={orderData?.id || 0}
            customerInfo={{
              id: orderData?.customer_id?.toString() || '',
              name: `${orderData?.billing_first_name || ''} ${orderData?.billing_last_name || ''}`.trim(),
              email: orderData?.billing_email || ''
            }}
            adminInfo={{
              id: sessionData?.user?.id || 'admin',
              name: sessionData?.user?.name || 'Administrador',
              email: sessionData?.user?.email || 'admin@rental.com'
            }}
          />
        </div>

        <aside className="flex min-w-0 flex-col gap-[14px] min-[1025px]:sticky min-[1025px]:top-5">
          <OrderActionsCard
            statusActions={
              <OrderStatusQuickActions
                currentStatus={orderData.status}
                role={sessionData?.user?.role ?? null}
                onChangeStatus={handleStatusChange}
              />
            }
            primary={{
              label: 'Enviar correo al cliente',
              icon: <Send className="h-4 w-4" aria-hidden="true" />,
              onClick: () => setShowEmailModal(true),
            }}
            note="Puedes adjuntar al correo el presupuesto y el contrato generados."
          />

          <OrderClientCard
            name={getCustomerName().trim()}
            company={orderData.billing_company}
            email={getCustomerEmail()}
            phone={orderData.billing_phone}
            customerId={String(orderData.customer_id || orderData.customer?.id || 'N/A')}
            rut={orderData.company_rut}
          />

          <OrderDatesCard
            start={orderData.order_fecha_inicio}
            end={orderData.order_fecha_termino}
            jornadas={orderData.num_jornadas}
          />

          {shippingInfo && (
            <DetailCard
              title={shippingInfo.isShipping ? 'Delivery' : 'Retiro'}
              icon={shippingInfo.isShipping ? <Truck className="h-3.5 w-3.5" aria-hidden="true" /> : <MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
              noPad
            >
              <dl className="m-0 text-[11px]">
                {[
                  ['Método de entrega', shippingInfo.isShipping ? 'Delivery a domicilio' : 'Retiro en tienda'],
                  ['Método', shippingInfo.methodTitle],
                  ...(shippingInfo.address ? [['Dirección', shippingInfo.address]] : []),
                  ...(shippingInfo.phone ? [['Teléfono', shippingInfo.phone]] : []),
                  ['Costo', shippingInfo.isPickup ? 'Gratis' : formatCLP(shippingInfo.cost)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-[var(--color-border-soft)] px-[14px] py-[7px] last:border-b-0">
                    <dt className="text-[var(--color-text-secondary)]">{label}</dt>
                    <dd className={`m-0 text-right text-[var(--color-text-primary)]${label === 'Costo' ? ' font-mono' : ''}`}>{value}</dd>
                  </div>
                ))}
              </dl>
            </DetailCard>
          )}

          <OrderPaymentCard
            statusLabel={statusLabel(orderData.status)}
            summary={paymentSummary}
            paymentMethod={orderData.payment_method ? (orderData.payment_method_title || orderData.payment_method) : null}
            transactionId={orderData.transaction_id}
          >
            {/* R-04b: informe guardado al finalizar la devolución (migración 0018). */}
            <ReturnReportSummary orderId={orderData.id} />
            <details className="mt-2 border-t border-[var(--color-border-soft)] pt-2">
              <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                Configurar reserva
              </summary>
              <div className="mt-2.5 space-y-2.5">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setReserveType('percent')}
                    aria-pressed={reserveType === 'percent'}
                    className={`flex-1 ${reserveType === 'percent' ? canonPrimaryButtonClass : canonSecondaryButtonClass}`}
                  >
                    <Percent className="h-3 w-3" aria-hidden="true" /> Porcentaje
                  </button>
                  <button
                    type="button"
                    onClick={() => setReserveType('fixed')}
                    aria-pressed={reserveType === 'fixed'}
                    className={`flex-1 ${reserveType === 'fixed' ? canonPrimaryButtonClass : canonSecondaryButtonClass}`}
                  >
                    <DollarSign className="h-3 w-3" aria-hidden="true" /> Monto fijo
                  </button>
                </div>
                <div>
                  <Label htmlFor="reserve-value" className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                    {reserveType === 'fixed' ? 'Monto en CLP' : 'Porcentaje (%)'}
                  </Label>
                  <Input
                    id="reserve-value"
                    type="number"
                    min="0"
                    max={reserveType === 'percent' ? '100' : undefined}
                    value={reserveValue}
                    onChange={(e) => setReserveValue(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveReserveConfig}
                  disabled={savingReserve}
                  className={`w-full ${canonSecondaryButtonClass}`}
                >
                  <Save className="h-3 w-3" aria-hidden="true" />
                  {savingReserve ? 'Guardando...' : 'Guardar reserva'}
                </button>
              </div>
            </details>
          </OrderPaymentCard>

          <OrderFinancialCard
            summary={financialSummary}
            couponCodes={couponCodes}
            footer={`Moneda: ${orderData.currency || 'CLP'} · Última actualización: ${formatBusinessDateTimeFull(orderData.date_modified ?? '')}`}
          />
        </aside>
      </div>

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
    </div>
  );
}

export default ProcessOrder;
