import type { APIRoute } from 'astro';
import crypto from 'crypto';

export const post: APIRoute = async ({ request }) => {
  const secret = import.meta.env.WOOCOMMERCE_WEBHOOK_SECRET;
  
  // 1. Verificar firma
  const signature = request.headers.get('x-wc-webhook-signature');
  const body = await request.text();
  
  const hash = crypto
    .createHmac('SHA256', secret)
    .update(body)
    .digest('base64');

  if (hash !== signature) {
    return new Response('Firma inválida', { status: 401 });
  }

  // 2. Procesar datos
  try {
    const data = JSON.parse(body);
    
    // Aquí tu lógica de procesamiento
    console.log('Pedido actualizado:', data.id);
    
    return new Response('Webhook recibido', { status: 200 });
  } catch (error) {
    return new Response('Error procesando webhook', { status: 500 });
  }
};