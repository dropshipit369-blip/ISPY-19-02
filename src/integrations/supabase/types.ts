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
      items: {
        Row: {
          barcode: string | null
          brand: string | null
          category: string | null
          color: string | null
          condition: string | null
          condition_score: number | null
          created_at: string
          extracted_text: string | null
          id: string
          image_url: string
          model: string | null
          notes: string | null
          purchase_price: number | null
          sale_price: number | null
          sold_at: string | null
          status: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          color?: string | null
          condition?: string | null
          condition_score?: number | null
          created_at?: string
          extracted_text?: string | null
          id?: string
          image_url: string
          model?: string | null
          notes?: string | null
          purchase_price?: number | null
          sale_price?: number | null
          sold_at?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          color?: string | null
          condition?: string | null
          condition_score?: number | null
          created_at?: string
          extracted_text?: string | null
          id?: string
          image_url?: string
          model?: string | null
          notes?: string | null
          purchase_price?: number | null
          sale_price?: number | null
          sold_at?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      live_scan_usage: {
        Row: {
          created_at: string
          id: string
          items_identified: number
          month_year: string
          scan_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items_identified?: number
          month_year: string
          scan_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items_identified?: number
          month_year?: string
          scan_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_reports: {
        Row: {
          avg_days_to_sell: number | null
          best_day_to_list: string | null
          best_marketplace: string | null
          confidence_score: number | null
          created_at: string
          data_sources: Json | null
          high_price: number | null
          id: string
          item_id: string
          listing_type: string | null
          low_price: number | null
          median_price: number | null
          price_trend: string | null
          shipping_recommendation: string | null
          sold_comparables: Json
          suggested_description: string | null
          suggested_keywords: string[] | null
          suggested_price: number | null
          suggested_title: string | null
          trend_percentage: number | null
          verification_message: string | null
          verification_source: string | null
          verification_status: string | null
          verified_comps_count: number
        }
        Insert: {
          avg_days_to_sell?: number | null
          best_day_to_list?: string | null
          best_marketplace?: string | null
          confidence_score?: number | null
          created_at?: string
          data_sources?: Json | null
          high_price?: number | null
          id?: string
          item_id: string
          listing_type?: string | null
          low_price?: number | null
          median_price?: number | null
          price_trend?: string | null
          shipping_recommendation?: string | null
          sold_comparables?: Json
          suggested_description?: string | null
          suggested_keywords?: string[] | null
          suggested_price?: number | null
          suggested_title?: string | null
          trend_percentage?: number | null
          verification_message?: string | null
          verification_source?: string | null
          verification_status?: string | null
          verified_comps_count?: number
        }
        Update: {
          avg_days_to_sell?: number | null
          best_day_to_list?: string | null
          best_marketplace?: string | null
          confidence_score?: number | null
          created_at?: string
          data_sources?: Json | null
          high_price?: number | null
          id?: string
          item_id?: string
          listing_type?: string | null
          low_price?: number | null
          median_price?: number | null
          price_trend?: string | null
          shipping_recommendation?: string | null
          sold_comparables?: Json
          suggested_description?: string | null
          suggested_keywords?: string[] | null
          suggested_price?: number | null
          suggested_title?: string | null
          trend_percentage?: number | null
          verification_message?: string | null
          verification_source?: string | null
          verification_status?: string | null
          verified_comps_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_reports_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          item_id: string
          target_price: number
          triggered: boolean | null
          triggered_at: string | null
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          item_id: string
          target_price: number
          triggered?: boolean | null
          triggered_at?: string | null
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          item_id?: string
          target_price?: number
          triggered?: boolean | null
          triggered_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scan_feedback: {
        Row: {
          accuracy_rating: number | null
          corrected_brand: string | null
          corrected_category: string | null
          corrected_condition: string | null
          corrected_high_price: number | null
          corrected_low_price: number | null
          corrected_model: string | null
          corrected_name: string | null
          created_at: string
          feedback_type: string
          id: string
          notes: string | null
          original_brand: string | null
          original_category: string | null
          original_condition: string | null
          original_high_price: number | null
          original_low_price: number | null
          original_model: string | null
          original_name: string
          scan_log_id: string | null
          user_id: string
        }
        Insert: {
          accuracy_rating?: number | null
          corrected_brand?: string | null
          corrected_category?: string | null
          corrected_condition?: string | null
          corrected_high_price?: number | null
          corrected_low_price?: number | null
          corrected_model?: string | null
          corrected_name?: string | null
          created_at?: string
          feedback_type?: string
          id?: string
          notes?: string | null
          original_brand?: string | null
          original_category?: string | null
          original_condition?: string | null
          original_high_price?: number | null
          original_low_price?: number | null
          original_model?: string | null
          original_name: string
          scan_log_id?: string | null
          user_id: string
        }
        Update: {
          accuracy_rating?: number | null
          corrected_brand?: string | null
          corrected_category?: string | null
          corrected_condition?: string | null
          corrected_high_price?: number | null
          corrected_low_price?: number | null
          corrected_model?: string | null
          corrected_name?: string | null
          created_at?: string
          feedback_type?: string
          id?: string
          notes?: string | null
          original_brand?: string | null
          original_category?: string | null
          original_condition?: string | null
          original_high_price?: number | null
          original_low_price?: number | null
          original_model?: string | null
          original_name?: string
          scan_log_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_feedback_scan_log_id_fkey"
            columns: ["scan_log_id"]
            isOneToOne: false
            referencedRelation: "scan_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_logs: {
        Row: {
          brand: string | null
          category: string | null
          condition: string | null
          confidence: number | null
          high_price: number | null
          id: string
          low_price: number | null
          median_price: number | null
          model: string | null
          name: string
          pricing_sources: Json | null
          scanned_at: string
          trend: string | null
          user_id: string
        }
        Insert: {
          brand?: string | null
          category?: string | null
          condition?: string | null
          confidence?: number | null
          high_price?: number | null
          id?: string
          low_price?: number | null
          median_price?: number | null
          model?: string | null
          name: string
          pricing_sources?: Json | null
          scanned_at?: string
          trend?: string | null
          user_id: string
        }
        Update: {
          brand?: string | null
          category?: string | null
          condition?: string | null
          confidence?: number | null
          high_price?: number | null
          id?: string
          low_price?: number | null
          median_price?: number | null
          model?: string | null
          name?: string
          pricing_sources?: Json | null
          scanned_at?: string
          trend?: string | null
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
      user_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_type: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_type?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_type?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
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
