import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import type { UserProfile } from '../../types/user';
import { enhanceUser } from './utils/userUtils';

interface RegenerateContractDialogProps {
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  sessionToken: string;
  trigger: React.ReactNode;
}

type DialogState = 'idle' | 'loading' | 'success' | 'error';

const RegenerateContractDialog = ({
  user,
  onUserUpdated,
  sessionToken,
  trigger,
}: RegenerateContractDialogProps) => {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DialogState>('idle');
  const [contractUrl, setContractUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const enhanced = enhanceUser(user);
  const hasContract = !!user.url_user_contrato;
  const missingSignature = !user.url_firma;
  const missingIdDocs = !user.url_rut_anverso;

  const handleOpen = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setState('idle');
      setContractUrl(null);
      setErrorMessage('');
    }
  };

  const handleRegenerate = async () => {
    setState('loading');
    try {
      const response = await fetch('/api/contracts/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          userData: {
            user_id: user.user_id,
            email: user.email,
            nombre: user.nombre,
            apellido: user.apellido,
            rut: user.rut,
            direccion: user.direccion,
            ciudad: user.ciudad,
            pais: user.pais ?? 'Chile',
            telefono: user.telefono,
            tipo_cliente: user.tipo_cliente ?? 'natural',
            empresa_nombre: user.empresa_nombre,
            empresa_rut: user.empresa_rut,
            empresa_ciudad: user.empresa_ciudad,
            empresa_direccion: user.empresa_direccion,
            url_firma: user.url_firma,
            url_rut_anverso: user.url_rut_anverso,
            url_rut_reverso: user.url_rut_reverso,
            url_empresa_erut: user.url_empresa_erut,
            terminos_aceptados: true,
          },
          uploadToR2: true,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || 'Error al generar el contrato');
      }

      const newContractUrl = result.contractUrl || result.pdfUrl;
      setContractUrl(newContractUrl);
      onUserUpdated({ ...user, url_user_contrato: newContractUrl });
      setState('success');
      toast.success('Contrato regenerado exitosamente', {
        description: `Se envió un email a ${user.email}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setErrorMessage(msg);
      setState('error');
      console.error('[RegenerateContractDialog] Error:', { userId: user.user_id, error: err });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <div
        onClick={() => handleOpen(true)}
        className="cursor-pointer"
      >
        {trigger}
      </div>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            Regenerar Contrato
          </DialogTitle>
          <DialogDescription>
            Genera un nuevo PDF del contrato y lo envía por email al cliente.
          </DialogDescription>
        </DialogHeader>

        {/* Estado: idle */}
        {state === 'idle' && (
          <div className="space-y-4">
            {/* Resumen del usuario */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
              <p className="font-medium text-foreground">{enhanced.fullName}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              {user.rut && (
                <p className="text-sm text-muted-foreground">RUT: {user.rut}</p>
              )}
            </div>

            {/* Estado del contrato actual */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Contrato actual</p>
              {hasContract ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <FileText className="h-3 w-3 mr-1" />
                      Contrato existente
                    </Badge>
                    <a
                      href={user.url_user_contrato!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
                    >
                      Ver contrato actual
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-900/10 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      Se generará un nuevo PDF y reemplazará el contrato actual.
                    </p>
                  </div>
                </div>
              ) : (
                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                  Sin contrato — se generará el primero
                </Badge>
              )}
            </div>

            {/* Advertencias de datos faltantes */}
            {(missingSignature || missingIdDocs) && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Advertencias</p>
                <div className="space-y-1.5">
                  {missingSignature && (
                    <div className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-900/10 px-3 py-2">
                      <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
                      <p className="text-xs text-orange-700 dark:text-orange-400">
                        No tiene firma digital registrada
                      </p>
                    </div>
                  )}
                  {missingIdDocs && (
                    <div className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-900/10 px-3 py-2">
                      <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
                      <p className="text-xs text-orange-700 dark:text-orange-400">
                        Faltan documentos de identidad (RUT)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Estado: loading */}
        {state === 'loading' && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Generando PDF y enviando email...</p>
          </div>
        )}

        {/* Estado: success */}
        {state === 'success' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-4 gap-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="font-medium text-foreground">¡Contrato generado!</p>
              <p className="text-sm text-muted-foreground text-center">
                Se envió un email con el PDF a{' '}
                <span className="text-foreground font-medium">{user.email}</span>
              </p>
            </div>
            {contractUrl && (
              <a
                href={contractUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-md border border-border bg-muted/30 hover:bg-muted/60 transition-colors duration-200 px-4 py-2.5 text-sm font-medium text-foreground cursor-pointer"
              >
                <FileText className="h-4 w-4" />
                Ver nuevo contrato
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            )}
          </div>
        )}

        {/* Estado: error */}
        {state === 'error' && (
          <div className="space-y-3">
            <div className="flex flex-col items-center justify-center py-4 gap-2">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="font-medium text-foreground">Error al generar el contrato</p>
            </div>
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {(state === 'idle' || state === 'error') && (
            <>
              <Button
                variant="outline"
                onClick={() => handleOpen(false)}
                disabled={state === 'loading'}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                onClick={state === 'error' ? handleRegenerate : handleRegenerate}
                disabled={state === 'loading'}
                className="cursor-pointer"
              >
                {state === 'error' ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reintentar
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerar contrato
                  </>
                )}
              </Button>
            </>
          )}
          {state === 'success' && (
            <Button
              onClick={() => handleOpen(false)}
              variant="outline"
              className="cursor-pointer"
            >
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegenerateContractDialog;
