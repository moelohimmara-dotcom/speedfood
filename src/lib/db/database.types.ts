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
      audit_events: {
        Row: {
          acteur_id: string | null
          action: string
          cible_id: string
          cible_type: string
          horodatage: string
          id: string
          motif: string | null
        }
        Insert: {
          acteur_id?: string | null
          action: string
          cible_id: string
          cible_type: string
          horodatage?: string
          id?: string
          motif?: string | null
        }
        Update: {
          acteur_id?: string | null
          action?: string
          cible_id?: string
          cible_type?: string
          horodatage?: string
          id?: string
          motif?: string | null
        }
        Relationships: []
      }
      content_banners: {
        Row: {
          auteur_id: string | null
          cree_le: string
          id: string
          lien: string | null
          mis_a_jour_le: string
          ordre: number
          statut: string
          texte: string
          titre: string
        }
        Insert: {
          auteur_id?: string | null
          cree_le?: string
          id?: string
          lien?: string | null
          mis_a_jour_le?: string
          ordre?: number
          statut?: string
          texte?: string
          titre: string
        }
        Update: {
          auteur_id?: string | null
          cree_le?: string
          id?: string
          lien?: string | null
          mis_a_jour_le?: string
          ordre?: number
          statut?: string
          texte?: string
          titre?: string
        }
        Relationships: []
      }
      content_pages: {
        Row: {
          auteur_id: string | null
          contenu: string
          cree_le: string
          id: string
          mis_a_jour_le: string
          publie_le: string | null
          slug: string
          statut: string
          titre: string
        }
        Insert: {
          auteur_id?: string | null
          contenu?: string
          cree_le?: string
          id?: string
          mis_a_jour_le?: string
          publie_le?: string | null
          slug: string
          statut?: string
          titre: string
        }
        Update: {
          auteur_id?: string | null
          contenu?: string
          cree_le?: string
          id?: string
          mis_a_jour_le?: string
          publie_le?: string | null
          slug?: string
          statut?: string
          titre?: string
        }
        Relationships: []
      }
      featured_placements: {
        Row: {
          actif: boolean
          cree_le: string
          debut_le: string | null
          fin_le: string | null
          id: string
          position: number
          restaurant_id: string
        }
        Insert: {
          actif?: boolean
          cree_le?: string
          debut_le?: string | null
          fin_le?: string | null
          id?: string
          position?: number
          restaurant_id: string
        }
        Update: {
          actif?: boolean
          cree_le?: string
          debut_le?: string | null
          fin_le?: string | null
          id?: string
          position?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_placements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          id: string
          nom: string
          ordre: number
        }
        Insert: {
          id?: string
          nom: string
          ordre?: number
        }
        Update: {
          id?: string
          nom?: string
          ordre?: number
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          archive_le: string | null
          cree_le: string
          description: string
          disponible: boolean
          id: string
          mis_a_jour_le: string
          nom: string
          prix: number
          restaurant_id: string
        }
        Insert: {
          archive_le?: string | null
          cree_le?: string
          description?: string
          disponible?: boolean
          id?: string
          mis_a_jour_le?: string
          nom: string
          prix: number
          restaurant_id: string
        }
        Update: {
          archive_le?: string | null
          cree_le?: string
          description?: string
          disponible?: boolean
          id?: string
          mis_a_jour_le?: string
          nom?: string
          prix?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          id: string
          nom: string
          ordre: number
        }
        Insert: {
          id?: string
          nom: string
          ordre?: number
        }
        Update: {
          id?: string
          nom?: string
          ordre?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          menu_item_id: string | null
          nom: string
          order_id: string
          prix: number
          quantite: number
        }
        Insert: {
          id?: string
          menu_item_id?: string | null
          nom: string
          order_id: string
          prix: number
          quantite: number
        }
        Update: {
          id?: string
          menu_item_id?: string | null
          nom?: string
          order_id?: string
          prix?: number
          quantite?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_proposals: {
        Row: {
          conditions_modifiees: string | null
          cree_le: string
          expire_le: string | null
          id: string
          nouveau_sous_total: number
          nouveaux_frais_livraison: number
          order_id: string
          repondu_le: string | null
          statut: string
          version: number
        }
        Insert: {
          conditions_modifiees?: string | null
          cree_le?: string
          expire_le?: string | null
          id?: string
          nouveau_sous_total: number
          nouveaux_frais_livraison?: number
          order_id: string
          repondu_le?: string | null
          statut?: string
          version: number
        }
        Update: {
          conditions_modifiees?: string | null
          cree_le?: string
          expire_le?: string | null
          id?: string
          nouveau_sous_total?: number
          nouveaux_frais_livraison?: number
          order_id?: string
          repondu_le?: string | null
          statut?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_proposals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_events: {
        Row: {
          acteur: string
          horodatage: string
          id: string
          order_id: string
          statut_precedent: string | null
          statut_suivant: string
        }
        Insert: {
          acteur: string
          horodatage?: string
          id?: string
          order_id: string
          statut_precedent?: string | null
          statut_suivant: string
        }
        Update: {
          acteur?: string
          horodatage?: string
          id?: string
          order_id?: string
          statut_precedent?: string | null
          statut_suivant?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_adresse: string | null
          client_nom: string
          client_telephone: string
          cree_le: string
          frais_livraison_estime: number
          id: string
          jeton_suivi: string
          mis_a_jour_le: string
          mode: string
          reference: string
          restaurant_id: string
          sous_total: number
          statut: string
        }
        Insert: {
          client_adresse?: string | null
          client_nom: string
          client_telephone: string
          cree_le?: string
          frais_livraison_estime?: number
          id?: string
          jeton_suivi: string
          mis_a_jour_le?: string
          mode: string
          reference: string
          restaurant_id: string
          sous_total: number
          statut?: string
        }
        Update: {
          client_adresse?: string | null
          client_nom?: string
          client_telephone?: string
          cree_le?: string
          frais_livraison_estime?: number
          id?: string
          jeton_suivi?: string
          mis_a_jour_le?: string
          mode?: string
          reference?: string
          restaurant_id?: string
          sous_total?: number
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_memberships: {
        Row: {
          cree_le: string
          restaurant_id: string
          role: string
          utilisateur_id: string
        }
        Insert: {
          cree_le?: string
          restaurant_id: string
          role: string
          utilisateur_id: string
        }
        Update: {
          cree_le?: string
          restaurant_id?: string
          role?: string
          utilisateur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_memberships_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          categorie_id: string
          consignes: string | null
          cree_le: string
          horaires: string
          id: string
          mis_a_jour_le: string
          motif_correction: string | null
          nom: string
          ouvert: boolean
          publie: boolean
          quartier_id: string
          suspendu_le: string | null
          suspendu_motif: string | null
        }
        Insert: {
          categorie_id: string
          consignes?: string | null
          cree_le?: string
          horaires?: string
          id?: string
          mis_a_jour_le?: string
          motif_correction?: string | null
          nom: string
          ouvert?: boolean
          publie?: boolean
          quartier_id: string
          suspendu_le?: string | null
          suspendu_motif?: string | null
        }
        Update: {
          categorie_id?: string
          consignes?: string | null
          cree_le?: string
          horaires?: string
          id?: string
          mis_a_jour_le?: string
          motif_correction?: string | null
          nom?: string
          ouvert?: boolean
          publie?: boolean
          quartier_id?: string
          suspendu_le?: string | null
          suspendu_motif?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurants_quartier_id_fkey"
            columns: ["quartier_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
        ]
      }
      system_admin_memberships: {
        Row: {
          cree_le: string
          role: string
          utilisateur_id: string
        }
        Insert: {
          cree_le?: string
          role: string
          utilisateur_id: string
        }
        Update: {
          cree_le?: string
          role?: string
          utilisateur_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_creer_restaurant_et_owner: {
        Args: { p_categorie_id: string; p_nom: string; p_quartier_id: string }
        Returns: string
      }
      fn_est_admin_systeme: { Args: { p_roles?: string[] }; Returns: boolean }
      fn_est_membre_restaurant: {
        Args: { p_restaurant_id: string }
        Returns: boolean
      }
      fn_lister_audit: {
        Args: { p_action?: string; p_depuis?: string; p_limite?: number }
        Returns: {
          acteur_email: string
          action: string
          cible_id: string
          cible_type: string
          horodatage: string
          id: string
          motif: string
        }[]
      }
      fn_lister_membres_restaurant: {
        Args: { p_restaurant_id: string }
        Returns: {
          cree_le: string
          email: string
          role: string
          utilisateur_id: string
        }[]
      }
      fn_trouver_utilisateur_par_email: {
        Args: { p_email: string }
        Returns: {
          email: string
          id: string
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
