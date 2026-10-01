import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Calendar, Filter } from 'lucide-react';
import { ORDER_LIST_TABS, statusBadgeClass, type OrderStatus } from '../lib/orderStatus';
import type { MonthlyOrderStats } from '../services/dashboardService';

interface OrderSummaryStatsProps {
  monthlyStats: MonthlyOrderStats;
  isFiltered?: boolean;
  filterInfo?: string;
}

/**
 * Descripción por estado. Las etiquetas salen de `ORDER_LIST_TABS` (plural, porque cada tarjeta
 * cuenta una colección); esto solo agrega la línea de apoyo, que el canónico no fija.
 */
const STAT_DESCRIPTIONS: Record<OrderStatus, string> = {
  request: 'Esperando revisión',
  evaluation: 'Verificando disponibilidad',
  confirmed: 'Reserva confirmada',
  preparation: 'Asignando equipos en bodega',
  'in-rental': 'Equipos con el cliente',
  return: 'En revisión de check-in',
  completed: 'Cerrados este mes',
  cancelled: 'No prosperaron',
};

export default function OrderSummaryStats({
  monthlyStats,
  isFiltered = false,
  filterInfo = ''
}: OrderSummaryStatsProps) {

  // Antes había cinco tarjetas fijas nombrando estados legados; tres de ellos
  // (`pending`, `processing`, `on-hold`) dejan de existir después de 0003 y habrían quedado
  // marcando cero para siempre, mientras las cuatro etapas operacionales reales no se contaban.
  // Se muestran solo las tarjetas con pedidos: una fila de ocho ceros no informa nada.
  const statusCards = ORDER_LIST_TABS
    .filter((tab) => tab.value !== 'todos')
    .map((tab) => ({
      title: tab.label,
      value: monthlyStats.byStatus[tab.value as OrderStatus] ?? 0,
      description: STAT_DESCRIPTIONS[tab.value as OrderStatus],
      badgeClass: statusBadgeClass(tab.value),
    }))
    .filter((card) => card.value > 0);

  const stats = [
    {
      title: 'Órdenes Creadas',
      value: monthlyStats.createdOrders,
      description: `Nuevas órdenes del mes`,
      badgeClass: statusBadgeClass('request'),
    },
    ...statusCards,
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Resumen del Mes</h2>
        {isFiltered && (
          <Badge variant="secondary" className="ml-2">
            <Filter className="h-3 w-3 mr-1" />
            Filtrado por {filterInfo}
          </Badge>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              {/* Punto de color del tono del estado, no un icono decorativo: el sistema de
                  diseño reserva el color al lenguaje funcional de estado. */}
              <span className={`h-2.5 w-2.5 rounded-full border ${stat.badgeClass}`} aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value.toLocaleString('es-CL')}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
}
