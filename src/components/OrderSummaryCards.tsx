import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from './ui/card';

import { DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Dialog } from './ui/dialog';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ScrollArea } from './ui/scroll-area';

// Status translations and colors based on WooCommerce
const statusTranslations: { [key: string]: string } = {
  'pending': 'Pendiente',
  'processing': 'En proceso',
  'on-hold': 'En espera',
  'completed': 'Completado',
  'cancelled': 'Cancelado',
  'refunded': 'Reembolsado',
  'failed': 'Fallido'
};

const statusColors: { [key: string]: string } = {
  'pending': 'bg-[#f8dda7] text-[#94660c]',
  'processing': 'bg-[#c6e1c6] text-[#5b841b]', 
  'on-hold': 'bg-[#e5e5e5] text-[#777777]',
  'completed': 'bg-[#c8d7e1] text-[#2e4453]',
  'cancelled': 'bg-[#eba3a3] text-[#761919]',
  'refunded': 'bg-[#e5e5e5] text-[#777777]',
  'failed': 'bg-[#eba3a3] text-[#761919]',
  'trash': 'bg-[#e5e5e5] text-[#777777]',
  'auto-draft': 'bg-[#e5e5e5] text-[#777777]'
};

// Helper function to format dates
const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};


type Order = {
  id: number;
  status: string;
  date_created: string;
  customer_id?: number;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    email: string;
  };
  metadata: {
    calculated_total: string;
    order_proyecto: string;
    order_fecha_inicio: string;
    order_fecha_termino: string;
    calculated_subtotal: string;
    calculated_discount: string;
    calculated_iva: string;
    num_jornadas: string;
    order_retire_name: string;
    order_retire_rut: string;
    order_retire_phone: string;
    order_comments: string;
  };
  line_items: Array<{
    name: string;
    product_id: number;
    price: number;
    quantity: number;
    image: string;
  }>;
  wordpress_data?: {
    fotos_garantia: string[];
    correo_enviado: boolean;
    pago_completo: boolean;
  };
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
    <div className="space-y-3">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Weekly Deliveries Card */}
        <Card className="shadow-sm">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm">Entregas de esta semana</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-3">
            {weeklyDeliveries.length > 0 ? (
              <div className="space-y-1.5">
                {weeklyDeliveries.map((order, index) => {
                  const user = findUserById(order.customer_id);
                  return (
                    <Dialog key={index}>
                      <DialogTrigger asChild>
                        <div className="border rounded-md p-1.5 cursor-pointer hover:bg-accent active:bg-accent/90 touch-manipulation">
                          <div className="flex justify-between items-start">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                              {statusTranslations[order.status] || order.status}
                            </span>
                            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap ml-1">
                              {order.metadata.order_fecha_inicio}
                            </span>
                          </div>
                          <p className="font-semibold text-xs mt-0.5 truncate">{order.metadata.order_proyecto || 'Sin proyecto'}</p>
                          <p className="text-[10px] truncate">
                            {user ? (user.customer_type === 'empresa' ? user.billing_company : `${user.first_name} ${user.last_name}`) : 
                                   (order.billing?.company || `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`)}
                          </p>
                          {user && user.instagram && (
                            <p className="text-[10px] text-muted-foreground truncate">{user.instagram}</p>
                          )}
                        </div>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-2 sm:p-4">
                        <DialogHeader className="space-y-0.5 mb-2">
                          <DialogTitle className="text-sm">Detalles del Pedido</DialogTitle>
                          <DialogDescription className="text-[10px]">
                            Pedido del {formatDate(order.date_created || '')}
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-2">
                          {/* Estado y Fechas */}
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[10px]">Estado</Label>
                              <div className={`mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                                {statusTranslations[order.status] || order.status}
                              </div>
                            </div>
                            <div>
                              <Label className="text-[10px]">Fecha Inicio</Label>
                              <div className="mt-0.5 text-[10px]">{order.metadata.order_fecha_inicio}</div>
                            </div>
                            <div>
                              <Label className="text-[10px]">Fecha Término</Label>
                              <div className="mt-0.5 text-[10px]">{order.metadata.order_fecha_termino}</div>
                            </div>
                          </div>

                          {/* Información del Cliente */}
                          <div>
                            <h4 className="text-[10px] font-medium mb-0.5">Información del Cliente</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-card p-1.5 rounded-lg">
                              <div>
                                <Label className="text-[10px]">Nombre</Label>
                                <div className="mt-0.5 text-[10px]">
                                  {user ? `${user.first_name} ${user.last_name}` : 
                                         `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`}
                                </div>
                              </div>
                              <div>
                                <Label className="text-[10px]">Empresa</Label>
                                <div className="mt-0.5 text-[10px]">
                                  {user ? user.billing_company || '-' : order.billing?.company || '-'}
                                </div>
                              </div>
                              <div>
                                <Label className="text-[10px]">Email</Label>
                                <div className="mt-0.5 text-[10px] break-all">
                                  {user ? user.email : order.billing?.email || ''}
                                </div>
                              </div>
                              {user && user.rut && (
                                <div>
                                  <Label className="text-[10px]">RUT</Label>
                                  <div className="mt-0.5 text-[10px]">{user.rut}</div>
                                </div>
                              )}
                              {user && user.billing_phone && (
                                <div>
                                  <Label className="text-[10px]">Teléfono</Label>
                                  <div className="mt-0.5 text-[10px]">{user.billing_phone}</div>
                                </div>
                              )}
                              {user && user.instagram && (
                                <div>
                                  <Label className="text-[10px]">Instagram</Label>
                                  <div className="mt-0.5 text-[10px]">{user.instagram}</div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Productos */}
                          {order.line_items && (
                            <div>
                              <h4 className="text-[10px] font-medium mb-0.5">Productos</h4>
                              <div className="bg-card p-1.5 rounded-lg">
                                <ScrollArea className="w-full overflow-auto">
                                  <div className="min-w-[300px]">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="text-[10px] w-12">Img</TableHead>
                                          <TableHead className="text-[10px]">Producto</TableHead>
                                          <TableHead className="text-[10px] text-center">Cant</TableHead>
                                          <TableHead className="text-[10px] text-right">Precio</TableHead>
                                          <TableHead className="text-[10px] text-right">Total</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {order.line_items.map((item, index) => (
                                          <TableRow key={index}>
                                            <TableCell className="p-1">
                                              {item.image && (
                                                <img 
                                                  src={item.image} 
                                                  alt={item.name} 
                                                  className="w-8 h-8 object-cover rounded-md"
                                                />
                                              )}
                                            </TableCell>
                                            <TableCell className="text-[10px] p-1">{item.name}</TableCell>
                                            <TableCell className="text-[10px] text-center p-1">{item.quantity}</TableCell>
                                            <TableCell className="text-[10px] text-right p-1">${item.price.toLocaleString('es-CL')}</TableCell>
                                            <TableCell className="text-[10px] text-right p-1">${(item.price * item.quantity).toLocaleString('es-CL')}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </ScrollArea>
                              </div>
                            </div>
                          )}

                          {/* Detalles del proyecto */}
                          <div>
                            <h4 className="text-[10px] font-medium mb-0.5">Detalles del proyecto</h4>
                            <div className="bg-card p-1.5 rounded-lg space-y-1">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[10px]">Proyecto</Label>
                                  <div className="mt-0.5 text-[10px] font-semibold">{order.metadata.order_proyecto || 'Sin nombre'}</div>
                                </div>
                                <div>
                                  <Label className="text-[10px]">Jornadas</Label>
                                  <div className="mt-0.5 text-[10px] font-semibold">{order.metadata.num_jornadas || '1'}</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Información de Retiro */}
                          <div>
                            <h4 className="text-[10px] font-medium mb-0.5">Información de Retiro</h4>
                            <div className="bg-card p-1.5 rounded-lg space-y-1">
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-[10px]">Nombre</Label>
                                  <div className="mt-0.5 text-[10px]">{order.metadata.order_retire_name || '-'}</div>
                                </div>
                                <div>
                                  <Label className="text-[10px]">RUT</Label>
                                  <div className="mt-0.5 text-[10px]">{order.metadata.order_retire_rut || '-'}</div>
                                </div>
                                <div>
                                  <Label className="text-[10px]">Teléfono</Label>
                                  <div className="mt-0.5 text-[10px]">{order.metadata.order_retire_phone || '-'}</div>
                                </div>
                              </div>
                              {order.metadata.order_comments && (
                                <div className="mt-1">
                                  <Label className="text-[10px]">Comentarios</Label>
                                  <div className="mt-0.5 text-[10px] text-muted-foreground">{order.metadata.order_comments}</div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Resumen financiero */}
                          <div>
                            <h4 className="text-[10px] font-medium mb-0.5">Resumen financiero</h4>
                            <div className="bg-card p-1.5 rounded-lg">
                              <div className="space-y-0.5">
                                <div className="flex justify-between">
                                  <span className="text-[10px] text-muted-foreground">Subtotal:</span>
                                  <span className="text-[10px]">${parseInt(order.metadata.calculated_subtotal || '0').toLocaleString('es-CL')}</span>
                                </div>
                                
                                {order.metadata.calculated_discount && parseInt(order.metadata.calculated_discount) > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-[10px] text-muted-foreground">Descuento:</span>
                                    <span className="text-[10px] text-green-600">-${parseInt(order.metadata.calculated_discount).toLocaleString('es-CL')}</span>
                                  </div>
                                )}
                                
                                <div className="flex justify-between">
                                  <span className="text-[10px] text-muted-foreground">IVA (19%):</span>
                                  <span className="text-[10px]">${parseInt(order.metadata.calculated_iva || '0').toLocaleString('es-CL')}</span>
                                </div>
                                
                                <div className="flex justify-between border-t pt-1 mt-1">
                                  <span className="text-[10px] font-medium">Total:</span>
                                  <span className="text-sm font-bold text-primary">${parseInt(order.metadata.calculated_total).toLocaleString('es-CL')}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Botón Ver Detalle */}
                          <div className="flex justify-end pt-2">
                            <a 
                              href={`/orders/${order.id}`} target="_blank"
                              className="inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 py-1"
                            >
                              Ver Detalle Completo
                            </a>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No hay entregas programadas para esta semana.</p>
            )}
          </CardContent>
        </Card>

        {/* Weekly Returns Card */}
        <Card className="shadow-sm">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm">Devoluciones de esta semana</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-3">
            {weeklyReturns.length > 0 ? (
              <div className="space-y-1.5">
                {weeklyReturns.map((order, index) => {
                  const user = findUserById(order.customer_id);
                  return (
                    <Dialog key={index}>
                      <DialogTrigger asChild>
                        <div className="border rounded-md p-1.5 cursor-pointer hover:bg-accent active:bg-accent/90 touch-manipulation">
                          <div className="flex justify-between items-start">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                              {statusTranslations[order.status] || order.status}
                            </span>
                            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap ml-1">
                              {order.metadata.order_fecha_termino}
                            </span>
                          </div>
                          <p className="font-semibold text-xs mt-0.5 truncate">{order.metadata.order_proyecto || 'Sin proyecto'}</p>
                          <p className="text-[10px] truncate">
                            {user ? (user.customer_type === 'empresa' ? user.billing_company : `${user.first_name} ${user.last_name}`) : 
                                   (order.billing?.company || `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`)}
                          </p>
                          {user && user.instagram && (
                            <p className="text-[10px] text-muted-foreground truncate">{user.instagram}</p>
                          )}
                        </div>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-2 sm:p-4">
                        <DialogHeader className="space-y-0.5 mb-2">
                          <DialogTitle className="text-sm">Detalles del Pedido</DialogTitle>
                          <DialogDescription className="text-[10px]">
                            Pedido del {formatDate(order.date_created || '')}
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-2">
                          {/* Estado y Fechas */}
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[10px]">Estado</Label>
                              <div className={`mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                                {statusTranslations[order.status] || order.status}
                              </div>
                            </div>
                            <div>
                              <Label className="text-[10px]">Fecha Inicio</Label>
                              <div className="mt-0.5 text-[10px]">{order.metadata.order_fecha_inicio}</div>
                            </div>
                            <div>
                              <Label className="text-[10px]">Fecha Término</Label>
                              <div className="mt-0.5 text-[10px]">{order.metadata.order_fecha_termino}</div>
                            </div>
                          </div>

                          {/* Información del Cliente */}
                          <div>
                            <h4 className="text-[10px] font-medium mb-0.5">Información del Cliente</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-card p-1.5 rounded-lg">
                              <div>
                                <Label className="text-[10px]">Nombre</Label>
                                <div className="mt-0.5 text-[10px]">
                                  {user ? `${user.first_name} ${user.last_name}` : 
                                         `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`}
                                </div>
                              </div>

                              <div>
                                <Label className="text-[10px]">Empresa</Label>
                                <div className="mt-0.5 text-[10px]">
                                  {user ? user.billing_company || '-' : order.billing?.company || '-'}
                                </div>
                              </div>
                              <div>
                                <Label className="text-[10px]">Email</Label>
                                <div className="mt-0.5 text-[10px] break-all">
                                  {user ? user.email : order.billing?.email || ''}
                                </div>
                              </div>
                              {user && user.rut && (
                                <div>
                                  <Label className="text-[10px]">RUT</Label>
                                  <div className="mt-0.5 text-[10px]">{user.rut}</div>
                                </div>
                              )}
                              {user && user.billing_phone && (
                                <div>
                                  <Label className="text-[10px]">Teléfono</Label>
                                  <div className="mt-0.5 text-[10px]">{user.billing_phone}</div>
                                </div>
                              )}
                              {user && user.instagram && (
                                <div>
                                  <Label className="text-[10px]">Instagram</Label>
                                  <div className="mt-0.5 text-[10px]">{user.instagram}</div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Productos */}
                          {order.line_items && (
                            <div>
                              <h4 className="text-[10px] font-medium mb-0.5">Productos</h4>
                              <div className="bg-card p-1.5 rounded-lg">
                                <ScrollArea className="w-full overflow-auto">
                                  <div className="min-w-[300px]">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="text-[10px] w-12">Img</TableHead>
                                          <TableHead className="text-[10px]">Producto</TableHead>
                                          <TableHead className="text-[10px] text-center">Cant</TableHead>
                                          <TableHead className="text-[10px] text-right">Precio</TableHead>
                                          <TableHead className="text-[10px] text-right">Total</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {order.line_items.map((item, index) => (
                                          <TableRow key={index}>
                                            <TableCell className="p-1">
                                              {item.image && (
                                                <img 
                                                  src={item.image} 
                                                  alt={item.name} 
                                                  className="w-8 h-8 object-cover rounded-md"
                                                />
                                              )}
                                            </TableCell>
                                            <TableCell className="text-[10px] p-1">{item.name}</TableCell>
                                            <TableCell className="text-[10px] text-center p-1">{item.quantity}</TableCell>
                                            <TableCell className="text-[10px] text-right p-1">${item.price.toLocaleString('es-CL')}</TableCell>
                                            <TableCell className="text-[10px] text-right p-1">${(item.price * item.quantity).toLocaleString('es-CL')}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </ScrollArea>
                              </div>
                            </div>
                          )}

                          {/* Detalles del proyecto */}
                          <div>
                            <h4 className="text-[10px] font-medium mb-0.5">Detalles del proyecto</h4>
                            <div className="bg-card p-1.5 rounded-lg space-y-1">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[10px]">Proyecto</Label>
                                  <div className="mt-0.5 text-[10px] font-semibold">{order.metadata.order_proyecto || 'Sin nombre'}</div>
                                </div>
                                <div>
                                  <Label className="text-[10px]">Jornadas</Label>
                                  <div className="mt-0.5 text-[10px] font-semibold">{order.metadata.num_jornadas || '1'}</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Información de Retiro */}
                          <div>
                            <h4 className="text-[10px] font-medium mb-0.5">Información de Retiro</h4>
                            <div className="bg-card p-1.5 rounded-lg space-y-1">
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-[10px]">Nombre</Label>
                                  <div className="mt-0.5 text-[10px]">{order.metadata.order_retire_name || '-'}</div>
                                </div>
                                <div>
                                  <Label className="text-[10px]">RUT</Label>
                                  <div className="mt-0.5 text-[10px]">{order.metadata.order_retire_rut || '-'}</div>
                                </div>
                                <div>
                                  <Label className="text-[10px]">Teléfono</Label>
                                  <div className="mt-0.5 text-[10px]">{order.metadata.order_retire_phone || '-'}</div>
                                </div>
                              </div>
                              {order.metadata.order_comments && (
                                <div className="mt-1">
                                  <Label className="text-[10px]">Comentarios</Label>
                                  <div className="mt-0.5 text-[10px] text-muted-foreground">{order.metadata.order_comments}</div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Resumen financiero */}
                          <div>
                            <h4 className="text-[10px] font-medium mb-0.5">Resumen financiero</h4>
                            <div className="bg-card p-1.5 rounded-lg">
                              <div className="space-y-0.5">
                                <div className="flex justify-between">
                                  <span className="text-[10px] text-muted-foreground">Subtotal:</span>
                                  <span className="text-[10px]">${parseInt(order.metadata.calculated_subtotal || '0').toLocaleString('es-CL')}</span>
                                </div>
                                
                                {order.metadata.calculated_discount && parseInt(order.metadata.calculated_discount) > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-[10px] text-muted-foreground">Descuento:</span>
                                    <span className="text-[10px] text-green-600">-${parseInt(order.metadata.calculated_discount).toLocaleString('es-CL')}</span>
                                  </div>
                                )}
                                
                                <div className="flex justify-between">
                                  <span className="text-[10px] text-muted-foreground">IVA (19%):</span>
                                  <span className="text-[10px]">${parseInt(order.metadata.calculated_iva || '0').toLocaleString('es-CL')}</span>
                                </div>
                                
                                <div className="flex justify-between border-t pt-1 mt-1">
                                  <span className="text-[10px] font-medium">Total:</span>
                                  <span className="text-sm font-bold text-primary">${parseInt(order.metadata.calculated_total).toLocaleString('es-CL')}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Botón Ver Detalle */}
                          <div className="flex justify-end pt-2">
                            <a 
                              href={`/orders/${order.id}`}
                              className="inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 py-1"
                            >
                              Ver Detalle Completo
                            </a>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No hay devoluciones programadas para esta semana.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrderSummaryCards; 