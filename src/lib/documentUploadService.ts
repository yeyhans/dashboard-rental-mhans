import { makeAuthenticatedRequest } from './authService';

export type DocumentType = 'rut_anverso' | 'rut_reverso' | 'e_rut_empresa' | 'firma';

interface UploadResponse {
  success: boolean;
  url?: string;
  error?: string;
}

interface UpdateProfileResponse {
  success: boolean;
  error?: string;
}

/**
 * Upload a document to Cloudflare R2 via worker
 */
export const uploadDocument = async (
  file: File,
  documentType: DocumentType,
  userId: string
): Promise<UploadResponse> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    formData.append('userId', userId);

    // Use the Cloudflare worker endpoint for file upload
    const workerUrl = import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL || 'https://rental-mhans-worker.your-subdomain.workers.dev';
    const response = await fetch(`${workerUrl}/upload-file-only`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Error HTTP: ${response.status}`
      };
    }

    const data = await response.json();
    
    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Error desconocido al subir documento'
      };
    }

    return {
      success: true,
      url: data.url
    };
  } catch (error) {
    console.error('Error uploading document:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error de conexión'
    };
  }
};

/**
 * Update user profile with document URL via API
 */
export const updateUserProfileWithDocument = async (
  userId: string,
  documentType: DocumentType,
  documentUrl: string,
  sessionToken?: string
): Promise<UpdateProfileResponse> => {
  try {
    // Prepare update data based on document type
    const updateData: Record<string, string> = {};
    
    switch (documentType) {
      case 'rut_anverso':
        updateData.url_rut_anverso = documentUrl;
        break;
      case 'rut_reverso':
        updateData.url_rut_reverso = documentUrl;
        break;
      case 'e_rut_empresa':
        updateData.new_url_e_rut_empresa = documentUrl;
        break;
      case 'firma':
        updateData.url_firma = documentUrl;
        break;
    }

    console.log('📡 Updating user profile:', { userId, documentType, updateData });
    
    if (sessionToken) {
      console.log('🔑 Making API call with provided token:', sessionToken.substring(0, 20) + '...');
    } else {
      console.warn('⚠️ No session token provided, using auth service');
    }

    // First, try to find the user by different methods
    let finalUserId = userId;
    
    // If userId looks like a UUID (auth_uid), try to find the actual user_id
    if (userId.includes('-')) {
      console.log('🔍 UserId appears to be auth_uid, trying to find user_id...');
      try {
        const userLookupResponse = await makeAuthenticatedRequest(`/api/users/by-auth-uid/${userId}`);
        if (userLookupResponse.ok) {
          const userData = await userLookupResponse.json();
          if (userData.user_id) {
            finalUserId = userData.user_id.toString();
            console.log('✅ Found user_id from auth_uid:', { auth_uid: userId, user_id: finalUserId });
          }
        }
      } catch (lookupError) {
        console.warn('⚠️ Could not lookup user by auth_uid, proceeding with original ID');
      }
    }

    // Make API call to update user profile using authenticated request
    const response = await makeAuthenticatedRequest(`/api/users/${finalUserId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });

    console.log('📡 API Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ API Error:', errorData);
      return {
        success: false,
        error: errorData.error || `Error HTTP: ${response.status} - ${errorData.details || 'Error desconocido'}`
      };
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error updating user profile with document:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Upload a document with backend Supabase updates
 */
export const uploadDocumentWithUpdate = async (
  file: File,
  documentType: DocumentType,
  userId: string,
  sessionToken?: string
): Promise<UploadResponse> => {
  try {
    // First upload the document
    const uploadResult = await uploadDocument(file, documentType, userId);
    
    if (!uploadResult.success || !uploadResult.url) {
      return uploadResult;
    }

    // Then update the user profile
    const updateResult = await updateUserProfileWithDocument(userId, documentType, uploadResult.url, sessionToken);
    
    if (!updateResult.success) {
      return {
        success: false,
        error: updateResult.error || 'Error al actualizar perfil'
      };
    }

    return {
      success: true,
      url: uploadResult.url
    };
  } catch (error) {
    console.error('Error in uploadDocumentWithUpdate:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Validate file before upload
 */
export const validateDocumentFile = (file: File): { valid: boolean; error?: string } => {
  // Check file size (5MB max)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'El archivo es demasiado grande. Máximo 5MB permitido.'
    };
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG, WebP) y PDF.'
    };
  }

  return { valid: true };
};

/**
 * Get document type display name
 */
export const getDocumentTypeName = (documentType: DocumentType): string => {
  const names: Record<DocumentType, string> = {
    'rut_anverso': 'RUT Anverso',
    'rut_reverso': 'RUT Reverso',
    'e_rut_empresa': 'E-RUT Empresa',
    'firma': 'Firma'
  };
  
  return names[documentType] || documentType;
};
