import { Card, CardContent } from '../ui/card';
import { Users, FileText, CheckCircle, Clock } from 'lucide-react';
import type { UserProfile } from '../../types/user';

interface UserStatsCardsProps {
  users: UserProfile[];
  initialTotal: number;
  currentPage: number;
}

const UserStatsCards = ({ users, initialTotal, currentPage }: UserStatsCardsProps) => {
  const usersWithContracts = users.filter(u => u.url_user_contrato).length;
  const usersWithTermsAccepted = users.filter(u => u.terminos_aceptados).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Usuarios</p>
              <p className="text-2xl font-bold">{initialTotal}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Con Contratos</p>
              <p className="text-2xl font-bold">{usersWithContracts}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-purple-600" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Términos Aceptados</p>
              <p className="text-2xl font-bold">{usersWithTermsAccepted}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-orange-600" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Página Actual</p>
              <p className="text-2xl font-bold">{currentPage}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserStatsCards;
