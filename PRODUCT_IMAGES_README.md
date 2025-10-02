# Product Image Upload System

## Overview

This system allows administrators to upload and manage product images through a drag-and-drop interface. Images are automatically uploaded to Cloudflare R2 storage and stored in the `products.images` JSONB column in Supabase.

## Features

- **Drag & Drop Interface**: Easy file selection with visual feedback
- **Multiple Image Upload**: Upload up to 10 images per product
- **File Validation**: Automatic validation of file types and sizes
- **Image Preview**: Real-time preview of selected images
- **Progress Tracking**: Visual upload progress indicator
- **Image Management**: Add, remove, and reorder product images
- **Responsive Design**: Works on desktop and mobile devices

## Technical Architecture

### Components

1. **ProductImageUpload.tsx**: Main upload component with drag & drop interface
2. **ProductImageService.ts**: Service for handling image uploads and validation
3. **Cloudflare Worker**: `/upload-product-images` endpoint for R2 storage

### Data Flow

```
ProductDetail.tsx → ProductImageUpload → ProductImageService → Cloudflare Worker → R2 Storage → Supabase
```

### Database Schema

Images are stored in the `products.images` column as a JSONB array:

```json
[
  "https://workers.mariohans.cl/products/123_1704067200000_1.jpg",
  "https://workers.mariohans.cl/products/123_1704067200000_2.png",
  "https://workers.mariohans.cl/products/123_1704067200000_3.webp"
]
```

## Usage

### 1. Access Product Editor

Navigate to `/products/[id]` and click "Editar producto" to enter edit mode.

### 2. Upload Images

In the "Básico" tab, you'll find the "Imágenes del Producto" section:

- **Drag & Drop**: Drag image files directly onto the upload area
- **Click to Select**: Click the upload area to open file browser
- **Multiple Selection**: Select multiple images at once (Ctrl+Click or Shift+Click)

### 3. Manage Images

- **Preview**: View thumbnails of selected images before upload
- **Remove**: Click the X button to remove individual images
- **Upload**: Click "Subir X imágenes" to upload all selected files
- **Delete Current**: Remove existing images using the trash icon

### 4. Save Changes

After uploading images, click "Guardar cambios" to save the product with new images.

## File Requirements

### Supported Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- GIF (.gif)
- BMP (.bmp)

### Size Limits
- **Maximum file size**: 10MB per image
- **Maximum images**: 10 images per product
- **Recommended dimensions**: Minimum 800x800px for best quality

## API Endpoints

### Cloudflare Worker: `/upload-product-images`

**Method**: POST  
**Content-Type**: multipart/form-data

**Parameters**:
- `productId`: Product ID (string/number)
- `files`: Array of image files

**Response**:
```json
{
  "success": true,
  "message": "Successfully uploaded 3 product images",
  "urls": [
    "https://workers.mariohans.cl/products/123_1704067200000_1.jpg",
    "https://workers.mariohans.cl/products/123_1704067200000_2.png"
  ],
  "productId": "123",
  "totalImages": 2
}
```

## File Organization

Images are stored in R2 with the following structure:

```
products/
├── {productId}_{timestamp}_{index}.{extension}
├── 123_1704067200000_1.jpg
├── 123_1704067200000_2.png
└── 456_1704067300000_1.webp
```

## Error Handling

The system includes comprehensive error handling for:

- **Invalid file types**: Shows error message for unsupported formats
- **File size limits**: Prevents upload of files larger than 10MB
- **Network errors**: Displays connection error messages
- **Upload failures**: Provides detailed error information
- **Validation errors**: Client-side validation before upload

## Performance Optimizations

- **Client-side validation**: Prevents unnecessary server requests
- **Progress indicators**: Visual feedback during upload
- **Batch uploads**: Multiple files uploaded in single request
- **Image optimization**: Automatic format optimization (future enhancement)
- **Lazy loading**: Images loaded on demand in preview

## Future Enhancements

1. **WebP Conversion**: Automatic conversion to WebP format for better compression
2. **Image Resizing**: Automatic generation of multiple sizes (thumbnail, medium, large)
3. **Image Optimization**: Compression and quality optimization
4. **Drag & Drop Reordering**: Change image order by dragging
5. **Bulk Operations**: Select and delete multiple images at once
6. **Image Editing**: Basic editing tools (crop, rotate, filters)

## Troubleshooting

### Common Issues

1. **Upload fails with "Network Error"**
   - Check Cloudflare Worker URL in environment variables
   - Verify CORS settings in worker

2. **Images not displaying after upload**
   - Check R2 bucket permissions
   - Verify public URL format

3. **File validation errors**
   - Ensure files are under 10MB
   - Check file format is supported

4. **Progress bar stuck at 90%**
   - This is normal - final 10% represents server processing time

### Debug Information

Enable console logging to see detailed upload information:
- File validation results
- Upload progress
- Server responses
- Error details

## Security Considerations

- **File type validation**: Only image files are accepted
- **Size limits**: Prevents large file uploads
- **Authentication**: Only authenticated users can upload
- **Authorization**: Users can only edit their own products (admin check)
- **Sanitization**: File names are sanitized before storage

## Environment Variables

Ensure these variables are set in your `.env.local`:

```env
PUBLIC_CLOUDFLARE_WORKER_URL=https://your-worker.workers.dev
```
