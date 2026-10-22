# Check-list : ce qu'une application de commande de repas (marketplace) doit avoir

Établie le 22 octobre 2026 à la demande de Malika, mise à jour le même jour après la livraison de la charpente de navigation (APK 2.14.0). Elle sert de référence pour décider quoi construire avant d'ouvrir au public. Chaque ligne indique l'état de l'**application Android (APK 2.13.0)**.

Légende : ✅ présent dans l'application · 🟡 partiel · 🌐 existe sur le site web seulement (à porter dans l'application) · ❌ n'existe nulle part · (P0) indispensable avant l'ouverture, (P1) à avoir dans les deux mois, (P2) plus tard.

---

## A. COTÉ CLIENT / UTILISATEUR

### A1. Structure de navigation (ce qui manque en premier)
Une application pro est organisée autour d'une **barre de navigation basse à 4 ou 5 onglets**, toujours visible. Proposition pour Speedfood :
| Onglet | Contenu |
|---|---|
| **Accueil** | Restaurants ouverts, catégories, promotions, relancer la dernière commande |
| **Recherche** | Recherche par restaurant, quartier, plat, filtres et tri |
| **Commandes** | Commande en cours (suivi) et historique |
| **Panier** | Contenu du panier, total, valider |
| **Compte** | Profil, adresses, favoris, paramètres, aide |

