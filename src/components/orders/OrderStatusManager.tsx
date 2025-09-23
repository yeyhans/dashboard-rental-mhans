import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

// WooCommerce order statuses with Spanish translations
const ORDER_STATUSES = {
  'pending': {
    label: 'Pendiente de pago',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    description: 'Pedido recibido, esperando pago',
    nextActions: ['processing', 'on-hold', 'cancelled']
  },
  'processing': {
    label: 'En proceso',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Pago recibido, preparando pedido',
    nextActions: ['completed', 'on-hold', 'cancelled']
  },
  'on-hold': {
    label: 'En espera',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    description: 'Pedido pausado, esperando acción',
    nextActions: ['processing', 'completed', 'cancelled']
  },
  'completed': {
    label: 'Completado',
    color: 'bg-green-100 text-green-800 border-green-200',
    description: 'Pedido entregado y finalizado',
    nextActions: ['refunded']
  },
  'cancelled': {
    label: 'Cancelado',
    color: 'bg-red-100 text-red-800 border-red-200',
    description: 'Pedido cancelado por cliente o admin',
    nextActions: ['pending', 'processing']
  },
  'refunded': {
    label: 'Reembolsado',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Pedido reembolsado total o parcialmente',
    nextActions: []
  },
  'failed': {
    label: 'Fallido',
    color: 'bg-red-100 text-red-800 border-red-200',
    description: 'Pago fallido o error en procesamiento',
    nextActions: ['pending', 'cancelled']
  }
};

// Payment statuses
const PAYMENT_STATUSES = {
  'pending': {
    label: 'Pendiente',
    color: 'bg-yellow-100 text-yellow-800',
    icon: '⏳'
  },
  'paid': {
    label: 'Pagado',
    color: 'bg-green-100 text-green-800',
    icon: '✅'
  },
  'partial': {
    label: 'Parcial',
    color: 'bg-blue-100 text-blue-800',
    icon: '💰'
  },
  'refunded': {
    label: 'Reembolsado',
    color: 'bg-purple-100 text-purple-800',
    icon: '↩️'
  },
  'failed': {
    label: 'Fallido',
    color: 'bg-red-100 text-red-800',
    icon: '❌'
  }
};

interface OrderStatusManagerProps {
  orderId: number;
  currentStatus: string;
  paymentStatus?: string;
  onStatusChange: (orderId: number, newStatus: string, reason?: string) => Promise<void>;
  onPaymentStatusChange?: (orderId: number, paymentStatus: string) => Promise<void>;
  loading?: boolean;
  allowedActions?: string[];
  showPaymentControls?: boolean;
  showHistory?: boolean;
}

