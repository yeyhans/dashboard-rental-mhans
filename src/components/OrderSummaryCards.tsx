import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from './ui/card';
import { ChartLegend } from './ui/chart';
import { ChartContainer } from './ui/chart';
import { ChartTooltip } from './ui/chart';
import * as Recharts from 'recharts';
import { ChartTooltipContent } from './ui/chart';
import { ChartLegendContent } from './ui/chart';
import { DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Dialog } from './ui/dialog';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

// Helper function to format dates
const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Status color mapping
const statusColors: Record<string, string> = {
  'completed': 'bg-green-100 text-green-800',
  'processing': 'bg-blue-100 text-blue-800',
  'pending': 'bg-yellow-100 text-yellow-800',
  'cancelled': 'bg-red-100 text-red-800',
  'failed': 'bg-red-100 text-red-800',
  'refunded': 'bg-purple-100 text-purple-800'
};

type Order = {
  id?: string;
  status: string;
  date_created?: string;
  customer_id?: number;
  billing?: {
    first_name?: string;
    last_name?: string;
    company?: string;
    email?: string;
  };
  metadata: {
    calculated_total: string;
    order_proyecto?: string;
    order_fecha_inicio?: string;
    order_fecha_termino?: string;
    calculated_subtotal?: string;
    calculated_discount?: string;
    calculated_iva?: string;
    num_jornadas?: string;
  };
  line_items?: Array<{
    name: string;
    product_id: number;
    price: number;
    quantity: number;
    image?: string;
  }>;
};

type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  rut: string;
  billing_phone: string;
  instagram: string;
  billing_company: string;
  company_rut: string;
  customer_type: string;
};

interface OrderSummaryCardsProps {
  orders: Order[];
  totalOrders: string;
  users: User[];
}

