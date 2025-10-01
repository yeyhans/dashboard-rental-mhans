export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: number
          name: string
          slug: string
          parent: number | null
          description: string | null
          count: number
          image_src: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          slug: string
          parent?: number | null
          description?: string | null
          count?: number
          image_src?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          slug?: string
          parent?: number | null
          description?: string | null
          count?: number
          image_src?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_categories_parent"
            columns: ["parent"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      coupons: {
        Row: {
          id: number
          code: string
          amount: number
          discount_type: string
          description: string | null
          date_created: string
          date_modified: string
          date_expires: string | null
          usage_count: number
          usage_limit: number | null
          usage_limit_per_user: number | null
          status: string
          minimum_amount: number | null
          maximum_amount: number | null
          individual_use: boolean
          exclude_sale_items: boolean
          created_by: string | null
          metadata: Json
        }
        Insert: {
          id?: number
          code: string
          amount: number
          discount_type: string
          description?: string | null
          date_created?: string
          date_modified?: string
          date_expires?: string | null
          usage_count?: number
          usage_limit?: number | null
          usage_limit_per_user?: number | null
          status?: string
          minimum_amount?: number | null
          maximum_amount?: number | null
          individual_use?: boolean
          exclude_sale_items?: boolean
          created_by?: string | null
          metadata?: Json
        }
        Update: {
          id?: number
          code?: string
          amount?: number
          discount_type?: string
          description?: string | null
          date_created?: string
          date_modified?: string
          date_expires?: string | null
          usage_count?: number
          usage_limit?: number | null
          usage_limit_per_user?: number | null
          status?: string
          minimum_amount?: number | null
          maximum_amount?: number | null
          individual_use?: boolean
          exclude_sale_items?: boolean
          created_by?: string | null
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "coupons_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      coupon_usage: {
        Row: {
          id: number
          coupon_id: number
          user_id: number
          order_id: number | null
          used_at: string
          discount_amount: number
        }
        Insert: {
          id?: number
          coupon_id: number
          user_id: number
          order_id?: number | null
          used_at?: string
          discount_amount: number
        }
        Update: {
          id?: number
          coupon_id?: number
          user_id?: number
          order_id?: number | null
          used_at?: string
          discount_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          }
        ]
      }
      orders: {
        Row: {
          id: number
          status: string
          currency: string
          date_created: string
          date_modified: string
          date_completed: string | null
          date_paid: string | null
          customer_id: number
          calculated_subtotal: number
          calculated_discount: number
          calculated_iva: number
          calculated_total: number
          shipping_total: number
          cart_tax: number
          total: number | null
          total_tax: number | null
          billing_first_name: string
          billing_last_name: string
          billing_company: string | null
          billing_address_1: string
          billing_city: string
          billing_email: string
          billing_phone: string
          order_proyecto: string
          order_fecha_inicio: string
          order_fecha_termino: string
          num_jornadas: number
          company_rut: string
          order_retire_name: string | null
          order_retire_phone: string | null
          order_retire_rut: string | null
          order_comments: string | null
          line_items: Json
          payment_method: string | null
          payment_method_title: string | null
          transaction_id: string | null
          order_key: string | null
          customer_ip_address: string | null
          customer_user_agent: string | null
          created_via: string
          customer_note: string | null
          correo_enviado: boolean
          pago_completo: boolean
          is_editable: boolean
          needs_payment: boolean
          needs_processing: boolean
          fotos_garantia: Json
          orden_compra: string | null
          numero_factura: string | null
          new_pdf_on_hold_url: string | null
          new_pdf_processing_url: string | null
          tax_lines: Json
          shipping_lines: Json
          fee_lines: Json
          coupon_lines: Json
          refunds: Json
        }
        Insert: {
          id?: number
          status?: string
          currency?: string
          date_created?: string
          date_modified?: string
          date_completed?: string | null
          date_paid?: string | null
          customer_id: number
          calculated_subtotal?: number
          calculated_discount?: number
          calculated_iva?: number
          calculated_total?: number
          shipping_total?: number
          cart_tax?: number
          total?: number | null
          total_tax?: number | null
          billing_first_name: string
          billing_last_name: string
          billing_company?: string | null
          billing_address_1: string
          billing_city: string
          billing_email: string
          billing_phone: string
          order_proyecto: string
          order_fecha_inicio: string
          order_fecha_termino: string
          num_jornadas?: number
          company_rut: string
          order_retire_name?: string | null
          order_retire_phone?: string | null
          order_retire_rut?: string | null
          order_comments?: string | null
          line_items?: Json
          payment_method?: string | null
          payment_method_title?: string | null
          transaction_id?: string | null
          order_key?: string | null
          customer_ip_address?: string | null
          customer_user_agent?: string | null
          created_via?: string
          customer_note?: string | null
          correo_enviado?: boolean
          pago_completo?: boolean
          is_editable?: boolean
          needs_payment?: boolean
          needs_processing?: boolean
          fotos_garantia?: Json
          orden_compra?: string | null
          numero_factura?: string | null
          new_pdf_on_hold_url?: string | null
          new_pdf_processing_url?: string | null
          tax_lines?: Json
          shipping_lines?: Json
          fee_lines?: Json
          coupon_lines?: Json
          refunds?: Json
        }
        Update: {
          id?: number
          status?: string
          currency?: string
          date_created?: string
          date_modified?: string
          date_completed?: string | null
          date_paid?: string | null
          customer_id?: number
          calculated_subtotal?: number
          calculated_discount?: number
          calculated_iva?: number
          calculated_total?: number
          shipping_total?: number
          cart_tax?: number
          total?: number | null
          total_tax?: number | null
          billing_first_name?: string
          billing_last_name?: string
          billing_company?: string | null
          billing_address_1?: string
          billing_city?: string
          billing_email?: string
          billing_phone?: string
          order_proyecto?: string
          order_fecha_inicio?: string
          order_fecha_termino?: string
          num_jornadas?: number
          company_rut?: string
          order_retire_name?: string | null
          order_retire_phone?: string | null
          order_retire_rut?: string | null
          order_comments?: string | null
          line_items?: Json
          payment_method?: string | null
          payment_method_title?: string | null
          transaction_id?: string | null
          order_key?: string | null
          customer_ip_address?: string | null
          customer_user_agent?: string | null
          created_via?: string
          customer_note?: string | null
          correo_enviado?: boolean
          pago_completo?: boolean
          is_editable?: boolean
          needs_payment?: boolean
          needs_processing?: boolean
          fotos_garantia?: Json
          orden_compra?: string | null
          numero_factura?: string | null
          new_pdf_on_hold_url?: string | null
          new_pdf_processing_url?: string | null
          tax_lines?: Json
          shipping_lines?: Json
          fee_lines?: Json
          coupon_lines?: Json
          refunds?: Json
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          }
        ]
      }
      user_profiles: {
        Row: {
          user_id: number;
          auth_uid: string | null;
          email: string;
          nombre: string | null;
          apellido: string | null;
          usuario: string | null;
          rut: string | null;
          direccion: string | null;
          ciudad: string | null;
          pais: string | null;
          tipo_cliente: string | null;
          telefono: string | null;
          instagram: string | null;
          fecha_nacimiento: string | null;
          empresa_nombre: string | null;
          empresa_rut: string | null;
          empresa_ciudad: string | null;
          empresa_direccion: string | null;
          url_empresa_erut: string | null;
          new_url_e_rut_empresa: string | null;
          url_rut_anverso: string | null;
          url_rut_reverso: string | null;
          url_firma: string | null;
          terminos_aceptados: boolean | null;
          created_at: string;
          updated_at: string;
          url_user_contrato: string | null;
        };
        Insert: {
          user_id?: number;
          auth_uid?: string | null;
          email: string;
          nombre?: string | null;
          apellido?: string | null;
          usuario?: string | null;
          rut?: string | null;
          direccion?: string | null;
          ciudad?: string | null;
          pais?: string | null;
          tipo_cliente?: string | null;
          telefono?: string | null;
          instagram?: string | null;
          fecha_nacimiento?: string | null;
          empresa_nombre?: string | null;
          empresa_rut?: string | null;
          empresa_ciudad?: string | null;
          empresa_direccion?: string | null;
          url_empresa_erut?: string | null;
          new_url_e_rut_empresa?: string | null;
          url_rut_anverso?: string | null;
          url_rut_reverso?: string | null;
          url_firma?: string | null;
          terminos_aceptados?: boolean | null;
          created_at?: string;
          updated_at?: string;
          url_user_contrato?: string | null;
        };
        Update: {
          user_id?: number;
          auth_uid?: string | null;
          email?: string;
          nombre?: string | null;
          apellido?: string | null;
          usuario?: string | null;
          rut?: string | null;
          direccion?: string | null;
          ciudad?: string | null;
          pais?: string | null;
          tipo_cliente?: string | null;
          telefono?: string | null;
          instagram?: string | null;
          fecha_nacimiento?: string | null;
          empresa_nombre?: string | null;
          empresa_rut?: string | null;
          empresa_ciudad?: string | null;
          empresa_direccion?: string | null;
          url_empresa_erut?: string | null;
          new_url_e_rut_empresa?: string | null;
          url_rut_anverso?: string | null;
          url_rut_reverso?: string | null;
          url_firma?: string | null;
          terminos_aceptados?: boolean | null;
          created_at?: string;
          updated_at?: string;
          url_user_contrato?: string | null;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: number;
          order_id: number;
          product_id: number;
          product_name: string;
          product_price: number;
          quantity: number;
          total: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          order_id: number;
          product_id: number;
          product_name: string;
          product_price: number;
          quantity: number;
          total: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          order_id?: number;
          product_id?: number;
          product_name?: string;
          product_price?: number;
          quantity?: number;
          total?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          }
        ];
      };
      products: {
        Row: {
          id: number;
          name: string | null;
          slug: string | null;
          type: string | null;
          status: string | null;
          featured: boolean | null;
          catalog_visibility: string | null;
          description: string | null;
          short_description: string | null;
          sku: string | null;
          price: number | null;
          regular_price: number | null;
          sale_price: number | null;
          on_sale: boolean | null;
          total_sales: number | null;
          sold_individually: boolean | null;
          related_ids: Json | null;
          stock_status: string | null;
          brands: string | null;
          dimensions_length: number | null;
          dimensions_width: number | null;
          dimensions_height: number | null;
          seo_title: string | null;
          seo_description: string | null;
          seo_keywords: string | null;
          primary_term_product_cat: string | null;
          images: Json | null;
          categories_ids: Json | null;
          categories_name: string | null;
          tags: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name?: string | null;
          slug?: string | null;
          type?: string | null;
          status?: string | null;
          featured?: boolean | null;
          catalog_visibility?: string | null;
          description?: string | null;
          short_description?: string | null;
          sku?: string | null;
          price?: number | null;
          regular_price?: number | null;
          sale_price?: number | null;
          on_sale?: boolean | null;
          total_sales?: number | null;
          sold_individually?: boolean | null;
          related_ids?: Json | null;
          stock_status?: string | null;
          brands?: string | null;
          dimensions_length?: number | null;
          dimensions_width?: number | null;
          dimensions_height?: number | null;
          seo_title?: string | null;
          seo_description?: string | null;
          seo_keywords?: string | null;
          primary_term_product_cat?: string | null;
          images?: Json | null;
          categories_ids?: Json | null;
          categories_name?: string | null;
          tags?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string | null;
          slug?: string | null;
          type?: string | null;
          status?: string | null;
          featured?: boolean | null;
          catalog_visibility?: string | null;
          description?: string | null;
          short_description?: string | null;
          sku?: string | null;
          price?: number | null;
          regular_price?: number | null;
          sale_price?: number | null;
          on_sale?: boolean | null;
          total_sales?: number | null;
          sold_individually?: boolean | null;
          related_ids?: Json | null;
          stock_status?: string | null;
          brands?: string | null;
          dimensions_length?: number | null;
          dimensions_width?: number | null;
          dimensions_height?: number | null;
          seo_title?: string | null;
          seo_description?: string | null;
          seo_keywords?: string | null;
          primary_term_product_cat?: string | null;
          images?: Json | null;
          categories_ids?: Json | null;
          categories_name?: string | null;
          tags?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_users: {
        Row: {
          id: number
          user_id: string
          email: string
          role: string
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          email: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          email?: string
          role?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_user_profile_manual: {
        Args: {
          user_auth_uid: string
          user_email: string
          user_nombre: string
          user_apellido: string
          user_usuario: string
        }
        Returns: {
          user_id: number
          auth_uid: string
          email: string
          nombre: string
          apellido: string
          usuario: string
        }
      }
      update_user_profile_securely: {
        Args: {
          p_user_id: number
          p_updates: Json
        }
        Returns: Json[]
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
