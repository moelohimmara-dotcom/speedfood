"use client";

import { createContext, useContext } from "react";
import type { Data } from "@puckeditor/core";
import type { PossibilitesEditeur } from "@/lib/studio/possibilites";

/**
 * État de l'éditeur partagé avec les éléments que Puck affiche à notre place (en-tête, panneau de gauche, champs) : ils
 * sont rendus DANS l'arbre de Puck, donc sous ce contexte. Les actions serveur passent toutes par l'éditeur.
 */
export interface MessageErreur {
  message: string;
  details: string[];
}

export type ResultatAction = { ok: true } | { ok: false; erreur: MessageErreur };

export interface ContexteEditeurValeur {
  page: { id: string; slug: string; titre: string };
  statut: string;
  version: number;
  modifie: boolean;
  possibilites: PossibilitesEditeur;
  enCours: null | "enregistrer" | "publier" | "restaurer";
  erreur: MessageErreur | null;
  avertissement: string | null;
  annonce: string;
  fermerAvertissement: () => void;
  annoncer: (message: string) => void;
  enregistrer: () => Promise<boolean>;
  /** Enregistre d'abord les modifications en cours, puis publie le brouillon. Erreurs renvoyées (affichées dans la boîte). */
  publier: (motif: string) => Promise<ResultatAction>;
  /** Remet une version dans le brouillon puis renvoie les nouvelles données de l'éditeur à charger. */
  restaurer: (version: number) => Promise<ResultatAction & { donnees?: Data }>;
}

export const ContexteEditeur = createContext<ContexteEditeurValeur | null>(null);

export function useEditeur(): ContexteEditeurValeur {
  const valeur = useContext(ContexteEditeur);
  if (!valeur) throw new Error("useEditeur hors de l'éditeur");
  return valeur;
}
