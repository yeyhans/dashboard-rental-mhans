// Shortcode para mostrar todos los pedidos en el frontend
function shortcode_pedidos_procesados() {
    ob_start(); // Iniciar el buffer de salida

    // Verificar si el usuario actual es un administrador
    if (current_user_can('manage_options')) {
        mostrar_todos_los_pedidos_frontend();
    } else {
        echo '<script>console.log("Usuario no tiene permisos para ver esta página.");</script>'; // Mensaje en la consola del navegador
        echo '<p>No tienes permisos para ver esta página.</p>';
    }

    return ob_get_clean(); // Devolver el contenido del buffer
}
add_shortcode('pedidos_procesados', 'shortcode_pedidos_procesados');



function mostrar_todos_los_pedidos_frontend() {
    echo '<div class="wrap">';
    echo '<h1>Todos los Pedidos</h1>';
    
    // Obtener parámetros de filtrado
    $filtro_id = isset($_GET['filter_id']) ? sanitize_text_field($_GET['filter_id']) : '';
    $filtro_estado = isset($_GET['filter_status']) ? sanitize_text_field($_GET['filter_status']) : 'all';
    $filtro_correo = isset($_GET['filter_email']) ? sanitize_text_field($_GET['filter_email']) : 'all';

    // Formulario de Filtros
    echo '<div class="filtros-pedidos">';
    echo '<form method="get" class="filtros-form">';
    echo '<input type="text" name="filter_id" placeholder="Buscar por ID" value="' . esc_attr($filtro_id) . '">';
    
    // Selector de Estado (versión corregida)
echo '<select name="filter_status">';
echo '<option value="all"' . selected($filtro_estado, 'all', false) . '>Todos los estados</option>';

foreach (wc_get_order_statuses() as $status_slug => $status_label) {
    // Convertir slug completo a formato básico (ej: wc-completed → completed)
    $clean_status = str_replace('wc-', '', $status_slug);
    
    // Obtener versión traducida del slug básico
    $translated_status = wc_get_order_status_name($clean_status);
    
    echo '<option value="' . esc_attr($clean_status) . '"' . selected($filtro_estado, $clean_status, false) . '>';
    echo esc_html($translated_status);
    echo '</option>';
}

echo '</select>';
    
    // Selector de Estado Correo
    echo '<select name="filter_email">';
    echo '<option value="all"' . selected($filtro_correo, 'all', false) . '>Estado del correo</option>';
    echo '<option value="sent"' . selected($filtro_correo, 'sent', false) . '>Enviados</option>';
    echo '<option value="unsent"' . selected($filtro_correo, 'unsent', false) . '>No enviados</option>';
    echo '</select>';
    
    echo '<button type="submit" class="button">Filtrar</button>';
    echo '</form>';
    echo '</div>';

    // Obtener y filtrar pedidos
    $orders = obtener_todos_los_pedidos();
    $filtered_orders = array_filter($orders, function($order) use ($filtro_id, $filtro_estado, $filtro_correo) {
        $match = true;
        
        if ($filtro_id && $order->get_id() != $filtro_id) $match = false;
        
        if ($filtro_estado != 'all' && $order->get_status() != $filtro_estado) $match = false;
        
        $correo_enviado = get_post_meta($order->get_id(), '_correo_enviado', true);
        if ($filtro_correo == 'sent' && !$correo_enviado) $match = false;
        if ($filtro_correo == 'unsent' && $correo_enviado) $match = false;
        
        return $match;
    });

    // Mostrar resultados
    if (!empty($filtered_orders)) {
        echo '<div class="tabla-pedidos-container">';
        echo '<table class="tabla-pedidos">';
        echo '<thead><tr>
                <th data-label="ID">ID</th>
                <th data-label="Estado">Estado</th>
                <th data-label="Fotos">Fotos</th>
                <th data-label="Correo">Correo</th>
                <th data-label="Pago">Estado de Pago</th>
              </tr></thead>';
        echo '<tbody>';

        foreach ($filtered_orders as $order) {
            if ($order instanceof WC_Order) {
                mostrar_fila_pedido($order);
            }
        }

        echo '</tbody></table></div>';
    } else {
        echo '<p class="no-resultados">No se encontraron pedidos con los filtros seleccionados</p>';
    }

    echo '</div>'; // .wrap
}


