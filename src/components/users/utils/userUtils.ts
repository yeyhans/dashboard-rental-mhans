import type { UserProfile } from '../../../types/user';

// Calculate user profile completion percentage
export const calculateCompletionPercentage = (user: UserProfile): number => {
  // Required fields for all users
  const requiredFields = [
    user.email,
    user.nombre,
    user.apellido,
    user.usuario,
    user.rut,
    user.direccion,
    user.ciudad,
    user.pais,
    user.tipo_cliente,
    user.telefono,
    user.fecha_nacimiento,
    user.terminos_aceptados,
    user.url_rut_anverso,
    user.url_rut_reverso,
    user.url_firma
  ];

  // Optional field (instagram) - always considered as filled for calculation purposes
  const optionalFields = [
    true // instagram is optional, so we count it as always complete
  ];

  // Additional required fields for empresa type
  const empresaFields = user.tipo_cliente === 'empresa' ? [
    user.empresa_nombre,
    user.empresa_rut,
    user.empresa_ciudad,
    user.empresa_direccion,
    user.new_url_e_rut_empresa
  ] : [];

  // Combine all required fields
  const allRequiredFields = [...requiredFields, ...optionalFields, ...empresaFields];

  // Count filled fields (excluding instagram since it's optional)
  const filledRequiredFields = requiredFields.filter(field => {
    if (typeof field === 'boolean') return field === true;
    return field && field.toString().trim() !== '';
  }).length;

  const filledEmpresaFields = empresaFields.filter(field =>
    field && field.toString().trim() !== ''
  ).length;

  const filledOptionalFields = 1; // Instagram is always considered complete since it's optional

  const totalFilledFields = filledRequiredFields + filledEmpresaFields + filledOptionalFields;
  const totalRequiredFields = allRequiredFields.length;

  return Math.round((totalFilledFields / totalRequiredFields) * 100);
};

// Helper function to enhance user data with computed properties
export const enhanceUser = (user: UserProfile) => ({
  ...user,
  fullName: `${user.nombre || ''} ${user.apellido || ''}`.trim(),
  displayName: user.nombre || user.email || 'Usuario sin nombre',
  hasContract: Boolean(user.url_user_contrato),
  hasAcceptedTerms: Boolean(user.terminos_aceptados),
  registrationStatus: user.terminos_aceptados && user.url_user_contrato ? 'complete' :
    user.terminos_aceptados ? 'incomplete' : 'pending',
  completionPercentage: calculateCompletionPercentage(user)
});

// Helper function to get missing fields for completion
export const getMissingFields = (user: UserProfile): string[] => {
  const missing: string[] = [];

  // Required fields for all users
  const requiredFieldsMap = {
    'Email': user.email,
    'Nombre': user.nombre,
    'Apellido': user.apellido,
    'Usuario': user.usuario,
    'RUT': user.rut,
    'Dirección': user.direccion,
    'Ciudad': user.ciudad,
    'País': user.pais,
    'Tipo de Cliente': user.tipo_cliente,
    'Teléfono': user.telefono,
    'Fecha de Nacimiento': user.fecha_nacimiento,
    'Términos Aceptados': user.terminos_aceptados,
    'RUT Anverso': user.url_rut_anverso,
    'RUT Reverso': user.url_rut_reverso,
    'Firma': user.url_firma
  };

  // Check required fields
  Object.entries(requiredFieldsMap).forEach(([fieldName, value]) => {
    if (typeof value === 'boolean') {
      if (!value) missing.push(fieldName);
    } else {
      if (!value || value.toString().trim() === '') missing.push(fieldName);
    }
  });

  // Additional fields for empresa type
  if (user.tipo_cliente === 'empresa') {
    const empresaFieldsMap = {
      'Nombre de Empresa': user.empresa_nombre,
      'RUT de Empresa': user.empresa_rut,
      'Ciudad de Empresa': user.empresa_ciudad,
      'Dirección de Empresa': user.empresa_direccion,
      'E-RUT de Empresa': user.new_url_e_rut_empresa
    };

    Object.entries(empresaFieldsMap).forEach(([fieldName, value]) => {
      if (!value || value.toString().trim() === '') missing.push(fieldName);
    });
  }

  return missing;
};

// Format date helper
export const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
};

// Status colors mapping
export const statusColors: Record<string, string> = {
  'complete': 'bg-green-100 text-green-800',
  'incomplete': 'bg-yellow-100 text-yellow-800',
  'pending': 'bg-blue-100 text-blue-800',
  '': 'bg-gray-100 text-gray-800'
};
