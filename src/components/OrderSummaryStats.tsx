import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Calendar, CheckCircle, Clock, AlertCircle, Package, Filter } from 'lucide-react';

interface MonthlyStats {
  totalOrders: number;
  completedOrders: number;
  createdOrders: number;
  pendingOrders: number;
  processingOrders: number;
  onHoldOrders: number;
}

interface OrderSummaryStatsProps {
  monthlyStats: MonthlyStats;
  isFiltered?: boolean;
  filterInfo?: string;
}

export default function OrderSummaryStats({ 
  monthlyStats, 
  isFiltered = false, 
  filterInfo = '' 
}: OrderSummaryStatsProps) {


  const stats = [
    {
      title: 'Órdenes Creadas',
      value: monthlyStats.createdOrders,
      description: `Nuevas órdenes del mes`,
      icon: Package,
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    {
      title: 'Órdenes Completadas',
      value: monthlyStats.completedOrders,
      description: 'Órdenes finalizadas este mes',
      icon: CheckCircle,
      color: 'bg-green-500',
      textColor: 'text-green-600'
    },
    {
      title: 'Órdenes Pendientes',
      value: monthlyStats.pendingOrders,
      description: 'Esperando procesamiento',
      icon: Clock,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600'
    },
    {
      title: 'Órdenes Procesando',
      value: monthlyStats.processingOrders,
      description: 'En proceso activo',
      icon: Clock,
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    {
      title: 'Órdenes En Espera',
      value: monthlyStats.onHoldOrders,
      description: 'Retenidas temporalmente',
      icon: AlertCircle,
      color: 'bg-orange-500',
      textColor: 'text-orange-600'
    }
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-full ${stat.color} bg-opacity-10`}>
                  <Icon className={`h-4 w-4 ${stat.textColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
              {/* Decorative element */}
              <div className={`absolute top-0 right-0 w-20 h-20 ${stat.color} opacity-5 rounded-full -mr-10 -mt-10`}></div>
            </Card>
          );
        })}
      </div>

    </div>
  );
}
