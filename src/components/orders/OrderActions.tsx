import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

// Icons as components
const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7,10 12,15 17,10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);

const PrintIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <polyline points="6,9 6,2 18,2 18,9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect width="12" height="8" x="6" y="11" />
  </svg>
);

const MailIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-10 5L2 7" />
  </svg>
);

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

const DuplicateIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const CalculatorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <rect width="16" height="20" x="4" y="2" rx="2" />
    <line x1="8" x2="16" y1="6" y2="6" />
    <line x1="16" x2="16" y1="14" y2="18" />
    <path d="m9 10 2 2 4-4" />
  </svg>
);

interface OrderActionsProps {
  orderId: number;
  orderStatus: string;
  customerEmail?: string;
  total: number;
  currency?: string;
  onRefresh?: () => void;
  onDuplicate?: (orderId: number) => Promise<void>;
  onDelete?: (orderId: number) => Promise<void>;
  onSendEmail?: (orderId: number, emailType: string, customMessage?: string) => Promise<void>;
  onGenerateDocument?: (orderId: number, documentType: string) => Promise<void>;
  onRecalculate?: (orderId: number) => Promise<void>;
  loading?: boolean;
  allowDangerousActions?: boolean;
}

export const OrderActions = ({
  orderId,
  orderStatus,
  customerEmail,
  total,
  currency = 'CLP',
  onRefresh,
  onDuplicate,
  onDelete,
  onSendEmail,
  onGenerateDocument,
  onRecalculate,
  loading = false,
  allowDangerousActions = false
}: OrderActionsProps) => {
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailType, setEmailType] = useState<string>('');
  const [customEmailMessage, setCustomEmailMessage] = useState<string>('');
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [documentType, setDocumentType] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string>('');

  const formatCurrency = (value: number) => {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handleAction = async (actionName: string, actionFn: () => Promise<void>) => {
    try {
      setActionLoading(actionName);
      await actionFn();
      toast.success(`Acción completada: ${actionName}`);
    } catch (error) {
      toast.error(`Error en ${actionName}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      console.error(`Error in ${actionName}:`, error);
    } finally {
      setActionLoading('');
    }
  };

  const handleSendEmail = async () => {
    if (!onSendEmail || !emailType) return;
    
    await handleAction('Enviar Email', async () => {
      await onSendEmail(orderId, emailType, customEmailMessage || undefined);
      setIsEmailDialogOpen(false);
      setEmailType('');
      setCustomEmailMessage('');
    });
  };

  const handleGenerateDocument = async () => {
    if (!onGenerateDocument || !documentType) return;
    
    await handleAction('Generar Documento', async () => {
      await onGenerateDocument(orderId, documentType);
      setIsDocumentDialogOpen(false);
      setDocumentType('');
    });
  };

  const emailTemplates = [
    { value: 'order_confirmation', label: 'Confirmación de Pedido', description: 'Email de confirmación del pedido' },
    { value: 'processing_notification', label: 'Notificación de Procesamiento', description: 'El pedido está siendo procesado' },
    { value: 'shipping_notification', label: 'Notificación de Envío', description: 'El pedido ha sido enviado' },
    { value: 'completion_notification', label: 'Notificación de Completado', description: 'El pedido ha sido completado' },
    { value: 'payment_reminder', label: 'Recordatorio de Pago', description: 'Recordatorio de pago pendiente' },
    { value: 'custom', label: 'Mensaje Personalizado', description: 'Enviar mensaje personalizado' }
  ];

  const documentTypes = [
    { value: 'invoice', label: 'Factura', description: 'Generar factura del pedido' },
    { value: 'receipt', label: 'Recibo', description: 'Generar recibo de pago' },
    { value: 'delivery_note', label: 'Nota de Entrega', description: 'Generar nota de entrega' },
    { value: 'quote', label: 'Cotización', description: 'Generar cotización' },
    { value: 'contract', label: 'Contrato', description: 'Generar contrato de alquiler' },
    { value: 'warranty', label: 'Garantía', description: 'Certificado de garantía' }
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Acciones del Pedido</span>
          <Badge variant="outline" className="text-xs">
            Total: ${formatCurrency(total)} {currency}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Actions */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Acciones Rápidas</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading || actionLoading === 'refresh'}
              className="flex items-center gap-2"
            >
              <RefreshIcon />
              Actualizar
            </Button>

            {onRecalculate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction('Recalcular', () => onRecalculate(orderId))}
                disabled={loading || !!actionLoading}
                className="flex items-center gap-2"
              >
                <CalculatorIcon />
                Recalcular
              </Button>
            )}

            <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || !customerEmail}
                  className="flex items-center gap-2"
                >
                  <MailIcon />
                  Email
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Enviar Email al Cliente</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Destinatario</Label>
                    <Input value={customerEmail || ''} disabled className="mt-1" />
                  </div>
                  
                  <div>
                    <Label>Tipo de Email</Label>
                    <Select value={emailType} onValueChange={setEmailType}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Seleccionar tipo de email..." />
                      </SelectTrigger>
                      <SelectContent>
                        {emailTemplates.map((template) => (
                          <SelectItem key={template.value} value={template.value}>
                            <div className="flex flex-col">
                              <span>{template.label}</span>
                              <span className="text-xs text-muted-foreground">{template.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {emailType === 'custom' && (
                    <div>
                      <Label>Mensaje Personalizado</Label>
                      <Textarea
                        value={customEmailMessage}
                        onChange={(e) => setCustomEmailMessage(e.target.value)}
                        placeholder="Escribe tu mensaje personalizado..."
                        className="mt-1"
                        rows={4}
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSendEmail}
                      disabled={!emailType || actionLoading === 'Enviar Email'}
                      className="flex-1"
                    >
                      {actionLoading === 'Enviar Email' ? 'Enviando...' : 'Enviar Email'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsEmailDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <PrintIcon />
                  Documentos
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Generar Documento</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Tipo de Documento</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Seleccionar tipo de documento..." />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.map((doc) => (
                          <SelectItem key={doc.value} value={doc.value}>
                            <div className="flex flex-col">
                              <span>{doc.label}</span>
                              <span className="text-xs text-muted-foreground">{doc.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleGenerateDocument}
                      disabled={!documentType || actionLoading === 'Generar Documento'}
                      className="flex-1"
                    >
                      {actionLoading === 'Generar Documento' ? 'Generando...' : 'Generar'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsDocumentDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Separator />

        {/* Advanced Actions */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Acciones Avanzadas</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {onDuplicate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction('Duplicar Pedido', () => onDuplicate(orderId))}
                disabled={loading || !!actionLoading}
                className="flex items-center gap-2"
              >
                <DuplicateIcon />
                Duplicar Pedido
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/orders/${orderId}/print`, '_blank')}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <PrintIcon />
              Vista de Impresión
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/orders/${orderId}`;
                navigator.clipboard.writeText(url);
                toast.success('Enlace copiado al portapapeles');
              }}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <DuplicateIcon />
              Copiar Enlace
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/api/orders/${orderId}/export`, '_blank')}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <DownloadIcon />
              Exportar Datos
            </Button>
          </div>
        </div>

        {/* Dangerous Actions */}
        {allowDangerousActions && onDelete && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-destructive">Zona de Peligro</h4>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (window.confirm('¿Estás seguro de que quieres eliminar este pedido? Esta acción no se puede deshacer.')) {
                    handleAction('Eliminar Pedido', () => onDelete(orderId));
                  }
                }}
                disabled={loading || !!actionLoading}
                className="flex items-center gap-2"
              >
                <TrashIcon />
                Eliminar Pedido
              </Button>
              <p className="text-xs text-muted-foreground">
                Esta acción eliminará permanentemente el pedido y todos sus datos asociados.
              </p>
            </div>
          </>
        )}

        {/* Status-based Actions */}
        <Separator />
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Acciones Específicas del Estado</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {orderStatus === 'pending' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction('Recordar Pago', () => 
                    onSendEmail ? onSendEmail(orderId, 'payment_reminder') : Promise.resolve()
                  )}
                  disabled={loading || !onSendEmail || !!actionLoading}
                  className="flex items-center gap-2"
                >
                  <MailIcon />
                  Recordar Pago
                </Button>
              </>
            )}

            {orderStatus === 'processing' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction('Notificar Procesamiento', () => 
                    onSendEmail ? onSendEmail(orderId, 'processing_notification') : Promise.resolve()
                  )}
                  disabled={loading || !onSendEmail || !!actionLoading}
                  className="flex items-center gap-2"
                >
                  <MailIcon />
                  Notificar Procesamiento
                </Button>
              </>
            )}

            {orderStatus === 'completed' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction('Generar Factura', () => 
                    onGenerateDocument ? onGenerateDocument(orderId, 'invoice') : Promise.resolve()
                  )}
                  disabled={loading || !onGenerateDocument || !!actionLoading}
                  className="flex items-center gap-2"
                >
                  <PrintIcon />
                  Generar Factura
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
