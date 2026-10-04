import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerBannieres } from "@/lib/system-admin/contenus";
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
  const bannieres = (await listerBannieres()).filter((b) => b.image_url);

  return (
    <div>
      <PageHeader titre="Contenu" description="Images utilisées par les bannières." />
      <SousNav entrees={sousSectionsAccessibles("Contenu", contexte.role)} />
      <p style={{ color: "var(--secondaire)", marginBottom: "var(--space-4)" }}>
        Images actuellement utilisées par une bannière. Pour ajouter ou remplacer une image,
        utilisez <Link href="/system/contenu/bannieres">Bannières</Link>.
      </p>

      {bannieres.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>Aucune bannière n&apos;a d&apos;image pour l&apos;instant.</p>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {bannieres.map((b) => (
            <Card key={b.id} style={{ padding: 0, overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local. */}
              <img
                src={b.image_url!}
                alt=""
                style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
              />
              <div style={{ padding: "var(--space-3)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
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
