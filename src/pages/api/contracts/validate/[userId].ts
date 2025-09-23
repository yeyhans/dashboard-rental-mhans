import type { APIRoute } from 'astro';
import { BackendApiService } from '../../../../services/backendApiService';
import { withMiddleware, withCors, withAuth } from '../../../../middleware/auth';

export const GET: APIRoute = withMiddleware(withCors, withAuth)(async (context) => {
  try {
    const userId = parseInt(context.params.userId as string);
    
    if (isNaN(userId)) {
      return new Response(
        JSON.stringify({ error: 'ID de usuario inválido' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const validation = await BackendApiService.validateUserContract(userId);

    return new Response(JSON.stringify(validation), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error validating contract:', error);
    return new Response(
      JSON.stringify({ error: 'Error al validar contrato' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});

export const PUT: APIRoute = withMiddleware(withCors, withAuth)(async (context) => {
  try {
    const userId = parseInt(context.params.userId as string);
    
    if (isNaN(userId)) {
      return new Response(
        JSON.stringify({ error: 'ID de usuario inválido' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const updates = await context.request.json();
    
    const updatedUser = await BackendApiService.updateContractStatus(userId, updates);

    return new Response(JSON.stringify(updatedUser), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating contract status:', error);
    return new Response(
      JSON.stringify({ error: 'Error al actualizar estado del contrato' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