// Función para mostrar una fila de pedido
function mostrar_fila_pedido($order) {
    $order_id = $order->get_id();
    $customer_name = $order->get_billing_first_name() . ' ' . $order->get_billing_last_name();
    $order_status = wc_get_order_status_name($order->get_status());
    $order_status_raw = $order->get_status();
    $fotos_adjuntas = get_post_meta($order_id, '_fotos_garantia', true);
    $correo_enviado = get_post_meta($order_id, '_correo_enviado', true);
    $cantidad_fotos = is_array($fotos_adjuntas) ? count($fotos_adjuntas) : 0;
    $pago_completo = get_post_meta($order_id, '_pago_completo', true);

    echo '<tr>';
    echo '<td data-label="ID">';
	echo '<a href="#cliente-popup-' . esc_attr($order_id) . '" class="cliente-popup-link foto-indicator">';
    echo '<button>#' . esc_html($order_id) . '</button>';
    echo '</a></td>';
    
    echo '<td data-label="Estado">';
    echo '<span class="status-badge ' . esc_attr($order_status) . '">' . esc_html(ucfirst($order_status)) . '</span>';
    echo '<a href="#estado-popup-' . esc_attr($order_id) . '" class="estado-popup-link">';
    echo '<button class="cambiar-estado-btn"><i class="fas fa-edit"></i> Cambiar</button>';
    echo '</a>';
    echo '</td>';   
    
    echo '<td data-label="Fotos">';
    echo '<a href="#fotos-popup-' . esc_attr($order_id) . '" class="fotos-popup-link foto-indicator">';
    echo $cantidad_fotos ? '<span class="foto-count">' . $cantidad_fotos . '</span>' : '<span class="no-fotos">✖</span>';
    echo '</a></td>';
    
    echo '<td data-label="Correo">';
    echo '<a href="#correo-popup-' . esc_attr($order_id) . '" class="correo-popup-link correo-indicator">';
    echo $correo_enviado ? '✓ Enviado' : '✖ Pendiente';
    echo '</a></td>';
    
    echo '<td data-label="Pago">';
    echo '<a href="#pago-popup-' . esc_attr($order_id) . '" class="pago-popup-link pago-indicator">';
    echo !empty($pago_completo) ? '✓ ' . esc_html($pago_completo) : '✖ No pagado';
    echo '</a></td>';
    echo '</tr>';

echo '<div id="cliente-popup-' . esc_attr($order_id) . '" class="popup-general foto-popup">';
echo '<div class="popup-overlay"></div>';
echo '<div class="popup-contenido animated fadeInUp">';
    echo '<div class="popup-header">';
        echo '<h2>Información del Cliente</h2>';
        echo '<button class="popup-cerrar" aria-label="Cerrar">&times;</button>';
    echo '</div>';
    echo '<div class="popup-body">';
        echo '<p>Nombre: ' . esc_html($customer_name) . '</p>';
        echo '<p>Email: ' . esc_html($order->get_billing_email()) . '</p>';
        echo '<p>Teléfono: ' . esc_html($order->get_billing_phone()) . '</p>';
        echo '<p>URL del Pedido: <a href="' . esc_url(admin_url('post.php?post=' . $order_id . '&action=edit')) . '" target="_blank">Ver Pedido</a></p>';
        
        // Mostrar enlace al PDF si existe
        $pdf_url = $order->get_meta('_pdf_on_hold_url');
        if ($pdf_url) {
            echo '<p>PDF En Espera: <a href="' . esc_url($pdf_url) . '" target="_blank">Descargar PDF</a></p>';
        }
	
	        // Mostrar enlace al PDF si existe
        $pdf_url_processing = $order->get_meta('_pdf_processing_url');
        if ($pdf_url_processing) {
            echo '<p>PDF Procesado: <a href="' . esc_url($pdf_url_processing) . '" target="_blank">Descargar PDF</a></p>';
        }
	
	        // Verificar si se aplicó un cupón de descuento
        $coupons_used = $order->get_coupon_codes();
        if (!empty($coupons_used)) {
            echo '<p>Detalles del cupón:</p>';
            echo '<ul>';
            foreach ($coupons_used as $coupon_code) {
                $coupon = new WC_Coupon($coupon_code);
                $coupon_amount = $coupon->get_amount(); // Valor del descuento
                echo '<li>';
                echo 'Cupón: ' . esc_html($coupon_code) . '<br>';
                echo 'Descuento en %: ' . esc_html($coupon_amount); // Formatear como precio
                echo '</li>';
            }
            echo '</ul>';
        } else {
            echo '<p>Cupón aplicado: No</p>';
        }
        
        echo '<p>Monto Total: ' . esc_html(strip_tags($order->get_formatted_order_total())) . '</p>';
    echo '</div>';
echo '</div>';
echo '</div>';
echo '</div>';

    // Popup para cambiar estado del pedido
    echo '<div id="estado-popup-' . esc_attr($order_id) . '" class="popup-general estado-popup">';
    echo '<div class="popup-overlay"></div>';
    echo '<div class="popup-contenido animated fadeInUp">';
    echo '<div class="popup-header">';
    echo '<h2>Cambiar Estado del Pedido</h2>';
    echo '<button class="popup-cerrar" aria-label="Cerrar">&times;</button>';
    echo '</div>';
    echo '<div class="popup-body">';
    echo '<p>Estado actual: <strong>' . esc_html($order_status) . '</strong></p>';
    echo '<div class="estado-options">';
    
    foreach (wc_get_order_statuses() as $status_slug => $status_label) {
        $clean_status = str_replace('wc-', '', $status_slug);
        echo '<button class="estado-option-btn ' . ($clean_status === $order_status_raw ? 'active' : '') . '" ';
        echo 'data-status="' . esc_attr($clean_status) . '" ';
        echo 'data-order="' . esc_attr($order_id) . '">';
        echo esc_html($status_label);
        echo '</button>';
    }
    
    echo '</div>';
    echo '<div class="estado-update-status"></div>';
    echo '</div>';
    echo '</div>';
    echo '</div>';

    // Popup para fotos
    echo '<div id="fotos-popup-' . esc_attr($order_id) . '" class="popup-general foto-popup">';
    echo '<div class="popup-overlay"></div>';
    echo '<div class="popup-contenido animated fadeInUp">';
    echo '<div class="popup-header">';
    echo '<h2>Gestor de Fotos</h2>';
    echo '<button class="popup-cerrar" aria-label="Cerrar">&times;</button>';
    echo '</div>';
    echo '<div class="popup-body">';
    echo '<div class="upload-section">';
    formulario_adjuntar_fotos($order_id);
    echo '<div class="upload-status"></div>';
    echo '</div>';
    
    if (!empty($fotos_adjuntas)) {
        echo '<div class="gallery-section">';
        echo '<h3><i class="fas fa-images"></i> Fotos adjuntas</h3>';
        echo '<div class="fotos-grid">';
        foreach ($fotos_adjuntas as $foto_id) {
            $foto_url = wp_get_attachment_image_url($foto_id, 'thumbnail');
            $foto_full = wp_get_attachment_url($foto_id);
            if ($foto_url) {
                echo '<div class="foto-item">';
                echo '<a href="' . esc_url($foto_full) . '" data-lightbox="gallery-' . esc_attr($order_id) . '">';
                echo '<img src="' . esc_url($foto_url) . '" class="foto-thumbnail">';
                echo '</a>';
                echo '<form method="post" class="delete-form" onsubmit="return confirm(\'¿Eliminar esta foto permanentemente?\')">';
                echo '<input type="hidden" name="order_id" value="' . esc_attr($order_id) . '">';
                echo '<input type="hidden" name="foto_id" value="' . esc_attr($foto_id) . '">';
				echo '<button type="submit" name="eliminar_foto" class="btn-delete" aria-label="Eliminar foto" style="color: white;">Eliminar</button>';		
                echo '</form>';
                echo '</div>';
            }
        }
        echo '</div>';
        echo '</div>';
    }
    echo '</div>';
    echo '</div>';
    echo '</div>';

    // Popup para pago completo
    echo '<div id="pago-popup-' . esc_attr($order_id) . '" class="popup-general pago-popup">';
    echo '<div class="popup-overlay"></div>';
    echo '<div class="popup-contenido animated fadeInUp">';
    echo '<div class="popup-header">';
    echo '<h2>Estado de Pago</h2>';
    echo '<button class="popup-cerrar" aria-label="Cerrar">&times;</button>';
    echo '</div>';
    echo '<div class="popup-body">';
    echo '<p>Indique si el pedido está completamente pagado:</p>';
    echo '<input type="text" id="pago-completo-' . esc_attr($order_id) . '" ';
    echo 'placeholder="Referencia de pago (vacío = no pagado)" ';
    echo 'value="' . esc_attr($pago_completo) . '" class="pago-completo-input">';
    echo '<button class="guardar-pago-btn" data-order="' . esc_attr($order_id) . '">Guardar</button>';
    echo '<div class="pago-update-status"></div>';
    echo '</div>';
    echo '</div>';
    echo '</div>';
    
    // Popup para enviar correo
    echo '<div id="correo-popup-' . esc_attr($order_id) . '" class="popup-general correo-popup">';
    echo '<div class="popup-overlay"></div>';
    echo '<div class="popup-contenido animated fadeInUp">';
    echo '<div class="popup-header">';
    echo '<h2>Enviar Correo</h2>';
    echo '<button class="popup-cerrar" aria-label="Cerrar">&times;</button>';
    echo '</div>';
    echo '<div class="popup-body">';
    echo '<textarea id="mensaje-correo-' . esc_attr($order_id) . '" placeholder="Escribe tu mensaje..."></textarea>';
    echo '<button onclick="enviarCorreo(' . esc_attr($order_id) . ')">Enviar correo</button>';
    echo '</div>';
    echo '</div>';
    echo '</div>';
}

