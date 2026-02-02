import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import {
  RefreshCw,
  Search,
  Truck,
  Package,
  CheckCircle,
  Clock,
  Edit,
  Plus,
  Trash2
} from 'lucide-react';

interface ShippingMethod {
  id: number;
  name: string;
  description: string | null;
  cost: number;
  shipping_type: 'free' | 'flat_rate' | 'local_pickup' | 'calculated' | 'express';
  enabled: boolean;
  min_amount: number | null;
  max_amount: number | null;
  available_regions: string[] | null;
  excluded_regions: string[] | null;
  estimated_days_min: number;
  estimated_days_max: number;
  requires_address: boolean;
  requires_phone: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface ShippingStats {
  totalMethods: number;
  activeMethods: number;
  totalShipments: number;
  pendingShipments: number;
  deliveredShipments: number;
  totalRevenue: string;
  deliveryRate: string;
}

interface ShippingDashboardProps {
  initialShippingMethods: ShippingMethod[];
  initialStats: ShippingStats;
}

export default function ShippingDashboard({
  initialShippingMethods,
  initialStats
}: ShippingDashboardProps) {
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>(initialShippingMethods);
  const [stats, setStats] = useState<ShippingStats>(initialStats);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<ShippingMethod | null>(null);

  // Form state for create/edit
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    cost: number;
    shipping_type: 'free' | 'flat_rate' | 'local_pickup' | 'calculated' | 'express';
    enabled: boolean;
    min_amount: number | null;
    max_amount: number | null;
    estimated_days_min: number;
    estimated_days_max: number;
    requires_address: boolean;
    requires_phone: boolean;
  }>({
    name: '',
    description: '',
    cost: 0,
    shipping_type: 'flat_rate',
    enabled: true,
    min_amount: null,
    max_amount: null,
    estimated_days_min: 1,
    estimated_days_max: 3,
    requires_address: true,
    requires_phone: true,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      cost: 0,
      shipping_type: 'flat_rate',
      enabled: true,
      min_amount: null,
      max_amount: null,
      estimated_days_min: 1,
      estimated_days_max: 3,
      requires_address: true,
      requires_phone: true,
    });
  };

  const handleCreateMethod = async () => {
    setLoading(true);
    try {


      const response = await fetch('/api/shipping/methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Error creating shipping method');
      }

      const newMethod = await response.json();
      setShippingMethods(prev => [...prev, newMethod]);
      setIsCreateDialogOpen(false);
      resetForm();
      toast.success('Método de envío creado exitosamente');

      // Refresh stats
      await loadStats();
    } catch (error) {
      toast.error('Error al crear método de envío');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMethod = async () => {
    if (!editingMethod) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/shipping/methods/${editingMethod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Error updating shipping method');

      const updatedMethod = await response.json();
      setShippingMethods(prev =>
        prev.map(method => method.id === editingMethod.id ? updatedMethod : method)
      );
      setEditingMethod(null);
      resetForm();
      toast.success('Método de envío actualizado exitosamente');

      // Refresh stats
      await loadStats();
    } catch (error) {
      toast.error('Error al actualizar método de envío');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMethod = async (methodId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este método de envío?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/shipping/methods/${methodId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Error deleting shipping method');

      setShippingMethods(prev => prev.filter(method => method.id !== methodId));
      toast.success('Método de envío eliminado exitosamente');

      // Refresh stats
      await loadStats();
    } catch (error) {
      toast.error('Error al eliminar método de envío');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/shipping/stats');
      if (response.ok) {
        const newStats = await response.json();
        setStats(newStats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const openEditDialog = (method: ShippingMethod) => {
    setEditingMethod(method);
    setFormData({
      name: method.name,
      description: method.description || '',
      cost: method.cost,
      shipping_type: method.shipping_type,
      enabled: method.enabled,
      min_amount: method.min_amount,
      max_amount: method.max_amount,
      estimated_days_min: method.estimated_days_min,
      estimated_days_max: method.estimated_days_max,
      requires_address: method.requires_address,
      requires_phone: method.requires_phone,
    });
  };

  const filteredMethods = shippingMethods.filter(method =>
    method.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (method.description && method.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getShippingTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      free: 'Envío Gratis',
      flat_rate: 'Tarifa Fija',
      local_pickup: 'Retiro en Tienda',
      calculated: 'Calculado',
      express: 'Express'
    };
    return labels[type] || type;
  };

  const formatCost = (cost: number) => {
    return cost === 0 ? 'Gratis' : `$${cost.toLocaleString('es-CL')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Envíos</h1>
          <p className="text-muted-foreground">
            Administra los métodos de envío disponibles
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Método
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Método de Envío</DialogTitle>
              <DialogDescription>
                Configura un nuevo método de envío para tu tienda
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Envío Express"
                  />
                </div>
                <div>
                  <Label htmlFor="shipping_type">Tipo</Label>
                  <Select
                    value={formData.shipping_type}
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, shipping_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Envío Gratis</SelectItem>
                      <SelectItem value="flat_rate">Tarifa Fija</SelectItem>
                      <SelectItem value="local_pickup">Retiro en Tienda</SelectItem>
                      <SelectItem value="calculated">Calculado</SelectItem>
                      <SelectItem value="express">Express</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="cost">Costo</Label>
                  <Input
                    id="cost"
                    type="number"
                    value={formData.cost}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción del método de envío"
                />
              </div>



              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
                  />
                  <Label htmlFor="enabled">Habilitado</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="requires_address"
                    checked={formData.requires_address}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requires_address: checked }))}
                  />
                  <Label htmlFor="requires_address">Requiere dirección</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="requires_phone"
                    checked={formData.requires_phone}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requires_phone: checked }))}
                  />
                  <Label htmlFor="requires_phone">Requiere teléfono</Label>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateMethod} disabled={loading}>
                {loading ? 'Creando...' : 'Crear Método'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Métodos</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMethods}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeMethods} activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Envíos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalShipments}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingShipments} pendientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos por Envío</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${Number(stats.totalRevenue).toLocaleString('es-CL')}</div>
            <p className="text-xs text-muted-foreground">
              {stats.deliveredShipments} entregados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Entrega</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deliveryRate}%</div>
            <p className="text-xs text-muted-foreground">
              Promedio de entregas exitosas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Métodos de Envío</CardTitle>
          <CardDescription>
            Gestiona todos los métodos de envío disponibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar métodos de envío..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Método</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Costo</TableHead>
                  <TableHead>Tiempo de Entrega</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredMethods.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center space-y-2">
                        <Package className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">No se encontraron métodos de envío</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMethods.map((method) => (
                    <TableRow key={method.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{method.name}</div>
                          {method.description && (
                            <div className="text-sm text-muted-foreground">
                              {method.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getShippingTypeLabel(method.shipping_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCost(method.cost)}
                      </TableCell>
                      <TableCell>
                        {method.estimated_days_min === method.estimated_days_max
                          ? `${method.estimated_days_min} día${method.estimated_days_min > 1 ? 's' : ''}`
                          : `${method.estimated_days_min}-${method.estimated_days_max} días`
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant={method.enabled ? "default" : "secondary"}>
                          {method.enabled ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(method)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteMethod(method.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingMethod} onOpenChange={(open) => !open && setEditingMethod(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Método de Envío</DialogTitle>
            <DialogDescription>
              Modifica la configuración del método de envío
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-name">Nombre</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Envío Express"
                />
              </div>
              <div>
                <Label htmlFor="edit-shipping_type">Tipo</Label>
                <Select
                  value={formData.shipping_type}
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, shipping_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Envío Gratis</SelectItem>
                    <SelectItem value="flat_rate">Tarifa Fija</SelectItem>
                    <SelectItem value="local_pickup">Retiro en Tienda</SelectItem>
                    <SelectItem value="calculated">Calculado</SelectItem>
                    <SelectItem value="express">Express</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-cost">Costo</Label>
                <Input
                  id="edit-cost"
                  type="number"
                  value={formData.cost}
                  onChange={(e) => setFormData(prev => ({ ...prev, cost: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">Descripción</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción del método de envío"
              />
            </div>



            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
                />
                <Label htmlFor="edit-enabled">Habilitado</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-requires_address"
                  checked={formData.requires_address}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requires_address: checked }))}
                />
                <Label htmlFor="edit-requires_address">Requiere dirección</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-requires_phone"
                  checked={formData.requires_phone}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requires_phone: checked }))}
                />
                <Label htmlFor="edit-requires_phone">Requiere teléfono</Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setEditingMethod(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateMethod} disabled={loading}>
              {loading ? 'Actualizando...' : 'Actualizar Método'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
