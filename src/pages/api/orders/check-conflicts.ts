import type { APIRoute } from 'astro';
import { OrderService } from '../../../services/orderService';
import { supabaseAdmin } from '../../../lib/supabase';
import type { Database } from '../../../types/database';

// Enhanced types for better product information
type DatabaseProduct = Database['public']['Tables']['products']['Row'];

// Enhanced interface for detailed conflict information with professional product details
interface EnhancedProductConflict {
  orderId: number;
  orderProject: string;
  startDate: string;
  endDate: string;
  status: string;
  customerName: string;
  customerEmail: string;
  workDays: number;
  overlapDays: number;
  overlapPercentage: number;
  conflictSeverity: 'low' | 'medium' | 'high' | 'critical';
  conflictingProducts: Array<{
    productId: number;
    productName: string;
    productSku?: string;
    productImages?: string[];
    productDescription?: string;
    productStockStatus?: string;
    productPrice?: number;
    quantity: number;
    conflictType: 'full' | 'partial';
    availabilityStatus: 'unavailable' | 'partially_available' | 'requires_coordination';
  }>;
  orderDetails: {
    totalValue: number;
    currency: string;
    createdDate: string;
    lastModified: string;
    orderUrl?: string;
  };
  resolutionSuggestions: {
    canReschedule: boolean;
    alternativeDates?: string[];
    canShareEquipment: boolean;
    contactRequired: boolean;
    priority: 'low' | 'medium' | 'high';
  };
}

