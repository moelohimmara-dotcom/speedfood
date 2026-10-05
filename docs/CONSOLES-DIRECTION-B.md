# Direction B étendue aux consoles (restaurateur et super administrateur)

5 octobre 2026. Les deux consoles partagent le cadre `.ad-app` : un seul fichier, `src/app/console-b.css` (chargé après `admin.css`, `console.css` et `console-resto.css`), leur donne la grammaire du site public. Aucune structure ni règle métier ne change, aucune couleur nouvelle.

- **Surfaces** : panneaux, tuiles, cartes de commande, volets, tableaux et fenêtres reçoivent le contour épais encre (2,5 px), l'ombre décalée et l'arrondi du site public.
- **Titres** : Bricolage Grotesque (comme le site public) à la place de Barlow condensé ; les chiffres des tuiles tiennent sur une ligne.
- **Boutons** : pastilles à contour épais et ombre décalée qui s'enfoncent au toucher ; l'action principale est en rouge foncé.
- **Champs, pastilles, filtres, onglets, alertes** : contour encre ; focus avec ombre décalée.
- **Barre latérale** (reste sombre) : le lien actif devient une pastille mangue ; en-tête mobile crème avec filet encre ; navigation basse du restaurateur avec pastille cerclée.
- **Photo d'abord** : le logo du restaurant remplace l'icône Speedfood dans l'en-tête de sa console quand il existe.
- **Mouvement** : entrée de page et cascade des cartes, tuiles et volets, soulèvement au survol, pastille des commandes à traiter qui pulse doucement. Tout est coupé par `prefers-reduced-motion`.

Vérifié sur 12 pages (restaurateur et super admin) à 1280 et 390 px : aucun débordement horizontal ; parcours paiement, documents et tables rejoués sans régression due à ce lot.
Non fait : essai sur vrais téléphones, revue visuelle indépendante, écrans de connexion et d'inscription (hors consoles).
