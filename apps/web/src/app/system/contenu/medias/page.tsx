import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerBannieres } from "@/lib/system-admin/contenus";
import { exigerPalier } from "@/lib/system-admin/paliers-serveur";
import { MINIMUMS_STUDIO } from "@/lib/system-admin/paliers";
import { PageHeader } from "@/components/admin/blocs";
import { Card, Badge } from "@/components/ui";
import { SousNav } from "../../SousNav";

export const metadata = { title: "Médias (administration)" };

/**
 * Bibliothèque de bannières (lecture seule) : les images déjà utilisées par
 * une bannière, avec leur bannière associée. Volontairement pas un espace
 * d'upload indépendant — l'upload reste dans /system/contenu/bannieres, pour
 * ne pas dupliquer ce flux (voir docs/cadrage, refonte de la console admin).
 */
export default async function MediasSystemePage() {
  const contexte = await exigerPermissionPage("contenu.editer");
  // Les images affichées sont celles des bannières : même lecture (palier ≥ 0 sur `contenu:bannieres`, 404 sinon).
  await exigerPalier("contenu:bannieres", MINIMUMS_STUDIO.lire, { contexte });
  const bannieres = (await listerBannieres()).filter((b) => b.image_url);

  return (
    <div>
      <PageHeader titre="Contenu" description="Images utilisées par les bannières." />
      <SousNav entrees={sousSectionsAccessibles("Contenu", contexte.role)} />
      <p className="u-c-secondaire-mb-s4">
        Images actuellement utilisées par une bannière. Pour ajouter ou remplacer une image,
        utilisez <Link href="/system/contenu/bannieres">Bannières</Link>.
      </p>

      {bannieres.length === 0 ? (
        <Card>
          <p className="u-m-0-c-secondaire">Aucune bannière n&apos;a d&apos;image pour l&apos;instant.</p>
        </Card>
      ) : (
        <div className="u-0ec50343">
          {bannieres.map((b) => (
            <Card key={b.id} className="u-p-0-ov-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local. */}
              <img
                src={b.image_url!}
                alt=""
                className="u-w-100-h-120px-of-cover-d-block"
              />
              <div className="u-p-s3">
                <div className="u-d-flex-ai-center-g-8px-mb-4px">
                  <strong>{b.titre}</strong>
                  <Badge ton={b.statut === "publie" ? "succes" : "neutre"}>
                    {b.statut === "publie" ? "Publiée" : "Brouillon"}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
