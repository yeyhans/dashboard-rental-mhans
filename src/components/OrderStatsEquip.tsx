import React, { useState, useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from './ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { ScrollArea } from './ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { cn } from "@/lib/utils";

// Usar tipo any para evitar problemas de tipado con Astro
type OrderStatsEquipProps = {
  orders: any[];
  totalOrders?: string;
  users?: any[];
}

// Función auxiliar para parsear fechas en formato DD-MM-YYYY
const parseDate = (dateStr: any): Date | null => {
  if (!dateStr) return null;
  
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Meses son 0-indexados en JS
    const year = parseInt(parts[2], 10);
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    
    return new Date(year, month, day);
  } catch (error) {
    return null;
  }
};

const OrderStatsEquip: React.FC<OrderStatsEquipProps> = ({ orders }) => {
  const [selectedTab, setSelectedTab] = useState<string>("popular");
  
  // Extraer todos los equipos de los pedidos
  const equipmentData = useMemo(() => {
    // Mapa para agrupar por ID de producto
    const equipmentMap = new Map();
    
    // Procesar todos los pedidos
    orders.forEach(order => {
      if (!order.line_items) return;
      
      // Solo considerar pedidos completados o en proceso
      if (!['completed', 'processing'].includes(order.status)) return;
      
      const metadata = order.metadata || {};
      const days = parseInt(metadata.num_jornadas || '1', 10);
      
      order.line_items.forEach(item => {
        // Obtener o crear entrada en el mapa
        const existing = equipmentMap.get(item.product_id) || {
          id: item.product_id,
          name: item.name,
          sku: item.sku || '',
          rentCount: 0,
          totalRevenue: 0,
          totalDays: 0,
          image: item.image || '',
          orders: []
        };
        
        // Actualizar datos
        existing.rentCount += item.quantity;
        existing.totalRevenue += item.price * item.quantity;
        existing.totalDays += days * item.quantity;
        
        // Añadir detalle del pedido
        existing.orders.push({
          orderId: order.id,
          startDate: metadata.order_fecha_inicio || '',
          endDate: metadata.order_fecha_termino || '',
          days,
          price: item.price,
          quantity: item.quantity
        });
        
        equipmentMap.set(item.product_id, existing);
      });
    });
    
    // Convertir mapa a array
    return Array.from(equipmentMap.values());
  }, [orders]);
  
  // Encontrar equipos populares (más arrendados)
  const popularEquipment = useMemo(() => {
    return [...equipmentData].sort((a, b) => b.rentCount - a.rentCount).slice(0, 10);
  }, [equipmentData]);
  
  // Encontrar equipos con mayor ingresos
  const highestRevenueEquipment = useMemo(() => {
    return [...equipmentData].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
  }, [equipmentData]);
  
  // Encontrar equipos con más días de arriendo
  const longestRentedEquipment = useMemo(() => {
    return [...equipmentData].sort((a, b) => b.totalDays - a.totalDays).slice(0, 10);
  }, [equipmentData]);
  
  // Función para formatear montos en pesos chilenos
  const formatMoney = (amount: number): string => {
    return `$${amount.toLocaleString('es-CL')}`;
  };

  // Los equipos actualmente arrendados (comparando la fecha actual con las fechas de término)
  const currentlyRentedEquipment = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const rentedItems: any[] = [];
    
    orders.forEach(order => {
      // Solo considerar pedidos completados o en proceso
      if (!['completed', 'processing'].includes(order.status)) return;
      
      const metadata = order.metadata || {};
      
      // Obtener fecha de término
      const endDate = parseDate(metadata.order_fecha_termino);
      const startDate = parseDate(metadata.order_fecha_inicio);
      
      if (!endDate || !startDate) return;
      
      // Si la fecha de hoy está entre inicio y término, está arrendado actualmente
      if (today >= startDate && today <= endDate) {
        order.line_items.forEach(item => {
          const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          rentedItems.push({
            id: item.product_id,
            name: item.name,
            image: item.image || '',
            sku: item.sku || '',
            orderId: order.id,
            startDate: metadata.order_fecha_inicio || '',
            endDate: metadata.order_fecha_termino || '',
            returnDate: endDate,
            daysLeft
          });
        });
      }
    });
    
    return rentedItems;
  }, [orders]);
  
  // Equipos con devolución hoy
  const returningTodayEquipment = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const returningItems: any[] = [];
    
    orders.forEach(order => {
      // Solo considerar pedidos completados o en proceso
      if (!['completed', 'processing'].includes(order.status)) return;
      
      const metadata = order.metadata || {};
      
      // Obtener fecha de término
      const endDate = parseDate(metadata.order_fecha_termino);
      
      if (!endDate) return;
      
      // Si la fecha de término es hoy, se devuelve hoy
      if (
        endDate.getDate() === today.getDate() &&
        endDate.getMonth() === today.getMonth() &&
        endDate.getFullYear() === today.getFullYear()
      ) {
        order.line_items.forEach(item => {
          returningItems.push({
            id: item.product_id,
            name: item.name,
            image: item.image || '',
            sku: item.sku || '',
            orderId: order.id
          });
        });
      }
    });
    
    return returningItems;
  }, [orders]);
  
  return (
    <div className="space-y-3">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="equipos-estadisticas">
          <AccordionTrigger className="text-base font-semibold py-2">
            Estadísticas de Equipos
          </AccordionTrigger>
          <AccordionContent>
            <Tabs defaultValue="popular" className="w-full" onValueChange={setSelectedTab}>
              <TabsList className="mb-2 w-full grid grid-cols-3">
                <TabsTrigger value="popular" className="text-[10px] sm:text-xs">
                  Más Populares
                </TabsTrigger>
                <TabsTrigger value="revenue" className="text-[10px] sm:text-xs">
                  Mayor Ingreso
                </TabsTrigger>
                <TabsTrigger value="days" className="text-[10px] sm:text-xs">
                  Más Días
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="popular">
                <Card>
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm">Equipos más arrendados</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-3">
                    <ScrollArea className="w-full overflow-auto max-h-60">
                      <div className="min-w-[300px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">Equipo</TableHead>
                              <TableHead className="text-[10px] text-right">Arriendos</TableHead>
                              <TableHead className="text-[10px] text-right">Ingresos</TableHead>
                              <TableHead className="text-[10px] text-right">Días</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {popularEquipment.map((equip) => (
                              <TableRow key={equip.id}>
                                <TableCell className="py-1">
                                  <div className="flex items-center gap-1">
                                    {equip.image && (
                                      <img 
                                        src={equip.image} 
                                        alt={equip.name} 
                                        className="w-8 h-8 object-cover rounded-md"
                                      />
                                    )}
                                    <div>
                                      <div className="text-[10px] truncate max-w-[180px]">{equip.name}</div>
                                      {equip.sku && (
                                        <div className="text-[9px] text-muted-foreground">SKU: {equip.sku}</div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-[10px] text-right font-medium">{equip.rentCount}</TableCell>
                                <TableCell className="text-[10px] text-right">{formatMoney(equip.totalRevenue)}</TableCell>
                                <TableCell className="text-[10px] text-right">{equip.totalDays}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="revenue">
                <Card>
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm">Equipos con mayores ingresos</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-3">
                    <ScrollArea className="w-full overflow-auto max-h-60">
                      <div className="min-w-[300px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">Equipo</TableHead>
                              <TableHead className="text-[10px] text-right">Ingresos</TableHead>
                              <TableHead className="text-[10px] text-right">Arriendos</TableHead>
                              <TableHead className="text-[10px] text-right">Días</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {highestRevenueEquipment.map((equip) => (
                              <TableRow key={equip.id}>
                                <TableCell className="py-1">
                                  <div className="flex items-center gap-1">
                                    {equip.image && (
                                      <img 
                                        src={equip.image} 
                                        alt={equip.name} 
                                        className="w-8 h-8 object-cover rounded-md"
                                      />
                                    )}
                                    <div>
                                      <div className="text-[10px] truncate max-w-[180px]">{equip.name}</div>
                                      {equip.sku && (
                                        <div className="text-[9px] text-muted-foreground">SKU: {equip.sku}</div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-[10px] text-right font-medium">{formatMoney(equip.totalRevenue)}</TableCell>
                                <TableCell className="text-[10px] text-right">{equip.rentCount}</TableCell>
                                <TableCell className="text-[10px] text-right">{equip.totalDays}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="days">
                <Card>
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm">Equipos con más días de arriendo</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-3">
                    <ScrollArea className="w-full overflow-auto max-h-60">
                      <div className="min-w-[300px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">Equipo</TableHead>
                              <TableHead className="text-[10px] text-right">Días</TableHead>
                              <TableHead className="text-[10px] text-right">Arriendos</TableHead>
                              <TableHead className="text-[10px] text-right">Ingresos</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {longestRentedEquipment.map((equip) => (
                              <TableRow key={equip.id}>
                                <TableCell className="py-1">
                                  <div className="flex items-center gap-1">
                                    {equip.image && (
                                      <img 
                                        src={equip.image} 
                                        alt={equip.name} 
                                        className="w-8 h-8 object-cover rounded-md"
                                      />
                                    )}
                                    <div>
                                      <div className="text-[10px] truncate max-w-[180px]">{equip.name}</div>
                                      {equip.sku && (
                                        <div className="text-[9px] text-muted-foreground">SKU: {equip.sku}</div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-[10px] text-right font-medium">{equip.totalDays}</TableCell>
                                <TableCell className="text-[10px] text-right">{equip.rentCount}</TableCell>
                                <TableCell className="text-[10px] text-right">{formatMoney(equip.totalRevenue)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="equipos-arrendados">
          <AccordionTrigger className="text-base font-semibold py-2">
            Equipos Actualmente Arrendados
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardContent className="py-2 px-3">
                {currentlyRentedEquipment.length > 0 ? (
                  <ScrollArea className="w-full overflow-auto max-h-60">
                    <div className="min-w-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Equipo</TableHead>
                            <TableHead className="text-[10px] text-center">Devolver en</TableHead>
                            <TableHead className="text-[10px] text-right">Pedido</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentlyRentedEquipment.map((equip, index) => (
                            <TableRow key={`${equip.id}-${index}`}>
                              <TableCell className="py-1">
                                <div className="flex items-center gap-1">
                                  {equip.image && (
                                    <img 
                                      src={equip.image} 
                                      alt={equip.name} 
                                      className="w-8 h-8 object-cover rounded-md"
                                    />
                                  )}
                                  <div>
                                    <div className="text-[10px] truncate max-w-[180px]">{equip.name}</div>
                                    {equip.sku && (
                                      <div className="text-[9px] text-muted-foreground">SKU: {equip.sku}</div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge 
                                  className={cn(
                                    "text-[10px]",
                                    equip.daysLeft === 0 
                                      ? "bg-red-100 text-red-800 hover:bg-red-100 hover:text-red-800" 
                                      : equip.daysLeft === 1
                                        ? "bg-amber-100 text-amber-800 hover:bg-amber-100 hover:text-amber-800"
                                        : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-800"
                                  )}
                                >
                                  {equip.daysLeft === 0 
                                    ? "Hoy" 
                                    : equip.daysLeft === 1 
                                      ? "1 día" 
                                      : `${equip.daysLeft} días`}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-[10px] text-right">
                                <a 
                                  href={`/orders/${equip.orderId}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  #{equip.orderId}
                                </a>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-[10px] text-muted-foreground text-center py-3">
                    No hay equipos arrendados actualmente
                  </p>
                )}
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="devoluciones-hoy">
          <AccordionTrigger className="text-base font-semibold py-2">
            Devoluciones de Hoy ({returningTodayEquipment.length})
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardContent className="py-2 px-3">
                {returningTodayEquipment.length > 0 ? (
                  <ScrollArea className="w-full overflow-auto max-h-60">
                    <div className="min-w-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Equipo</TableHead>
                            <TableHead className="text-[10px] text-right">Pedido</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {returningTodayEquipment.map((equip, index) => (
                            <TableRow key={`${equip.id}-${index}`}>
                              <TableCell className="py-1">
                                <div className="flex items-center gap-1">
                                  {equip.image && (
                                    <img 
                                      src={equip.image} 
                                      alt={equip.name} 
                                      className="w-8 h-8 object-cover rounded-md"
                                    />
                                  )}
                                  <div>
                                    <div className="text-[10px] truncate max-w-[180px]">{equip.name}</div>
                                    {equip.sku && (
                                      <div className="text-[9px] text-muted-foreground">SKU: {equip.sku}</div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-[10px] text-right">
                                <a 
                                  href={`/orders/${equip.orderId}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  #{equip.orderId}
                                </a>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-[10px] text-muted-foreground text-center py-3">
                    No hay devoluciones programadas para hoy
                  </p>
                )}
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default OrderStatsEquip;