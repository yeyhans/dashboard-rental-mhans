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
  };
  line_items?: Array<{
    name: string;
    product_id: number;
    price: number;
    quantity: number;
  }>;
};

interface OrderSummaryCardsProps {
  orders: Order[];
  totalOrders: string;
}

const OrderSummaryCards = ({ orders, totalOrders }: OrderSummaryCardsProps) => {
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
        
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200">
          <CardContent className="pt-6 pb-4">
            <div className="flex flex-col">
              <div className="flex justify-between items-baseline">
                <p className="text-sm font-medium text-muted-foreground">En Proceso</p>
                <p className="text-2xl font-bold text-blue-600">{countByStatus.processing}</p>
              </div>
              <div className="flex justify-between items-baseline mt-4">
                <p className="text-sm font-medium text-muted-foreground">Completados</p>
                <p className="text-2xl font-bold text-green-600">{countByStatus.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200">
          <CardContent className="pt-6 pb-4">
            <div className="flex flex-col">
              <div className="flex justify-between items-baseline">
                <p className="text-sm font-medium text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{countByStatus.pending}</p>
              </div>
              <div className="flex justify-between items-baseline mt-4">
                <p className="text-sm font-medium text-muted-foreground">Cancelados</p>
                <p className="text-2xl font-bold text-red-600">{countByStatus.cancelled}</p>
              </div>
            </div>
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
                {weeklyDeliveries.map((order, index) => (
                  <div key={index} className="border rounded-md p-3">
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
                    <p className="text-sm truncate">{order.billing?.company || `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`}</p>
                  </div>
                ))}
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
                {weeklyReturns.map((order, index) => (
                  <div key={index} className="border rounded-md p-3">
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
                    <p className="text-sm truncate">{order.billing?.company || `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay devoluciones programadas para esta semana.</p>
            )}
          </CardContent>
        </Card>


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

      {/* Orders Status Chart */}
      <Card className="shadow-sm col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-md">Estado de Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
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
              }
            }}
          >
            <Recharts.PieChart>
              <Recharts.Pie
                data={[
                  { name: 'completed', value: orders.filter(o => o.status === 'completed').length },
                  { name: 'processing', value: orders.filter(o => o.status === 'processing').length },
                  { name: 'pending', value: orders.filter(o => o.status === 'pending').length }
                ]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
            </Recharts.PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default OrderSummaryCards; 