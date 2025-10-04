import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Users, UserCheck, Building, MapPin, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import type { UserAnalytics } from '../../services/advancedAnalyticsService';

interface UserAnalyticsCardProps {
  data: UserAnalytics;
}

export default function UserAnalyticsCard({ data }: UserAnalyticsCardProps) {
  const formatNumber = (num: number) => num.toLocaleString('es-CL');
  const formatPercentage = (num: number) => `${num.toFixed(1)}%`;

  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.totalUsers)}</div>
            <p className="text-xs text-muted-foreground">
              Usuarios registrados en el sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.activeUsers)}</div>
            <p className="text-xs text-muted-foreground">
              Con órdenes en el período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa Conversión</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(data.conversionRate)}</div>
            <p className="text-xs text-muted-foreground">
              Usuarios que realizan órdenes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crecimiento</CardTitle>
            {data.userGrowthRate >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.userGrowthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.userGrowthRate >= 0 ? '+' : ''}{formatPercentage(data.userGrowthRate)}
            </div>
            <p className="text-xs text-muted-foreground">
              vs mes anterior
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Análisis detallado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usuarios por tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Usuarios por Tipo
            </CardTitle>
            <CardDescription>
              Distribución entre personas y empresas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium">Personas</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{formatNumber(data.usersByType.persona)}</div>
                  <div className="text-xs text-muted-foreground">
                    {data.totalUsers > 0 ? formatPercentage((data.usersByType.persona / data.totalUsers) * 100) : '0%'}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium">Empresas</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{formatNumber(data.usersByType.empresa)}</div>
                  <div className="text-xs text-muted-foreground">
                    {data.totalUsers > 0 ? formatPercentage((data.usersByType.empresa / data.totalUsers) * 100) : '0%'}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usuarios con contratos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Estado de Contratos
            </CardTitle>
            <CardDescription>
              Usuarios que han firmado contratos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{formatNumber(data.usersWithContracts)}</div>
                <p className="text-sm text-muted-foreground">Contratos firmados</p>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tasa de firma:</span>
                <span className="font-medium">
                  {data.totalUsers > 0 ? formatPercentage((data.usersWithContracts / data.totalUsers) * 100) : '0%'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Nuevos usuarios este mes:</span>
                <span className="font-medium">{formatNumber(data.newUsersThisMonth)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top regiones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Top Regiones
          </CardTitle>
          <CardDescription>
            Ciudades con más usuarios registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.usersByRegion.slice(0, 8).map((region, index) => (
              <div key={region.ciudad} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                    {index + 1}
                  </Badge>
                  <span className="text-sm font-medium">{region.ciudad}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{formatNumber(region.count)}</div>
                  <div className="text-xs text-muted-foreground">
                    {data.totalUsers > 0 ? formatPercentage((region.count / data.totalUsers) * 100) : '0%'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