// Agregar estilos CSS para el popup y mejorar la experiencia móvil
function agregar_estilos_popup() {
    echo '
    <style>
          /* Filtros Responsivos */
        .filtros-form {
            display: grid;
            gap: 10px;
            margin-bottom: 20px;
        }
        
        .filtros-form input,
        .filtros-form select {
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #ddd;
            height: 40px;
        }
        
        @media (min-width: 768px) {
            .filtros-form {
                grid-template-columns: 1fr 1fr 1fr auto;
            }
        }
        
        @media (max-width: 767px) {
            .filtros-form {
                grid-template-columns: 1fr;
            }
        }

        /* Tabla Responsiva */
        .tabla-pedidos-container {
            overflow-x: auto;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .tabla-pedidos {
            width: 100%;
            border-collapse: collapse;
            min-width: 600px;
        }
        
        .tabla-pedidos th {
            background: #f8f9fa;
            padding: 12px;
            text-align: left;
            border-bottom: 2px solid #dee2e6;
        }
        
        .tabla-pedidos td {
            padding: 12px;
            border-bottom: 1px solid #dee2e6;
        }
        
        .tabla-pedidos tr:hover {
            background-color: #f8f9fa;
        }

        /* Indicadores Visuales */
        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.9em;
        }
        
        .status-badge.completed {
            background: #d4edda;
            color: #155724;
        }
        
        .status-badge.processing {
            background: #fff3cd;
            color: #856404;
        }
        
        .foto-indicator .foto-count {
            display: inline-block;
            width: 24px;
            height: 24px;
            background: #007bff;
            color: white;
            border-radius: 50%;
            text-align: center;
            line-height: 24px;
        }
        
        .correo-indicator {
            font-weight: 500;
        }
        
        .correo-indicator[href*="unsent"] {
            color: #dc3545;
        }
        
        .correo-indicator[href*="sent"] {
            color: #28a745;
        }

        /* Mobile Adaptación */
        @media (max-width: 480px) {
            .tabla-pedidos td {
                padding: 8px;
                font-size: 0.9em;
            }
            
            .status-badge {
                font-size: 0.8em;
            }
        }
		    /* Estilos para el popup */
    .popup-general {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        justify-content: center;
        align-items: center;
        z-index: 9999;
    }
    
    .popup-contenido {
        background: white;
        padding: 25px;
        border-radius: 8px;
        position: relative;
        max-width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 0 20px rgba(0,0,0,0.2);
    }
    
    .popup-cerrar {
        position: absolute;
        top: 10px;
        right: 10px;
        background: #ff4444;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 3px;
        cursor: pointer;
        text-decoration: none;
    }
    
    .popup-cerrar:hover {
        background: #cc0000;
    }
    
    /* Mejoras de espaciado en el contenido */
    .popup-contenido h3 {
        margin-top: 0;
        padding-right: 30px;
    }
    
    /* Estilos para botones de estado */
    .cambiar-estado-btn {
        margin-left: 10px;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        padding: 3px 6px;
        font-size: 0.8em;
        cursor: pointer;
    }
    
    .cambiar-estado-btn:hover {
        background:rgb(0, 0, 0);
    }
    
    .estado-options {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 15px;
    }
    
    .estado-option-btn {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background:rgb(3, 49, 95);
        cursor: pointer;
    }
    
    .estado-option-btn:hover {
        background: #e9ecef;
    }
    
    .estado-option-btn.active {
        background: #007bff;
        color: white;
        border-color: #0069d9;
    }
    
    /* Estilos para estado de pago */
    .pago-completo-input {
        width: 100%;
        padding: 8px;
        margin: 10px 0;
        border: 1px solid #ddd;
        border-radius: 4px;
    }
    
    .guardar-pago-btn {
        background: #28a745;
        color: white;
        border: none;
        padding: 8px 15px;
        border-radius: 4px;
        cursor: pointer;
    }
    
    .guardar-pago-btn:hover {
        background: #218838;
    }
    
    .pago-indicator, .estado-update-status, .pago-update-status {
        margin-top: 10px;
    }
    </style>
    ';
}
add_action('wp_head', 'agregar_estilos_popup');

