import { useState, useRef } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { 
  Upload, 
  FileText, 
  ExternalLink, 
  Loader2, 
  CheckCircle, 
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import type { UserProfile } from '../../types/user';
import { 
  uploadDocumentWithUpdate, 
  validateDocumentFile, 
  getDocumentTypeName,
  type DocumentType 
} from '../../lib/documentUploadService';

interface UserDocumentUploadProps {
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  sessionToken: string;
}

interface DocumentInfo {
  type: DocumentType;
  url?: string | null;
  label: string;
}

const UserDocumentUpload = ({ user, onUserUpdated, sessionToken }: UserDocumentUploadProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Partial<Record<DocumentType, boolean>>>({});
  const fileInputRefs = useRef<Partial<Record<DocumentType, HTMLInputElement | null>>>({});

  // Define available documents for this user
  const documents: DocumentInfo[] = [
    {
      type: 'rut_anverso',
      url: user.url_rut_anverso,
      label: 'RUT Anverso'
    },
    {
      type: 'rut_reverso',
      url: user.url_rut_reverso,
      label: 'RUT Reverso'
    },
    {
      type: 'firma',
      url: user.url_firma,
      label: 'Firma'
    }
  ];

  // Add empresa document if user is empresa type
  if (user.tipo_cliente === 'empresa') {
    documents.push({
      type: 'e_rut_empresa',
      url: user.new_url_e_rut_empresa,
      label: 'E-RUT Empresa'
    });
  }

  const handleFileSelect = async (documentType: DocumentType, file: File) => {
    // Validate file
    const validation = validateDocumentFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setUploading(documentType);
    setUploadProgress(prev => ({ ...prev, [documentType]: true }));

    try {
      const userId = user.user_id?.toString() || user.auth_uid || '';
      console.log('👤 User data for document upload:', {
        user_id: user.user_id,
        auth_uid: user.auth_uid,
        email: user.email,
        finalUserId: userId,
        documentType
      });
      
      if (!userId) {
        console.error('❌ No user ID found:', user);
        toast.error('No se pudo identificar el usuario');
        return;
      }
      
      const result = await uploadDocumentWithUpdate(file, documentType, userId, sessionToken);
      
      if (result.success) {
        toast.success(`${getDocumentTypeName(documentType)} subido correctamente`);
        
        // Update user data locally
        const updatedUser = { ...user };
        switch (documentType) {
          case 'rut_anverso':
            updatedUser.url_rut_anverso = result.url || null;
            break;
          case 'rut_reverso':
            updatedUser.url_rut_reverso = result.url || null;
            break;
          case 'e_rut_empresa':
            updatedUser.new_url_e_rut_empresa = result.url || null;
            break;
          case 'firma':
            updatedUser.url_firma = result.url || null;
            break;
        }
        
        onUserUpdated(updatedUser);
      } else {
        toast.error(result.error || 'Error al subir documento');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Error inesperado al subir documento');
    } finally {
      setUploading(null);
      setUploadProgress(prev => ({ ...prev, [documentType]: false }));
      
      // Clear file input
      if (fileInputRefs.current[documentType]) {
        fileInputRefs.current[documentType]!.value = '';
      }
    }
  };

  const handleFileInputChange = (documentType: DocumentType, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(documentType, file);
    }
  };

  const triggerFileInput = (documentType: DocumentType) => {
    fileInputRefs.current[documentType]?.click();
  };

  const openDocument = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          Documentos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gestión de Documentos - {user.nombre} {user.apellido}
          </DialogTitle>
          <DialogDescription>
            Sube o actualiza los documentos del usuario. Los archivos se almacenan de forma segura.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {documents.map((doc) => (
            <div key={doc.type} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Label className="font-medium">{doc.label}</Label>
                  {doc.url ? (
                    <Badge variant="default" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Subido
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Pendiente
                    </Badge>
                  )}
                </div>
                
                {uploadProgress[doc.type] && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Subiendo...
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {/* Upload Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => triggerFileInput(doc.type)}
                  disabled={uploading === doc.type}
                  className="flex-1"
                >
                  {uploading === doc.type ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {doc.url ? 'Reemplazar' : 'Subir'} {doc.label}
                </Button>

                {/* View Button */}
                {doc.url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDocument(doc.url!)}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver
                  </Button>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={(el) => (fileInputRefs.current[doc.type] = el)}
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => handleFileInputChange(doc.type, e)}
                className="hidden"
              />

              {/* File info */}
              {doc.url && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Documento disponible - Click en "Ver" para abrir
                </div>
              )}
            </div>
          ))}

          {/* Instructions */}
          <div className="bg-muted/50 p-3 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Instrucciones:</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Formatos permitidos: JPEG, PNG, WebP, PDF</li>
              <li>• Tamaño máximo: 5MB por archivo</li>
              <li>• Los documentos se almacenan de forma segura en la nube</li>
              <li>• Los cambios se reflejan inmediatamente en el perfil del usuario</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserDocumentUpload;
