add_action('rest_api_init', 'register_custom_orders_endpoint');

function register_custom_orders_endpoint() {
    register_rest_route('custom/v1', '/orders', [
        'methods'  => 'GET',
        'callback' => 'get_custom_orders_data',
        'permission_callback' => function() {
            return current_user_can('edit_shop_orders'); // Solo usuarios con permisos de pedidos
        }
    ]);
}

function get_custom_orders_data($request) {
    $params = $request->get_params();
    $page = isset($params['page']) ? intval($params['page']) : 1;
    $per_page = isset($params['per_page']) ? intval($params['per_page']) : 10;
    $status = isset($params['status']) ? sanitize_text_field($params['status']) : 'any';

    $args = [
        'status'      => $status,
        'limit'      => $per_page,
        'paginate'   => true,
        'page'       => $page,
        'return'     => 'objects',
    ];

    $orders = wc_get_orders($args);
    $data = [];

    foreach ($orders->orders as $order) {
        $order_data = $order->get_data();
        $fotos_garantia = get_post_meta($order->get_id(), '_fotos_garantia', true);
        $fotos_urls = [];

        if (!empty($fotos_garantia) && is_array($fotos_garantia)) {
            foreach ($fotos_garantia as $foto_id) {
                $fotos_urls[] = wp_get_attachment_url($foto_id);
            }
        }

        $data[] = [
            'id'                 => $order->get_id(),
            'status'             => $order->get_status(),
            'date_created'       => $order->get_date_created()->date('Y-m-d H:i:s'),
            'billing'            => $order->get_billing(),
            'shipping'           => $order->get_shipping(),
            'line_items'         => array_map(function($item) {
                return [
                    'product_id'   => $item->get_product_id(),
                    'name'        => $item->get_name(),
                    'quantity'    => $item->get_quantity(),
                    'price'       => $item->get_price(),
                ];
            }, $order->get_items()),
            'fotos_garantia'     => $fotos_urls,
            'correo_enviado'     => get_post_meta($order->get_id(), '_correo_enviado', true),
            'pago_completo'      => get_post_meta($order->get_id(), '_pago_completo', true),
            'total'              => $order->get_total(),
        ];
    }

    return new WP_REST_Response([
        'orders'       => $data,
        'total'       => $orders->total,
        'total_pages' => $orders->max_num_pages,
    ], 200);
}