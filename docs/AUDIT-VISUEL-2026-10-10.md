# Audit visuel — 10 octobre 2026

Périmètre : `/entrer` (page d'entrée unifiée client) sur la production, en 1600 px et en 375 px.

## Symptôme

Sur la capture fournie, la page paraissait tronquée : formulaire à droite, champs réduits à
des pilules, titre et description décalés à gauche, décorations flottantes, doublon de lien
« Parcourir les restaurants ».

## Cause racine : collision de nom de classe

Le CSS du projet est **global** (pas de CSS Modules). La page `/entrer` réutilisait le nom
`.choix-carte`, déjà défini dans `src/app/marche.css` pour les **cartes radio de la commande** :

```css
.choix-carte { display: flex; align-items: center; gap: 12px; min-height: 56px; … }
```

La règle s'appliquait donc aussi à la carte d'inscription : ses enfants (titre, description,
formulaire) étaient alignés **côte à côte** en `flex-direction: row` puis comprimés — d'où les
champs en pilules de 30 px de large. Confirmé en direct : `.choix-carte` computait
`display: flex` alors que la feuille `.card` ne définit aucun `display`.

## Défauts corrigés

1. **Collision `.choix-carte`** → classes dédiées `inscription-carte`, `inscription-choix`,
   `inscription-carte-titre`, `inscription-carte-resume`, `inscription-carte--inactive`.
2. **Classes sans CSS** : `.inscription-formulaire`, `.adresse-grille`, `.adresse-fieldset`
   n'existaient nulle part. La grille d'adresse est désormais un `grid` à deux colonnes
   (une seule sous 560 px) ; le `fieldset` perd sa bordure et son padding par défaut.
3. **Styles inline de mise en page** (`style={{ … }}`) supprimés au profit de la feuille CSS.
4. **Doublon** : « Pas envie de compte ? Parcourir les restaurants » apparaissait deux fois
   (prop `pied` de `PageCompte` + paragraphe dans la page). Le second est supprimé.
5. **Chevauchements de marges** : `.aide-champ` porte une marge haute négative
   (`margin: -8px 0 …`, `src/app/console.css`) qui faisait passer le texte légal **sous** le
   bouton et l'aide **sur** la légende « Adresse (Guide : Guinée) ». Surcharges ciblées ajoutées.
6. **Alignement** : `.page-compte-avec-panneau` passe de `align-items: center` à `start` — la
   colonne du formulaire est bien plus haute que le panneau, qui flottait au milieu d'un vide.
7. **Décor** : la tache rouge décorative (`.page-compte::after`, bas à droite) passait sous le
   lien de pied de page ; déplacée en bas à gauche.

## Vérifications

- `npx tsc --noEmit` : propre
- `npm run test:unit` : tout est bon (35 tests Chef IA, 19 tests complements)
- ESLint sur `src/app/entrer` : propre
- Aucune autre classe de la page n'entre en collision (croisement avec toutes les feuilles CSS)
- Contrôle visuel après déploiement : 1600 px et 375 px, aucun débordement

## Règle retenue

Avant d'écrire `className="…"`, vérifier qu'aucune feuille CSS existante ne définit déjà ce
nom. Un nom nouveau est préfixé par le contexte de la page (`inscription-…`, `commande-…`).
Règle inscrite dans `CLAUDE.md`.