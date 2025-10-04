import { Users } from 'lucide-react';

interface UserEmptyStateProps {
  searchTerm: string;
}

const UserEmptyState = ({ searchTerm }: UserEmptyStateProps) => (
  <div className="text-center py-8 text-muted-foreground">
    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
    <p>{searchTerm ? 'No se encontraron usuarios que coincidan con la búsqueda' : 'No hay usuarios disponibles'}</p>
    {searchTerm && (
      <p className="text-sm mt-2">Intenta con otros términos de búsqueda</p>
    )}
  </div>
);

export default UserEmptyState;
