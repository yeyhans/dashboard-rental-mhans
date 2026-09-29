import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Edit, FileText, MoreVertical, RefreshCw } from "lucide-react";
import type { UserProfile } from "../../types/user";
import { enhanceUser, formatDate, statusColors } from "./utils/userUtils";
import EditUserDialog from "../EditUserDialog";
import UserDocumentUpload from "./UserDocumentUpload";
import RegenerateContractDialog from "./RegenerateContractDialog";
import {
  isRowDialogOpen,
  openRowDialog,
  closeRowDialog,
  type ActiveRowDialog,
} from "./utils/rowDialogState";

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
  sessionToken,
}: UserTableViewProps) => {
  // D-18: tracked once per view, not once per dialog, so the dialogs can be rendered outside
  // `DropdownMenuContent` (see `rowDialogState.ts`).
  const [activeDialog, setActiveDialog] = useState<ActiveRowDialog>(null);

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-foreground font-semibold">
              Estado
            </TableHead>
            <TableHead className="text-foreground font-semibold">
              Nombre
            </TableHead>
            <TableHead className="text-foreground font-semibold">
              Email
            </TableHead>
            <TableHead className="text-foreground font-semibold">RUT</TableHead>
            <TableHead className="text-foreground font-semibold">
              Empresa
            </TableHead>
            <TableHead className="text-foreground font-semibold">
              Registro
            </TableHead>
            <TableHead className="text-right text-foreground font-semibold">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const enhanced = enhanceUser(user);
            return (
              <TableRow key={user.user_id}>
                <TableCell>
                  <Badge className={statusColors[enhanced.registrationStatus]}>
                    {enhanced.registrationStatus === "complete"
                      ? "Completo"
                      : enhanced.registrationStatus === "incomplete"
                        ? "Incompleto"
                        : "Pendiente"}
                  </Badge>
                </TableCell>
                <TableCell className="text-foreground">
                  <div className="font-medium">{enhanced.fullName}</div>
                  <div className="text-sm text-muted-foreground">
                    Perfil {enhanced.completionPercentage}% completo
                  </div>
                </TableCell>
                <TableCell className="text-foreground">{user.email}</TableCell>
                <TableCell className="text-foreground">
                  {user.rut || "-"}
                </TableCell>
                <TableCell className="text-foreground">
                  {user.empresa_nombre || "-"}
                </TableCell>
                <TableCell className="text-foreground">
                  {formatDate(user.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewDetails(user)}
                    >
                      Ver ficha
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Más acciones"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      {/* D-18: the menu only picks WHICH dialog to open; the dialogs themselves
                          render as siblings of this DropdownMenu below, not nested in here — Radix
                          unmounts DropdownMenuContent (and anything inside it) the instant the menu
                          closes, which used to unmount the dialog along with it. */}
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() =>
                            setActiveDialog(
                              openRowDialog(user.user_id, "documents"),
                            )
                          }
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Documentos
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            setActiveDialog(openRowDialog(user.user_id, "edit"))
                          }
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            setActiveDialog(
                              openRowDialog(user.user_id, "contract"),
                            )
                          }
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Contrato
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <UserDocumentUpload
                    user={user}
                    onUserUpdated={onUserUpdated}
                    sessionToken={sessionToken}
                    open={isRowDialogOpen(
                      activeDialog,
                      user.user_id,
                      "documents",
                    )}
                    onOpenChange={(next) =>
                      setActiveDialog(
                        next
                          ? openRowDialog(user.user_id, "documents")
                          : closeRowDialog(),
                      )
                    }
                  />
                  <EditUserDialog
                    user={user}
                    onUserUpdated={onUserUpdated}
                    sessionToken={sessionToken}
                    open={isRowDialogOpen(activeDialog, user.user_id, "edit")}
                    onOpenChange={(next) =>
                      setActiveDialog(
                        next
                          ? openRowDialog(user.user_id, "edit")
                          : closeRowDialog(),
                      )
                    }
                  />
                  <RegenerateContractDialog
                    user={user}
                    onUserUpdated={onUserUpdated}
                    sessionToken={sessionToken}
                    open={isRowDialogOpen(
                      activeDialog,
                      user.user_id,
                      "contract",
                    )}
                    onOpenChange={(next) =>
                      setActiveDialog(
                        next
                          ? openRowDialog(user.user_id, "contract")
                          : closeRowDialog(),
                      )
                    }
                  />
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
