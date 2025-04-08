<?php
// Asegurarse de que el código se ejecute solo si WordPress está cargado
if (!defined('ABSPATH')) {
    exit;
}

// Registrar el endpoint de la API REST
add_action('rest_api_init', function() {
    register_rest_route('custom/v1', '/orders', [
        'methods' => 'GET',
        'callback' => 'get_custom_orders',
        'permission_callback' => '__return_true' // Temporalmente para pruebas
    ]);
});

// Función de callback para el endpoint
function get_custom_orders($request) {
    // Debugging
    $test_order = wc_get_orders(['limit' => 1]); // Obtiene la primera orden
    if (!empty($test_order)) {
        $test_order = $test_order[0];
        $order_id = $test_order->get_id();
        error_log('=== Debug Order Meta ===');
        error_log('Order ID: ' . $order_id);
        error_log('Fotos Garantia: ' . print_r(get_post_meta($order_id, '_fotos_garantia', true), true));
        error_log('Correo Enviado: ' . print_r(get_post_meta($order_id, '_correo_enviado', true), true));
        error_log('Pago Completo: ' . print_r(get_post_meta($order_id, '_pago_completo', true), true));
    }

    // Verificar si WooCommerce está activo
    if (!class_exists('WooCommerce')) {
        return new WP_Error('woocommerce_required', 
            'WooCommerce no está activo', 
            ['status' => 500]
        );
    }

    try {
        $params = $request->get_params();
        $page = isset($params['page']) ? (int)$params['page'] : 1;
        $per_page = isset($params['per_page']) ? (int)$params['per_page'] : 10;
        $status = isset($params['status']) ? sanitize_text_field($params['status']) : 'any';

        $args = [
            'limit' => $per_page,
            'page' => $page,
            'status' => $status,
            'paginate' => true
        ];

        $orders = wc_get_orders($args);
        $data = [];

        foreach ($orders->orders as $order) {
            $order_id = $order->get_id();
            $fotos_garantia = get_post_meta($order_id, '_fotos_garantia', true);
            $correo_enviado = get_post_meta($order_id, '_correo_enviado', true);
            $pago_completo = get_post_meta($order_id, '_pago_completo', true);

            // Si fotos_garantia es un array, procesamos las URLs
            $fotos_urls = [];
            if (!empty($fotos_garantia) && is_array($fotos_garantia)) {
                foreach ($fotos_garantia as $foto_id) {
                    $foto_url = wp_get_attachment_url($foto_id);
                    if ($foto_url) {
                        $fotos_urls[] = $foto_url;
                    }
                }
            }

            $data[] = [
                'id' => $order_id,
                'status' => $order->get_status(),
                'date_created' => $order->get_date_created()->date('Y-m-d H:i:s'),
                'total' => $order->get_total(),
                'customer' => [
                    'first_name' => $order->get_billing_first_name(),
                    'last_name' => $order->get_billing_last_name(),
                    'email' => $order->get_billing_email()
                ],
                'fotos_garantia' => $fotos_urls,
                'correo_enviado' => $correo_enviado ? true : false,
                'pago_completo' => $pago_completo ? true : false
            ];
        }

        return new WP_REST_Response([
            'success' => true,
            'orders' => $data,
            'total' => $orders->total,
            'total_pages' => $orders->max_num_pages
        ], 200);

    } catch (Exception $e) {
        return new WP_Error(
            'orders_error',
            $e->getMessage(),
            ['status' => 500]
        );
    }
} 