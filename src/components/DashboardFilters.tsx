import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { 
  Calendar, 
  Filter, 
  RefreshCw, 
  Download,
  Search,
  X
} from 'lucide-react';

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

interface DashboardFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  isLoading?: boolean;
}

export default function DashboardFilters({ onFiltersChange, isLoading = false }: DashboardFiltersProps) {
  // Inicializar con fechas del último mes
  const initializeDateRange = () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(end.getMonth() - 1);
    
    return {
      start: start.toISOString().split('T')[0] || '',
      end: end.toISOString().split('T')[0] || '',
      period: 'monthly' as const
    };
  };

  const [filters, setFilters] = useState<FilterState>({
    dateRange: initializeDateRange(),
    status: [],
    financialStatus: 'all',
    searchTerm: ''
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Opciones predefinidas
  const statusOptions = [
    { value: 'pending', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'processing', label: 'Procesando', color: 'bg-blue-100 text-blue-800' },
    { value: 'on-hold', label: 'En Espera', color: 'bg-orange-100 text-orange-800' },
    { value: 'completed', label: 'Completado', color: 'bg-green-100 text-green-800' },
    { value: 'cancelled', label: 'Cancelado', color: 'bg-red-100 text-red-800' }
  ];

  const financialStatusOptions = [
    { value: 'all', label: 'Todos los Estados' },
    { value: 'paid', label: 'Completamente Pagado' },
    { value: 'partial', label: 'Parcialmente Pagado (25%)' },
    { value: 'pending', label: 'Pendiente de Pago' }
  ];

  const periodOptions = [
    { value: 'weekly', label: 'Última Semana' },
    { value: 'monthly', label: 'Último Mes' },
    { value: 'yearly', label: 'Último Año' },
    { value: 'all', label: 'Todo el Período' },
    { value: 'month-year', label: 'Mes y Año Específico' },
    { value: 'custom', label: 'Rango Personalizado' }
  ];

  // Opciones de meses
  const monthOptions = [
    { value: 0, label: 'Enero' },
    { value: 1, label: 'Febrero' },
    { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' },
    { value: 4, label: 'Mayo' },
    { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' },
    { value: 7, label: 'Agosto' },
    { value: 8, label: 'Septiembre' },
    { value: 9, label: 'Octubre' },
    { value: 10, label: 'Noviembre' },
    { value: 11, label: 'Diciembre' }
  ];

  // Generar opciones de años (últimos 5 años + próximos 2)
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear - 5; year <= currentYear + 2; year++) {
      years.push({ value: year, label: year.toString() });
    }
    return years;
  };

  const yearOptions = generateYearOptions();

  // Generar fechas predefinidas
  const generateDateRange = (period: 'weekly' | 'monthly' | 'yearly' | 'all' | 'month-year', selectedMonth?: number, selectedYear?: number) => {
    const end = new Date();
    const start = new Date();
    
    // Ajustar la fecha de fin para incluir todo el día actual
    end.setHours(23, 59, 59, 999);
    
    switch (period) {
      case 'weekly':
        start.setDate(end.getDate() - 7);
        start.setHours(0, 0, 0, 0); // Inicio del día
        break;
      case 'monthly':
        start.setMonth(end.getMonth() - 1);
        start.setHours(0, 0, 0, 0); // Inicio del día
        break;
      case 'yearly':
        start.setFullYear(end.getFullYear() - 1);
        start.setHours(0, 0, 0, 0); // Inicio del día
        break;
      case 'all':
        // Ir muy atrás para capturar todos los registros
        start.setFullYear(2020, 0, 1); // Desde enero 2020
        start.setHours(0, 0, 0, 0); // Inicio del día
        break;
      case 'month-year':
        if (selectedMonth !== undefined && selectedYear !== undefined) {
          // Primer día del mes seleccionado
          start.setFullYear(selectedYear, selectedMonth, 1);
          start.setHours(0, 0, 0, 0);
          
          // Último día del mes seleccionado
          end.setFullYear(selectedYear, selectedMonth + 1, 0); // Día 0 del siguiente mes = último día del mes actual
          end.setHours(23, 59, 59, 999);
        }
        break;
    }
    
    return {
      start: start.toISOString().split('T')[0] || '',
      end: end.toISOString().split('T')[0] || ''
    };
  };

  const handlePeriodChange = (period: 'weekly' | 'monthly' | 'yearly' | 'all' | 'month-year' | 'custom') => {
    let dateRange = filters.dateRange;
    
    if (period !== 'custom' && period !== 'month-year') {
      const dates = generateDateRange(period);
      dateRange = {
        ...dateRange,
        period,
        start: dates.start,
        end: dates.end
      };
    } else if (period === 'month-year') {
      // Para month-year, inicializar con el mes y año actual
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      
      const dates = generateDateRange(period, currentMonth, currentYear);
      dateRange = {
        ...dateRange,
        period,
        selectedMonth: currentMonth,
        selectedYear: currentYear,
        start: dates.start,
        end: dates.end
      };
    } else {
      dateRange = { ...dateRange, period };
    }
    
    const newFilters = { ...filters, dateRange };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleStatusToggle = (status: string) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    
    const newFilters = { ...filters, status: newStatus };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleFinancialStatusChange = (financialStatus: FilterState['financialStatus']) => {
    const newFilters = { ...filters, financialStatus };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleSearchChange = (searchTerm: string) => {
    const newFilters = { ...filters, searchTerm };
    setFilters(newFilters);
    // Debounce search
    setTimeout(() => onFiltersChange(newFilters), 300);
  };

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    const dateRange = { ...filters.dateRange, [field]: value };
    const newFilters = { ...filters, dateRange };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleMonthYearChange = (month?: number, year?: number) => {
    if (month !== undefined && year !== undefined) {
      const dates = generateDateRange('month-year', month, year);
      const dateRange = {
        ...filters.dateRange,
        selectedMonth: month,
        selectedYear: year,
        start: dates.start,
        end: dates.end
      };
      const newFilters = { ...filters, dateRange };
      setFilters(newFilters);
      onFiltersChange(newFilters);
    }
  };

  const clearAllFilters = () => {
    const defaultFilters: FilterState = {
      dateRange: initializeDateRange(),
      status: [],
      financialStatus: 'all',
      searchTerm: ''
    };
    setFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  };

  const hasActiveFilters = filters.status.length > 0 || 
                          filters.financialStatus !== 'all' || 
                          filters.searchTerm.length > 0 ||
                          (filters.dateRange.start && filters.dateRange.end);

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <CardTitle>Filtros del Dashboard</CardTitle>
            {hasActiveFilters && (
              <Badge variant="secondary">
                {filters.status.length + (filters.financialStatus !== 'all' ? 1 : 0) + (filters.searchTerm ? 1 : 0)} activos
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Ocultar' : 'Avanzado'}
            </Button>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
              >
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          Filtra la información del dashboard por período, estado y otros criterios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros básicos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Búsqueda */}
          <div>
            <label className="text-sm font-medium mb-2 block">Búsqueda</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por proyecto, cliente..."
                value={filters.searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Período */}
          <div>
            <label className="text-sm font-medium mb-2 block">Período</label>
            <select
              value={filters.dateRange.period}
              onChange={(e) => handlePeriodChange(e.target.value as any)}
              className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              {periodOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Estado Financiero */}
          <div>
            <label className="text-sm font-medium mb-2 block">Estado Financiero</label>
            <select
              value={filters.financialStatus}
              onChange={(e) => handleFinancialStatusChange(e.target.value as any)}
              className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              {financialStatusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Rango de fechas personalizado */}
        {filters.dateRange.period === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <label className="text-sm font-medium mb-2 block">Fecha Inicio</label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => handleDateRangeChange('start', e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Fecha Fin</label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => handleDateRangeChange('end', e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        )}

        {/* Selector de mes y año específico */}
        {filters.dateRange.period === 'month-year' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border border-blue-200">
            <div>
              <label className="text-sm font-medium mb-2 block text-blue-800">Mes</label>
              <select
                value={filters.dateRange.selectedMonth ?? new Date().getMonth()}
                onChange={(e) => handleMonthYearChange(
                  parseInt(e.target.value), 
                  filters.dateRange.selectedYear ?? new Date().getFullYear()
                )}
                className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-black"
              >
                {monthOptions.map(month => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block text-blue-800">Año</label>
              <select
                value={filters.dateRange.selectedYear ?? new Date().getFullYear()}
                onChange={(e) => handleMonthYearChange(
                  filters.dateRange.selectedMonth ?? new Date().getMonth(),
                  parseInt(e.target.value)
                )}
                className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-black"
              >
                {yearOptions.map(year => (
                  <option key={year.value} value={year.value}>
                    {year.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-blue-600 p-2 rounded border border-blue-200">
                <Calendar className="inline h-4 w-4 mr-1" />
                Período seleccionado: {monthOptions[filters.dateRange.selectedMonth ?? new Date().getMonth()]?.label} {filters.dateRange.selectedYear ?? new Date().getFullYear()}
              </div>
            </div>
          </div>
        )}

        {/* Filtros de estado */}
        {showAdvanced && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium">Estados de Órdenes</h4>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleStatusToggle(option.value)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                    filters.status.includes(option.value)
                      ? option.color
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                  {filters.status.includes(option.value) && (
                    <X className="inline h-3 w-3 ml-1" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {hasActiveFilters ? 'Filtros aplicados' : 'Sin filtros aplicados'}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onFiltersChange(filters)}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Actualizar
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
