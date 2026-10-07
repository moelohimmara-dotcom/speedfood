import "server-only";
import { cache } from "react";
import { lirePromesse } from "@/lib/parametres/promesse";

/**
 * Lectures de l'accueil mutualisées : chaque section lit ce dont elle a besoin, mais une lecture n'est faite qu'UNE fois par
 * requête (`cache` de React), que l'accueil soit rendu par la page d'origine ou par la version en blocs. Les textes
 * (`lireTextes`), les interrupteurs (`fonctionnaliteActive`) et les données (`lireAccueil`) sont déjà mémoïsés par leurs modules.
 */
export const promesseDeLaRequete = cache(lirePromesse);
