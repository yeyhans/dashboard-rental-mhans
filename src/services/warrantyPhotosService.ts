/**
 * Service for handling warranty photos upload to Cloudflare R2
 */

export interface WarrantyPhotosUploadResult {
  success: boolean;
  message?: string;
  urls?: string[];
  orderId?: string;
  totalPhotos?: number;
  error?: string;
}

export class WarrantyPhotosService {
  private workerUrl: string;

  constructor(workerUrl?: string) {
    this.workerUrl = workerUrl || import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL || '';
  }

  /**
   * Upload warranty photos for an order
   * @param orderId - The order ID
   * @param files - Array of image files to upload
   * @returns Promise with upload result
   */
  async uploadWarrantyPhotos(orderId: string | number, files: File[]): Promise<WarrantyPhotosUploadResult> {
    try {
      if (!this.workerUrl) {
        throw new Error('Cloudflare Worker URL not configured');
      }

      if (!files || files.length === 0) {
        throw new Error('No files provided');
      }

      // Validate file types
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      for (const file of files) {
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`Invalid file type: ${file.type}. Only JPEG, PNG, and WebP are allowed.`);
        }
      }

      // Validate file sizes (max 5MB per file)
      const maxSize = 5 * 1024 * 1024; // 5MB
      for (const file of files) {
        if (file.size > maxSize) {
          throw new Error(`File "${file.name}" is too large. Maximum size is 5MB.`);
        }
      }

      // Step 1: Upload files to R2 via Cloudflare Worker
      const formData = new FormData();
      formData.append('orderId', orderId.toString());
      
      // Append all files
      files.forEach((file) => {
        formData.append('files', file);
      });

      // Upload to Cloudflare Worker (R2 only)
      const workerResponse = await fetch(`${this.workerUrl}/upload-warranty-photos-only`, {
        method: 'POST',
        body: formData,
      });

      const workerResult = await workerResponse.json() as WarrantyPhotosUploadResult;

      if (!workerResponse.ok) {
        throw new Error(workerResult.error || `Worker error! status: ${workerResponse.status}`);
      }

      if (!workerResult.success || !workerResult.urls) {
        throw new Error(workerResult.error || 'Failed to upload files to R2');
      }

      // Step 2: Update database via backend API
      const backendResponse = await fetch(`/api/orders/${orderId}/warranty-photos`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photoUrls: workerResult.urls
        }),
      });

      const backendResult = await backendResponse.json();

      if (!backendResponse.ok) {
        throw new Error(backendResult.error || `Backend error! status: ${backendResponse.status}`);
      }

      if (!backendResult.success) {
        throw new Error(backendResult.error || 'Failed to update database');
      }

      return {
        success: true,
        message: `Successfully uploaded ${files.length} warranty photos`,
        urls: workerResult.urls,
        orderId: orderId.toString(),
        totalPhotos: files.length
      };

    } catch (error) {
      console.error('Error uploading warranty photos:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Validate image files before upload
   * @param files - Array of files to validate
   * @returns Validation result with errors if any
   */
  validateFiles(files: File[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    const maxFiles = 10; // Maximum 10 photos per order

    if (!files || files.length === 0) {
      errors.push('No files selected');
      return { valid: false, errors };
    }

    if (files.length > maxFiles) {
      errors.push(`Too many files. Maximum ${maxFiles} photos allowed.`);
    }

    files.forEach((file, index) => {
      // Check file type
      if (!allowedTypes.includes(file.type)) {
        errors.push(`File ${index + 1} (${file.name}): Invalid file type. Only JPEG, PNG, and WebP are allowed.`);
      }

      // Check file size
      if (file.size > maxSize) {
        errors.push(`File ${index + 1} (${file.name}): File too large. Maximum size is 5MB.`);
      }

      // Check if file is actually an image
      if (!file.type.startsWith('image/')) {
        errors.push(`File ${index + 1} (${file.name}): Not an image file.`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get file size in human readable format
   * @param bytes - File size in bytes
   * @returns Formatted file size string
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export singleton instance
export const warrantyPhotosService = new WarrantyPhotosService();
