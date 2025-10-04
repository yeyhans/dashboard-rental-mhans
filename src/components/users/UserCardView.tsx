import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ChevronRight, Edit } from 'lucide-react';
import type { UserProfile } from '../../types/user';
import { enhanceUser, formatDate, statusColors } from './utils/userUtils';
import EditUserDialog from '../EditUserDialog';
import UserDocumentUpload from './UserDocumentUpload';

interface UserCardViewProps {
  users: UserProfile[];
  onUserUpdated: (user: UserProfile) => void;
  onViewDetails: (user: UserProfile) => void;
  sessionToken: string;
}

const UserCardView = ({ 
  users, 
  onUserUpdated, 
  onViewDetails, 
  sessionToken 
}: UserCardViewProps) => {
  return (
    <div className="space-y-4">
      {users.map((user) => {
        const enhanced = enhanceUser(user);
        return (
          <Card key={user.user_id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <Badge className={statusColors[enhanced.registrationStatus]}>
                  {enhanced.registrationStatus === 'complete' ? 'Completo' :
                   enhanced.registrationStatus === 'incomplete' ? 'Incompleto' : 'Pendiente'}
                </Badge>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">{formatDate(user.created_at)}</div>
                </div>
              </div>
              
              <h3 className="font-semibold text-foreground text-lg mb-1">{enhanced.fullName}</h3>
              <p className="text-sm text-muted-foreground mb-2">{user.email}</p>
              
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">RUT</p>
                  <p className="text-sm font-medium text-foreground">{user.rut || '-'}</p>
                </div>
                {user.empresa_nombre && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Empresa</p>
                    <p className="text-sm font-medium text-foreground truncate">{user.empresa_nombre}</p>
                  </div>
                )}
              </div>
              
              <div className="mb-3">
                <p className="text-xs text-muted-foreground">Completitud del Perfil</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${enhanced.completionPercentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {enhanced.completionPercentage}%
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1" 
                  onClick={() => onViewDetails(user)}
                >
                  Ver detalles <ChevronRight className="h-4 w-4 ml-2" />
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
                      <Edit className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default UserCardView;
