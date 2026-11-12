/**
 * Version de l'application Android publiée sur `/installer` : SOURCE UNIQUE. La page de téléchargement, la route publique `/api/v1/version` (que l'application interroge
 * pour savoir si une mise à jour existe) et l'annonce aux applications installées lisent tous cette valeur.
 *
 * À modifier à chaque publication d'une APK, EN MÊME TEMPS que `versionCode` et `versionName` de `mobile/androidApp/build.gradle.kts` (un test unitaire vérifie
 * qu'ils sont identiques) et que `public/speedfood.apk` + `public/speedfood.apk.sha256`. Procédure : `docs/APPLICATION-ANDROID.md`.
 */
/**
 * Version de la NOUVELLE appli Speedfood (Expo, `com.speedfood.mobile`), publiée à côté de l'ancienne sans jamais la modifier.
 * Canal séparé parce que l'ancienne appli (Kotlin, `com.speedfood.app`, clé de signature perdue) lit les champs de premier niveau et ne peut pas installer
 * une appli d'un autre identifiant : sa session d'installation est liée à son propre identifiant. Plan : `docs/plans/2026-11-11-nouvelle-identite-android.md`.
 * Seule l'appli Expo lit ce bloc ; l'ancienne ignore les champs inconnus (client Ktor en `ignoreUnknownKeys`).
 */
export interface VersionMobile {
  /** Numéro de version Android de la nouvelle appli : strictement supérieur à celui de l'ancienne (51), il démarre à 100. */
  code: number;
  nom: string;
  notes: string;
  obligatoire: boolean;
  /** Empreinte SHA-256 de l'APK de la nouvelle appli (fichier `public/speedfood-mobile*.apk`), jamais celle de `speedfood.apk`. */
  apkSha256: string;
  apkTaille: number;
  /** Chemin public de l'APK de la nouvelle appli sur le site : une route qui REDIRIGE vers `apkUrl`. Jamais `/speedfood.apk` : c'est le fichier que l'ancienne appli télécharge. */
  apkChemin: string;
  /** Adresse HTTPS de l'APK, hébergée sur R2 (Cloudflare refuse plus de 25 Mio par fichier statique dans le Worker du site). */
  apkUrl: string;
}

export interface VersionApplication {
  /** Numéro de version Android (entier qui augmente à chaque publication) : c'est lui que l'application compare à son propre numéro. */
  code: number;
  /** Nom affiché (par exemple « 2.8.0 »). */
  nom: string;
  /** Ce qui change, en une ou deux phrases pour la personne qui met à jour. */
  notes: string;
  /** Vrai : l'ancienne version ne doit plus servir (correctif de sécurité) ; l'application ne propose alors pas « Plus tard ». */
  obligatoire: boolean;
  /** Empreinte SHA-256 de `public/speedfood.apk` : l'application la compare avant d'installer sa mise à jour. Écrite par `scripts/empreinte-apk.mjs`. */
  apkSha256: string;
  /** Taille de l'APK en octets (affichée pendant le téléchargement). */
  apkTaille: number;
  /** Nouvelle appli (Expo) : absent tant qu'elle n'est pas publiée. Ne change rien pour l'ancienne appli. */
  mobile?: VersionMobile;
}

export const VERSION_APPLICATION: VersionApplication = {
  code: 51,
  nom: "2.47.0",
  notes: "Suivi de commande plus complet : annulez votre commande tant que le restaurant n'a pas répondu, voyez l'heure à laquelle elle sera prête, joignez l'assistance en un geste, et retrouvez le statut de toutes vos commandes dans la liste.",
  obligatoire: false,
  apkSha256: "d44b55a85bc48c0060ec8fd26e894d3823ffd2125bc7f4a3dbaa2b7135070e9c",
  apkTaille: 15733962,
  // Nouvelle appli Speedfood (Expo, com.speedfood.mobile), signée avec la nouvelle clé (certificat SHA-256 256b6efe…06b5). Fichier DISTINCT de speedfood.apk :
  // l'ancienne appli ne peut pas installer cette appli (autre identifiant) et ne lit pas ce bloc. APK hébergée sur R2 (62 Mio > 25 Mio autorisés dans le Worker du site).
  // Plan : docs/plans/2026-11-11-nouvelle-identite-android.md.
  mobile: {
    code: 100,
    nom: "3.0.0",
    notes: "Nouvelle application Speedfood : mêmes comptes, mêmes restaurants. Installez-la à côté de l'ancienne, puis supprimez l'ancienne quand vous êtes prêt.",
    obligatoire: false,
    apkSha256: "8241fd65fd42932cc107626c2632619c79c035a8eaeefa23a0d914f7b7e956ce",
    apkTaille: 65136738,
    apkChemin: "/speedfood-mobile.apk",
    apkUrl: "https://pub-e89d009459984641aa1fe14982503bf4.r2.dev/speedfood-mobile-3.0.0.apk",
  },
};
