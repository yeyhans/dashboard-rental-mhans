import { useCallback, useState } from 'react';
import { Loader2, PackageSearch, RefreshCw } from 'lucide-react';
import { Toaster } from 'sonner';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import type {
  DataQualityReport,
  IntakeProduct,
  IntakeProgress,
  SerialisedAsset,
} from '../../types/inventory';
import { DataQualityTable } from './DataQualityTable';
import { IntakeProgressCard } from './IntakeProgressCard';
import { SerialisedAssetForm } from './SerialisedAssetForm';
import { conditionLabel } from './intakeForm';

interface InventoryIntakeDashboardProps {
  products: IntakeProduct[];
  initialProgress: IntakeProgress;
  initialReport: DataQualityReport;
}

/**
 * Serialised-inventory intake (M6). Container for the three surfaces the batch ships: the entry
 * form (T-035), the data-quality review list and the progress summary (T-036).
 *
 * Recently entered units are kept in local state rather than refetched: during a count the
 * operator's own last few entries are the only list that matters, and a round trip per unit slows
 * the sheet down.
 */
export function InventoryIntakeDashboard({
  products,
  initialProgress,
  initialReport,
}: InventoryIntakeDashboardProps) {
  const [progress, setProgress] = useState<IntakeProgress>(initialProgress);
  const [report, setReport] = useState<DataQualityReport>(initialReport);
  const [recentAssets, setRecentAssets] = useState<SerialisedAsset[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const productNames = new Map(products.map((product) => [product.id, product.name]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const [progressResponse, qualityResponse] = await Promise.all([
        fetch('/api/inventory/progress'),
        fetch('/api/inventory/data-quality'),
      ]);
      const progressPayload = await progressResponse.json();
      const qualityPayload = await qualityResponse.json();

      if (!progressPayload.success || !qualityPayload.success) {
        throw new Error(progressPayload.error || qualityPayload.error || 'Error al actualizar');
      }

      setProgress(progressPayload.data as IntakeProgress);
      setReport(qualityPayload.data as DataQualityReport);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : 'Error al actualizar los datos');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleAssetCreated = useCallback((asset: SerialisedAsset) => {
    setRecentAssets((previous) => [asset, ...previous].slice(0, 20));
    // The denominator only moves when a product goes from zero assets to one, so the summary is
    // nudged optimistically and reconciled by the explicit refresh.
    setProgress((previous) => ({ ...previous, total_assets: previous.total_assets + 1 }));
  }, []);

  return (
    <div className="space-y-6">
      <Toaster position="top-right" richColors />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventario serializado</h1>
          <p className="text-muted-foreground text-sm">
            Registro de equipos unidad por unidad para el conteo físico.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          Actualizar
        </Button>
      </div>

      {refreshError && (
        <div className="border-destructive/50 text-destructive rounded-md border p-3 text-sm">
          {refreshError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SerialisedAssetForm products={products} onAssetCreated={handleAssetCreated} />
        <IntakeProgressCard progress={progress} />
      </div>

      <Tabs defaultValue="recent">
        <TabsList>
          <TabsTrigger value="recent">Registrados en esta sesión</TabsTrigger>
          <TabsTrigger value="quality">
            Calidad de datos
            {report.incomplete > 0 && (
              <Badge variant="secondary" className="ml-2 font-normal">
                {report.incomplete}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="mt-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Equipos registrados en esta sesión</CardTitle>
              <CardDescription>
                Se limpia al recargar la página. El registro completo vive en la base de datos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentAssets.length === 0 ? (
                <div className="text-muted-foreground py-10 text-center">
                  <PackageSearch className="mx-auto mb-3 h-10 w-10 opacity-40" aria-hidden="true" />
                  <p>Todavía no registras equipos en esta sesión.</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número de serie</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Condición</TableHead>
                        <TableHead>Ubicación</TableHead>
                        <TableHead>Kit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentAssets.map((asset) => (
                        <TableRow key={asset.id}>
                          <TableCell className="font-medium">{asset.serial_number}</TableCell>
                          <TableCell>
                            {productNames.get(asset.product_id) || `Producto #${asset.product_id}`}
                          </TableCell>
                          <TableCell>{conditionLabel(asset.condition)}</TableCell>
                          <TableCell className="text-muted-foreground">{asset.location}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {asset.kit_code || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="mt-4">
          <DataQualityTable report={report} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default InventoryIntakeDashboard;
