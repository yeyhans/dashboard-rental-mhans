import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { toast } from 'sonner';
import { Upload, X, Image as ImageIcon, Trash2, Eye } from 'lucide-react';
import { WarrantyImageService } from '../../services/warrantyImageService';

interface WarrantyImageUploadProps {
  orderId: string | number | null;
  currentImages?: string[];
  onImagesUpdate: (images: string[]) => void;
  onFilesSelected?: (files: File[]) => void;
  disabled?: boolean;
}

interface FileWithPreview {
  file: File;
  preview: string;
  id: string;
}

export function WarrantyImageUpload({ 
  orderId, 
  currentImages = [], 
  onImagesUpdate, 
  onFilesSelected,
  disabled = false 
}: WarrantyImageUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || disabled) return;

    const fileArray = Array.from(files);
    
    // Validate files
    const validation = WarrantyImageService.validateWarrantyFiles(fileArray);
    if (!validation.valid) {
      validation.errors.forEach(error => toast.error(error));
      return;
    }

    // Create preview files
    const newFiles: FileWithPreview[] = fileArray.map(file => ({
      file: file,
      preview: URL.createObjectURL(file),
      id: `${file.name}-${Date.now()}-${Math.random()}`
    }));

    // Check total images limit (current + new)
    const totalImages = currentImages.length + selectedFiles.length + newFiles.length;
    if (totalImages > 10) {
      toast.error(`Máximo 10 fotos de garantía permitidas. Actualmente tienes ${currentImages.length} fotos y estás intentando agregar ${newFiles.length} más.`);
      return;
    }

    setSelectedFiles(prev => {
      const updated = [...prev, ...newFiles];
      // Notify parent component about selected files
      if (onFilesSelected) {
        onFilesSelected(updated.map(f => f.file));
      }
      return updated;
    });
  }, [currentImages.length, selectedFiles.length, disabled, onFilesSelected]);

  // Handle drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  }, [handleFileSelect, disabled]);

  // Remove selected file
  const removeSelectedFile = useCallback((fileId: string) => {
    setSelectedFiles(prev => {
      const updated = prev.filter(file => file.id !== fileId);
      // Clean up preview URL
      const fileToRemove = prev.find(file => file.id === fileId);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      // Notify parent component about updated files
      if (onFilesSelected) {
        onFilesSelected(updated.map(f => f.file));
      }
      return updated;
    });
  }, [onFilesSelected]);

  // Remove current image
  const removeCurrentImage = useCallback(async (imageUrl: string) => {
    console.log('🗑️ removeCurrentImage called with:', { orderId, imageUrl });
    
    if (!orderId) {
      console.error('❌ No orderId provided for image deletion');
      toast.error('Error: No se pudo identificar la orden');
      return;
    }
    
    try {
      const success = await WarrantyImageService.deleteWarrantyPhoto(orderId, imageUrl);
      if (success) {
        const updatedImages = currentImages.filter(url => url !== imageUrl);
        onImagesUpdate(updatedImages);
        toast.success('Foto de garantía eliminada');
      } else {
        toast.error('Error al eliminar la foto de garantía');
      }
    } catch (error) {
      console.error('Error deleting warranty photo:', error);
      toast.error('Error al eliminar la foto de garantía');
    }
  }, [currentImages, onImagesUpdate, orderId]);

  // Upload files
  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0 || disabled || !orderId) {
      if (!orderId) {
        toast.error('No se puede subir fotos sin un ID de orden válido');
      }
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const result = await WarrantyImageService.uploadWarrantyImages(orderId, selectedFiles.map(f => f.file));

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success && result.urls) {
        // Update images with new URLs
        const updatedImages = [...currentImages, ...result.urls];
        onImagesUpdate(updatedImages);
        
        // Clear selected files
        selectedFiles.forEach(file => URL.revokeObjectURL(file.preview));
        setSelectedFiles([]);
        // Notify parent component about cleared files
        if (onFilesSelected) {
          onFilesSelected([]);
        }
        
        toast.success(`${result.totalImages} fotos de garantía subidas correctamente`);
      } else {
        throw new Error(result.error || 'Error al subir las fotos de garantía');
      }
    } catch (error) {
      console.error('Error uploading warranty images:', error);
      toast.error(error instanceof Error ? error.message : 'Error al subir las fotos de garantía');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [selectedFiles, orderId, currentImages, onImagesUpdate, disabled, onFilesSelected]);

  // Clear all selected files
  const clearSelectedFiles = useCallback(() => {
    selectedFiles.forEach(file => URL.revokeObjectURL(file.preview));
    setSelectedFiles([]);
    // Notify parent component about cleared files
    if (onFilesSelected) {
      onFilesSelected([]);
    }
  }, [selectedFiles, onFilesSelected]);

  // Open file dialog
  const openFileDialog = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  // View image in new tab
  const viewImage = useCallback((imageUrl: string) => {
    window.open(imageUrl, '_blank');
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Fotos de Garantía
          <Badge variant="outline">
            {currentImages.length + selectedFiles.length}/10
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Images */}
        {currentImages.length > 0 && (
          <div>
            <Label className="text-sm font-medium mb-2 block">Fotos Actuales</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {currentImages.map((imageUrl, index) => (
                <div key={index} className="relative group">
                  <div className="aspect-square bg-muted rounded-lg overflow-hidden border">
                    <img
                      src={imageUrl}
                      alt={`Garantía ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 w-6 p-0"
                      onClick={() => viewImage(imageUrl)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 w-6 p-0"
                      onClick={() => removeCurrentImage(imageUrl)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Subir Nuevas Fotos de Garantía</Label>
          
          {/* Drag and Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={openFileDialog}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {dragActive ? 'Suelta las fotos aquí' : 'Arrastra fotos aquí o haz clic para seleccionar'}
              </p>
              <p className="text-xs text-muted-foreground">
                Formatos soportados: JPEG, PNG, WebP (máx. 5MB por foto)
              </p>
              <p className="text-xs text-muted-foreground">
                Máximo 10 fotos de garantía por orden
              </p>
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
            disabled={disabled}
          />
        </div>

        {/* Selected Files Preview */}
        {selectedFiles.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">
                Archivos Seleccionados ({selectedFiles.length})
              </Label>
              <Button
                size="sm"
                variant="outline"
                onClick={clearSelectedFiles}
                disabled={disabled || isUploading}
              >
                Limpiar Todo
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {selectedFiles.map((file) => (
                <div key={file.id} className="relative group">
                  <div className="aspect-square bg-muted rounded-lg overflow-hidden border">
                    <img
                      src={file.preview}
                      alt={file.file.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute top-2 right-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeSelectedFile(file.id)}
                      disabled={disabled || isUploading}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                    {file.file.name}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1">
                    <div className="text-right">
                      {WarrantyImageService.formatFileSize(file.file.size)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subiendo fotos de garantía...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            {/* Upload Button */}
            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={disabled || isUploading || selectedFiles.length === 0 || !orderId}
                className="flex-1"
              >
                {!orderId 
                  ? 'ID de orden requerido' 
                  : isUploading 
                    ? 'Subiendo...' 
                    : `Subir ${selectedFiles.length} foto${selectedFiles.length > 1 ? 's' : ''} de garantía`
                }
              </Button>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Las fotos se convertirán automáticamente a formato WebP para optimizar el almacenamiento</p>
          <p>• Se recomienda tomar fotos claras del estado de los equipos antes y después del uso</p>
          <p>• Las fotos de garantía son importantes para documentar el estado de los equipos</p>
        </div>
      </CardContent>
    </Card>
  );
}
