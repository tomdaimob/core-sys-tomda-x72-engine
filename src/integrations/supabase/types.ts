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
      approval_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          message_type: string | null
          orcamento_id: string
          request_id: string | null
          sender_role: string
          sender_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          message_type?: string | null
          orcamento_id: string
          request_id?: string | null
          sender_role: string
          sender_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          message_type?: string | null
          orcamento_id?: string
          request_id?: string | null
          sender_role?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_messages_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          orcamento_id: string
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          orcamento_id: string
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          orcamento_id?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: true
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      arquivos: {
        Row: {
          ativo: boolean
          created_at: string
          group_id: string | null
          id: string
          mime_type: string | null
          nome: string
          orcamento_id: string
          storage_path: string
          tamanho_bytes: number | null
          tipo: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          group_id?: string | null
          id?: string
          mime_type?: string | null
          nome: string
          orcamento_id: string
          storage_path: string
          tamanho_bytes?: number | null
          tipo: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          group_id?: string | null
          id?: string
          mime_type?: string | null
          nome?: string
          orcamento_id?: string
          storage_path?: string
          tamanho_bytes?: number | null
          tipo?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "arquivos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      baldrame_configuracoes: {
        Row: {
          altura_cm: number
          ativo: boolean
          coef_aco_kg_por_m: number
          coef_aco_max: number
          coef_aco_min: number
          id: string
          largura_cm: number
          perda_aco_percent: number
          perda_concreto_percent: number
          perfil_nome: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          altura_cm?: number
          ativo?: boolean
          coef_aco_kg_por_m?: number
          coef_aco_max?: number
          coef_aco_min?: number
          id?: string
          largura_cm?: number
          perda_aco_percent?: number
          perda_concreto_percent?: number
          perfil_nome: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          altura_cm?: number
          ativo?: boolean
          coef_aco_kg_por_m?: number
          coef_aco_max?: number
          coef_aco_min?: number
          id?: string
          largura_cm?: number
          perda_aco_percent?: number
          perda_concreto_percent?: number
          perfil_nome?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      configuracoes_globais: {
        Row: {
          chave: string
          id: string
          updated_at: string
          updated_by: string | null
          valor: Json
        }
        Insert: {
          chave: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          valor?: Json
        }
        Update: {
          chave?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          valor?: Json
        }
        Relationships: []
      }
      ia_extracoes: {
        Row: {
          aberturas_m2: number | null
          area_total_m2: number | null
          arquivo_id: string
          confianca: number | null
          created_at: string
          dados_brutos: Json | null
          id: string
          observacoes: string | null
          orcamento_id: string
          paredes_internas_m: number | null
          pavimento_id: string | null
          payload_json: Json | null
          pe_direito_m: number | null
          perimetro_externo_m: number | null
          status: string | null
          tipo: string | null
        }
        Insert: {
          aberturas_m2?: number | null
          area_total_m2?: number | null
          arquivo_id: string
          confianca?: number | null
          created_at?: string
          dados_brutos?: Json | null
          id?: string
          observacoes?: string | null
          orcamento_id: string
          paredes_internas_m?: number | null
          pavimento_id?: string | null
          payload_json?: Json | null
          pe_direito_m?: number | null
          perimetro_externo_m?: number | null
          status?: string | null
          tipo?: string | null
        }
        Update: {
          aberturas_m2?: number | null
          area_total_m2?: number | null
          arquivo_id?: string
          confianca?: number | null
          created_at?: string
          dados_brutos?: Json | null
          id?: string
          observacoes?: string | null
          orcamento_id?: string
          paredes_internas_m?: number | null
          pavimento_id?: string | null
          payload_json?: Json | null
          pe_direito_m?: number | null
          perimetro_externo_m?: number | null
          status?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_extracoes_arquivo_id_fkey"
            columns: ["arquivo_id"]
            isOneToOne: false
            referencedRelation: "arquivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_extracoes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_extracoes_pavimento_id_fkey"
            columns: ["pavimento_id"]
            isOneToOne: false
            referencedRelation: "orcamento_pavimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      indicadores_custo: {
        Row: {
          cub_padrao: string | null
          cub_ref_mes_ano: string | null
          cub_valor_m2: number | null
          id: string
          uf: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cub_padrao?: string | null
          cub_ref_mes_ano?: string | null
          cub_valor_m2?: number | null
          id?: string
          uf?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cub_padrao?: string | null
          cub_ref_mes_ano?: string | null
          cub_valor_m2?: number | null
          id?: string
          uf?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      orcamento_inputs: {
        Row: {
          created_at: string
          dados: Json
          etapa: string
          id: string
          orcamento_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dados?: Json
          etapa: string
          id?: string
          orcamento_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dados?: Json
          etapa?: string
          id?: string
          orcamento_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_inputs_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_pavimentos: {
        Row: {
          created_at: string
          id: string
          imagens_group_id: string | null
          includes_fundacao: boolean
          includes_laje: boolean
          includes_portas: boolean
          includes_portoes: boolean
          includes_reboco: boolean
          includes_revestimento: boolean
          last_extracao_id: string | null
          medidas_confirmadas: Json | null
          medidas_extraidas: Json | null
          medidas_json: Json | null
          multiplicador: number
          nome: string
          orcamento_id: string
          ordem: number
          overrides_json: Json | null
          pdf_arquivo_id: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          imagens_group_id?: string | null
          includes_fundacao?: boolean
          includes_laje?: boolean
          includes_portas?: boolean
          includes_portoes?: boolean
          includes_reboco?: boolean
          includes_revestimento?: boolean
          last_extracao_id?: string | null
          medidas_confirmadas?: Json | null
          medidas_extraidas?: Json | null
          medidas_json?: Json | null
          multiplicador?: number
          nome: string
          orcamento_id: string
          ordem?: number
          overrides_json?: Json | null
          pdf_arquivo_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          imagens_group_id?: string | null
          includes_fundacao?: boolean
          includes_laje?: boolean
          includes_portas?: boolean
          includes_portoes?: boolean
          includes_reboco?: boolean
          includes_revestimento?: boolean
          last_extracao_id?: string | null
          medidas_confirmadas?: Json | null
          medidas_extraidas?: Json | null
          medidas_json?: Json | null
          multiplicador?: number
          nome?: string
          orcamento_id?: string
          ordem?: number
          overrides_json?: Json | null
          pdf_arquivo_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_pavimentos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_pavimentos_pdf_arquivo_id_fkey"
            columns: ["pdf_arquivo_id"]
            isOneToOne: false
            referencedRelation: "arquivos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_resultados: {
        Row: {
          acabamentos: Json | null
          consolidado: Json | null
          created_at: string
          fundacao_total: number | null
          id: string
          laje: Json | null
          laje_total_area_m2: number | null
          laje_total_volume_m3: number | null
          orcamento_id: string
          paredes: Json | null
          paredes_total_area_m2: number | null
          radier: Json | null
          reboco: Json | null
          reboco_total_area_externo_m2: number | null
          reboco_total_area_interno_m2: number | null
          resultados_pavimentos_json: Json | null
          revestimento: Json | null
          revestimento_total_area_m2: number | null
          total_geral_predio: number | null
          updated_at: string
        }
        Insert: {
          acabamentos?: Json | null
          consolidado?: Json | null
          created_at?: string
          fundacao_total?: number | null
          id?: string
          laje?: Json | null
          laje_total_area_m2?: number | null
          laje_total_volume_m3?: number | null
          orcamento_id: string
          paredes?: Json | null
          paredes_total_area_m2?: number | null
          radier?: Json | null
          reboco?: Json | null
          reboco_total_area_externo_m2?: number | null
          reboco_total_area_interno_m2?: number | null
          resultados_pavimentos_json?: Json | null
          revestimento?: Json | null
          revestimento_total_area_m2?: number | null
          total_geral_predio?: number | null
          updated_at?: string
        }
        Update: {
          acabamentos?: Json | null
          consolidado?: Json | null
          created_at?: string
          fundacao_total?: number | null
          id?: string
          laje?: Json | null
          laje_total_area_m2?: number | null
          laje_total_volume_m3?: number | null
          orcamento_id?: string
          paredes?: Json | null
          paredes_total_area_m2?: number | null
          radier?: Json | null
          reboco?: Json | null
          reboco_total_area_externo_m2?: number | null
          reboco_total_area_interno_m2?: number | null
          resultados_pavimentos_json?: Json | null
          revestimento?: Json | null
          revestimento_total_area_m2?: number | null
          total_geral_predio?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_resultados_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: true
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          approval_status: string | null
          area_total_m2: number | null
          bdi_percent: number | null
          cliente: string
          cliente_documento: string | null
          cliente_responsavel: string | null
          cliente_tipo: string | null
          codigo: string
          created_at: string
          desconto_percent: number | null
          discount_decided_at: string | null
          discount_decided_by: string | null
          discount_requested_at: string | null
          discount_requested_by: string | null
          discount_status: string | null
          id: string
          lucro_percent: number | null
          margin_percent: number | null
          needs_approval: boolean | null
          projeto: string | null
          status: string | null
          updated_at: string
          user_id: string
          valor_total: number | null
        }
        Insert: {
          approval_status?: string | null
          area_total_m2?: number | null
          bdi_percent?: number | null
          cliente: string
          cliente_documento?: string | null
          cliente_responsavel?: string | null
          cliente_tipo?: string | null
          codigo: string
          created_at?: string
          desconto_percent?: number | null
          discount_decided_at?: string | null
          discount_decided_by?: string | null
          discount_requested_at?: string | null
          discount_requested_by?: string | null
          discount_status?: string | null
          id?: string
          lucro_percent?: number | null
          margin_percent?: number | null
          needs_approval?: boolean | null
          projeto?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          valor_total?: number | null
        }
        Update: {
          approval_status?: string | null
          area_total_m2?: number | null
          bdi_percent?: number | null
          cliente?: string
          cliente_documento?: string | null
          cliente_responsavel?: string | null
          cliente_tipo?: string | null
          codigo?: string
          created_at?: string
          desconto_percent?: number | null
          discount_decided_at?: string | null
          discount_decided_by?: string | null
          discount_requested_at?: string | null
          discount_requested_by?: string | null
          discount_status?: string | null
          id?: string
          lucro_percent?: number | null
          margin_percent?: number | null
          needs_approval?: boolean | null
          projeto?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          valor_total?: number | null
        }
        Relationships: []
      }
      price_catalog: {
        Row: {
          ativo: boolean
          categoria: string
          id: string
          nome: string
          preco: number
          unidade: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          categoria: string
          id?: string
          nome: string
          preco?: number
          unidade: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          id?: string
          nome?: string
          preco?: number
          unidade?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string
          full_name: string | null
          id: string
          is_admin: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sapata_configuracoes: {
        Row: {
          ativo: boolean
          coef_aco_kg_por_m3: number
          coef_aco_max: number
          coef_aco_min: number
          id: string
          perda_aco_percent: number
          perda_concreto_percent: number
          perfil_nome: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          coef_aco_kg_por_m3?: number
          coef_aco_max?: number
          coef_aco_min?: number
          id?: string
          perda_aco_percent?: number
          perda_concreto_percent?: number
          perfil_nome: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          coef_aco_kg_por_m3?: number
          coef_aco_max?: number
          coef_aco_min?: number
          id?: string
          perda_aco_percent?: number
          perda_concreto_percent?: number
          perfil_nome?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { _user_id: string }; Returns: boolean }
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
