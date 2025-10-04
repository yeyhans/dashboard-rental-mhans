import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Edit } from 'lucide-react';
import type { UserProfile } from '../../types/user';
import { enhanceUser, formatDate, statusColors } from './utils/userUtils';
import EditUserDialog from '../EditUserDialog';
import UserDocumentUpload from './UserDocumentUpload';

interface UserTableViewProps {
  users: UserProfile[];
  onUserUpdated: (user: UserProfile) => void;
  onViewDetails: (user: UserProfile) => void;
  sessionToken: string;
}

const UserTableView = ({ 
  users, 
  onUserUpdated, 
  onViewDetails, 
  sessionToken 
}: UserTableViewProps) => {
  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-foreground font-semibold">Estado</TableHead>
            <TableHead className="text-foreground font-semibold">Nombre</TableHead>
            <TableHead className="text-foreground font-semibold">Email</TableHead>
            <TableHead className="text-foreground font-semibold">RUT</TableHead>
            <TableHead className="text-foreground font-semibold">Empresa</TableHead>
            <TableHead className="text-foreground font-semibold">Registro</TableHead>
            <TableHead className="text-right text-foreground font-semibold">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const enhanced = enhanceUser(user);
            return (
              <TableRow key={user.user_id}>
                <TableCell>
                  <Badge className={statusColors[enhanced.registrationStatus]}>
                    {enhanced.registrationStatus === 'complete' ? 'Completo' :
                     enhanced.registrationStatus === 'incomplete' ? 'Incompleto' : 'Pendiente'}
                  </Badge>
                </TableCell>
                <TableCell className="text-foreground">
                  <div className="font-medium">{enhanced.fullName}</div>
                  <div className="text-sm text-muted-foreground">
                    Perfil {enhanced.completionPercentage}% completo
                  </div>
                </TableCell>
                <TableCell className="text-foreground">{user.email}</TableCell>
                <TableCell className="text-foreground">{user.rut || '-'}</TableCell>
                <TableCell className="text-foreground">{user.empresa_nombre || '-'}</TableCell>
                <TableCell className="text-foreground">{formatDate(user.created_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => onViewDetails(user)}
                    >
                      Ver detalles
                    </Button>
                    <UserDocumentUpload
                      user={user}
                      onUserUpdated={onUserUpdated}
                      sessionToken={sessionToken}
                    />
                    <EditUserDialog 
                      user={user} 
                      onUserUpdated={onUserUpdated}
                      sessionToken={sessionToken}
                      trigger={
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default UserTableView;
