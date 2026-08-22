export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: number
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: never
          role?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: never
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          count: number | null
          created_at: string | null
          description: string | null
          id: number
          image_src: string | null
          name: string
          parent: number | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          description?: string | null
          id?: number
          image_src?: string | null
          name: string
          parent?: number | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          count?: number | null
          created_at?: string | null
          description?: string | null
          id?: number
          image_src?: string | null
          name?: string
          parent?: number | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_categories_parent"
            columns: ["parent"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usage: {
        Row: {
          coupon_id: number
          discount_amount: number
          id: number
          order_id: number | null
          used_at: string | null
          user_id: number
        }
        Insert: {
          coupon_id: number
          discount_amount: number
          id?: number
          order_id?: number | null
          used_at?: string | null
          user_id: number
        }
        Update: {
          coupon_id?: number
          discount_amount?: number
          id?: number
          order_id?: number | null
          used_at?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      coupons: {
        Row: {
          amount: number
          code: string
          created_by: string | null
          date_created: string | null
          date_expires: string | null
          date_modified: string | null
          description: string | null
          discount_type: string
          exclude_sale_items: boolean | null
          id: number
          individual_use: boolean | null
          maximum_amount: number | null
          metadata: Json | null
          minimum_amount: number | null
          status: string | null
          usage_count: number | null
          usage_limit: number | null
          usage_limit_per_user: number | null
        }
        Insert: {
          amount: number
          code: string
          created_by?: string | null
          date_created?: string | null
          date_expires?: string | null
          date_modified?: string | null
          description?: string | null
          discount_type: string
          exclude_sale_items?: boolean | null
          id?: number
          individual_use?: boolean | null
          maximum_amount?: number | null
          metadata?: Json | null
          minimum_amount?: number | null
          status?: string | null
          usage_count?: number | null
          usage_limit?: number | null
          usage_limit_per_user?: number | null
        }
        Update: {
          amount?: number
          code?: string
          created_by?: string | null
          date_created?: string | null
          date_expires?: string | null
          date_modified?: string | null
          description?: string | null
          discount_type?: string
          exclude_sale_items?: boolean | null
          id?: number
          individual_use?: boolean | null
          maximum_amount?: number | null
          metadata?: Json | null
          minimum_amount?: number | null
          status?: string | null
          usage_count?: number | null
          usage_limit?: number | null
          usage_limit_per_user?: number | null
        }
        Relationships: []
      }
      hermes_notifications: {
        Row: {
          attempts: number
          created_at: string
          event: string
          id: number
          last_error: string | null
          notified_at: string | null
          order_id: number
        }
        Insert: {
          attempts?: number
          created_at?: string
          event?: string
          id?: number
          last_error?: string | null
          notified_at?: string | null
          order_id: number
        }
        Update: {
          attempts?: number
          created_at?: string
          event?: string
          id?: number
          last_error?: string | null
          notified_at?: string | null
          order_id?: number
        }
        Relationships: []
      }
      hermes_pending_writes: {
        Row: {
          action: string
          bound_user: string | null
          confirmation_token: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          note: string | null
          plan_json: Json
        }
        Insert: {
          action: string
          bound_user?: string | null
          confirmation_token: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          note?: string | null
          plan_json: Json
        }
        Update: {
          action?: string
          bound_user?: string | null
          confirmation_token?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          note?: string | null
          plan_json?: Json
        }
        Relationships: []
      }
      order_communications: {
        Row: {
          created_at: string
          file_name: string | null
          file_url: string | null
          id: number
          is_read: boolean
          message: string
          message_type: string
          order_id: number
          updated_at: string
          user_email: string | null
          user_id: string
          user_name: string | null
          user_type: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: number
          is_read?: boolean
          message: string
          message_type?: string
          order_id: number
          updated_at?: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
          user_type: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: number
          is_read?: boolean
          message?: string
          message_type?: string
          order_id?: number
          updated_at?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_communications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_communications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address_1: string
          billing_city: string
          billing_company: string | null
          billing_email: string
          billing_first_name: string
          billing_last_name: string
          billing_phone: string
          calculated_discount: number
          calculated_iva: number
          calculated_subtotal: number
          calculated_total: number
          cart_tax: number | null
          company_rut: string
          correo_enviado: boolean | null
          coupon_lines: Json | null
          created_via: string | null
          currency: string | null
          customer_id: number
          customer_ip_address: unknown
          customer_note: string | null
          customer_user_agent: string | null
          date_completed: string | null
          date_created: string | null
          date_modified: string | null
          date_paid: string | null
          fee_lines: Json | null
          fotos_garantia: Json | null
          id: number
          is_editable: boolean | null
          line_items: Json
          needs_payment: boolean | null
          needs_processing: boolean | null
          new_pdf_on_hold_url: string | null
          new_pdf_processing_url: string | null
          num_jornadas: number
          numero_factura: string | null
          orden_compra: string | null
          order_comments: string | null
          order_fecha_inicio: string
          order_fecha_termino: string
          order_key: string | null
          order_proyecto: string
          order_retire_name: string | null
          order_retire_phone: string | null
          order_retire_rut: string | null
          pago_completo: boolean | null
          pago_reserva: boolean
          payment_method: string | null
          payment_method_title: string | null
          refunds: Json | null
          shipping_lines: Json | null
          shipping_total: number | null
          status: string
          tax_lines: Json | null
          total: number | null
          total_tax: number | null
          transaction_id: string | null
        }
        Insert: {
          billing_address_1: string
          billing_city: string
          billing_company?: string | null
          billing_email: string
          billing_first_name: string
          billing_last_name: string
          billing_phone: string
          calculated_discount?: number
          calculated_iva?: number
          calculated_subtotal?: number
          calculated_total?: number
          cart_tax?: number | null
          company_rut: string
          correo_enviado?: boolean | null
          coupon_lines?: Json | null
          created_via?: string | null
          currency?: string | null
          customer_id: number
          customer_ip_address?: unknown
          customer_note?: string | null
          customer_user_agent?: string | null
          date_completed?: string | null
          date_created?: string | null
          date_modified?: string | null
          date_paid?: string | null
          fee_lines?: Json | null
          fotos_garantia?: Json | null
          id?: number
          is_editable?: boolean | null
          line_items?: Json
          needs_payment?: boolean | null
          needs_processing?: boolean | null
          new_pdf_on_hold_url?: string | null
          new_pdf_processing_url?: string | null
          num_jornadas?: number
          numero_factura?: string | null
          orden_compra?: string | null
          order_comments?: string | null
          order_fecha_inicio: string
          order_fecha_termino: string
          order_key?: string | null
          order_proyecto: string
          order_retire_name?: string | null
          order_retire_phone?: string | null
          order_retire_rut?: string | null
          pago_completo?: boolean | null
          pago_reserva?: boolean
          payment_method?: string | null
          payment_method_title?: string | null
          refunds?: Json | null
          shipping_lines?: Json | null
          shipping_total?: number | null
          status?: string
          tax_lines?: Json | null
          total?: number | null
          total_tax?: number | null
          transaction_id?: string | null
        }
        Update: {
          billing_address_1?: string
          billing_city?: string
          billing_company?: string | null
          billing_email?: string
          billing_first_name?: string
          billing_last_name?: string
          billing_phone?: string
          calculated_discount?: number
          calculated_iva?: number
          calculated_subtotal?: number
          calculated_total?: number
          cart_tax?: number | null
          company_rut?: string
          correo_enviado?: boolean | null
          coupon_lines?: Json | null
          created_via?: string | null
          currency?: string | null
          customer_id?: number
          customer_ip_address?: unknown
          customer_note?: string | null
          customer_user_agent?: string | null
          date_completed?: string | null
          date_created?: string | null
          date_modified?: string | null
          date_paid?: string | null
          fee_lines?: Json | null
          fotos_garantia?: Json | null
          id?: number
          is_editable?: boolean | null
          line_items?: Json
          needs_payment?: boolean | null
          needs_processing?: boolean | null
          new_pdf_on_hold_url?: string | null
          new_pdf_processing_url?: string | null
          num_jornadas?: number
          numero_factura?: string | null
          orden_compra?: string | null
          order_comments?: string | null
          order_fecha_inicio?: string
          order_fecha_termino?: string
          order_key?: string | null
          order_proyecto?: string
          order_retire_name?: string | null
          order_retire_phone?: string | null
          order_retire_rut?: string | null
          pago_completo?: boolean | null
          pago_reserva?: boolean
          payment_method?: string | null
          payment_method_title?: string | null
          refunds?: Json | null
          shipping_lines?: Json | null
          shipping_total?: number | null
          status?: string
          tax_lines?: Json | null
          total?: number | null
          total_tax?: number | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      products: {
        Row: {
          brands: string | null
          catalog_visibility: string | null
          categories_ids: Json | null
          categories_name: string | null
          collage_image_url: string | null
          created_at: string | null
          description: string | null
          dimensions_height: number | null
          dimensions_length: number | null
          dimensions_width: number | null
          featured: boolean | null
          id: number
          images: Json | null
          name: string | null
          on_sale: boolean | null
          price: number | null
          primary_term_product_cat: string | null
          regular_price: number | null
          related_ids: Json | null
          sale_price: number | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          short_description: string | null
          sku: string | null
          slug: string | null
          sold_individually: boolean | null
          status: string | null
          stock_status: string | null
          tags: Json | null
          total_sales: number | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          brands?: string | null
          catalog_visibility?: string | null
          categories_ids?: Json | null
          categories_name?: string | null
          collage_image_url?: string | null
          created_at?: string | null
          description?: string | null
          dimensions_height?: number | null
          dimensions_length?: number | null
          dimensions_width?: number | null
          featured?: boolean | null
          id?: number
          images?: Json | null
          name?: string | null
          on_sale?: boolean | null
          price?: number | null
          primary_term_product_cat?: string | null
          regular_price?: number | null
          related_ids?: Json | null
          sale_price?: number | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          sold_individually?: boolean | null
          status?: string | null
          stock_status?: string | null
          tags?: Json | null
          total_sales?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          brands?: string | null
          catalog_visibility?: string | null
          categories_ids?: Json | null
          categories_name?: string | null
          collage_image_url?: string | null
          created_at?: string | null
          description?: string | null
          dimensions_height?: number | null
          dimensions_length?: number | null
          dimensions_width?: number | null
          featured?: boolean | null
          id?: number
          images?: Json | null
          name?: string | null
          on_sale?: boolean | null
          price?: number | null
          primary_term_product_cat?: string | null
          regular_price?: number | null
          related_ids?: Json | null
          sale_price?: number | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          sold_individually?: boolean | null
          status?: string | null
          stock_status?: string | null
          tags?: Json | null
          total_sales?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      serialised_assets: {
        Row: {
          condition: string
          created_at: string
          id: number
          kit_code: string | null
          location: string
          notes: string | null
          product_id: number
          serial_number: string
          updated_at: string
        }
        Insert: {
          condition: string
          created_at?: string
          id?: never
          kit_code?: string | null
          location: string
          notes?: string | null
          product_id: number
          serial_number: string
          updated_at?: string
        }
        Update: {
          condition?: string
          created_at?: string
          id?: never
          kit_code?: string | null
          location?: string
          notes?: string | null
          product_id?: number
          serial_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "serialised_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serialised_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_methods: {
        Row: {
          available_regions: Json | null
          cost: number
          created_at: string | null
          created_by: string | null
          description: string | null
          enabled: boolean | null
          estimated_days_max: number | null
          estimated_days_min: number | null
          excluded_regions: Json | null
          id: number
          max_amount: number | null
          metadata: Json | null
          min_amount: number | null
          name: string
          requires_address: boolean | null
          requires_phone: boolean | null
          shipping_type: string
          updated_at: string | null
        }
        Insert: {
          available_regions?: Json | null
          cost?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          excluded_regions?: Json | null
          id?: number
          max_amount?: number | null
          metadata?: Json | null
          min_amount?: number | null
          name: string
          requires_address?: boolean | null
          requires_phone?: boolean | null
          shipping_type: string
          updated_at?: string | null
        }
        Update: {
          available_regions?: Json | null
          cost?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          excluded_regions?: Json | null
          id?: number
          max_amount?: number | null
          metadata?: Json | null
          min_amount?: number | null
          name?: string
          requires_address?: boolean | null
          requires_phone?: boolean | null
          shipping_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      shipping_usage: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          id: number
          metadata: Json | null
          order_id: number
          shipped_at: string | null
          shipping_address: Json | null
          shipping_cost: number
          shipping_method_id: number
          status: string | null
          tracking_number: string | null
          user_id: number | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          id?: number
          metadata?: Json | null
          order_id: number
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cost: number
          shipping_method_id: number
          status?: string | null
          tracking_number?: string | null
          user_id?: number | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          id?: number
          metadata?: Json | null
          order_id?: number
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cost?: number
          shipping_method_id?: number
          status?: string | null
          tracking_number?: string | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_usage_shipping_method_id_fkey"
            columns: ["shipping_method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          apellido: string | null
          auth_uid: string
          ciudad: string | null
          created_at: string | null
          direccion: string | null
          email: string | null
          empresa_ciudad: string | null
          empresa_direccion: string | null
          empresa_nombre: string | null
          empresa_rut: string | null
          fecha_nacimiento: string | null
          instagram: string | null
          new_url_e_rut_empresa: string | null
          nombre: string | null
          pais: string | null
          rut: string | null
          telefono: string | null
          terminos_aceptados: boolean | null
          tipo_cliente: string | null
          updated_at: string | null
          url_empresa_erut: string | null
          url_firma: string | null
          url_rut_anverso: string | null
          url_rut_reverso: string | null
          url_user_contrato: string | null
          user_id: number
          usuario: string | null
        }
        Insert: {
          apellido?: string | null
          auth_uid: string
          ciudad?: string | null
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          empresa_ciudad?: string | null
          empresa_direccion?: string | null
          empresa_nombre?: string | null
          empresa_rut?: string | null
          fecha_nacimiento?: string | null
          instagram?: string | null
          new_url_e_rut_empresa?: string | null
          nombre?: string | null
          pais?: string | null
          rut?: string | null
          telefono?: string | null
          terminos_aceptados?: boolean | null
          tipo_cliente?: string | null
          updated_at?: string | null
          url_empresa_erut?: string | null
          url_firma?: string | null
          url_rut_anverso?: string | null
          url_rut_reverso?: string | null
          url_user_contrato?: string | null
          user_id?: number
          usuario?: string | null
        }
        Update: {
          apellido?: string | null
          auth_uid?: string
          ciudad?: string | null
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          empresa_ciudad?: string | null
          empresa_direccion?: string | null
          empresa_nombre?: string | null
          empresa_rut?: string | null
          fecha_nacimiento?: string | null
          instagram?: string | null
          new_url_e_rut_empresa?: string | null
          nombre?: string | null
          pais?: string | null
          rut?: string | null
          telefono?: string | null
          terminos_aceptados?: boolean | null
          tipo_cliente?: string | null
          updated_at?: string | null
          url_empresa_erut?: string | null
          url_firma?: string | null
          url_rut_anverso?: string | null
          url_rut_reverso?: string | null
          url_user_contrato?: string | null
          user_id?: number
          usuario?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      order_summary: {
        Row: {
          billing_company: string | null
          billing_email: string | null
          calculated_iva: number | null
          calculated_subtotal: number | null
          calculated_total: number | null
          customer_name: string | null
          date_created: string | null
          id: number | null
          items_count: number | null
          num_jornadas: number | null
          order_fecha_inicio: string | null
          order_fecha_termino: string | null
          order_proyecto: string | null
          profile_name: string | null
          profile_rut: string | null
          status: string | null
        }
        Relationships: []
      }
      products_with_categories: {
        Row: {
          brands: string | null
          catalog_visibility: string | null
          categories_ids: Json | null
          categories_name: string | null
          category_details: Json | null
          collage_image_url: string | null
          created_at: string | null
          description: string | null
          dimensions_height: number | null
          dimensions_length: number | null
          dimensions_width: number | null
          featured: boolean | null
          id: number | null
          images: Json | null
          name: string | null
          on_sale: boolean | null
          price: number | null
          primary_term_product_cat: string | null
          regular_price: number | null
          related_ids: Json | null
          sale_price: number | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          short_description: string | null
          sku: string | null
          slug: string | null
          sold_individually: boolean | null
          status: string | null
          stock_status: string | null
          tags: Json | null
          total_sales: number | null
          type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_create_user_profile: {
        Args: {
          p_apellido?: string
          p_auth_uid: string
          p_ciudad?: string
          p_direccion?: string
          p_email: string
          p_empresa_ciudad?: string
          p_empresa_direccion?: string
          p_empresa_nombre?: string
          p_empresa_rut?: string
          p_fecha_nacimiento?: string
          p_instagram?: string
          p_nombre?: string
          p_pais?: string
          p_rut?: string
          p_telefono?: string
          p_terminos_aceptados?: boolean
          p_tipo_cliente?: string
          p_usuario?: string
        }
        Returns: {
          apellido: string | null
          auth_uid: string
          ciudad: string | null
          created_at: string | null
          direccion: string | null
          email: string | null
          empresa_ciudad: string | null
          empresa_direccion: string | null
          empresa_nombre: string | null
          empresa_rut: string | null
          fecha_nacimiento: string | null
          instagram: string | null
          new_url_e_rut_empresa: string | null
          nombre: string | null
          pais: string | null
          rut: string | null
          telefono: string | null
          terminos_aceptados: boolean | null
          tipo_cliente: string | null
          updated_at: string | null
          url_empresa_erut: string | null
          url_firma: string | null
          url_rut_anverso: string | null
          url_rut_reverso: string | null
          url_user_contrato: string | null
          user_id: number
          usuario: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      apply_coupon: {
        Args: {
          p_coupon_code: string
          p_discount_amount: number
          p_order_id?: number
          p_user_id: number
        }
        Returns: {
          message: string
          success: boolean
          usage_id: number
        }[]
      }
      apply_shipping_method: {
        Args: {
          p_order_id: number
          p_shipping_address?: Json
          p_shipping_method_id: number
          p_user_id: number
        }
        Returns: {
          message: string
          shipping_cost: number
          shipping_usage_id: number
          success: boolean
        }[]
      }
      calculate_iva: { Args: { subtotal: number }; Returns: number }
      calculate_order_subtotal: {
        Args: { line_items_json: Json }
        Returns: number
      }
      calculate_shipping_cost: {
        Args: {
          p_cart_total?: number
          p_region?: string
          p_shipping_method_id: number
        }
        Returns: {
          is_available: boolean
          message: string
          shipping_cost: number
        }[]
      }
      create_user_profile_manual: {
        Args: {
          user_apellido?: string
          user_auth_uid: string
          user_email?: string
          user_nombre?: string
          user_usuario?: string
        }
        Returns: {
          apellido: string | null
          auth_uid: string
          ciudad: string | null
          created_at: string | null
          direccion: string | null
          email: string | null
          empresa_ciudad: string | null
          empresa_direccion: string | null
          empresa_nombre: string | null
          empresa_rut: string | null
          fecha_nacimiento: string | null
          instagram: string | null
          new_url_e_rut_empresa: string | null
          nombre: string | null
          pais: string | null
          rut: string | null
          telefono: string | null
          terminos_aceptados: boolean | null
          tipo_cliente: string | null
          updated_at: string | null
          url_empresa_erut: string | null
          url_firma: string | null
          url_rut_anverso: string | null
          url_rut_reverso: string | null
          url_user_contrato: string | null
          user_id: number
          usuario: string | null
        }
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_available_shipping_methods: {
        Args: { p_cart_total?: number; p_region?: string }
        Returns: {
          cost: number
          description: string
          estimated_days_max: number
          estimated_days_min: number
          id: number
          metadata: Json
          name: string
          requires_address: boolean
          requires_phone: boolean
          shipping_type: string
        }[]
      }
      get_dashboard_stats: { Args: never; Returns: Json }
      get_products_by_category: {
        Args: { category_id: number; page_limit?: number; page_offset?: number }
        Returns: {
          data: Json
          total: number
        }[]
      }
      get_smart_related_products: {
        Args: { max_results?: number; product_id: number }
        Returns: {
          categories_ids: Json
          categories_name: string
          id: number
          images: Json
          name: string
          price: number
          short_description: string
          slug: string
          stock_status: string
        }[]
      }
      get_user_coupon_history: {
        Args: { p_user_id: number }
        Returns: {
          coupon_code: string
          discount_amount: number
          order_id: number
          used_at: string
        }[]
      }
      get_user_profile_by_auth_uid: {
        Args: { user_auth_uid: string }
        Returns: {
          apellido: string | null
          auth_uid: string
          ciudad: string | null
          created_at: string | null
          direccion: string | null
          email: string | null
          empresa_ciudad: string | null
          empresa_direccion: string | null
          empresa_nombre: string | null
          empresa_rut: string | null
          fecha_nacimiento: string | null
          instagram: string | null
          new_url_e_rut_empresa: string | null
          nombre: string | null
          pais: string | null
          rut: string | null
          telefono: string | null
          terminos_aceptados: boolean | null
          tipo_cliente: string | null
          updated_at: string | null
          url_empresa_erut: string | null
          url_firma: string | null
          url_rut_anverso: string | null
          url_rut_reverso: string | null
          url_user_contrato: string | null
          user_id: number
          usuario: string | null
        }
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_shipping_history: {
        Args: { p_user_id: number }
        Returns: {
          created_at: string
          delivered_at: string
          order_id: number
          shipped_at: string
          shipping_cost: number
          shipping_method_name: string
          status: string
          tracking_number: string
        }[]
      }
      migrate_existing_users_to_profiles: {
        Args: never
        Returns: {
          error_count: number
          migrated_count: number
        }[]
      }
      search_coupons: {
        Args: { p_search_term?: string; p_status?: string }
        Returns: {
          amount: number
          code: string
          date_expires: string
          description: string
          discount_type: string
          id: number
          maximum_amount: number
          minimum_amount: number
          status: string
          usage_limit_per_user: number
        }[]
      }
      search_products_advanced: {
        Args: {
          category_filter?: number
          max_price?: number
          min_price?: number
          page_limit?: number
          page_offset?: number
          search_query: string
        }
        Returns: {
          data: Json
          total: number
        }[]
      }
      update_all_category_counts: { Args: never; Returns: undefined }
      update_category_count: {
        Args: { category_id: number }
        Returns: undefined
      }
      update_user_profile_admin: {
        Args: {
          p_new_url_e_rut_empresa?: string
          p_url_firma?: string
          p_url_rut_anverso?: string
          p_url_rut_reverso?: string
          p_user_id: number
        }
        Returns: {
          apellido: string | null
          auth_uid: string
          ciudad: string | null
          created_at: string | null
          direccion: string | null
          email: string | null
          empresa_ciudad: string | null
          empresa_direccion: string | null
          empresa_nombre: string | null
          empresa_rut: string | null
          fecha_nacimiento: string | null
          instagram: string | null
          new_url_e_rut_empresa: string | null
          nombre: string | null
          pais: string | null
          rut: string | null
          telefono: string | null
          terminos_aceptados: boolean | null
          tipo_cliente: string | null
          updated_at: string | null
          url_empresa_erut: string | null
          url_firma: string | null
          url_rut_anverso: string | null
          url_rut_reverso: string | null
          url_user_contrato: string | null
          user_id: number
          usuario: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_user_profile_admin_full: {
        Args: { p_updates: Json; p_user_id: number }
        Returns: {
          apellido: string | null
          auth_uid: string
          ciudad: string | null
          created_at: string | null
          direccion: string | null
          email: string | null
          empresa_ciudad: string | null
          empresa_direccion: string | null
          empresa_nombre: string | null
          empresa_rut: string | null
          fecha_nacimiento: string | null
          instagram: string | null
          new_url_e_rut_empresa: string | null
          nombre: string | null
          pais: string | null
          rut: string | null
          telefono: string | null
          terminos_aceptados: boolean | null
          tipo_cliente: string | null
          updated_at: string | null
          url_empresa_erut: string | null
          url_firma: string | null
          url_rut_anverso: string | null
          url_rut_reverso: string | null
          url_user_contrato: string | null
          user_id: number
          usuario: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_user_profile_securely: {
        Args: { p_updates: Json; p_user_id: number }
        Returns: {
          apellido: string | null
          auth_uid: string
          ciudad: string | null
          created_at: string | null
          direccion: string | null
          email: string | null
          empresa_ciudad: string | null
          empresa_direccion: string | null
          empresa_nombre: string | null
          empresa_rut: string | null
          fecha_nacimiento: string | null
          instagram: string | null
          new_url_e_rut_empresa: string | null
          nombre: string | null
          pais: string | null
          rut: string | null
          telefono: string | null
          terminos_aceptados: boolean | null
          tipo_cliente: string | null
          updated_at: string | null
          url_empresa_erut: string | null
          url_firma: string | null
          url_rut_anverso: string | null
          url_rut_reverso: string | null
          url_user_contrato: string | null
          user_id: number
          usuario: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      validate_coupon: {
        Args: {
          p_cart_total?: number
          p_coupon_code: string
          p_user_id: number
        }
        Returns: {
          coupon_data: Json
          error_message: string
          is_valid: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

