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
      access_users: {
        Row: {
          access_id: string
          allowed_routes: string[]
          created_at: string
          default_route: string
          department: string | null
          designation: string | null
          full_name: string | null
          is_super_admin: boolean
          label: string | null
          last_seen: string | null
          phone: string | null
          route_permissions: Json
          unit_office: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_id: string
          allowed_routes?: string[]
          created_at?: string
          default_route?: string
          department?: string | null
          designation?: string | null
          full_name?: string | null
          is_super_admin?: boolean
          label?: string | null
          last_seen?: string | null
          phone?: string | null
          route_permissions?: Json
          unit_office?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_id?: string
          allowed_routes?: string[]
          created_at?: string
          default_route?: string
          department?: string | null
          designation?: string | null
          full_name?: string | null
          is_super_admin?: boolean
          label?: string | null
          last_seen?: string | null
          phone?: string | null
          route_permissions?: Json
          unit_office?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      accessories_cloud: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          access_id: string | null
          action: string
          actor_label: string | null
          created_at: string
          description: string | null
          entity: string
          entity_id: string | null
          id: string
          route: string | null
          seen: boolean
          user_id: string
        }
        Insert: {
          access_id?: string | null
          action: string
          actor_label?: string | null
          created_at?: string
          description?: string | null
          entity: string
          entity_id?: string | null
          id?: string
          route?: string | null
          seen?: boolean
          user_id: string
        }
        Update: {
          access_id?: string | null
          action?: string
          actor_label?: string | null
          created_at?: string
          description?: string | null
          entity?: string
          entity_id?: string | null
          id?: string
          route?: string | null
          seen?: boolean
          user_id?: string
        }
        Relationships: []
      }
      app_data: {
        Row: {
          collection: string
          data: Json
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          collection: string
          data: Json
          id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          collection?: string
          data?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      departments_cloud: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ip_addresses: {
        Row: {
          added_date: string | null
          created_at: string
          device_type: string | null
          id: string
          ip_address: string
          series: string | null
          status: string
          unit_office: string | null
          updated_at: string
          used_by: string | null
          user_department: string | null
        }
        Insert: {
          added_date?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          ip_address: string
          series?: string | null
          status?: string
          unit_office?: string | null
          updated_at?: string
          used_by?: string | null
          user_department?: string | null
        }
        Update: {
          added_date?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          ip_address?: string
          series?: string | null
          status?: string
          unit_office?: string | null
          updated_at?: string
          used_by?: string | null
          user_department?: string | null
        }
        Relationships: []
      }
      it_assets_cloud: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      printers: {
        Row: {
          added_date: string | null
          created_at: string
          department_name: string | null
          drive_link: string | null
          id: string
          ip_address: string | null
          printer_model: string | null
          printer_name: string
          unit_number: string | null
          updated_at: string
        }
        Insert: {
          added_date?: string | null
          created_at?: string
          department_name?: string | null
          drive_link?: string | null
          id?: string
          ip_address?: string | null
          printer_model?: string | null
          printer_name: string
          unit_number?: string | null
          updated_at?: string
        }
        Update: {
          added_date?: string | null
          created_at?: string
          department_name?: string | null
          drive_link?: string | null
          id?: string
          ip_address?: string | null
          printer_model?: string | null
          printer_name?: string
          unit_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products_cloud: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recycle_bin: {
        Row: {
          collection: string | null
          created_at: string
          deleted_by: string
          deleted_by_access_id: string | null
          deleted_by_label: string | null
          entity: string
          entity_id: string | null
          entity_label: string | null
          id: string
          payload: Json
          route: string | null
        }
        Insert: {
          collection?: string | null
          created_at?: string
          deleted_by: string
          deleted_by_access_id?: string | null
          deleted_by_label?: string | null
          entity: string
          entity_id?: string | null
          entity_label?: string | null
          id?: string
          payload: Json
          route?: string | null
        }
        Update: {
          collection?: string | null
          created_at?: string
          deleted_by?: string
          deleted_by_access_id?: string | null
          deleted_by_label?: string | null
          entity?: string
          entity_id?: string | null
          entity_label?: string | null
          id?: string
          payload?: Json
          route?: string | null
        }
        Relationships: []
      }
      sticker_buyers: {
        Row: {
          buyer_name: string
          created_at: string
          gpq_email: string | null
          gpq_name: string | null
          gpq_phone: string | null
          id: string
          logo: string | null
          merchandiser_email: string | null
          merchandiser_name: string | null
          merchandiser_phone: string | null
          status: string
          store_officer_email: string | null
          store_officer_name: string | null
          store_officer_phone: string | null
          updated_at: string
        }
        Insert: {
          buyer_name: string
          created_at?: string
          gpq_email?: string | null
          gpq_name?: string | null
          gpq_phone?: string | null
          id?: string
          logo?: string | null
          merchandiser_email?: string | null
          merchandiser_name?: string | null
          merchandiser_phone?: string | null
          status?: string
          store_officer_email?: string | null
          store_officer_name?: string | null
          store_officer_phone?: string | null
          updated_at?: string
        }
        Update: {
          buyer_name?: string
          created_at?: string
          gpq_email?: string | null
          gpq_name?: string | null
          gpq_phone?: string | null
          id?: string
          logo?: string | null
          merchandiser_email?: string | null
          merchandiser_name?: string | null
          merchandiser_phone?: string | null
          status?: string
          store_officer_email?: string | null
          store_officer_name?: string | null
          store_officer_phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sticker_transactions: {
        Row: {
          buyer_id: string
          color: string | null
          created_at: string
          date: string
          delivered_by: string | null
          designation: string | null
          id: string
          length_per_roll: number | null
          note: string | null
          pcs: number
          pcs_per_roll: number | null
          phone: string | null
          po_no: string | null
          receive_date: string | null
          roll: number
          roll_no: string | null
          si_number: string | null
          sl_no: string | null
          source_receive_id: string | null
          sticker_size: string | null
          style: string | null
          sub_roll_index: number | null
          total_length: number | null
          type: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          color?: string | null
          created_at?: string
          date: string
          delivered_by?: string | null
          designation?: string | null
          id?: string
          length_per_roll?: number | null
          note?: string | null
          pcs?: number
          pcs_per_roll?: number | null
          phone?: string | null
          po_no?: string | null
          receive_date?: string | null
          roll?: number
          roll_no?: string | null
          si_number?: string | null
          sl_no?: string | null
          source_receive_id?: string | null
          sticker_size?: string | null
          style?: string | null
          sub_roll_index?: number | null
          total_length?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          color?: string | null
          created_at?: string
          date?: string
          delivered_by?: string | null
          designation?: string | null
          id?: string
          length_per_roll?: number | null
          note?: string | null
          pcs?: number
          pcs_per_roll?: number | null
          phone?: string | null
          po_no?: string | null
          receive_date?: string | null
          roll?: number
          roll_no?: string | null
          si_number?: string | null
          sl_no?: string | null
          source_receive_id?: string | null
          sticker_size?: string | null
          style?: string | null
          sub_roll_index?: number | null
          total_length?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      switch_gates_cloud: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      switch_locations_cloud: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      switch_ports_cloud: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      switches_cloud: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      units_cloud: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
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
      wifi_networks: {
        Row: {
          added_date: string | null
          created_at: string
          department_name: string | null
          id: string
          ip_address: string | null
          office_name: string | null
          updated_at: string
          wifi_name: string
          wifi_password: string | null
          wifi_qr_code: string | null
        }
        Insert: {
          added_date?: string | null
          created_at?: string
          department_name?: string | null
          id?: string
          ip_address?: string | null
          office_name?: string | null
          updated_at?: string
          wifi_name: string
          wifi_password?: string | null
          wifi_qr_code?: string | null
        }
        Update: {
          added_date?: string | null
          created_at?: string
          department_name?: string | null
          id?: string
          ip_address?: string | null
          office_name?: string | null
          updated_at?: string
          wifi_name?: string
          wifi_password?: string | null
          wifi_qr_code?: string | null
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
      has_route_permission: {
        Args: { _action: string; _route: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      touch_last_seen: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "viewer"
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
      app_role: ["admin", "viewer"],
    },
  },
} as const
