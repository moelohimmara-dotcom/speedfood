import { VERSION_APPLICATION, type VersionApplication } from "./version";
import { adresseApkMobile } from "./apk-mobile";

/**
 * Ce que la page `/installer` affiche pour la NOUVELLE appli (com.speedfood.mobile, version d'essai), ou `null` : la section n'apparaît alors pas.
 * Elle n'apparaît que si le téléchargement fonctionne (adresse de l'APK acceptée par `adresseApkMobile`) et que le lien est une route du site, jamais
 * le fichier de l'ancienne appli ni une adresse externe : un visiteur ne doit jamais voir un bouton qui mène à une erreur.
 */
export interface PresentationApkMobile {
  nom: string;
  tailleMo: number;
  chemin: string;
  sha256: string;
}

export function presentationApkMobile(version: VersionApplication = VERSION_APPLICATION): PresentationApkMobile | null {
  const m = version.mobile;
  if (!m) return null;
  if (adresseApkMobile(version) === null) return null;
  if (!m.apkChemin.startsWith("/") || m.apkChemin.startsWith("//") || /(^|\/)speedfood\.apk(\.sha256)?$/i.test(m.apkChemin)) return null;
  return { nom: m.nom, tailleMo: Math.round(m.apkTaille / 1_000_000), chemin: m.apkChemin, sha256: m.apkSha256 };
}
