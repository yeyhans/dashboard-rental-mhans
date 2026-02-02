import { useState } from 'react';
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
import { UserPlus, Save, X, Loader2 } from 'lucide-react';

interface CreateUserDialogProps {
    onUserCreated: (newUser: UserProfile) => void;
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

const initialFormData: FormData = {
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
};

const CreateUserDialog = ({ onUserCreated, sessionToken, trigger }: CreateUserDialogProps) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<FormData>(initialFormData);

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
            // Prepare user data
            const userData: any = { ...formData };

            // Clean up empty strings to nulls
            Object.keys(userData).forEach(key => {
                if (typeof userData[key] === 'string' && userData[key].trim() === '') {
                    userData[key] = null;
                }
            });

            // Use the session token passed from server
            if (!sessionToken) {
                throw new Error('No hay sesión activa. Por favor, inicia sesión nuevamente.');
            }

            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`,
                },
                body: JSON.stringify(userData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al crear usuario');
            }

            const newUser = await response.json();

            toast.success('Usuario creado correctamente');
            onUserCreated(newUser);
            setOpen(false);
            setFormData(initialFormData); // Reset form
        } catch (error) {
            console.error('Error creating user:', error);
            toast.error(error instanceof Error ? error.message : 'Error al crear usuario');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Nuevo Usuario
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl">
                        Crear Nuevo Usuario
                    </DialogTitle>
                    <DialogDescription>
                        Ingresa la información para el nuevo usuario. Los campos marcados con * son obligatorios.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Personal Information */}
                    <div>
                        <h4 className="text-sm font-medium mb-3 text-foreground">Información Personal</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="create-nombre">Nombre *</Label>
                                <Input
                                    id="create-nombre"
                                    value={formData.nombre}
                                    onChange={(e) => handleInputChange('nombre', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="create-apellido">Apellido *</Label>
                                <Input
                                    id="create-apellido"
                                    value={formData.apellido}
                                    onChange={(e) => handleInputChange('apellido', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="create-email">Email *</Label>
                                <Input
                                    id="create-email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="create-rut">RUT</Label>
                                <Input
                                    id="create-rut"
                                    value={formData.rut}
                                    onChange={(e) => handleInputChange('rut', e.target.value)}
                                    placeholder="12.345.678-9"
                                />
                            </div>
                            <div>
                                <Label htmlFor="create-telefono">Teléfono</Label>
                                <Input
                                    id="create-telefono"
                                    value={formData.telefono}
                                    onChange={(e) => handleInputChange('telefono', e.target.value)}
                                    placeholder="+56912345678"
                                />
                            </div>
                            <div>
                                <Label htmlFor="create-fecha_nacimiento">Fecha de Nacimiento</Label>
                                <Input
                                    id="create-fecha_nacimiento"
                                    type="date"
                                    value={formData.fecha_nacimiento}
                                    onChange={(e) => handleInputChange('fecha_nacimiento', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="create-instagram">Instagram</Label>
                                <Input
                                    id="create-instagram"
                                    value={formData.instagram}
                                    onChange={(e) => handleInputChange('instagram', e.target.value)}
                                    placeholder="@usuario"
                                />
                            </div>
                            <div>
                                <Label htmlFor="create-usuario">Usuario</Label>
                                <Input
                                    id="create-usuario"
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
                                <Label htmlFor="create-direccion">Dirección</Label>
                                <Textarea
                                    id="create-direccion"
                                    value={formData.direccion}
                                    onChange={(e) => handleInputChange('direccion', e.target.value)}
                                    rows={2}
                                />
                            </div>
                            <div>
                                <Label htmlFor="create-ciudad">Ciudad</Label>
                                <Input
                                    id="create-ciudad"
                                    value={formData.ciudad}
                                    onChange={(e) => handleInputChange('ciudad', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="create-pais">País</Label>
                                <Input
                                    id="create-pais"
                                    value={formData.pais}
                                    onChange={(e) => handleInputChange('pais', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="create-tipo_cliente">Tipo de Cliente</Label>
                                <Select
                                    value={formData.tipo_cliente}
                                    onValueChange={(value) => handleInputChange('tipo_cliente', value)}
                                >
                                    <SelectTrigger id="create-tipo_cliente">
                                        <SelectValue placeholder="Seleccionar tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="natural">Persona Natural</SelectItem>
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
                                <Label htmlFor="create-empresa_nombre">Nombre de Empresa</Label>
                                <Input
                                    id="create-empresa_nombre"
                                    value={formData.empresa_nombre}
                                    onChange={(e) => handleInputChange('empresa_nombre', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="create-empresa_rut">RUT de Empresa</Label>
                                <Input
                                    id="create-empresa_rut"
                                    value={formData.empresa_rut}
                                    onChange={(e) => handleInputChange('empresa_rut', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="create-empresa_ciudad">Ciudad de Empresa</Label>
                                <Input
                                    id="create-empresa_ciudad"
                                    value={formData.empresa_ciudad}
                                    onChange={(e) => handleInputChange('empresa_ciudad', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="create-empresa_direccion">Dirección de Empresa</Label>
                                <Input
                                    id="create-empresa_direccion"
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
                                id="create-terminos_aceptados"
                                checked={formData.terminos_aceptados}
                                onCheckedChange={(checked) => handleInputChange('terminos_aceptados', Boolean(checked))}
                            />
                            <Label htmlFor="create-terminos_aceptados">Términos y condiciones aceptados</Label>
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
                            {loading ? 'Creando...' : 'Crear Usuario'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default CreateUserDialog;
