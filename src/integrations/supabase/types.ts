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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      document_items: {
        Row: {
          document_id: string
          dosage: string | null
          id: string
          kind: Database["public"]["Enums"]["item_kind"]
          name: string
          notes: string | null
          order_index: number
          reference_range: string | null
          route: string | null
          unit: string | null
          value: string | null
        }
        Insert: {
          document_id: string
          dosage?: string | null
          id?: string
          kind: Database["public"]["Enums"]["item_kind"]
          name: string
          notes?: string | null
          order_index?: number
          reference_range?: string | null
          route?: string | null
          unit?: string | null
          value?: string | null
        }
        Update: {
          document_id?: string
          dosage?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["item_kind"]
          name?: string
          notes?: string | null
          order_index?: number
          reference_range?: string | null
          route?: string | null
          unit?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          cid: string | null
          confidence: Database["public"]["Enums"]["doc_confidence"]
          created_at: string
          doc_date: string | null
          doc_type: Database["public"]["Enums"]["doc_type"]
          doctor_crm: string | null
          doctor_name: string | null
          file_path: string
          id: string
          low_confidence_fields: string[]
          mime_type: string
          raw_text: string | null
          reporting_doctor_crm: string | null
          reporting_doctor_name: string | null
          requesting_doctor_crm: string | null
          requesting_doctor_name: string | null
          summary: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cid?: string | null
          confidence?: Database["public"]["Enums"]["doc_confidence"]
          created_at?: string
          doc_date?: string | null
          doc_type?: Database["public"]["Enums"]["doc_type"]
          doctor_crm?: string | null
          doctor_name?: string | null
          file_path: string
          id?: string
          low_confidence_fields?: string[]
          mime_type: string
          raw_text?: string | null
          reporting_doctor_crm?: string | null
          reporting_doctor_name?: string | null
          requesting_doctor_crm?: string | null
          requesting_doctor_name?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cid?: string | null
          confidence?: Database["public"]["Enums"]["doc_confidence"]
          created_at?: string
          doc_date?: string | null
          doc_type?: Database["public"]["Enums"]["doc_type"]
          doctor_crm?: string | null
          doctor_name?: string | null
          file_path?: string
          id?: string
          low_confidence_fields?: string[]
          mime_type?: string
          raw_text?: string | null
          reporting_doctor_crm?: string | null
          reporting_doctor_name?: string | null
          requesting_doctor_crm?: string | null
          requesting_doctor_name?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      shares: {
        Row: {
          created_at: string
          document_id: string | null
          expires_at: string | null
          id: string
          revoked_at: string | null
          scope: Database["public"]["Enums"]["share_scope"]
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          scope: Database["public"]["Enums"]["share_scope"]
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          scope?: Database["public"]["Enums"]["share_scope"]
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shares_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      doc_confidence: "high" | "review"
      doc_type:
        | "lab_exam"
        | "prescription"
        | "report"
        | "referral"
        | "authorization"
        | "other"
      item_kind: "lab" | "med"
      share_scope: "all" | "document"
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
    Enums: {
      doc_confidence: ["high", "review"],
      doc_type: [
        "lab_exam",
        "prescription",
        "report",
        "referral",
        "authorization",
        "other",
      ],
      item_kind: ["lab", "med"],
      share_scope: ["all", "document"],
    },
  },
} as const
