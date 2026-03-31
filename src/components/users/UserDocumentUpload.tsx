import { useState } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { FileText } from 'lucide-react';
import type { UserProfile } from '../../types/user';
import type { DocumentType } from '../../lib/documentUploadService';
import DocumentUploadSection from './DocumentUploadSection';

interface UserDocumentUploadProps {
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  sessionToken: string;
}

const UserDocumentUpload = ({ user, onUserUpdated, sessionToken }: UserDocumentUploadProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleDocumentUploaded = (docType: DocumentType, url: string) => {
    const updatedUser = { ...user };
    switch (docType) {
      case 'rut_anverso': updatedUser.url_rut_anverso = url; break;
      case 'rut_reverso': updatedUser.url_rut_reverso = url; break;
      case 'e_rut_empresa': updatedUser.new_url_e_rut_empresa = url; break;
      case 'firma': updatedUser.url_firma = url; break;
    }
    onUserUpdated(updatedUser);
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

        <div className="py-4">
          <DocumentUploadSection
            userId={user.user_id?.toString() || user.auth_uid || ''}
            sessionToken={sessionToken}
            tipoCliente={user.tipo_cliente || undefined}
            documentUrls={{
              url_rut_anverso: user.url_rut_anverso,
              url_rut_reverso: user.url_rut_reverso,
              new_url_e_rut_empresa: user.new_url_e_rut_empresa,
            }}
            onDocumentUploaded={handleDocumentUploaded}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserDocumentUpload;
