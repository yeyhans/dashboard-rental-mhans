import { useMemo, useState } from 'react';
import { CheckCircle2, Pencil, Search } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  DISCREPANCY_LABELS,
  DISCREPANCY_TONES,
  formatClp,
  type StatusTone,
} from '../../lib/productValuation';
import {
  AUDITED_PRODUCT_FIELD_LABELS,
  type DataQualityReport,
  type IncompleteProduct,
} from '../../types/inventory';
import { ProductValuationDialog } from './ProductValuationDialog';

interface DataQualityTableProps {
  report: DataQualityReport;
  /** Fired after a product's valuation is saved, so the container can refetch the report. */
  onValuationSaved?: () => void;
}

// Muted Área 01 status palette from `globals.css`; no Tailwind colour scale, no new tones.
const TONE_CLASSES: Record<StatusTone, string> = {
  ok: 'border-transparent bg-[var(--color-ok-bg)] text-[var(--color-ok)]',
  warn: 'border-transparent bg-[var(--color-warn-bg)] text-[var(--color-warn)]',
  info: 'border-transparent bg-[var(--color-info-bg)] text-[var(--color-info)]',
  neutral: 'border-transparent bg-[var(--color-neutral-bg)] text-[var(--color-neutral)]',
};

function clp(value: number | null): string {
  return value === null ? '—' : formatClp(value);
}

/**
 * The reviewable list the spec requires (T-036): products whose audited fields are unusable for a
 * count sheet, and — since the client's spreadsheet came in (0010) — products whose counted units
 * disagree with the declared quantity. It exists so incomplete data is neither silently accepted
 * nor silently rejected — entry still succeeds, the gap just becomes visible and fixable.
 *
 * Declared and counted quantities sit side by side on purpose: the comparison is the finding.
 * The total is derived server-side and displayed as received; the table never computes money.
 */
export function DataQualityTable({ report, onValuationSaved }: DataQualityTableProps) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<IncompleteProduct | null>(null);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return report.products;
    return report.products.filter(
      (product) =>
        (product.name || '').toLowerCase().includes(term) ||
        (product.slug || '').toLowerCase().includes(term) ||
        (product.sku || '').toLowerCase().includes(term) ||
        String(product.id).includes(term)
    );
  }, [report.products, search]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Calidad de datos del catálogo</CardTitle>
        <CardDescription>
          {report.incomplete} de {report.total} productos tienen datos incompletos o una cantidad
          que no coincide con lo declarado. No bloquean el registro de equipos, pero conviene
          revisarlos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {report.incomplete === 0 ? (
          <div className="text-muted-foreground py-10 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 opacity-40" aria-hidden="true" />
            <p>Todos los productos tienen sus datos completos y sus cantidades coinciden.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="data-quality-search" className="sr-only">
                Buscar producto
              </Label>
              <div className="relative">
                <Search
                  className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <Input
                  id="data-quality-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre, SKU, slug o ID..."
                  className="pl-8"
                />
              </div>
            </div>

            {visibleProducts.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Ningún producto con hallazgos coincide con la búsqueda.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Cantidad declarada</TableHead>
                      <TableHead className="text-right">Contada</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead className="text-right">Valor mercado</TableHead>
                      <TableHead className="text-right">Valor usado</TableHead>
                      <TableHead className="text-right">Valor total</TableHead>
                      <TableHead>Datos faltantes</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="tabular-nums">{product.id}</TableCell>
                        <TableCell>
                          <a href={`/products/${product.id}`} className="hover:underline">
                            {product.name || `Producto #${product.id}`}
                          </a>
                          <div className="text-muted-foreground text-xs">
                            {product.status || 'sin estado'}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {product.sku || '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {product.declared_quantity ?? '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{product.counted_quantity}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`font-normal ${TONE_CLASSES[DISCREPANCY_TONES[product.discrepancy]]}`}
                          >
                            {DISCREPANCY_LABELS[product.discrepancy]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{clp(product.market_value_clp)}</TableCell>
                        <TableCell className="text-right tabular-nums">{clp(product.used_value_clp)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {clp(product.total_value_clp)}
                        </TableCell>
                        <TableCell>
                          {product.missing_fields.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {product.missing_fields.map((field) => (
                                <Badge key={field} variant="outline" className="font-normal">
                                  {AUDITED_PRODUCT_FIELD_LABELS[field]}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(product)}
                            aria-label={`Editar cantidad y valores de ${product.name || `producto #${product.id}`}`}
                          >
                            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                            Valores
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>

      <ProductValuationDialog
        product={editing}
        onClose={() => setEditing(null)}
        onSaved={() => onValuationSaved?.()}
      />
    </Card>
  );
}

export default DataQualityTable;