// Helper function to calculate date overlap
function calculateDateOverlap(start1: Date, end1: Date, start2: Date, end2: Date) {
  const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
  const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));
  
  if (overlapStart <= overlapEnd) {
    const overlapDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const totalDays1 = Math.ceil((end1.getTime() - start1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const overlapPercentage = Math.round((overlapDays / totalDays1) * 100);
    
    return { overlapDays, overlapPercentage };
  }
  
  return { overlapDays: 0, overlapPercentage: 0 };
}

// Helper function to calculate work days
function calculateWorkDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { currentOrderId, productIds, startDate, endDate } = body;

    // Enhanced parameter validation
    const validationErrors: string[] = [];
    
    // Validate and convert currentOrderId
    let validCurrentOrderId: number = 0;
    if (!currentOrderId) {
      validationErrors.push('currentOrderId es requerido');
    } else {
      const numOrderId = typeof currentOrderId === 'string' ? parseInt(currentOrderId, 10) : 
                        typeof currentOrderId === 'number' ? currentOrderId : NaN;
      
      if (isNaN(numOrderId) || numOrderId <= 0) {
        validationErrors.push(`currentOrderId debe ser un número válido, recibido: ${JSON.stringify(currentOrderId)}`);
      } else {
        validCurrentOrderId = numOrderId;
      }
    }
    
    // Validate and convert productIds
    let validProductIds: number[] = [];
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      validationErrors.push('productIds debe ser un array no vacío');
    } else {
      const invalidProductIds: any[] = [];
      
      productIds.forEach(id => {
        const numId = typeof id === 'string' ? parseInt(id, 10) : 
                     typeof id === 'number' ? id : NaN;
        
        if (!isNaN(numId) && numId > 0) {
          validProductIds.push(numId);
        } else {
          invalidProductIds.push(id);
        }
      });
      
      if (validProductIds.length === 0) {
        validationErrors.push(`No se encontraron productIds válidos. IDs inválidos: ${JSON.stringify(invalidProductIds)}`);
      }
    }
    
    if (!startDate || typeof startDate !== 'string') {
      validationErrors.push('startDate debe ser una fecha válida en formato string');
    } else if (isNaN(Date.parse(startDate))) {
      validationErrors.push('startDate debe ser una fecha válida');
    }
    
    if (!endDate || typeof endDate !== 'string') {
      validationErrors.push('endDate debe ser una fecha válida en formato string');
    } else if (isNaN(Date.parse(endDate))) {
      validationErrors.push('endDate debe ser una fecha válida');
    }
    
    // Check if start date is before end date
    if (startDate && endDate && !isNaN(Date.parse(startDate)) && !isNaN(Date.parse(endDate))) {
      if (new Date(startDate) > new Date(endDate)) {
        validationErrors.push('La fecha de inicio debe ser anterior a la fecha de término');
      }
    }

    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Errores de validación en los parámetros',
          errors: validationErrors,
          data: []
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Get enhanced conflict information using validated parameters
    const basicConflicts = await OrderService.checkProductConflicts(
      validCurrentOrderId,
      validProductIds,
      startDate,
      endDate
    );

    // Enhance conflicts with additional details including product information
    const enhancedConflicts: EnhancedProductConflict[] = [];
    
    // Get all unique product IDs from conflicts to fetch product details in batch
    const allProductIds = [...new Set(basicConflicts.flatMap(c => 
      c.conflictingProducts.map(p => p.productId)
    ))];
    
    // Fetch product details in batch for better performance
    const { data: productsData, error: productsError } = supabaseAdmin
      ? await supabaseAdmin
          .from('products')
          .select('id, name, sku, images, description, short_description, stock_status, price')
          .in('id', allProductIds)
      : { data: null, error: new Error('Supabase client not available') };
    
    if (productsError) {
      console.warn('Could not fetch product details:', productsError);
    }
    
    // Create a map for quick product lookup
    const productsMap = new Map<number, DatabaseProduct>();
    if (productsData) {
      productsData.forEach(product => {
        productsMap.set(product.id, product);
      });
    }
    
    for (const conflict of basicConflicts) {
      try {
        // Get additional order details
        const { data: orderDetails, error } = supabaseAdmin
          ? await supabaseAdmin
              .from('orders')
              .select('calculated_total, currency, date_created, date_modified')
              .eq('id', conflict.orderId)
              .single()
          : { data: null, error: new Error('Supabase client not available') };

        if (error) {
          console.warn(`Could not fetch details for order ${conflict.orderId}:`, error);
        }

        // Calculate overlap information
        const currentStart = new Date(startDate);
        const currentEnd = new Date(endDate);
        const conflictStart = new Date(conflict.startDate);
        const conflictEnd = new Date(conflict.endDate);
        
        const { overlapDays, overlapPercentage } = calculateDateOverlap(
          currentStart, currentEnd, conflictStart, conflictEnd
        );
        
        const workDays = calculateWorkDays(conflict.startDate, conflict.endDate);

        // Enhance conflicting products with detailed information
        const enhancedProducts = conflict.conflictingProducts.map(product => {
          const productDetails = productsMap.get(product.productId);
          
          // Parse product images
          let productImages: string[] = [];
          if (productDetails?.images) {
            try {
              const parsed = typeof productDetails.images === 'string' 
                ? JSON.parse(productDetails.images) 
                : productDetails.images;
              
              if (Array.isArray(parsed)) {
                productImages = parsed.map(img => 
                  typeof img === 'string' ? img : img.src || img.url || ''
                ).filter(Boolean);
              } else if (parsed?.src || parsed?.url) {
                productImages = [parsed.src || parsed.url];
              }
            } catch (e) {
              console.warn('Error parsing product images:', e);
            }
          }
          
          // Determine conflict severity and availability status
          const conflictType = overlapPercentage === 100 ? 'full' : 'partial';
          const availabilityStatus = 
            overlapPercentage === 100 ? 'unavailable' :
            overlapPercentage > 50 ? 'requires_coordination' : 'partially_available';
          
          return {
            ...product,
            productSku: productDetails?.sku || '',
            productImages,
            productDescription: productDetails?.description || '',
            productStockStatus: productDetails?.stock_status || 'unknown',
            productPrice: productDetails?.price || 0,
            conflictType: conflictType as 'full' | 'partial',
            availabilityStatus: availabilityStatus as 'unavailable' | 'partially_available' | 'requires_coordination'
          };
        });
        
        // Calculate conflict severity based on overlap and number of products
        const conflictSeverity = 
          overlapPercentage === 100 ? 'critical' :
          overlapPercentage > 75 ? 'high' :
          overlapPercentage > 50 ? 'medium' : 'low';
        
        // Generate resolution suggestions
        const resolutionSuggestions = {
          canReschedule: overlapPercentage < 100,
          alternativeDates: overlapPercentage > 50 ? [
            // Suggest dates before the conflict
            new Date(new Date(startDate).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            // Suggest dates after the conflict
            new Date(new Date(endDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          ] : undefined,
          canShareEquipment: overlapPercentage < 50 && conflict.conflictingProducts.length === 1,
          contactRequired: overlapPercentage > 25,
          priority: (overlapPercentage > 75 ? 'high' : overlapPercentage > 50 ? 'medium' : 'low') as 'low' | 'medium' | 'high'
        };

        enhancedConflicts.push({
          ...conflict,
          workDays,
          overlapDays,
          overlapPercentage,
          conflictSeverity,
          conflictingProducts: enhancedProducts,
          orderDetails: {
            totalValue: orderDetails?.calculated_total || 0,
            currency: orderDetails?.currency || 'CLP',
            createdDate: orderDetails?.date_created || '',
            lastModified: orderDetails?.date_modified || '',
            orderUrl: `/orders/${conflict.orderId}`
          },
          resolutionSuggestions
        });
      } catch (enhanceError) {
        console.warn(`Error enhancing conflict for order ${conflict.orderId}:`, enhanceError);
        // Fallback to basic conflict info
        enhancedConflicts.push({
          ...conflict,
          workDays: calculateWorkDays(conflict.startDate, conflict.endDate),
          overlapDays: 0,
          overlapPercentage: 0,
          conflictSeverity: 'low',
          conflictingProducts: conflict.conflictingProducts.map(p => ({ 
            ...p, 
            conflictType: 'partial' as const,
            availabilityStatus: 'partially_available' as const
          })),
          orderDetails: {
            totalValue: 0,
            currency: 'CLP',
            createdDate: '',
            lastModified: '',
            orderUrl: `/orders/${conflict.orderId}`
          },
          resolutionSuggestions: {
            canReschedule: true,
            canShareEquipment: false,
            contactRequired: false,
            priority: 'low'
          }
        });
      }
    }

    // Generate comprehensive summary with professional insights
    const conflictingOrderIds = [...new Set(enhancedConflicts.map(c => c.orderId))];
    const conflictingProductIds = [...new Set(enhancedConflicts.flatMap(c => c.conflictingProducts.map(p => p.productId)))];
    
    const summary = {
      totalConflicts: enhancedConflicts.length,
      conflictingOrders: conflictingOrderIds,
      conflictingProducts: conflictingProductIds,
      dateRange: {
        requested: { start: startDate, end: endDate },
        workDays: calculateWorkDays(startDate, endDate)
      },
      severityLevel: enhancedConflicts.length === 0 ? 'none' : 
                   enhancedConflicts.some(c => c.conflictSeverity === 'critical') ? 'critical' :
                   enhancedConflicts.some(c => c.conflictSeverity === 'high') ? 'high' : 
                   enhancedConflicts.some(c => c.conflictSeverity === 'medium') ? 'medium' : 'low',
      impactAnalysis: {
        totalAffectedProducts: conflictingProductIds.length,
        totalAffectedOrders: conflictingOrderIds.length,
        criticalConflicts: enhancedConflicts.filter(c => c.conflictSeverity === 'critical').length,
        highPriorityConflicts: enhancedConflicts.filter(c => c.conflictSeverity === 'high').length,
        averageOverlapPercentage: enhancedConflicts.length > 0 
          ? Math.round(enhancedConflicts.reduce((sum, c) => sum + c.overlapPercentage, 0) / enhancedConflicts.length)
          : 0,
        requiresImmediateAttention: enhancedConflicts.some(c => c.conflictSeverity === 'critical' || c.conflictSeverity === 'high'),
        canBeResolved: enhancedConflicts.every(c => c.resolutionSuggestions.canReschedule || c.resolutionSuggestions.canShareEquipment)
      },
      recommendations: {
        primaryAction: enhancedConflicts.length === 0 ? 'none' :
                      enhancedConflicts.some(c => c.conflictSeverity === 'critical') ? 'reschedule_required' :
                      enhancedConflicts.some(c => c.conflictSeverity === 'high') ? 'coordination_required' : 'monitoring_recommended',
        contactCustomers: enhancedConflicts.filter(c => c.resolutionSuggestions.contactRequired).map(c => c.orderId),
        alternativeProducts: conflictingProductIds.length < validProductIds.length,
        urgencyLevel: enhancedConflicts.some(c => c.conflictSeverity === 'critical') ? 'immediate' :
                     enhancedConflicts.some(c => c.conflictSeverity === 'high') ? 'high' : 'normal'
      }
    };

    const message = enhancedConflicts.length === 0 
      ? 'No se encontraron conflictos de disponibilidad para los productos en las fechas especificadas'
      : `Se encontraron ${enhancedConflicts.length} conflicto${enhancedConflicts.length !== 1 ? 's' : ''} de disponibilidad. Nivel de severidad: ${summary.severityLevel.toUpperCase()}`;

    return new Response(
      JSON.stringify({
        success: true,
        data: enhancedConflicts,
        summary,
        message,
        timestamp: new Date().toISOString(),
        requestInfo: {
          currentOrderId: validCurrentOrderId,
          productIds: validProductIds,
          dateRange: { startDate, endDate }
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error checking product conflicts:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error interno del servidor al verificar conflictos de productos',
        error: error instanceof Error ? error.message : 'Error desconocido',
        data: [],
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
};

// Support other HTTP methods with proper responses
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      success: false,
      message: 'Este endpoint requiere una petición POST con datos de conflicto de productos',
      requiredParameters: {
        currentOrderId: 'number - ID de la orden actual',
        productIds: 'number[] - Array de IDs de productos a verificar',
        startDate: 'string - Fecha de inicio en formato ISO',
        endDate: 'string - Fecha de término en formato ISO'
      }
    }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'POST'
      }
    }
  );
};

export const PUT: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      success: false,
      message: 'Método PUT no soportado. Use POST para verificar conflictos de productos'
    }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'POST'
      }
    }
  );
};

export const DELETE: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      success: false,
      message: 'Método DELETE no soportado. Use POST para verificar conflictos de productos'
    }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'POST'
      }
    }
  );
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Allow': 'POST, OPTIONS',
      'Content-Type': 'application/json'
    }
  });
};
