// Généré automatiquement depuis le schéma Supabase (generate_typescript_types).
// Ne pas éditer à la main : régénérer après toute migration qui change le schéma
// (nouvelle table, colonne, fonction) pour que ce fichier reste synchronisé.
// Dernière génération : 27 septembre 2026, après le bloc 4.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      audit_events: {
        Row: {
          acteur_id: string | null;
          action: string;
          cible_id: string;
          cible_type: string;
          horodatage: string;
          id: string;
          motif: string | null;
        };
        Insert: {
          acteur_id?: string | null;
          action: string;
          cible_id: string;
          cible_type: string;
          horodatage?: string;
          id?: string;
          motif?: string | null;
        };
        Update: {
          acteur_id?: string | null;
          action?: string;
          cible_id?: string;
          cible_type?: string;
          horodatage?: string;
          id?: string;
          motif?: string | null;
        };
        Relationships: [];
      };
      content_banners: {
        Row: {
          cree_le: string;
          id: string;
          lien: string | null;
          ordre: number;
          statut: string;
          texte: string;
          titre: string;
        };
        Insert: {
          cree_le?: string;
          id?: string;
          lien?: string | null;
          ordre?: number;
          statut?: string;
          texte?: string;
          titre: string;
        };
        Update: {
          cree_le?: string;
          id?: string;
          lien?: string | null;
          ordre?: number;
          statut?: string;
          texte?: string;
          titre?: string;
        };
        Relationships: [];
      };
      content_pages: {
        Row: {
          auteur_id: string | null;
          contenu: string;
          cree_le: string;
          id: string;
          mis_a_jour_le: string;
          publie_le: string | null;
          slug: string;
          statut: string;
          titre: string;
        };
        Insert: {
          auteur_id?: string | null;
          contenu?: string;
          cree_le?: string;
          id?: string;
          mis_a_jour_le?: string;
          publie_le?: string | null;
          slug: string;
          statut?: string;
          titre: string;
        };
        Update: {
          auteur_id?: string | null;
          contenu?: string;
          cree_le?: string;
          id?: string;
          mis_a_jour_le?: string;
          publie_le?: string | null;
          slug?: string;
          statut?: string;
          titre?: string;
        };
        Relationships: [];
      };
      featured_placements: {
        Row: {
          actif: boolean;
          cree_le: string;
          debut_le: string | null;
          fin_le: string | null;
          id: string;
          position: number;
          restaurant_id: string;
        };
        Insert: {
          actif?: boolean;
          cree_le?: string;
          debut_le?: string | null;
          fin_le?: string | null;
          id?: string;
          position?: number;
          restaurant_id: string;
        };
        Update: {
          actif?: boolean;
          cree_le?: string;
          debut_le?: string | null;
          fin_le?: string | null;
          id?: string;
          position?: number;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "featured_placements_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_categories: {
        Row: { id: string; nom: string; ordre: number };
        Insert: { id?: string; nom: string; ordre?: number };
        Update: { id?: string; nom?: string; ordre?: number };
        Relationships: [];
      };
      menu_items: {
        Row: {
          archive_le: string | null;
          cree_le: string;
          description: string;
          disponible: boolean;
          id: string;
          mis_a_jour_le: string;
          nom: string;
          prix: number;
          restaurant_id: string;
        };
        Insert: {
          archive_le?: string | null;
          cree_le?: string;
          description?: string;
          disponible?: boolean;
          id?: string;
          mis_a_jour_le?: string;
          nom: string;
          prix: number;
          restaurant_id: string;
        };
        Update: {
          archive_le?: string | null;
          cree_le?: string;
          description?: string;
          disponible?: boolean;
          id?: string;
          mis_a_jour_le?: string;
          nom?: string;
          prix?: number;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      neighborhoods: {
        Row: { id: string; nom: string; ordre: number };
        Insert: { id?: string; nom: string; ordre?: number };
        Update: { id?: string; nom?: string; ordre?: number };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          menu_item_id: string | null;
          nom: string;
          order_id: string;
          prix: number;
          quantite: number;
        };
        Insert: {
          id?: string;
          menu_item_id?: string | null;
          nom: string;
          order_id: string;
          prix: number;
          quantite: number;
        };
        Update: {
          id?: string;
          menu_item_id?: string | null;
          nom?: string;
          order_id?: string;
          prix?: number;
          quantite?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_proposals: {
        Row: {
          conditions_modifiees: string | null;
          cree_le: string;
          expire_le: string | null;
          id: string;
          nouveau_sous_total: number;
          nouveaux_frais_livraison: number;
          order_id: string;
          repondu_le: string | null;
          statut: string;
          version: number;
        };
        Insert: {
          conditions_modifiees?: string | null;
          cree_le?: string;
          expire_le?: string | null;
          id?: string;
          nouveau_sous_total: number;
          nouveaux_frais_livraison?: number;
          order_id: string;
          repondu_le?: string | null;
          statut?: string;
          version: number;
        };
        Update: {
          conditions_modifiees?: string | null;
          cree_le?: string;
          expire_le?: string | null;
          id?: string;
          nouveau_sous_total?: number;
          nouveaux_frais_livraison?: number;
          order_id?: string;
          repondu_le?: string | null;
          statut?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_proposals_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_status_events: {
        Row: {
          acteur: string;
          horodatage: string;
          id: string;
          order_id: string;
          statut_precedent: string | null;
          statut_suivant: string;
        };
        Insert: {
          acteur: string;
          horodatage?: string;
          id?: string;
          order_id: string;
          statut_precedent?: string | null;
          statut_suivant: string;
        };
        Update: {
          acteur?: string;
          horodatage?: string;
          id?: string;
          order_id?: string;
          statut_precedent?: string | null;
          statut_suivant?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_status_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          client_adresse: string | null;
          client_nom: string;
          client_telephone: string;
          cree_le: string;
          frais_livraison_estime: number;
          id: string;
          jeton_suivi: string;
          mis_a_jour_le: string;
          mode: string;
          reference: string;
          restaurant_id: string;
          sous_total: number;
          statut: string;
        };
        Insert: {
          client_adresse?: string | null;
          client_nom: string;
          client_telephone: string;
          cree_le?: string;
          frais_livraison_estime?: number;
          id?: string;
          jeton_suivi: string;
          mis_a_jour_le?: string;
          mode: string;
          reference: string;
          restaurant_id: string;
          sous_total: number;
          statut?: string;
        };
        Update: {
          client_adresse?: string | null;
          client_nom?: string;
          client_telephone?: string;
          cree_le?: string;
          frais_livraison_estime?: number;
          id?: string;
          jeton_suivi?: string;
          mis_a_jour_le?: string;
          mode?: string;
          reference?: string;
          restaurant_id?: string;
          sous_total?: number;
          statut?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurant_memberships: {
        Row: { cree_le: string; restaurant_id: string; role: string; utilisateur_id: string };
        Insert: { cree_le?: string; restaurant_id: string; role: string; utilisateur_id: string };
        Update: { cree_le?: string; restaurant_id?: string; role?: string; utilisateur_id?: string };
        Relationships: [
          {
            foreignKeyName: "restaurant_memberships_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurants: {
        Row: {
          categorie_id: string;
          consignes: string | null;
          cree_le: string;
          horaires: string;
          id: string;
          mis_a_jour_le: string;
          nom: string;
          ouvert: boolean;
          publie: boolean;
          quartier_id: string;
          suspendu_le: string | null;
          suspendu_motif: string | null;
        };
        Insert: {
          categorie_id: string;
          consignes?: string | null;
          cree_le?: string;
          horaires?: string;
          id?: string;
          mis_a_jour_le?: string;
          nom: string;
          ouvert?: boolean;
          publie?: boolean;
          quartier_id: string;
          suspendu_le?: string | null;
          suspendu_motif?: string | null;
        };
        Update: {
          categorie_id?: string;
          consignes?: string | null;
          cree_le?: string;
          horaires?: string;
          id?: string;
          mis_a_jour_le?: string;
          nom?: string;
          ouvert?: boolean;
          publie?: boolean;
          quartier_id?: string;
          suspendu_le?: string | null;
          suspendu_motif?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "restaurants_categorie_id_fkey";
            columns: ["categorie_id"];
            isOneToOne: false;
            referencedRelation: "menu_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurants_quartier_id_fkey";
            columns: ["quartier_id"];
            isOneToOne: false;
            referencedRelation: "neighborhoods";
            referencedColumns: ["id"];
          },
        ];
      };
      system_admin_memberships: {
        Row: { cree_le: string; role: string; utilisateur_id: string };
        Insert: { cree_le?: string; role: string; utilisateur_id: string };
        Update: { cree_le?: string; role?: string; utilisateur_id?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      fn_creer_restaurant_et_owner: {
        Args: { p_categorie_id: string; p_nom: string; p_quartier_id: string };
        Returns: string;
      };
      fn_est_admin_systeme: { Args: { p_roles?: string[] }; Returns: boolean };
      fn_est_membre_restaurant: { Args: { p_restaurant_id: string }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
