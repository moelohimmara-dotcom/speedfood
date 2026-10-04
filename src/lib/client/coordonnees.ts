import { normaliserTelephone } from "../commande/telephone";

/**
 * Coordonnées de commande mémorisées dans le compte client (préremplissage). Mêmes règles que la commande : nom de 2 à
 * 120 caractères, numéro guinéen normalisé en `+224XXXXXXXXX`, adresse de 5 à 300 caractères (facultative). Ces règles
 * doivent rester alignées sur les contraintes de `client_profils` (migration `profils_clients_coordonnees`).
 */
export interface Coordonnees {
  nom: string;
  telephone: string;
  adresse: string | null;
}

export type ResultatCoordonnees = { ok: true; coordonnees: Coordonnees } | { ok: false; erreur: string };

export function validerCoordonnees(brut: { nom: string; telephone: string; adresse: string | null }): ResultatCoordonnees {
  const nom = brut.nom.replace(/\s+/g, " ").trim();
  if (nom.length < 2 || nom.length > 120) {
    return { ok: false, erreur: "Le nom doit contenir entre 2 et 120 caractères." };
  }
  const telephone = normaliserTelephone(brut.telephone);
  if (!telephone) {
    return { ok: false, erreur: "Numéro guinéen invalide : 9 chiffres commençant par 6 ou 7." };
  }
  const adresseNettoyee = brut.adresse ? brut.adresse.replace(/\s+/g, " ").trim() : "";
  if (adresseNettoyee !== "" && (adresseNettoyee.length < 5 || adresseNettoyee.length > 300)) {
    return { ok: false, erreur: "L'adresse doit contenir entre 5 et 300 caractères." };
  }
  return { ok: true, coordonnees: { nom, telephone, adresse: adresseNettoyee === "" ? null : adresseNettoyee } };
}
