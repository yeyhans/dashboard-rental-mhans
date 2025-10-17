import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

/**
 * External API for Contract PDF Generation
 * Called by frontend (VPS Hostinger) to generate contract PDFs using backend (Vercel)
 * Follows the same pattern as generate-budget-pdf.ts but for user contracts
 */

// Helper function to get CORS headers with proper origin handling
const getCorsHeaders = (origin: string | null) => {
  const allowedOrigins = [
    'http://localhost:4321', // Frontend development server
    'http://localhost:3000', // Alternative frontend port
    import.meta.env.PUBLIC_FRONTEND_URL || 'http://localhost:4321'
  ].filter(Boolean);
  
  const originAllowed = allowedOrigins.includes(origin || '') ? origin : allowedOrigins[0];
  
  return {
    'Access-Control-Allow-Origin': originAllowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
};

// Contract data interface
interface ContractUserData {
  user_id: number;
  auth_uid?: string;
  email: string;
  nombre: string;
  apellido: string;
  usuario?: string;
  rut: string;
  direccion: string;
  ciudad: string;
  pais?: string;
  tipo_cliente?: string;
  telefono: string;
  instagram?: string;
  fecha_nacimiento?: string;
  empresa_nombre?: string;
  empresa_rut?: string;
  empresa_ciudad?: string;
  empresa_direccion?: string;
  terminos_aceptados?: boolean;
  // File URLs (will be updated by this API)
  url_rut_anverso?: string;
  url_rut_reverso?: string;
  url_firma?: string;
  url_empresa_erut?: string;
  new_url_e_rut_empresa?: string;
}

interface ContractGenerationRequest {
  userData: ContractUserData;
  uploadToR2: boolean;
  sendEmail?: boolean;
}

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  try {
    console.log('🌍 External contract PDF generation API called');
    console.log('📋 Request origin:', origin);
    
    // Parse request body
    const requestBody: ContractGenerationRequest = await request.json();
    const { userData, uploadToR2 } = requestBody;
    // ALWAYS send email when generating contracts
    const sendEmail = true;

    console.log('📋 Contract generation request:', {
      user_id: userData.user_id,
      email: userData.email,
      nombre: userData.nombre,
      apellido: userData.apellido,
      rut: userData.rut,
      uploadToR2,
      sendEmail: sendEmail,
      note: 'Email sending is ALWAYS enabled for contracts'
    });

    // Validate required data
    if (!userData.user_id || !userData.email || !userData.nombre || !userData.apellido) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Datos de usuario requeridos: user_id, email, nombre, apellido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Initialize Supabase client with service role
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL!,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('🔍 Checking if user profile exists in database...');
    
    // Check if user profile exists
    let { data: existingProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userData.user_id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ Error checking user profile:', profileError);
      return new Response(JSON.stringify({
        success: false,
        message: 'Error al verificar perfil de usuario'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (!existingProfile) {
      console.log('📝 User profile does not exist, creating new profile in database...');
      
      // Prepare user profile data for Supabase insertion using actual table schema
      const supabaseUserData = {
        user_id: userData.user_id,
        auth_uid: userData.auth_uid || null,
        email: userData.email,
        nombre: userData.nombre,
        apellido: userData.apellido,
        usuario: userData.usuario || null,
        rut: userData.rut,
        direccion: userData.direccion,
        ciudad: userData.ciudad,
        pais: userData.pais || 'Chile',
        tipo_cliente: userData.tipo_cliente || 'particular',
        telefono: userData.telefono,
        instagram: userData.instagram || null,
        fecha_nacimiento: userData.fecha_nacimiento || null,
        empresa_nombre: userData.empresa_nombre || null,
        empresa_rut: userData.empresa_rut || null,
        empresa_ciudad: userData.empresa_ciudad || null,
        empresa_direccion: userData.empresa_direccion || null,
        url_rut_anverso: userData.url_rut_anverso || null,
        url_rut_reverso: userData.url_rut_reverso || null,
        url_firma: userData.url_firma || null,
        url_empresa_erut: userData.url_empresa_erut || null,
        new_url_e_rut_empresa: userData.new_url_e_rut_empresa || null,
        terminos_aceptados: userData.terminos_aceptados || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: newProfile, error: insertError } = await supabase
        .from('user_profiles')
        .insert(supabaseUserData)
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error creating user profile:', insertError);
        return new Response(JSON.stringify({
          success: false,
          message: 'Error al crear perfil de usuario en base de datos',
          error: insertError.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      console.log('✅ User profile created successfully in database');
      existingProfile = newProfile;
    } else {
      console.log('✅ User profile already exists in database');
      
      // Update existing profile with new data
      const updatedData = {
        email: userData.email,
        nombre: userData.nombre,
        apellido: userData.apellido,
        rut: userData.rut,
        direccion: userData.direccion,
        ciudad: userData.ciudad,
        telefono: userData.telefono,
        empresa_nombre: userData.empresa_nombre || existingProfile.empresa_nombre,
        empresa_rut: userData.empresa_rut || existingProfile.empresa_rut,
        empresa_ciudad: userData.empresa_ciudad || existingProfile.empresa_ciudad,
        empresa_direccion: userData.empresa_direccion || existingProfile.empresa_direccion,
        terminos_aceptados: userData.terminos_aceptados ?? existingProfile.terminos_aceptados,
        updated_at: new Date().toISOString()
      };

      const { data: updatedProfile, error: updateError } = await supabase
        .from('user_profiles')
        .update(updatedData)
        .eq('user_id', userData.user_id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating user profile:', updateError);
        return new Response(JSON.stringify({
          success: false,
          message: 'Error al actualizar perfil de usuario',
          error: updateError.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      console.log('✅ User profile updated successfully');
      existingProfile = updatedProfile;
    }

    // Generate PDF using direct internal API call (similar to budget PDF)
    console.log('📄 Generating contract PDF using direct internal API call...');
    
    const baseUrl = new URL(request.url).origin;
    const internalApiUrl = `${baseUrl}/api/contracts/generate-pdf`;
    
    console.log('🔗 Calling internal contract PDF API:', internalApiUrl);
    
    // Make direct internal call to the contract PDF generation API
    const pdfResponse = await fetch(internalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Request': 'true',
        'X-External-Source': 'frontend'
      },
      body: JSON.stringify({
        userData: {
          ...userData,
          ...existingProfile
        },
        uploadToR2,
        sendEmail
      })
    });

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error('❌ Internal contract PDF API failed:', pdfResponse.status, errorText);
      return new Response(JSON.stringify({
        success: false,
        message: 'Error al generar contrato PDF desde API interna',
        error: `Internal API error: ${pdfResponse.status} ${errorText}`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const pdfResult = await pdfResponse.json();

    if (!pdfResult.success) {
      console.error('❌ Backend contract PDF generation failed:', pdfResult.error);
      return new Response(JSON.stringify({
        success: false,
        message: pdfResult.message || 'Error al generar PDF de contrato',
        error: pdfResult.error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log('✅ External contract PDF generation completed successfully');
    
    // Return success response with contract PDF URL
    return new Response(JSON.stringify({
      success: true,
      message: 'Contrato PDF generado exitosamente',
      contractUrl: pdfResult.contractUrl,
      pdfUrl: pdfResult.contractUrl, // For compatibility
      metadata: {
        user_id: userData.user_id,
        email: userData.email,
        generatedAt: new Date().toISOString(),
        generated_via: 'external-backend',
        frontend_source: 'vps-hostinger',
        backend_service: 'vercel'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('💥 External contract PDF generation error:', error);
    
    const origin = request.headers.get('Origin');
    const errorCorsHeaders = getCorsHeaders(origin);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Error interno del servidor al generar contrato',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...errorCorsHeaders }
    });
  }
};

// Handle preflight OPTIONS requests for CORS
export const OPTIONS: APIRoute = async ({ request }) => {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
};
