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
import { Plus, Search } from 'lucide-react';
import type { Database } from '../../types/database';
import type { Product } from '../../types/product';

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
    calculated_discount: string;
    calculated_iva: string;
    calculated_total: string;
    shipping_total: string;
    apply_iva: boolean;
    applied_coupon?: Coupon | null;
    coupon_discount_amount?: number;
  };
  line_items: Array<{
    product_id: string;
    quantity: number;
    sku: string;
    price: string;
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
    calculated_discount: '0',
    calculated_iva: '0',
    calculated_total: '0',
    shipping_total: '0',
    apply_iva: true,
    applied_coupon: null,
    coupon_discount_amount: 0
  },
  line_items: [] as Array<{
    product_id: string;
    quantity: number;
    sku: string;
    price: string;
    name: string;
    image: string;
  }>
};

const CreateOrderForm = ({ onOrderCreated, sessionData }: CreateOrderFormProps) => {
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

  // Cargar usuarios y productos cuando se abre el formulario
  useEffect(() => {
    const loadData = async () => {
      try {
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
        const usersResponse = await fetch('/api/users', { 
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

        // Cargar productos desde Supabase - solicitar todos los productos
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
      } catch (err) {
        console.error('Error al cargar datos:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar datos');
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

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
          company: selectedUser.empresa || '',
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

  // Funciones de cálculo actualizadas
  const calculateBaseSubtotal = (lineItems: NewOrderForm['line_items']) => {
    return lineItems.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
  };

  const calculateSubtotal = (lineItems: NewOrderForm['line_items'], numDays: number) => {
    const subtotalBeforeDays = calculateBaseSubtotal(lineItems);
    return subtotalBeforeDays * numDays;
  };

  const calculateIVA = (subtotal: number, applyIva: boolean) => {
    return applyIva ? subtotal * 0.19 : 0; // 19% IVA solo si apply_iva es true
  };

  const calculateTotal = (subtotal: number, iva: number, discount: string, shipping: string, couponDiscount: number) => {
    const discountAmount = parseFloat(discount) || 0;
    const shippingAmount = parseFloat(shipping) || 0;
    return subtotal + iva + shippingAmount - discountAmount - couponDiscount;
  };

  // Función para actualizar todos los cálculos
  const updateAllCalculations = (
    lineItems: NewOrderForm['line_items'], 
    numDays: number,
    discount: string,
    shipping: string = '0',
    couponDiscount: number = 0
  ) => {
    const subtotal = calculateSubtotal(lineItems, numDays);
    const iva = calculateIVA(subtotal, formData.metadata.apply_iva);
    const total = calculateTotal(subtotal, iva, discount, shipping, couponDiscount);

    return {
      calculated_subtotal: subtotal.toString(),
      calculated_iva: iva.toString(),
      calculated_total: total.toString(),
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
          newMetadata.calculated_discount,
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


  // Actualizar totales cuando cambia el descuento
  const handleDiscountChange = (value: string) => {
    setFormData(prev => {
      const numDays = parseInt(prev.metadata.num_jornadas) || 1;
      const calculations = updateAllCalculations(
        prev.line_items,
        numDays,
        value,
        prev.metadata.shipping_total,
        couponDiscountAmount
      );

      return {
        ...prev,
        metadata: {
          ...prev.metadata,
          calculated_discount: value,
          ...calculations
        }
      };
    });
  };

  // Actualizar totales cuando cambia el shipping
  const handleShippingChange = (value: string) => {
    setFormData(prev => {
      const numDays = parseInt(prev.metadata.num_jornadas) || 1;
      const calculations = updateAllCalculations(
        prev.line_items,
        numDays,
        prev.metadata.calculated_discount,
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
        prev.metadata.calculated_discount,
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
        prev.metadata.calculated_discount,
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
        calculated_discount: parseFloat(formData.metadata.calculated_discount) || 0,
        calculated_iva: parseFloat(formData.metadata.calculated_iva) || 0,
        calculated_total: parseFloat(formData.metadata.calculated_total) || 0,
        shipping_total: parseFloat(formData.metadata.shipping_total) || 0,
        coupon_lines: formData.metadata.applied_coupon ? [{
          id: formData.metadata.applied_coupon.id,
          code: formData.metadata.applied_coupon.code,
          discount: formData.metadata.coupon_discount_amount || 0,
          discount_type: formData.metadata.applied_coupon.discount_type,
          amount: formData.metadata.applied_coupon.amount
        }] : [],
        line_items: formData.line_items,
        status: 'pending'
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
        onOrderCreated(data.data);
        setIsOpen(false);
        setFormData(initialFormState);
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
            Complete los datos del nuevo pedido
          </SheetDescription>
        </SheetHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-md mt-4">
            {error}
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
                    return user.empresa ? `${name} (${user.empresa})` : name;
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
                          value={`${displayName} ${user.email} ${user.empresa || ''}`}
                          onSelect={() => {
                            handleUserSelect(user.user_id.toString());
                            setIsCommandOpen(false);
                          }}
                          className="flex flex-col items-start gap-1"
                        >
                          <div className="flex items-center w-full">
                            <Search className="mr-2 h-4 w-4 shrink-0" />
                            <span className="font-medium">{displayName}</span>
                            {user.empresa && (
                              <span className="ml-2 text-muted-foreground">({user.empresa})</span>
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
            <h4 className="font-medium text-sm">Productos</h4>
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
                  product_id: product.id.toString(),
                  quantity: quantity,
                  sku: product.sku || '',
                  price: (product.price || 0).toString(),
                  name: product.name || '',
                  image: productImage
                };

                setFormData(prev => {
                  const updatedLineItems = [...prev.line_items, newLineItem];
                  const numDays = parseInt(prev.metadata.num_jornadas) || 1;
                  const calculations = updateAllCalculations(
                    updatedLineItems,
                    numDays,
                    prev.metadata.calculated_discount
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
                    prev.metadata.calculated_discount
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

          {/* Resumen de Costos */}
          <OrderCostSummary
            baseSubtotal={calculateBaseSubtotal(formData.line_items).toString()}
            subtotal={formData.metadata.calculated_subtotal}
            discount={formData.metadata.calculated_discount}
            iva={formData.metadata.calculated_iva}
            total={formData.metadata.calculated_total}
            shipping={formData.metadata.shipping_total}
            numDays={parseInt(formData.metadata.num_jornadas) || 1}
            onDiscountChange={handleDiscountChange}
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
            showShipping={true}
          />

        </div>

        <SheetFooter className="mt-4">
          <Button
            type="submit"
            onClick={handleCreateOrder}
            disabled={loading || formData.line_items.length === 0}
          >
            {loading ? 'Creando...' : 'Crear Pedido'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default CreateOrderForm; 