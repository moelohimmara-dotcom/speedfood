import type { PossibilitesEditeur } from "@/lib/studio/possibilites";

/** Données passées par la page serveur à l'éditeur (lues et calculées côté serveur, après les contrôles de droits). */
export interface ProprietesEditeur {
  page: { id: string; slug: string; titre: string; statut: string; version: number };
  /** Document de travail tel qu'en base (revalidé avant tout envoi). */
  document: unknown;
  /** Erreurs de validation du document de travail lu (vide s'il est valide). */
  erreursInitiales: string[];
  possibilites: PossibilitesEditeur;
}
