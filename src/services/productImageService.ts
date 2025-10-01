interface ProductImageUploadResponse {
  success: boolean;
  message: string;
  urls?: string[];
  productId?: string;
  totalImages?: number;
  error?: string;
}

export class ProductImageService {
  private static workerUrl = import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL;

  /**
   * Upload multiple images for a product
   */
  static async uploadProductImages(
    productId: string | number,
    files: File[]
  ): Promise<ProductImageUploadResponse> {
    try {
      // Validate inputs
      if (!productId) {
        throw new Error('Product ID is required');
      }

      if (!files || files.length === 0) {
        throw new Error('At least one file is required');
      }

      // Validate file types
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
      
      for (const file of files) {
        // Safely get file extension
        const fileName = file.name || 'unknown';
        const fileExtension = fileName.toLowerCase().split('.').pop();
        const hasValidType = file.type && allowedTypes.includes(file.type);
        const hasValidExtension = fileExtension && allowedExtensions.includes(`.${fileExtension}`);
        
        if (!hasValidType && !hasValidExtension) {
          throw new Error(`Invalid file type: ${file.type || 'unknown'} (${fileName}). Only image files are allowed.`);
        }
      }

      // Validate file sizes (max 10MB per file)
      const maxSize = 10 * 1024 * 1024; // 10MB
      for (const file of files) {
        if (file.size > maxSize) {
          throw new Error(`File too large: ${file.name || 'unknown'}. Maximum size is 10MB.`);
        }
      }

      // Validate total number of files (max 10 images)
      if (files.length > 10) {
        throw new Error('Maximum 10 images allowed per product');
      }

      // Create FormData
      const formData = new FormData();
      formData.append('productId', productId.toString());
      
      // Append all files
      files.forEach((file) => {
        formData.append('files', file);
      });

      console.log(`📤 Uploading ${files.length} images for product ${productId}...`);
      
      // Debug: Log file information
      files.forEach((file, index) => {
        console.log(`File ${index + 1}:`, {
          name: file.name || 'undefined',
          type: file.type || 'undefined',
          size: file.size || 'undefined',
          lastModified: file.lastModified || 'undefined',
          constructor: file.constructor.name,
          isFile: file instanceof File,
          hasArrayBuffer: typeof file.arrayBuffer === 'function'
        });
      });

      // Upload to Cloudflare Worker
      const response = await fetch(`${this.workerUrl}/upload-product-images`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result: ProductImageUploadResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || result.message || 'Upload failed');
      }

      console.log(`✅ Successfully uploaded ${result.totalImages} images for product ${productId}`);
      console.log('📸 Image URLs:', result.urls);

      return result;

    } catch (error) {
      console.error('❌ Error uploading product images:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate image files before upload
   */
  static validateImageFiles(files: File[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!files || files.length === 0) {
      errors.push('At least one file is required');
      return { valid: false, errors };
    }

    if (files.length > 10) {
      errors.push('Maximum 10 images allowed per product');
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    files.forEach((file, index) => {
      // Safely get file extension and name
      const fileName = file.name || 'unknown';
      const fileExtension = fileName.toLowerCase().split('.').pop();
      const hasValidType = file.type && allowedTypes.includes(file.type);
      const hasValidExtension = fileExtension && allowedExtensions.includes(`.${fileExtension}`);
      
      if (!hasValidType && !hasValidExtension) {
        errors.push(`File ${index + 1} (${fileName}): Invalid file type (${file.type || 'unknown'}). Only image files are allowed.`);
      }

      if (file.size > maxSize) {
        errors.push(`File ${index + 1} (${fileName}): File too large. Maximum size is 10MB.`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Convert file to WebP format (client-side)
   */
  static async convertToWebP(file: File, quality: number = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const webpFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              resolve(webpFile);
            } else {
              reject(new Error('Failed to convert image to WebP'));
            }
          }, 'image/webp', quality);
        } else {
          reject(new Error('Failed to get canvas context'));
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }
}
