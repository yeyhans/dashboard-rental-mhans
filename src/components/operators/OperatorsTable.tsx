import React, { useState } from 'react';
import { Loader2, Plus, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { MIN_PASSWORD_LENGTH, OPERATOR_ERRORS, operatorStatusLabel, parseOperatorInput } from '../../lib/operators';
import { formatBusinessDate } from '../../lib/businessDay';
import { apiClient } from '../../services/apiClient';
import type { Operator } from '../../services/operatorService';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

/**
 * Operarios — the super_admin's list of garage accounts (batch 3, migration 0011).
 *
 * One table, one switch per row, one dialog. Deactivating is the only "delete" on offer: the
 * rows a worker signed in `asset_movements` keep their author, so the account is closed, not
 * removed. The badge palette is the muted Área 01 set (`--color-ok` / `--color-neutral`): an
 * inactive account is a state, not an alarm.
 *
 * Validation is the same `parseOperatorInput` the API runs, so the dialog never sends a request
 * it already knows will fail; the server remains the authority.
 */
interface OperatorsTableProps {
  initialOperators: Operator[];
}

const STATUS_BADGE: Record<'active' | 'inactive', string> = {
  active: 'border-transparent bg-[var(--color-ok-bg)] text-[var(--color-ok)]',
  inactive: 'border-transparent bg-[var(--color-neutral-bg)] text-[var(--color-neutral)]',
};

export default function OperatorsTable({ initialOperators }: OperatorsTableProps) {
  const [operators, setOperators] = useState<Operator[]>(initialOperators);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const handleToggle = async (operator: Operator, isActive: boolean) => {
    setTogglingId(operator.id);
    try {
      const response = await apiClient.patch(`/api/operators/${operator.id}`, { is_active: isActive });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al actualizar el operario');
      }
      setOperators((prev) => prev.map((row) => (row.id === operator.id ? result.data : row)));
      toast.success(isActive ? `Cuenta de ${operator.email} activada` : `Cuenta de ${operator.email} desactivada`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar el operario');
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreated = (operator: Operator) => {
    setOperators((prev) => [operator, ...prev]);
    setCreateOpen(false);
    toast.success(`Operario ${operator.email} creado`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cuentas de bodega. Cada operario escanea con su propia cuenta para que cada salida y
          entrada quede firmada.
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo operario
        </Button>
      </div>

      {operators.length === 0 ? (
        <div className="rounded-[10px] border border-border py-12 text-center text-muted-foreground">
          <UserCog className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p>Todavía no hay operarios.</p>
          <p className="mt-1 text-sm">Crea la primera cuenta para que bodega pueda escanear.</p>
        </div>
      ) : (
        <div className="rounded-[10px] border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Correo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="text-right">Activo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operators.map((operator) => (
                <TableRow key={operator.id}>
                  <TableCell className="font-medium">{operator.email}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGE[operator.is_active ? 'active' : 'inactive']}>
                      {operatorStatusLabel(operator.is_active)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatBusinessDate(operator.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {togglingId === operator.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      <Switch
                        checked={operator.is_active}
                        disabled={togglingId === operator.id}
                        onCheckedChange={(checked) => void handleToggle(operator, checked)}
                        aria-label={`${operator.is_active ? 'Desactivar' : 'Activar'} cuenta de ${operator.email}`}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateOperatorDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={handleCreated} />
    </div>
  );
}

interface CreateOperatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (operator: Operator) => void;
}

function CreateOperatorDialog({ open, onOpenChange, onCreated }: CreateOperatorDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseOperatorInput({ email, password, displayName });
    if (!parsed.values) {
      setError(parsed.error);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await apiClient.post('/api/operators', parsed.values);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al crear el operario');
      }
      reset();
      onCreated(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el operario');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nuevo operario</DialogTitle>
            <DialogDescription>
              La cuenta solo abre la pantalla de bodega. Entrega la contraseña en persona.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="operator-email">Correo</Label>
            <Input
              id="operator-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="bodega@mariohans.cl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="operator-password">Contraseña</Label>
            <Input
              id="operator-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
            <p className="text-xs text-muted-foreground">{OPERATOR_ERRORS.WEAK_PASSWORD}.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="operator-name">Nombre (opcional)</Label>
            <Input
              id="operator-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Como se le conoce en bodega"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-[var(--color-crit)]">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear cuenta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
