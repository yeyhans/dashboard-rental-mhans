import { useMemo, useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Check, ChevronsUpDown, Loader2, ScanLine } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Textarea } from '../ui/textarea';
import { findMissingFields } from '../../lib/inventory/dataQuality';
import { cn } from '../../lib/utils';
import type { IntakeProduct, SerialisedAsset } from '../../types/inventory';
import {
  ASSET_CONDITIONS,
  buildIntakePayload,
  conditionLabel,
  describeMissingFields,
  intakeFormSchema,
  isScannerSubmitKey,
  normaliseTagField,
  valuesAfterSubmit,
  type IntakeFormValues,
} from './intakeForm';

interface SerialisedAssetFormProps {
  products: IntakeProduct[];
  onAssetCreated: (asset: SerialisedAsset) => void;
}

/**
 * Intake form for one physical unit (T-035).
 *
 * The asset tag comes first and takes focus on mount: the count runs label → scan → serial, and
 * the scan is done with a phone or a HID (keyboard-wedge) barcode gun. A gun types the tag and
 * sends Enter, which in a form submits; here Enter in the tag field moves focus to the serial
 * instead, so one scan lands the operator exactly where the next keystroke belongs.
 *
 * Incomplete source products are flagged next to the selector and never block submission — the
 * client's count runs against exactly those rows. See `serialised-inventory-operations/spec.md`,
 * "Incomplete product does not block asset entry".
 */
export function SerialisedAssetForm({ products, onAssetCreated }: SerialisedAssetFormProps) {
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    handleSubmit,
    register,
    reset,
    setFocus,
    setValue,
    watch,
    formState: { errors },
  } = useForm<IntakeFormValues>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: {
      product_id: 0,
      asset_tag: '',
      serial_number: '',
      condition: 'operational',
      location: '',
      kit_code: '',
      notes: '',
    },
  });

  const selectedProductId = watch('product_id');
  const selectedCondition = watch('condition');
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId]
  );
  const missingFields = useMemo(
    () => (selectedProduct ? findMissingFields(selectedProduct as unknown as Record<string, unknown>) : []),
    [selectedProduct]
  );

  // Canonical form as soon as the field is left, so the operator sees what will be stored (a gun
  // in lower-case mode, a phone keyboard) before the resolver reports on it. The decisions live
  // in `intakeForm.ts` (R3-001) and are tested there; this only wires them to the form.
  const applyTagNormalisation = () => {
    setValue('asset_tag', normaliseTagField(watch('asset_tag')), { shouldValidate: true });
  };

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isScannerSubmitKey(event)) return;
    // The scanner's Enter is a field terminator, not a submit.
    event.preventDefault();
    applyTagNormalisation();
    setFocus('serial_number');
  };

  const onSubmit = async (values: IntakeFormValues) => {
    setSubmitting(true);
    try {
      const payload = buildIntakePayload(values);
      const response = await fetch('/api/inventory/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al registrar el equipo');
      }

      toast.success('Equipo registrado', {
        description: `${payload.asset_tag} · ${payload.serial_number} quedó asociado a ${selectedProduct?.name || 'el producto'}.`,
      });
      onAssetCreated(result.data as SerialisedAsset);

      // Keep the product, condition and location: a count runs unit after unit in the same place.
      // The tag and serial are per unit and start blank; focus returns to the tag for the next scan.
      reset(valuesAfterSubmit(values));
      setFocus('asset_tag');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al registrar el equipo');
    } finally {
      setSubmitting(false);
    }
  };

  const assetTagField = register('asset_tag', { onBlur: applyTagNormalisation });

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Registrar equipo</CardTitle>
        <CardDescription>
          Un registro por unidad física. Si al producto le faltan datos, igual puedes registrarlo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="asset_tag">Asset tag</Label>
            <div className="relative">
              <ScanLine
                className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                id="asset_tag"
                className="pl-9 font-mono uppercase"
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                inputMode="text"
                spellCheck={false}
                placeholder="MH-00001"
                aria-describedby="asset_tag-hint"
                {...assetTagField}
                onKeyDown={handleTagKeyDown}
              />
            </div>
            {errors.asset_tag ? (
              <p className="text-destructive text-sm">{errors.asset_tag.message}</p>
            ) : (
              <p id="asset_tag-hint" className="text-muted-foreground text-sm">
                Escanea la etiqueta o escribe el código
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-picker">Producto</Label>
            <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="product-picker"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={productPickerOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className={cn(!selectedProduct && 'text-muted-foreground')}>
                    {selectedProduct ? selectedProduct.name || `Producto #${selectedProduct.id}` : 'Selecciona un producto'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por nombre o SKU..." />
                  <CommandList>
                    <CommandEmpty>No se encontraron productos.</CommandEmpty>
                    <CommandGroup>
                      {products.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={`${product.name || ''} ${product.sku || ''} ${product.id}`}
                          onSelect={() => {
                            setValue('product_id', product.id, { shouldValidate: true });
                            setProductPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              product.id === selectedProductId ? 'opacity-100' : 'opacity-0'
                            )}
                            aria-hidden="true"
                          />
                          <span className="flex-1 truncate">{product.name || `Producto #${product.id}`}</span>
                          <span className="text-muted-foreground ml-2 text-xs">
                            {product.sku || 'sin SKU'}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.product_id && (
              <p className="text-destructive text-sm">{errors.product_id.message}</p>
            )}
            {missingFields.length > 0 && (
              <div className="bg-muted/50 flex items-start gap-2 rounded-md border p-2.5 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                <p className="text-muted-foreground">
                  A este producto le faltan datos ({describeMissingFields(missingFields)}). Puedes
                  registrar el equipo igual; queda anotado en la lista de calidad de datos.
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="serial_number">Número de serie</Label>
              <Input
                id="serial_number"
                autoComplete="off"
                placeholder="PROFOTO-B10-0007"
                {...register('serial_number')}
              />
              {errors.serial_number && (
                <p className="text-destructive text-sm">{errors.serial_number.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="condition">Condición</Label>
              <Select
                value={selectedCondition}
                onValueChange={(value) =>
                  setValue('condition', value as IntakeFormValues['condition'], { shouldValidate: true })
                }
              >
                <SelectTrigger id="condition">
                  <SelectValue placeholder="Selecciona la condición" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CONDITIONS.map((condition) => (
                    <SelectItem key={condition} value={condition}>
                      {conditionLabel(condition)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.condition && (
                <p className="text-destructive text-sm">{errors.condition.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <Input
                id="location"
                autoComplete="off"
                placeholder="Bodega Purísima, estante 3"
                {...register('location')}
              />
              {errors.location && (
                <p className="text-destructive text-sm">{errors.location.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="kit_code">
                Kit <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                id="kit_code"
                autoComplete="off"
                placeholder="KIT-LUZ-01"
                {...register('kit_code')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">
              Notas <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Detalles del estado, accesorios que vienen con la unidad..."
              {...register('notes')}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            {selectedProduct && (
              <Badge variant="outline" className="font-normal">
                {selectedProduct.sku || 'sin SKU'}
              </Badge>
            )}
            <Button type="submit" disabled={submitting} className="ml-auto">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Registrar equipo
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default SerialisedAssetForm;
