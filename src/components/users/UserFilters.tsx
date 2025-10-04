import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Filter } from 'lucide-react';

interface UserFiltersProps {
  clientTypeFilter: string;
  setClientTypeFilter: (value: string) => void;
  completionFilter: { min: number; max: number };
  setCompletionFilter: (value: { min: number; max: number }) => void;
}

const UserFilters = ({
  clientTypeFilter,
  setClientTypeFilter,
  completionFilter,
  setCompletionFilter
}: UserFiltersProps) => {
  const hasActiveFilters = clientTypeFilter !== 'all' || completionFilter.min > 0 || completionFilter.max < 100;
  
  const activeFiltersCount = [
    clientTypeFilter !== 'all' ? 1 : 0,
    (completionFilter.min > 0 || completionFilter.max < 100) ? 1 : 0
  ].reduce((sum, count) => sum + count, 0);

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="filters" className="border rounded-lg">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Filtros Avanzados
            </span>
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {activeFiltersCount} activo{activeFiltersCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4">
            {/* Client Type Filter */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                Tipo de Cliente
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  variant={clientTypeFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setClientTypeFilter('all')}
                  className="text-xs"
                >
                  Todos
                </Button>
                <Button
                  variant={clientTypeFilter === 'individual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setClientTypeFilter('individual')}
                  className="text-xs"
                >
                  Individual
                </Button>
                <Button
                  variant={clientTypeFilter === 'empresa' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setClientTypeFilter('empresa')}
                  className="text-xs"
                >
                  Empresa
                </Button>
                <Button
                  variant={clientTypeFilter === 'undefined' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setClientTypeFilter('undefined')}
                  className="text-xs"
                >
                  Sin Definir
                </Button>
              </div>
            </div>

            {/* Completion Percentage Filter */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                % de Perfil Completo
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <Label className="text-xs text-muted-foreground">Mínimo (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={completionFilter.min}
                    onChange={(e) => setCompletionFilter({
                      ...completionFilter,
                      min: Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                    })}
                    className="text-foreground"
                  />
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">Máximo (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={completionFilter.max}
                    onChange={(e) => setCompletionFilter({
                      ...completionFilter,
                      max: Math.max(0, Math.min(100, parseInt(e.target.value) || 100))
                    })}
                    className="text-foreground"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompletionFilter({min: 0, max: 100})}
                    className="text-xs"
                  >
                    Limpiar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompletionFilter({min: 80, max: 100})}
                    className="text-xs"
                  >
                    Completos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompletionFilter({min: 0, max: 50})}
                    className="text-xs"
                  >
                    Incompletos
                  </Button>
                </div>
              </div>
              
              {(completionFilter.min > 0 || completionFilter.max < 100) && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Mostrando usuarios con perfil entre {completionFilter.min}% y {completionFilter.max}% completo
                </div>
              )}
            </div>

            {/* Filter Summary */}
            {hasActiveFilters && (
              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                <strong>Filtros activos:</strong>
                {clientTypeFilter !== 'all' && (
                  <span className="ml-1">
                    Tipo: {clientTypeFilter === 'individual' ? 'Individual' : 
                           clientTypeFilter === 'empresa' ? 'Empresa' : 'Sin Definir'}
                  </span>
                )}
                {(completionFilter.min > 0 || completionFilter.max < 100) && (
                  <span className="ml-1">
                    {clientTypeFilter !== 'all' ? ', ' : ''}
                    Perfil: {completionFilter.min}%-{completionFilter.max}%
                  </span>
                )}
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default UserFilters;
