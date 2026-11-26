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
      affectations_operateurs: {
        Row: {
          commande_id: string | null
          cree_le: string
          id: string
          libere_le: string | null
          mis_a_jour_le: string
          operateur_id: string
          prise_le: string
          restaurant_id: string
        }
        Insert: {
          commande_id?: string | null
          cree_le?: string
          id?: string
          libere_le?: string | null
          mis_a_jour_le?: string
          operateur_id: string
          prise_le?: string
          restaurant_id: string
        }
        Update: {
          commande_id?: string | null
          cree_le?: string
          id?: string
          libere_le?: string | null
          mis_a_jour_le?: string
          operateur_id?: string
          prise_le?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affectations_operateurs_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affectations_operateurs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      annonces_versions: {
        Row: {
          annoncee_le: string
          annoncee_par: string | null
          appareils: number
          envoyes: number
          version_code: number
          version_nom: string
        }
        Insert: {
          annoncee_le?: string
          annoncee_par?: string | null
          appareils?: number
          envoyes?: number
          version_code: number
          version_nom: string
        }
        Update: {
          annoncee_le?: string
          annoncee_par?: string | null
          appareils?: number
          envoyes?: number
          version_code?: number
          version_nom?: string
        }
        Relationships: []
      }
      appareils_push: {
        Row: {
          cree_le: string
          derniere_reussite_le: string | null
          echecs: number
          id: string
          jeton: string
          mis_a_jour_le: string
          plateforme: string
          utilisateur_id: string
          version_app: string | null
        }
        Insert: {
          cree_le?: string
          derniere_reussite_le?: string | null
          echecs?: number
          id?: string
          jeton: string
          mis_a_jour_le?: string
          plateforme: string
          utilisateur_id: string
          version_app?: string | null
        }
        Update: {
          cree_le?: string
          derniere_reussite_le?: string | null
          echecs?: number
          id?: string
          jeton?: string
          mis_a_jour_le?: string
          plateforme?: string
          utilisateur_id?: string
          version_app?: string | null
        }
        Relationships: []
      }
      appareils_push_retraits: {
        Row: {
          jeton_empreinte: string
          retire_le: string
          session_id: string
          utilisateur_id: string
        }
        Insert: {
          jeton_empreinte: string
          retire_le?: string
          session_id: string
          utilisateur_id: string
        }
        Update: {
          jeton_empreinte?: string
          retire_le?: string
          session_id?: string
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
      avis: {
        Row: {
          auteur: string
          auteur_utilisateur_id: string | null
          cible: string
          commentaire: string | null
          cree_le: string
          est_test: boolean
          etiquettes: string[]
          id: string
          livreur_id: string | null
          modifie_le: string
          motif_moderation: string | null
          note: number
          order_id: string
          prenom_affiche: string | null
          reponse_le: string | null
          reponse_par: string | null
          reponse_texte: string | null
          restaurant_id: string
          statut: string
        }
        Insert: {
          auteur: string
          auteur_utilisateur_id?: string | null
          cible: string
          commentaire?: string | null
          cree_le?: string
          est_test?: boolean
          etiquettes?: string[]
          id?: string
          livreur_id?: string | null
          modifie_le?: string
          motif_moderation?: string | null
          note: number
          order_id: string
          prenom_affiche?: string | null
          reponse_le?: string | null
          reponse_par?: string | null
          reponse_texte?: string | null
          restaurant_id: string
          statut?: string
        }
        Update: {
          auteur?: string
          auteur_utilisateur_id?: string | null
          cible?: string
          commentaire?: string | null
          cree_le?: string
          est_test?: boolean
          etiquettes?: string[]
          id?: string
          livreur_id?: string | null
          modifie_le?: string
          motif_moderation?: string | null
          note?: number
          order_id?: string
          prenom_affiche?: string | null
          reponse_le?: string | null
          reponse_par?: string | null
          reponse_texte?: string | null
          restaurant_id?: string
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "avis_livreur_id_fkey"
            columns: ["livreur_id"]
            isOneToOne: false
            referencedRelation: "livreurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avis_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avis_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      avis_signalements: {
        Row: {
          avis_id: string
          cree_le: string
          id: string
          motif: string
          signale_par: string | null
          traite_le: string | null
          traite_par: string | null
        }
        Insert: {
          avis_id: string
          cree_le?: string
          id?: string
          motif: string
          signale_par?: string | null
          traite_le?: string | null
          traite_par?: string | null
        }
        Update: {
          avis_id?: string
          cree_le?: string
          id?: string
          motif?: string
          signale_par?: string | null
          traite_le?: string | null
          traite_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avis_signalements_avis_id_fkey"
            columns: ["avis_id"]
            isOneToOne: false
            referencedRelation: "avis"
            referencedColumns: ["id"]
          },
        ]
      }
      client_adresses: {
        Row: {
          adresse: string
          cree_le: string
          id: string
          libelle: string
          par_defaut: boolean
          utilisateur_id: string
        }
        Insert: {
          adresse: string
          cree_le?: string
          id?: string
          libelle: string
          par_defaut?: boolean
          utilisateur_id: string
        }
        Update: {
          adresse?: string
          cree_le?: string
          id?: string
          libelle?: string
          par_defaut?: boolean
          utilisateur_id?: string
        }
        Relationships: []
      }
      client_favoris: {
        Row: {
          cree_le: string
          restaurant_id: string
          utilisateur_id: string
        }
        Insert: {
          cree_le?: string
          restaurant_id: string
          utilisateur_id: string
        }
        Update: {
          cree_le?: string
          restaurant_id?: string
          utilisateur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_favoris_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notifications: {
        Row: {
          cree_le: string
          id: number
          lue_le: string | null
          order_id: string | null
          type: string
          utilisateur_id: string
        }
        Insert: {
          cree_le?: string
          id?: never
          lue_le?: string | null
          order_id?: string | null
          type: string
          utilisateur_id: string
        }
        Update: {
          cree_le?: string
          id?: never
          lue_le?: string | null
          order_id?: string | null
          type?: string
          utilisateur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profils: {
        Row: {
          adresse: string | null
          avatar: string
          coordonnees_enregistrees_le: string | null
          cree_le: string
          mis_a_jour_le: string
          mode_prefere: string | null
          nom_commande: string | null
          notifications_commande: boolean
          pseudo: string
          quartier_id: string | null
          quartier_prefere_id: string | null
          telephone: string | null
          utilisateur_id: string
        }
        Insert: {
          adresse?: string | null
          avatar: string
          coordonnees_enregistrees_le?: string | null
          cree_le?: string
          mis_a_jour_le?: string
          mode_prefere?: string | null
          nom_commande?: string | null
          notifications_commande?: boolean
          pseudo: string
          quartier_id?: string | null
          quartier_prefere_id?: string | null
          telephone?: string | null
          utilisateur_id: string
        }
        Update: {
          adresse?: string | null
          avatar?: string
          coordonnees_enregistrees_le?: string | null
          cree_le?: string
          mis_a_jour_le?: string
          mode_prefere?: string | null
          nom_commande?: string | null
          notifications_commande?: boolean
          pseudo?: string
          quartier_id?: string | null
          quartier_prefere_id?: string | null
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
          {
            foreignKeyName: "client_profils_quartier_prefere_id_fkey"
            columns: ["quartier_prefere_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
        ]
      }
      client_push_subscriptions: {
        Row: {
          agent: string | null
          auth: string
          cree_le: string
          derniere_reussite_le: string | null
          echecs: number
          endpoint: string
          id: string
          p256dh: string
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
          utilisateur_id?: string
        }
        Relationships: []
      }
      communes: {
        Row: {
          actif: boolean
          code_officiel: string | null
          coordonnees_source: string | null
          cree_le: string
          id: string
          latitude: number | null
          longitude: number | null
          nom: string
          noms_alternatifs: string[]
          prefecture_id: string | null
          slug: string
          statut_lancement: string | null
          ville_id: string | null
        }
        Insert: {
          actif?: boolean
          code_officiel?: string | null
          coordonnees_source?: string | null
          cree_le?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nom: string
          noms_alternatifs?: string[]
          prefecture_id?: string | null
          slug: string
          statut_lancement?: string | null
          ville_id?: string | null
        }
        Update: {
          actif?: boolean
          code_officiel?: string | null
          coordonnees_source?: string | null
          cree_le?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nom?: string
          noms_alternatifs?: string[]
          prefecture_id?: string | null
          slug?: string
          statut_lancement?: string | null
          ville_id?: string | null
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
      comptes_versement: {
        Row: {
          actif: boolean
          cree_le: string
          id: string
          livreur_id: string | null
          numero: string
          operateur: string
          proprietaire_type: string
          restaurant_id: string | null
          titulaire_nom: string | null
          verifie_le: string | null
        }
        Insert: {
          actif?: boolean
          cree_le?: string
          id?: string
          livreur_id?: string | null
          numero: string
          operateur: string
          proprietaire_type: string
          restaurant_id?: string | null
          titulaire_nom?: string | null
          verifie_le?: string | null
        }
        Update: {
          actif?: boolean
          cree_le?: string
          id?: string
          livreur_id?: string | null
          numero?: string
          operateur?: string
          proprietaire_type?: string
          restaurant_id?: string | null
          titulaire_nom?: string | null
          verifie_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comptes_versement_livreur_id_fkey"
            columns: ["livreur_id"]
            isOneToOne: false
            referencedRelation: "livreurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comptes_versement_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      conflits_numero: {
        Row: {
          cree_le: string
          demandeur_id: string
          id: string
          mail_envoye_le: string | null
          motif: string | null
          source: string
          statut: string
          telephone: string
          titulaire_id: string | null
          traite_le: string | null
          traite_par: string | null
        }
        Insert: {
          cree_le?: string
          demandeur_id: string
          id?: string
          mail_envoye_le?: string | null
          motif?: string | null
          source: string
          statut?: string
          telephone: string
          titulaire_id?: string | null
          traite_le?: string | null
          traite_par?: string | null
        }
        Update: {
          cree_le?: string
          demandeur_id?: string
          id?: string
          mail_envoye_le?: string | null
          motif?: string | null
          source?: string
          statut?: string
          telephone?: string
          titulaire_id?: string | null
          traite_le?: string | null
          traite_par?: string | null
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
      etablissement_contacts: {
        Row: {
          compte_rendu: string
          cree_le: string
          cree_par: string | null
          echeance_le: string | null
          id: string
          prochaine_action: string | null
          restaurant_id: string
          type_contact: string
        }
        Insert: {
          compte_rendu: string
          cree_le?: string
          cree_par?: string | null
          echeance_le?: string | null
          id?: string
          prochaine_action?: string | null
          restaurant_id: string
          type_contact: string
        }
        Update: {
          compte_rendu?: string
          cree_le?: string
          cree_par?: string | null
          echeance_le?: string | null
          id?: string
          prochaine_action?: string | null
          restaurant_id?: string
          type_contact?: string
        }
        Relationships: [
          {
            foreignKeyName: "etablissement_contacts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      etablissement_fermetures: {
        Row: {
          accepte_commandes_avant: boolean
          consigne_precedente: string | null
          cree_le: string
          cree_par: string | null
          duree_heures: number
          id: string
          leve_le: string | null
          leve_par: string | null
          message_public: string
          motif: string
          ouvert_avant: boolean
          reprise_le: string | null
          restaurant_id: string
          type_fermeture: string
        }
        Insert: {
          accepte_commandes_avant?: boolean
          consigne_precedente?: string | null
          cree_le?: string
          cree_par?: string | null
          duree_heures: number
          id?: string
          leve_le?: string | null
          leve_par?: string | null
          message_public: string
          motif: string
          ouvert_avant?: boolean
          reprise_le?: string | null
          restaurant_id: string
          type_fermeture: string
        }
        Update: {
          accepte_commandes_avant?: boolean
          consigne_precedente?: string | null
          cree_le?: string
          cree_par?: string | null
          duree_heures?: number
          id?: string
          leve_le?: string | null
          leve_par?: string | null
          message_public?: string
          motif?: string
          ouvert_avant?: boolean
          reprise_le?: string | null
          restaurant_id?: string
          type_fermeture?: string
        }
        Relationships: [
          {
            foreignKeyName: "etablissement_fermetures_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      etablissement_menu_confirmations: {
        Row: {
          canal: string | null
          cree_le: string
          cree_par: string | null
          id: string
          note: string | null
          plats_concernes: number
          restaurant_id: string
          type_evenement: string
        }
        Insert: {
          canal?: string | null
          cree_le?: string
          cree_par?: string | null
          id?: string
          note?: string | null
          plats_concernes?: number
          restaurant_id: string
          type_evenement: string
        }
        Update: {
          canal?: string | null
          cree_le?: string
          cree_par?: string | null
          id?: string
          note?: string | null
          plats_concernes?: number
          restaurant_id?: string
          type_evenement?: string
        }
        Relationships: [
          {
            foreignKeyName: "etablissement_menu_confirmations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      evenements_commande: {
        Row: {
          cle: string
          commande_id: string
          cree_le: string
          envoye_le: string | null
          essais: number
          id: string
          prochaine_tentative_le: string
          restaurant_id: string
          statut: string
          type: string
        }
        Insert: {
          cle: string
          commande_id: string
          cree_le?: string
          envoye_le?: string | null
          essais?: number
          id?: string
          prochaine_tentative_le?: string
          restaurant_id: string
          statut?: string
          type: string
        }
        Update: {
          cle?: string
          commande_id?: string
          cree_le?: string
          envoye_le?: string | null
          essais?: number
          id?: string
          prochaine_tentative_le?: string
          restaurant_id?: string
          statut?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "evenements_commande_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evenements_commande_restaurant_id_fkey"
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
      gamme_demandes: {
        Row: {
          cree_le: string
          decide_le: string | null
          decide_par: string | null
          demande_par: string | null
          gamme_demandee: string
          id: string
          motif: string
          motif_decision: string | null
          restaurant_id: string
          statut: string
        }
        Insert: {
          cree_le?: string
          decide_le?: string | null
          decide_par?: string | null
          demande_par?: string | null
          gamme_demandee: string
          id?: string
          motif: string
          motif_decision?: string | null
          restaurant_id: string
          statut?: string
        }
        Update: {
          cree_le?: string
          decide_le?: string | null
          decide_par?: string | null
          demande_par?: string | null
          gamme_demandee?: string
          id?: string
          motif?: string
          motif_decision?: string | null
          restaurant_id?: string
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamme_demandes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      identites_canoniques: {
        Row: {
          cree_le: string
          email_canonique: string
          utilisateur_id: string
        }
        Insert: {
          cree_le?: string
          email_canonique: string
          utilisateur_id: string
        }
        Update: {
          cree_le?: string
          email_canonique?: string
          utilisateur_id?: string
        }
        Relationships: []
      }
      incidents_livraison: {
        Row: {
          clos_le: string | null
          cree_le: string
          cree_par: string
          gravite: string
          id: string
          livraison_id: string | null
          mis_a_jour_le: string
          motif: string
          order_id: string | null
          resolution: string | null
          resolution_motif: string | null
          responsable_id: string | null
          statut: string
          type: string
        }
        Insert: {
          clos_le?: string | null
          cree_le?: string
          cree_par: string
          gravite?: string
          id?: string
          livraison_id?: string | null
          mis_a_jour_le?: string
          motif: string
          order_id?: string | null
          resolution?: string | null
          resolution_motif?: string | null
          responsable_id?: string | null
          statut?: string
          type: string
        }
        Update: {
          clos_le?: string | null
          cree_le?: string
          cree_par?: string
          gravite?: string
          id?: string
          livraison_id?: string | null
          mis_a_jour_le?: string
          motif?: string
          order_id?: string | null
          resolution?: string | null
          resolution_motif?: string | null
          responsable_id?: string | null
          statut?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_livraison_livraison_id_fkey"
            columns: ["livraison_id"]
            isOneToOne: false
            referencedRelation: "livraisons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_livraison_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      litiges_paiement: {
        Row: {
          clos_le: string | null
          cree_le: string
          decide_le: string | null
          decision: string | null
          etat: string
          id: string
          montant_demande_gnf: number | null
          motif_cloture: string | null
          ouvert_par: string
          paiement_id: string
          preuve_fournie: boolean
          regle: string | null
          remboursement_gnf: number | null
          situation: string
        }
        Insert: {
          clos_le?: string | null
          cree_le?: string
          decide_le?: string | null
          decision?: string | null
          etat?: string
          id?: string
          montant_demande_gnf?: number | null
          motif_cloture?: string | null
          ouvert_par: string
          paiement_id: string
          preuve_fournie?: boolean
          regle?: string | null
          remboursement_gnf?: number | null
          situation: string
        }
        Update: {
          clos_le?: string | null
          cree_le?: string
          decide_le?: string | null
          decision?: string | null
          etat?: string
          id?: string
          montant_demande_gnf?: number | null
          motif_cloture?: string | null
          ouvert_par?: string
          paiement_id?: string
          preuve_fournie?: boolean
          regle?: string | null
          remboursement_gnf?: number | null
          situation?: string
        }
        Relationships: [
          {
            foreignKeyName: "litiges_paiement_paiement_id_fkey"
            columns: ["paiement_id"]
            isOneToOne: false
            referencedRelation: "paiements"
            referencedColumns: ["id"]
          },
        ]
      }
      livraison_codes: {
        Row: {
          code: string
          livraison_id: string
        }
        Insert: {
          code: string
          livraison_id: string
        }
        Update: {
          code?: string
          livraison_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "livraison_codes_livraison_id_fkey"
            columns: ["livraison_id"]
            isOneToOne: true
            referencedRelation: "livraisons"
            referencedColumns: ["id"]
          },
        ]
      }
      livraison_offres: {
        Row: {
          cree_le: string
          expire_le: string
          id: string
          livraison_id: string
          livreur_id: string
          repondu_le: string | null
          statut: string
        }
        Insert: {
          cree_le?: string
          expire_le: string
          id?: string
          livraison_id: string
          livreur_id: string
          repondu_le?: string | null
          statut?: string
        }
        Update: {
          cree_le?: string
          expire_le?: string
          id?: string
          livraison_id?: string
          livreur_id?: string
          repondu_le?: string | null
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "livraison_offres_livraison_id_fkey"
            columns: ["livraison_id"]
            isOneToOne: false
            referencedRelation: "livraisons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livraison_offres_livreur_id_fkey"
            columns: ["livreur_id"]
            isOneToOne: false
            referencedRelation: "livreurs"
            referencedColumns: ["id"]
          },
        ]
      }
      livraisons: {
        Row: {
          arrivee_latitude: number | null
          arrivee_longitude: number | null
          assignee_le: string | null
          cree_le: string
          depart_latitude: number | null
          depart_longitude: number | null
          distance_m: number | null
          essais_code: number
          frais_gnf: number
          id: string
          livree_le: string | null
          livreur_id: string | null
          mis_a_jour_le: string
          mode: string
          order_id: string
          raison: string | null
          recuperee_le: string | null
          restaurant_id: string
          statut: string
        }
        Insert: {
          arrivee_latitude?: number | null
          arrivee_longitude?: number | null
          assignee_le?: string | null
          cree_le?: string
          depart_latitude?: number | null
          depart_longitude?: number | null
          distance_m?: number | null
          essais_code?: number
          frais_gnf?: number
          id?: string
          livree_le?: string | null
          livreur_id?: string | null
          mis_a_jour_le?: string
          mode: string
          order_id: string
          raison?: string | null
          recuperee_le?: string | null
          restaurant_id: string
          statut?: string
        }
        Update: {
          arrivee_latitude?: number | null
          arrivee_longitude?: number | null
          assignee_le?: string | null
          cree_le?: string
          depart_latitude?: number | null
          depart_longitude?: number | null
          distance_m?: number | null
          essais_code?: number
          frais_gnf?: number
          id?: string
          livree_le?: string | null
          livreur_id?: string | null
          mis_a_jour_le?: string
          mode?: string
          order_id?: string
          raison?: string | null
          recuperee_le?: string | null
          restaurant_id?: string
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "livraisons_livreur_id_fkey"
            columns: ["livreur_id"]
            isOneToOne: false
            referencedRelation: "livreurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livraisons_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livraisons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      livreur_dossiers: {
        Row: {
          consentement_le: string
          cree_le: string
          livreur_id: string
          piece_numero: string | null
          piece_type: string | null
          urgence_nom: string | null
          urgence_telephone: string | null
        }
        Insert: {
          consentement_le?: string
          cree_le?: string
          livreur_id: string
          piece_numero?: string | null
          piece_type?: string | null
          urgence_nom?: string | null
          urgence_telephone?: string | null
        }
        Update: {
          consentement_le?: string
          cree_le?: string
          livreur_id?: string
          piece_numero?: string | null
          piece_type?: string | null
          urgence_nom?: string | null
          urgence_telephone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "livreur_dossiers_livreur_id_fkey"
            columns: ["livreur_id"]
            isOneToOne: true
            referencedRelation: "livreurs"
            referencedColumns: ["id"]
          },
        ]
      }
      livreur_invitations: {
        Row: {
          cree_le: string
          cree_par: string | null
          empreinte: string
          expire_le: string
          id: string
          livreur_id: string
          utilise_le: string | null
        }
        Insert: {
          cree_le?: string
          cree_par?: string | null
          empreinte: string
          expire_le: string
          id?: string
          livreur_id: string
          utilise_le?: string | null
        }
        Update: {
          cree_le?: string
          cree_par?: string | null
          empreinte?: string
          expire_le?: string
          id?: string
          livreur_id?: string
          utilise_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "livreur_invitations_livreur_id_fkey"
            columns: ["livreur_id"]
            isOneToOne: false
            referencedRelation: "livreurs"
            referencedColumns: ["id"]
          },
        ]
      }
      livreurs: {
        Row: {
          approuve_le: string | null
          approuve_par: string | null
          cree_le: string
          cycle: string
          demo_lot: string | null
          derniere_course_le: string | null
          donnees_demo: boolean
          email_invitation: string | null
          id: string
          latitude: number | null
          longitude: number | null
          motif_cycle: string | null
          nom: string
          origine: string
          position_le: string | null
          restaurant_id: string | null
          simule: boolean
          statut: string
          telephone: string | null
          utilisateur_id: string | null
          vehicule: string
          verifie_speedfood: boolean
        }
        Insert: {
          approuve_le?: string | null
          approuve_par?: string | null
          cree_le?: string
          cycle?: string
          demo_lot?: string | null
          derniere_course_le?: string | null
          donnees_demo?: boolean
          email_invitation?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          motif_cycle?: string | null
          nom: string
          origine?: string
          position_le?: string | null
          restaurant_id?: string | null
          simule?: boolean
          statut?: string
          telephone?: string | null
          utilisateur_id?: string | null
          vehicule?: string
          verifie_speedfood?: boolean
        }
        Update: {
          approuve_le?: string | null
          approuve_par?: string | null
          cree_le?: string
          cycle?: string
          demo_lot?: string | null
          derniere_course_le?: string | null
          donnees_demo?: boolean
          email_invitation?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          motif_cycle?: string | null
          nom?: string
          origine?: string
          position_le?: string | null
          restaurant_id?: string | null
          simule?: boolean
          statut?: string
          telephone?: string | null
          utilisateur_id?: string | null
          vehicule?: string
          verifie_speedfood?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "livreurs_restaurant_id_fkey"
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
          allergenes: string[] | null
          allergenes_declares_le: string | null
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
          allergenes?: string[] | null
          allergenes_declares_le?: string | null
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
          allergenes?: string[] | null
          allergenes_declares_le?: string | null
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
          actif: boolean
          commune_id: string | null
          coordonnees_source: string | null
          generique: boolean
          id: string
          latitude: number | null
          longitude: number | null
          nom: string
          noms_alternatifs: string[]
          ordre: number
        }
        Insert: {
          actif?: boolean
          commune_id?: string | null
          coordonnees_source?: string | null
          generique?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          nom: string
          noms_alternatifs?: string[]
          ordre?: number
        }
        Update: {
          actif?: boolean
          commune_id?: string | null
          coordonnees_source?: string | null
          generique?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          nom?: string
          noms_alternatifs?: string[]
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
      numeros_appel_jour: {
        Row: {
          dernier: number
          jour: string
          restaurant_id: string
        }
        Insert: {
          dernier: number
          jour: string
          restaurant_id: string
        }
        Update: {
          dernier?: number
          jour?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "numeros_appel_jour_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      numeros_titulaires: {
        Row: {
          cree_le: string
          source: string
          telephone: string
          utilisateur_id: string
        }
        Insert: {
          cree_le?: string
          source: string
          telephone: string
          utilisateur_id: string
        }
        Update: {
          cree_le?: string
          source?: string
          telephone?: string
          utilisateur_id?: string
        }
        Relationships: []
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
          invite: boolean
          jeton_recu: string
          jeton_suivi: string
          livraison_distance_m: number | null
          livraison_gratuite: boolean
          livraison_latitude: number | null
          livraison_longitude: number | null
          mis_a_jour_le: string
          mode: string
          numero_appel: number | null
          paiement_declare_le: string | null
          paiement_mode: string | null
          paiement_recu_le: string | null
          paiement_reference: string | null
          paiement_statut: string
          reference: string
          restaurant_id: string
          saisie_par: string | null
          session_id: string | null
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
          invite?: boolean
          jeton_recu?: string
          jeton_suivi: string
          livraison_distance_m?: number | null
          livraison_gratuite?: boolean
          livraison_latitude?: number | null
          livraison_longitude?: number | null
          mis_a_jour_le?: string
          mode: string
          numero_appel?: number | null
          paiement_declare_le?: string | null
          paiement_mode?: string | null
          paiement_recu_le?: string | null
          paiement_reference?: string | null
          paiement_statut?: string
          reference: string
          restaurant_id: string
          saisie_par?: string | null
          session_id?: string | null
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
          invite?: boolean
          jeton_recu?: string
          jeton_suivi?: string
          livraison_distance_m?: number | null
          livraison_gratuite?: boolean
          livraison_latitude?: number | null
          livraison_longitude?: number | null
          mis_a_jour_le?: string
          mode?: string
          numero_appel?: number | null
          paiement_declare_le?: string | null
          paiement_mode?: string | null
          paiement_recu_le?: string | null
          paiement_reference?: string | null
          paiement_statut?: string
          reference?: string
          restaurant_id?: string
          saisie_par?: string | null
          session_id?: string | null
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
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      paiement_ecritures: {
        Row: {
          cle_idempotence: string
          compte: string
          cree_le: string
          groupe_id: string
          id: number
          montant_gnf: number
          paiement_id: string
          sens: string
        }
        Insert: {
          cle_idempotence: string
          compte: string
          cree_le?: string
          groupe_id: string
          id?: never
          montant_gnf: number
          paiement_id: string
          sens: string
        }
        Update: {
          cle_idempotence?: string
          compte?: string
          cree_le?: string
          groupe_id?: string
          id?: never
          montant_gnf?: number
          paiement_id?: string
          sens?: string
        }
        Relationships: [
          {
            foreignKeyName: "paiement_ecritures_paiement_id_fkey"
            columns: ["paiement_id"]
            isOneToOne: false
            referencedRelation: "paiements"
            referencedColumns: ["id"]
          },
        ]
      }
      paiement_evenements: {
        Row: {
          etat_recu: string
          fournisseur: string
          id: number
          identifiant_evenement: string
          montant_gnf: number | null
          recu_le: string
          reference_externe: string | null
          resultat: string
        }
        Insert: {
          etat_recu: string
          fournisseur: string
          id?: never
          identifiant_evenement: string
          montant_gnf?: number | null
          recu_le?: string
          reference_externe?: string | null
          resultat: string
        }
        Update: {
          etat_recu?: string
          fournisseur?: string
          id?: never
          identifiant_evenement?: string
          montant_gnf?: number | null
          recu_le?: string
          reference_externe?: string | null
          resultat?: string
        }
        Relationships: []
      }
      paiement_versements: {
        Row: {
          beneficiaire_type: string
          compte_versement_id: string | null
          cree_le: string
          erreur_code: string | null
          etat: string
          id: string
          livreur_id: string | null
          mis_a_jour_le: string
          montant_gnf: number
          numero_masque: string
          operateur: string
          paiement_id: string
          reference_externe: string | null
          reference_interne: string
          restaurant_id: string | null
          tentatives: number
        }
        Insert: {
          beneficiaire_type: string
          compte_versement_id?: string | null
          cree_le?: string
          erreur_code?: string | null
          etat?: string
          id?: string
          livreur_id?: string | null
          mis_a_jour_le?: string
          montant_gnf: number
          numero_masque: string
          operateur: string
          paiement_id: string
          reference_externe?: string | null
          reference_interne: string
          restaurant_id?: string | null
          tentatives?: number
        }
        Update: {
          beneficiaire_type?: string
          compte_versement_id?: string | null
          cree_le?: string
          erreur_code?: string | null
          etat?: string
          id?: string
          livreur_id?: string | null
          mis_a_jour_le?: string
          montant_gnf?: number
          numero_masque?: string
          operateur?: string
          paiement_id?: string
          reference_externe?: string | null
          reference_interne?: string
          restaurant_id?: string | null
          tentatives?: number
        }
        Relationships: [
          {
            foreignKeyName: "paiement_versements_compte_versement_id_fkey"
            columns: ["compte_versement_id"]
            isOneToOne: false
            referencedRelation: "comptes_versement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiement_versements_livreur_id_fkey"
            columns: ["livreur_id"]
            isOneToOne: false
            referencedRelation: "livreurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiement_versements_paiement_id_fkey"
            columns: ["paiement_id"]
            isOneToOne: false
            referencedRelation: "paiements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiement_versements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements: {
        Row: {
          confirme_le: string | null
          cree_le: string
          etat: string
          expire_le: string | null
          fournisseur: string
          frais_livraison_gnf: number
          frais_mobile_gnf: number
          frais_speedfood_gnf: number
          id: string
          libere_le: string | null
          livraison_par: string
          livreur_gnf: number
          mis_a_jour_le: string
          operateur: string
          order_id: string
          reference_externe: string | null
          reference_interne: string
          rembourse_gnf: number
          repas_gnf: number
          restaurant_gnf: number
          restaurant_id: string
          speedfood_brut_gnf: number
          total_gnf: number | null
        }
        Insert: {
          confirme_le?: string | null
          cree_le?: string
          etat?: string
          expire_le?: string | null
          fournisseur: string
          frais_livraison_gnf?: number
          frais_mobile_gnf: number
          frais_speedfood_gnf: number
          id?: string
          libere_le?: string | null
          livraison_par: string
          livreur_gnf: number
          mis_a_jour_le?: string
          operateur: string
          order_id: string
          reference_externe?: string | null
          reference_interne: string
          rembourse_gnf?: number
          repas_gnf: number
          restaurant_gnf: number
          restaurant_id: string
          speedfood_brut_gnf: number
          total_gnf?: number | null
        }
        Update: {
          confirme_le?: string | null
          cree_le?: string
          etat?: string
          expire_le?: string | null
          fournisseur?: string
          frais_livraison_gnf?: number
          frais_mobile_gnf?: number
          frais_speedfood_gnf?: number
          id?: string
          libere_le?: string | null
          livraison_par?: string
          livreur_gnf?: number
          mis_a_jour_le?: string
          operateur?: string
          order_id?: string
          reference_externe?: string | null
          reference_interne?: string
          rembourse_gnf?: number
          repas_gnf?: number
          restaurant_gnf?: number
          restaurant_id?: string
          speedfood_brut_gnf?: number
          total_gnf?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "paiements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      parametres_aide_choix: {
        Row: {
          id: boolean
          marge_au_dessus_pct: number
          mis_a_jour_le: string
          mis_a_jour_par: string | null
          nb_propositions: number
          rayon_defaut_km: number
          seuil_economique_gnf: number
          seuil_haut_de_gamme_gnf: number
          seuil_intermediaire_gnf: number
        }
        Insert: {
          id?: boolean
          marge_au_dessus_pct?: number
          mis_a_jour_le?: string
          mis_a_jour_par?: string | null
          nb_propositions?: number
          rayon_defaut_km?: number
          seuil_economique_gnf?: number
          seuil_haut_de_gamme_gnf?: number
          seuil_intermediaire_gnf?: number
        }
        Update: {
          id?: boolean
          marge_au_dessus_pct?: number
          mis_a_jour_le?: string
          mis_a_jour_par?: string | null
          nb_propositions?: number
          rayon_defaut_km?: number
          seuil_economique_gnf?: number
          seuil_haut_de_gamme_gnf?: number
          seuil_intermediaire_gnf?: number
        }
        Relationships: []
      }
      parametres_application: {
        Row: {
          commande_proposition_delai_minutes: number
          connexion_facebook_active: boolean
          connexion_google_active: boolean
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
          connexion_google_active?: boolean
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
          connexion_google_active?: boolean
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
      parametres_classement: {
        Row: {
          fenetre_frequentation_jours: number
          id: boolean
          mis_a_jour_le: string
          mis_a_jour_par: string | null
          poids_frequentation: number
          poids_note: number
          poids_prix: number
        }
        Insert: {
          fenetre_frequentation_jours?: number
          id?: boolean
          mis_a_jour_le?: string
          mis_a_jour_par?: string | null
          poids_frequentation?: number
          poids_note?: number
          poids_prix?: number
        }
        Update: {
          fenetre_frequentation_jours?: number
          id?: boolean
          mis_a_jour_le?: string
          mis_a_jour_par?: string | null
          poids_frequentation?: number
          poids_note?: number
          poids_prix?: number
        }
        Relationships: []
      }
      parametres_livraison: {
        Row: {
          arrondi_gnf: number
          base_gnf: number
          delai_offre_secondes: number
          frais_actifs: boolean
          gratuit_des_gnf: number | null
          id: boolean
          livreur_approbation_requise: boolean
          livreur_lien_validite_jours: number
          livreur_piece_requise: boolean
          livreur_urgence_requise: boolean
          minimum_gnf: number
          mis_a_jour_le: string
          mis_a_jour_par: string | null
          prix_km_gnf: number
          rayon_max_km: number
          vitesse_moyenne_kmh: number
        }
        Insert: {
          arrondi_gnf?: number
          base_gnf?: number
          delai_offre_secondes?: number
          frais_actifs?: boolean
          gratuit_des_gnf?: number | null
          id?: boolean
          livreur_approbation_requise?: boolean
          livreur_lien_validite_jours?: number
          livreur_piece_requise?: boolean
          livreur_urgence_requise?: boolean
          minimum_gnf?: number
          mis_a_jour_le?: string
          mis_a_jour_par?: string | null
          prix_km_gnf?: number
          rayon_max_km?: number
          vitesse_moyenne_kmh?: number
        }
        Update: {
          arrondi_gnf?: number
          base_gnf?: number
          delai_offre_secondes?: number
          frais_actifs?: boolean
          gratuit_des_gnf?: number | null
          id?: boolean
          livreur_approbation_requise?: boolean
          livreur_lien_validite_jours?: number
          livreur_piece_requise?: boolean
          livreur_urgence_requise?: boolean
          minimum_gnf?: number
          mis_a_jour_le?: string
          mis_a_jour_par?: string | null
          prix_km_gnf?: number
          rayon_max_km?: number
          vitesse_moyenne_kmh?: number
        }
        Relationships: []
      }
      parametres_paiement: {
        Row: {
          commission_reduction_excellent_permille: number
          commission_speedfood_permille: number
          delai_expiration_minutes: number
          fournisseur: string
          frais_mobile_fixe_gnf: number
          frais_mobile_permille_mtn: number
          frais_mobile_permille_orange: number
          frais_speedfood_commande_gnf: number
          frais_versement_gnf: number
          id: boolean
          mis_a_jour_le: string
          paiement_en_ligne_actif: boolean
          plafond_paiement_gnf: number
          plafond_remboursement_auto_permille: number
          seuil_litige_humain_gnf: number
          valeurs_validees_le: string | null
        }
        Insert: {
          commission_reduction_excellent_permille?: number
          commission_speedfood_permille?: number
          delai_expiration_minutes?: number
          fournisseur?: string
          frais_mobile_fixe_gnf?: number
          frais_mobile_permille_mtn?: number
          frais_mobile_permille_orange?: number
          frais_speedfood_commande_gnf?: number
          frais_versement_gnf?: number
          id?: boolean
          mis_a_jour_le?: string
          paiement_en_ligne_actif?: boolean
          plafond_paiement_gnf?: number
          plafond_remboursement_auto_permille?: number
          seuil_litige_humain_gnf?: number
          valeurs_validees_le?: string | null
        }
        Update: {
          commission_reduction_excellent_permille?: number
          commission_speedfood_permille?: number
          delai_expiration_minutes?: number
          fournisseur?: string
          frais_mobile_fixe_gnf?: number
          frais_mobile_permille_mtn?: number
          frais_mobile_permille_orange?: number
          frais_speedfood_commande_gnf?: number
          frais_versement_gnf?: number
          id?: boolean
          mis_a_jour_le?: string
          paiement_en_ligne_actif?: boolean
          plafond_paiement_gnf?: number
          plafond_remboursement_auto_permille?: number
          seuil_litige_humain_gnf?: number
          valeurs_validees_le?: string | null
        }
        Relationships: []
      }
      parametres_remboursement: {
        Row: {
          dernier_motif: string | null
          id: boolean
          mis_a_jour_le: string
          mis_a_jour_par: string | null
          remboursement_especes_autorise: boolean
        }
        Insert: {
          dernier_motif?: string | null
          id?: boolean
          mis_a_jour_le?: string
          mis_a_jour_par?: string | null
          remboursement_especes_autorise?: boolean
        }
        Update: {
          dernier_motif?: string | null
          id?: boolean
          mis_a_jour_le?: string
          mis_a_jour_par?: string | null
          remboursement_especes_autorise?: boolean
        }
        Relationships: []
      }
      parametres_remboursement_journal: {
        Row: {
          ancienne_valeur: boolean
          change_le: string
          change_par: string | null
          id: string
          motif: string
          nouvelle_valeur: boolean
          reglage: string
        }
        Insert: {
          ancienne_valeur: boolean
          change_le?: string
          change_par?: string | null
          id?: string
          motif: string
          nouvelle_valeur: boolean
          reglage: string
        }
        Update: {
          ancienne_valeur?: boolean
          change_le?: string
          change_par?: string | null
          id?: string
          motif?: string
          nouvelle_valeur?: boolean
          reglage?: string
        }
        Relationships: []
      }
      partenariat_demandes: {
        Row: {
          consentement_le: string
          contact: string
          contact_type: string
          cree_le: string
          forme: string
          id: string
          message: string
          nom_contact: string
          organisation: string
          statut: string
          traitee_le: string | null
        }
        Insert: {
          consentement_le?: string
          contact: string
          contact_type: string
          cree_le?: string
          forme: string
          id?: string
          message: string
          nom_contact: string
          organisation: string
          statut?: string
          traitee_le?: string | null
        }
        Update: {
          consentement_le?: string
          contact?: string
          contact_type?: string
          cree_le?: string
          forme?: string
          id?: string
          message?: string
          nom_contact?: string
          organisation?: string
          statut?: string
          traitee_le?: string | null
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
      preferences_clients: {
        Row: {
          allergies: string[]
          budget_max_gnf: number | null
          consentement_sante_le: string | null
          cree_le: string
          cuisines_preferees: string[]
          evitements: string[]
          mis_a_jour_le: string
          notes: string
          piment: string | null
          regimes: string[]
          utilisateur_id: string
        }
        Insert: {
          allergies?: string[]
          budget_max_gnf?: number | null
          consentement_sante_le?: string | null
          cree_le?: string
          cuisines_preferees?: string[]
          evitements?: string[]
          mis_a_jour_le?: string
          notes?: string
          piment?: string | null
          regimes?: string[]
          utilisateur_id: string
        }
        Update: {
          allergies?: string[]
          budget_max_gnf?: number | null
          consentement_sante_le?: string | null
          cree_le?: string
          cuisines_preferees?: string[]
          evitements?: string[]
          mis_a_jour_le?: string
          notes?: string
          piment?: string | null
          regimes?: string[]
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
      referencement_demandes: {
        Row: {
          categories: string | null
          commune: string
          consentement_le: string
          contact_email: string
          contact_telephone: string
          cree_le: string
          fichiers_effaces_le: string | null
          horaires: string | null
          id: string
          indications: string | null
          latitude: number | null
          logo_chemin: string | null
          longitude: number | null
          menu_brouillon: Json | null
          motif_refus: string | null
          moyens_paiement: string[]
          organisation: string
          origine: string
          photo_chemin: string | null
          quartier: string
          responsable_nom: string
          responsable_prenom: string
          restaurant_id: string | null
          services: string[]
          specialites: string | null
          statut: string
          traitee_le: string | null
          type_etablissement: string
          utilisateur_id: string | null
        }
        Insert: {
          categories?: string | null
          commune: string
          consentement_le?: string
          contact_email: string
          contact_telephone: string
          cree_le?: string
          fichiers_effaces_le?: string | null
          horaires?: string | null
          id?: string
          indications?: string | null
          latitude?: number | null
          logo_chemin?: string | null
          longitude?: number | null
          menu_brouillon?: Json | null
          motif_refus?: string | null
          moyens_paiement?: string[]
          organisation: string
          origine?: string
          photo_chemin?: string | null
          quartier: string
          responsable_nom: string
          responsable_prenom: string
          restaurant_id?: string | null
          services?: string[]
          specialites?: string | null
          statut?: string
          traitee_le?: string | null
          type_etablissement: string
          utilisateur_id?: string | null
        }
        Update: {
          categories?: string | null
          commune?: string
          consentement_le?: string
          contact_email?: string
          contact_telephone?: string
          cree_le?: string
          fichiers_effaces_le?: string | null
          horaires?: string | null
          id?: string
          indications?: string | null
          latitude?: number | null
          logo_chemin?: string | null
          longitude?: number | null
          menu_brouillon?: Json | null
          motif_refus?: string | null
          moyens_paiement?: string[]
          organisation?: string
          origine?: string
          photo_chemin?: string | null
          quartier?: string
          responsable_nom?: string
          responsable_prenom?: string
          restaurant_id?: string | null
          services?: string[]
          specialites?: string | null
          statut?: string
          traitee_le?: string | null
          type_etablissement?: string
          utilisateur_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referencement_demandes_restaurant_id_fkey"
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
      remboursement_decisions: {
        Row: {
          argent_chez_restaurant_reconnu: boolean
          decide_le: string
          decide_par: string | null
          ecart_regle: string
          id: string
          issue: string
          litige_id: string | null
          mode_paiement_origine: string
          montant_gnf: number
          motif: string
          moyen: string
          order_id: string
          paiement_id: string | null
          reference_avis: string | null
          regle_automatique: string | null
          remplace_id: string | null
        }
        Insert: {
          argent_chez_restaurant_reconnu?: boolean
          decide_le?: string
          decide_par?: string | null
          ecart_regle: string
          id?: string
          issue: string
          litige_id?: string | null
          mode_paiement_origine: string
          montant_gnf: number
          motif: string
          moyen: string
          order_id: string
          paiement_id?: string | null
          reference_avis?: string | null
          regle_automatique?: string | null
          remplace_id?: string | null
        }
        Update: {
          argent_chez_restaurant_reconnu?: boolean
          decide_le?: string
          decide_par?: string | null
          ecart_regle?: string
          id?: string
          issue?: string
          litige_id?: string | null
          mode_paiement_origine?: string
          montant_gnf?: number
          motif?: string
          moyen?: string
          order_id?: string
          paiement_id?: string | null
          reference_avis?: string | null
          regle_automatique?: string | null
          remplace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remboursement_decisions_litige_id_fkey"
            columns: ["litige_id"]
            isOneToOne: false
            referencedRelation: "litiges_paiement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remboursement_decisions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remboursement_decisions_paiement_id_fkey"
            columns: ["paiement_id"]
            isOneToOne: false
            referencedRelation: "paiements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remboursement_decisions_remplace_id_fkey"
            columns: ["remplace_id"]
            isOneToOne: false
            referencedRelation: "remboursement_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      remboursements_manuels: {
        Row: {
          cree_le: string
          decision_id: string | null
          effectue_par: string | null
          id: string
          litige_id: string | null
          montant_gnf: number
          motif: string
          moyen: string
          paiement_id: string
          recu_par: string | null
          reference: string | null
        }
        Insert: {
          cree_le?: string
          decision_id?: string | null
          effectue_par?: string | null
          id?: string
          litige_id?: string | null
          montant_gnf: number
          motif: string
          moyen: string
          paiement_id: string
          recu_par?: string | null
          reference?: string | null
        }
        Update: {
          cree_le?: string
          decision_id?: string | null
          effectue_par?: string | null
          id?: string
          litige_id?: string | null
          montant_gnf?: number
          motif?: string
          moyen?: string
          paiement_id?: string
          recu_par?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remboursements_manuels_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "remboursement_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remboursements_manuels_litige_id_fkey"
            columns: ["litige_id"]
            isOneToOne: false
            referencedRelation: "litiges_paiement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remboursements_manuels_paiement_id_fkey"
            columns: ["paiement_id"]
            isOneToOne: true
            referencedRelation: "paiements"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations_table: {
        Row: {
          client_user_id: string | null
          cree_le: string
          creneau: string
          id: string
          jeton_suivi_hash: string | null
          mis_a_jour_le: string
          motif_refus: string | null
          nb_personnes: number
          nom_client: string
          note: string | null
          reference: string
          restaurant_id: string
          statut: string
          telephone: string
          traitee_le: string | null
          traitee_par: string | null
        }
        Insert: {
          client_user_id?: string | null
          cree_le?: string
          creneau: string
          id?: string
          jeton_suivi_hash?: string | null
          mis_a_jour_le?: string
          motif_refus?: string | null
          nb_personnes: number
          nom_client: string
          note?: string | null
          reference?: string
          restaurant_id: string
          statut?: string
          telephone: string
          traitee_le?: string | null
          traitee_par?: string | null
        }
        Update: {
          client_user_id?: string | null
          cree_le?: string
          creneau?: string
          id?: string
          jeton_suivi_hash?: string | null
          mis_a_jour_le?: string
          motif_refus?: string | null
          nb_personnes?: number
          nom_client?: string
          note?: string | null
          reference?: string
          restaurant_id?: string
          statut?: string
          telephone?: string
          traitee_le?: string | null
          traitee_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_table_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
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
      restaurant_contacts_internes: {
        Row: {
          mis_a_jour_le: string
          restaurant_id: string
          telephone_commandes: string
        }
        Insert: {
          mis_a_jour_le?: string
          restaurant_id: string
          telephone_commandes: string
        }
        Update: {
          mis_a_jour_le?: string
          restaurant_id?: string
          telephone_commandes?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_contacts_internes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
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
      restaurants: {
        Row: {
          accepte_commandes: boolean
          accepte_reservation: boolean
          accepte_sur_place: boolean
          avis_somme: number
          avis_total: number
          categorie_id: string
          code_court: string
          consignes: string | null
          correction_demandee: boolean | null
          couleur_accent: string | null
          couverture_illustration: Json | null
          cree_le: string
          delai_preparation_minutes: number | null
          demo_lot: string | null
          donnees_demo: boolean
          gamme_validee: string | null
          horaires: string
          id: string
          latitude: number | null
          livraison_mode: string
          logo_illustration: Json | null
          logo_url: string | null
          longitude: number | null
          mis_a_jour_le: string
          mode_vente: string
          motif_correction: string | null
          moyens_paiement: string[]
          nom: string
          ouvert: boolean
          photo_url: string | null
          publie: boolean
          quartier_id: string
          reservation_capacite_couverts: number | null
          service_table: string
          statut_mis_a_jour_le: string
          suspendu_le: string | null
          suspendu_motif: string | null
          table_sans_compte: boolean
          table_validation: string
        }
        Insert: {
          accepte_commandes?: boolean
          accepte_reservation?: boolean
          accepte_sur_place?: boolean
          avis_somme?: number
          avis_total?: number
          categorie_id: string
          code_court?: string
          consignes?: string | null
          correction_demandee?: boolean | null
          couleur_accent?: string | null
          couverture_illustration?: Json | null
          cree_le?: string
          delai_preparation_minutes?: number | null
          demo_lot?: string | null
          donnees_demo?: boolean
          gamme_validee?: string | null
          horaires?: string
          id?: string
          latitude?: number | null
          livraison_mode?: string
          logo_illustration?: Json | null
          logo_url?: string | null
          longitude?: number | null
          mis_a_jour_le?: string
          mode_vente?: string
          motif_correction?: string | null
          moyens_paiement?: string[]
          nom: string
          ouvert?: boolean
          photo_url?: string | null
          publie?: boolean
          quartier_id: string
          reservation_capacite_couverts?: number | null
          service_table?: string
          statut_mis_a_jour_le?: string
          suspendu_le?: string | null
          suspendu_motif?: string | null
          table_sans_compte?: boolean
          table_validation?: string
        }
        Update: {
          accepte_commandes?: boolean
          accepte_reservation?: boolean
          accepte_sur_place?: boolean
          avis_somme?: number
          avis_total?: number
          categorie_id?: string
          code_court?: string
          consignes?: string | null
          correction_demandee?: boolean | null
          couleur_accent?: string | null
          couverture_illustration?: Json | null
          cree_le?: string
          delai_preparation_minutes?: number | null
          demo_lot?: string | null
          donnees_demo?: boolean
          gamme_validee?: string | null
          horaires?: string
          id?: string
          latitude?: number | null
          livraison_mode?: string
          logo_illustration?: Json | null
          logo_url?: string | null
          longitude?: number | null
          mis_a_jour_le?: string
          mode_vente?: string
          motif_correction?: string | null
          moyens_paiement?: string[]
          nom?: string
          ouvert?: boolean
          photo_url?: string | null
          publie?: boolean
          quartier_id?: string
          reservation_capacite_couverts?: number | null
          service_table?: string
          statut_mis_a_jour_le?: string
          suspendu_le?: string | null
          suspendu_motif?: string | null
          table_sans_compte?: boolean
          table_validation?: string
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
      scores_qualite_mensuels: {
        Row: {
          calcule_le: string
          id: string
          indicateurs: Json
          mois: string
          mois_bas_consecutifs: number
          palier: string
          restaurant_id: string
          score: number
        }
        Insert: {
          calcule_le?: string
          id?: string
          indicateurs?: Json
          mois: string
          mois_bas_consecutifs?: number
          palier: string
          restaurant_id: string
          score: number
        }
        Update: {
          calcule_le?: string
          id?: string
          indicateurs?: Json
          mois?: string
          mois_bas_consecutifs?: number
          palier?: string
          restaurant_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "scores_qualite_mensuels_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      securite_codes_secours: {
        Row: {
          cree_le: string
          empreinte: string
          id: string
          utilisateur_id: string
          utilise_le: string | null
        }
        Insert: {
          cree_le?: string
          empreinte: string
          id?: string
          utilisateur_id: string
          utilise_le?: string | null
        }
        Update: {
          cree_le?: string
          empreinte?: string
          id?: string
          utilisateur_id?: string
          utilise_le?: string | null
        }
        Relationships: []
      }
      securite_questions: {
        Row: {
          bloque_jusqu: string | null
          cree_le: string
          empreinte: string
          essais_echoues: number
          iterations: number
          mis_a_jour_le: string
          question_1: string
          question_2: string
          sel: string
          utilisateur_id: string
        }
        Insert: {
          bloque_jusqu?: string | null
          cree_le?: string
          empreinte: string
          essais_echoues?: number
          iterations?: number
          mis_a_jour_le?: string
          question_1: string
          question_2: string
          sel: string
          utilisateur_id: string
        }
        Update: {
          bloque_jusqu?: string | null
          cree_le?: string
          empreinte?: string
          essais_echoues?: number
          iterations?: number
          mis_a_jour_le?: string
          question_1?: string
          question_2?: string
          sel?: string
          utilisateur_id?: string
        }
        Relationships: []
      }
      securite_questions_sessions: {
        Row: {
          cree_le: string
          session_id: string
          utilisateur_id: string
          valide_jusqu: string
        }
        Insert: {
          cree_le?: string
          session_id: string
          utilisateur_id: string
          valide_jusqu: string
        }
        Update: {
          cree_le?: string
          session_id?: string
          utilisateur_id?: string
          valide_jusqu?: string
        }
        Relationships: []
      }
      signalements_doublons: {
        Row: {
          cree_le: string
          email_canonique: string
          id: string
          mail_envoye_le: string | null
          motif: string | null
          nouvel_utilisateur_id: string
          statut: string
          traite_le: string | null
          traite_par: string | null
          utilisateur_existant_id: string | null
        }
        Insert: {
          cree_le?: string
          email_canonique: string
          id?: string
          mail_envoye_le?: string | null
          motif?: string | null
          nouvel_utilisateur_id: string
          statut?: string
          traite_le?: string | null
          traite_par?: string | null
          utilisateur_existant_id?: string | null
        }
        Update: {
          cree_le?: string
          email_canonique?: string
          id?: string
          mail_envoye_le?: string | null
          motif?: string | null
          nouvel_utilisateur_id?: string
          statut?: string
          traite_le?: string | null
          traite_par?: string | null
          utilisateur_existant_id?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          auteur: string
          commande_id: string
          contenu: string
          cree_le: string
          id: string
        }
        Insert: {
          auteur: string
          commande_id: string
          contenu: string
          cree_le?: string
          id?: string
        }
        Update: {
          auteur?: string
          commande_id?: string
          contenu?: string
          cree_le?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      support_threads: {
        Row: {
          commande_id: string
          cree_le: string
          modifie_le: string
          statut: string
        }
        Insert: {
          commande_id: string
          cree_le?: string
          modifie_le?: string
          statut?: string
        }
        Update: {
          commande_id?: string
          cree_le?: string
          modifie_le?: string
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_threads_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: true
            referencedRelation: "orders"
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
      table_sessions: {
        Row: {
          addition_demandee_le: string | null
          appel_serveur_le: string | null
          cloturee_le: string | null
          cloturee_par: string | null
          id: string
          mis_a_jour_le: string
          ouverte_le: string
          paiement_mode: string | null
          restaurant_id: string
          statut: string
          table_numero: string
          validee_le: string | null
        }
        Insert: {
          addition_demandee_le?: string | null
          appel_serveur_le?: string | null
          cloturee_le?: string | null
          cloturee_par?: string | null
          id?: string
          mis_a_jour_le?: string
          ouverte_le?: string
          paiement_mode?: string | null
          restaurant_id: string
          statut?: string
          table_numero: string
          validee_le?: string | null
        }
        Update: {
          addition_demandee_le?: string | null
          appel_serveur_le?: string | null
          cloturee_le?: string | null
          cloturee_par?: string | null
          id?: string
          mis_a_jour_le?: string
          ouverte_le?: string
          paiement_mode?: string | null
          restaurant_id?: string
          statut?: string
          table_numero?: string
          validee_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
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
      zone_alertes: {
        Row: {
          commune_id: string | null
          consentement_le: string
          contact: string
          contact_type: string
          cree_le: string
          id: string
          neighborhood_id: string | null
          notifie_le: string | null
          prefecture_id: string | null
          region_id: string | null
        }
        Insert: {
          commune_id?: string | null
          consentement_le?: string
          contact: string
          contact_type: string
          cree_le?: string
          id?: string
          neighborhood_id?: string | null
          notifie_le?: string | null
          prefecture_id?: string | null
          region_id?: string | null
        }
        Update: {
          commune_id?: string | null
          consentement_le?: string
          contact?: string
          contact_type?: string
          cree_le?: string
          id?: string
          neighborhood_id?: string | null
          notifie_le?: string | null
          prefecture_id?: string | null
          region_id?: string | null
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
          {
            foreignKeyName: "zone_alertes_prefecture_id_fkey"
            columns: ["prefecture_id"]
            isOneToOne: false
            referencedRelation: "prefectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_alertes_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ceder_numero: {
        Args: { p_conflit: string; p_motif: string; p_par: string }
        Returns: boolean
      }
      email_canonique: { Args: { p_email: string }; Returns: string }
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
      fn_attribuer_numero_appel: {
        Args: { p_restaurant: string }
        Returns: number
      }
      fn_compter_scan: {
        Args: { p_code: string; p_source: string }
        Returns: string
      }
      fn_creer_reservation_atomique: {
        Args: {
          p_client_user_id: string
          p_creneau: string
          p_nb_personnes: number
          p_nom: string
          p_note: string
          p_restaurant_id: string
          p_telephone: string
        }
        Returns: Json
      }
      fn_creer_restaurant_et_owner: {
        Args: { p_categorie_id: string; p_nom: string; p_quartier_id: string }
        Returns: string
      }
      fn_demo_etat: { Args: never; Returns: Json }
      fn_demo_supprimer: { Args: { p_motif: string }; Returns: Json }
      fn_demo_visibilite: { Args: { p_visible: boolean }; Returns: number }
      fn_effacer_positions_anciennes: {
        Args: { p_heures?: number }
        Returns: number
      }
      fn_emettre_document: {
        Args: { p_order_id: string; p_type: string }
        Returns: string
      }
      fn_est_admin_systeme: { Args: { p_roles?: string[] }; Returns: boolean }
      fn_est_ce_mon_livreur: { Args: { p_livreur: string }; Returns: boolean }
      fn_est_membre_restaurant: {
        Args: { p_restaurant_id: string }
        Returns: boolean
      }
      fn_frequentation_restaurants: {
        Args: { p_jours: number }
        Returns: {
          commandes: number
          restaurant_id: string
        }[]
      }
      fn_fusionner_quartiers: {
        Args: { p_cible: string; p_source: string }
        Returns: Json
      }
      fn_generer_code_court: { Args: never; Returns: string }
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
      fn_mon_restaurant_a_ce_livreur: {
        Args: { p_livreur: string }
        Returns: boolean
      }
      fn_motifs_restaurants: {
        Args: { p_ids: string[] }
        Returns: {
          motif_correction: string
          restaurant_id: string
          suspendu_motif: string
        }[]
      }
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
      fn_quarts_liberer: {
        Args: { p_operateur_id: string; p_restaurant_id: string }
        Returns: boolean
      }
      fn_quarts_prendre: {
        Args: {
          p_commande_id: string
          p_operateur_id: string
          p_restaurant_id: string
        }
        Returns: string
      }
      fn_questions_etat: { Args: never; Returns: Json }
      fn_reference_reservation: { Args: never; Returns: string }
      fn_reinitialisation_simuler: { Args: never; Returns: Json }
      fn_reinitialiser_application: {
        Args: { p_jeton: string; p_motif: string }
        Returns: Json
      }
      fn_repondre_proposition: {
        Args: { p_jeton: string; p_proposition_id: string; p_reponse: string }
        Returns: string
      }
      fn_reservation_pour_client: { Args: { p_id: string }; Returns: Json }
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
      fn_support_resoudre_echec_livraison: {
        Args: { p_issue: string; p_motif: string; p_order_id: string }
        Returns: undefined
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
      reserver_numero: {
        Args: { p_source: string; p_telephone: string; p_utilisateur: string }
        Returns: string
      }
      telephone_normalise: { Args: { p: string }; Returns: string }
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