| Élément | État |
|---|---|
| Barre de navigation basse persistante (P0) | ✅ 2.14.0 (Accueil, Commandes, Panier, Compte ; pas d'onglet Recherche séparé, la recherche est dans l'Accueil) |
| Ouverture directe sur les restaurants, les autres espaces (restaurateur, livreur, équipe) rangés dans « Compte » (P0) | ✅ 2.14.0 |
| Menu / tiroir latéral ou page « Compte » listant toutes les rubriques (P0) | ✅ 2.14.0 (page Compte) |
| Écran d'accueil avec sections (promotions, ouverts maintenant, nouveautés, populaires) (P1) | ❌ |
| Icône de panier avec compteur sur tous les écrans (P0) | ✅ 2.14.0 (pastille de compteur sur l'onglet Panier) |
| Bouton « Commander à nouveau » (P1) | 🟡 (sur l'historique) |

### A2. Découverte et recherche
| Élément | État |
|---|---|
| Liste des restaurants avec statut ouvert / fermé (P0) | ✅ |
| Recherche texte (restaurant, quartier, plat) (P0) | ✅ |
| Filtres « Ouverts », « On peut commander » (P0) | ✅ |
| Photos de couverture et logos (P0) | 🟡 (affichage prêt, aucune photo en base) |
| Catégories de cuisine en puces (grillades, poulet, riz...) (P0) | ❌ |
| Tri : proximité, note, délai de livraison, frais (P1) | ❌ |
| Frais de livraison et délai estimé sur chaque carte (P1) | ❌ |
| Restaurants favoris (P1) | 🟡 2.15.0 (liste dans Compte ; ajout depuis la fiche à faire) |
| Recherches récentes et suggestions (P2) | ❌ |
| Carte des restaurants autour de soi (P2) | ❌ |
| Bandeaux de promotions et offres (P1) | ❌ |

### A3. Fiche restaurant et plats
| Élément | État |
|---|---|
| Nom, quartier, horaires, statut, moyens de paiement (P0) | ✅ |
| Photo de couverture et note moyenne (P0) | 🟡 (note oui, pas de photo) |
| Plats groupés par sections (P0) | ✅ |
| Photos des plats (P0) | 🟡 (le restaurateur peut les ajouter depuis 2.10.0, aucune en base) |
| Fiche détaillée d'un plat : suppléments à cocher, quantité, note pour la cuisine, allergènes (P0) | ❌ (ajout direct en un toucher, suppléments non choisissables) |
| Barre de panier fixe en bas (P0) | ✅ |
| Appeler le restaurant, partager le restaurant (P1) | ❌ |
| Avis des clients visibles (P1) | 🟡 2.15.0 (Mes avis ; avis des autres sur la fiche à faire) |

### A4. Panier et commande
| Élément | État |
|---|---|
| Panier : quantités, retrait d'un plat, total (P0) | ✅ |
| Panier conservé après fermeture de l'application (P0) | ✅ 2.16.0 (48 h) |
| Choix retrait ou livraison, frais et délai estimés (P0) | ✅ |
| Commande sans compte ou compte créé en deux gestes (P0) | ❌ (connexion obligatoire) |
| Adresse choisie sur carte avec position GPS, adresses enregistrées (P0) | ❌ (quartier + texte libre) |
| Consigne pour le livreur ou le restaurant (P1) | ❌ |
| Code promo, minimum de commande (P1) | ❌ |
| Commande programmée pour plus tard (P1) | ❌ |
| Récapitulatif avant envoi avec total tout compris (P0) | ✅ |

### A5. Paiement
| Élément | État |
|---|---|
| Paiement à la remise (espèces) (P0) | ✅ |
| Paiement mobile dans l'application : Orange Money, MTN, Chap Chap Pay (P0 pour la crédibilité) | ❌ (dépend du dossier KYC) |
| Reçu et facture téléchargeables (P1) | 🌐 |
| Remboursement suivi dans l'application (P2) | ❌ |

### A6. Suivi de commande
| Élément | État |
|---|---|
| Étapes (envoyée, acceptée, prête, terminée) (P0) | ✅ |
| Mise à jour automatique (P0) | ✅ |
| Réponse à une proposition du restaurant (changement de plat ou de prix) (P0) | ✅ |
| Notification poussée à chaque étape (P0) | 🟡 (envoi prêt côté serveur, pas d'écran de réglage ni d'ouverture directe de la commande) |
| Position du livreur sur une carte et heure d'arrivée estimée (P1) | ❌ |
| Appeler le restaurant ou le livreur depuis le suivi (P0) | ❌ |
| Annuler une commande tant qu'elle n'est pas acceptée (P1) | ❌ |
| Code de remise affiché au client (P0) | ✅ |
| Noter et commenter après livraison (P1) | 🌐 |
| Signaler un problème sur une commande (P1) | ❌ |

### A7. Compte et profil (absent de l'application)
| Élément | État |
|---|---|
| Inscription et connexion par e-mail (P0) | ✅ |
| Connexion avec Google (P1) | ✅ |
| Connexion par numéro de téléphone (code SMS) (P1, norme locale) | ❌ |
| Mot de passe oublié (P0) | ❌ dans l'application (🌐 sur le site) |
| Afficher/masquer le mot de passe (P0) | ❌ |
| Profil : pseudo, avatar, préférences de commande (P0) | ✅ 2.15.0 (le nom et le téléphone ne sont volontairement pas affichés : confidentialité) |
| Adresses enregistrées (domicile, travail) (P0) | 🟡 2.15.0 (carnet de 5 adresses avec principale ; pas encore proposé dans le formulaire de commande) |
| Historique des commandes avec filtres et détail (P0) | 🟡 (liste simple) |
| Favoris (P1) | 🟡 2.15.0 (liste et retrait ; le cœur sur la fiche d'un restaurant reste à ajouter) |
| Déconnexion visible (P0) | ✅ 2.14.0 (page Compte, avec confirmation) |
| Suppression du compte et des données (obligatoire, P0) | 🌐 |

### A8. Paramètres de l'application (absents)
| Élément | État |
|---|---|
| Notifications : par type (commande, promotions), son, silence nocturne (P0) | 🟡 2.14.0 (explication et « Tester les notifications » ; pas encore de réglage par type) |
| Langue (français, anglais, puis langues locales) (P1) | ❌ |
| Thème clair / sombre / automatique (P2) | ❌ |
| Taille du texte respectée (P0) | 🟡 (lisible à 1,6× avec quelques coupures) |
| Confidentialité : choix sur la position, les données, consentements (P0) | ❌ |
| Gérer les autorisations (position, notifications) avec explications (P0) | ❌ |
| Vider le cache, version de l'application, rechercher une mise à jour (P1) | ✅ 2.14.0 (version, « Vérifier les mises à jour », oublier les commandes de l'appareil) |
| Revoir la visite guidée (P2) | ✅ (Paramètres) |

### A9. Aide, confiance et légal
| Élément | État |
|---|---|
| Centre d'aide / questions fréquentes (P0) | ✅ 2.14.0 (6 questions + lien vers le centre d'aide du site) |
| Contacter le support : WhatsApp, appel, formulaire (P0) | 🟡 2.14.0 (WhatsApp et appel si le numéro est renseigné dans `/system/parametres`, sinon lien vers le centre d'aide) |
| Conditions d'utilisation, confidentialité, mentions légales accessibles depuis l'application (P0) | ✅ 2.14.0 (Compte et Aide ; ouvrent le site) |
| Page « À propos » (qui sommes-nous, version, contact) (P1) | ✅ 2.14.0 (dans Aide et contact) |
| Signaler un restaurant ou un avis (P2) | ❌ |

### A10. Notifications et messages
| Élément | État |
|---|---|
| Push de statut de commande (P0) | 🟡 |
| Centre de notifications dans l'application (historique des messages) (P1) | 🌐 |
| Promotions et nouveautés (avec consentement) (P2) | ❌ |
| Liens profonds : un lien WhatsApp ouvre le bon restaurant ou le bon suivi (P0) | ❌ |

### A11. Qualité et robustesse
| Élément | État |
|---|---|
| Fonctionnement en connexion lente, nouvel essai automatique (P0) | 🟡 |
| Cache hors ligne des restaurants et menus avec bandeau « hors ligne » (P0) | ✅ 2.16.0 (liste, fiches, menus, quartiers ; 7 jours ; bandeau sur la liste) |
| États vides illustrés et messages d'erreur utiles (P1) | 🟡 |
| Squelettes de chargement, tirer pour actualiser (P1) | ❌ |
| Accessibilité : lecteur d'écran, cibles tactiles, contrastes (P0) | 🟡 |
| Mesure des parcours (abandon de panier, écrans visités) respectueuse de la vie privée (P1) | ❌ (rapports de plantage seulement) |
| Mise à jour obligatoire en cas de faille (P1) | ✅ |

---

## B. COTÉ RESTAURATEUR (si un restaurant utilise lui-même l'application)
| Élément | État |
|---|---|
| Tableau de bord du jour : commandes, chiffre d'affaires, plats les plus vendus (P1) | ❌ |
| Commandes à traiter, en cours, historique (P0) | ✅ |
| Alerte sonore de nouvelle commande, application fermée comprise (P0) | ✅ |
| Accepter, refuser, proposer un changement, prête, remise (P0) | ✅ |
| Menu : plats, prix, suppléments, disponibilité, photos (P0) | ✅ |
| Horaires d'ouverture modifiables, pause temporaire, fermeture exceptionnelle (P0) | 🟡 (ouvert / prend des commandes seulement) |
| Reçus, factures, paiements à confirmer (P0) | ✅ |
| Historique, export, relevés de versements (P1) | ❌ |
| Paramètres : notifications, profil du restaurant, contacts (P1) | ❌ |

## C. COTÉ LIVREUR
| Élément | État |
|---|---|
| Mise en ligne / hors ligne, suivi de position (P0) | ✅ |
| Offres de course avec compte à rebours (P0) | ✅ |
| Étapes de la course, code de remise client (P0) | ✅ |
| Navigation vers le restaurant et le client (ouvrir une application de carte) (P0) | ❌ |
| Gains du jour et de la semaine, historique, versements (P0) | ❌ |
| Profil, documents, statut de la candidature (P1) | 🟡 |
| Signaler un incident, contacter l'équipe (P1) | ❌ |
| Paramètres (notifications, véhicule) (P1) | ❌ |

---

## D. COTÉ ÉQUIPE DE GESTION (administration)

### D1. Structure
| Élément | État |
|---|---|
| **Tableau de bord d'accueil** avec les chiffres du jour et les alertes (P0) | ✅ 2.14.0 (en tête du hub : à confirmer, courses sans livreur, livreurs en ligne, candidats, commandes du jour, propositions, restaurants publiés ; blocs selon le rôle) |
| **Menu de navigation** par famille (Commandes, Catalogue, Livraison, Finances, Clients, Contenu, Accès, Paramètres) (P0) | 🟡 (liste dans l'application, selon les droits) |
| **Paramètres de l'équipe** : profil, notifications d'équipe, sécurité du compte (double authentification, questions), déconnexion (P0) | 🟡 2.14.0 (rôle affiché, Paramètres, lien vers la sécurité du compte sur le site ; la double authentification elle-même reste sur le site) |
| Rôles et permissions clairs (super admin, support, opérations, éditeur) (P0) | ✅ |
| Journal d'audit consultable (P0) | 🌐 |

### D2. Tableau de bord (à afficher dès l'ouverture)
| Indicateur | État |
|---|---|
| Commandes du jour par statut, en attente de confirmation (P0) | ✅ 2.14.0 (actives du jour, en attente, propositions) |
| Courses sans livreur, livreurs en ligne (P0) | ✅ 2.14.0 |
| Chiffre d'affaires, panier moyen, taux d'annulation, délai moyen de préparation (P1) | 🌐 partiel |
| Établissements sans numéro à joindre, plats à reconfirmer (P0) | 🟡 2.14.0 (sans numéro oui ; plats à reconfirmer non) |
| Alertes : erreurs, paiements bloqués, avis négatifs (P1) | ❌ |
| Courbes sur 7 et 30 jours (P1) | 🌐 |

### D3. Opérations quotidiennes
| Élément | État |
|---|---|
| Poste de répartition avec alerte sonore et notification poussée (P0) | ✅ |
| Support des commandes : recherche, détail, statut motivé, coordonnées sur motif (P0) | ✅ |
| Livraisons : affecter, relancer, faire avancer, annuler (P0) | ✅ |
| Livreurs : candidatures, mise en ligne, suspension (P0) | ✅ |
| Quarts et affectation des opérateurs aux établissements (P1) | ❌ |
| Messages et modèles prêts à envoyer (WhatsApp) (P1) | ❌ |

### D4. Catalogue et partenaires
| Élément | État |
|---|---|
| Fiche établissement : identité, photo, horaires, zones, contact (P0) | 🌐 |
| Menu et disponibilité tenus par l'équipe (P0) | 🌐 |
| Demandes de partenariat, référencement, liste d'attente (P0) | 🌐 |
| Publication, suspension, fermeture d'un établissement (P0) | 🌐 |
| Rappel automatique de reconfirmation des plats avant le service (P0) | ❌ |
| Contrats et commissions par établissement (P1) | ❌ |
| Journal de contacts avec chaque établissement (P2) | ❌ |

### D5. Finances
| Élément | État |
|---|---|
| Paiements, confirmation, reçus (P0) | 🌐 |
| Relevés par établissement et par période, commissions, versements, export (P0 avant le paiement en ligne) | ❌ |
| Rapprochement avec le prestataire de paiement (P1) | ❌ |
| Paie des livreurs (P1) | ❌ |
| Remboursements et litiges (P1) | ❌ |

### D6. Clients et relation
| Élément | État |
|---|---|
| Modération des avis (P0) | 🌐 |
| Comptes clients, suppression RGPD (P0) | 🌐 |
| Support client avec fil de conversation par commande (P1) | ❌ |
| Notifications aux clients (campagnes) (P2) | ❌ |
| Codes promo et campagnes (P1) | ❌ |

### D7. Contenu et marque
| Élément | État |
|---|---|
| Pages, blocs, bannières, médias, textes, design (P0) | 🌐 |
| Gestion des catégories et des mises en avant (P0) | 🌐 |

### D8. Plateforme et sécurité
| Élément | État |
|---|---|
| Interrupteurs de fonctionnalités et paramètres globaux (P0) | 🌐 |
| Mises à jour de l'application et annonce poussée (P0) | 🌐 |
| Supervision : alertes d'erreurs, état des services (Supabase, Firebase, paiement), tenue en charge (P1) | ❌ |
| Sauvegarde et restauration testées (P1) | 🟡 |
| Verrou biométrique pour l'espace équipe (données de clients) (P1) | ❌ |
| Double authentification dans l'application (aujourd'hui renvoie vers le site) (P1) | ❌ |

---

## E. Ce qu'il faut construire en premier (ordre proposé)
1. ~~**Charpente de navigation**~~ **(fait en 2.14.0)** : barre basse (Accueil, Recherche, Commandes, Panier, Compte), page **Compte** avec menu complet, **Paramètres**, déconnexion, aide, légal, à propos. Même principe côté équipe : **tableau de bord** en page d'accueil de l'espace équipe, puis menu par familles, puis paramètres de l'équipe.
2. **Compte client** dans l'application : ~~profil, adresses, favoris, avis~~ **(faits en 2.15.0)** ; reste : mot de passe oublié, suppression du compte, cœur favori sur la fiche, adresses dans le formulaire de commande.
3. **Les quatre correctifs de l'audit** : ~~panier conservé, cache hors ligne~~ **(faits en 2.16.0)** ; reste : catalogue rempli (contenu), commande sans friction (décision sur la commande invité).
4. **Tableau de bord de l'équipe** (chiffres du jour et alertes) dans l'application.
5. **Suivi avec carte et appels**, notifications réglables, liens profonds.
6. **Finances** (relevés, commissions, versements) avant le paiement en ligne.
