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
}

export const VERSION_APPLICATION: VersionApplication = {
  code: 17,
  nom: "2.15.0",
  notes: "Espace client : profil (pseudo, avatar, préférences), adresses, favoris et avis ; navigation par onglets, Paramètres, Aide, tableau de bord de l'équipe.",
  obligatoire: false,
};
