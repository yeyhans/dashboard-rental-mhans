import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { useState, useEffect } from 'react';

// Helper function to format currency
const formatCurrency = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

interface OrderCostSummaryProps {
  baseSubtotal: string;  // Subtotal before multiplying by rental days
  subtotal: string;      // Subtotal after multiplying by rental days
  discount: string;
  iva: string;
  total: string;
  onDiscountChange?: (value: string) => void;
  onTotalChange?: (newTotal: string, newIva: string) => void;
  mode: 'create' | 'edit';
  loading?: boolean;
  numDays: number;
}

export const OrderCostSummary = ({
  baseSubtotal,
  subtotal,
  discount,
  iva,
  total,
  onDiscountChange,
  onTotalChange,
  mode = 'edit',
  loading = false,
  numDays
}: OrderCostSummaryProps) => {
  const [applyIva, setApplyIva] = useState(parseFloat(iva) > 0);
  
  // Update applyIva when iva prop changes
  useEffect(() => {
    setApplyIva(parseFloat(iva) > 0);
  }, [iva]);
  
  const calculateIva = (subtotalValue: number): number => {
    return applyIva ? subtotalValue * 0.19 : 0;
  };

  const handleIvaChange = (checked: boolean) => {
    console.log(`Cambiando aplicación de IVA a: ${checked}`);
    setApplyIva(checked);
    
    if (onTotalChange) {
      // Convertir valores a números con precisión de 2 decimales
      const subtotalNum = Math.round((parseFloat(subtotal) || 0) * 100) / 100;
      const discountNum = Math.round((parseFloat(discount) || 0) * 100) / 100;
      
      // Calcular nuevo IVA
      const newIva = checked ? Math.round(subtotalNum * 0.19 * 100) / 100 : 0;
      
      // Calcular nuevo total
      const newTotal = Math.round((subtotalNum - discountNum + newIva) * 100) / 100;
      
      console.log('Recalculando con IVA:', {
        subtotal: subtotalNum,
        discount: discountNum,
        newIva: newIva,
        newTotal: newTotal,
        checked: checked
      });
      
      // Enviar valores como strings
      onTotalChange(newTotal.toString(), newIva.toString());
    }
  };

  const ivaValue = parseFloat(iva) || 0;
  const showIva = true; // Always show IVA line, even if it's 0

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium mb-2">Resumen de Costos</h4>
      <div className="space-y-2 bg-muted/50 p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <span>Valor Base</span>
          <span>${formatCurrency(baseSubtotal)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Subtotal</span>
          <span>({numDays} jornadas) ${formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span>Descuento</span>
          {(mode === 'create' || mode === 'edit') && onDiscountChange ? (
            <Input
              type="number"
              className="w-32 text-right"
              value={discount}
              onChange={(e) => onDiscountChange(e.target.value)}
              disabled={loading}
            />
          ) : (
            <span>${formatCurrency(discount)}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="apply-iva"
              checked={applyIva}
              onCheckedChange={handleIvaChange}
              disabled={loading || (mode !== 'create' && mode !== 'edit')}
            />
            <Label htmlFor="apply-iva" className="cursor-pointer">
              Aplicar IVA (19%)
            </Label>
          </div>
        </div>
        {showIva && (
          <div className="flex justify-between">
            <span>IVA (19%)</span>
            <span>${formatCurrency(ivaValue)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
          <span>Total</span>
          <span>${formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}; 