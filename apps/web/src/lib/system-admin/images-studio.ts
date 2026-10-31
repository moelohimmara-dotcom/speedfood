"use server";

import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientAdmin } from "@/lib/db/admin";
import { televerserImage } from "@/lib/storage/images";
import { AVERTISSEMENTS_TRACE, finaliserEcriture } from "@/lib/studio/apres-ecriture";
import { verifierPermission } from "./contexte";
import { verifierPalier } from "./paliers-serveur";
import { MINIMUMS_STUDIO } from "./paliers";
import { journaliserActionSysteme } from "./audit";

/**
 * Images des pages à blocs (Studio, palier 3, tâche 8) : téléversement et liste des images déjà envoyées.
 *
 * Le contrôle des DROITS passe en premier, avant tout traitement du fichier : permission `contenu.editer`, puis palier ≥ 1
 * sur `contenu:pages` (enregistrer un brouillon). Le fichier lui-même est contrôlé par `televerserImage` (déjà utilisé pour
 * les photos des restaurants) : type déclaré JPEG, PNG ou WebP seulement (donc ni SVG, ni GIF), ENTÊTE réel du fichier qui
 * doit correspondre à ce type (un faux .jpg en HTML est refusé), fichier non vide, 5 Mo au plus, nom généré côté serveur
 * (jamais celui du client), dossier `studio/` du bucket public `medias`, quota d'envois par personne.
 *
 * Un `File` reçu d'une action serveur ne vient jamais du navigateur « de confiance » : rien de lui n'est repris (ni nom, ni
 * type pour le stockage). L'adresse renvoyée est ensuite revérifiée par le schéma du registre à chaque enregistrement.
 */

export interface EtatImageStudio {
  ok: boolean;
  /** Adresse publique de l'image téléversée. */
  url?: string;
  erreur?: string;
  /** L'image est téléversée, mais sa trace d'audit n'a pas pu être écrite. */
  avertissement?: string;
}

export interface ImageStudio {
  url: string;
  nom: string;
  creeLe: string | null;
}

export interface ListeImagesStudio {
  ok: boolean;
  images: ImageStudio[];
  erreur?: string;
}

const MAX_IMAGES_LISTEES = 60;
const NOM_FICHIER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export async function televerserImageStudioAction(formData: FormData): Promise<EtatImageStudio> {
  try {
    // 1. Droits, AVANT de toucher au fichier.
    const contexte = await verifierPermission("contenu.editer");
    await verifierPalier("contenu:pages", MINIMUMS_STUDIO.brouillon, { contexte });

    // 2. Le fichier : une vraie pièce jointe nommée « image », rien d'autre.
    const fichier = formData instanceof FormData ? formData.get("image") : null;
    if (!(fichier instanceof File)) return { ok: false, erreur: "Aucun fichier reçu." };

    // 3. Contrôles du fichier et écriture (quota par personne : les envois du Studio ne sont liés à aucun restaurant).
    const url = await televerserImage(fichier, "studio", `studio-${contexte.utilisateurId}`);

    // 4. Trace d'audit (sans le nom du fichier : il vient du client).
    const chemin = url.slice(url.lastIndexOf("/") + 1);
    const fin = await finaliserEcriture(
      {
        journaliser: () =>
          journaliserActionSysteme(contexte, {
            action: "contenu.image_televersee",
            cibleType: "image_studio",
            cibleId: contexte.utilisateurId,
            motif: chemin,
          }),
      },
      AVERTISSEMENTS_TRACE.image
    );
    return { ok: true, url, ...fin };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { ok: false, erreur: erreur.message };
    throw erreur;
  }
}

/** Images déjà téléversées (dossier `studio/` SEULEMENT, 60 au plus, les plus récentes d'abord). */
export async function listerImagesStudio(): Promise<ListeImagesStudio> {
  try {
    const contexte = await verifierPermission("contenu.editer");
    await verifierPalier("contenu:pages", MINIMUMS_STUDIO.lire, { contexte });
    const admin = creerClientAdmin();
    const { data, error } = await admin.storage.from("medias").list("studio", {
      limit: MAX_IMAGES_LISTEES,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error || !data) return { ok: false, images: [], erreur: "La liste des images n'a pas pu être lue, réessayez dans un instant." };
    const images = data
      .filter((f) => NOM_FICHIER.test(f.name))
      .slice(0, MAX_IMAGES_LISTEES)
      .map((f) => ({ url: admin.storage.from("medias").getPublicUrl(`studio/${f.name}`).data.publicUrl, nom: f.name, creeLe: f.created_at ?? null }));
    return { ok: true, images };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { ok: false, images: [], erreur: erreur.message };
    throw erreur;
  }
}