// Agregar JavaScript para manejar el popup
function agregar_scripts_popup() {
    echo '
    <script>
    document.addEventListener("DOMContentLoaded", function() {
        // Manejar todos los popups
        const manejarPopups = (claseLink, claseCerrar) => {
            document.querySelectorAll("." + claseLink).forEach(link => {
                link.addEventListener("click", function(e) {
                    e.preventDefault();
                    const target = document.querySelector(this.getAttribute("href"));
                    if (target) target.style.display = "flex";
                });
            });

            document.querySelectorAll("." + claseCerrar).forEach(btn => {
                btn.addEventListener("click", function(e) {
                    e.preventDefault();
                    this.closest(".popup-general").style.display = "none";
                });
            });
        };

        // Inicializar para cada tipo de popup
        manejarPopups("cliente-popup-link", "popup-cerrar");
        manejarPopups("fotos-popup-link", "popup-cerrar");
        manejarPopups("correo-popup-link", "popup-cerrar");
        manejarPopups("estado-popup-link", "popup-cerrar");
        manejarPopups("pago-popup-link", "popup-cerrar");
        
        // Manejar cambios de estado
        document.querySelectorAll(".estado-option-btn").forEach(btn => {
            btn.addEventListener("click", function() {
                const orderId = this.dataset.order;
                const newStatus = this.dataset.status;
                const statusElement = document.querySelector(".estado-update-status");
                
                statusElement.innerHTML = "Actualizando...";
                
                fetch("' . admin_url("admin-ajax.php") . '", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                        action: "actualizar_estado_pedido",
                        order_id: orderId,
                        status: newStatus
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        statusElement.innerHTML = "<p style=\'color:green\'>¡Estado actualizado con éxito!</p>";
                        
                        // Actualizar la interfaz
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    } else {
                        statusElement.innerHTML = "<p style=\'color:red\'>Error: " + data.message + "</p>";
                    }
                })
                .catch(error => {
                    statusElement.innerHTML = "<p style=\'color:red\'>Error al comunicarse con el servidor</p>";
                });
            });
        });
        
        // Manejar guardado de estado de pago
        document.querySelectorAll(".guardar-pago-btn").forEach(btn => {
            btn.addEventListener("click", function() {
                const orderId = this.dataset.order;
                const pagoCompleto = document.getElementById(`pago-completo-${orderId}`).value;
                const statusElement = this.nextElementSibling;
                
                statusElement.innerHTML = "Guardando...";
                
                fetch("' . admin_url("admin-ajax.php") . '", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({
                        action: "actualizar_pago_completo",
                        order_id: orderId,
                        pago_completo: pagoCompleto
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        statusElement.innerHTML = "<p style=\'color:green\'>¡Estado de pago actualizado!</p>";
                        
                        // Actualizar la interfaz
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    } else {
                        statusElement.innerHTML = "<p style=\'color:red\'>Error: " + data.message + "</p>";
                    }
                })
                .catch(error => {
                    statusElement.innerHTML = "<p style=\'color:red\'>Error al comunicarse con el servidor</p>";
                });
            });
        });
    });
    
    // Función enviar correo (mantener existente)
    function enviarCorreo(order_id) {
        const mensaje = document.getElementById(`mensaje-correo-${order_id}`).value;
        
        if (!mensaje.trim()) {
            alert("Por favor escribe un mensaje");
            return;
        }

        fetch("' . admin_url('admin-ajax.php') . '", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                action: "enviar_correo",
                order_id: order_id,
                mensaje: mensaje
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Actualizar estado en la tabla
                const linkCorreo = document.querySelector(`a[href="#correo-popup-${order_id}"]`);
                if (linkCorreo) {
                    linkCorreo.textContent = "Correo enviado";
                    linkCorreo.style.color = "#4CAF50";
                }
                alert("Correo enviado con éxito");
            } else {
                alert("Error al enviar el correo");
            }
        });
    }
    </script>
    ';
}
add_action('wp_footer', 'agregar_scripts_popup');

