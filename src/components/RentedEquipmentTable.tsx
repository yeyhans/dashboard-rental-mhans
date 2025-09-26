import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { 
  Package, 
  Calendar, 
  Search, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Filter
} from 'lucide-react';

interface RentedEquipment {
  productName: string;
  productImage: string;
  orderId: number;
  orderProject: string;
  endDate: string;
  status: string;
  daysRemaining: number;
}

interface RentedEquipmentTableProps {
  rentedEquipment: RentedEquipment[];
  isFiltered?: boolean;
  filterInfo?: string;
}

export default function RentedEquipmentTable({ 
  rentedEquipment, 
  isFiltered = false, 
  filterInfo = '' 
}: RentedEquipmentTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredEquipment = rentedEquipment.filter(item => {
    const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.orderProject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.orderId.toString().includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          label: 'Completado',
          variant: 'default' as const,
          color: 'text-green-600',
          icon: CheckCircle
        };
      case 'processing':
        return {
          label: 'Procesando',
          variant: 'secondary' as const,
          color: 'text-blue-600',
          icon: Clock
        };
      case 'on-hold':
        return {
          label: 'En Espera',
          variant: 'destructive' as const,
          color: 'text-orange-600',
          icon: AlertTriangle
        };
      default:
        return {
          label: status,
          variant: 'outline' as const,
          color: 'text-gray-600',
          icon: Package
        };
    }
  };

  const getDaysRemainingConfig = (days: number) => {
    if (days < 0) {
      return {
        label: `Vencido (${Math.abs(days)} días)`,
        variant: 'destructive' as const,
        color: 'text-red-600'
      };
    } else if (days <= 3) {
      return {
        label: `${days} días`,
        variant: 'destructive' as const,
        color: 'text-red-600'
      };
    } else if (days <= 7) {
      return {
        label: `${days} días`,
        variant: 'secondary' as const,
        color: 'text-yellow-600'
      };
    } else {
      return {
        label: `${days} días`,
        variant: 'default' as const,
        color: 'text-green-600'
      };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const statusOptions = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'processing', label: 'Procesando' },
    { value: 'completed', label: 'Completado' },
    { value: 'on-hold', label: 'En Espera' }
  ];

  // Estadísticas rápidas
  const stats = {
    total: rentedEquipment.length,
    expiring: rentedEquipment.filter(item => item.daysRemaining <= 7 && item.daysRemaining >= 0).length,
    expired: rentedEquipment.filter(item => item.daysRemaining < 0).length,
    active: rentedEquipment.filter(item => item.daysRemaining > 7).length
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Equipos Actualmente Rentados</h2>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Equipos</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Activos</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Por Vencer</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.expiring}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Vencidos</p>
                <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Equipos en Renta</CardTitle>
            {isFiltered && (
              <Badge variant="secondary" className="ml-2">
                <Filter className="h-3 w-3 mr-1" />
                Filtrado por {filterInfo}
              </Badge>
            )}
          </div>
          <CardDescription>
            Listado de equipos actualmente rentados con fechas de devolución
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por equipo, proyecto o N° orden..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredEquipment.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {rentedEquipment.length === 0 
                  ? 'No hay equipos rentados actualmente'
                  : 'No se encontraron equipos con los filtros aplicados'
                }
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre del Equipo</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Fecha Término</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tiempo Restante</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEquipment.map((item, index) => {
                    const statusConfig = getStatusConfig(item.status);
                    const daysConfig = getDaysRemainingConfig(item.daysRemaining);
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <img src={item.productImage} alt={item.productName} className="h-8 w-8" />
                            {item.productName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">#{item.orderId}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="max-w-[200px] truncate block">
                            {item.orderProject}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(item.endDate)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
                            <Badge variant={statusConfig.variant}>
                              {statusConfig.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={daysConfig.variant} className={daysConfig.color}>
                            {daysConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/orders/${item.orderId}`, '_blank')}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Orden
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
