import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '../ui/sheet';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, FileText, Mail, Truck, CheckCircle, MapPin } from 'lucide-react';
// Removed direct import - now using dedicated endpoint
// import { generateBudgetPdfFromId } from '../../lib/orderPdfGenerationService';
import type { Database } from '../../types/database';
import type { Product } from '../../types/product';
import { ShippingService, type ShippingMethod, formatShippingCost, formatDeliveryTime } from '../../services/shippingService';

type Coupon = Database['public']['Tables']['coupons']['Row'];

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { ProductSelector } from './ProductSelector';
import { OrderCostSummary } from './OrderCostSummary';
import { DialogTitle } from '../ui/dialog';


interface SessionData {
  access_token: string;
  user: any; // Usar any para compatibilidad con el tipo User de Supabase
}

interface CreateOrderFormProps {
  onOrderCreated: (order: any) => void;
  sessionData?: SessionData;
  initialUsers?: UserProfile[]; // Users loaded from Astro
}

interface NewOrderForm {
  customer_id: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    email: string;
    phone: string;
    address_1: string;
    city: string;
  };
  metadata: {
    order_proyecto: string;
    order_fecha_inicio: string;
    order_fecha_termino: string;
    num_jornadas: string;
    company_rut: string;
    calculated_subtotal: string;
    calculated_iva: string;
    calculated_total: string;
    shipping_total: string;
    apply_iva: boolean;
    applied_coupon?: Coupon | null;
    coupon_discount_amount?: number;
  };
  line_items: Array<{
    product_id: number;
    quantity: number;
    sku: string;
    price: number;
    name: string;
    image: string;
  }>;
}

const initialFormState: NewOrderForm = {
  customer_id: '',
  billing: {
    first_name: '',
    last_name: '',
    company: '',
    email: '',
    phone: '',
    address_1: '',
    city: ''
  },
  metadata: {
    order_proyecto: '',
    order_fecha_inicio: '',
    order_fecha_termino: '',
    num_jornadas: '',
    company_rut: '',
    calculated_subtotal: '0',
    calculated_iva: '0',
    calculated_total: '0',
    shipping_total: '0',
    apply_iva: true,
    applied_coupon: null,
    coupon_discount_amount: 0
  },
  line_items: [] as Array<{
    product_id: number;
    quantity: number;
    sku: string;
    price: number;
    name: string;
    image: string;
  }>
};

