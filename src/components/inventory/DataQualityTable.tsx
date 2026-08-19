import { useMemo, useState } from 'react';
import { CheckCircle2, Search } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { AUDITED_PRODUCT_FIELD_LABELS, type DataQualityReport } from '../../types/inventory';

interface DataQualityTableProps {
  report: DataQualityReport;
}

/**
 * The reviewable list the spec requires (T-036): products whose audited fields are unusable for a
 * count sheet. It exists so incomplete data is neither silently accepted nor silently rejected —
 * entry still succeeds, the gap just becomes visible and fixable.
 */
export function DataQualityTable({ report }: DataQualityTableProps) {
  const [search, setSearch] = useState('');

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return report.products;
    return report.products.filter(
      (product) =>
        (product.name || '').toLowerCase().includes(term) ||
        (product.slug || '').toLowerCase().includes(term) ||
        String(product.id).includes(term)
    );
  }, [report.products, search]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Calidad de datos del catálogo</CardTitle>
        <CardDescription>
          {report.incomplete} de {report.total} productos tienen datos incompletos. No bloquean el
          registro de equipos, pero conviene completarlos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {report.incomplete === 0 ? (
          <div className="text-muted-foreground py-10 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 opacity-40" aria-hidden="true" />
            <p>Todos los productos tienen sus datos completos.</p>
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
                  placeholder="Buscar por nombre, slug o ID..."
                  className="pl-8"
                />
              </div>
            </div>

            {visibleProducts.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Ningún producto incompleto coincide con la búsqueda.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">ID</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Datos faltantes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="tabular-nums">{product.id}</TableCell>
                        <TableCell>
                          <a
                            href={`/products/${product.id}`}
                            className="hover:underline"
                          >
                            {product.name || `Producto #${product.id}`}
                          </a>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {product.status || 'sin estado'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {product.missing_fields.map((field) => (
                              <Badge key={field} variant="outline" className="font-normal">
                                {AUDITED_PRODUCT_FIELD_LABELS[field]}
                              </Badge>
                            ))}
                          </div>
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
    </Card>
  );
}

export default DataQualityTable;
