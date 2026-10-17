# Surveillance de disponibilité

**Version :** 0.1, 17 octobre 2026

## Pourquoi

Le 15 octobre 2026, le site a répondu en erreur (Cloudflare 1102, 503/500) pendant quelques minutes et personne ne l'a su avant de tomber dessus par hasard. Le 11 octobre, la tâche d'export a échoué pendant six jours sans alerte. Cette surveillance répond à ces deux cas, au plus simple.

## Ce qu'elle fait

Le script `scripts/surveillance/verifier-disponibilite.ps1`, lancé toutes les 5 minutes :

1. envoie des requêtes **GET anonymes, en lecture seule** sur `/`, `/restaurants`, `/connexion` (attendu : 200) et `/restaurant` (attendu : redirection vers la connexion, ce qui prouve que le Worker exécute son code) ;
2. réessaie après 15 secondes pour les pages en échec ;
3. n'envoie une **notification Windows qu'au deuxième contrôle en échec de suite** (au moins 5 minutes), puis une notification de rétablissement ;
4. vérifie que le **dernier dossier d'export** de `%USERPROFILE%\speedfood-exports` a moins de 8 jours (une notification par jour au plus).

Journal et état : `%USERPROFILE%\speedfood-surveillance\` (hors du dépôt, 2000 dernières lignes). Aucun compte, aucun secret, aucun service externe, aucun coût.

## Limites (à connaître)

- **Ne surveille que quand le PC est allumé et connecté.** Une panne la nuit, PC éteint, ne sera pas vue. Ce n'est pas une astreinte.
- Elle voit « la page répond », pas « la commande fonctionne » : une panne de base de données qui laisse passer les pages publiques statiques peut ne pas être détectée.
- Une notification Windows peut être manquée (mode Ne pas déranger) : le journal fait foi.
- Pour une surveillance 24 h/24, il faudra un service externe (compte, éventuellement coût) : décision de la propriétaire, non prise.

## Installation (une fois)

Essai de la notification :

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/surveillance/verifier-disponibilite.ps1 -NotificationDEssai
```

Enregistrement de la tâche planifiée « Speedfood - surveillance » :

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/surveillance/installer-tache.ps1
```

Retrait : `Unregister-ScheduledTask -TaskName "Speedfood - surveillance" -Confirm:$false`.

## Vérification

- `Get-Content "$env:USERPROFILE\speedfood-surveillance\journal.log" -Tail 5` : des lignes `OK` toutes les 5 minutes.
- Testé le 17 octobre 2026 : réponse normale (`OK`, codes 200/200/200/307) ; hôte inexistant simulé : alerte au deuxième échec, une seule alerte d'export par jour.