add_action('wp_ajax_enviar_correo', 'manejar_envio_correo');

function manejar_envio_correo() {
    if (!isset($_POST['order_id']) || !isset($_POST['mensaje'])) {
        wp_send_json_error('Datos incompletos');
    }

    $order_id = intval($_POST['order_id']);
    $mensaje = sanitize_textarea_field($_POST['mensaje']);
    
    // Obtener datos del pedido
    $order = wc_get_order($order_id);
    if (!$order) {
        wp_send_json_error('Pedido no encontrado.');
    }

    $cliente_email = $order->get_billing_email();
    if (!$cliente_email) {
        wp_send_json_error('El pedido no tiene un correo asociado.');
    }

    // Obtener fotos adjuntas
    $fotos_adjuntas = get_post_meta($order_id, '_fotos_garantia', true);
    $adjuntos = [];
    if (!empty($fotos_adjuntas) && is_array($fotos_adjuntas)) {
        foreach ($fotos_adjuntas as $foto_id) {
            $archivo = get_attached_file($foto_id);
            if ($archivo) {
                $adjuntos[] = $archivo;
            }
        }
    }

    // Cargar template HTML
    $template_path = get_theme_file_path('emails/Correo_foto_pedido.html');
    if (!file_exists($template_path)) {
        wp_send_json_error('Plantilla de correo no encontrada.');
    }
    $html = file_get_contents($template_path);

    // Procesar placeholders
    $mensaje = nl2br($mensaje); // Convertir saltos de línea a <br>
    $replacements = array(
        '[Nombre]' => $order->get_billing_first_name(),
        '[mensaje]' => $mensaje,
        '[order_id]' => $order_id,
		'[Fecha]' => date('d-m-Y') 
    );
    
    $html = str_replace(array_keys($replacements), array_values($replacements), $html);

    // Configurar cabeceras para HTML
    $cabeceras = ['Content-Type: text/html; charset=UTF-8'];

    // Enviar el correo
    $resultado = wp_mail($cliente_email, "Información sobre tu pedido #" . $order_id, $html, $cabeceras, $adjuntos);

    if ($resultado) {
        update_post_meta($order_id, '_correo_enviado', true);
        wp_send_json_success('Correo enviado.');
    } else {
        wp_send_json_error('No se pudo enviar el correo.');
    }
}

