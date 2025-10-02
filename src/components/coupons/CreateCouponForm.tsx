import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { Database } from '../../types/database';

// Helper function to get authentication headers
function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  
  try {
    // Get access token from cookie (this is how the system stores auth)
    const cookies = document.cookie.split('; ');
    const accessTokenCookie = cookies.find(row => row.startsWith('sb-access-token='));
    
    if (accessTokenCookie) {
      const token = accessTokenCookie.split('=')[1];
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (error) {
    console.error('Error in getAuthHeaders:', error);
  }
  
  return headers;
}

type CouponInsert = Database['public']['Tables']['coupons']['Insert'];

const couponSchema = z.object({
  code: z.string().min(1, 'El código es requerido').max(50, 'El código es muy largo'),
  amount: z.number().min(0, 'El monto debe ser mayor a 0'),
  discount_type: z.enum(['percent', 'fixed_cart'], {
    required_error: 'Selecciona un tipo de descuento'
  }),
  description: z.string().optional(),
  date_expires: z.string().optional(),
  usage_limit: z.number().min(1).optional(),
  usage_limit_per_user: z.number().min(1).optional(),
  status: z.enum(['publish', 'draft', 'private']).default('publish'),
  minimum_amount: z.number().min(0).optional(),
  maximum_amount: z.number().min(0).optional(),
  individual_use: z.boolean().default(false),
  exclude_sale_items: z.boolean().default(false),
});

type CouponFormData = z.infer<typeof couponSchema>;

interface CreateCouponFormProps {
  onSuccess: () => void;
}

const CreateCouponForm = ({ onSuccess }: CreateCouponFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset
  } = useForm<CouponFormData>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      status: 'publish',
      individual_use: false,
      exclude_sale_items: false,
      discount_type: 'percent'
    }
  });

  const discountType = watch('discount_type');

  const onSubmit = async (data: CouponFormData) => {
    try {
      setIsSubmitting(true);

      // Prepare coupon data
      const couponData: CouponInsert = {
        code: data.code.toUpperCase(),
        amount: data.amount,
        discount_type: data.discount_type,
        description: data.description || null,
        date_expires: data.date_expires || null,
        usage_limit: data.usage_limit || null,
        usage_limit_per_user: data.usage_limit_per_user || null,
        status: data.status,
        minimum_amount: data.minimum_amount || null,
        maximum_amount: data.maximum_amount || null,
        individual_use: data.individual_use,
        exclude_sale_items: data.exclude_sale_items,
        metadata: {}
      };

      const headers = getAuthHeaders();
      const response = await fetch('/api/coupons', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(couponData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Cupón creado correctamente');
        reset();
        onSuccess();
      } else {
        toast.error(result.error || 'Error al crear el cupón');
      }
    } catch (error) {
      console.error('Error creating coupon:', error);
      toast.error('Error al crear el cupón');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate random coupon code
  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setValue('code', result);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código del Cupón *</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  {...register('code')}
                  placeholder="DESCUENTO10"
                  className="uppercase"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateCode}
                  className="whitespace-nowrap"
                >
                  Generar
                </Button>
              </div>
              {errors.code && (
                <p className="text-sm text-red-600">{errors.code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Descripción del cupón..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select
                value={watch('status')}
                onValueChange={(value: 'publish' | 'draft' | 'private') => 
                  setValue('status', value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="publish">Activo</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="private">Privado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Discount Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuración del Descuento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="discount_type">Tipo de Descuento *</Label>
              <Select
                value={watch('discount_type')}
                onValueChange={(value: 'percent' | 'fixed_cart') => 
                  setValue('discount_type', value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Porcentaje</SelectItem>
                  <SelectItem value="fixed_cart">Monto fijo del carrito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">
                {discountType === 'percent' ? 'Porcentaje de Descuento *' : 'Monto del Descuento *'}
              </Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  step={discountType === 'percent' ? '0.01' : '1'}
                  min="0"
                  max={discountType === 'percent' ? '100' : undefined}
                  {...register('amount', { valueAsNumber: true })}
                  placeholder={discountType === 'percent' ? '10' : '5000'}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                  {discountType === 'percent' ? '%' : '$'}
                </div>
              </div>
              {errors.amount && (
                <p className="text-sm text-red-600">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_expires">Fecha de Expiración</Label>
              <Input
                id="date_expires"
                type="datetime-local"
                {...register('date_expires')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Usage Restrictions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Restricciones de Uso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="usage_limit">Límite de Uso Total</Label>
              <Input
                id="usage_limit"
                type="number"
                min="1"
                {...register('usage_limit', { valueAsNumber: true })}
                placeholder="Ej: 100"
              />
              <p className="text-sm text-muted-foreground">
                Deja vacío para uso ilimitado
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="usage_limit_per_user">Límite por Usuario</Label>
              <Input
                id="usage_limit_per_user"
                type="number"
                min="1"
                {...register('usage_limit_per_user', { valueAsNumber: true })}
                placeholder="Ej: 1"
              />
              <p className="text-sm text-muted-foreground">
                Cuántas veces puede usar el cupón cada usuario
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum_amount">Monto Mínimo</Label>
              <Input
                id="minimum_amount"
                type="number"
                min="0"
                step="1"
                {...register('minimum_amount', { valueAsNumber: true })}
                placeholder="Ej: 10000"
              />
              <p className="text-sm text-muted-foreground">
                Monto mínimo del carrito para usar el cupón
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maximum_amount">Descuento Máximo</Label>
              <Input
                id="maximum_amount"
                type="number"
                min="0"
                step="1"
                {...register('maximum_amount', { valueAsNumber: true })}
                placeholder="Ej: 50000"
              />
              <p className="text-sm text-muted-foreground">
                Monto máximo de descuento (solo para porcentajes)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Opciones Avanzadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="individual_use"
                checked={watch('individual_use')}
                onCheckedChange={(checked) => setValue('individual_use', !!checked)}
              />
              <Label htmlFor="individual_use" className="text-sm">
                Uso individual
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              No se puede combinar con otros cupones
            </p>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="exclude_sale_items"
                checked={watch('exclude_sale_items')}
                onCheckedChange={(checked) => setValue('exclude_sale_items', !!checked)}
              />
              <Label htmlFor="exclude_sale_items" className="text-sm">
                Excluir productos en oferta
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              El cupón no se aplicará a productos que ya están en oferta
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => reset()}
          disabled={isSubmitting}
        >
          Limpiar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando...
            </>
          ) : (
            'Crear Cupón'
          )}
        </Button>
      </div>
    </form>
  );
};

export default CreateCouponForm;
