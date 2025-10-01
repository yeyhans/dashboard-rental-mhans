import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { useState, useEffect } from 'react';
import { CouponSelector } from './CouponSelector';
import type { Database } from '../../types/database';

type Coupon = Database['public']['Tables']['coupons']['Row'];

// Helper function to format currency
const formatCurrency = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

interface OrderCostSummaryProps {
  baseSubtotal: string;
  subtotal: string;
  discount: string;
  iva: string;
  total: string;
  shipping?: string;
  onDiscountChange?: (value: string) => void;
  onShippingChange?: (value: string) => void;
  onTotalChange?: (newTotal: string, newIva: string) => void;
  onCouponApplied?: (coupon: Coupon, discountAmount: number) => void;
  onCouponRemoved?: () => void;
  appliedCoupon?: Coupon | null | undefined;
  couponDiscountAmount?: number;
  mode: 'create' | 'edit' | 'view';
  loading?: boolean;
  numDays: number;
  currency?: string;
  allowEdit?: boolean;
  userId?: number | undefined;
  showCoupons?: boolean;
  showShipping?: boolean;
  showManualDiscount?: boolean;
  accessToken?: string | undefined;
}

export const OrderCostSummary = ({
  baseSubtotal,
  subtotal,
  discount,
  iva,
  total,
  shipping = '0',
  onDiscountChange,
  onShippingChange,
  onTotalChange,
  onCouponApplied,
  onCouponRemoved,
  appliedCoupon,
  couponDiscountAmount = 0,
  mode = 'edit',
  loading = false,
  numDays,
  currency = 'CLP',
  allowEdit = true,
  userId,
  showCoupons = true,
  showShipping = true,
  showManualDiscount = true,
  accessToken
}: OrderCostSummaryProps) => {
  const [applyIva, setApplyIva] = useState(parseFloat(iva) > 0);
  
  // Update applyIva when iva prop changes
  useEffect(() => {
    setApplyIva(parseFloat(iva) > 0);
  }, [iva]);
  
  const taxRate = 0.19;
  
  const formatCurrencyWithSymbol = (value: string | number) => {
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '$';
    return `${symbol}${formatCurrency(value)}`;
  };

  const handleIvaChange = (checked: boolean) => {
    console.log(`Cambiando aplicación de IVA a: ${checked}`);
    setApplyIva(checked);
    
    if (onTotalChange) {
      // Convertir valores a números con precisión de 2 decimales
      const subtotalNum = Math.round((parseFloat(subtotal) || 0) * 100) / 100;
      const discountNum = Math.round((parseFloat(discount) || 0) * 100) / 100;
      const shippingNum = Math.round((parseFloat(shipping) || 0) * 100) / 100;
      const couponDiscountNum = Math.round((couponDiscountAmount || 0) * 100) / 100;
      
      // Calcular nuevo IVA
      const newIva = checked ? Math.round(subtotalNum * taxRate * 100) / 100 : 0;
      
      // Calcular nuevo total (subtotal - descuento manual - descuento cupón + shipping + IVA)
      const manualDiscountNum = showManualDiscount ? discountNum : 0;
      const newTotal = Math.round((subtotalNum - manualDiscountNum - couponDiscountNum + shippingNum + newIva) * 100) / 100;
      
      console.log('Recalculando con IVA:', {
        subtotal: subtotalNum,
        discount: discountNum,
        couponDiscount: couponDiscountNum,
        shipping: shippingNum,
        newIva: newIva,
        newTotal: newTotal,
        checked: checked
      });
      
      // Enviar valores como strings
      onTotalChange(newTotal.toString(), newIva.toString());
    }
  };

  // Handle shipping change
  const handleShippingChange = (value: string) => {
    if (onShippingChange) {
      onShippingChange(value);
    }
    
    // Recalculate total when shipping changes
    if (onTotalChange) {
      const subtotalNum = Math.round((parseFloat(subtotal) || 0) * 100) / 100;
      const discountNum = Math.round((parseFloat(discount) || 0) * 100) / 100;
      const shippingNum = Math.round((parseFloat(value) || 0) * 100) / 100;
      const couponDiscountNum = Math.round((couponDiscountAmount || 0) * 100) / 100;
      const ivaNum = Math.round((parseFloat(iva) || 0) * 100) / 100;
      
      const manualDiscountNum = showManualDiscount ? discountNum : 0;
      const newTotal = Math.round((subtotalNum - manualDiscountNum - couponDiscountNum + shippingNum + ivaNum) * 100) / 100;
      
      onTotalChange(newTotal.toString(), iva);
    }
  };

  // Handle coupon applied
  const handleCouponApplied = (coupon: Coupon, discountAmount: number) => {
    if (onCouponApplied) {
      onCouponApplied(coupon, discountAmount);
    }
    
    // Recalculate total when coupon is applied
    if (onTotalChange) {
      const subtotalNum = Math.round((parseFloat(subtotal) || 0) * 100) / 100;
      const discountNum = Math.round((parseFloat(discount) || 0) * 100) / 100;
      const shippingNum = Math.round((parseFloat(shipping) || 0) * 100) / 100;
      const couponDiscountNum = Math.round(discountAmount * 100) / 100;
      const ivaNum = Math.round((parseFloat(iva) || 0) * 100) / 100;
      
      const manualDiscountNum = showManualDiscount ? discountNum : 0;
      const newTotal = Math.round((subtotalNum - manualDiscountNum - couponDiscountNum + shippingNum + ivaNum) * 100) / 100;
      
      onTotalChange(newTotal.toString(), iva);
    }
  };

  // Handle coupon removed
  const handleCouponRemoved = () => {
    if (onCouponRemoved) {
      onCouponRemoved();
    }
    
    // Recalculate total when coupon is removed
    if (onTotalChange) {
      const subtotalNum = Math.round((parseFloat(subtotal) || 0) * 100) / 100;
      const discountNum = Math.round((parseFloat(discount) || 0) * 100) / 100;
      const shippingNum = Math.round((parseFloat(shipping) || 0) * 100) / 100;
      const ivaNum = Math.round((parseFloat(iva) || 0) * 100) / 100;
      
      const manualDiscountNum = showManualDiscount ? discountNum : 0;
      const newTotal = Math.round((subtotalNum - manualDiscountNum + shippingNum + ivaNum) * 100) / 100;
      
      onTotalChange(newTotal.toString(), iva);
    }
  };

  const ivaValue = parseFloat(iva) || 0;
  const isEditable = allowEdit && (mode === 'create' || mode === 'edit');
  const taxPercentage = Math.round(taxRate * 100);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium">Resumen de Costos</h4>
      </div>
      
      <div className="space-y-3 bg-muted/50 p-4 rounded-lg border">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Valor Base (por jornada)</span>
          <span className="font-medium">{formatCurrencyWithSymbol(baseSubtotal)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">({numDays} jornada{numDays !== 1 ? 's' : ''}) {formatCurrencyWithSymbol(subtotal)}</span>
        </div>
        
        {/* Manual Discount - only show if enabled */}
        {showManualDiscount && (
          <div className="flex justify-between items-center gap-2">
            <span className="text-muted-foreground">Descuento Manual</span>
            {isEditable && onDiscountChange ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  className="w-20 md:w-24 text-right h-8"
                  value={discount}
                  onChange={(e) => onDiscountChange(e.target.value)}
                  disabled={loading}
                  min="0"
                  step="1000"
                />
              </div>
            ) : (
              <span className="font-medium text-red-600">-{formatCurrencyWithSymbol(discount)}</span>
            )}
          </div>
        )}
        
        {/* Coupon Discount Display */}
        {couponDiscountAmount > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Descuento Cupón</span>
            <span className="font-medium text-green-600">-{formatCurrencyWithSymbol(couponDiscountAmount)}</span>
          </div>
        )}
        
        {/* Shipping */}
        {showShipping && (
          <div className="flex justify-between items-center gap-2">
            <span className="text-muted-foreground">Envío</span>
            {isEditable && onShippingChange ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  className="w-20 md:w-24 text-right h-8"
                  value={shipping}
                  onChange={(e) => handleShippingChange(e.target.value)}
                  disabled={loading}
                  min="0"
                  step="1000"
                />
              </div>
            ) : (
              <span className="font-medium text-blue-600">{formatCurrencyWithSymbol(shipping)}</span>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="apply-iva"
              checked={applyIva}
              onCheckedChange={handleIvaChange}
              disabled={loading || !isEditable}
              className="h-4 w-4"
            />
            <Label htmlFor="apply-iva" className="cursor-pointer text-sm">
              Aplicar IVA ({taxPercentage}%)
            </Label>
          </div>
          <span className={`font-medium ${applyIva ? 'text-blue-600' : 'text-muted-foreground'}`}>
            {formatCurrencyWithSymbol(ivaValue)}
          </span>
        </div>
        
        <div className="border-t pt-3 mt-3">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-lg">Total</span>
            <span className="font-bold text-lg text-green-600">{formatCurrencyWithSymbol(total)}</span>
          </div>
          {currency !== 'CLP' && (
            <div className="text-xs text-muted-foreground text-right mt-1">
              Moneda: {currency}
            </div>
          )}
        </div>
        
        {mode === 'view' && (
          <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <span>Subtotal sin IVA: {formatCurrencyWithSymbol(parseFloat(subtotal) - (showManualDiscount ? parseFloat(discount) : 0) - couponDiscountAmount)}</span>
              <span>IVA aplicado: {applyIva ? 'Sí' : 'No'}</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Coupon Selector */}
      {showCoupons && isEditable && (
        <CouponSelector
          subtotal={parseFloat(subtotal) - (showManualDiscount ? parseFloat(discount) : 0)}
          onCouponApplied={handleCouponApplied}
          onCouponRemoved={handleCouponRemoved}
          appliedCoupon={appliedCoupon}
          appliedDiscountAmount={couponDiscountAmount}
          userId={userId}
          disabled={loading}
          className="mt-4"
          accessToken={accessToken}
        />
      )}
    </div>
  );
};