function procesar_eliminacion_foto() {
    if (isset($_POST['eliminar_foto'])) {
        $order_id = intval($_POST['order_id']);
        $foto_id = intval($_POST['foto_id']);

        // Obtener las fotos adjuntas actuales
        $fotos_adjuntas = get_post_meta($order_id, '_fotos_garantia', true);

        if (!empty($fotos_adjuntas) && is_array($fotos_adjuntas)) {
            // Buscar y eliminar la foto específica
            $fotos_adjuntas = array_diff($fotos_adjuntas, array($foto_id));

            // Actualizar los metadatos del pedido
            update_post_meta($order_id, '_fotos_garantia', $fotos_adjuntas);

            // Eliminar el archivo adjunto de la biblioteca de medios
            wp_delete_attachment($foto_id, true);

            echo '<div class="updated"><p>La foto ha sido eliminada correctamente.</p></div>';
        } else {
            echo '<div class="error"><p>No se encontraron fotos adjuntas para eliminar.</p></div>';
        }
    }
}
add_action('init', 'procesar_eliminacion_foto');
// Función para obtener todos los pedidos
function obtener_todos_los_pedidos() {
    $args = array(
        'status' => 'any', // Obtener todos los estados de pedidos
        'limit' => -1, // Obtener todos los pedidos
    );
    return wc_get_orders($args);
}

