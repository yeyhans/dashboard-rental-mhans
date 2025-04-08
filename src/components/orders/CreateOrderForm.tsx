import { useState, useEffect } from 'react';
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
import { Plus, Minus, Trash2, Search } from 'lucide-react';
import type { Order } from '../../types/order';
import type { User } from '../../types/user';
import type { Product } from '../../types/product';
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

// Helper function to format currency
const formatCurrency = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

interface CreateOrderFormProps {
  onOrderCreated: (order: Order) => void;
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
    apply_iva: boolean;
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
    apply_iva: true
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

const CreateOrderForm = ({ onOrderCreated }: CreateOrderFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<NewOrderForm>(initialFormState);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isCommandOpen, setIsCommandOpen] = useState(false);


  // Cargar usuarios y productos cuando se abre el formulario
  useEffect(() => {
    const loadData = async () => {
      try {
        // Cargar usuarios
        const usersResponse = await fetch('/api/wp/get-users');
        const usersData = await usersResponse.json();
        if (usersData.users) {
          setUsers(usersData.users);
        }

        // Cargar productos
        const productsResponse = await fetch('/api/woo/get-products');
        const productsData = await productsResponse.json();
        if (productsData.success) {
          setProducts(productsData.data.products);
        }
      } catch (err) {
        console.error('Error al cargar datos:', err);
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Función para autocompletar el formulario con datos del usuario
  const handleUserSelect = (userId: string) => {
    const selectedUser = users.find(user => user.id.toString() === userId);
    if (selectedUser) {
      setSelectedUserId(userId);
      setFormData(prev => ({
        ...prev,
        customer_id: userId,
        billing: {
          first_name: selectedUser.billing_first_name || '',
          last_name: selectedUser.billing_last_name || '',
          company: selectedUser.billing_company || '',
          email: selectedUser.email || '',
          phone: selectedUser.billing_phone || '',
          address_1: selectedUser.billing_address_1 || '',
          city: selectedUser.billing_city || ''
        },
        metadata: {
          ...prev.metadata,
          company_rut: selectedUser.company_rut || selectedUser.rut || ''
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

  const calculateTotal = (subtotal: number, iva: number, discount: string) => {
    const discountAmount = parseFloat(discount) || 0;
    return subtotal + iva - discountAmount;
  };

  // Función para actualizar todos los cálculos
  const updateAllCalculations = (
    lineItems: NewOrderForm['line_items'], 
    numDays: number,
    discount: string
  ) => {
    const subtotal = calculateSubtotal(lineItems, numDays);
    const iva = calculateIVA(subtotal, formData.metadata.apply_iva);
    const total = calculateTotal(subtotal, iva, discount);

    return {
      calculated_subtotal: subtotal.toString(),
      calculated_iva: iva.toString(),
      calculated_total: total.toString()
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
          newMetadata.calculated_discount
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
        value
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

  const handleCreateOrder = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/woo/put-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        onOrderCreated(data.data);
        setIsOpen(false);
        setFormData(initialFormState);
      } else {
        setError(data.message || 'Error al crear el pedido');
      }
    } catch (err) {
      setError('Error al crear el pedido');
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
                    const user = users.find(u => u.id.toString() === selectedUserId);
                    if (!user) return '';
                    const name = `${user.billing_first_name || user.first_name} ${user.billing_last_name || user.last_name}`;
                    return user.billing_company ? `${name} (${user.billing_company})` : name;
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
                      const displayName = `${user.billing_first_name || user.first_name} ${user.billing_last_name || user.last_name}`;
                      return (
                        <CommandItem
                          key={user.id}
                          value={`${displayName} ${user.email} ${user.billing_company || ''}`}
                          onSelect={(value) => {
                            handleUserSelect(user.id.toString());
                            setIsCommandOpen(false);
                          }}
                          className="flex flex-col items-start gap-1"
                        >
                          <div className="flex items-center w-full">
                            <Search className="mr-2 h-4 w-4 shrink-0" />
                            <span className="font-medium">{displayName}</span>
                            {user.billing_company && (
                              <span className="ml-2 text-muted-foreground">({user.billing_company})</span>
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
              products={products}
              lineItems={formData.line_items}
              numDays={parseInt(formData.metadata.num_jornadas) || 0}
              onAddProduct={(product, quantity) => {
                const newLineItem = {
                  product_id: product.id.toString(),
                  quantity: quantity,
                  sku: product.sku,
                  price: product.price,
                  name: product.name,
                  image: product.images?.[0]?.src || ''
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
              mode="create"
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
            onDiscountChange={handleDiscountChange}
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