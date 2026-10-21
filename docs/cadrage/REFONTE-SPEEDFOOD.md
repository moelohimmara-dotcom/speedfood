# Refonte de Speedfood : plan de restructuration (21 octobre 2026)

Suite de `VISION-REVENTE.md` (ADR-020, proposée) et de l'étude `ETUDE-CONCURRENTS-OSINT.md`. **Statut : proposition de l'ingénieur à valider par Malika. Aucun code n'est changé par ce document.**

## 1. Correction de cap : « intermédiaire qui encaisse et livre », pas « revendeur »
L'étude montre que Madifood, la référence citée, **n'est pas un revendeur** : ses conditions disent « intermédiaire » et rendent les restaurants **seuls responsables** de la qualité, de l'hygiène et des prix, tout en gardant l'argent et la livraison. Deux postures possibles :

| | **A. Revendeur** (vendeur de plein droit) | **B. Intermédiaire qui encaisse et livre** (posture Madifood) |
|---|---|---|
| Qui vend au client ? | Speedfood | Le restaurant, par l'intermédiaire de Speedfood |
| Responsabilité du plat | Speedfood | Le restaurant |
| Argent | Speedfood le reçoit comme sa recette | Speedfood l'encaisse **pour le compte** du restaurant, retient sa part, reverse le reste |
| Risque juridique | Plus élevé (produit, fiscalité, hygiène) | Plus faible, mais l'**encaissement pour compte de tiers** peut exiger une autorisation : à faire valider |
| Ce que le client perçoit | Un seul vendeur | Un seul interlocuteur (service, livraison, remboursement) |

**Recommandation : la posture B**, qui donne à Malika ce qu'elle veut (le restaurant n'a plus de page à gérer, Speedfood tient le catalogue, encaisse et livre) sans en porter les risques les plus lourds. Le texte des conditions doit le dire clairement ; la décision finale revient à un juriste guinéen.

## 2. Positionnement proposé
« **Le repas dont l'heure de confirmation est écrite.** » Là où les autres promettent « moins de 45 min », Speedfood promet une chose vérifiable : chaque plat dit depuis quand le restaurant l'a confirmé, la livraison se suit sur une carte, et le client ne paie jamais un plat que l'on n'a pas confirmé.

## 3. Ce que l'on reprend, et ce que l'on fait mieux
**Repris des acteurs établis** (éprouvé) : restaurants inscrits par l'équipe sur formulaire, rappel sous 48 h ; paiement à la commande ; protocole « prix modifié » et « réorientation » ; coursiers payés à la livraison (Madifood : virement hebdomadaire ; Speedfood : virement journalier, décision du 21/10) ; téléconseillers ; remboursements en crédit (voir réserve ci-dessous) ; extension future aux épiceries et supermarchés.

