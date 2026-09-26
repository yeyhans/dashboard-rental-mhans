import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { CouponSelector } from './CouponSelector';
import type { Database } from '../../types/database';
import { IVA_RATE } from '../../lib/pricing';

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
  /** Whether IVA applies. The parent owns the totals and recomputes them with src/lib/pricing.ts. */
  applyIva?: boolean;
  onApplyIvaChange?: (applyIva: boolean) => void;
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
  applyIva: applyIvaProp,
  onApplyIvaChange,
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
  // This component only reports intents; every amount it shows comes from the parent, which prices
  // the order with the shared pricing module.
  const applyIva = applyIvaProp ?? parseFloat(iva) > 0;
  const taxRate = IVA_RATE;

  const formatCurrencyWithSymbol = (value: string | number) => {
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '$';
    return `${symbol}${formatCurrency(value)}`;
  };

  const handleIvaChange = (checked: boolean) => {
    onApplyIvaChange?.(checked);
  };

  const handleManualDiscountChange = (value: string) => {
    onDiscountChange?.(value);
  };

  const handleShippingChange = (value: string) => {
    onShippingChange?.(value);
  };

  const handleCouponApplied = (coupon: Coupon, discountAmount: number) => {
    onCouponApplied?.(coupon, discountAmount);
  };

  const handleCouponRemoved = () => {
    onCouponRemoved?.();
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
                  onChange={(e) => handleManualDiscountChange(e.target.value)}
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
              onCheckedChange={(checked) => handleIvaChange(checked === true)}
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
              <span>Subtotal sin IVA: {formatCurrencyWithSymbol((parseFloat(total) || 0) - ivaValue)}</span>
              <span>IVA aplicado: {applyIva ? 'Sí' : 'No'}</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Coupon Selector */}
      {showCoupons && isEditable && (
        <CouponSelector
          subtotal={parseFloat(subtotal) || 0}
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