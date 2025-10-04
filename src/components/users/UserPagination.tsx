import { Button } from '../ui/button';
import { Label } from '../ui/label';

interface UserPaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalFilteredUsers: number;
  initialTotal: number;
  startIndex: number;
  endIndex: number;
  loading: boolean;
  hasActiveFilters: boolean;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
}

const UserPagination = ({
  currentPage,
  totalPages,
  itemsPerPage,
  totalFilteredUsers,
  initialTotal,
  startIndex,
  endIndex,
  loading,
  hasActiveFilters,
  onPageChange,
  onItemsPerPageChange
}: UserPaginationProps) => {
  const renderPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust start if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Show first page and ellipsis if needed
    if (startPage > 1) {
      pages.push(
        <Button
          key={1}
          variant={1 === currentPage ? "default" : "outline"}
          size="sm"
          onClick={() => onPageChange(1)}
          className="w-9 h-9 p-0"
        >
          1
        </Button>
      );
      if (startPage > 2) {
        pages.push(
          <span key="ellipsis1" className="px-2 text-muted-foreground">
            ...
          </span>
        );
      }
    }
    
    // Show visible page range
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Button
          key={i}
          variant={i === currentPage ? "default" : "outline"}
          size="sm"
          onClick={() => onPageChange(i)}
          className="w-9 h-9 p-0"
        >
          {i}
        </Button>
      );
    }
    
    // Show last page and ellipsis if needed
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(
          <span key="ellipsis2" className="px-2 text-muted-foreground">
            ...
          </span>
        );
      }
      pages.push(
        <Button
          key={totalPages}
          variant={totalPages === currentPage ? "default" : "outline"}
          size="sm"
          onClick={() => onPageChange(totalPages)}
          className="w-9 h-9 p-0"
        >
          {totalPages}
        </Button>
      );
    }
    
    return pages;
  };

  return (
    <div className="mt-6 space-y-4">
      {/* Items per page selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Mostrar:</Label>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="px-3 py-1 border rounded-md text-sm bg-background"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-muted-foreground">por página</span>
        </div>
        
        <div className="text-sm text-muted-foreground">
          Mostrando {startIndex + 1}-{Math.min(endIndex, totalFilteredUsers)} de {totalFilteredUsers} usuarios
          {hasActiveFilters && ` (filtrados de ${initialTotal} total)`}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1 || loading}
            >
              Primera
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || loading}
            >
              Anterior
            </Button>
            
            {/* Page numbers */}
            <div className="flex items-center gap-1 mx-2">
              {renderPageNumbers()}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages || loading}
            >
              Siguiente
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages || loading}
            >
              Última
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserPagination;
