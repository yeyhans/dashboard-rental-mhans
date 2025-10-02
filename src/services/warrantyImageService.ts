interface WarrantyImageUploadResponse {
  success: boolean;
  message: string;
  urls?: string[];
  orderId?: string | number;
  totalImages?: number;
  error?: string;
}

export class WarrantyImageService {
  private static workerUrl = import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL;

  /**
   * Upload multiple warranty images for an order
   */
  static async uploadWarrantyImages(
    orderId: string | number,
    files: File[]
  ): Promise<WarrantyImageUploadResponse> {
    try {
      // Validate inputs
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      if (!files || files.length === 0) {
        throw new Error('At least one file is required');
      }

      // Validate file types
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
      
      for (const file of files) {
        // Safely get file extension
        const fileName = file.name || 'unknown';
        const fileExtension = fileName.toLowerCase().split('.').pop();
        const hasValidType = file.type && allowedTypes.includes(file.type);
        const hasValidExtension = fileExtension && allowedExtensions.includes(`.${fileExtension}`);
        
        if (!hasValidType && !hasValidExtension) {
          throw new Error(`Invalid file type: ${file.type || 'unknown'} (${fileName}). Only JPEG, PNG, and WebP files are allowed.`);
        }
      }

      // Validate file sizes (max 5MB per file for warranty photos)
      const maxSize = 5 * 1024 * 1024; // 5MB
      for (const file of files) {
        if (file.size > maxSize) {
          throw new Error(`File too large: ${file.name || 'unknown'}. Maximum size is 5MB.`);
        }
      }

      // Validate total number of files (max 10 warranty images)
      if (files.length > 10) {
        throw new Error('Maximum 10 warranty images allowed per order');
      }

      // Convert images to WebP format before upload
      console.log(`🔄 Converting ${files.length} images to WebP format...`);
      const webpFiles: File[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue; // Skip undefined files
        
        try {
          const webpFile = await this.convertToWebP(file, 0.85); // 85% quality for warranty photos
          webpFiles.push(webpFile);
          console.log(`✅ Converted ${file.name} to WebP (${this.formatFileSize(file.size)} → ${this.formatFileSize(webpFile.size)})`);
        } catch (error) {
          console.warn(`⚠️ Failed to convert ${file.name} to WebP, using original:`, error);
          webpFiles.push(file);
        }
      }

      // Create FormData
      const formData = new FormData();
      formData.append('orderId', orderId.toString());
      formData.append('type', 'warranty'); // Specify this is for warranty photos
      
      // Append all files
      webpFiles.forEach((file, index) => {
        formData.append('files', file, `warranty_${orderId}_${Date.now()}_${index}.webp`);
      });

      console.log(`📤 Uploading ${webpFiles.length} warranty images for order ${orderId}...`);
      
      // Debug: Log file information
      webpFiles.forEach((file, index) => {
        console.log(`Warranty File ${index + 1}:`, {
          name: file.name || 'undefined',
          type: file.type || 'undefined',
          size: file.size || 'undefined',
          lastModified: file.lastModified || 'undefined'
        });
      });

      // Upload to Cloudflare Worker (using existing warranty photos endpoint)
      const response = await fetch(`${this.workerUrl}/upload-warranty-photos`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result: WarrantyImageUploadResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || result.message || 'Upload failed');
      }

      console.log(`✅ Successfully uploaded ${result.totalImages} warranty images for order ${orderId}`);
      console.log('📸 Warranty Image URLs:', result.urls);

      return result;

    } catch (error) {
      console.error('❌ Error uploading warranty images:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate warranty image files before upload
   */
  static validateWarrantyFiles(files: File[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!files || files.length === 0) {
      errors.push('At least one file is required');
      return { valid: false, errors };
    }

    if (files.length > 10) {
      errors.push('Maximum 10 warranty images allowed per order');
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    files.forEach((file, index) => {
      // Safely get file extension and name
      const fileName = file.name || 'unknown';
      const fileExtension = fileName.toLowerCase().split('.').pop();
      const hasValidType = file.type && allowedTypes.includes(file.type);
      const hasValidExtension = fileExtension && allowedExtensions.includes(`.${fileExtension}`);
      
      if (!hasValidType && !hasValidExtension) {
        errors.push(`File ${index + 1} (${fileName}): Invalid file type (${file.type || 'unknown'}). Only JPEG, PNG, and WebP files are allowed.`);
      }

      if (file.size > maxSize) {
        errors.push(`File ${index + 1} (${fileName}): File too large. Maximum size is 5MB.`);
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
  static async convertToWebP(file: File, quality: number = 0.85): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Optimize image size for warranty photos (max 1920px width/height)
        const maxDimension = 1920;
        let { width, height } = img;
        
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        if (ctx) {
          // Use better image rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const originalName = file.name.replace(/\.[^/.]+$/, '');
              const webpFile = new File([blob], `${originalName}.webp`, {
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

  /**
   * Get warranty photos for an order
   */
  static async getWarrantyPhotos(orderId: string | number): Promise<string[]> {
    try {
      const response = await fetch(`${this.workerUrl}/get-warranty-photos/${orderId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get warranty photos: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        return result.photos || [];
      } else {
        throw new Error(result.error || 'Failed to get warranty photos');
      }
    } catch (error) {
      console.error('Error getting warranty photos:', error);
      return [];
    }
  }

  /**
   * Delete a warranty photo
   */
  static async deleteWarrantyPhoto(orderId: string | number, photoUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.workerUrl}/delete-warranty-photo`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderId.toString(),
          photoUrl
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete warranty photo: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.success || false;
    } catch (error) {
      console.error('Error deleting warranty photo:', error);
      return false;
    }
  }
}
