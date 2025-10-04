import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import UserAnalyticsCard from './analytics/UserAnalyticsCard';
import ProductAnalyticsCard from './analytics/ProductAnalyticsCard';
import OrderAnalyticsCard from './analytics/OrderAnalyticsCard';
import CouponAnalyticsCard from './analytics/CouponAnalyticsCard';
import ShippingAnalyticsCard from './analytics/ShippingAnalyticsCard';
import KPIAnalyticsCard from './analytics/KPIAnalyticsCard';
import { Users, Package, ShoppingCart, Percent, Truck, BarChart3, Calendar, RefreshCw } from 'lucide-react';
import type { AdvancedAnalytics } from '../services/advancedAnalyticsService';

interface AdvancedAnalyticsDashboardProps {
  analyticsData: AdvancedAnalytics;
}

type DateRangePreset = '7d' | '30d' | '90d' | '6m' | '1y' | 'custom';

export default function AdvancedAnalyticsDashboard({ analyticsData }: AdvancedAnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState('users');
  
  // Detectar el rango actual basado en las fechas
  const detectCurrentRange = (): DateRangePreset => {
    const start = new Date(analyticsData.dateRange.start);
    const end = new Date(analyticsData.dateRange.end);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 7) return '7d';
    if (diffDays <= 30) return '30d';
    if (diffDays <= 90) return '90d';
    if (diffDays <= 180) return '6m';
    if (diffDays <= 365) return '1y';
    return 'custom';
  };

  const [selectedRange, setSelectedRange] = useState<DateRangePreset>(detectCurrentRange());
  const [customStartDate, setCustomStartDate] = useState(analyticsData.dateRange.start);
  const [customEndDate, setCustomEndDate] = useState(analyticsData.dateRange.end);
  const [isLoading, setIsLoading] = useState(false);

  const getDateRangeLabel = (range: DateRangePreset) => {
    switch (range) {
      case '7d': return 'Últimos 7 días';
      case '30d': return 'Últimos 30 días';
      case '90d': return 'Últimos 90 días';
      case '6m': return 'Últimos 6 meses';
      case '1y': return 'Último año';
      case 'custom': return 'Personalizado';
      default: return 'Últimos 30 días';
    }
  };

  const handleDateRangeChange = async (range: DateRangePreset) => {
    setSelectedRange(range);
    if (range !== 'custom') {
      await refreshAnalytics(range);
    }
  };

  const handleCustomDateSubmit = async () => {
    if (customStartDate && customEndDate) {
      await refreshAnalytics('custom', customStartDate, customEndDate);
    }
  };

  const refreshAnalytics = async (range: DateRangePreset, startDate?: string, endDate?: string) => {
    setIsLoading(true);
    try {
      let queryParams = '';
      
      if (range === 'custom' && startDate && endDate) {
        queryParams = `?startDate=${startDate}&endDate=${endDate}`;
      } else if (range !== 'custom') {
        const end = new Date();
        const start = new Date();
        
        switch (range) {
          case '7d':
            start.setDate(end.getDate() - 7);
            break;
          case '30d':
            start.setDate(end.getDate() - 30);
            break;
          case '90d':
            start.setDate(end.getDate() - 90);
            break;
          case '6m':
            start.setMonth(end.getMonth() - 6);
            break;
          case '1y':
            start.setFullYear(end.getFullYear() - 1);
            break;
        }
        
        queryParams = `?startDate=${start.toISOString().split('T')[0]}&endDate=${end.toISOString().split('T')[0]}`;
      }
      
      // Recargar la página con los nuevos parámetros
      window.location.href = `/analytics${queryParams}`;
    } catch (error) {
      console.error('Error refreshing analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Avanzados</h1>
          <p className="text-muted-foreground mt-1">
            Análisis completo de usuarios, productos, cupones y shipping
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Selector de rango de fechas */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedRange} onValueChange={handleDateRangeChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 días</SelectItem>
                <SelectItem value="30d">Últimos 30 días</SelectItem>
                <SelectItem value="90d">Últimos 90 días</SelectItem>
                <SelectItem value="6m">Últimos 6 meses</SelectItem>
                <SelectItem value="1y">Último año</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fechas personalizadas */}
          {selectedRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                placeholder="Fecha inicio"
              />
              <span className="text-muted-foreground">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                placeholder="Fecha fin"
              />
              <Button 
                onClick={handleCustomDateSubmit}
                disabled={!customStartDate || !customEndDate || isLoading}
                size="sm"
                className="flex items-center gap-1"
              >
                {isLoading ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Aplicar
              </Button>
            </div>
          )}

          {/* Período actual */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Período: {analyticsData.dateRange.start} - {analyticsData.dateRange.end}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Usuarios</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Productos</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Órdenes</span>
          </TabsTrigger>
          <TabsTrigger value="coupons" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            <span className="hidden sm:inline">Cupones</span>
          </TabsTrigger>
          <TabsTrigger value="shipping" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Shipping</span>
          </TabsTrigger>
          <TabsTrigger value="kpis" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">KPIs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <UserAnalyticsCard data={analyticsData.users} />
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <ProductAnalyticsCard data={analyticsData.products} />
        </TabsContent>

        <TabsContent value="orders" className="mt-6">
          <OrderAnalyticsCard data={analyticsData.orders} />
        </TabsContent>

        <TabsContent value="coupons" className="mt-6">
          <CouponAnalyticsCard data={analyticsData.coupons} />
        </TabsContent>

        <TabsContent value="shipping" className="mt-6">
          <ShippingAnalyticsCard data={analyticsData.shipping} />
        </TabsContent>

        <TabsContent value="kpis" className="mt-6">
          <KPIAnalyticsCard data={analyticsData.kpis} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