const OrderSummaryCards = ({ orders, totalOrders, users }: OrderSummaryCardsProps) => {
  // Find user by customer_id
  const findUserById = (customerId?: number) => {
    if (!customerId || !users) return null;
    return users.find(user => user.id === customerId);
  };
  
  // Calculate totals and metrics
  const totalSales = orders.reduce((sum, order) => {
    return sum + (parseFloat(order.metadata.calculated_total) || 0);
  }, 0);

  // Calculate averages and percentages
  const averageOrderValue = orders.length > 0 ? totalSales / orders.length : 0;
  const completionRate = orders.length > 0 
    ? (orders.filter(order => order.status === 'completed').length / orders.length) * 100 
    : 0;

  // Count orders by status
  const countByStatus = {
    processing: orders.filter(order => order.status === 'processing').length,
    completed: orders.filter(order => order.status === 'completed').length,
    pending: orders.filter(order => order.status === 'pending').length,
    cancelled: orders.filter(order => ['cancelled', 'failed', 'refunded'].includes(order.status)).length
  };

  // Filter orders for current week deliveries and returns
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + (6 - now.getDay())); // Saturday
  endOfWeek.setHours(23, 59, 59, 999);

  // Parse date from format DD-MM-YYYY
  const parseDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    
    // Make sure we have strings before parsing
    const dayStr = parts[0] || '';
    const monthStr = parts[1] || '';
    const yearStr = parts[2] || '';
    
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10) - 1; // Months are 0-indexed in JS
    const year = parseInt(yearStr, 10);
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    
    return new Date(year, month, day);
  };

  const weeklyDeliveries = orders.filter(order => {
    const deliveryDate = parseDate(order.metadata.order_fecha_inicio || '');
    return deliveryDate && deliveryDate >= startOfWeek && deliveryDate <= endOfWeek;
  });

  const weeklyReturns = orders.filter(order => {
    const returnDate = parseDate(order.metadata.order_fecha_termino || '');
    return returnDate && returnDate >= startOfWeek && returnDate <= endOfWeek;
  });

  return (
    <div className="space-y-6">
      {/* Main Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200">
          <CardContent className="pt-6 pb-4">
            <div className="flex flex-col">
              <div className="flex justify-between items-baseline">
                <p className="text-sm font-medium text-muted-foreground">Total Pedidos</p>
                <p className="text-2xl font-bold text-primary">{totalOrders}</p>
              </div>
              <div className="flex justify-between items-baseline mt-4">
                <p className="text-sm font-medium text-muted-foreground">Ventas Totales</p>
                <p className="text-2xl font-bold text-primary">${totalSales.toLocaleString('es-CL')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200">
          <CardContent className="pt-6 pb-4">
            <div className="flex flex-col">
              <div className="flex justify-between items-baseline">
                <p className="text-sm font-medium text-muted-foreground">Valor Promedio</p>
                <p className="text-2xl font-bold text-primary">${averageOrderValue.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="flex justify-between items-baseline mt-4">
                <p className="text-sm font-medium text-muted-foreground">Tasa Completados</p>
                <p className="text-2xl font-bold text-primary">{completionRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200 col-span-2">
          <CardContent className="pt-6 pb-4">
            <ChartContainer
              config={{
                completed: {
                  label: "Completados",
                  theme: {
                    light: "#22c55e",
                    dark: "#4ade80"
                  }
                },
                processing: {
                  label: "En Proceso", 
                  theme: {
                    light: "#3b82f6",
                    dark: "#60a5fa"
                  }
                },
                pending: {
                  label: "Pendientes",
                  theme: {
                    light: "#eab308", 
                    dark: "#facc15"
                  }
                },
                cancelled: {
                  label: "Cancelados",
                  theme: {
                    light: "#ef4444",
                    dark: "#f87171"
                  }
                }
              }}
            >
              <Recharts.PieChart>
                <Recharts.Pie
                  data={[
                    { name: 'completed', value: countByStatus.completed },
                    { name: 'processing', value: countByStatus.processing },
                    { name: 'pending', value: countByStatus.pending },
                    { name: 'cancelled', value: countByStatus.cancelled }
                  ]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
              </Recharts.PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>


      {/* Weekly Deliveries and Returns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Deliveries this week */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-md">Entregas de esta semana</CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyDeliveries.length > 0 ? (
              <div className="space-y-3">
                {weeklyDeliveries.map((order, index) => {
                  const user = findUserById(order.customer_id);
                  return (
                  <Dialog key={index}>
                    <DialogTrigger asChild>
                      <div className="border rounded-md p-3 cursor-pointer hover:bg-accent">
                        <div className="flex justify-between items-start">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            order.status === 'completed' ? 'bg-green-100 text-green-800' :
                            order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {order.status}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground">
                            Entrega: {order.metadata.order_fecha_inicio}
                          </span>
                        </div>
                        <p className="font-semibold text-sm mt-1">{order.metadata.order_proyecto || 'Sin proyecto'}</p>
                        <p className="text-sm truncate">
                          {user ? (user.customer_type === 'empresa' ? user.billing_company : `${user.first_name} ${user.last_name}`) : 
                                 (order.billing?.company || `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`)}
                        </p>
                        {user && user.instagram && (
                          <p className="text-xs text-muted-foreground mt-1">{user.instagram}</p>
                        )}
                      </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-foreground">Detalles del Pedido</DialogTitle>
                        <DialogDescription>
                          Información completa del pedido realizado el {formatDate(order.date_created || '')}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-6 py-4">
                        {/* Estado y Fechas */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label className="text-foreground">Estado</Label>
                            <div className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                              {order.status}
                            </div>
                          </div>
                          <div>
                            <Label className="text-foreground">Fecha de Inicio</Label>
                            <div className="mt-1 text-foreground">{order.metadata.order_fecha_inicio}</div>
                          </div>
                          <div>
                            <Label className="text-foreground">Fecha de Término</Label>
                            <div className="mt-1 text-foreground">{order.metadata.order_fecha_termino}</div>
                          </div>
                        </div>

                        {/* Información del Cliente */}
                        <div>
                          <h4 className="text-sm font-medium mb-2 text-foreground">Información del Cliente</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg">
                            <div>
                              <Label className="text-foreground">Nombre</Label>
                              <div className="mt-1 text-foreground">
                                {user ? `${user.first_name} ${user.last_name}` : 
                                       `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`}
                              </div>
                            </div>
                            <div>
                              <Label className="text-foreground">Empresa</Label>
                              <div className="mt-1 text-foreground">
                                {user ? user.billing_company || '-' : order.billing?.company || '-'}
                              </div>
                            </div>
                            <div>
                              <Label className="text-foreground">Email</Label>
                              <div className="mt-1 text-foreground">
                                {user ? user.email : order.billing?.email || ''}
                              </div>
                            </div>
                            {user && user.rut && (
                              <div>
                                <Label className="text-foreground">RUT</Label>
                                <div className="mt-1 text-foreground">{user.rut}</div>
                              </div>
                            )}
                            {user && user.billing_phone && (
                              <div>
                                <Label className="text-foreground">Teléfono</Label>
                                <div className="mt-1 text-foreground">{user.billing_phone}</div>
                              </div>
                            )}
                            {user && user.instagram && (
                              <div>
                                <Label className="text-foreground">Instagram</Label>
                                <div className="mt-1 text-foreground">{user.instagram}</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Productos */}
                        {order.line_items && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 text-foreground">Productos</h4>
                            <div className="bg-card p-4 rounded-lg">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-foreground w-16">Imagen</TableHead>
                                    <TableHead className="text-foreground">Producto</TableHead>
                                    <TableHead className="text-foreground">Cantidad</TableHead>
                                    <TableHead className="text-foreground">Precio</TableHead>
                                    <TableHead className="text-foreground">Total</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {order.line_items.map((item, index) => (
                                    <TableRow key={index}>
                                      <TableCell className="text-foreground">
                                        {item.image && (
                                          <img 
                                            src={item.image} 
                                            alt={item.name} 
                                            className="w-12 h-12 object-cover rounded-md"
                                          />
                                        )}
                                      </TableCell>
                                      <TableCell className="text-foreground">{item.name}</TableCell>
                                      <TableCell className="text-foreground">{item.quantity}</TableCell>
                                      <TableCell className="text-foreground">${item.price.toLocaleString('es-CL')}</TableCell>
                                      <TableCell className="text-foreground">${(item.price * item.quantity).toLocaleString('es-CL')}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}

                        {/* Detalles adicionales */}
                        <div>
                          <h4 className="text-sm font-medium mb-2 text-foreground">Detalles del proyecto</h4>
                          <div className="bg-card p-4 rounded-lg space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-foreground">Proyecto</Label>
                                <div className="mt-1 text-foreground font-semibold">{order.metadata.order_proyecto || 'Sin nombre'}</div>
                              </div>
                              <div>
                                <Label className="text-foreground">Número de jornadas</Label>
                                <div className="mt-1 text-foreground font-semibold">{order.metadata.num_jornadas || '1'}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Resumen financiero */}
                        <div>
                          <h4 className="text-sm font-medium mb-2 text-foreground">Resumen financiero</h4>
                          <div className="bg-card p-4 rounded-lg">
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Subtotal:</span>
                                <span className="text-foreground">${parseInt(order.metadata.calculated_subtotal || '0').toLocaleString('es-CL')}</span>
                              </div>
                              
                              {order.metadata.calculated_discount && parseInt(order.metadata.calculated_discount) > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Descuento:</span>
                                  <span className="text-green-600">-${parseInt(order.metadata.calculated_discount).toLocaleString('es-CL')}</span>
                                </div>
                              )}
                              
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">IVA (19%):</span>
                                <span className="text-foreground">${parseInt(order.metadata.calculated_iva || '0').toLocaleString('es-CL')}</span>
                              </div>
                              
                              <div className="flex justify-between border-t pt-2 mt-2">
                                <span className="font-medium">Total:</span>
                                <span className="text-xl font-bold text-primary">${parseInt(order.metadata.calculated_total).toLocaleString('es-CL')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )})}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay entregas programadas para esta semana.</p>
            )}
          </CardContent>
        </Card>

        {/* Returns this week */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-md">Devoluciones de esta semana</CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyReturns.length > 0 ? (
              <div className="space-y-3">
                {weeklyReturns.map((order, index) => {
                  const user = findUserById(order.customer_id);
                  return (
                  <Dialog key={index}>
                    <DialogTrigger asChild>
                      <div className="border rounded-md p-3 cursor-pointer hover:bg-accent">
                        <div className="flex justify-between items-start">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            order.status === 'completed' ? 'bg-green-100 text-green-800' :
                            order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {order.status}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground">
                            Devolución: {order.metadata.order_fecha_termino}
                          </span>
                        </div>
                        <p className="font-semibold text-sm mt-1">{order.metadata.order_proyecto || 'Sin proyecto'}</p>
                        <p className="text-sm truncate">
                          {user ? (user.customer_type === 'empresa' ? user.billing_company : `${user.first_name} ${user.last_name}`) : 
                                 (order.billing?.company || `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`)}
                        </p>
                        {user && user.instagram && (
                          <p className="text-xs text-muted-foreground mt-1">{user.instagram}</p>
                        )}
                      </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-foreground">Detalles del Pedido</DialogTitle>
                        <DialogDescription>
                          Información completa del pedido realizado el {formatDate(order.date_created || '')}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-6 py-4">
                        {/* Estado y Fechas */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label className="text-foreground">Estado</Label>
                            <div className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                              {order.status}
                            </div>
                          </div>
                          <div>
                            <Label className="text-foreground">Fecha de Inicio</Label>
                            <div className="mt-1 text-foreground">{order.metadata.order_fecha_inicio}</div>
                          </div>
                          <div>
                            <Label className="text-foreground">Fecha de Término</Label>
                            <div className="mt-1 text-foreground">{order.metadata.order_fecha_termino}</div>
                          </div>
                        </div>

                        {/* Información del Cliente */}
                        <div>
                          <h4 className="text-sm font-medium mb-2 text-foreground">Información del Cliente</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg">
                            <div>
                              <Label className="text-foreground">Nombre</Label>
                              <div className="mt-1 text-foreground">
                                {user ? `${user.first_name} ${user.last_name}` : 
                                       `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`}
                              </div>
                            </div>
                            <div>
                              <Label className="text-foreground">Empresa</Label>
                              <div className="mt-1 text-foreground">
                                {user ? user.billing_company || '-' : order.billing?.company || '-'}
                              </div>
                            </div>
                            <div>
                              <Label className="text-foreground">Email</Label>
                              <div className="mt-1 text-foreground">
                                {user ? user.email : order.billing?.email || ''}
                              </div>
                            </div>
                            {user && user.rut && (
                              <div>
                                <Label className="text-foreground">RUT</Label>
                                <div className="mt-1 text-foreground">{user.rut}</div>
                              </div>
                            )}
                            {user && user.billing_phone && (
                              <div>
                                <Label className="text-foreground">Teléfono</Label>
                                <div className="mt-1 text-foreground">{user.billing_phone}</div>
                              </div>
                            )}
                            {user && user.instagram && (
                              <div>
                                <Label className="text-foreground">Instagram</Label>
                                <div className="mt-1 text-foreground">{user.instagram}</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Productos */}
                        {order.line_items && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 text-foreground">Productos</h4>
                            <div className="bg-card p-4 rounded-lg">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-foreground w-16">Imagen</TableHead>
                                    <TableHead className="text-foreground">Producto</TableHead>
                                    <TableHead className="text-foreground">Cantidad</TableHead>
                                    <TableHead className="text-foreground">Precio</TableHead>
                                    <TableHead className="text-foreground">Total</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {order.line_items.map((item, index) => (
                                    <TableRow key={index}>
                                      <TableCell className="text-foreground">
                                        {item.image && (
                                          <img 
                                            src={item.image} 
                                            alt={item.name} 
                                            className="w-12 h-12 object-cover rounded-md"
                                          />
                                        )}
                                      </TableCell>
                                      <TableCell className="text-foreground">{item.name}</TableCell>
                                      <TableCell className="text-foreground">{item.quantity}</TableCell>
                                      <TableCell className="text-foreground">${item.price.toLocaleString('es-CL')}</TableCell>
                                      <TableCell className="text-foreground">${(item.price * item.quantity).toLocaleString('es-CL')}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}

                        {/* Detalles adicionales */}
                        <div>
                          <h4 className="text-sm font-medium mb-2 text-foreground">Detalles del proyecto</h4>
                          <div className="bg-card p-4 rounded-lg space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-foreground">Proyecto</Label>
                                <div className="mt-1 text-foreground font-semibold">{order.metadata.order_proyecto || 'Sin nombre'}</div>
                              </div>
                              <div>
                                <Label className="text-foreground">Número de jornadas</Label>
                                <div className="mt-1 text-foreground font-semibold">{order.metadata.num_jornadas || '1'}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Resumen financiero */}
                        <div>
                          <h4 className="text-sm font-medium mb-2 text-foreground">Resumen financiero</h4>
                          <div className="bg-card p-4 rounded-lg">
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Subtotal:</span>
                                <span className="text-foreground">${parseInt(order.metadata.calculated_subtotal || '0').toLocaleString('es-CL')}</span>
                              </div>
                              
                              {order.metadata.calculated_discount && parseInt(order.metadata.calculated_discount) > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Descuento:</span>
                                  <span className="text-green-600">-${parseInt(order.metadata.calculated_discount).toLocaleString('es-CL')}</span>
                                </div>
                              )}
                              
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">IVA (19%):</span>
                                <span className="text-foreground">${parseInt(order.metadata.calculated_iva || '0').toLocaleString('es-CL')}</span>
                              </div>
                              
                              <div className="flex justify-between border-t pt-2 mt-2">
                                <span className="font-medium">Total:</span>
                                <span className="text-xl font-bold text-primary">${parseInt(order.metadata.calculated_total).toLocaleString('es-CL')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )})}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay devoluciones programadas para esta semana.</p>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Revenue Chart */}
      <Card className="shadow-sm col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-md">Ingresos por Semana</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              revenue: {
                label: "Ingresos",
                theme: {
                  light: "#0ea5e9",
                  dark: "#38bdf8"
                }
              }
            }}
          >
            <Recharts.BarChart
              data={orders.reduce((acc: Array<{week: string, revenue: number}>, order) => {
                if (!order.date_created) return acc;
                
                const date = new Date(order.date_created);
                // Get year and week number
                const year = date.getFullYear();
                // Calculate week number (ISO week: starts on Monday, first week with majority of days in the year)
                const firstDayOfYear = new Date(year, 0, 1);
                const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
                const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
                
                // Format as "Week X of YYYY"
                const weekLabel = `S${weekNum}/${year}`;
                const revenue = parseInt(order.metadata.calculated_total);
                
                const existingWeek = acc.find(item => item.week === weekLabel);
                if (existingWeek) {
                  existingWeek.revenue += revenue;
                } else {
                  acc.push({ week: weekLabel, revenue });
                }
                return acc;
              }, []).sort((a, b) => {
                // Sort weeks chronologically
                const aParts = a.week.substring(1).split('/');
                const bParts = b.week.substring(1).split('/');
                
                const aWeek = aParts[0] || '0';
                const aYear = aParts[1] || '0';
                const bWeek = bParts[0] || '0';
                const bYear = bParts[1] || '0';
                
                if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear);
                return parseInt(aWeek) - parseInt(bWeek);
              })}
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
            >
              <Recharts.CartesianGrid strokeDasharray="3 3" />
              <Recharts.XAxis dataKey="week" />
              <Recharts.YAxis />
              <Recharts.Tooltip content={<ChartTooltipContent />} />
              <Recharts.Bar
                dataKey="revenue"
                fill="var(--color-revenue)"
                radius={[4, 4, 0, 0]}
              />
            </Recharts.BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      
      </div>

  );
};

export default OrderSummaryCards; 