export const OrderStatusManager = ({
  orderId,
  currentStatus,
  paymentStatus = 'pending',
  onStatusChange,
  onPaymentStatusChange,
  loading = false,
  allowedActions,
  showPaymentControls = true,
  showHistory = true
}: OrderStatusManagerProps) => {
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [statusReason, setStatusReason] = useState<string>('');

  const currentStatusInfo = ORDER_STATUSES[currentStatus as keyof typeof ORDER_STATUSES];
  const paymentStatusInfo = PAYMENT_STATUSES[paymentStatus as keyof typeof PAYMENT_STATUSES];

  const getAvailableStatuses = () => {
    if (allowedActions) {
      return allowedActions;
    }
    return currentStatusInfo?.nextActions || [];
  };

  const handleStatusChange = async () => {
    if (!selectedStatus) {
      toast.error('Selecciona un estado válido');
      return;
    }

    try {
      setIsChangingStatus(true);
      await onStatusChange(orderId, selectedStatus, statusReason);
      
      toast.success(`Estado cambiado a: ${ORDER_STATUSES[selectedStatus as keyof typeof ORDER_STATUSES]?.label}`);
      
      // Reset form
      setSelectedStatus('');
      setStatusReason('');
    } catch (error) {
      toast.error('Error al cambiar el estado del pedido');
      console.error('Status change error:', error);
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handlePaymentStatusChange = async (newPaymentStatus: string) => {
    if (!onPaymentStatusChange) return;

    try {
      await onPaymentStatusChange(orderId, newPaymentStatus);
      toast.success(`Estado de pago actualizado: ${PAYMENT_STATUSES[newPaymentStatus as keyof typeof PAYMENT_STATUSES]?.label}`);
    } catch (error) {
      toast.error('Error al actualizar el estado de pago');
      console.error('Payment status change error:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    const icons: { [key: string]: string } = {
      'pending': '⏳',
      'processing': '⚙️',
      'on-hold': '⏸️',
      'completed': '✅',
      'cancelled': '❌',
      'refunded': '↩️',
      'failed': '💥'
    };
    return icons[status] || '📦';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Gestión de Estado del Pedido</span>
          <Badge variant="outline" className="text-xs">
            #{orderId}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status Display */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Estado Actual</h4>
            <div className="flex items-center gap-3">
              <Badge className={`${currentStatusInfo?.color} border`}>
                <span className="mr-1">{getStatusIcon(currentStatus)}</span>
                {currentStatusInfo?.label || currentStatus}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {currentStatusInfo?.description}
              </span>
            </div>
          </div>

          {/* Payment Status */}
          {showPaymentControls && (
            <div>
              <h4 className="text-sm font-medium mb-2">Estado de Pago</h4>
              <div className="flex items-center gap-3">
                <Badge className={`${paymentStatusInfo?.color} border`}>
                  <span className="mr-1">{paymentStatusInfo?.icon}</span>
                  {paymentStatusInfo?.label}
                </Badge>
                <Select
                  value={paymentStatus}
                  onValueChange={handlePaymentStatusChange}
                  disabled={loading}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_STATUSES).map(([key, status]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span>{status.icon}</span>
                          {status.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Status Change Controls */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Cambiar Estado</h4>
          
          {getAvailableStatuses().length > 0 ? (
            <div className="space-y-3">
              <Select
                value={selectedStatus}
                onValueChange={setSelectedStatus}
                disabled={loading || isChangingStatus}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar nuevo estado..." />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableStatuses().map((statusKey) => {
                    const status = ORDER_STATUSES[statusKey as keyof typeof ORDER_STATUSES];
                    return (
                      <SelectItem key={statusKey} value={statusKey}>
                        <span className="flex items-center gap-2">
                          <span>{getStatusIcon(statusKey)}</span>
                          {status?.label || statusKey}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {selectedStatus && (
                <div className="space-y-2">
                  <textarea
                    placeholder="Motivo del cambio (opcional)..."
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    className="w-full p-2 border rounded-md text-sm resize-none"
                    rows={2}
                    disabled={loading || isChangingStatus}
                  />
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={handleStatusChange}
                      disabled={loading || isChangingStatus || !selectedStatus}
                      className="flex-1"
                    >
                      {isChangingStatus ? 'Cambiando...' : 'Confirmar Cambio'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedStatus('');
                        setStatusReason('');
                      }}
                      disabled={loading || isChangingStatus}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">
              No hay acciones disponibles para el estado actual.
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Acciones Rápidas</h4>
          <div className="flex flex-wrap gap-2">
            {currentStatus === 'pending' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedStatus('processing');
                  setStatusReason('Pago confirmado - procesando pedido');
                }}
                disabled={loading}
              >
                ⚙️ Marcar como En Proceso
              </Button>
            )}
            
            {currentStatus === 'processing' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedStatus('completed');
                  setStatusReason('Pedido entregado exitosamente');
                }}
                disabled={loading}
              >
                ✅ Marcar como Completado
              </Button>
            )}
            
            {['pending', 'processing'].includes(currentStatus) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedStatus('on-hold');
                  setStatusReason('Pedido pausado para revisión');
                }}
                disabled={loading}
              >
                ⏸️ Poner en Espera
              </Button>
            )}
          </div>
        </div>

        {/* Status Timeline Preview */}
        {showHistory && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Flujo de Estados</h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground overflow-x-auto pb-2">
              {Object.entries(ORDER_STATUSES).map(([key, status], index) => (
                <div key={key} className="flex items-center gap-1 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded ${
                    key === currentStatus ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {getStatusIcon(key)} {status.label}
                  </span>
                  {index < Object.keys(ORDER_STATUSES).length - 1 && (
                    <span className="text-muted-foreground">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
