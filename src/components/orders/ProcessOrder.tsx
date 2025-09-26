import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Edit, Package, Image as ImageIcon, Hash, AlertTriangle, Save, X, Tag, Truck, Plus, Minus, Trash2, Upload } from 'lucide-react';
import EditOrderForm from './EditOrderForm';
import { CouponSelector } from './CouponSelector';
import { ProductSelector } from './ProductSelector';
import { apiClient } from '@/services/apiClient';
import type { Database } from '@/types/database';
import { toast } from 'sonner';
import { warrantyPhotosService, type WarrantyPhotosUploadResult } from '@/services/warrantyPhotosService';


type Coupon = Database['public']['Tables']['coupons']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

// Enhanced interfaces using proper database types
type DatabaseOrder = Database['public']['Tables']['orders']['Row'];
type DatabaseProduct = Database['public']['Tables']['products']['Row'];

interface EnhancedLineItem {
  id?: number;
  name: string;
  product_id?: number;
  quantity: number;
  subtotal: string | number;
  total: string | number;
  price?: string | number;
  sku?: string;
  images?: string[];
  description?: string;
  short_description?: string;
  stock_status?: string;
  conflicts?: EnhancedProductConflict[];
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

// Enhanced interface for product conflicts with professional details
interface EnhancedProductConflict {
  orderId: number;
  orderProject: string;
  startDate: string;
  endDate: string;
  status: string;
  customerName: string;
  customerEmail: string;
  workDays: number;
  overlapDays: number;
  overlapPercentage: number;
  conflictSeverity: 'low' | 'medium' | 'high' | 'critical';
  conflictingProducts: Array<{
    productId: number;
    productName: string;
    productSku?: string;
    productImages?: string[];
    productDescription?: string;
    productStockStatus?: string;
    productPrice?: number;
    quantity: number;
    conflictType: 'full' | 'partial';
    availabilityStatus: 'unavailable' | 'partially_available' | 'requires_coordination';
  }>;
  orderDetails: {
    totalValue: number;
    currency: string;
    createdDate: string;
    lastModified: string;
    orderUrl?: string;
  };
  resolutionSuggestions: {
    canReschedule: boolean;
    alternativeDates?: string[];
    canShareEquipment: boolean;
    contactRequired: boolean;
    priority: 'low' | 'medium' | 'high';
  };
}

function ProcessOrder({ order, sessionData }: { order: WPOrderResponse, sessionData?: any }) {
  console.log('ProcessOrder received:', order);

  const orderData = order?.orders?.orders?.[0];
  
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productsData, setProductsData] = useState<DatabaseProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productConflicts, setProductConflicts] = useState<EnhancedProductConflict[]>([]);
  const [loadingConflicts, setLoadingConflicts] = useState(false);
  
  // Financial editing states
  const [isEditingFinancials, setIsEditingFinancials] = useState(false);
  const [editedShipping, setEditedShipping] = useState(orderData?.shipping_total?.toString() || '0');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponDiscountAmount, setCouponDiscountAmount] = useState(0);
  const [savingFinancials, setSavingFinancials] = useState(false);
  
  // Product editing states
  const [editedProducts, setEditedProducts] = useState<EnhancedLineItem[]>([]);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [editedManualDiscount, setEditedManualDiscount] = useState(orderData?.calculated_discount?.toString() || '0');
  
  // Warranty photos states
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Initialize coupon and product state from order data
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
        console.error('Error parsing coupon_lines:', error);
      }
    }
    
    if (orderData?.shipping_total) {
      setEditedShipping(orderData.shipping_total.toString());
    }
    
    if (orderData?.calculated_discount) {
      setEditedManualDiscount(orderData.calculated_discount.toString());
    }
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
            return typeof id === 'string' ? parseInt(id, 10) : id;
          })
          .filter(id => id && !isNaN(id));
        
        if (productIds.length > 0) {
          const response = await apiClient.post('/api/products/batch', { ids: productIds });
          const result = await apiClient.handleJsonResponse<{success: boolean, data: DatabaseProduct[]}>(response);
          
          if (result.success) {
            setProductsData(result.data || []);
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

  // Load product conflicts for date overlap detection
  useEffect(() => {
    const loadProductConflicts = async () => {
      if (!orderData?.line_items || 
          !orderData.order_fecha_inicio || 
          !orderData.order_fecha_termino ||
          orderData.line_items.length === 0) {
        return;
      }
      
      setLoadingConflicts(true);
      try {
        const productIds = orderData.line_items
          .map(item => {
            // Ensure we convert to number if it's a string
            const id = item.product_id;
            return typeof id === 'string' ? parseInt(id, 10) : id;
          })
          .filter(id => id && !isNaN(id)) as number[];
        
        if (productIds.length > 0) {
          const conflictData = {
            currentOrderId: typeof orderData.id === 'string' ? parseInt(orderData.id, 10) : orderData.id,
            productIds,
            startDate: orderData.order_fecha_inicio,
            endDate: orderData.order_fecha_termino
          };
          const response = await apiClient.post('/api/orders/check-conflicts', conflictData);
          
          const result = await apiClient.handleJsonResponse<{
            success: boolean; 
            data: EnhancedProductConflict[];
            summary?: {
              totalConflicts: number;
              severityLevel: string;
              conflictingOrders: number[];
              conflictingProducts: number[];
              impactAnalysis?: {
                totalAffectedProducts: number;
                totalAffectedOrders: number;
                criticalConflicts: number;
                highPriorityConflicts: number;
                averageOverlapPercentage: number;
                requiresImmediateAttention: boolean;
                canBeResolved: boolean;
              };
              recommendations?: {
                primaryAction: string;
                contactCustomers: number[];
                alternativeProducts: boolean;
                urgencyLevel: string;
              };
            };
          }>(response);
          
          if (result.success) {
            setProductConflicts(result.data || []);
          }
        }
      } catch (error) {
        console.error('Error loading product conflicts:', error);
      } finally {
        setLoadingConflicts(false);
      }
    };

    loadProductConflicts();
  }, [orderData?.line_items, orderData?.order_fecha_inicio, orderData?.order_fecha_termino, orderData?.id]);
  
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

  // Get conflicts for a specific product
  const getProductConflicts = useCallback((productId: number) => {
    return productConflicts.filter(conflict => 
      conflict.conflictingProducts.some(cp => cp.productId === productId)
    );
  }, [productConflicts]);


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

  const calculateEditedSubtotal = () => {
    return editedProducts.reduce((sum, item) => {
      return sum + (parseFloat(item.total?.toString() || '0'));
    }, 0);
  };

  const calculateUpdatedTotal = () => {
    const subtotal = isEditingFinancials ? calculateEditedSubtotal() : parseFloat(orderData.calculated_subtotal?.toString() || '0');
    const manualDiscount = parseFloat(editedManualDiscount || '0');
    const shipping = parseFloat(editedShipping || '0');
    const iva = subtotal * 0.19; // Calculate IVA as 19% of subtotal
    
    return subtotal - manualDiscount - couponDiscountAmount + shipping + iva;
  };

  const handleSaveFinancials = async () => {
    try {
      setSavingFinancials(true);
      
      const subtotal = calculateEditedSubtotal();
      const iva = subtotal * 0.19;
      
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
        calculated_subtotal: subtotal,
        calculated_discount: parseFloat(editedManualDiscount || '0'),
        calculated_iva: iva,
        shipping_total: parseFloat(editedShipping || '0'),
        coupon_lines: appliedCoupon ? [{
          id: appliedCoupon.id,
          code: appliedCoupon.code,
          discount: couponDiscountAmount,
          discount_type: appliedCoupon.discount_type,
          amount: appliedCoupon.amount
        }] : [],
        calculated_total: calculateUpdatedTotal()
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
    setEditedManualDiscount(orderData?.calculated_discount?.toString() || '0');
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
    
    setIsEditingFinancials(false);
    setShowProductSelector(false);
    toast.info('Cambios cancelados');
  };

  // Enhanced line items with product details
  const enhancedLineItems = useMemo(() => {
    if (!orderData.line_items) return [];
    
    return orderData.line_items.map(item => {
      const productDetails = getProductDetails(item.product_id || 0);
      const images = productDetails ? parseProductImages(productDetails.images) : [];
      const conflicts = getProductConflicts(item.product_id || 0);
      
      return {
        ...item,
        images,
        description: productDetails?.description || '',
        short_description: productDetails?.short_description || '',
        stock_status: productDetails?.stock_status || 'unknown',
        conflicts
      };
    });
  }, [orderData.line_items, getProductDetails, parseProductImages, getProductConflicts]);

  // Initialize edited products from enhanced line items when they change
  useEffect(() => {
    if (enhancedLineItems.length > 0 && editedProducts.length === 0) {
      setEditedProducts([...enhancedLineItems]);
    }
  }, [enhancedLineItems, editedProducts.length]);

  // Product editing handlers
  const handleProductSelected = (product: Product) => {
    const newItem: EnhancedLineItem = {
      id: Date.now(), // Temporary ID for new items
      name: product.name || '',
      product_id: product.id,
      quantity: 1,
      price: product.price || product.regular_price || 0,
      total: product.price || product.regular_price || 0,
      subtotal: product.price || product.regular_price || 0,
      sku: product.sku || '',
      images: product.images ? (typeof product.images === 'string' ? JSON.parse(product.images) : product.images) : [],
      description: product.description || '',
      short_description: product.short_description || '',
      stock_status: product.stock_status || 'instock'
    };
    
    setEditedProducts(prev => [...prev, newItem]);
    setShowProductSelector(false);
    toast.success(`Producto agregado: ${product.name || 'Producto'}`);
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

  // Warranty photos handlers
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    const validation = warrantyPhotosService.validateFiles(fileArray);

    if (!validation.valid) {
      validation.errors.forEach(error => toast.error(error));
      return;
    }

    setSelectedFiles(fileArray);
    setShowUploadModal(true);
  };

  const handleUploadPhotos = async () => {
    if (!selectedFiles.length || !orderData?.id) return;

    setUploadingPhotos(true);
    try {
      const result: WarrantyPhotosUploadResult = await warrantyPhotosService.uploadWarrantyPhotos(
        orderData.id,
        selectedFiles
      );

      if (result.success) {
        toast.success(`${result.totalPhotos} fotos subidas exitosamente`);
        setShowUploadModal(false);
        setSelectedFiles([]);
        
        // Reload the page to show updated photos
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        throw new Error(result.error || 'Error al subir las fotos');
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast.error(error instanceof Error ? error.message : 'Error al subir las fotos');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleCancelUpload = () => {
    setShowUploadModal(false);
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
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
            {/* Enhanced Products Section */}
            <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Productos del Pedido <span className="text-sm text-muted-foreground">({orderData.line_items?.length || 0})</span>
            {loadingConflicts && (
              <Badge variant="outline" className="ml-auto">
                Verificando disponibilidad...
              </Badge>
            )}
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
                            }).format(Number(item.total))}
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
                          {/* Product Description with Discrete Conflict Indicator */}
                          <div className="relative">
                            {item.short_description && (
                              <p className="text-sm text-gray-600 line-clamp-2 pr-6">
                                {item.short_description}
                              </p>
                            )}
                            
                            {/* Enhanced Conflict Indicator */}
                            
                          </div>
                          
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant={item.stock_status === 'instock' ? 'default' : 'secondary'}>
                              Stock: {item.stock_status === 'instock' ? 'Disponible' : 'No disponible'}
                            </Badge>
                            <Badge variant="outline">
                              Cantidad: {item.quantity}
                            </Badge>
                            {item.product_id && (
                              <Badge variant="outline">
                                ID: {item.product_id}
                              </Badge>
                            )}
                            {/* Simple Conflict Badges - Show all conflicting orders */}
                            {item.conflicts && item.conflicts.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="destructive" className="text-xs">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Conflicto
                                </Badge>
                                {/* Show each conflicting order as a simple badge */}
                                {item.conflicts.map((conflict, idx) => (
                                  <a
                                    key={`${conflict.orderId}-${idx}`}
                                    href={`/orders/${conflict.orderId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block"
                                    title={`Orden #${conflict.orderId} - ${conflict.customerName} (${conflict.overlapPercentage}% solapamiento)`}
                                  >
                                    <Badge 
                                      variant="outline" 
                                      className="text-xs bg-red-50 border-red-300 text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
                                    >
                                      #{conflict.orderId}
                                    </Badge>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>


                          {/* Show all product images */}
                          {item.images && item.images.length > 1 && (
                            <div className="mt-3">
                              <p className="text-sm font-medium mb-2">Imágenes del producto:</p>
                              <div className="flex gap-2 overflow-x-auto">
                                {item.images.map((image, imgIndex) => (
                                  <div key={imgIndex} className="flex-shrink-0">
                                    <img
                                      src={image}
                                      alt={`${item.name} - Imagen ${imgIndex + 1}`}
                                      className="w-12 h-12 object-cover rounded border"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
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
                      <div className=" rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
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
                          onProductSelect={handleProductSelected}
                          selectedProducts={editedProducts.map(p => ({ id: p.product_id || 0, quantity: p.quantity }))}
                          accessToken={sessionData?.access_token}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Edited Products List */}
                  <div className="space-y-3">
                    {editedProducts.map((item, index) => (
                      <div key={`${item.product_id}-${index}`} className="flex items-center gap-3 p-3  rounded-lg border">
                        {/* Product Image */}
                        <div className="flex-shrink-0">
                          {item.images && item.images.length > 0 ? (
                            <img
                              src={typeof item.images[0] === 'string' ? item.images[0] : item.images[0]?.src || item.images[0]?.url}
                              alt={item.name}
                              className="w-12 h-12 object-cover rounded border"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
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
                    ))}
                    
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
              
              {/* Manual Discount Section */}
              {isEditingFinancials ? (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-red-600" />
                    <Label htmlFor="manual-discount" className="text-red-700 font-medium">Descuento Manual</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-600">$</span>
                    <Input
                      id="manual-discount"
                      type="number"
                      value={editedManualDiscount}
                      onChange={(e) => setEditedManualDiscount(e.target.value)}
                      disabled={savingFinancials}
                      className="flex-1"
                      min="0"
                      step="1000"
                      placeholder="0"
                    />
                  </div>
                  <p className="text-xs text-red-600 mt-2">
                    Descuento adicional aplicado manualmente
                  </p>
                </div>
              ) : (
                // Display base subtotal and manual discount (read-only)
                <>
                  {orderData.calculated_subtotal && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Subtotal Base:</span>
                      <span className="font-medium">${orderData.calculated_subtotal.toLocaleString('es-CL')}</span>
                    </div>
                  )}
                  
                  {orderData.calculated_discount && parseFloat(orderData.calculated_discount.toString()) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Descuento Manual:</span>
                      <span className="font-medium text-red-600">-${parseFloat(orderData.calculated_discount.toString()).toLocaleString('es-CL')}</span>
                    </div>
                  )}
                </>
              )}
              
              
              {/* Editable Coupon Section */}
              {isEditingFinancials ? (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-green-600" />
                    <Label className="text-green-700 font-medium">Cupón de Descuento</Label>
                  </div>
                  <CouponSelector
                    subtotal={parseFloat(orderData.calculated_subtotal?.toString() || '0') - parseFloat(orderData.calculated_discount?.toString() || '0')}
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
              
              {/* Editable Shipping Section */}
              {isEditingFinancials ? (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <Label htmlFor="shipping-cost" className="text-blue-700 font-medium">Costo de Envío</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-blue-600">$</span>
                    <Input
                      id="shipping-cost"
                      type="number"
                      value={editedShipping}
                      onChange={(e) => setEditedShipping(e.target.value)}
                      disabled={savingFinancials}
                      className="flex-1"
                      min="0"
                      step="1000"
                      placeholder="0"
                    />
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    Ingresa el costo de envío para este pedido
                  </p>
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
              
              {/* IVA */}
              {(isEditingFinancials ? (calculateEditedSubtotal() * 0.19) : (orderData.calculated_iva && parseFloat(orderData.calculated_iva.toString()))) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">IVA (19%):</span>
                  <span className="font-medium">
                    ${isEditingFinancials 
                      ? (calculateEditedSubtotal() * 0.19).toLocaleString('es-CL')
                      : parseFloat(orderData.calculated_iva?.toString() || '0').toLocaleString('es-CL')
                    }
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
              
              {/* Payment Status Integration */}
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-muted-foreground">Estado de Pago:</span>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    isPaymentComplete ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                  <span className={`font-medium ${
                    isPaymentComplete ? 'text-green-700' : 'text-yellow-700'
                  }`}>
                    {isPaymentComplete ? '✅ Pagado Completo' : '⏳ Pago Pendiente'}
                  </span>
                </div>
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Fotos de Garantía
              {orderData.fotos_garantia && (Array.isArray(orderData.fotos_garantia) ? orderData.fotos_garantia.length > 0 : Object.keys(orderData.fotos_garantia).length > 0) && (
                <Badge variant="secondary" className="ml-2">
                  {Array.isArray(orderData.fotos_garantia) ? orderData.fotos_garantia.length : Object.keys(orderData.fotos_garantia).length} fotos
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhotos}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Subir Fotos
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orderData.fotos_garantia && (Array.isArray(orderData.fotos_garantia) ? orderData.fotos_garantia.length > 0 : Object.keys(orderData.fotos_garantia).length > 0) ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {(Array.isArray(orderData.fotos_garantia) ? orderData.fotos_garantia : Object.values(orderData.fotos_garantia)).map((foto: string, index: number) => (
                <div key={index} className="relative aspect-square group">
                  <img
                    src={foto}
                    alt={`Foto de garantía ${index + 1}`}
                    className="object-cover w-full h-full rounded-lg border transition-transform group-hover:scale-105 cursor-pointer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    onClick={() => window.open(foto, '_blank')}
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {index + 1}
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-8 h-8 p-0 /90 hover:"
                      onClick={() => window.open(foto, '_blank')}
                    >
                      <ImageIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ImageIcon className="w-6 h-6 text-gray-400" />
              </div>
              <p className="font-medium">No hay fotos de garantía disponibles</p>
              <p className="text-sm mt-1">Las fotos se mostrarán aquí una vez que sean subidas</p>
              <Button
                variant="outline"
                className="mt-4 flex items-center gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhotos}
              >
                <Upload className="w-4 h-4" />
                Subir Primera Foto
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className=" rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Subir Fotos de Garantía</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelUpload}
                disabled={uploadingPhotos}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>Se subirán {selectedFiles.length} fotos para la orden #{orderData.id}</p>
                <p>Formatos permitidos: JPEG, PNG, WebP • Tamaño máximo: 5MB por foto</p>
              </div>
              
              {/* Preview selected files */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-60 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {index + 1}
                    </div>
                    <div className="absolute top-2 right-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-6 h-6 p-0"
                        onClick={() => removeSelectedFile(index)}
                        disabled={uploadingPhotos}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {warrantyPhotosService.formatFileSize(file.size)}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleCancelUpload}
                  disabled={uploadingPhotos}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleUploadPhotos}
                  disabled={uploadingPhotos || selectedFiles.length === 0}
                  className="flex items-center gap-2"
                >
                  {uploadingPhotos ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Subir {selectedFiles.length} Fotos
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

export default ProcessOrder
