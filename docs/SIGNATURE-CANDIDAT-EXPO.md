> **Complément de passation — 8 novembre 2026.** Les exemples de candidat et artefacts ci-dessous sont historiques, peuvent être expirés et ne prouvent pas la parité. Avant signature/remplacement, suivre les portes fonctionnelles, appareils et paiement de la passation actuelle. Un catalogue visible ne suffit pas. Aucun remplacement de production autorisé par cette note.
>
> Point d’entrée actuel : [PASSATION-CHANTIER-SPEEDFOOD-APP.md](PASSATION-CHANTIER-SPEEDFOOD-APP.md). Les sections suivantes conservent leur chronologie ; elles ne constituent pas des autorisations nouvelles.

# Signer le candidat Expo (à faire par Malika)

Le candidat compilé par GitHub (`candidat-android-NON-SIGNE-PRODUCTION`) n'est **pas signé**. Pour qu'Android accepte de l'installer par-dessus l'application actuelle, il faut le signer avec **la même clé** (`C:\Users\moelo\speedfood-signature\speedfood.keystore`, alias `speedfood`). Aucun agent ne lit cette clé ni son mot de passe : vous seule tapez le mot de passe.

## 1. Télécharger l'APK non signée
1. Ouvrir la page GitHub du run réussi de « Android Expo (candidat de remplacement, NON publié) », commit `0347cfb`.
2. Section « Artifacts » en bas : télécharger `candidat-android-NON-SIGNE-PRODUCTION` (un zip, conservé 7 jours).
3. Extraire le zip dans un dossier neuf, par exemple `C:\Users\moelo\Downloads\candidat-expo`.

## 2. Signer (une seule commande)
Dans PowerShell, en remplaçant le nom du fichier `.apk` extrait :

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\moelo\dev\speedfood\apps\mobile\scripts\signer-candidat.ps1 -Apk C:\Users\moelo\Downloads\candidat-expo\<fichier>.apk -Sortie C:\Users\moelo\Downloads\candidat-expo\speedfood-candidat-signe.apk
```

Le script aligne l'APK (zipalign), demande le mot de passe en **saisie masquée**, signe, puis vérifie l'empreinte du certificat. Si elle diffère de celle de l'application actuelle (`e81f0ac1…1f7c`), il **supprime** l'APK signée et s'arrête : c'est qu'une mauvaise clé a été utilisée.

Ne jamais générer une nouvelle clé : une autre clé empêcherait toute mise à jour par-dessus les installations existantes.

## 3. Contrôle de remplacement (peut être lancé par l'agent, sans clé)
Depuis `apps/mobile`, avec `ANDROID_HOME` et `JAVA_HOME` définis :

```bash
node --experimental-strip-types scripts/controler-remplacement-apk.mjs C:/Users/moelo/Downloads/candidat-expo/speedfood-candidat-signe.apk
```

Attendu : « Compatibilité technique vérifiée, code 0 ». Il refuse une mauvaise identité, une autre signature, une version non croissante, un APK de débogage, une hausse du minimum Android ou un recul de la cible.

## 4. Essai d'installation par-dessus l'ancienne
Sur l'émulateur ou un téléphone de test où l'application actuelle (code 51) est installée : `adb install -r speedfood-candidat-signe.apk`. Android doit accepter sans désinstaller. Vérifier ensuite que l'application s'ouvre et que le catalogue s'affiche.

## 5. Ce qui reste interdit sans votre feu vert
Remplacer `apps/web/public/speedfood.apk`, mettre à jour `VERSION_APPLICATION` et déployer le site.
