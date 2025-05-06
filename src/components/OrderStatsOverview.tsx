import React from 'react';
import { 
  Card, 
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription
} from './ui/card';
import { cn } from "@/lib/utils";
import { Separator } from './ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

// Define the types for our component props
interface Order {
  id: number;
  status: string;
  metadata: {
    calculated_total: string;
    calculated_subtotal: string;
    calculated_iva: string;
  };
  wordpress_data?: {
    pago_completo: boolean;
  };
}

interface OrderStatsOverviewProps {
  orders: Order[];
  totalOrders: string;
}

// Define interfaces for our stats data
interface OrderStat {
  title: string;
  value: string | number;
  description?: string;
  textColor?: string;
  bgColor?: string;
  icon?: React.ReactNode;
}

// Define an interface for the orderStats object
interface OrderStatsData {
  total: number;
  completed: number;
  processing: number;
  pending: number;
  on_hold: number;
  cancelled: number;
  pagados: number;
  totalSales: number;
  totalSubtotal: number;
  totalIva: number;
  totalPagado: number;
  totalAbonos: number;
  totalPendiente: number;
  porcentajePagados: number;
}

const OrderStatsOverview: React.FC<OrderStatsOverviewProps> = ({ orders, totalOrders }): React.ReactNode => {
  // Crear una función para formatear montos
  const formatMoney = (amount: number): string => {
    return `$${amount.toLocaleString('es-CL')}`;
  };

  // Crear una función para formatear porcentajes
  const formatPercentage = (percentage: number): string => {
    return `${Math.round(percentage)}%`;
  };

  // Calculate stats
  const orderStats: OrderStatsData = {
    total: parseInt(totalOrders || "0"),
    completed: orders.filter(order => order.status === 'completed').length,
    processing: orders.filter(order => order.status === 'processing').length,
    pending: orders.filter(order => order.status === 'pending').length,
    on_hold: orders.filter(order => order.status === 'on-hold').length,
    cancelled: orders.filter(order => ['cancelled', 'failed', 'refunded'].includes(order.status)).length,
    pagados: orders.filter(order => order.wordpress_data?.pago_completo !== false).length,
    
    // Totales monetarios
    totalSales: orders.reduce((sum: number, order) => {
      const total = parseInt(order.metadata.calculated_total) || 0;
      return sum + total;
    }, 0),
    
    // Subtotal (antes de impuestos)
    totalSubtotal: orders.reduce((sum: number, order) => {
      const subtotal = parseInt(order.metadata.calculated_subtotal) || 0;
      return sum + subtotal;
    }, 0),
    
    // Total IVA
    totalIva: orders.reduce((sum: number, order) => {
      const iva = parseInt(order.metadata.calculated_iva) || 0;
      return sum + iva;
    }, 0),
    
    // Monto total de pedidos pagados completamente
    totalPagado: orders.reduce((sum: number, order) => {
      if (order.wordpress_data?.pago_completo !== false) {
        const total = parseInt(order.metadata.calculated_total) || 0;
        return sum + total;
      }
      return sum;
    }, 0),
    
    // Monto de abonos (25% del subtotal) de pedidos completados pero no pagados totalmente
    totalAbonos: orders.reduce((sum: number, order) => {
      if (order.status === 'completed' && !order.wordpress_data?.pago_completo) {
        const subtotal = parseInt(order.metadata.calculated_subtotal) || 0;
        const abono = subtotal * 0.25; // 25% del subtotal
        return sum + abono;
      }
      return sum;
    }, 0),
    
    // Monto pendiente total (considerando abonos realizados)
    totalPendiente: orders.reduce((sum: number, order) => {
      const total = parseInt(order.metadata.calculated_total) || 0;
      if (order.wordpress_data?.pago_completo) {
        return sum; // Si está pagado completamente, no hay pendiente
      } else if (order.status === 'completed') {
        // Si está completado pero no pagado totalmente, restar el abono del 25%
        const subtotal = parseInt(order.metadata.calculated_subtotal) || 0;
        const abono = subtotal * 0.25;
        return sum + (total - abono);
      } else {
        return sum + total; // Si no está completado ni pagado, todo está pendiente
      }
    }, 0),
    
    // Calcular el porcentaje de pedidos pagados
    porcentajePagados: orders.length > 0 
      ? (orders.filter(order => order.wordpress_data?.pago_completo !== false ).length / orders.length) * 100 
      : 0
  };

  // Calcular el porcentaje de monto cobrado vs total
  const porcentajeMontoRecaudado = (): number => {
    const totalVentas = orders.reduce((sum: number, order) => sum + (parseInt(order.metadata.calculated_total) || 0), 0);
    if (totalVentas === 0) return 0;
    
    const montoRecaudado = orders.reduce((sum: number, order) => {
      if (order.wordpress_data?.pago_completo) {
        return sum + (parseInt(order.metadata.calculated_total) || 0);
      } else if (order.status === 'completed') {
        const subtotal = parseInt(order.metadata.calculated_subtotal) || 0;
        return sum + (subtotal * 0.25); // Abono del 25%
      }
      return sum;
    }, 0);
    
    return (montoRecaudado / totalVentas) * 100;
  };

  // Create stats groups 
  const orderStatusStats: OrderStat[] = [
    {
      title: "Total Pedidos",
      value: orderStats.total,
      description: "Número total de pedidos"
    },
    {
      title: "Completados",
      value: orderStats.completed,
      description: `${formatPercentage(orderStats.completed/orderStats.total*100)} del total`,
      textColor: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "En Proceso",
      value: orderStats.processing,
      description: `${formatPercentage(orderStats.processing/orderStats.total*100)} del total`,
      textColor: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Pedidos Pagados",
      value: orderStats.pagados,
      description: `${formatPercentage(orderStats.porcentajePagados)} del total`,
      textColor: "text-emerald-600",
      bgColor: "bg-emerald-50"
    }
  ];

  const financialStats: OrderStat[] = [
    {
      title: "Total Ventas",
      value: formatMoney(orderStats.totalSales),
      description: "Monto total de todos los pedidos"
    },
    {
      title: "Total Pagado",
      value: formatMoney(orderStats.totalPagado),
      description: `${formatPercentage(orderStats.totalPagado/orderStats.totalSales*100)} del total`,
      textColor: "text-emerald-600",
      bgColor: "bg-emerald-50"
    },
    {
      title: "Total Abonos",
      value: formatMoney(Math.round(orderStats.totalAbonos)),
      description: "25% de pedidos completados",
      textColor: "text-yellow-600",
      bgColor: "bg-yellow-50"
    },
    {
      title: "Total Pendiente",
      value: formatMoney(Math.round(orderStats.totalPendiente)),
      description: `${formatPercentage(orderStats.totalPendiente/orderStats.totalSales*100)} del total`,
      textColor: "text-red-600",
      bgColor: "bg-red-50"
    }
  ];

  const fiscalStats: OrderStat[] = [
    {
      title: "Subtotal Ventas",
      value: formatMoney(orderStats.totalSubtotal),
      description: "Total antes de impuestos",
      textColor: "text-slate-700",
      bgColor: "bg-slate-50"
    },
    {
      title: "IVA Total",
      value: formatMoney(orderStats.totalIva),
      description: `${formatPercentage(orderStats.totalIva/orderStats.totalSubtotal*100)} del subtotal (${orders.filter(order => order.metadata.calculated_iva !== '0').length} órdenes)`,
      textColor: "text-indigo-600",
      bgColor: "bg-indigo-50"
    },
    {
      title: "Total con IVA",
      value: formatMoney(orderStats.totalSales),
      description: `Subtotal + IVA`,
      textColor: "text-violet-600",
      bgColor: "bg-violet-50"
    },
    {
      title: "Promedio por Orden",
      value: formatMoney(orders.length > 0 ? Math.round(orderStats.totalSales / orders.length) : 0),
      description: `Monto promedio por pedido`,
      textColor: "text-blue-600",
      bgColor: "bg-blue-50"
    }
  ];

  return (
    <div className="space-y-2">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="estado-pedidos">
          <AccordionTrigger className="text-base font-semibold py-2">Estado de Pedidos</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
              {orderStatusStats.map((stat, index) => (
                <Card 
                  key={index} 
                  className={cn(
                    "shadow-sm hover:shadow-md transition-shadow duration-200",
                    stat.bgColor
                  )}
                >
                  <CardHeader className="py-1 px-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-1 px-2">
                    <p className={cn("text-xl md:text-2xl font-bold", stat.textColor)}>
                      {stat.value}
                    </p>
                    {stat.description && (
                      <p className="text-[10px] text-muted-foreground">
                        {stat.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="resumen-financiero">
          <AccordionTrigger className="text-base font-semibold py-2">Resumen Financiero</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
              {financialStats.map((stat, index) => (
                <Card 
                  key={index} 
                  className={cn(
                    "shadow-sm hover:shadow-md transition-shadow duration-200",
                    stat.bgColor
                  )}
                >
                  <CardHeader className="py-1 px-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-1 px-2">
                    <p className={cn("text-lg md:text-xl font-bold", stat.textColor)}>
                      {stat.value}
                    </p>
                    {stat.description && (
                      <p className="text-[10px] text-muted-foreground">
                        {stat.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="detalles-fiscales">
          <AccordionTrigger className="text-base font-semibold py-2">Detalles Fiscales</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
              {fiscalStats.map((stat, index) => (
                <Card 
                  key={index} 
                  className={cn(
                    "shadow-sm hover:shadow-md transition-shadow duration-200",
                    stat.bgColor
                  )}
                >
                  <CardHeader className="py-1 px-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-1 px-2">
                    <p className={cn("text-lg md:text-xl font-bold", stat.textColor)}>
                      {stat.value}
                    </p>
                    {stat.description && (
                      <p className="text-[10px] text-muted-foreground">
                        {stat.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default OrderStatsOverview;