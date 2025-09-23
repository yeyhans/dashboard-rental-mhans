import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

// Icons
const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ActivityIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
  </svg>
);

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const StatusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <polyline points="9,11 12,14 22,4" />
    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.34 0 2.6.29 3.74.82" />
  </svg>
);

interface HistoryEntry {
  id: string;
  timestamp: string;
  type: 'status_change' | 'payment_update' | 'product_edit' | 'note_added' | 'email_sent' | 'document_generated' | 'system_action';
  title: string;
  description?: string;
  user?: {
    id: string;
    name: string;
    role: string;
  };
  metadata?: {
    old_value?: any;
    new_value?: any;
    reason?: string;
    [key: string]: any;
  };
}

interface OrderHistoryProps {
  orderId: number;
  history?: HistoryEntry[];
  onLoadHistory?: (orderId: number) => Promise<HistoryEntry[]>;
  loading?: boolean;
  showFilters?: boolean;
  maxHeight?: string;
}

export const OrderHistory = ({
  orderId,
  history = [],
  onLoadHistory,
  loading = false,
  showFilters = true,
  maxHeight = "400px"
}: OrderHistoryProps) => {
  const [historyData, setHistoryData] = useState<HistoryEntry[]>(history);
  const [filteredHistory, setFilteredHistory] = useState<HistoryEntry[]>(history);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(loading);

  // Load history data
  useEffect(() => {
    const loadHistory = async () => {
      if (onLoadHistory && historyData.length === 0) {
        setIsLoading(true);
        try {
          const data = await onLoadHistory(orderId);
          setHistoryData(data);
          setFilteredHistory(data);
        } catch (error) {
          console.error('Error loading order history:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadHistory();
  }, [orderId, onLoadHistory, historyData.length]);

  // Update filtered history when filter changes
  useEffect(() => {
    if (selectedFilter === 'all') {
      setFilteredHistory(historyData);
    } else {
      setFilteredHistory(historyData.filter(entry => entry.type === selectedFilter));
    }
  }, [selectedFilter, historyData]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'status_change':
        return <StatusIcon />;
      case 'payment_update':
        return <ClockIcon />;
      case 'product_edit':
        return <EditIcon />;
      case 'note_added':
        return <UserIcon />;
      case 'email_sent':
        return <ActivityIcon />;
      case 'document_generated':
        return <ActivityIcon />;
      default:
        return <ActivityIcon />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'status_change':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'payment_update':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'product_edit':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'note_added':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'email_sent':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'document_generated':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'status_change':
        return 'Cambio de Estado';
      case 'payment_update':
        return 'Actualización de Pago';
      case 'product_edit':
        return 'Edición de Productos';
      case 'note_added':
        return 'Nota Agregada';
      case 'email_sent':
        return 'Email Enviado';
      case 'document_generated':
        return 'Documento Generado';
      case 'system_action':
        return 'Acción del Sistema';
      default:
        return 'Actividad';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filterOptions = [
    { value: 'all', label: 'Todas las actividades' },
    { value: 'status_change', label: 'Cambios de estado' },
    { value: 'payment_update', label: 'Actualizaciones de pago' },
    { value: 'product_edit', label: 'Ediciones de productos' },
    { value: 'note_added', label: 'Notas agregadas' },
    { value: 'email_sent', label: 'Emails enviados' },
    { value: 'document_generated', label: 'Documentos generados' }
  ];

  // Mock data for demonstration if no history is provided
  const mockHistory: HistoryEntry[] = [
    {
      id: '1',
      timestamp: new Date().toISOString(),
      type: 'status_change',
      title: 'Estado cambiado a "En proceso"',
      description: 'Pago confirmado - procesando pedido',
      user: { id: '1', name: 'Admin Usuario', role: 'Administrador' },
      metadata: { old_value: 'pending', new_value: 'processing', reason: 'Pago confirmado' }
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      type: 'payment_update',
      title: 'Estado de pago actualizado',
      description: 'Marcado como pagado',
      user: { id: '1', name: 'Admin Usuario', role: 'Administrador' },
      metadata: { old_value: 'pending', new_value: 'paid' }
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      type: 'product_edit',
      title: 'Productos modificados',
      description: 'Se agregó 1 producto al pedido',
      user: { id: '1', name: 'Admin Usuario', role: 'Administrador' }
    }
  ];

  const displayHistory = historyData.length > 0 ? filteredHistory : mockHistory;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ClockIcon />
            Historial del Pedido
          </span>
          <Badge variant="outline" className="text-xs">
            {displayHistory.length} entradas
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                variant={selectedFilter === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter(option.value)}
                className="text-xs"
              >
                {option.label}
              </Button>
            ))}
          </div>
        )}

        <Separator />

        {/* History Timeline */}
        <ScrollArea className="w-full" style={{ height: maxHeight }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                <p className="mt-2 text-sm text-muted-foreground">Cargando historial...</p>
              </div>
            </div>
          ) : displayHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ActivityIcon />
              <p className="mt-2">No hay actividades registradas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayHistory.map((entry, index) => (
                <div key={entry.id} className="relative">
                  {/* Timeline line */}
                  {index < displayHistory.length - 1 && (
                    <div className="absolute left-4 top-8 w-0.5 h-12 bg-border" />
                  )}
                  
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full border-2 bg-background flex items-center justify-center ${getTypeColor(entry.type)}`}>
                      {getTypeIcon(entry.type)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium">{entry.title}</h4>
                            <Badge variant="outline" className={`text-xs ${getTypeColor(entry.type)}`}>
                              {getTypeLabel(entry.type)}
                            </Badge>
                          </div>
                          
                          {entry.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {entry.description}
                            </p>
                          )}
                          
                          {/* Metadata */}
                          {entry.metadata && (
                            <div className="text-xs text-muted-foreground space-y-1">
                              {entry.metadata.old_value && entry.metadata.new_value && (
                                <div>
                                  <span className="font-medium">Cambio:</span> {entry.metadata.old_value} → {entry.metadata.new_value}
                                </div>
                              )}
                              {entry.metadata.reason && (
                                <div>
                                  <span className="font-medium">Motivo:</span> {entry.metadata.reason}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* User and timestamp */}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            {entry.user && (
                              <>
                                <UserIcon />
                                <span>{entry.user.name}</span>
                                <span>({entry.user.role})</span>
                                <span>•</span>
                              </>
                            )}
                            <ClockIcon />
                            <span>{formatTimestamp(entry.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Summary */}
        <Separator />
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>
            Mostrando {filteredHistory.length} de {historyData.length || mockHistory.length} actividades
          </span>
          {onLoadHistory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onLoadHistory(orderId)}
              disabled={isLoading}
              className="text-xs"
            >
              Actualizar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
