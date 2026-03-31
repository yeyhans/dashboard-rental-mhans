import { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Upload,
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  uploadDocumentWithUpdate,
  validateDocumentFile,
  getDocumentTypeName,
  type DocumentType,
} from '../../lib/documentUploadService';

interface DocumentUrls {
  url_rut_anverso?: string | null;
  url_rut_reverso?: string | null;
  new_url_e_rut_empresa?: string | null;
}

interface DocumentUploadSectionProps {
  /** Si presente, upload inmediato (edit mode). Si ausente, deferred (create mode). */
  userId?: string;
  sessionToken: string;
  tipoCliente?: string;
  documentUrls?: DocumentUrls;
  /** Create mode: llamado cuando cambian los archivos pendientes */
  onPendingFilesChange?: (files: Map<DocumentType, File>) => void;
  /** Edit mode: llamado después de un upload exitoso */
  onDocumentUploaded?: (documentType: DocumentType, url: string) => void;
}

interface DocumentInfo {
  type: DocumentType;
  label: string;
}

const BASE_DOCUMENTS: DocumentInfo[] = [
  { type: 'rut_anverso', label: 'RUT Anverso (Cédula frontal)' },
  { type: 'rut_reverso', label: 'RUT Reverso (Cédula reverso)' },
];

const EMPRESA_DOCUMENT: DocumentInfo = {
  type: 'e_rut_empresa',
  label: 'E-RUT Empresa',
};

function getDocumentUrl(type: DocumentType, urls?: DocumentUrls): string | null {
  if (!urls) return null;
  switch (type) {
    case 'rut_anverso': return urls.url_rut_anverso || null;
    case 'rut_reverso': return urls.url_rut_reverso || null;
    case 'e_rut_empresa': return urls.new_url_e_rut_empresa || null;
    default: return null;
  }
}

const DocumentUploadSection = ({
  userId,
  sessionToken,
  tipoCliente,
  documentUrls,
  onPendingFilesChange,
  onDocumentUploaded,
}: DocumentUploadSectionProps) => {
  const isEditMode = !!userId;
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Map<DocumentType, File>>(new Map());
  const [uploadedUrls, setUploadedUrls] = useState<Partial<Record<DocumentType, string>>>({});
  const fileInputRefs = useRef<Partial<Record<DocumentType, HTMLInputElement | null>>>({});

  const documents: DocumentInfo[] = [
    ...BASE_DOCUMENTS,
    ...(tipoCliente === 'empresa' ? [EMPRESA_DOCUMENT] : []),
  ];

  // Limpiar e_rut_empresa si cambia de empresa a natural
  useEffect(() => {
    if (tipoCliente !== 'empresa' && pendingFiles.has('e_rut_empresa')) {
      const updated = new Map(pendingFiles);
      updated.delete('e_rut_empresa');
      setPendingFiles(updated);
      onPendingFilesChange?.(updated);
    }
  }, [tipoCliente]);

  const handleFileSelect = async (docType: DocumentType, file: File) => {
    const validation = validateDocumentFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    if (isEditMode) {
      // Upload inmediato
      setUploading(docType);
      try {
        const result = await uploadDocumentWithUpdate(file, docType, userId!, sessionToken);
        if (result.success && result.url) {
          toast.success(`${getDocumentTypeName(docType)} subido correctamente`);
          setUploadedUrls(prev => ({ ...prev, [docType]: result.url }));
          onDocumentUploaded?.(docType, result.url);
        } else {
          toast.error(result.error || 'Error al subir documento');
        }
      } catch (error) {
        console.error('[DocumentUploadSection] Error uploading:', error);
        toast.error('Error inesperado al subir documento');
      } finally {
        setUploading(null);
        if (fileInputRefs.current[docType]) {
          fileInputRefs.current[docType]!.value = '';
        }
      }
    } else {
      // Deferred: guardar archivo en state
      const updated = new Map(pendingFiles);
      updated.set(docType, file);
      setPendingFiles(updated);
      onPendingFilesChange?.(updated);
    }
  };

  const removePendingFile = (docType: DocumentType) => {
    const updated = new Map(pendingFiles);
    updated.delete(docType);
    setPendingFiles(updated);
    onPendingFilesChange?.(updated);
    if (fileInputRefs.current[docType]) {
      fileInputRefs.current[docType]!.value = '';
    }
  };

  const handleFileInputChange = (docType: DocumentType, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(docType, file);
    }
  };

  const triggerFileInput = (docType: DocumentType) => {
    fileInputRefs.current[docType]?.click();
  };

  const openDocument = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-3">
      {documents.map((doc) => {
        const existingUrl = uploadedUrls[doc.type] || getDocumentUrl(doc.type, documentUrls);
        const pending = pendingFiles.get(doc.type);
        const isUploading = uploading === doc.type;

        return (
          <div key={doc.type} className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Label className="font-medium text-sm">{doc.label}</Label>
                {existingUrl ? (
                  <Badge variant="default" className="text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Subido
                  </Badge>
                ) : pending ? (
                  <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                    <FileCheck className="h-3 w-3 mr-1" />
                    Listo para subir
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Pendiente
                  </Badge>
                )}
              </div>

              {isUploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Subiendo...
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => triggerFileInput(doc.type)}
                disabled={isUploading}
                className="flex-1"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {existingUrl ? 'Reemplazar' : pending ? 'Cambiar' : 'Subir'} archivo
              </Button>

              {existingUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openDocument(existingUrl)}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver
                </Button>
              )}

              {pending && !isEditMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removePendingFile(doc.type)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <input
              ref={(el) => (fileInputRefs.current[doc.type] = el)}
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => handleFileInputChange(doc.type, e)}
              className="hidden"
            />

            {pending && !isEditMode && (
              <div className="mt-2 text-xs text-muted-foreground truncate">
                Archivo seleccionado: {pending.name}
              </div>
            )}
          </div>
        );
      })}

      <div className="bg-muted/50 p-3 rounded-lg">
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>Formatos: JPEG, PNG, WebP, PDF — Máximo 5MB por archivo</li>
          {!isEditMode && pendingFiles.size > 0 && (
            <li className="text-amber-400">
              Los documentos se subirán automáticamente al crear el usuario.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default DocumentUploadSection;
