export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agenda_visits: {
        Row: {
          check_in_accuracy_m: number | null
          check_in_at: string | null
          check_in_lat: number | null
          check_in_lng: number | null
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          organization_id: string
          scheduled_at: string
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          check_in_accuracy_m?: number | null
          check_in_at?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          organization_id: string
          scheduled_at: string
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          check_in_accuracy_m?: number | null
          check_in_at?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          scheduled_at?: string
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_visits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_visits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_visits_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_suggestions: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          order_id: string | null
          organization_id: string
          reason: string | null
          score: number | null
          suggested_product_id: string
          updated_at: string
          was_accepted: boolean
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          order_id?: string | null
          organization_id: string
          reason?: string | null
          score?: number | null
          suggested_product_id: string
          updated_at?: string
          was_accepted?: boolean
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          order_id?: string | null
          organization_id?: string
          reason?: string | null
          score?: number | null
          suggested_product_id?: string
          updated_at?: string
          was_accepted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_suggested_product_id_fkey"
            columns: ["suggested_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: Json
          cnpj_cpf: string | null
          created_at: string
          credit_limit: number
          credit_status: string
          email: string | null
          external_id: string | null
          id: string
          is_active: boolean
          name: string
          name_search: string | null
          organization_id: string
          owner_id: string
          phone: string | null
          portal_user_id: string | null
          updated_at: string
        }
        Insert: {
          address?: Json
          cnpj_cpf?: string | null
          created_at?: string
          credit_limit?: number
          credit_status?: string
          email?: string | null
          external_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_search?: string | null
          organization_id: string
          owner_id: string
          phone?: string | null
          portal_user_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: Json
          cnpj_cpf?: string | null
          created_at?: string
          credit_limit?: number
          credit_status?: string
          email?: string | null
          external_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_search?: string | null
          organization_id?: string
          owner_id?: string
          phone?: string | null
          portal_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_portal_user_id_fkey"
            columns: ["portal_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_forecasts: {
        Row: {
          confidence: number | null
          created_at: string
          forecast_quantity: number
          generated_at: string
          id: string
          organization_id: string
          period_end: string
          period_start: string
          product_id: string
          rationale: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          forecast_quantity: number
          generated_at?: string
          id?: string
          organization_id: string
          period_end: string
          period_start: string
          product_id: string
          rationale?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          forecast_quantity?: number
          generated_at?: string
          id?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          product_id?: string
          rationale?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_forecasts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_forecasts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          entity_type: string
          error_log: Json
          file_url: string | null
          id: string
          organization_id: string
          rows_imported: number
          rows_total: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_type: string
          error_log?: Json
          file_url?: string | null
          id?: string
          organization_id: string
          rows_imported?: number
          rows_total?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_type?: string
          error_log?: Json
          file_url?: string | null
          id?: string
          organization_id?: string
          rows_imported?: number
          rows_total?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      indicator_insights: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          insight_text: string
          metrics_snapshot: Json
          organization_id: string
          period: string
          scope: string
          scope_ref_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          insight_text: string
          metrics_snapshot?: Json
          organization_id: string
          period: string
          scope: string
          scope_ref_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          insight_text?: string
          metrics_snapshot?: Json
          organization_id?: string
          period?: string
          scope?: string
          scope_ref_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_configs: {
        Row: {
          created_at: string
          credentials: Json
          id: string
          integration_type: string
          is_active: boolean
          last_sync_at: string | null
          organization_id: string
          provider: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credentials?: Json
          id?: string
          integration_type: string
          is_active?: boolean
          last_sync_at?: string | null
          organization_id: string
          provider?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credentials?: Json
          id?: string
          integration_type?: string
          is_active?: boolean
          last_sync_at?: string | null
          organization_id?: string
          provider?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
          updated_at: string
          was_ai_suggested: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          order_id: string
          product_id: string
          quantity?: number
          unit_price: number
          updated_at?: string
          was_ai_suggested?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          updated_at?: string
          was_ai_suggested?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          customer_id: string
          discount_amount: number
          erp_order_id: string | null
          erp_sync_status: string
          id: string
          needs_approval: boolean
          notes: string | null
          organization_id: string
          origin: string
          seller_id: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          customer_id: string
          discount_amount?: number
          erp_order_id?: string | null
          erp_sync_status?: string
          id?: string
          needs_approval?: boolean
          notes?: string | null
          organization_id: string
          origin?: string
          seller_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          customer_id?: string
          discount_amount?: number
          erp_order_id?: string | null
          erp_sync_status?: string
          id?: string
          needs_approval?: boolean
          notes?: string | null
          organization_id?: string
          origin?: string
          seller_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          name: string
          settings: Json
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          name: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          name?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          gateway: string
          gateway_payment_id: string | null
          id: string
          order_id: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          gateway: string
          gateway_payment_id?: string | null
          id?: string
          order_id: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          gateway?: string
          gateway_payment_id?: string | null
          id?: string
          order_id?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          external_id: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_ecommerce_visible: boolean
          name: string
          organization_id: string
          sku: string
          stock_quantity: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_ecommerce_visible?: boolean
          name: string
          organization_id: string
          sku: string
          stock_quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_ecommerce_visible?: boolean
          name?: string
          organization_id?: string
          sku?: string
          stock_quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          organization_id: string
          phone: string | null
          role: string
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          organization_id: string
          phone?: string | null
          role?: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          phone?: string | null
          role?: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          product_id: string
          quantity: number
          quote_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          product_id: string
          quantity?: number
          quote_id: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          product_id?: string
          quantity?: number
          quote_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          customer_id: string
          discount_amount: number
          id: string
          notes: string | null
          order_id: string | null
          organization_id: string
          seller_id: string | null
          status: string
          total_amount: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          discount_amount?: number
          id?: string
          notes?: string | null
          order_id?: string | null
          organization_id: string
          seller_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          discount_amount?: number
          id?: string
          notes?: string | null
          order_id?: string | null
          organization_id?: string
          seller_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_targets: {
        Row: {
          created_at: string
          customer_target: number | null
          id: string
          organization_id: string
          period: string
          seller_id: string
          target_amount: number
          updated_at: string
          visit_target: number | null
        }
        Insert: {
          created_at?: string
          customer_target?: number | null
          id?: string
          organization_id: string
          period: string
          seller_id: string
          target_amount?: number
          updated_at?: string
          visit_target?: number | null
        }
        Update: {
          created_at?: string
          customer_target?: number | null
          id?: string
          organization_id?: string
          period?: string
          seller_id?: string
          target_amount?: number
          updated_at?: string
          visit_target?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_targets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_targets_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calc_order_totals: {
        Args: { p_order_id: string }
        Returns: {
          discount_amount: number
          total_amount: number
        }[]
      }
      calc_quote_totals: {
        Args: { p_quote_id: string }
        Returns: {
          discount_amount: number
          total_amount: number
        }[]
      }
      convert_quote_to_order: { Args: { p_quote_id: string }; Returns: Json }
      current_profile: {
        Args: never
        Returns: {
          organization_id: string
          profile_id: string
          role: string
          supervisor_id: string
        }[]
      }
      get_sales_flow: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          orders_count: number
          region: string
          seller_id: string
          seller_name: string
          status: string
          total_amount: number
        }[]
      }
      get_seller_indicators: {
        Args: { p_period: string; p_seller_id: string }
        Returns: Json
      }
      get_unserved_customers: {
        Args: { p_period: string; p_seller_id: string }
        Returns: Json
      }
      search_fold: { Args: { t: string }; Returns: string }
      set_order_erp_result: {
        Args: { p_erp_order_id: string; p_order_id: string; p_status: string }
        Returns: undefined
      }
      submit_order: { Args: { p_order_id: string }; Returns: Json }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