// Función para mostrar el formulario de adjuntar fotos
function formulario_adjuntar_fotos($order_id) {
    echo '<form method="post" enctype="multipart/form-data">';
    echo '<input type="file" name="fotos_garantia[]" multiple accept="image/jpeg, image/png, image/gif">';
    echo '<input type="hidden" name="order_id" value="' . esc_attr($order_id) . '">';
    echo '<input type="submit" name="adjuntar_fotos" value="Adjuntar Fotos">';
    echo '</form>';
}

// Función para procesar el formulario de adjuntar fotos
function procesar_formulario_adjuntar_fotos() {
    if (isset($_POST['adjuntar_fotos'])) {
        $order_id = intval($_POST['order_id']);

        if (!empty($_FILES['fotos_garantia']['name'][0])) {
            $uploaded_files = $_FILES['fotos_garantia'];
            $attachments = subir_archivos($uploaded_files);

            if (!empty($attachments)) {
                $fotos_existentes = get_post_meta($order_id, '_fotos_garantia', true);
                if (empty($fotos_existentes)) {
                    $fotos_existentes = array();
                }
                $fotos_existentes = array_merge($fotos_existentes, $attachments);
                update_post_meta($order_id, '_fotos_garantia', $fotos_existentes);

                // Redirigir para evitar re-subida al actualizar la página
                wp_redirect(add_query_arg('updated', 'true', wp_get_referer()));
                exit;
            } else {
                echo '<script>console.error("No se pudieron subir los archivos adjuntos.");</script>';
            }
        } else {
            echo '<script>console.error("No se seleccionaron archivos para adjuntar.");</script>';
        }
    }
}
add_action('init', 'procesar_formulario_adjuntar_fotos');