**Où Speedfood se distingue** (déjà construit, ou facile) :
1. **Disponibilité horodatée** et alternatives proposées *avant* le paiement.
2. **Suivi GPS du livreur** (absent chez Madifood, qui l'écrit dans ses conditions).
3. **Commande sans compte** et **par WhatsApp** (pas de téléchargement ni d'inscription obligatoire), là où Madifood impose Google ou Apple.
4. **Commission publiée** en trois paliers lisibles (les grandes plateformes en ont ; les acteurs guinéens aucune) : un restaurateur choisit en connaissance de cause.
5. **Livreurs bien traités**, dans l'esprit de Chowdeck : paie au kilomètre, primes simples, **commande envoyée au livreur le plus proche**, virement journalier.
6. **Densité avant étendue** : commencer dans une à deux communes (le pilote couvre déjà Kaloum, Dixinn, Ratoma, Matam), pas toute la ville.
7. **Zéro stock** : Speedfood ne détient jamais de marchandise (la leçon de Getir et Flink).
8. **Communauté** : la page partenaires (investir, soutenir, apporter des moyens, contribuer) existe déjà.

## 4. Idées créatives à tester (une par pilote, jamais ensemble)
- **Le « plat du jour confirmé »** : un créneau quotidien où le restaurant confirme ses 3 plats ; Speedfood les met en tête, avec l'heure. Crée l'habitude et réduit les ruptures.
- **Livraison groupée par quartier** : plusieurs commandes d'un même restaurant ou d'une même rue partent ensemble à heure fixe (midi, 19 h), frais de livraison réduits ; abaisse le coût livreur par commande.
- **Point de retrait de quartier** : l'épicerie ou le kiosque du coin sert de relais ; le client récupère à pied, sans frais de livraison.
- **Mobile money d'abord** : remise symbolique en paiement numérique, plafond d'espèces pour les nouveaux comptes, acompte pour les grosses commandes ; vise la réduction des livraisons échouées en espèces.
- **Famille et entreprises** : abonnement de repas pour bureaux et familles de la diaspora qui commandent pour leurs proches à Conakry (paiement depuis l'étranger).
- **Réserve juridique sur le « portefeuille »** : créditer les remboursements dans un portefeuille ressemble à de la monnaie électronique, qui peut être réglementée. Commencer par des **avoirs** (bons d'achat) et faire valider.

## 5. Ce que dit la simulation (hypothèses, `scripts/simulation-economie-revente.mjs`)
Hypothèses de travail (panier 60 000 GNF, **commission 5 %** décidée le 21/10, livraison facturée 8 000, service 2 000, livreur payé 6 000, 60 % d'espèces, 10 % d'échecs en espèces, virements quotidiens) : marge d'environ **−900 GNF par commande**, donc **légèrement négative** ; à 15 % elle serait de +5 200. Pour que 5 % tienne, les frais de livraison (par exemple 11 000) ou de service (4 000) doivent porter la marge. Ce qui fait le plus bouger la marge, du plus au moins fort :
1. **La commission** (5 → 15 % : +6 000 GNF par commande) et **le volume** (frais fixes par commande de 3 000 à 8 000 : −5 000) ;
2. **Les frais de livraison facturés** (±3 000 GNF) et **les frais de service** (+2 000 si portés à 4 000) ;
3. **Les échecs en espèces** (de 10 à 20 % : −2 200) et le **coût du livreur** (+2 000 : −2 100) ;
4. **La taille du panier** compte **peu à 5 %** : la commission étant faible, un panier plus gros ne change presque rien ; la marge vient des frais de livraison et de service, pas du panier ;
5. La **part d'espèces elle-même** pèse peu (±550) : ce qui coûte, ce sont les *échecs*, pas l'espèce.
**À retenir :** (a) ne rien promettre avant d'avoir du volume dans une zone dense ; (b) **facturer la livraison selon la distance** et prévoir un supplément de petite commande (à 5 %, un gros panier ne rapporte presque pas plus qu'un petit : la marge vient des frais, pas du panier) ; (c) mesurer le taux d'échec par moyen de paiement dès le premier restaurant-test. Aucun de ces chiffres n'est mesuré : ils sont à remplacer par les mesures du pilote.

## 6. Architecture produit cible
| Produit | Rôle | État |
|---|---|---|
| **Application cliente** (native, ADR-019) | Découvrir, commander, payer, suivre | N0 fait, N1 à N2 à faire |
| **Application livreur** (native) | Missions, statuts, position, encaissement espèces, gains | module serveur existant ; application à faire (N4) |
| **Poste de répartition** (administration web) | Confirmer les commandes aux restaurants, répartir, joindre le client, réorienter | à construire sur l'administration existante |
| **Catalogue géré par l'équipe** (administration web) | Restaurants, plats, prix d'achat et de vente, photos, disponibilité | à construire (`mode_vente`) |
| **Finance** (administration web) | Encaissements, règlement des restaurants, rapprochement des espèces, remboursements | registre comptable existant ; écrans à construire |
| **Restaurant** (WhatsApp, appel ou tablette simple) | Recevoir, confirmer « prête », marquer un plat épuisé | console existante réduite ; relais WhatsApp à étudier |
| **Site public** | Vitrine, partage de liens, commande sans compte, page partenaires | existe ; textes à réécrire au lancement |

## 7. Séquence de réalisation
1. **S0 : décisions** (prix, avance de trésorerie, flotte, société) et dossier juridique lancé (posture A ou B, encaissement pour compte de tiers, conditions générales de vente, contrat restaurant, statut des livreurs).
2. **S1 : `mode_vente` et catalogue géré par l'équipe**, demande de référencement à la place de l'inscription libre (même schéma que les demandes de partenariat).
3. **S2 : poste de répartition** : file des commandes à confirmer, confirmation au restaurant (appel ou WhatsApp), réorientation, alertes sonores.
4. **S3 : application livreur** et encaissement des espèces avec rapprochement quotidien.
5. **S4 : règlement des restaurants** et tableau de bord financier.
6. **S5 : application cliente complète** (N1, N2) branchée sur ce qui précède.
7. **S6 : paiement mobile money** (Chap Chap : KYC, accord écrit, avis juridique).
8. **S7 : textes publics** réécrits avec l'avis juridique.
**Premier restaurant-test :** un seul, de confiance, contrat écrit simple, dans une commune dense ; on mesure avant de promettre.

## 8. Ce qui est décidé et ce qui ne l'est pas
- **Décidé par Malika (21/10) :** la posture intermédiaire qui encaisse et livre (`DECISIONS-MODELE.md`) ; Speedfood inscrit les restaurants, vend ou encaisse et livre ; application native Kotlin pour Android et iPhone.
- **Tranché par l'ingénieur sur mandat, modifiable :** prix en parité plus frais affichés, règlement hebdomadaire, livreurs indépendants (`DECISIONS-MODELE.md`). **Proposé, non validé :** la commission en trois paliers publiés, le « plat du jour confirmé », la livraison groupée.
- **Bloquant avant tout lancement :** avis juridique et comptable guinéens ; existence légale de la société ; compte marchand mobile money.
