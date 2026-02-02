import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './ui/table';
import {
  Clock,
  AlertCircle,
  CheckCircle,
  Eye,
  User,
  DollarSign,
  Filter
} from 'lucide-react';

interface Order {
  id: number;
  order_proyecto: string | null;
  date_created: string;
  order_fecha_inicio: string | null;
  order_fecha_termino: string | null;
  calculated_total: number;
  status: string;
  billing_first_name?: string;
  billing_last_name?: string;
  billing_email?: string;
  user_profiles?: {
    nombre?: string;
    apellido?: string;
    email?: string;
  };
}

interface OrdersByStatus {
  onHold: Order[];
  pending: Order[];
  processing: Order[];
  completed: Order[];
}

interface OrderStatusTablesProps {
  ordersByStatus: OrdersByStatus;
  isFiltered?: boolean;
  filterInfo?: string;
}

export default function OrderStatusTables({
  ordersByStatus,
  isFiltered = false,
  filterInfo = ''
}: OrderStatusTablesProps) {
  const [selectedTab, setSelectedTab] = useState('on-hold');
  const [showAllOrders, setShowAllOrders] = useState<{ [key: string]: boolean }>({
    'on-hold': false,
    'pending': false,
    'processing': false,
    'completed': false
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Pendientes',
          icon: Clock,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          badgeVariant: 'secondary' as const
        };
      case 'on-hold':
        return {
          label: 'En Espera',
          icon: AlertCircle,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          badgeVariant: 'destructive' as const
        };

      case 'processing':
        return {
          label: 'Procesando',
          icon: Clock,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          badgeVariant: 'default' as const
        };
      case 'completed':
        return {
          label: 'Completadas',
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          badgeVariant: 'default' as const
        };
      default:
        return {
          label: status,
          icon: Clock,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          badgeVariant: 'outline' as const
        };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Usar métodos UTC para evitar que la zona horaria reste un día
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  const getCustomerName = (order: Order) => {
    if (order.user_profiles?.nombre && order.user_profiles?.apellido) {
      return `${order.user_profiles.nombre} ${order.user_profiles.apellido}`;
    }
    if (order.billing_first_name && order.billing_last_name) {
      return `${order.billing_first_name} ${order.billing_last_name}`;
    }
    return 'Cliente sin nombre';
  };

  const getCustomerEmail = (order: Order) => {
    return order.user_profiles?.email || order.billing_email || 'Sin email';
  };

  const renderOrderTable = (orders: Order[], status: string) => {
    const config = getStatusConfig(status);
    const Icon = config.icon;
    const showAll = showAllOrders[status];
    const displayOrders = showAll ? orders : orders.slice(0, 10);
    const hasMoreOrders = orders.length > 10;

    if (orders.length === 0) {
      return (
        <Card className={`${config.bgColor} ${config.borderColor}`}>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Icon className={`h-12 w-12 ${config.color} mb-4`} />
            <p className="text-muted-foreground">No hay órdenes {config.label.toLowerCase()}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.color}`} />
            <CardTitle>Órdenes {config.label}</CardTitle>
            <Badge variant={config.badgeVariant}>
              {orders.length}
            </Badge>
          </div>
          <CardDescription>
            Gestión de órdenes con estado {config.label.toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">N° Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Inicio - Término</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      #{order.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{getCustomerName(order)}</span>
                        <span className="text-sm text-muted-foreground">
                          {getCustomerEmail(order)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="max-w-[200px] truncate block">
                        {order.order_proyecto || 'Sin proyecto'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm">
                        {order.order_fecha_inicio && order.order_fecha_termino ? (
                          <>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground w-12">Inicio:</span>
                              <span className="text-green-600 font-medium">{formatDate(order.order_fecha_inicio)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground w-12">Término:</span>
                              <span className="text-red-600 font-medium">{formatDate(order.order_fecha_termino)}</span>
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin fechas</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {formatCurrency(order.calculated_total)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/orders/${order.id}`, '_blank')}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {hasMoreOrders && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllOrders(prev => ({
                  ...prev,
                  [status]: !prev[status]
                }))}
              >
                {showAll
                  ? `Mostrar menos (${displayOrders.length} de ${orders.length})`
                  : `Ver todas las ${orders.length} órdenes ${config.label.toLowerCase()}`
                }
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <User className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Estado de Pedidos</h2>
        {isFiltered && (
          <Badge variant="secondary" className="ml-2">
            <Filter className="h-3 w-3 mr-1" />
            Filtrado por {filterInfo}
          </Badge>
        )}
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="on-hold" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            En Espera ({ordersByStatus.onHold.length})
          </TabsTrigger>

          <TabsTrigger value="processing" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Procesando ({ordersByStatus.processing.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Completadas ({ordersByStatus.completed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="on-hold" className="mt-4">
          {renderOrderTable(ordersByStatus.onHold, 'on-hold')}
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          {renderOrderTable(ordersByStatus.pending, 'pending')}
        </TabsContent>

        <TabsContent value="processing" className="mt-4">
          {renderOrderTable(ordersByStatus.processing, 'processing')}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {renderOrderTable(ordersByStatus.completed, 'completed')}
        </TabsContent>
      </Tabs>
    </div>
  );
}
