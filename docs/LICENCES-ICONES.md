# Licences des icônes et illustrations

Les motifs d'illustration (`src/lib/illustrations/icones.generated.ts`) sont extraits de deux bibliothèques libres. Ils sont figés dans le dépôt par `scripts/illustrations/extraire-icones.mjs` ; rien n'est chargé depuis Internet à l'exécution.

| Bibliothèque | Auteur | Licence | Source |
|---|---|---|---|
| Fluent Emoji Flat (motifs en couleur) | Microsoft Corporation | MIT | https://github.com/microsoft/fluentui-emoji |
| Tabler Icons (motifs « trait ») | Paweł Kuna et contributeurs | MIT | https://github.com/tabler/tabler-icons |

Texte de la licence MIT (identique pour les deux, aux détenteurs de droits près) :

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Les compositions (pastilles, assiettes, affiches, monogrammes) et les palettes sont propres à Speedfood.

Pour ajouter un motif : l'ajouter dans `MOTIFS` du script d'extraction et dans `src/lib/illustrations/motifs.ts`, relancer le script, puis `npm run test:unit` (un test vérifie que les deux listes restent identiques et que aucun dessin ne contient de contenu actif). N'ajouter que des icônes sous licence MIT, Apache 2.0, ISC ou équivalente ; les licences CC BY exigent une mention visible.
