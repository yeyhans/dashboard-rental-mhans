import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';
import { toast } from 'sonner';
import type { UserProfile } from '../types/user';
import { Edit, Save, X, Loader2 } from 'lucide-react';

interface EditUserDialogProps {
  user: UserProfile;
  onUserUpdated: (updatedUser: UserProfile) => void;
  sessionToken: string;
  trigger?: React.ReactNode;
}

interface FormData {
  // Personal Information
  nombre: string;
  apellido: string;
  email: string;
  rut: string;
  telefono: string;
  fecha_nacimiento: string;
  instagram: string;
  usuario: string;
  
  // Address Information
  direccion: string;
  ciudad: string;
  pais: string;
  tipo_cliente: string;
  
  // Company Information
  empresa_nombre: string;
  empresa_rut: string;
  empresa_ciudad: string;
  empresa_direccion: string;
  
  // Status
  terminos_aceptados: boolean;
}

const EditUserDialog = ({ user, onUserUpdated, sessionToken, trigger }: EditUserDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    apellido: '',
    email: '',
    rut: '',
    telefono: '',
    fecha_nacimiento: '',
    instagram: '',
    usuario: '',
    direccion: '',
    ciudad: '',
    pais: '',
    tipo_cliente: '',
    empresa_nombre: '',
    empresa_rut: '',
    empresa_ciudad: '',
    empresa_direccion: '',
    terminos_aceptados: false,
  });

  // Initialize form data when user changes or dialog opens
  useEffect(() => {
    if (user && open) {
      setFormData({
        nombre: user.nombre || '',
        apellido: user.apellido || '',
        email: user.email || '',
        rut: user.rut || '',
        telefono: user.telefono || '',
        fecha_nacimiento: user.fecha_nacimiento || '',
        instagram: user.instagram || '',
        usuario: user.usuario || '',
        direccion: user.direccion || '',
        ciudad: user.ciudad || '',
        pais: user.pais || '',
        tipo_cliente: user.tipo_cliente || '',
        empresa_nombre: user.empresa_nombre || '',
        empresa_rut: user.empresa_rut || '',
        empresa_ciudad: user.empresa_ciudad || '',
        empresa_direccion: user.empresa_direccion || '',
        terminos_aceptados: Boolean(user.terminos_aceptados),
      });
    }
  }, [user, open]);

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Prepare update data - only include changed fields
      const updateData: Partial<UserProfile> = {};
      
      // Compare with original user data and only include changed fields
      Object.keys(formData).forEach((key) => {
        const formKey = key as keyof FormData;
        const originalValue = user[formKey as keyof UserProfile];
        const newValue = formData[formKey];
        
        // Handle boolean conversion for terminos_aceptados
        if (formKey === 'terminos_aceptados') {
          const originalBool = Boolean(originalValue);
          if (originalBool !== newValue) {
            (updateData as any)[formKey] = newValue;
          }
        } else if (originalValue !== newValue) {
          (updateData as any)[formKey] = newValue;
        }
      });

      // Only proceed if there are changes
      if (Object.keys(updateData).length === 0) {
        toast.info('No se detectaron cambios');
        setOpen(false);
        return;
      }

      // Use the session token passed from server
      if (!sessionToken) {
        throw new Error('No hay sesión activa. Por favor, inicia sesión nuevamente.');
      }

      const response = await fetch(`/api/users/${user.user_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar usuario');
      }

      const updatedUser = await response.json();
      
      toast.success('Usuario actualizado correctamente');
      onUserUpdated(updatedUser);
      setOpen(false);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error(error instanceof Error ? error.message : 'Error al actualizar usuario');
    } finally {
      setLoading(false);
    }
  };

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Editar Usuario - {user.nombre} {user.apellido}
          </DialogTitle>
          <DialogDescription>
            Modifica la información del usuario. Solo los campos modificados serán actualizados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div>
            <h4 className="text-sm font-medium mb-3 text-foreground">Información Personal</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => handleInputChange('nombre', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="apellido">Apellido *</Label>
                <Input
                  id="apellido"
                  value={formData.apellido}
                  onChange={(e) => handleInputChange('apellido', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="rut">RUT</Label>
                <Input
                  id="rut"
                  value={formData.rut}
                  onChange={(e) => handleInputChange('rut', e.target.value)}
                  placeholder="12.345.678-9"
                />
              </div>
              <div>
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => handleInputChange('telefono', e.target.value)}
                  placeholder="+56912345678"
                />
              </div>
              <div>
                <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento</Label>
                <Input
                  id="fecha_nacimiento"
                  type="date"
                  value={formatDateForInput(formData.fecha_nacimiento)}
                  onChange={(e) => handleInputChange('fecha_nacimiento', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  value={formData.instagram}
                  onChange={(e) => handleInputChange('instagram', e.target.value)}
                  placeholder="@usuario"
                />
              </div>
              <div>
                <Label htmlFor="usuario">Usuario</Label>
                <Input
                  id="usuario"
                  value={formData.usuario}
                  onChange={(e) => handleInputChange('usuario', e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Address Information */}
          <div>
            <h4 className="text-sm font-medium mb-3 text-foreground">Información de Dirección</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Textarea
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) => handleInputChange('direccion', e.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input
                  id="ciudad"
                  value={formData.ciudad}
                  onChange={(e) => handleInputChange('ciudad', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pais">País</Label>
                <Input
                  id="pais"
                  value={formData.pais}
                  onChange={(e) => handleInputChange('pais', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="tipo_cliente">Tipo de Cliente</Label>
                <Select
                  value={formData.tipo_cliente}
                  onValueChange={(value) => handleInputChange('tipo_cliente', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="persona">Persona Natural</SelectItem>
                    <SelectItem value="empresa">Empresa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Company Information */}
          <div>
            <h4 className="text-sm font-medium mb-3 text-foreground">Información de Empresa</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="empresa_nombre">Nombre de Empresa</Label>
                <Input
                  id="empresa_nombre"
                  value={formData.empresa_nombre}
                  onChange={(e) => handleInputChange('empresa_nombre', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="empresa_rut">RUT de Empresa</Label>
                <Input
                  id="empresa_rut"
                  value={formData.empresa_rut}
                  onChange={(e) => handleInputChange('empresa_rut', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="empresa_ciudad">Ciudad de Empresa</Label>
                <Input
                  id="empresa_ciudad"
                  value={formData.empresa_ciudad}
                  onChange={(e) => handleInputChange('empresa_ciudad', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="empresa_direccion">Dirección de Empresa</Label>
                <Input
                  id="empresa_direccion"
                  value={formData.empresa_direccion}
                  onChange={(e) => handleInputChange('empresa_direccion', e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Status Information */}
          <div>
            <h4 className="text-sm font-medium mb-3 text-foreground">Estado</h4>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="terminos_aceptados"
                checked={formData.terminos_aceptados}
                onCheckedChange={(checked) => handleInputChange('terminos_aceptados', Boolean(checked))}
              />
              <Label htmlFor="terminos_aceptados">Términos y condiciones aceptados</Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserDialog;
