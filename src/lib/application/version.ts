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
  code: 50,
  nom: "2.46.2",
  notes: "« Mot de passe oublié » se demande maintenant dans l'application, sans passer par le navigateur. Si votre compte a été supprimé, suspendu ou si votre connexion a expiré, l'application vous l'explique au lieu de vous déconnecter en silence.",
  obligatoire: false,
  apkSha256: "a0643656ae91ed25f3e0ac9b5918c19b36287345dbf51edf08d55e8b8b74173b",
  apkTaille: 15717578,
};