// Función para subir archivos
function subir_archivos($uploaded_files) {
    require_once(ABSPATH . 'wp-admin/includes/file.php');
    require_once(ABSPATH . 'wp-admin/includes/media.php');
    require_once(ABSPATH . 'wp-admin/includes/image.php');

    $attachments = array();
    foreach ($uploaded_files['name'] as $key => $value) {
        if ($uploaded_files['name'][$key]) {
            $file_type = wp_check_filetype($uploaded_files['name'][$key]);
            $allowed_types = array('image/jpeg', 'image/png', 'image/gif');

            if (in_array($file_type['type'], $allowed_types)) {
                $file = array(
                    'name'     => $uploaded_files['name'][$key],
                    'type'     => $uploaded_files['type'][$key],
                    'tmp_name' => $uploaded_files['tmp_name'][$key],
                    'error'    => $uploaded_files['error'][$key],
                    'size'     => $uploaded_files['size'][$key]
                );

                $uploaded = wp_handle_upload($file, array('test_form' => false));
                if (!isset($uploaded['error'])) {
                    $attachment_id = wp_insert_attachment(array(
                        'post_mime_type' => $uploaded['type'],
                        'post_title'     => preg_replace('/\.[^.]+$/', '', basename($uploaded['file'])),
                        'post_content'   => '',
                        'post_status'    => 'inherit'
                    ), $uploaded['file']);

                    $attach_data = wp_generate_attachment_metadata($attachment_id, $uploaded['file']);
                    wp_update_attachment_metadata($attachment_id, $attach_data);

                    $attachments[] = $attachment_id;
                } else {
                    echo '<script>console.error("Error al subir el archivo: ' . esc_js($uploaded['error']) . '");</script>';
                }
            } else {
                echo '<script>console.error("El archivo ' . esc_js($uploaded_files['name'][$key]) . ' no es una imagen válida (solo se permiten JPG, PNG y GIF).");</script>';
            }
        }
    }

    return $attachments;
}

// Función para actualizar el estado del pedido
function actualizar_estado_pedido() {
    if (!isset($_POST['order_id']) || !isset($_POST['status'])) {
        wp_send_json_error(['message' => 'Datos incompletos']);
    }

    $order_id = intval($_POST['order_id']);
    $new_status = sanitize_text_field($_POST['status']);
    
    $order = wc_get_order($order_id);
    if (!$order) {
        wp_send_json_error(['message' => 'Pedido no encontrado']);
    }
    
    // Actualizar el estado
    $order->update_status($new_status, 'Estado actualizado desde el panel de administración.');
    
    wp_send_json_success(['message' => 'Estado actualizado correctamente']);
}
add_action('wp_ajax_actualizar_estado_pedido', 'actualizar_estado_pedido');

// Función para actualizar el estado de pago completo
function actualizar_pago_completo() {
    if (!isset($_POST['order_id'])) {
        wp_send_json_error(['message' => 'Datos incompletos']);
    }

    $order_id = intval($_POST['order_id']);
    $pago_completo = isset($_POST['pago_completo']) ? sanitize_text_field($_POST['pago_completo']) : '';
    
    update_post_meta($order_id, '_pago_completo', $pago_completo);
    
    wp_send_json_success(['message' => 'Estado de pago actualizado correctamente']);
}
add_action('wp_ajax_actualizar_pago_completo', 'actualizar_pago_completo');