# Demo — landing page et prototype de démonstration

Matériel de validation produit, **statique et sans backend**. À ne pas confondre
avec l'application réelle (le reste de ce dépôt) :

| Fichier | Rôle | Projet Cloudflare |
|---|---|---|
| `landing/` | Page de présentation publique (vision, argument restaurateurs, formulaire démo stocké en local) | Pages `speedfood` → https://speedfood.pages.dev |
| `prototype/` | Démo cliquable (portail client + console restaurant) avec données fictives | Pages `speedfood` → https://speedfood.pages.dev/prototype/index.html |

## Usage

Ouvrir `landing/index.html` ou `prototype/index.html` dans un navigateur.
Aucune installation, aucune donnée réelle : les restaurants, plats, prix et
quartiers sont fictifs et servent de référence visuelle.

Ces fichiers ont servi de base au design system (`docs/cadrage/DESIGN-SYSTEM.md`)
et aux briefs écrans (`docs/cadrage/FRONTEND-DESIGN-BRIEF.md`) — ils restent utiles
comme référence, mais **ne pas y ajouter de fonctionnalités** : tout le
développement se fait dans le vrai système (`src/`).

## Redéploiement de la démo

Le projet Pages `speedfood` est déployé depuis un dossier `dist/` construit à
partir de ces sources (landing à la racine, prototype sous `prototype/`, liens
relatifs ajustés) :

```bash
wrangler pages deploy dist --project-name speedfood
```

## Provenance

Ces sources venaient du dépôt documentaire d'origine (OneDrive) ; elles sont
désormais centralisées ici depuis le 27 septembre 2026 (protocole de
collaboration, source de vérité unique).
