# Design System — Speedfood

**Statut :** verrouillé pour le pilote. Issu du prototype (`speedfood/prototype/`) et de la landing (`speedfood/landing/`), déjà testés et affinés (contraste AA, responsive, accessibilité clavier). Le bloc 1 (socle Next.js) et le bloc 3 (système UI) doivent partir de ces valeurs, pas les redéfinir.

## Palette

| Rôle | Variable | Valeur |
|---|---|---|
| Rouge (marque, actions) | `--rouge` | `#D9362B` |
| Rouge foncé (survol) | `--rouge-fonce` | `#B82A20` |
| Orange (accent) | `--orange` | `#FF7A1A` |
| Mangue (accent secondaire) | `--mangue` | `#FFC247` |
| Fond crème | `--creme` | `#FFF6ED` |
| Surface (cartes) | `--surface` | `#FFFEFC` |
| Encre (texte principal) | `--encre` | `#2B211D` |
| Secondaire (texte atténué) | `--secondaire` | `#75695F` |
| Bordure | `--bordure` | `#E9DCD2` |
| Succès | `--succes` / `--succes-fond` | `#2E7D32` / `#E7F4E8` |
| Danger | `--danger` / `--danger-fond` | `#C62828` / `#FBEAEA` |

**Règle de contraste :** `--secondaire` a été assombri le 27/09/2026 depuis `#80736C` (qui donnait 4.29:1 sur fond crème, sous la norme AA de 4.5:1). La valeur actuelle donne 4.99:1. Ne pas revenir à l'ancienne valeur sans revalider le contraste.

**Couleurs par catégorie de restaurant** (aplats pleins, jamais de dégradé) :
- Riz & sauces → `--rouge`
- Grillades → `--orange`
- Fast-food → `--mangue`
- Petit-déjeuner → `--encre`

## Dégradé — usage restreint

Un seul dégradé existe dans tout le système : `--gradient-marque` (`linear-gradient(135deg, #FF7A1A 0%, #D9362B 60%)`). Il est réservé **exclusivement** à l'action principale de chaque écran (bouton principal, barre de panier flottante). Toute autre surface (logos, avatars, icônes décoratives, cartes) utilise un aplat de couleur pleine. C'est un choix délibéré : le dégradé appliqué partout donne un rendu générique ("template IA"); réservé à un seul geste, il le fait ressortir.

## Typographie

- **Barlow Condensed**, graisses 700/800 : marque, titres, gros chiffres (totaux, statistiques).
- **Manrope**, graisses 400 à 800 : interface, corps de texte, formulaires, boutons.
- Chargées via Google Fonts. En production, prévoir une solution de repli auto-hébergée si la dépendance à un fournisseur externe pose un risque de coût data pour les utilisateurs à Conakry (voir note performance ci-dessous).

## Espacement, rayons, ombres

Échelle en base 4px (`--space-1` = 4px … `--space-14` = 56px). Rayons : `--radius-sm` (8px), `--radius-md` (14px), `--radius-lg` (20px), `--radius-pill` (999px, réservé aux boutons, chips et barres d'onglets — jamais à un conteneur dont le contenu peut passer à la ligne, sous peine de déformation). Ombres : `--shadow-sm/md/lg` + `--shadow-focus` (anneau de focus clavier, `0 0 0 3px rgba(255,122,26,.35)`).

## Icônes

SVG au trait, grille 24×24, épaisseur 1,75–2px, coins arrondis (`stroke-linecap="round"`). **Aucun emoji comme repère d'interface.** Les icônes pleines (ex. cœur favori actif) utilisent `style="fill:currentColor;stroke:none"` en inline — jamais les attributs de présentation `fill`/`stroke` seuls, qui sont écrasés par la règle CSS générique `svg.icon { fill:none; stroke:currentColor }`.

## Composants clés déjà validés

- **Bouton** (`.btn`) : jamais souligné (`text-decoration:none` sur la classe de base), anneau de focus visible obligatoire (`:focus-visible`), variante `primary` (dégradé), `secondary` (bordure), `danger`.
- **Champ `<select>`** : flèche native masquée (`appearance:none`), remplacée par un chevron SVG à 16px du bord, coins en pilule pour matcher les barres d'onglets adjacentes.
- **Barre d'onglets** (`.console-tabs` / bottom-tabs) : ne jamais autoriser `flex-wrap: wrap` sur un conteneur à coins en pilule — ça déforme la pilule si le contenu passe à la ligne. Préférer le rétrécissement du texte/padding pour tenir sur une ligne.
- **Carte avec badge de statut** : avatar coloré par catégorie + nom + méta, badge de statut à droite, total mis en évidence en bas (voir `.my-order-card`, `.order-card`).

## Accessibilité — acquis à ne pas perdre

- Contraste texte AA vérifié sur fond crème et surface.
- Focus clavier visible sur tous les éléments interactifs (boutons, liens, champs, cases à cocher personnalisées).
- `aria-pressed` sur les bascules à deux états (ex. client/restaurateur).
- Cibles tactiles ≥44px sur les actions fréquentes.
- `prefers-reduced-motion` respecté (animations désactivées si demandé).

## Note performance (à traiter au bloc 1 ou 9)

Google Fonts en CDN implique une requête réseau externe à chaque visite. Sur un marché où les données mobiles ont un coût réel (Conakry), évaluer l'auto-hébergement des polices ou un sous-ensemble de caractères réduit.
