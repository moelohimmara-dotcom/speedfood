# Fondations des consoles (refonte, phase 1)

Créées le 15 octobre 2026. Briques communes à la console d'administration (`/system`) et à celle du restaurateur (`/restaurant`).

## Règles
- Classes `sx-*` uniquement, dans `src/app/console-sx.css` : aucune dépendance aux règles globales de `.ad-app` (qui restyle `.btn`, `.card`, `.field`, les cases à cocher à 22 px).
- Jetons de `globals.css` seulement, cibles de 44 px, focus rouge foncé, rien porté par la couleur seule.
- Un `<dialog>` perd son centrage avec `* { margin: 0 }` : `margin: auto` est posé explicitement.
- La logique pure vit dans `src/lib/console/` et est testée (`scripts/tests/console.test.mts`).

## Briques (`src/components/console/`)
- `ConsoleProviders` : monté dans `system/layout.tsx` et `restaurant/(console)/layout.tsx`.
  - `useConfirmation()` : `await confirmer({ titre, message?, libelleAction, danger?, niveau?, libelleMotif?, phrase? })` → `{ confirme, motif? }`.
    Niveaux : `simple` ; `motif` (5 à 300 caractères) ; `saisie` (recopier une phrase). Le focus initial est sur « Annuler », Échap = refus, une seule demande à la fois. Confort d'interface : le serveur revalide toujours.
  - `useNotification()` : `notifier("succes" | "erreur" | "info", message)`. 3 au maximum, une erreur reste plus longtemps et est annoncée (`role="alert"`).
- `Tiroir` : panneau latéral (`<dialog>`), plein écran sur téléphone.
- `FilAriane` : fil d'Ariane (`aria-current="page"` sur le dernier élément).

## Premiers usages
- Taxonomie : suppression avec confirmation nommée + notification ; recherche et lots de 30.
- Éditeur de design : « Tout rétablir » en niveau `saisie` (phrase `RÉTABLIR`).

## À migrer (phase 2)
Les autres `window.confirm` / `confirm(` des consoles, les messages de retour locaux (`useActionState`) vers `notifier`, les formulaires d'édition vers `Tiroir`, `FilAriane` sur les pages de détail.
