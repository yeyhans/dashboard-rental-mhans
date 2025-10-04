import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { 
  CheckCircle, 
  FileText, 
  Users, 
  AlertCircle,
  UserCheck,
  ExternalLink
} from 'lucide-react';
import type { UserProfile } from '../../types/user';
import { enhanceUser, getMissingFields, formatDate, statusColors } from './utils/userUtils';

interface UserDetailsDialogProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

const UserDetailsDialog = ({ user, isOpen, onClose }: UserDetailsDialogProps) => {
  if (!user) return null;

  const enhanced = enhanceUser(user);
  const missingFields = getMissingFields(user);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] md:w-auto p-4 md:p-6">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">
            Detalles del Usuario - {enhanced.fullName}
          </DialogTitle>
          <DialogDescription>
            Información completa del usuario registrado el {formatDate(user.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Perfil Completo</p>
                    <p className="text-2xl font-bold">{enhanced.completionPercentage}%</p>
                    {missingFields.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {missingFields.length} campos faltantes
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Contrato</p>
                    <Badge variant={enhanced.hasContract ? "default" : "secondary"}>
                      {enhanced.hasContract ? 'Firmado' : 'Pendiente'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium">Estado</p>
                    <Badge className={statusColors[enhanced.registrationStatus]}>
                      {enhanced.registrationStatus === 'complete' ? 'Completo' :
                       enhanced.registrationStatus === 'incomplete' ? 'Incompleto' : 'Pendiente'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Missing Fields for Completion */}
          {missingFields.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                Campos Faltantes para Completar Perfil ({missingFields.length})
              </h4>
              <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {missingFields.map((field, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-orange-400 rounded-full flex-shrink-0"></div>
                      <span className="text-sm text-orange-800">{field}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-orange-700">
                  <strong>Nota:</strong> {user.tipo_cliente === 'empresa' ? 
                    'Como usuario empresa, debe completar campos adicionales de empresa.' : 
                    'Instagram es el único campo opcional.'
                  }
                </div>
              </div>
            </div>
          )}

          {/* Completion Status */}
          {missingFields.length === 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Estado de Completitud
              </h4>
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    ¡Perfil 100% Completo!
                  </span>
                </div>
                <p className="text-xs text-green-700 mt-2">
                  Este usuario ha completado todos los campos requeridos
                  {user.tipo_cliente === 'empresa' ? ' incluyendo información de empresa' : ''}.
                </p>
              </div>
            </div>
          )}

          {/* Personal Information */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground">Información Personal</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
              <div>
                <Label className="text-foreground font-medium">Nombre Completo</Label>
                <div className="mt-1 text-foreground">{enhanced.fullName}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Email</Label>
                <div className="mt-1 text-foreground break-words">{user.email}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">RUT</Label>
                <div className="mt-1 text-foreground">{user.rut || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Teléfono</Label>
                <div className="mt-1 text-foreground">{user.telefono || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Fecha de Nacimiento</Label>
                <div className="mt-1 text-foreground">{formatDate(user.fecha_nacimiento)}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Instagram</Label>
                <div className="mt-1 text-foreground">{user.instagram || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Usuario</Label>
                <div className="mt-1 text-foreground">{user.usuario || '-'}</div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground">Dirección</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
              <div>
                <Label className="text-foreground font-medium">Dirección</Label>
                <div className="mt-1 text-foreground">{user.direccion || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Ciudad</Label>
                <div className="mt-1 text-foreground">{user.ciudad || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">País</Label>
                <div className="mt-1 text-foreground">{user.pais || '-'}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Tipo Cliente</Label>
                <div className="mt-1 text-foreground">{user.tipo_cliente || '-'}</div>
              </div>
            </div>
          </div>

          {/* Company Information */}
          {(user.empresa_nombre || user.empresa_rut || user.empresa_ciudad || user.empresa_direccion) && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-foreground">Información de Empresa</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
                <div>
                  <Label className="text-foreground font-medium">Nombre de Empresa</Label>
                  <div className="mt-1 text-foreground">{user.empresa_nombre || '-'}</div>
                </div>
                <div>
                  <Label className="text-foreground font-medium">RUT de Empresa</Label>
                  <div className="mt-1 text-foreground">{user.empresa_rut || '-'}</div>
                </div>
                <div>
                  <Label className="text-foreground font-medium">Ciudad de Empresa</Label>
                  <div className="mt-1 text-foreground">{user.empresa_ciudad || '-'}</div>
                </div>
                <div>
                  <Label className="text-foreground font-medium">Dirección de Empresa</Label>
                  <div className="mt-1 text-foreground">{user.empresa_direccion || '-'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Document URLs */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
              {user.url_empresa_erut && (
                <div>
                  <Label className="text-foreground font-medium">E-RUT Empresa</Label>
                  <div className="mt-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => user.url_empresa_erut && window.open(user.url_empresa_erut, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver E-RUT
                    </Button>
                  </div>
                </div>
              )}
              {user.new_url_e_rut_empresa && (
                <div>
                  <Label className="text-foreground font-medium">Nuevo E-RUT Empresa</Label>
                  <div className="mt-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => user.new_url_e_rut_empresa && window.open(user.new_url_e_rut_empresa, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver Nuevo E-RUT
                    </Button>
                  </div>
                </div>
              )}
              {user.url_rut_anverso && (
                <div>
                  <Label className="text-foreground font-medium">RUT Anverso</Label>
                  <div className="mt-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => user.url_rut_anverso && window.open(user.url_rut_anverso, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver RUT Anverso
                    </Button>
                  </div>
                </div>
              )}
              {user.url_rut_reverso && (
                <div>
                  <Label className="text-foreground font-medium">RUT Reverso</Label>
                  <div className="mt-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => user.url_rut_reverso && window.open(user.url_rut_reverso, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver RUT Reverso
                    </Button>
                  </div>
                </div>
              )}
              {user.url_firma && (
                <div>
                  <Label className="text-foreground font-medium">Firma</Label>
                  <div className="mt-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => user.url_firma && window.open(user.url_firma, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver Firma
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Information */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Estado del Usuario
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-4 rounded-lg border">
              <div>
                <Label className="text-foreground font-medium">Términos Aceptados</Label>
                <div className="mt-1">
                  <Badge variant={user.terminos_aceptados ? "default" : "secondary"}>
                    {user.terminos_aceptados ? 'Sí' : 'No'}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Fecha de Creación</Label>
                <div className="mt-1 text-foreground">{formatDate(user.created_at)}</div>
              </div>
              <div>
                <Label className="text-foreground font-medium">Última Actualización</Label>
                <div className="mt-1 text-foreground">{formatDate(user.updated_at)}</div>
              </div>
            </div>
          </div>

          {/* Contract Information */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Información de Contrato
            </h4>
            <div className="bg-card p-4 rounded-lg border space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-foreground font-medium">Términos Aceptados:</Label>
                <Badge variant={enhanced.hasAcceptedTerms ? "default" : "secondary"}>
                  {enhanced.hasAcceptedTerms ? 'Sí' : 'No'}
                </Badge>
              </div>
              
              {user.url_user_contrato && (
                <div>
                  <Label className="text-foreground font-medium">Contrato</Label>
                  <div className="mt-1">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => user.url_user_contrato && window.open(user.url_user_contrato, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver Contrato
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailsDialog;
