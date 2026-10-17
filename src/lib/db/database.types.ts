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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      acces_paliers: {
        Row: {
          accorde_par: string | null
          actif: string
          cree_le: string
          expire_le: string | null
          id: string
          palier: number
          plafond: boolean
          utilisateur_id: string
        }
        Insert: {
          accorde_par?: string | null
          actif: string
          cree_le?: string
          expire_le?: string | null
          id?: string
          palier: number
          plafond?: boolean
          utilisateur_id: string
        }
        Update: {
          accorde_par?: string | null
          actif?: string
          cree_le?: string
          expire_le?: string | null
          id?: string
          palier?: number
          plafond?: boolean
          utilisateur_id?: string
        }
        Relationships: []
      }
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
      client_profils: {
        Row: {
          adresse: string | null
          avatar: string
          coordonnees_enregistrees_le: string | null
          cree_le: string
          mis_a_jour_le: string
          nom_commande: string | null
          pseudo: string
          quartier_id: string | null
          telephone: string | null
          utilisateur_id: string
        }
        Insert: {
          adresse?: string | null
          avatar: string
          coordonnees_enregistrees_le?: string | null
          cree_le?: string
          mis_a_jour_le?: string
          nom_commande?: string | null
          pseudo: string
          quartier_id?: string | null
          telephone?: string | null
          utilisateur_id: string
        }
        Update: {
          adresse?: string | null
          avatar?: string
          coordonnees_enregistrees_le?: string | null
          cree_le?: string
          mis_a_jour_le?: string
          nom_commande?: string | null
          pseudo?: string
          quartier_id?: string | null
          telephone?: string | null
          utilisateur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_profils_quartier_id_fkey"
            columns: ["quartier_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_alertes: {
        Row: {
          prefecture_id: string | null
          region_id: string | null
          commune_id: string | null
          consentement_le: string
          contact: string
          contact_type: string
          cree_le: string
          id: string
          neighborhood_id: string | null
          notifie_le: string | null
        }
        Insert: {
          prefecture_id?: string | null
          region_id?: string | null
          commune_id?: string | null
          consentement_le?: string
          contact: string
          contact_type: string
          cree_le?: string
          id?: string
          neighborhood_id?: string | null
          notifie_le?: string | null
        }
        Update: {
          prefecture_id?: string | null
          region_id?: string | null
          commune_id?: string | null
          consentement_le?: string
          contact?: string
          contact_type?: string
          cree_le?: string
          id?: string
          neighborhood_id?: string | null
          notifie_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zone_alertes_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_alertes_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_zones_desservies: {
        Row: {
          commune_id: string | null
          cree_le: string
          delai_minutes: number | null
          frais_gnf: number | null
          id: string
          neighborhood_id: string | null
          restaurant_id: string
        }
        Insert: {
          commune_id?: string | null
          cree_le?: string
          delai_minutes?: number | null
          frais_gnf?: number | null
          id?: string
          neighborhood_id?: string | null
          restaurant_id: string
        }
        Update: {
          commune_id?: string | null
          cree_le?: string
          delai_minutes?: number | null
          frais_gnf?: number | null
          id?: string
          neighborhood_id?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_zones_desservies_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_zones_desservies_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_zones_desservies_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          actif: boolean
          code_officiel: string | null
          cree_le: string
          id: string
          latitude: number | null
          longitude: number | null
          nom: string
          slug: string
        }
        Insert: {
          actif?: boolean
          code_officiel?: string | null
          cree_le?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nom: string
          slug: string
        }
        Update: {
          actif?: boolean
          code_officiel?: string | null
          cree_le?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nom?: string
          slug?: string
        }
        Relationships: []
      }
      prefectures: {
        Row: {
          actif: boolean
          code_officiel: string | null
          cree_le: string
          id: string
          latitude: number | null
          longitude: number | null
          nom: string
          region_id: string
          slug: string
        }
        Insert: {
          actif?: boolean
          code_officiel?: string | null
          cree_le?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nom: string
          region_id: string
          slug: string
        }
        Update: {
          actif?: boolean
          code_officiel?: string | null
          cree_le?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nom?: string
          region_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "prefectures_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      communes: {
        Row: {
          coordonnees_source: string | null
          latitude: number | null
          longitude: number | null
          noms_alternatifs: string[]
          actif: boolean
          code_officiel: string | null
          cree_le: string
          id: string
          nom: string
          slug: string
          ville_id: string | null
          prefecture_id: string | null
          statut_lancement: string | null
        }
        Insert: {
          coordonnees_source?: string | null
          latitude?: number | null
          longitude?: number | null
          noms_alternatifs?: string[]
          actif?: boolean
          code_officiel?: string | null
          cree_le?: string
          id?: string
          nom: string
          slug: string
          ville_id?: string | null
          prefecture_id?: string | null
          statut_lancement?: string | null
        }
        Update: {
          coordonnees_source?: string | null
          latitude?: number | null
          longitude?: number | null
          noms_alternatifs?: string[]
          actif?: boolean
          code_officiel?: string | null
          cree_le?: string
          id?: string
          nom?: string
          slug?: string
          ville_id?: string | null
          prefecture_id?: string | null
          statut_lancement?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communes_prefecture_id_fkey"
            columns: ["prefecture_id"]
            isOneToOne: false
            referencedRelation: "prefectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communes_ville_id_fkey"
            columns: ["ville_id"]
            isOneToOne: false
            referencedRelation: "villes"
            referencedColumns: ["id"]
          },
        ]
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
          blocs_brouillon: Json | null
          blocs_publie: Json | null
          blocs_version: number
          contenu: string
          cree_le: string
          format: string
          id: string
          mis_a_jour_le: string
          publie_le: string | null
          slug: string
          statut: string
          titre: string
        }
        Insert: {
          auteur_id?: string | null
          blocs_brouillon?: Json | null
          blocs_publie?: Json | null
          blocs_version?: number
          contenu?: string
          cree_le?: string
          format?: string
          id?: string
          mis_a_jour_le?: string
          publie_le?: string | null
          slug: string
          statut?: string
          titre: string
        }
        Update: {
          auteur_id?: string | null
          blocs_brouillon?: Json | null
          blocs_publie?: Json | null
          blocs_version?: number
          contenu?: string
          cree_le?: string
          format?: string
          id?: string
          mis_a_jour_le?: string
          publie_le?: string | null
          slug?: string
          statut?: string
          titre?: string
        }
        Relationships: []
      }
      content_pages_versions: {
        Row: {
          auteur_id: string | null
          blocs: Json
          cree_le: string
          id: string
          motif: string | null
          page_id: string
          version: number
        }
        Insert: {
          auteur_id?: string | null
          blocs: Json
          cree_le?: string
          id?: string
          motif?: string | null
          page_id: string
          version: number
        }
        Update: {
          auteur_id?: string | null
          blocs?: Json
          cree_le?: string
          id?: string
          motif?: string | null
          page_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_pages_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "content_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      contenu_emplacements: {
        Row: {
          cle: string
          mis_a_jour_le: string
          mis_a_jour_par: string | null
          valeur: string
        }
        Insert: {
          cle: string
          mis_a_jour_le?: string
          mis_a_jour_par?: string | null
          valeur: string
        }
        Update: {
          cle?: string
          mis_a_jour_le?: string
          mis_a_jour_par?: string | null
          valeur?: string
        }
        Relationships: []
      }
      design_tokens: {
        Row: {
          cle: string
          cree_le: string
          groupe: string
          id: string
          libelle: string
          mis_a_jour_le: string
          portee: string
          restaurant_id: string | null
          valeur: string
        }
        Insert: {
          cle: string
          cree_le?: string
          groupe: string
          id?: string
          libelle: string
          mis_a_jour_le?: string
          portee: string
          restaurant_id?: string | null
          valeur: string
        }
        Update: {
          cle?: string
          cree_le?: string
          groupe?: string
          id?: string
          libelle?: string
          mis_a_jour_le?: string
          portee?: string
          restaurant_id?: string | null
          valeur?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_tokens_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      design_tokens_historique: {
        Row: {
          action: string
          auteur_id: string | null
          cle: string
          cree_le: string
          id: string
          portee: string
          restaurant_id: string | null
          valeur_apres: string
          valeur_avant: string | null
        }
        Insert: {
          action: string
          auteur_id?: string | null
          cle: string
          cree_le?: string
          id?: string
          portee?: string
          restaurant_id?: string | null
          valeur_apres: string
          valeur_avant?: string | null
        }
        Update: {
          action?: string
          auteur_id?: string | null
          cle?: string
          cree_le?: string
          id?: string
          portee?: string
          restaurant_id?: string | null
          valeur_apres?: string
          valeur_avant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "design_tokens_historique_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents_commande: {
        Row: {
          annee: number
          client_nom: string | null
          emetteur: Json
          emis_le: string
          frais_livraison: number
          id: string
          lignes: Json
          numero: string
          numero_seq: number
          order_id: string
          regime: string
          restaurant_id: string
          sous_total: number
          total: number
          tva_montant: number | null
          tva_taux: number | null
          type: string
        }
        Insert: {
          annee: number
          client_nom?: string | null
          emetteur: Json
          emis_le?: string
          frais_livraison: number
          id?: string
          lignes: Json
          numero: string
          numero_seq: number
          order_id: string
          regime: string
          restaurant_id: string
          sous_total: number
          total: number
          tva_montant?: number | null
          tva_taux?: number | null
          type: string
        }
        Update: {
          annee?: number
          client_nom?: string | null
          emetteur?: Json
          emis_le?: string
          frais_livraison?: number
          id?: string
          lignes?: Json
          numero?: string
          numero_seq?: number
          order_id?: string
          regime?: string
          restaurant_id?: string
          sous_total?: number
          total?: number
          tva_montant?: number | null
          tva_taux?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_commande_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_commande_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
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
      fonctionnalites: {
        Row: {
          active: boolean
          cle: string
          description: string
          groupe: string
          libelle: string
          mis_a_jour_le: string
          mis_a_jour_par: string | null
          ordre: number
        }
        Insert: {
          active?: boolean
          cle: string
          description: string
          groupe: string
          libelle: string
          mis_a_jour_le?: string
          mis_a_jour_par?: string | null
          ordre?: number
        }
        Update: {
          active?: boolean
          cle?: string
          description?: string
          groupe?: string
          libelle?: string
          mis_a_jour_le?: string
          mis_a_jour_par?: string | null
          ordre?: number
        }
        Relationships: []
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
      menu_items: {
        Row: {
          archive_le: string | null
          cree_le: string
          description: string
          disponibilite_confirmee_le: string | null
          disponible: boolean
          id: string
          illustration: Json | null
          mis_a_jour_le: string
          nom: string
          photo_url: string | null
          prix: number
          prix_promo: number | null
          restaurant_id: string
          section_id: string | null
        }
        Insert: {
          archive_le?: string | null
          cree_le?: string
          description?: string
          disponibilite_confirmee_le?: string | null
          disponible?: boolean
          id?: string
          illustration?: Json | null
          mis_a_jour_le?: string
          nom: string
          photo_url?: string | null
          prix: number
          prix_promo?: number | null
          restaurant_id: string
          section_id?: string | null
        }
        Update: {
          archive_le?: string | null
          cree_le?: string
          description?: string
          disponibilite_confirmee_le?: string | null
          disponible?: boolean
          id?: string
          illustration?: Json | null
          mis_a_jour_le?: string
          nom?: string
          photo_url?: string | null
          prix?: number
          prix_promo?: number | null
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
      neighborhoods: {
        Row: {
          generique: boolean
          coordonnees_source: string | null
          latitude: number | null
          longitude: number | null
          noms_alternatifs: string[]
          actif: boolean
          commune_id: string | null
          id: string
          nom: string
          ordre: number
        }
        Insert: {
          generique?: boolean
          coordonnees_source?: string | null
          latitude?: number | null
          longitude?: number | null
          noms_alternatifs?: string[]
          actif?: boolean
          commune_id?: string | null
          id?: string
          nom: string
          ordre?: number
        }
        Update: {
          generique?: boolean
          coordonnees_source?: string | null
          latitude?: number | null
          longitude?: number | null
          noms_alternatifs?: string[]
          actif?: boolean
          commune_id?: string | null
          id?: string
          nom?: string
          ordre?: number
        }
        Relationships: [
          {
            foreignKeyName: "neighborhoods_commune_id_fkey"
            columns: ["commune_id"]
            isOneToOne: false
            referencedRelation: "communes"
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
          anonymise_le: string | null
          client_adresse: string | null
          client_nom: string
          client_telephone: string
          client_user_id: string | null
          cree_le: string
          est_test: boolean
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
          table_numero: string | null
        }
        Insert: {
          anonymise_le?: string | null
          client_adresse?: string | null
          client_nom: string
          client_telephone: string
          client_user_id?: string | null
          cree_le?: string
          est_test?: boolean
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
          table_numero?: string | null
        }
        Update: {
          anonymise_le?: string | null
          client_adresse?: string | null
          client_nom?: string
          client_telephone?: string
          client_user_id?: string | null
          cree_le?: string
          est_test?: boolean
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
          table_numero?: string | null
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
          commande_proposition_delai_minutes: number
          connexion_facebook_active: boolean
          conservation_audit_mois: number
          conservation_coordonnees_jours: number
          conservation_non_cloturee_jours: number
          delai_validation_heures: number | null
          disponibilite_fraicheur_heures: number
          id: boolean
          mis_a_jour_le: string
          mis_a_jour_par: string | null
          position_carte_active: boolean
          prix_plat_max_gnf: number
          promesse_partage: string | null
          promesse_signature: string | null
          promesse_sous_titre: string | null
          whatsapp_assistance: string | null
        }
        Insert: {
          commande_proposition_delai_minutes?: number
          connexion_facebook_active?: boolean
          conservation_audit_mois?: number
          conservation_coordonnees_jours?: number
          conservation_non_cloturee_jours?: number
          delai_validation_heures?: number | null
          disponibilite_fraicheur_heures?: number
          id?: boolean
          mis_a_jour_le?: string
          mis_a_jour_par?: string | null
          position_carte_active?: boolean
          prix_plat_max_gnf?: number
          promesse_partage?: string | null
          promesse_signature?: string | null
          promesse_sous_titre?: string | null
          whatsapp_assistance?: string | null
        }
        Update: {
          commande_proposition_delai_minutes?: number
          connexion_facebook_active?: boolean
          conservation_audit_mois?: number
          conservation_coordonnees_jours?: number
          conservation_non_cloturee_jours?: number
          delai_validation_heures?: number | null
          disponibilite_fraicheur_heures?: number
          id?: boolean
          mis_a_jour_le?: string
          mis_a_jour_par?: string | null
          position_carte_active?: boolean
          prix_plat_max_gnf?: number
          promesse_partage?: string | null
          promesse_signature?: string | null
          promesse_sous_titre?: string | null
          whatsapp_assistance?: string | null
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
      reinitialisation_jetons: {
        Row: {
          cree_le: string
          expire_le: string
          id: string
          utilisateur_id: string
          utilise_le: string | null
        }
        Insert: {
          cree_le?: string
          expire_le: string
          id?: string
          utilisateur_id: string
          utilise_le?: string | null
        }
        Update: {
          cree_le?: string
          expire_le?: string
          id?: string
          utilisateur_id?: string
          utilise_le?: string | null
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
      restaurant_compteurs_documents: {
        Row: {
          annee: number
          dernier: number
          restaurant_id: string
          type: string
        }
        Insert: {
          annee: number
          dernier?: number
          restaurant_id: string
          type: string
        }
        Update: {
          annee?: number
          dernier?: number
          restaurant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_compteurs_documents_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_identite_documents: {
        Row: {
          adresse: string | null
          mention: string | null
          mis_a_jour_le: string
          nif: string | null
          raison_sociale: string | null
          rccm: string | null
          regime: string
          restaurant_id: string
          telephone: string | null
          tva_taux: number | null
        }
        Insert: {
          adresse?: string | null
          mention?: string | null
          mis_a_jour_le?: string
          nif?: string | null
          raison_sociale?: string | null
          rccm?: string | null
          regime?: string
          restaurant_id: string
          telephone?: string | null
          tva_taux?: number | null
        }
        Update: {
          adresse?: string | null
          mention?: string | null
          mis_a_jour_le?: string
          nif?: string | null
          raison_sociale?: string | null
          rccm?: string | null
          regime?: string
          restaurant_id?: string
          telephone?: string | null
          tva_taux?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_identite_documents_restaurant_id_fkey"
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
      restaurant_scans: {
        Row: {
          jour: string
          nb: number
          restaurant_id: string
          source: string
        }
        Insert: {
          jour?: string
          nb?: number
          restaurant_id: string
          source: string
        }
        Update: {
          jour?: string
          nb?: number
          restaurant_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_scans_restaurant_id_fkey"
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
          accepte_sur_place: boolean
          categorie_id: string
          code_court: string
          consignes: string | null
          couleur_accent: string | null
          couverture_illustration: Json | null
          cree_le: string
          donnees_demo: boolean
          horaires: string
          id: string
          latitude: number | null
          logo_illustration: Json | null
          logo_url: string | null
          longitude: number | null
          mis_a_jour_le: string
          motif_correction: string | null
          moyens_paiement: string[]
          nom: string
          ouvert: boolean
          photo_url: string | null
          publie: boolean
          quartier_id: string
          statut_mis_a_jour_le: string
          suspendu_le: string | null
          suspendu_motif: string | null
        }
        Insert: {
          accepte_commandes?: boolean
          accepte_sur_place?: boolean
          categorie_id: string
          code_court?: string
          consignes?: string | null
          couleur_accent?: string | null
          couverture_illustration?: Json | null
          cree_le?: string
          donnees_demo?: boolean
          horaires?: string
          id?: string
          latitude?: number | null
          logo_illustration?: Json | null
          logo_url?: string | null
          longitude?: number | null
          mis_a_jour_le?: string
          motif_correction?: string | null
          moyens_paiement?: string[]
          nom: string
          ouvert?: boolean
          photo_url?: string | null
          publie?: boolean
          quartier_id: string
          statut_mis_a_jour_le?: string
          suspendu_le?: string | null
          suspendu_motif?: string | null
        }
        Update: {
          accepte_commandes?: boolean
          accepte_sur_place?: boolean
          categorie_id?: string
          code_court?: string
          consignes?: string | null
          couleur_accent?: string | null
          couverture_illustration?: Json | null
          cree_le?: string
          donnees_demo?: boolean
          horaires?: string
          id?: string
          latitude?: number | null
          logo_illustration?: Json | null
          logo_url?: string | null
          longitude?: number | null
          mis_a_jour_le?: string
          motif_correction?: string | null
          moyens_paiement?: string[]
          nom?: string
          ouvert?: boolean
          photo_url?: string | null
          publie?: boolean
          quartier_id?: string
          statut_mis_a_jour_le?: string
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
      villes: {
        Row: {
          actif: boolean
          cree_le: string
          id: string
          nom: string
          slug: string
        }
        Insert: {
          actif?: boolean
          cree_le?: string
          id?: string
          nom: string
          slug: string
        }
        Update: {
          actif?: boolean
          cree_le?: string
          id?: string
          nom?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_admin_definir_illustration: {
        Args: { p_cible: string; p_id: string; p_valeur: Json }
        Returns: undefined
      }
      fn_admin_dossier_restaurant: {
        Args: { p_restaurant: string }
        Returns: Json
      }
      fn_admin_lister_plats: {
        Args: { p_restaurant: string }
        Returns: {
          id: string
          illustration: Json
          nom: string
          photo_url: string
          prix: number
        }[]
      }
      fn_anonymiser_donnees: { Args: never; Returns: Json }
      fn_compter_scan: {
        Args: { p_code: string; p_source: string }
        Returns: string
      }
      fn_creer_restaurant_et_owner: {
        Args: { p_categorie_id: string; p_nom: string; p_quartier_id: string }
        Returns: string
      }
      fn_emettre_document: {
        Args: { p_order_id: string; p_type: string }
        Returns: string
      }
      fn_fusionner_quartiers: {
        Args: { p_source: string; p_cible: string }
        Returns: Json
      }
      fn_est_admin_systeme: { Args: { p_roles?: string[] }; Returns: boolean }
      fn_est_membre_restaurant: {
        Args: { p_restaurant_id: string }
        Returns: boolean
      }
      fn_generer_code_court: { Args: never; Returns: string }
      fn_questions_etat: { Args: never; Returns: Json }
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
      fn_masquer_adresse: { Args: { p_adresse: string }; Returns: string }
      fn_masquer_telephone: { Args: { p_tel: string }; Returns: string }
      fn_preparer_suppression_compte: {
        Args: {
          p_motif: string
          p_supprimer_restaurants: boolean
          p_utilisateur: string
        }
        Returns: Json
      }
      fn_publier_blocs: {
        Args: {
          p_blocs: Json
          p_jeton: string
          p_motif?: string
          p_page_id: string
        }
        Returns: number
      }
      fn_reinitialisation_simuler: { Args: never; Returns: Json }
      fn_reinitialiser_application: {
        Args: { p_jeton: string; p_motif: string }
        Returns: Json
      }
      fn_repondre_proposition: {
        Args: { p_jeton: string; p_proposition_id: string; p_reponse: string }
        Returns: string
      }
      fn_session_mfa_suffisante: { Args: never; Returns: boolean }
      fn_statistiques_application: { Args: { p_jours: number }; Returns: Json }
      fn_support_changer_statut: {
        Args: { p_motif: string; p_order_id: string; p_vers: string }
        Returns: undefined
      }
      fn_support_commandes_par_heure: {
        Args: { p_jours: number }
        Returns: {
          heure: number
          nb: number
        }[]
      }
      fn_support_compter_commandes: {
        Args: { p_depuis?: string; p_statuts?: string[] }
        Returns: number
      }
      fn_support_lister_commandes: {
        Args: {
          p_id?: string
          p_jour?: boolean
          p_reference?: string
          p_restaurant?: string
          p_statut?: string
        }
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
        Returns: {
          client_adresse: string
          client_telephone: string
        }[]
      }
      fn_support_serie_commandes: {
        Args: { p_jours: number }
        Returns: {
          jour: string
          montant: number
          nb: number
          statut: string
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
