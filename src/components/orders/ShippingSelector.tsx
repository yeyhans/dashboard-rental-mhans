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
import { Loader2, Truck, MapPin, Clock, Plus, AlertCircle } from 'lucide-react';
import { ShippingService, type ShippingMethod, formatShippingCost, formatDeliveryTime, getShippingTypeLabel } from '../../services/shippingService';

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

  // Cargar métodos de envío únicamente desde la base de datos
  useEffect(() => {
    const loadShippingMethods = async () => {
      try {
        setLoading(true);
        setError(null);

        // Cargar métodos desde la base de datos usando ShippingService
        const result = await ShippingService.getAllShippingMethods(1, 100, true); // Solo métodos habilitados
        
        if (result && result.shippingMethods && result.shippingMethods.length > 0) {
          console.log('✅ Loaded shipping methods from database:', result.shippingMethods.length);
          setShippingMethods(result.shippingMethods);
        } else {
          setError('No hay métodos de envío configurados en la base de datos');
          setShippingMethods([]);
        }
      } catch (err) {
        console.error('Error loading shipping methods from database:', err);
        setError('Error al cargar métodos de envío desde la base de datos. Verifique la configuración.');
        setShippingMethods([]);
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
        const cost = typeof method.cost === 'string' ? parseFloat(method.cost) : method.cost;
        onShippingSelect(cost, method.id);
        setCustomCost(cost.toString());
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

  // Función auxiliar para obtener el costo como número
  const getCostAsNumber = (cost: string | number): number => {
    return typeof cost === 'string' ? parseFloat(cost) : cost;
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
          {/* Métodos desde base de datos */}
          {shippingMethods.map((method) => {
            // Usar validación del ShippingService
            const validation = ShippingService.validateShippingMethod(method, cartTotal);
            const cost = getCostAsNumber(method.cost);

            return (
              <div key={method.id} className="space-y-2">
                <div className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                  selectedMethod === method.id.toString() 
                    ? 'border-blue-500 bg-blue-50' 
                    : validation.isValid 
                      ? 'border-gray-200 hover:border-gray-300'
                      : 'border-red-200 bg-red-50'
                } ${!validation.isValid ? 'opacity-75' : ''}`}>
                  <RadioGroupItem 
                    value={method.id.toString()} 
                    id={`shipping-${method.id}`}
                    disabled={disabled || !validation.isValid}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <Label 
                        htmlFor={`shipping-${method.id}`}
                        className="font-medium text-sm cursor-pointer flex items-center gap-2"
                      >
                        {method.name}
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {getShippingTypeLabel(method.shipping_type)}
                        </span>
                      </Label>
                      <span className={`text-sm font-semibold ${
                        cost === 0 ? 'text-green-600' : 'text-gray-900'
                      }`}>
                        {formatShippingCost(method.cost)}
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
                        <span>{getShippingTypeLabel(method.shipping_type)}</span>
                      </div>
                    </div>
                    
                    {!validation.isValid && validation.message && (
                      <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {validation.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Mensaje cuando no hay métodos */}
          {shippingMethods.length === 0 && !loading && (
            <div className="text-center py-6 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">No hay métodos de envío configurados</p>
              <p className="text-xs mt-1">Configure métodos de envío en la base de datos</p>
            </div>
          )}

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
            <span className="font-medium">{formatShippingCost(parseFloat(customCost) || 0)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ShippingSelector;
