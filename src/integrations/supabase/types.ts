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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_devices: {
        Row: {
          device_id: string
          enrolled_via: string
          first_seen_at: string
          id: string
          last_seen_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          device_id: string
          enrolled_via: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          device_id?: string
          enrolled_via?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          frequency: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          frequency?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          frequency?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      expense_schedules: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          id: string
          item_id: string | null
          item_name: string
          last_amount: number
          month_day: number | null
          next_due: string
          payment_method: string
          payment_method_note: string | null
          repeat: string
          sub_category_id: string | null
          supplier_id: string | null
          updated_at: string
          user_id: string
          weekday: number | null
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          item_name: string
          last_amount?: number
          month_day?: number | null
          next_due: string
          payment_method?: string
          payment_method_note?: string | null
          repeat: string
          sub_category_id?: string | null
          supplier_id?: string | null
          updated_at?: string
          user_id: string
          weekday?: number | null
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          item_name?: string
          last_amount?: number
          month_day?: number | null
          next_due?: string
          payment_method?: string
          payment_method_note?: string | null
          repeat?: string
          sub_category_id?: string | null
          supplier_id?: string | null
          updated_at?: string
          user_id?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_schedules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_schedules_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_schedules_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_schedules_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_span_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_index: number
          payment_id: string | null
          span_id: string
          sub_payment_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_index: number
          payment_id?: string | null
          span_id: string
          sub_payment_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_index?: number
          payment_id?: string | null
          span_id?: string
          sub_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_span_installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_span_installments_span_id_fkey"
            columns: ["span_id"]
            isOneToOne: false
            referencedRelation: "expense_spans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_span_installments_sub_payment_id_fkey"
            columns: ["sub_payment_id"]
            isOneToOne: false
            referencedRelation: "sub_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_spans: {
        Row: {
          category_id: string | null
          created_at: string
          day_of_month: number
          id: string
          item_id: string | null
          item_name: string
          next_due_date: string
          notes: string | null
          period_count: number
          posted_count: number
          start_date: string
          status: string
          sub_category_id: string | null
          sub_sub_category_id: string | null
          supplier_id: string | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          day_of_month: number
          id?: string
          item_id?: string | null
          item_name: string
          next_due_date: string
          notes?: string | null
          period_count: number
          posted_count?: number
          start_date: string
          status?: string
          sub_category_id?: string | null
          sub_sub_category_id?: string | null
          supplier_id?: string | null
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          day_of_month?: number
          id?: string
          item_id?: string | null
          item_name?: string
          next_due_date?: string
          notes?: string | null
          period_count?: number
          posted_count?: number
          start_date?: string
          status?: string
          sub_category_id?: string | null
          sub_sub_category_id?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_spans_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_spans_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_spans_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_spans_sub_sub_category_id_fkey"
            columns: ["sub_sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_spans_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category_id: string | null
          created_at: string
          default_supplier_id: string | null
          default_unit_price: number | null
          id: string
          name: string
          sub_category_id: string | null
          sub_sub_category_id: string | null
          unit: string | null
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          default_supplier_id?: string | null
          default_unit_price?: number | null
          id?: string
          name: string
          sub_category_id?: string | null
          sub_sub_category_id?: string | null
          unit?: string | null
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          default_supplier_id?: string | null
          default_unit_price?: number | null
          id?: string
          name?: string
          sub_category_id?: string | null
          sub_sub_category_id?: string | null
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_default_supplier_id_fkey"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_sub_sub_category_id_fkey"
            columns: ["sub_sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          source_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          source_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          source_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      order_ingredients: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          order_count: number
          quick_quantities: Json
          reference_price: number | null
          source_key: string | null
          subcategory: string | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          order_count?: number
          quick_quantities?: Json
          reference_price?: number | null
          source_key?: string | null
          subcategory?: string | null
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          order_count?: number
          quick_quantities?: Json
          reference_price?: number | null
          source_key?: string | null
          subcategory?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_ingredients_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "order_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          fulfilled_qty: number | null
          id: string
          is_alternate: boolean
          money_amount: number | null
          name: string
          notice: string | null
          order_id: string
          order_mode: string
          quantity: number
          retail_price: number | null
          sort_order: number
          status: string
          unit: string
          updated_at: string
          vendor_notice: string | null
        }
        Insert: {
          created_at?: string
          fulfilled_qty?: number | null
          id?: string
          is_alternate?: boolean
          money_amount?: number | null
          name: string
          notice?: string | null
          order_id: string
          order_mode?: string
          quantity?: number
          retail_price?: number | null
          sort_order?: number
          status?: string
          unit?: string
          updated_at?: string
          vendor_notice?: string | null
        }
        Update: {
          created_at?: string
          fulfilled_qty?: number | null
          id?: string
          is_alternate?: boolean
          money_amount?: number | null
          name?: string
          notice?: string | null
          order_id?: string
          order_mode?: string
          quantity?: number
          retail_price?: number | null
          sort_order?: number
          status?: string
          unit?: string
          updated_at?: string
          vendor_notice?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_name: string | null
          day_seq: number
          deduction: number
          id: string
          include_deduction: boolean
          include_shipping: boolean
          mgmt_id: string | null
          share_token: string
          shipping_fee: number
          status: string
          supplier_pin_hash: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          day_seq?: number
          deduction?: number
          id?: string
          include_deduction?: boolean
          include_shipping?: boolean
          mgmt_id?: string | null
          share_token: string
          shipping_fee?: number
          status?: string
          supplier_pin_hash: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          day_seq?: number
          deduction?: number
          id?: string
          include_deduction?: boolean
          include_shipping?: boolean
          mgmt_id?: string | null
          share_token?: string
          shipping_fee?: number
          status?: string
          supplier_pin_hash?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          receipt_photo_path: string | null
          supplier_id: string | null
          time: string
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          receipt_photo_path?: string | null
          supplier_id?: string | null
          time?: string
          total_amount?: number
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          receipt_photo_path?: string | null
          supplier_id?: string | null
          time?: string
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_employees: {
        Row: {
          account: string | null
          amount: number
          created_at: string
          deposit: number | null
          id: string
          name: string
          sort_index: number
          transfer_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account?: string | null
          amount?: number
          created_at?: string
          deposit?: number | null
          id?: string
          name: string
          sort_index?: number
          transfer_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account?: string | null
          amount?: number
          created_at?: string
          deposit?: number | null
          id?: string
          name?: string
          sort_index?: number
          transfer_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      salary_roster_meta: {
        Row: {
          exported_at: string | null
          period: Json | null
          summary: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          exported_at?: string | null
          period?: Json | null
          summary?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          exported_at?: string | null
          period?: Json | null
          summary?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sub_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          parent_sub_category_id: string | null
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          parent_sub_category_id?: string | null
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          parent_sub_category_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_categories_parent_sub_category_id_fkey"
            columns: ["parent_sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_payment_lines: {
        Row: {
          amount: number
          attrs: Json
          created_at: string
          id: string
          name: string
          sort_index: number
          sub_payment_id: string
          user_id: string
        }
        Insert: {
          amount?: number
          attrs?: Json
          created_at?: string
          id?: string
          name: string
          sort_index?: number
          sub_payment_id: string
          user_id: string
        }
        Update: {
          amount?: number
          attrs?: Json
          created_at?: string
          id?: string
          name?: string
          sort_index?: number
          sub_payment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_payment_lines_sub_payment_id_fkey"
            columns: ["sub_payment_id"]
            isOneToOne: false
            referencedRelation: "sub_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_payments: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          id: string
          item_id: string | null
          item_name: string
          notes: string | null
          payment_id: string
          payment_method: string
          payment_method_note: string | null
          quantity: number
          sub_category_id: string | null
          sub_sub_category_id: string | null
          supplier_id: string | null
          unit_price: number
          user_id: string
        }
        Insert: {
          amount?: number
          category_id?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          item_name: string
          notes?: string | null
          payment_id: string
          payment_method?: string
          payment_method_note?: string | null
          quantity?: number
          sub_category_id?: string | null
          sub_sub_category_id?: string | null
          supplier_id?: string | null
          unit_price?: number
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          item_name?: string
          notes?: string | null
          payment_id?: string
          payment_method?: string
          payment_method_note?: string | null
          quantity?: number
          sub_category_id?: string | null
          sub_sub_category_id?: string | null
          supplier_id?: string | null
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_payments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_payments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_payments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_payments_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_payments_sub_sub_category_id_fkey"
            columns: ["sub_sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_payment_lines_sub_payment_id_fkey"
            columns: ["id"]
            isOneToOne: false
            referencedRelation: "sub_payment_lines"
            referencedColumns: ["sub_payment_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_shared_order_alternate: {
        Args: {
          p_name?: string
          p_quantity?: number
          p_token: string
          p_unit?: string
        }
        Returns: {
          created_at: string
          fulfilled_qty: number | null
          id: string
          is_alternate: boolean
          money_amount: number | null
          name: string
          notice: string | null
          order_id: string
          order_mode: string
          quantity: number
          retail_price: number | null
          sort_order: number
          status: string
          unit: string
          updated_at: string
          vendor_notice: string | null
        }
        SetofOptions: {
          from: "*"
          to: "order_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_shared_order_alternate: {
        Args: { p_item_id: string; p_token: string }
        Returns: undefined
      }
      get_shared_order: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          customer_name: string
          day_seq: number
          deduction: number
          id: string
          include_deduction: boolean
          include_shipping: boolean
          mgmt_id: string
          shipping_fee: number
          status: string
          title: string
          updated_at: string
        }[]
      }
      get_shared_order_items: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          fulfilled_qty: number | null
          id: string
          is_alternate: boolean
          money_amount: number | null
          name: string
          notice: string | null
          order_id: string
          order_mode: string
          quantity: number
          retail_price: number | null
          sort_order: number
          status: string
          unit: string
          updated_at: string
          vendor_notice: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "order_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_enrolled_admin_device: {
        Args: { p_device_id: string }
        Returns: boolean
      }
      touch_admin_device: {
        Args: {
          p_device_id: string
          p_enrolled_via: string
          p_user_agent?: string
        }
        Returns: boolean
      }
      update_shared_order_alternate: {
        Args: {
          p_fulfilled_qty: number
          p_item_id: string
          p_name: string
          p_notice: string
          p_quantity: number
          p_retail_price: number
          p_status: string
          p_token: string
          p_unit: string
        }
        Returns: {
          created_at: string
          fulfilled_qty: number | null
          id: string
          is_alternate: boolean
          money_amount: number | null
          name: string
          notice: string | null
          order_id: string
          order_mode: string
          quantity: number
          retail_price: number | null
          sort_order: number
          status: string
          unit: string
          updated_at: string
          vendor_notice: string | null
        }
        SetofOptions: {
          from: "*"
          to: "order_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_shared_order_extras: {
        Args: {
          p_deduction: number
          p_include_deduction: boolean
          p_include_shipping: boolean
          p_shipping_fee: number
          p_token: string
        }
        Returns: undefined
      }
      update_shared_order_item: {
        Args: {
          p_fulfilled_qty: number
          p_item_id: string
          p_notice: string
          p_retail_price: number
          p_status: string
          p_token: string
        }
        Returns: {
          created_at: string
          fulfilled_qty: number | null
          id: string
          is_alternate: boolean
          money_amount: number | null
          name: string
          notice: string | null
          order_id: string
          order_mode: string
          quantity: number
          retail_price: number | null
          sort_order: number
          status: string
          unit: string
          updated_at: string
          vendor_notice: string | null
        }
        SetofOptions: {
          from: "*"
          to: "order_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_order_pin: {
        Args: { p_pin: string; p_token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
