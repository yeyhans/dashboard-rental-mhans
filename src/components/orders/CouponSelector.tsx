import { useState, useEffect } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { Loader2, Tag, Check, X, AlertCircle, List } from 'lucide-react';
import { toast } from 'sonner';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { DialogTitle } from '../ui/dialog';
import type { Database } from '../../types/database';

type Coupon = Database['public']['Tables']['coupons']['Row'];

interface CouponValidationResult {
  is_valid: boolean;
  coupon_data: Coupon | null;
  error_message: string | null;
  discount_amount?: number;
}

interface CouponSelectorProps {
  subtotal: number;
  onCouponApplied: (coupon: Coupon, discountAmount: number) => void;
  onCouponRemoved: () => void;
  appliedCoupon?: Coupon | null | undefined;
  appliedDiscountAmount?: number;
  userId?: number | undefined;
  disabled?: boolean;
  className?: string;
  accessToken?: string | undefined;
}

export const CouponSelector = ({
  subtotal,
  onCouponApplied,
  onCouponRemoved,
  appliedCoupon,
  appliedDiscountAmount = 0,
  userId,
  disabled = false,
  className = "",
  accessToken
}: CouponSelectorProps) => {
  const [couponCode, setCouponCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<CouponValidationResult | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [isLoadingCoupons, setIsLoadingCoupons] = useState(false);
  const [showCouponList, setShowCouponList] = useState(false);

  // Helper function to format currency
  const formatCurrency = (value: number) => {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Load available coupons
  const loadAvailableCoupons = async () => {
    setIsLoadingCoupons(true);
    
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // Add authorization header if accessToken is available
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      
      // Try different status values - first try 'publish' (as used in CouponService)
      let response = await fetch(`/api/coupons?limit=100&status=publish`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      let data = await response.json();
      
      // If no results with 'publish', try without status filter to get all coupons
      if (!data.success || !data.data || !data.data.coupons || data.data.coupons.length === 0) {
        console.log('No coupons found with status=publish, trying without status filter...');
        
        response = await fetch(`/api/coupons?limit=100`, {
          method: 'GET',
          headers,
          credentials: 'include'
        });
        
        data = await response.json();
      }

      console.log('Coupons API response:', data);

      if (data.success && data.data && data.data.coupons) {
        console.log(`Found ${data.data.coupons.length} coupons from API`);
        
        // Filter active coupons that haven't expired
        const activeCoupons = data.data.coupons.filter((coupon: Coupon) => {
          const now = new Date();
          const expiryDate = coupon.date_expires ? new Date(coupon.date_expires) : null;
          
          // Accept both 'publish' and 'active' status, or any status if we're not filtering
          const isActive = coupon.status === 'publish' || coupon.status === 'active' || !coupon.status;
          const isNotExpired = !expiryDate || expiryDate > now;
          const hasUsagesLeft = coupon.usage_limit === null || (coupon.usage_count || 0) < coupon.usage_limit;
          
          console.log(`Coupon ${coupon.code}: status=${coupon.status}, isActive=${isActive}, isNotExpired=${isNotExpired}, hasUsagesLeft=${hasUsagesLeft}`);
          
          return isActive && isNotExpired && hasUsagesLeft;
        });
        
        console.log(`Filtered to ${activeCoupons.length} active coupons`);
        setAvailableCoupons(activeCoupons);
      } else {
        console.error('Error loading coupons:', data.error || 'No data received');
        setAvailableCoupons([]);
      }
    } catch (error) {
      console.error('Error loading coupons:', error);
      setAvailableCoupons([]);
    } finally {
      setIsLoadingCoupons(false);
    }
  };

  // Calculate discount amount based on coupon type
  const calculateDiscountAmount = (coupon: Coupon, cartTotal: number): number => {
    let discount = 0;

    switch (coupon.discount_type) {
      case 'percent':
        discount = (cartTotal * coupon.amount) / 100;
        break;
      case 'fixed_cart':
        discount = coupon.amount;
        break;
      case 'fixed_product':
        discount = coupon.amount; // Se aplicaría por producto
        break;
      default:
        discount = 0;
    }

    // Aplicar límite máximo si existe
    if (coupon.maximum_amount && discount > coupon.maximum_amount) {
      discount = coupon.maximum_amount;
    }

    // No puede ser mayor al total del carrito
    return Math.min(discount, cartTotal);
  };

  // Validate coupon code
  const validateCoupon = async (code: string) => {
    if (!code.trim()) {
      setValidationResult(null);
      return;
    }

    setIsValidating(true);
    
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // Add authorization header if accessToken is available
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      
      const response = await fetch(`/api/coupons/validate/${encodeURIComponent(code)}?subtotal=${subtotal}&userId=${userId || 0}`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success && data.data) {
        const result = data.data;
        
        if (result.is_valid && result.coupon_data) {
          const discountAmount = calculateDiscountAmount(result.coupon_data, subtotal);
          
          setValidationResult({
            ...result,
            discount_amount: discountAmount
          });
        } else {
          setValidationResult(result);
        }
      } else {
        setValidationResult({
          is_valid: false,
          coupon_data: null,
          error_message: data.error || 'Error al validar el cupón'
        });
      }
    } catch (error) {
      console.error('Error validating coupon:', error);
      setValidationResult({
        is_valid: false,
        coupon_data: null,
        error_message: 'Error de conexión al validar el cupón'
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Handle coupon code input change
  const handleCouponCodeChange = (value: string) => {
    setCouponCode(value.toUpperCase());
    
    // Clear previous validation when code changes
    if (validationResult) {
      setValidationResult(null);
    }
  };

  // Apply coupon
  const handleApplyCoupon = () => {
    if (validationResult?.is_valid && validationResult.coupon_data && validationResult.discount_amount) {
      onCouponApplied(validationResult.coupon_data, validationResult.discount_amount);
      toast.success(`Cupón aplicado: ${validationResult.coupon_data.code}`, {
        description: `Descuento de $${formatCurrency(validationResult.discount_amount)}`
      });
    }
  };

  // Remove applied coupon
  const handleRemoveCoupon = () => {
    onCouponRemoved();
    setCouponCode('');
    setValidationResult(null);
    toast.info('Cupón removido');
  };

  // Handle coupon selection from list
  const handleCouponSelect = async (coupon: Coupon) => {
    setCouponCode(coupon.code);
    setShowCouponList(false);
    
    // Validate the selected coupon
    await validateCoupon(coupon.code);
  };

  // Show coupon list
  const handleShowCouponList = () => {
    if (availableCoupons.length === 0) {
      loadAvailableCoupons();
    }
    setShowCouponList(true);
  };

  // Debug function to check coupons status
  const handleDebugCoupons = async () => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      
      const response = await fetch('/api/coupons/debug', {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      const data = await response.json();
      console.log('🔍 Coupon Debug Results:', data);
      
      if (data.success) {
        const debug = data.debug;
        toast.info(`Diagnóstico de Cupones`, {
          description: `Total: ${debug.totalCoupons}, Activos: ${debug.activeCount}, Expirados: ${debug.expiredCount}. Ver consola para detalles.`
        });
      } else {
        toast.error('Error en diagnóstico', {
          description: data.error
        });
      }
    } catch (error) {
      console.error('Error in debug:', error);
      toast.error('Error al ejecutar diagnóstico');
    }
  };

  // Validate coupon when code changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (couponCode && !appliedCoupon) {
        validateCoupon(couponCode);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [couponCode, subtotal, userId, appliedCoupon]);

  // Get discount type display text
  const getDiscountTypeText = (discountType: string, amount: number) => {
    switch (discountType) {
      case 'percent':
        return `${amount}% de descuento`;
      case 'fixed_cart':
        return `$${formatCurrency(amount)} de descuento`;
      case 'fixed_product':
        return `$${formatCurrency(amount)} por producto`;
      default:
        return 'Descuento';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Cupón de Descuento</Label>
      </div>

      {/* Applied Coupon Display */}
      {appliedCoupon && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      {appliedCoupon.code}
                    </Badge>
                    <span className="text-sm text-green-700">
                      {getDiscountTypeText(appliedCoupon.discount_type, appliedCoupon.amount)}
                    </span>
                  </div>
                  {appliedCoupon.description && (
                    <p className="text-xs text-green-600 mt-1">{appliedCoupon.description}</p>
                  )}
                  <p className="text-sm font-medium text-green-800">
                    Descuento aplicado: $${formatCurrency(appliedDiscountAmount)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveCoupon}
                disabled={disabled}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coupon Input */}
      {!appliedCoupon && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Ingresa código de cupón"
                value={couponCode}
                onChange={(e) => handleCouponCodeChange(e.target.value)}
                disabled={disabled || isValidating}
                className="uppercase"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleShowCouponList}
              disabled={disabled}
              title="Seleccionar cupón de la lista"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => validateCoupon(couponCode)}
              disabled={disabled || isValidating || !couponCode.trim()}
            >
              {isValidating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Validar'
              )}
            </Button>
          </div>

          {/* Validation Result */}
          {validationResult && (
            <div className="mt-2">
              {validationResult.is_valid && validationResult.coupon_data ? (
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-blue-600" />
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              {validationResult.coupon_data.code}
                            </Badge>
                            <span className="text-sm text-blue-700">
                              {getDiscountTypeText(
                                validationResult.coupon_data.discount_type,
                                validationResult.coupon_data.amount
                              )}
                            </span>
                          </div>
                          {validationResult.coupon_data.description && (
                            <p className="text-xs text-blue-600 mt-1">
                              {validationResult.coupon_data.description}
                            </p>
                          )}
                          <p className="text-sm font-medium text-blue-800">
                            Descuento: $${formatCurrency(validationResult.discount_amount || 0)}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleApplyCoupon}
                        disabled={disabled}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Aplicar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <p className="text-sm text-red-700">
                        {validationResult.error_message || 'Cupón no válido'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* Coupon Selection Dialog */}
      <CommandDialog open={showCouponList} onOpenChange={setShowCouponList}>
        <DialogTitle className="px-4 pt-4">Seleccionar Cupón</DialogTitle>
        <Command className="rounded-lg border shadow-md">
          <CommandInput placeholder="Buscar cupón por código o descripción..." />
          <CommandList>
            <CommandEmpty>
              {isLoadingCoupons ? (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Cargando cupones...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">No se encontraron cupones disponibles</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Puede que no haya cupones creados o todos estén expirados/agotados.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={loadAvailableCoupons}
                      >
                        Recargar cupones
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleDebugCoupons}
                      >
                        Diagnóstico
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CommandEmpty>
            <CommandGroup heading="Cupones Disponibles">
              {availableCoupons.map((coupon) => {
                const discountAmount = calculateDiscountAmount(coupon, subtotal);
                return (
                  <CommandItem
                    key={coupon.id}
                    value={`${coupon.code} ${coupon.description || ''}`}
                    onSelect={() => handleCouponSelect(coupon)}
                    className="flex flex-col items-start gap-2 p-3"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          {coupon.code}
                        </Badge>
                        <span className="font-medium text-green-600">
                          {getDiscountTypeText(coupon.discount_type, coupon.amount)}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-green-600">
                        -${formatCurrency(discountAmount)}
                      </span>
                    </div>
                    {coupon.description && (
                      <p className="text-sm text-muted-foreground ml-6">
                        {coupon.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 ml-6 text-xs text-muted-foreground">
                      {coupon.minimum_amount && (
                        <span>Mín: ${formatCurrency(coupon.minimum_amount)}</span>
                      )}
                      {coupon.maximum_amount && (
                        <span>Máx: ${formatCurrency(coupon.maximum_amount)}</span>
                      )}
                      {coupon.usage_limit && (
                        <span>Usos: {coupon.usage_count || 0}/{coupon.usage_limit}</span>
                      )}
                      {coupon.date_expires && (
                        <span>Expira: {new Date(coupon.date_expires).toLocaleDateString()}</span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>

      {/* Help Text */}
      {!appliedCoupon && (
        <p className="text-xs text-muted-foreground">
          Ingresa un código de cupón o <button 
            onClick={handleShowCouponList}
            className="text-blue-600 hover:text-blue-700 underline"
            disabled={disabled}
          >
            selecciona uno de la lista
          </button> para obtener descuentos en tu pedido
        </p>
      )}
    </div>
  );
};
