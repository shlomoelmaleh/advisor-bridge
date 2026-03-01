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
      branch_appetites: {
        Row: {
          appetite_level: string | null
          bank_name: string
          banker_id: string | null
          branch_name: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_approved: boolean | null
          max_ltv: number | null
          min_loan_amount: number | null
          preferred_borrower_types: string[] | null
          preferred_regions: string[] | null
          sla_days: number | null
          valid_until: string | null
        }
        Insert: {
          appetite_level?: string | null
          bank_name: string
          banker_id?: string | null
          branch_name?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_approved?: boolean | null
          max_ltv?: number | null
          min_loan_amount?: number | null
          preferred_borrower_types?: string[] | null
          preferred_regions?: string[] | null
          sla_days?: number | null
          valid_until?: string | null
        }
        Update: {
          appetite_level?: string | null
          bank_name?: string
          banker_id?: string | null
          branch_name?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_approved?: boolean | null
          max_ltv?: number | null
          min_loan_amount?: number | null
          preferred_borrower_types?: string[] | null
          preferred_regions?: string[] | null
          sla_days?: number | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_appetites_banker_id_fkey"
            columns: ["banker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cases: {
        Row: {
          advisor_id: string | null
          borrower_type: string | null
          created_at: string | null
          id: string
          is_anonymous: boolean | null
          is_approved: boolean | null
          last_matched_at: string | null
          loan_amount_max: number | null
          loan_amount_min: number | null
          ltv: number | null
          priorities: Json | null
          property_type: string | null
          region: string | null
          status: string | null
        }
        Insert: {
          advisor_id?: string | null
          borrower_type?: string | null
          created_at?: string | null
          id?: string
          is_anonymous?: boolean | null
          is_approved?: boolean | null
          last_matched_at?: string | null
          loan_amount_max?: number | null
          loan_amount_min?: number | null
          ltv?: number | null
          priorities?: Json | null
          property_type?: string | null
          region?: string | null
          status?: string | null
        }
        Update: {
          advisor_id?: string | null
          borrower_type?: string | null
          created_at?: string | null
          id?: string
          is_anonymous?: boolean | null
          is_approved?: boolean | null
          last_matched_at?: string | null
          loan_amount_max?: number | null
          loan_amount_min?: number | null
          ltv?: number | null
          priorities?: Json | null
          property_type?: string | null
          region?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      matches: {
        Row: {
          advisor_status: string | null
          appetite_id: string | null
          banker_status: string | null
          case_id: string | null
          created_at: string | null
          id: string
          score: number | null
          status: string | null
        }
        Insert: {
          advisor_status?: string | null
          appetite_id?: string | null
          banker_status?: string | null
          case_id?: string | null
          created_at?: string | null
          id?: string
          score?: number | null
          status?: string | null
        }
        Update: {
          advisor_status?: string | null
          appetite_id?: string | null
          banker_status?: string | null
          case_id?: string | null
          created_at?: string | null
          id?: string
          score?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_appetite_id_fkey"
            columns: ["appetite_id"]
            isOneToOne: false
            referencedRelation: "branch_appetites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          match_id: string | null
          sender_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          match_id?: string | null
          sender_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          match_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string | null
          full_name: string | null
          is_approved: boolean | null
          role: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          full_name?: string | null
          is_approved?: boolean | null
          role: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string | null
          full_name?: string | null
          is_approved?: boolean | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_match_score: {
        Args: { p_appetite_id: string; p_case_id: string }
        Returns: number
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      run_matching_for_case: { Args: { p_case_id: string }; Returns: undefined }
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
