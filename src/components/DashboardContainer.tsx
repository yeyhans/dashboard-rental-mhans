import React, { useState, useEffect } from 'react';
import DashboardFilters from './DashboardFilters';
import OrderSummaryStats from './OrderSummaryStats';
import OrderStatusTables from './OrderStatusTables';
import RentedEquipmentTable from './RentedEquipmentTable';
import FinancialSummary from './FinancialSummary';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';

interface FilterState {
  dateRange: {
    start: string;
    end: string;
    period: 'weekly' | 'monthly' | 'yearly' | 'all' | 'month-year' | 'custom';
    selectedMonth?: number;
    selectedYear?: number;
  };
  status: string[];
  financialStatus: 'all' | 'paid' | 'pending' | 'partial';
  searchTerm: string;
}

import type { DashboardStats } from '../services/dashboardService';

interface DashboardContainerProps {
  initialData: DashboardStats;
}

export default function DashboardContainer({ initialData }: DashboardContainerProps) {
  const [dashboardData, setDashboardData] = useState<DashboardStats>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<FilterState | null>(null);

  // Función para generar descripción de filtros
  const getFilterDescription = (filters: FilterState): string => {
    const parts: string[] = [];
    
    // Período
    if (filters.dateRange.period === 'weekly') parts.push('última semana');
    else if (filters.dateRange.period === 'monthly') parts.push('último mes');
    else if (filters.dateRange.period === 'yearly') parts.push('último año');
    else if (filters.dateRange.period === 'all') parts.push('todo el período');
    else if (filters.dateRange.period === 'month-year') {
      const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                         'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const monthName = monthNames[filters.dateRange.selectedMonth ?? new Date().getMonth()];
      const year = filters.dateRange.selectedYear ?? new Date().getFullYear();
      parts.push(`${monthName} ${year}`);
    }
    else if (filters.dateRange.period === 'custom') parts.push('período personalizado');
    
    // Estados
    if (filters.status.length > 0) {
      parts.push(`estados: ${filters.status.join(', ')}`);
    }
    
    // Estado financiero
    if (filters.financialStatus !== 'all') {
      const statusMap = {
        'paid': 'pagado',
        'partial': 'parcial',
        'pending': 'pendiente'
      };
      parts.push(`estado: ${statusMap[filters.financialStatus as keyof typeof statusMap]}`);
    }
    
    // Búsqueda
    if (filters.searchTerm) {
      parts.push(`búsqueda: "${filters.searchTerm}"`);
    }
    
    return parts.join(', ') || 'filtros aplicados';
  };

  // Efecto para aplicar filtros iniciales del último mes al cargar
  useEffect(() => {
    // Crear filtros iniciales para el último mes
    const initialFilters: FilterState = {
      dateRange: {
        start: '',
        end: '',
        period: 'monthly'
      },
      status: [],
      financialStatus: 'all',
      searchTerm: ''
    };
    
    // Generar fechas del último mes con horas precisas
    const end = new Date();
    const start = new Date();
    end.setHours(23, 59, 59, 999); // Fin del día actual
    start.setMonth(end.getMonth() - 1);
    start.setHours(0, 0, 0, 0); // Inicio del día hace un mes
    
    initialFilters.dateRange.start = start.toISOString().split('T')[0] || '';
    initialFilters.dateRange.end = end.toISOString().split('T')[0] || '';
    
    // Aplicar filtros iniciales para asegurar que todos los componentes usen datos del último mes
    handleFiltersChange(initialFilters);
  }, []);

  const handleFiltersChange = async (filters: FilterState) => {
    // Si no hay cambios significativos, no hacer nada
    if (JSON.stringify(filters) === JSON.stringify(lastFilters)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setLastFilters(filters);

    try {
      // SIEMPRE ejecutar consulta filtrada para asegurar consistencia
      // Los datos iniciales contienen todas las órdenes, no solo del último mes
      // Por lo tanto, siempre usar la consulta filtrada para obtener datos precisos del período
      console.log('Executing filtered query with filters:', filters);

      // Asegurar que siempre haya un rango de fechas válido
      let dateRange = filters.dateRange;
      if (!dateRange.start || !dateRange.end) {
        // Usar rango del último mes por defecto
        const end = new Date();
        const start = new Date();
        start.setMonth(end.getMonth() - 1);
        
        dateRange = {
          ...dateRange,
          start: start.toISOString().split('T')[0] || '',
          end: end.toISOString().split('T')[0] || ''
        };
      }

      const filtersWithValidDates = {
        ...filters,
        dateRange
      };

      const response = await fetch('/api/dashboard/filtered', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(filtersWithValidDates)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error fetching filtered data');
      }

      // Procesar datos filtrados y actualizar estado
      const filteredData = result.data;
      
      // Reorganizar órdenes por estado
      const ordersByStatus = {
        onHold: filteredData.orders.filter((order: any) => order.status === 'on-hold'),
        pending: filteredData.orders.filter((order: any) => order.status === 'pending'),
        processing: filteredData.orders.filter((order: any) => order.status === 'processing'),
        completed: filteredData.orders.filter((order: any) => order.status === 'completed')
      };

      // Actualizar estadísticas mensuales basadas en datos filtrados
      const monthlyStats = {
        totalOrders: filteredData.stats.totalOrders,
        completedOrders: filteredData.stats.statusBreakdown.completed || 0,
        createdOrders: filteredData.stats.totalOrders,
        pendingOrders: filteredData.stats.statusBreakdown.pending || 0,
        processingOrders: filteredData.stats.statusBreakdown.processing || 0,
        onHoldOrders: filteredData.stats.statusBreakdown['on-hold'] || 0
      };

      // Actualizar resumen financiero basado en datos filtrados
      const completedOrders = filteredData.orders.filter((order: any) => order.status === 'completed');
      const totalPaidActual = completedOrders.reduce((sum: number, order: any) => {
        const total = order.calculated_total || 0;
        return sum + (order.pago_completo ? total : total * 0.25);
      }, 0);
      
      const reservationPayments = completedOrders
        .filter((order: any) => !order.pago_completo)
        .reduce((sum: number, order: any) => sum + (order.calculated_total || 0) * 0.25, 0);
      
      const finalPayments = completedOrders
        .filter((order: any) => order.pago_completo)
        .reduce((sum: number, order: any) => sum + (order.calculated_total || 0), 0);

      const financialSummary = {
        totalSales: filteredData.stats.financialBreakdown.totalSales,
        totalPaid: totalPaidActual,
        totalPending: filteredData.stats.financialBreakdown.totalPending,
        reservationPayments,
        finalPayments
      };

      // Filtrar equipos rentados basado en las órdenes filtradas
      const filteredRentedEquipment = initialData.rentedEquipment.filter((equipment: any) => {
        // Buscar si el equipo pertenece a alguna de las órdenes filtradas
        return filteredData.orders.some((order: any) => order.id === equipment.orderId);
      });

      setDashboardData({
        monthlyOrderStats: monthlyStats,
        ordersByStatus,
        rentedEquipment: filteredRentedEquipment,
        financialSummary
      });

    } catch (err) {
      console.error('Error applying filters:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      // En caso de error, mantener datos actuales
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filtros del Dashboard */}
      <DashboardFilters 
        onFiltersChange={handleFiltersChange}
        isLoading={isLoading}
      />

      {/* Indicador de carga */}
      {isLoading && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Actualizando datos del dashboard...
          </AlertDescription>
        </Alert>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error al cargar datos: {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Contenido del Dashboard */}
      <div className={isLoading ? 'opacity-50 pointer-events-none' : ''}>
        {/* Estadísticas del Mes */}
        <OrderSummaryStats 
          monthlyStats={dashboardData.monthlyOrderStats}
          isFiltered={lastFilters !== null}
          filterInfo={lastFilters ? getFilterDescription(lastFilters) : ''}
        />

        <Separator />
        
        {/* Tablas de Órdenes por Estado */}
        <OrderStatusTables 
          ordersByStatus={dashboardData.ordersByStatus}
          isFiltered={lastFilters !== null}
          filterInfo={lastFilters ? getFilterDescription(lastFilters) : ''}
        />

        <Separator />

        {/* Equipos Rentados */}
        <RentedEquipmentTable 
          rentedEquipment={dashboardData.rentedEquipment}
          isFiltered={lastFilters !== null}
          filterInfo={lastFilters ? getFilterDescription(lastFilters) : ''}
        />
        
        <Separator />

        {/* Resumen Financiero */}
        <FinancialSummary 
          financialSummary={dashboardData.financialSummary}
          isFiltered={lastFilters !== null}
          filterInfo={lastFilters ? getFilterDescription(lastFilters) : ''}
        />
      </div>
    </div>
  );
}
