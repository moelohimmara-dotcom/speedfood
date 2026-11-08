import { URL as NodeURL, fileURLToPath } from 'node:url';

/** Convertit une URL de module (import.meta.url) en chemin accepté par les API de fichiers Node. */
export function cheminDepuisModule(chemin: string, base = import.meta.url): string {
  return fileURLToPath(new NodeURL(chemin, base));
}
