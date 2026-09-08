import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  VALUATION_FIELDS,
  formatClp,
  parseValuationUpdates,
  totalValueClp,
  type ValuationField,
} from '../../lib/productValuation';
import type { IncompleteProduct } from '../../types/inventory';

interface ProductValuationDialogProps {
  product: IncompleteProduct | null;
  onClose: () => void;
  /** Called after a successful save so the report can be refetched. */
  onSaved: () => void;
}

const FIELD_LABELS: Record<ValuationField, string> = {
  declared_quantity: 'Cantidad declarada',
  market_value_clp: 'Valor mercado (CLP)',
  used_value_clp: 'Valor usado (CLP)',
};

type FormState = Record<ValuationField, string>;

function toFormState(product: IncompleteProduct | null): FormState {
  return {
    declared_quantity: product?.declared_quantity?.toString() ?? '',
    market_value_clp: product?.market_value_clp?.toString() ?? '',
    used_value_clp: product?.used_value_clp?.toString() ?? '',
  };
}

/**
 * The three spreadsheet values for one product, edited from the data-quality list. Three fields
 * with manual state, per the "estado manual" rule for small forms; the same parser the API runs
 * server-side (`parseValuationUpdates`) validates here first, so the dialog and the endpoint can
 * never disagree on what an integer is. The total is previewed live and never sent.
 */
export function ProductValuationDialog({ product, onClose, onSaved }: ProductValuationDialogProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(product));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // A new product selected while the dialog is mounted must not show the previous one's values.
  useEffect(() => {
    setForm(toFormState(product));
    setError(null);
  }, [product]);

  const parsed = parseValuationUpdates(form);
  const previewTotal =
    product && !parsed.error
      ? totalValueClp({
          countedQuantity: product.counted_quantity,
          declaredQuantity: parsed.values.declared_quantity ?? null,
          usedValueClp: parsed.values.used_value_clp ?? null,
        })
      : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!product) return;

    if (parsed.error) {
      setError(parsed.error);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.values),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Error al guardar los valores');
      }

      toast.success('Valores guardados', {
        description: product.name || `Producto #${product.id}`,
      });
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Error al guardar los valores');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cantidad y valores</DialogTitle>
          <DialogDescription>
            {product?.name || `Producto #${product?.id ?? ''}`}
            {product?.sku ? ` · ${product.sku}` : ''}. Deja un campo vacío para borrar su valor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {VALUATION_FIELDS.map((field) => (
            <div key={field} className="space-y-2">
              <Label htmlFor={`valuation-${field}`}>{FIELD_LABELS[field]}</Label>
              <Input
                id={`valuation-${field}`}
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={form[field]}
                onChange={(event) => setForm((previous) => ({ ...previous, [field]: event.target.value }))}
              />
            </div>
          ))}

          <div className="bg-muted/50 flex items-center justify-between rounded-md border p-3 text-sm">
            <span className="text-muted-foreground">
              Valor total ({product?.counted_quantity ? `${product.counted_quantity} contadas` : 'cantidad declarada'})
            </span>
            <span className="font-medium tabular-nums">
              {previewTotal === null ? '—' : formatClp(previewTotal)}
            </span>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || Boolean(parsed.error)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ProductValuationDialog;
