import { Boxes, PackageCheck, Percent } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import type { IntakeProgress } from '../../types/inventory';

interface IntakeProgressCardProps {
  progress: IntakeProgress;
}

/**
 * The observable indicator of physical-count progress (T-036, ADR-003 / O-5). Reads as "how much
 * of the published catalogue has been counted", which is the question the client dependency is
 * tracked against — an asset total alone cannot answer it.
 */
export function IntakeProgressCard({ progress }: IntakeProgressCardProps) {
  const { published_products, products_with_assets, total_assets, completion_percentage } = progress;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Avance del inventario</CardTitle>
        <CardDescription>
          Productos publicados con al menos un equipo registrado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-semibold tabular-nums">
              {products_with_assets}
              <span className="text-muted-foreground text-lg font-normal"> / {published_products}</span>
            </p>
            <p className="text-muted-foreground text-sm">productos con equipos contados</p>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Percent className="h-4 w-4" aria-hidden="true" />
            <span className="tabular-nums">{completion_percentage}%</span>
          </div>
        </div>

        <Progress
          value={completion_percentage}
          aria-label={`Avance del conteo: ${completion_percentage} por ciento`}
        />

        <div className="grid grid-cols-2 gap-3 pt-1 text-sm">
          <div className="flex items-center gap-2">
            <Boxes className="text-muted-foreground h-4 w-4" aria-hidden="true" />
            <span className="tabular-nums">{total_assets}</span>
            <span className="text-muted-foreground">equipos registrados</span>
          </div>
          <div className="flex items-center gap-2">
            <PackageCheck className="text-muted-foreground h-4 w-4" aria-hidden="true" />
            <span className="tabular-nums">{published_products - products_with_assets}</span>
            <span className="text-muted-foreground">productos pendientes</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default IntakeProgressCard;
