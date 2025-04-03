import React from 'react';
import { 
  Card, 
  CardContent,
} from './ui/card';
import { cn } from "@/lib/utils";
import type { Order } from '@/types/order';

// Define the types for our component props
interface OrderStatsOverviewProps {
  orders: Order[];
  totalOrders: string;
}

// Define interfaces for our stats data
interface OrderStat {
  title: string;
  value: string | number;
  textColor?: string;
  icon?: React.ReactNode;
}

const OrderStatsOverview: React.FC<OrderStatsOverviewProps> = ({ orders, totalOrders }) => {
  // Calculate stats
  const orderStats = {
    total: parseInt(totalOrders || "0"),
    completed: orders.filter(order => order.status === 'completed').length,
    processing: orders.filter(order => order.status === 'processing').length,
    pending: orders.filter(order => order.status === 'pending').length,
    on_hold: orders.filter(order => order.status === 'on-hold').length,
    cancelled: orders.filter(order => ['cancelled', 'failed', 'refunded'].includes(order.status)).length,
    totalSales: orders.reduce((sum, order) => sum + (parseInt(order.metadata.calculated_total) || 0), 0),
  };

  // Create an array of stat cards to render
  const stats: OrderStat[] = [
    {
      title: "Total Pedidos",
      value: orderStats.total,
    },
    {
      title: "Completados",
      value: orderStats.completed,
      textColor: "text-green-600",
    },
    {
      title: "En Proceso",
      value: orderStats.processing,
      textColor: "text-blue-600",
    },
    {
      title: "En Espera",
      value: orderStats.on_hold,
      textColor: "text-yellow-600",
    },
    {
      title: "Ventas Totales",
      value: `$${orderStats.totalSales.toLocaleString('es-CL')}`,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {stats.map((stat, index) => (
        <Card key={index} className="shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardContent className="pt-4 pb-3 px-3 sm:px-6">
            <div className="flex flex-col">
              <h3 className="text-sm font-medium text-muted-foreground">{stat.title}</h3>
              <p className={cn("text-2xl font-bold mt-1", stat.textColor)}>{stat.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default OrderStatsOverview; 