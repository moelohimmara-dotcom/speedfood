/**
 * Version de l'application Android publiée sur `/installer` : SOURCE UNIQUE. La page de téléchargement, la route publique `/api/v1/version` (que l'application interroge
 * pour savoir si une mise à jour existe) et l'annonce aux applications installées lisent tous cette valeur.
 *
 * À modifier à chaque publication d'une APK, EN MÊME TEMPS que `versionCode` et `versionName` de `mobile/androidApp/build.gradle.kts` (un test unitaire vérifie
 * qu'ils sont identiques) et que `public/speedfood.apk` + `public/speedfood.apk.sha256`. Procédure : `docs/APPLICATION-ANDROID.md`.
 */
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
}

export const VERSION_APPLICATION: VersionApplication = {
  code: 30,
  nom: "2.28.0",
  notes: "Équipe Speedfood : partenariats et liste d'attente dans l'application (suivi des demandes, zones marquées comme prévenues).",
  obligatoire: false,
  apkSha256: "3b02881292403ff878bd9abb2bc80a31229cc670576ec1aa01b2444e6c8351ec",
  apkTaille: 14887966,
};