const CreateOrderForm = ({ onOrderCreated, sessionData, initialUsers }: CreateOrderFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<NewOrderForm>(initialFormState);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponDiscountAmount, setCouponDiscountAmount] = useState(0);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [budgetSuccess, setBudgetSuccess] = useState<string | null>(null);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<ShippingMethod | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'shipping'>('pickup');


  // Función para obtener headers de autenticación
  const getAuthHeaders = async () => {
    // Si tenemos sessionData del servidor, usarla directamente
    if (sessionData?.access_token) {
      console.log('Using session data from server');
      return {
        'Authorization': `Bearer ${sessionData.access_token}`,
        'Content-Type': 'application/json'
      };
    }

    // Fallback al cliente de Supabase
    if (!supabase) {
      throw new Error('Error de configuración de Supabase');
    }
    
    // Intentar obtener la sesión actual
    let { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    console.log('Session check:', { session: !!session, error: sessionError });
    
    // Si no hay sesión, intentar refrescar
    if (!session) {
      console.log('No session found, attempting to refresh...');
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      session = refreshedSession;
      console.log('Refresh result:', { session: !!session, error: refreshError });
    }
    
    // Si aún no hay sesión, intentar obtener el usuario actual
    if (!session) {
      console.log('Still no session, checking user...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('User check:', { user: !!user, error: userError });
      
      if (user) {
        // Si hay usuario pero no sesión, intentar obtener la sesión nuevamente
        const { data: { session: newSession } } = await supabase.auth.getSession();
        session = newSession;
        console.log('New session after user check:', { session: !!session });
      }
    }
    
    if (!session) {
      throw new Error('No hay sesión activa. Por favor, recarga la página.');
    }

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    };
  };

  // Cargar usuarios, productos y métodos de envío cuando se abre el formulario
  useEffect(() => {
    const loadData = async () => {
      try {
        // Si tenemos usuarios iniciales, usarlos en lugar de hacer llamada API
        if (initialUsers && initialUsers.length > 0) {
          console.log(`Using ${initialUsers.length} initial users from Astro`);
          setUsers(initialUsers);
        } else {
          // Fallback: cargar usuarios desde API si no se pasaron inicialmente
          console.log('No initial users provided, loading from API...');
          
          // Intentar primero con headers de autenticación
          let headers: HeadersInit = { 'Content-Type': 'application/json' };
          
          try {
            const authHeaders = await getAuthHeaders();
            headers = authHeaders;
            console.log('Using auth headers for requests');
          } catch (authError) {
            console.warn('Could not get auth headers, trying with credentials:', authError);
            // Si no podemos obtener headers de auth, usar credentials para cookies
          }

          // Cargar usuarios desde Supabase
          const usersResponse = await fetch('/api/users?limit=1000', { 
            headers,
            credentials: 'include' // Incluir cookies para autenticación
          });
          
          if (!usersResponse.ok) {
            throw new Error(`Error loading users: ${usersResponse.status} ${usersResponse.statusText}`);
          }
          
          const usersData = await usersResponse.json();
          if (usersData.success && usersData.data) {
            setUsers(usersData.data.users || []);
          } else {
            console.error('Error loading users:', usersData.error);
            setError('Error al cargar usuarios: ' + (usersData.error || 'Error desconocido'));
            return;
          }
        }

        // Cargar productos desde Supabase - solicitar todos los productos
        // Intentar primero con headers de autenticación
        let headers: HeadersInit = { 'Content-Type': 'application/json' };
        
        try {
          const authHeaders = await getAuthHeaders();
          headers = authHeaders;
        } catch (authError) {
          console.warn('Could not get auth headers for products, trying with credentials:', authError);
        }

        const productsResponse = await fetch('/api/products?limit=1000', { 
          headers,
          credentials: 'include' // Incluir cookies para autenticación
        });
        
        if (!productsResponse.ok) {
          throw new Error(`Error loading products: ${productsResponse.status} ${productsResponse.statusText}`);
        }
        
        const productsData = await productsResponse.json();
        if (productsData.success && productsData.data) {
          setProducts(productsData.data.products || []);
        } else {
          console.error('Error loading products:', productsData.error);
          setError('Error al cargar productos: ' + (productsData.error || 'Error desconocido'));
        }

        // Cargar métodos de envío disponibles
        setShippingLoading(true);
        try {
          const shippingResult = await ShippingService.getAllShippingMethods(1, 100, true); // Solo métodos habilitados
          if (shippingResult.shippingMethods && shippingResult.shippingMethods.length > 0) {
            setShippingMethods(shippingResult.shippingMethods);
            // Seleccionar automáticamente el primer método disponible
            const defaultMethod = shippingResult.shippingMethods[0];
            if (defaultMethod) {
              setSelectedShippingMethod(defaultMethod);
              // Actualizar el shipping_total en el formulario
              handleShippingChange(defaultMethod.cost.toString());
            }
          }
        } catch (shippingError) {
          console.error('Error loading shipping methods:', shippingError);
          // No mostrar error crítico, usar métodos por defecto
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
          const firstMethod = defaultMethods[0];
          if (firstMethod) {
            setSelectedShippingMethod(firstMethod);
            handleShippingChange(firstMethod.cost.toString());
          }
        } finally {
          setShippingLoading(false);
        }
      } catch (err) {
        console.error('Error al cargar datos:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar datos');
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen, initialUsers]);

  // Función para autocompletar el formulario con datos del usuario
  const handleUserSelect = (userId: string) => {
    const selectedUser = users.find(user => user.user_id.toString() === userId);
    if (selectedUser) {
      setSelectedUserId(userId);
      setFormData(prev => ({
        ...prev,
        customer_id: userId,
        billing: {
          first_name: selectedUser.nombre || '',
          last_name: selectedUser.apellido || '',
          company: selectedUser.empresa_nombre || '',
          email: selectedUser.email || '',
          phone: selectedUser.telefono || '',
          address_1: selectedUser.direccion || '',
          city: selectedUser.ciudad || ''
        },
        metadata: {
          ...prev.metadata,
          company_rut: selectedUser.rut || ''
        }
      }));
    }
  };

  // Funciones de cálculo siguiendo la fórmula estricta requerida
  const calculateBaseSubtotal = (lineItems: NewOrderForm['line_items']) => {
    // Subtotal base diario (precio × cantidad) - sin multiplicar por días
    return lineItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateProductsSubtotal = (lineItems: NewOrderForm['line_items'], numDays: number) => {
    // 1. Subtotal de productos (precio × cantidad × días)
    const dailySubtotal = calculateBaseSubtotal(lineItems);
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

  const calculateCalculatedIVA = (calculatedSubtotal: number, applyIva: boolean) => {
    // 3. CALCULATED_IVA = calculated_subtotal × 0.19 (solo si apply_iva es true)
    return applyIva ? calculatedSubtotal * 0.19 : 0;
  };

  const calculateCalculatedTotal = (calculatedSubtotal: number, calculatedIva: number) => {
    // 4. CALCULATED_TOTAL = calculated_subtotal + calculated_iva
    return calculatedSubtotal + calculatedIva;
  };

  // Función para actualizar todos los cálculos siguiendo la fórmula correcta
  const updateAllCalculations = (
    lineItems: NewOrderForm['line_items'], 
    numDays: number,
    shipping: string = '0',
    couponDiscount: number = 0
  ) => {
    // 1. Subtotal de productos
    const productsSubtotal = calculateProductsSubtotal(lineItems, numDays);
    
    // 2. Parsear valores
    const shippingAmount = parseFloat(shipping) || 0;
    
    // 3. CALCULATED_SUBTOTAL = productos + envío - descuento cupón
    const calculatedSubtotal = calculateCalculatedSubtotal(productsSubtotal, shippingAmount, couponDiscount);
    
    // 4. CALCULATED_IVA = calculated_subtotal × 0.19
    const calculatedIva = calculateCalculatedIVA(calculatedSubtotal, formData.metadata.apply_iva);
    
    // 5. CALCULATED_TOTAL = calculated_subtotal + calculated_iva
    const calculatedTotal = calculateCalculatedTotal(calculatedSubtotal, calculatedIva);

    return {
      calculated_subtotal: calculatedSubtotal.toString(),
      calculated_iva: calculatedIva.toString(),
      calculated_total: calculatedTotal.toString(),
      shipping_total: shipping
    };
  };

  // Función para calcular días entre fechas
  const calculateDays = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays + 1;
  };

  // Función para actualizar fechas y calcular jornadas
  const handleDateChange = (field: 'order_fecha_inicio' | 'order_fecha_termino', value: string) => {
    setFormData(prev => {
      const newMetadata = {
        ...prev.metadata,
        [field]: value
      };
      
      // Calculamos días y actualizamos todos los totales
      if (newMetadata.order_fecha_inicio && newMetadata.order_fecha_termino) {
        const days = calculateDays(
          newMetadata.order_fecha_inicio,
          newMetadata.order_fecha_termino
        );
        
        const calculations = updateAllCalculations(
          prev.line_items,
          days,
          newMetadata.shipping_total,
          couponDiscountAmount
        );

        return {
          ...prev,
          metadata: {
            ...newMetadata,
            num_jornadas: days.toString(),
            ...calculations
          }
        };
      }

      return {
        ...prev,
        metadata: newMetadata
      };
    });
  };



  // Manejar selección de método de envío
  const handleShippingMethodSelect = (method: ShippingMethod) => {
    setSelectedShippingMethod(method);
    handleShippingChange(method.cost.toString());
  };

  // Manejar cambio de método de entrega
  const handleDeliveryMethodChange = (method: 'pickup' | 'shipping') => {
    setDeliveryMethod(method);
    if (method === 'pickup') {
      setSelectedShippingMethod(null);
      handleShippingChange('0');
    } else if (method === 'shipping' && shippingMethods.length > 0) {
      // Auto-seleccionar el primer método disponible cuando se cambia a shipping
      const firstMethod = shippingMethods[0];
      if (firstMethod) {
        setSelectedShippingMethod(firstMethod);
        handleShippingChange(firstMethod.cost.toString());
      }
    }
  };

  // Actualizar totales cuando cambia el shipping
  const handleShippingChange = (value: string) => {
    setFormData(prev => {
      const numDays = parseInt(prev.metadata.num_jornadas) || 1;
      const calculations = updateAllCalculations(
        prev.line_items,
        numDays,
        value,
        couponDiscountAmount
      );

      return {
        ...prev,
        metadata: {
          ...prev.metadata,
          shipping_total: value,
          calculated_subtotal: calculations.calculated_subtotal,
          calculated_iva: calculations.calculated_iva,
          calculated_total: calculations.calculated_total
        }
      };
    });
  };

  // Manejar aplicación de cupón
  const handleCouponApplied = (coupon: Coupon, discountAmount: number) => {
    setAppliedCoupon(coupon);
    setCouponDiscountAmount(discountAmount);
    
    setFormData(prev => {
      const numDays = parseInt(prev.metadata.num_jornadas) || 1;
      const calculations = updateAllCalculations(
        prev.line_items,
        numDays,
        prev.metadata.shipping_total,
        discountAmount
      );

      return {
        ...prev,
        metadata: {
          ...prev.metadata,
          applied_coupon: coupon,
          coupon_discount_amount: discountAmount,
          ...calculations
        }
      };
    });
  };

  // Manejar remoción de cupón
  const handleCouponRemoved = () => {
    setAppliedCoupon(null);
    setCouponDiscountAmount(0);
    
    setFormData(prev => {
      const numDays = parseInt(prev.metadata.num_jornadas) || 1;
      const calculations = updateAllCalculations(
        prev.line_items,
        numDays,
        prev.metadata.shipping_total,
        0
      );

      return {
        ...prev,
        metadata: {
          ...prev.metadata,
          applied_coupon: null,
          coupon_discount_amount: 0,
          ...calculations
        }
      };
    });
  };

  // Función para generar presupuesto automáticamente después de crear la orden
  // Usa el mismo endpoint dedicado que el frontend para evitar timeouts en Vercel
  const generateBudgetForCreatedOrder = async (createdOrder: any) => {
    try {
      console.log('📄 Generating budget for created order:', createdOrder.id);
      
      // Usar el endpoint dedicado /api/orders/:id/generate-budget
      // Nota: No se especifica sendEmail, usa el default (true) para enviar email automáticamente
      const response = await fetch(`/api/orders/${createdOrder.id}/generate-budget`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log('✅ Budget generated and email sent successfully for order:', createdOrder.id);
        console.log('📎 Budget URL:', result.pdfUrl);
        setBudgetSuccess(`Presupuesto generado y enviado por correo para la orden #${createdOrder.id}`);
        
        // Limpiar mensaje después de unos segundos
        setTimeout(() => {
          setBudgetSuccess(null);
        }, 5000);
      } else {
        console.error('❌ Budget generation failed for order:', createdOrder.id, result.error);
        // No mostrar error al usuario para no interrumpir el flujo de creación de orden
        console.warn('⚠️ Budget generation failed but order was created successfully');
      }

    } catch (err) {
      console.error('💥 Error in auto budget generation:', err);
      // No mostrar error al usuario para no interrumpir el flujo de creación de orden
      console.warn('⚠️ Budget generation failed but order was created successfully');
    }
  };

  const handleGenerateBudget = async () => {
    try {
      setBudgetLoading(true);
      setBudgetError(null);
      setBudgetSuccess(null);

      // Validate form data first
      if (!formData.customer_id || formData.line_items.length === 0) {
        setBudgetError('Por favor seleccione un cliente y agregue productos antes de generar el presupuesto');
        return;
      }

      // Prepare budget data in the same format as order creation
      const budgetData = {
        order_id: Math.floor(Math.random() * 1000000), // Temporary ID for budget (smaller range)
        customer_id: formData.customer_id,
        status: 'on-hold',
        billing: {
          first_name: formData.billing.first_name,
          last_name: formData.billing.last_name,
          company: formData.billing.company,
          email: formData.billing.email,
          phone: formData.billing.phone,
          address_1: formData.billing.address_1,
          city: formData.billing.city
        },
        metadata: {
          order_proyecto: formData.metadata.order_proyecto,
          order_fecha_inicio: formData.metadata.order_fecha_inicio,
          order_fecha_termino: formData.metadata.order_fecha_termino,
          num_jornadas: formData.metadata.num_jornadas,
          company_rut: formData.metadata.company_rut,
          calculated_subtotal: formData.metadata.calculated_subtotal,
          calculated_discount: '0',
          calculated_iva: formData.metadata.calculated_iva,
          calculated_total: formData.metadata.calculated_total
        },
        line_items: formData.line_items.map((item: any) => ({
          ...item,
          product_id: item.product_id.toString(),
          price: item.price.toString()
        })),
        coupon_lines: formData.metadata.applied_coupon ? [{
          code: formData.metadata.applied_coupon.code,
          discount: formData.metadata.coupon_discount_amount?.toString() || '0',
          discount_type: formData.metadata.applied_coupon.discount_type,
          metadata: {
            coupon_amount: formData.metadata.applied_coupon.amount?.toString() || '0',
            coupon_id: formData.metadata.applied_coupon.id?.toString() || '0'
          }
        }] : []
      };

      console.log('🚀 Generating budget with data:', budgetData);

      // Crear orden temporal para generar presupuesto
      // Nota: Este presupuesto es solo una vista previa, no se guarda en la base de datos
      console.warn('⚠️ Generating preview budget with temporary order ID');
      console.warn('⚠️ For production budgets, create the order first');
      
      // Usar el endpoint dedicado /api/orders/:id/generate-budget
      // Nota: Como es un ID temporal, puede fallar si el ID no existe en DB
      const response = await fetch(`/api/orders/${budgetData.order_id}/generate-budget`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al generar presupuesto');
      }

      const result = await response.json();

      if (result.success) {
        console.log('✅ Budget generated and email sent successfully:', result.pdfUrl);
        setBudgetSuccess(`Presupuesto generado exitosamente y enviado por correo.`);
      } else {
        setBudgetError(result.message || 'Error al generar el presupuesto');
        console.error('❌ Budget generation failed:', result.error);
      }

    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : 'Error al generar el presupuesto');
      console.error('💥 Budget generation error:', err);
    } finally {
      setBudgetLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    try {
      setLoading(true);
      setError(null);

      // Intentar obtener headers de autenticación
      let headers: HeadersInit = { 'Content-Type': 'application/json' };
      
      try {
        const authHeaders = await getAuthHeaders();
        headers = authHeaders;
        console.log('Using auth headers for order creation');
      } catch (authError) {
        console.warn('Could not get auth headers for order creation, trying with credentials:', authError);
        // Si no podemos obtener headers de auth, usar credentials para cookies
      }

      // Preparar datos para Supabase
      const orderData = {
        customer_id: parseInt(formData.customer_id),
        billing_first_name: formData.billing.first_name,
        billing_last_name: formData.billing.last_name,
        billing_company: formData.billing.company,
        billing_email: formData.billing.email,
        billing_phone: formData.billing.phone,
        billing_address_1: formData.billing.address_1,
        billing_city: formData.billing.city,
        order_proyecto: formData.metadata.order_proyecto,
        order_fecha_inicio: formData.metadata.order_fecha_inicio,
        order_fecha_termino: formData.metadata.order_fecha_termino,
        num_jornadas: parseInt(formData.metadata.num_jornadas) || 1,
        company_rut: formData.metadata.company_rut,
        calculated_subtotal: parseFloat(formData.metadata.calculated_subtotal) || 0,
        calculated_discount: 0,
        calculated_iva: parseFloat(formData.metadata.calculated_iva) || 0,
        calculated_total: parseFloat(formData.metadata.calculated_total) || 0,
        shipping_total: parseFloat(formData.metadata.shipping_total) || 0,
        // Shipping lines profesional usando el método seleccionado
        shipping_lines: deliveryMethod === 'shipping' && selectedShippingMethod ? [{
          ...ShippingService.createShippingLine(
            selectedShippingMethod,
            {
              first_name: formData.billing.first_name,
              last_name: formData.billing.last_name,
              address_1: formData.billing.address_1,
              city: formData.billing.city,
              phone: formData.billing.phone
            }
          ),
          meta_data: {
            ...ShippingService.createShippingLine(selectedShippingMethod).meta_data,
            delivery_method: deliveryMethod
          }
        }] : [],
        // Coupon lines profesional
        coupon_lines: formData.metadata.applied_coupon ? [{
          id: formData.metadata.applied_coupon.id,
          code: formData.metadata.applied_coupon.code,
          discount: formData.metadata.coupon_discount_amount || 0,
          discount_type: formData.metadata.applied_coupon.discount_type,
          meta_data: {
            coupon_id: formData.metadata.applied_coupon.id.toString(),
            coupon_amount: formData.metadata.applied_coupon.amount.toString(),
            original_amount: calculateProductsSubtotal(formData.line_items, parseInt(formData.metadata.num_jornadas) || 1).toString(),
            applied_to: "cart_total",
            usage_count: 1
          }
        }] : [],
        line_items: formData.line_items,
        status: 'on-hold' // Cambiar a on-hold para generar presupuesto automáticamente
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers,
        credentials: 'include', // Incluir cookies para autenticación
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        throw new Error(`Error creating order: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log('✅ Order created successfully:', data.data);
        
        // Generar presupuesto automáticamente para órdenes 'on-hold'
        if (data.data.status === 'on-hold') {
          console.log('🚀 Triggering budget generation for on-hold order...');
          // No esperar la generación del presupuesto para no bloquear el cierre del formulario
          generateBudgetForCreatedOrder(data.data).catch(err => {
            console.error('Budget generation failed (non-blocking):', err);
          });
        }
        
        onOrderCreated(data.data);
        setIsOpen(false);
        setFormData(initialFormState);
        setSelectedShippingMethod(null);
        setShippingMethods([]);
        setSelectedUserId('');
        setDeliveryMethod('pickup');
      } else {
        setError(data.error || 'Error al crear el pedido');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el pedido');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateBillingField = (field: keyof NewOrderForm['billing'], value: string) => {
    setFormData(prev => ({
      ...prev,
      billing: { ...prev.billing, [field]: value }
    }));
  };

  const updateMetadataField = (field: keyof NewOrderForm['metadata'], value: string) => {
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, [field]: value }
    }));
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button className="ml-3">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Pedido
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[95vw] sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Crear Nuevo Pedido</SheetTitle>
          <SheetDescription>
            Complete los datos del nuevo pedido. Al crear el pedido se enviará una notificación por correo al cliente y se generará automáticamente el presupuesto PDF.
          </SheetDescription>
        </SheetHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md mt-4">
            {error}
          </div>
        )}

        {budgetError && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md mt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {budgetError}
            </div>
          </div>
        )}

        {budgetSuccess && (
          <div className="bg-green-50 text-green-700 px-4 py-2 rounded-md mt-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {budgetSuccess}
            </div>
          </div>
        )}

        <div className="grid gap-4 py-4">
          {/* Selector de Usuario */}
          <div className="space-y-2">
            <Label htmlFor="userSelect">Seleccionar Cliente</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar cliente..."
                value={selectedUserId ? 
                  (() => {
                    const user = users.find(u => u.user_id.toString() === selectedUserId);
                    if (!user) return '';
                    const name = `${user.nombre} ${user.apellido}`;
                    return user.empresa_nombre ? `${name} (${user.empresa_nombre})` : name;
                  })() 
                  : ''}
                onClick={() => setIsCommandOpen(true)}
                readOnly
              />
              <Button variant="outline" size="icon" onClick={() => setIsCommandOpen(true)}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <CommandDialog open={isCommandOpen} onOpenChange={setIsCommandOpen}>
              <DialogTitle className="px-4 pt-4">Buscar Cliente</DialogTitle>
              <Command className="rounded-lg border shadow-md">
                <CommandInput placeholder="Buscar cliente por nombre o email..." />
                <CommandList>
                  <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                  <CommandGroup heading="Clientes">
                    {users.map(user => {
                      const displayName = `${user.nombre} ${user.apellido}`;
                      return (
                        <CommandItem
                          key={user.user_id}
                          value={`${displayName} ${user.email} ${user.empresa_nombre || ''}`}
                          onSelect={() => {
                            handleUserSelect(user.user_id.toString());
                            setIsCommandOpen(false);
                          }}
                          className="flex flex-col items-start gap-1"
                        >
                          <div className="flex items-center w-full">
                            <Search className="mr-2 h-4 w-4 shrink-0" />
                            <span className="font-medium">{displayName}</span>
                            {user.empresa_nombre && (
                              <span className="ml-2 text-muted-foreground">({user.empresa_nombre})</span>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground ml-6">{user.email}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </CommandDialog>
          </div>

          {/* Información del Cliente */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Información del Cliente</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  value={formData.billing.first_name}
                  onChange={(e) => updateBillingField('first_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  value={formData.billing.last_name}
                  onChange={(e) => updateBillingField('last_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.billing.email}
                  onChange={(e) => updateBillingField('email', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={formData.billing.phone}
                  onChange={(e) => updateBillingField('phone', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Selector de Productos */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Productos ({products?.length || 0})</h4>
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
              lineItems={formData.line_items.map(item => ({
                id: Math.random(), // Temporary ID for editing
                product_id: typeof item.product_id === 'string' ? parseInt(item.product_id) : item.product_id,
                product_name: item.name,
                product_price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
                quantity: item.quantity,
                total: (typeof item.price === 'string' ? parseFloat(item.price) : item.price) * item.quantity,
                sku: item.sku,
                image: item.image
              }))}
              numDays={parseInt(formData.metadata.num_jornadas) || 0}
              mode="create"
              onAddProduct={(product, quantity) => {
                // Get the first available image with proper fallback
                let productImage = '';
                if (product.images && product.images.length > 0 && product.images[0]) {
                  productImage = product.images[0].src || '';
                }
                
                const newLineItem = {
                  product_id: product.id,
                  quantity: quantity,
                  sku: product.sku || '',
                  price: product.price || 0,
                  name: product.name || '',
                  image: productImage
                };

                setFormData(prev => {
                  const updatedLineItems = [...prev.line_items, newLineItem];
                  const numDays = parseInt(prev.metadata.num_jornadas) || 1;
                  const calculations = updateAllCalculations(
                    updatedLineItems,
                    numDays,
                    prev.metadata.shipping_total,
                    couponDiscountAmount
                  );

                  return {
                    ...prev,
                    line_items: updatedLineItems,
                    metadata: {
                      ...prev.metadata,
                      ...calculations
                    }
                  };
                });
              }}
              onRemoveProduct={(index) => {
                setFormData(prev => {
                  const updatedLineItems = prev.line_items.filter((_, i) => i !== index);
                  const numDays = parseInt(prev.metadata.num_jornadas) || 1;
                  const calculations = updateAllCalculations(
                    updatedLineItems,
                    numDays,
                    prev.metadata.shipping_total,
                    couponDiscountAmount
                  );

                  return {
                    ...prev,
                    line_items: updatedLineItems,
                    metadata: {
                      ...prev.metadata,
                      ...calculations
                    }
                  };
                });
              }}
              loading={loading}
            />
          </div>

          {/* Información del Proyecto */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Información del Proyecto</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proyecto">Proyecto</Label>
                <Input
                  id="proyecto"
                  value={formData.metadata.order_proyecto}
                  onChange={(e) => updateMetadataField('order_proyecto', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rut">RUT Empresa</Label>
                <Input
                  id="rut"
                  value={formData.metadata.company_rut}
                  onChange={(e) => updateMetadataField('company_rut', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaInicio">Fecha Inicio</Label>
                <Input
                  id="fechaInicio"
                  type="date"
                  value={formData.metadata.order_fecha_inicio}
                  onChange={(e) => handleDateChange('order_fecha_inicio', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaTermino">Fecha Término</Label>
                <Input
                  id="fechaTermino"
                  type="date"
                  value={formData.metadata.order_fecha_termino}
                  onChange={(e) => handleDateChange('order_fecha_termino', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jornadas">Número de Jornadas</Label>
                <Input
                  id="jornadas"
                  type="number"
                  value={formData.metadata.num_jornadas}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Calculado automáticamente según las fechas seleccionadas
                </p>
              </div>
            </div>
          </div>

          {/* Método de Entrega */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">¿Cómo desea entregar el pedido?</h4>
            <RadioGroup
              value={deliveryMethod}
              onValueChange={handleDeliveryMethodChange}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                <RadioGroupItem value="pickup" id="pickup" />
                <div className="flex-1">
                  <Label htmlFor="pickup" className="flex items-center space-x-2 cursor-pointer">
                    <MapPin className="h-4 w-4" />
                    <span className="font-medium">Retiro en tienda</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    El cliente retira el pedido en tienda (Gratis)
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                <RadioGroupItem value="shipping" id="shipping" />
                <div className="flex-1">
                  <Label htmlFor="shipping" className="flex items-center space-x-2 cursor-pointer">
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
            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Truck className="h-4 w-4" />
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
                    const cartTotal = parseFloat(formData.metadata.calculated_subtotal) || 0;
                    const validation = ShippingService.validateShippingMethod(method, cartTotal);
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

          {/* Resumen de Costos */}
          <OrderCostSummary
            baseSubtotal={calculateBaseSubtotal(formData.line_items).toString()}
            subtotal={formData.metadata.calculated_subtotal}
            discount="0"
            iva={formData.metadata.calculated_iva}
            total={formData.metadata.calculated_total}
            shipping={formData.metadata.shipping_total}
            numDays={parseInt(formData.metadata.num_jornadas) || 1}
            onShippingChange={handleShippingChange}
            onCouponApplied={handleCouponApplied}
            onCouponRemoved={handleCouponRemoved}
            appliedCoupon={appliedCoupon}
            couponDiscountAmount={couponDiscountAmount}
            userId={selectedUserId ? parseInt(selectedUserId) : undefined}
            accessToken={sessionData?.access_token}
            onTotalChange={(newTotal, newIva) => {
              setFormData(prev => ({
                ...prev,
                metadata: {
                  ...prev.metadata,
                  calculated_total: newTotal,
                  calculated_iva: newIva
                }
              }));
            }}
            mode="create"
            loading={loading}
            showCoupons={true}
            showShipping={false}
            showManualDiscount={false}
          />

        </div>

        <SheetFooter className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerateBudget}
            disabled={budgetLoading || loading || formData.line_items.length === 0 || !formData.customer_id}
            className="flex items-center gap-2"
            title="Generar solo presupuesto sin crear orden"
          >
            {budgetLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                Generando...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Solo Presupuesto
              </>
            )}
          </Button>
          <Button
            type="submit"
            onClick={handleCreateOrder}
            disabled={loading || formData.line_items.length === 0}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                Creando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Crear Pedido
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default CreateOrderForm; 