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
          image_url: string | null
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
          image_url?: string | null
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
          image_url?: string | null
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
          disponibilite_confirmee_le: string | null
          archive_le: string | null
          cree_le: string
          description: string
          disponible: boolean
          id: string
          mis_a_jour_le: string
          nom: string
          photo_url: string | null
          prix: number
          prix_promo: number | null
          illustration: Json | null
          restaurant_id: string
          section_id: string | null
        }
        Insert: {
          disponibilite_confirmee_le?: string | null
          archive_le?: string | null
          cree_le?: string
          description?: string
          disponible?: boolean
          id?: string
          mis_a_jour_le?: string
          nom: string
          photo_url?: string | null
          prix: number
          prix_promo?: number | null
          illustration?: Json | null
          restaurant_id: string
          section_id?: string | null
        }
        Update: {
          disponibilite_confirmee_le?: string | null
          archive_le?: string | null
          cree_le?: string
          description?: string
          disponible?: boolean
          id?: string
          mis_a_jour_le?: string
          nom?: string
          photo_url?: string | null
          prix?: number
          prix_promo?: number | null
          illustration?: Json | null
          restaurant_id?: string
          section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "menu_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_sections: {
        Row: {
          cree_le: string
          id: string
          nom: string
          position: number
          restaurant_id: string
        }
        Insert: {
          cree_le?: string
          id?: string
          nom: string
          position?: number
          restaurant_id: string
        }
        Update: {
          cree_le?: string
          id?: string
          nom?: string
          position?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_sections_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_options: {
        Row: {
          cree_le: string
          disponible: boolean
          id: string
          menu_item_id: string
          nom: string
          prix: number
        }
        Insert: {
          cree_le?: string
          disponible?: boolean
          id?: string
          menu_item_id: string
          nom: string
          prix?: number
        }
        Update: {
          cree_le?: string
          disponible?: boolean
          id?: string
          menu_item_id?: string
          nom?: string
          prix?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_options_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
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
      order_item_options: {
        Row: {
          id: string
          nom: string
          option_id: string | null
          order_item_id: string
          prix: number
        }
        Insert: {
          id?: string
          nom: string
          option_id?: string | null
          order_item_id: string
          prix: number
        }
        Update: {
          id?: string
          nom?: string
          option_id?: string | null
          order_item_id?: string
          prix?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "menu_item_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_options_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
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
          anonymise_le: string | null
          client_adresse: string | null
          client_nom: string
          client_telephone: string
          cree_le: string
          frais_livraison_estime: number
          id: string
          jeton_suivi: string
          mis_a_jour_le: string
          mode: string
          paiement_declare_le: string | null
          paiement_mode: string | null
          paiement_recu_le: string | null
          paiement_reference: string | null
          paiement_statut: string
          reference: string
          restaurant_id: string
          sous_total: number
          statut: string
        }
        Insert: {
          anonymise_le?: string | null
          client_adresse?: string | null
          client_nom: string
          client_telephone: string
          cree_le?: string
          frais_livraison_estime?: number
          id?: string
          jeton_suivi: string
          mis_a_jour_le?: string
          mode: string
          paiement_declare_le?: string | null
          paiement_mode?: string | null
          paiement_recu_le?: string | null
          paiement_reference?: string | null
          paiement_statut?: string
          reference: string
          restaurant_id: string
          sous_total: number
          statut?: string
        }
        Update: {
          anonymise_le?: string | null
          client_adresse?: string | null
          client_nom?: string
          client_telephone?: string
          cree_le?: string
          frais_livraison_estime?: number
          id?: string
          jeton_suivi?: string
          mis_a_jour_le?: string
          mode?: string
          paiement_declare_le?: string | null
          paiement_mode?: string | null
          paiement_recu_le?: string | null
          paiement_reference?: string | null
          paiement_statut?: string
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
      parametres_application: {
        Row: {
          conservation_audit_mois: number
          conservation_coordonnees_jours: number
          conservation_non_cloturee_jours: number
          disponibilite_fraicheur_heures: number
          commande_proposition_delai_minutes: number
          connexion_facebook_active: boolean
          id: boolean
          mis_a_jour_le: string
          mis_a_jour_par: string | null
          prix_plat_max_gnf: number
          promesse_signature: string | null
          promesse_sous_titre: string | null
          promesse_partage: string | null
          whatsapp_assistance: string | null
          delai_validation_heures: number | null
          position_carte_active: boolean
        }
        Insert: {
          conservation_audit_mois?: number
          conservation_coordonnees_jours?: number
          conservation_non_cloturee_jours?: number
          disponibilite_fraicheur_heures?: number
          commande_proposition_delai_minutes?: number
          connexion_facebook_active?: boolean
          id?: boolean
          mis_a_jour_le?: string
          mis_a_jour_par?: string | null
          prix_plat_max_gnf?: number
          promesse_signature?: string | null
          promesse_sous_titre?: string | null
          promesse_partage?: string | null
          whatsapp_assistance?: string | null
          delai_validation_heures?: number | null
          position_carte_active?: boolean
        }
        Update: {
          conservation_audit_mois?: number
          conservation_coordonnees_jours?: number
          conservation_non_cloturee_jours?: number
          disponibilite_fraicheur_heures?: number
          commande_proposition_delai_minutes?: number
          connexion_facebook_active?: boolean
          id?: boolean
          mis_a_jour_le?: string
          mis_a_jour_par?: string | null
          prix_plat_max_gnf?: number
          promesse_signature?: string | null
          promesse_sous_titre?: string | null
          promesse_partage?: string | null
          whatsapp_assistance?: string | null
          delai_validation_heures?: number | null
          position_carte_active?: boolean
        }
        Relationships: []
      }
      client_profils: {
        Row: {
          adresse: string | null
          avatar: string
          cree_le: string
          coordonnees_enregistrees_le: string | null
          mis_a_jour_le: string
          nom_commande: string | null
          pseudo: string
          telephone: string | null
          utilisateur_id: string
        }
        Insert: {
          adresse?: string | null
          avatar: string
          cree_le?: string
          coordonnees_enregistrees_le?: string | null
          mis_a_jour_le?: string
          nom_commande?: string | null
          pseudo: string
          telephone?: string | null
          utilisateur_id: string
        }
        Update: {
          adresse?: string | null
          avatar?: string
          cree_le?: string
          coordonnees_enregistrees_le?: string | null
          mis_a_jour_le?: string
          nom_commande?: string | null
          pseudo?: string
          telephone?: string | null
          utilisateur_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          agent: string | null
          auth: string
          cree_le: string
          derniere_reussite_le: string | null
          echecs: number
          endpoint: string
          id: string
          p256dh: string
          restaurant_id: string
          utilisateur_id: string
        }
        Insert: {
          agent?: string | null
          auth: string
          cree_le?: string
          derniere_reussite_le?: string | null
          echecs?: number
          endpoint: string
          id?: string
          p256dh: string
          restaurant_id: string
          utilisateur_id: string
        }
        Update: {
          agent?: string | null
          auth?: string
          cree_le?: string
          derniere_reussite_le?: string | null
          echecs?: number
          endpoint?: string
          id?: string
          p256dh?: string
          restaurant_id?: string
          utilisateur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          cle: string
          compteur: number
          fenetre: string
        }
        Insert: {
          cle: string
          compteur?: number
          fenetre: string
        }
        Update: {
          cle?: string
          compteur?: number
          fenetre?: string
        }
        Relationships: []
      }
      restaurant_codes_marchand: {
        Row: {
          mis_a_jour_le: string
          mtn: string | null
          orange: string | null
          restaurant_id: string
        }
        Insert: {
          mis_a_jour_le?: string
          mtn?: string | null
          orange?: string | null
          restaurant_id: string
        }
        Update: {
          mis_a_jour_le?: string
          mtn?: string | null
          orange?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_codes_marchand_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
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
          accepte_commandes: boolean
          statut_mis_a_jour_le: string
          categorie_id: string
          consignes: string | null
          couleur_accent: string | null
          cree_le: string
          donnees_demo: boolean
          horaires: string
          id: string
          latitude: number | null
          logo_url: string | null
          logo_illustration: Json | null
          couverture_illustration: Json | null
          longitude: number | null
          moyens_paiement: string[]
          mis_a_jour_le: string
          motif_correction: string | null
          nom: string
          ouvert: boolean
          photo_url: string | null
          publie: boolean
          quartier_id: string
          suspendu_le: string | null
          suspendu_motif: string | null
        }
        Insert: {
          accepte_commandes?: boolean
          statut_mis_a_jour_le?: string
          categorie_id: string
          consignes?: string | null
          couleur_accent?: string | null
          cree_le?: string
          donnees_demo?: boolean
          horaires?: string
          id?: string
          latitude?: number | null
          logo_url?: string | null
          logo_illustration?: Json | null
          couverture_illustration?: Json | null
          longitude?: number | null
          moyens_paiement?: string[]
          mis_a_jour_le?: string
          motif_correction?: string | null
          nom: string
          ouvert?: boolean
          photo_url?: string | null
          publie?: boolean
          quartier_id: string
          suspendu_le?: string | null
          suspendu_motif?: string | null
        }
        Update: {
          accepte_commandes?: boolean
          statut_mis_a_jour_le?: string
          categorie_id?: string
          consignes?: string | null
          couleur_accent?: string | null
          cree_le?: string
          donnees_demo?: boolean
          horaires?: string
          id?: string
          latitude?: number | null
          logo_url?: string | null
          logo_illustration?: Json | null
          couverture_illustration?: Json | null
          longitude?: number | null
          moyens_paiement?: string[]
          mis_a_jour_le?: string
          motif_correction?: string | null
          nom?: string
          ouvert?: boolean
          photo_url?: string | null
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
      fn_preparer_suppression_compte: {
        Args: { p_motif: string; p_supprimer_restaurants: boolean; p_utilisateur: string }
        Returns: Json
      }
      fn_repondre_proposition: {
        Args: { p_jeton: string; p_proposition_id: string; p_reponse: string }
        Returns: string
      }
      fn_support_changer_statut: {
        Args: { p_motif: string; p_order_id: string; p_vers: string }
        Returns: undefined
      }
      fn_reinitialisation_simuler: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      fn_reinitialiser_application: {
        Args: { p_jeton: string; p_motif: string }
        Returns: Json
      }
      fn_admin_lister_plats: {
        Args: { p_restaurant: string }
        Returns: { id: string; nom: string; prix: number; photo_url: string | null; illustration: Json | null }[]
      }
      fn_admin_definir_illustration: {
        Args: { p_cible: string; p_id: string; p_valeur: Json | null }
        Returns: undefined
      }
      fn_admin_dossier_restaurant: {
        Args: { p_restaurant: string }
        Returns: Json
      }
      fn_statistiques_application: {
        Args: { p_jours: number }
        Returns: Json
      }
      fn_support_serie_commandes: {
        Args: { p_jours: number }
        Returns: { jour: string; statut: string; nb: number; montant: number }[]
      }
      fn_support_commandes_par_heure: {
        Args: { p_jours: number }
        Returns: { heure: number; nb: number }[]
      }
      fn_support_compter_commandes: {
        Args: { p_depuis?: string; p_statuts?: string[] }
        Returns: number
      }
      fn_support_lister_commandes: {
        Args: { p_id?: string; p_jour?: boolean; p_reference?: string; p_restaurant?: string; p_statut?: string }
        Returns: {
          adresse_masquee: string
          client_nom: string
          cree_le: string
          frais_livraison_estime: number
          id: string
          mode: string
          reference: string
          restaurant_id: string
          restaurant_nom: string
          sous_total: number
          statut: string
          telephone_masque: string
        }[]
      }
      fn_support_reveler_coordonnees: {
        Args: { p_motif: string; p_order_id: string }
        Returns: { client_adresse: string; client_telephone: string }[]
      }
      fn_limiter_debit: {
        Args: { p_cle: string; p_fenetre_secondes: number; p_max: number }
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
