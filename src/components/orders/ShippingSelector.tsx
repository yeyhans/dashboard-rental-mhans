// =====================================================
// COMPONENTE SELECTOR DE ENVÍOS PARA BACKEND
// =====================================================
// Componente para seleccionar métodos de envío en CreateOrderForm

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Loader2, Truck, MapPin, Clock, Plus } from 'lucide-react';

// Tipos simplificados para el backend
interface ShippingMethod {
  id: number;
  name: string;
  description: string | null;
  cost: number;
  shipping_type: string;
  estimated_days_min: number;
  estimated_days_max: number;
  enabled: boolean;
}

interface ShippingSelectorProps {
  cartTotal: number;
  onShippingSelect: (cost: number, methodId?: number) => void;
  selectedCost: number;
  disabled?: boolean;
}

export function ShippingSelector({
  cartTotal,
  onShippingSelect,
  selectedCost,
  disabled = false
}: ShippingSelectorProps) {
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>('custom');
  const [customCost, setCustomCost] = useState<string>(selectedCost.toString());

  // Métodos de envío predeterminados (fallback si no hay base de datos)
  const defaultMethods: ShippingMethod[] = [
    {
      id: 1,
      name: 'Envío Gratis',
      description: 'Envío gratuito para compras sobre $100.000',
      cost: 0,
      shipping_type: 'free',
      estimated_days_min: 3,
      estimated_days_max: 7,
      enabled: true
    },
    {
      id: 2,
      name: 'Envío Estándar',
      description: 'Envío estándar a todo Chile',
      cost: 5000,
      shipping_type: 'flat_rate',
      estimated_days_min: 2,
      estimated_days_max: 5,
      enabled: true
    },
    {
      id: 3,
      name: 'Retiro en Tienda',
      description: 'Retira tu pedido en nuestra tienda',
      cost: 0,
      shipping_type: 'local_pickup',
      estimated_days_min: 1,
      estimated_days_max: 1,
      enabled: true
    },
    {
      id: 4,
      name: 'Envío Express',
      description: 'Entrega en 24-48 horas',
      cost: 12000,
      shipping_type: 'express',
      estimated_days_min: 1,
      estimated_days_max: 2,
      enabled: true
    }
  ];

  // Cargar métodos de envío
  useEffect(() => {
    const loadShippingMethods = async () => {
      try {
        setLoading(true);
        setError(null);

        // Intentar cargar desde la API
        try {
          const response = await fetch('/api/shipping-methods', {
            credentials: 'include'
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              setShippingMethods(result.data);
            } else {
              throw new Error('No se pudieron cargar los métodos de envío');
            }
          } else {
            throw new Error('API no disponible');
          }
        } catch (apiError) {
          console.warn('Using default shipping methods:', apiError);
          // Usar métodos predeterminados si la API no está disponible
          setShippingMethods(defaultMethods);
        }
      } catch (err) {
        console.error('Error loading shipping methods:', err);
        setError('Error al cargar métodos de envío');
        setShippingMethods(defaultMethods);
      } finally {
        setLoading(false);
      }
    };

    loadShippingMethods();
  }, []);

  // Manejar selección de método
  const handleMethodSelect = (value: string) => {
    setSelectedMethod(value);
    
    if (value === 'custom') {
      onShippingSelect(parseFloat(customCost) || 0);
    } else {
      const method = shippingMethods.find(m => m.id.toString() === value);
      if (method) {
        onShippingSelect(method.cost, method.id);
        setCustomCost(method.cost.toString());
      }
    }
  };

  // Manejar cambio de costo personalizado
  const handleCustomCostChange = (value: string) => {
    setCustomCost(value);
    if (selectedMethod === 'custom') {
      onShippingSelect(parseFloat(value) || 0);
    }
  };

  // Formatear costo
  const formatCost = (cost: number): string => {
    if (cost === 0) return 'Gratis';
    return `$${cost.toLocaleString('es-CL')}`;
  };

  // Formatear tiempo de entrega
  const formatDeliveryTime = (minDays: number, maxDays: number): string => {
    if (minDays === maxDays) {
      return `${minDays} ${minDays === 1 ? 'día' : 'días'}`;
    }
    return `${minDays}-${maxDays} días`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Cargando métodos de envío...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-base">
          <Truck className="h-4 w-4" />
          <span>Método de Envío</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}

        <RadioGroup
          value={selectedMethod}
          onValueChange={handleMethodSelect}
          disabled={disabled}
          className="space-y-3"
        >
          {/* Métodos predefinidos */}
          {shippingMethods.map((method) => {
            const isAvailable = method.enabled && (
              !method.cost || cartTotal >= 0 // Lógica simple para el backend
            );

            return (
              <div key={method.id} className="space-y-2">
                <div className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                  selectedMethod === method.id.toString() 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                } ${!isAvailable ? 'opacity-50' : ''}`}>
                  <RadioGroupItem 
                    value={method.id.toString()} 
                    id={`shipping-${method.id}`}
                    disabled={disabled || !isAvailable}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <Label 
                        htmlFor={`shipping-${method.id}`}
                        className="font-medium text-sm cursor-pointer"
                      >
                        {method.name}
                      </Label>
                      <span className={`text-sm font-semibold ${
                        method.cost === 0 ? 'text-green-600' : 'text-gray-900'
                      }`}>
                        {formatCost(method.cost)}
                      </span>
                    </div>
                    
                    {method.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {method.description}
                      </p>
                    )}
                    
                    <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDeliveryTime(method.estimated_days_min, method.estimated_days_max)}</span>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-3 w-3" />
                        <span className="capitalize">{method.shipping_type.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Opción personalizada */}
          <div className="space-y-2">
            <div className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
              selectedMethod === 'custom' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <RadioGroupItem 
                value="custom" 
                id="shipping-custom"
                disabled={disabled}
              />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <Label 
                    htmlFor="shipping-custom"
                    className="font-medium text-sm cursor-pointer flex items-center space-x-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Costo Personalizado</span>
                  </Label>
                </div>
                
                <p className="text-xs text-muted-foreground mt-1">
                  Ingresa un costo de envío personalizado
                </p>
              </div>
            </div>

            {selectedMethod === 'custom' && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="custom-cost" className="text-xs">
                  Costo de Envío (CLP)
                </Label>
                <Input
                  id="custom-cost"
                  type="number"
                  min="0"
                  step="100"
                  value={customCost}
                  onChange={(e) => handleCustomCostChange(e.target.value)}
                  placeholder="0"
                  disabled={disabled}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </RadioGroup>

        {/* Información del total */}
        <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
          <div className="flex items-center justify-between">
            <span>Costo de envío seleccionado:</span>
            <span className="font-medium">{formatCost(parseFloat(customCost) || 0)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ShippingSelector;
