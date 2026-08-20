import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  ORDER_LIST_TABS,
  statusBadgeClass,
  statusLabel,
  statusesForTab,
  type OrderStatus,
} from '../lib/orderStatus';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from './ui/table';
import {
  Eye,
  User,
  Filter,
  Package,
  AlertTriangle,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  line_items?: any;
}

interface OrderStatusTablesProps {
  /** Un bucket por estado v1.2, tal como lo entrega `DashboardService.getOrdersByStatus`. */
  ordersByStatus: Record<OrderStatus, Order[]>;
  isFiltered?: boolean;
  filterInfo?: string;
}

export default function OrderStatusTables({
  ordersByStatus,
  isFiltered = false,
  filterInfo = ''
}: OrderStatusTablesProps) {
  // Arranca en "Todos", igual que el canónico, que marca ese tab como `active`.
  const [selectedTab, setSelectedTab] = useState<string>('todos');

  /** Los pedidos de un tab. "Todos" concatena en orden de cadena, sin canceladas. */
  const ordersForTab = (tab: string): Order[] =>
    statusesForTab(tab).flatMap((status) => ordersByStatus[status] ?? []);
  // Clave por tab, sin precargar: las claves fijas eran las cuatro legadas, así que cualquier
  // tab nuevo quedaba con `undefined` y el "ver todas" no funcionaba en él.
  const [showAllOrders, setShowAllOrders] = useState<{ [key: string]: boolean }>({});

  // States for conflict checking
  const [conflictsByOrder, setConflictsByOrder] = useState<{ [orderId: number]: any[] }>({});
  const [checkingConflicts, setCheckingConflicts] = useState<{ [key: number]: boolean }>({});

  const checkConflictsForOrder = async (order: Order) => {
    // Solo verificar si tiene fechas, items, no se ha verificado ya y no estamos verificando
    if (!order.order_fecha_inicio || !order.order_fecha_termino || !order.line_items || checkingConflicts[order.id] || conflictsByOrder[order.id]) {
      return;
    }

    try {
      setCheckingConflicts(prev => ({ ...prev, [order.id]: true }));

      let parsedItems = [];
      if (typeof order.line_items === 'string') {
        parsedItems = JSON.parse(order.line_items);
      } else if (Array.isArray(order.line_items)) {
        parsedItems = order.line_items;
      }

      if (parsedItems.length === 0) return;

      const productIds = parsedItems.map((item: any) => Number(item.product_id)).filter((id: number) => !isNaN(id) && id > 0);

      if (productIds.length === 0) return;

      const response = await fetch('/api/orders/check-conflicts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentOrderId: order.id,
          productIds,
          startDate: order.order_fecha_inicio,
          endDate: order.order_fecha_termino
        })
      });

      const result = await response.json();
      if (result.success && result.data && result.data.length > 0) {
        setConflictsByOrder(prev => ({ ...prev, [order.id]: result.data }));
      } else {
        // Marcar como revisado sin conflictos
        setConflictsByOrder(prev => ({ ...prev, [order.id]: [] }));
      }
    } catch (error) {
      console.error('Error checking conflicts for order', order.id, error);
    } finally {
      setCheckingConflicts(prev => ({ ...prev, [order.id]: false }));
    }
  };

  /**
   * Etiqueta y tono de un tab. Reemplaza un `switch` con cuatro estados legados y la paleta de
   * Tailwind (`bg-yellow-50`, `border-orange-200`), colores que no existen en ningún token del
   * sistema de diseño y que además discrepaban de los que usaban las otras cuatro pantallas.
   */
  const getStatusConfig = (tab: string) => ({
    label: ORDER_LIST_TABS.find((t) => t.value === tab)?.label ?? tab,
    badgeClass: statusBadgeClass(tab),
  });

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
    const showAll = showAllOrders[status];
    const displayOrders = showAll ? orders : orders.slice(0, 10);
    const hasMoreOrders = orders.length > 10;

    if (orders.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Package className="h-12 w-12 text-muted-foreground opacity-40 mb-4" />
            <p className="text-muted-foreground">No hay pedidos en {config.label.toLowerCase()}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full border ${config.badgeClass}`}
              aria-hidden="true"
            />
            <CardTitle>{config.label}</CardTitle>
            <Badge className={config.badgeClass}>
              {orders.length}
            </Badge>
          </div>
          <CardDescription>
            Gestión de pedidos en {config.label.toLowerCase()}
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
                {displayOrders.map((order) => {
                  let parsedItems = [];
                  if (order.line_items) {
                    try {
                      parsedItems = typeof order.line_items === 'string'
                        ? JSON.parse(order.line_items)
                        : (Array.isArray(order.line_items) ? order.line_items : []);
                    } catch (e) {
                      console.warn('Error parsing line items for order', order.id);
                    }
                  }

                  const hasItems = parsedItems.length > 0;
                  const orderConflicts = conflictsByOrder[order.id] || [];
                  const hasConflicts = orderConflicts.length > 0;

                  return (
                    <React.Fragment key={order.id}>
                      <TableRow className={hasItems ? "border-b-0" : ""}>
                        <TableCell className="font-medium bg-background/50">
                          #{order.id}
                        </TableCell>
                        <TableCell className="bg-background/50">
                          <div className="flex flex-col">
                            <span className="font-medium">{getCustomerName(order)}</span>
                            <span className="text-sm text-muted-foreground truncate max-w-[150px]" title={getCustomerEmail(order)}>
                              {getCustomerEmail(order)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="bg-background/50">
                          <span className="max-w-[180px] truncate block" title={order.order_proyecto || ''}>
                            {order.order_proyecto || 'Sin proyecto'}
                          </span>
                        </TableCell>
                        <TableCell className="bg-background/50">
                          <div className="flex flex-col gap-1 text-sm">
                            {order.order_fecha_inicio && order.order_fecha_termino ? (
                              <>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-muted-foreground w-10 uppercase tracking-wider">Inicio</span>
                                  <span className="text-green-600 font-medium whitespace-nowrap">{formatDate(order.order_fecha_inicio)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-muted-foreground w-10 uppercase tracking-wider">Fin</span>
                                  <span className="text-red-500 font-medium whitespace-nowrap">{formatDate(order.order_fecha_termino)}</span>
                                </div>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Sin definir</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right bg-background/50">
                          <span className="font-medium whitespace-nowrap">
                            {formatCurrency(order.calculated_total)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right bg-background/50">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="bg-primary/5 hover:bg-primary/10 text-primary h-8 w-8 p-0 ml-auto flex"
                            onClick={() => window.open(`/orders/${order.id}`, '_blank')}
                            title="Ver detalle completo"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Ver orden</span>
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Fila expandible con el acordeon de productos, solo si la orden tiene items */}
                      {hasItems && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30 dark:bg-muted/10 dark:hover:bg-muted/10 border-t-0">
                          <TableCell colSpan={6} className="p-0 border-b">
                            <Accordion
                              type="single"
                              collapsible
                              className="w-full"
                              onValueChange={(value) => {
                                if (value === `item-${order.id}` && !conflictsByOrder[order.id]) {
                                  checkConflictsForOrder(order);
                                }
                              }}
                            >
                              <AccordionItem value={`item-${order.id}`} className="border-none">
                                <AccordionTrigger className="flex justify-between w-full hover:no-underline px-4 py-2 hover:bg-muted/50 transition-colors text-xs font-normal text-muted-foreground [&[data-state=open]>div>svg]:rotate-180">
                                  <div className="flex items-center gap-2">
                                    <Package className="h-3.5 w-3.5" />
                                    <span>{parsedItems.length} producto{parsedItems.length !== 1 ? 's' : ''} en la orden</span>
                                    {hasConflicts && (
                                      <Badge variant="outline" className="ml-2 h-4 px-1.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900 text-[10px]">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        1+ Conflicto
                                      </Badge>
                                    )}
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-0 pb-3 px-4">
                                  <div className="bg-background border rounded-md overflow-hidden shadow-sm mt-1">
                                    <ul className="divide-y text-sm">
                                      {parsedItems.map((item: any, idx: number) => {
                                        const productConflicts = orderConflicts.filter(c =>
                                          c.conflictingProducts.some((p: any) => p.productId === Number(item.product_id))
                                        );
                                        const hasItemConflict = productConflicts.length > 0;

                                        return (
                                          <li key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2">
                                            <div className="flex items-start sm:items-center gap-3">
                                              <div className="h-8 w-8 rounded bg-muted border flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
                                                {item.image ? (
                                                  <img src={item.image} alt="" className="h-full w-full object-cover rounded" />
                                                ) : (
                                                  <Package className="h-4 w-4 text-gray-400" />
                                                )}
                                              </div>
                                              <div>
                                                <p className="font-medium text-[13px] leading-tight flex items-center gap-2">
                                                  {item.name}
                                                  {hasItemConflict && (
                                                    <span className="flex items-center text-[10px] bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900 px-1.5 py-0.5 rounded-full shrink-0">
                                                      <span className="relative flex h-1.5 w-1.5 mr-1">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                                                      </span>
                                                      Conflicto
                                                    </span>
                                                  )}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">Cant: {item.quantity}</p>
                                              </div>
                                            </div>

                                            {hasItemConflict && (
                                              <div className="bg-red-50/80 border border-red-100 dark:bg-red-950/30 dark:border-red-900/50 rounded p-2 sm:max-w-[300px] w-full mt-2 sm:mt-0">
                                                <p className="text-[10px] text-red-800 dark:text-red-400 font-medium flex items-center mb-1">
                                                  <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                                                  Ocupado en otras órdenes:
                                                </p>
                                                <div className="flex flex-col gap-1.5 mt-1">
                                                  {productConflicts.map((c, i) => {
                                                    // Este badge nombra UN pedido en conflicto, no una colección: etiqueta singular.
                                                    return (
                                                      <div key={i} className="flex flex-wrap items-center gap-1.5">
                                                        <a href={`/orders/${c.orderId}`} target="_blank" rel="noreferrer"
                                                          className="text-[10px] text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100 hover:underline leading-tight font-medium">
                                                          Ord. #{c.orderId}
                                                        </a>
                                                        <Badge className={`text-[9px] px-1 py-0 h-4 min-h-0 leading-none uppercase align-middle ${statusBadgeClass(c.status)}`}>
                                                          {statusLabel(c.status)}
                                                        </Badge>
                                                        <span className="text-[10px] text-red-700/80 dark:text-red-300/80 leading-tight">
                                                          ({formatDate(c.startDate)} - {formatDate(c.endDate)})
                                                        </span>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
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
                  : `Ver los ${orders.length} pedidos en ${config.label.toLowerCase()}`
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

      {/* Pestañas verbatim del canónico: `Área 01 · Rental Técnico/OFF/
          MarioHans_OS_Area01_Pedidos_Canonical_RC2.1.2.html`, bloque `#list-tabs`.
          Antes eran tres disparadores sobre cuatro contenidos: `pending` tenía tabla pero ningún
          tab que la abriera, así que era inalcanzable. Y con el vocabulario v1.2 las cuatro
          etapas operacionales reales no tenían dónde mostrarse. */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        {/* Barra de pestañas del canónico: subrayado, sin cápsulas ni grilla. El CSS de origen es
            `.tabs{display:flex;gap:2px;border-bottom:1px solid var(--rule);overflow-x:auto}` y
            `.tab.active{color:var(--ink);border-bottom-color:var(--ink);font-weight:500}`, con el
            contador `.tc` en pastilla monoespaciada que se invierte en la pestaña activa. */}
        <TabsList className="flex h-auto w-full justify-start gap-0.5 overflow-x-auto rounded-none border-b border-[var(--color-border)] bg-transparent p-0">
          {ORDER_LIST_TABS.map((tab) => {
            const count = ordersForTab(tab.value).length;
            const isActive = selectedTab === tab.value;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="-mb-px whitespace-nowrap rounded-none border-b-2 border-transparent bg-transparent px-3 py-[7px] text-xs font-normal text-[var(--color-text-secondary)] shadow-none transition-colors hover:text-[var(--color-text-primary)] data-[state=active]:border-[var(--color-text-primary)] data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-[var(--color-text-primary)] data-[state=active]:shadow-none"
              >
                {tab.label}
                <span
                  className={`ml-[5px] inline-block rounded-[10px] px-[5px] py-px font-mono text-[10px] ${
                    isActive
                      ? 'bg-[var(--color-text-primary)] text-white'
                      : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  {count}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {ORDER_LIST_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {renderOrderTable(ordersForTab(tab.value), tab.value)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
