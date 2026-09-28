-- Personnalisation de marque par restaurant (couleur d'accent). Palette
-- fermée pré-validée en contraste AA (src/lib/design/paletteMarque.ts) :
-- cette colonne stocke un hex de cette palette, jamais une saisie libre.
-- Nullable, pas de défaut : absence = style neutre actuel, aucune régression
-- pour les restaurants qui ne personnalisent rien. Comme horaires/consignes/
-- photo_url, librement modifiable par le restaurateur (pas une colonne de
-- modération protégée par fn_proteger_colonnes_restaurant).
alter table restaurants add column if not exists couleur_accent text;
