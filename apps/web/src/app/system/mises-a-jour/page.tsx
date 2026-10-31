import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { SousNav } from "../SousNav";
import { listerFonctionnalites } from "@/lib/system-admin/fonctionnalites";
import { MISES_A_JOUR } from "@/lib/system-admin/misesAJourCatalogue";
import { PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { InterrupteurFonctionnalite } from "./InterrupteurFonctionnalite";
import { AnnonceVersion } from "./AnnonceVersion";
import { VERSION_APPLICATION } from "@/lib/application/version";
import { compterAppareils, derniereAnnonce } from "@/lib/push/annonce-version";

export const metadata = { title: "Mises à jour (administration)" };

const GROUPES: Record<string, string> = { public: "Site public", commande: "Commande", restaurant: "Console restaurant" };

function jour(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Conakry" });
}

/**
 * Contrôle des mises à jour, réservé à `super_admin` (permission `parametres.editer`) : le journal des nouveautés livrées, l'état
 * de chacune et un interrupteur d'urgence pour celles qu'on peut couper à chaud sans risque. Chaque bascule est tracée dans le journal
 * d'audit. L'état réel vient de la base ; la page ne présume de rien.
 */
export default async function MisesAJourPage() {
  const contexte = await exigerPermissionPage("parametres.editer");
  const fonctionnalites = await listerFonctionnalites();
  const parCle = new Map(fonctionnalites.map((f) => [f.cle, f]));
  const coupees = fonctionnalites.filter((f) => !f.active).length;
  const [annonce, appareils] = await Promise.all([derniereAnnonce(), compterAppareils()]);

  return (
    <div>
      <PageHeader
        titre="Mises à jour"
        description="Les nouveautés livrées, leur état en ce moment et un interrupteur d'urgence pour celles qui peuvent être coupées sans redéploiement."
      />

      <SousNav entrees={sousSectionsAccessibles("Paramètres", contexte.role)} />

      <Panneau titre="Application mobile">
        <p className="u-m-0">
          Version publiée sur <code>/installer</code> : <strong>{VERSION_APPLICATION.nom}</strong> (numéro {VERSION_APPLICATION.code}). {appareils} appareil(s) enregistré(s) pour les notifications.
        </p>
        <p className="u-m-0">
          {annonce ? (
            <>
              Dernière annonce : version {annonce.versionNom}, le {jour(annonce.annonceeLe)} ({annonce.envoyes} notifié(s) sur {annonce.appareils}).
            </>
          ) : (
            "Aucune version n'a encore été annoncée."
          )}{" "}
          Les applications déjà ouvertes détectent seules la nouvelle version ; l&apos;annonce prévient aussi celles qui sont fermées, dans le centre de notifications du téléphone.
        </p>
        <AnnonceVersion version={VERSION_APPLICATION.nom} dejaAnnoncee={annonce?.versionCode === VERSION_APPLICATION.code} />
      </Panneau>

      <Panneau titre="État général">
        <p className="u-m-0">
          {coupees === 0 ? (
            <>
              <Pastille ton="succes">Tout est actif</Pastille> {fonctionnalites.length} fonctionnalités pilotables, aucune coupée.
            </>
          ) : (
            <>
              <Pastille ton="attention">{coupees} coupée{coupees > 1 ? "s" : ""}</Pastille> sur {fonctionnalites.length}. Les visiteurs ne les voient plus ; les données déjà
              enregistrées ne sont pas touchées.
            </>
          )}
        </p>
      </Panneau>

      <div className="mj-liste">
        {MISES_A_JOUR.map((m) => {
          const f = m.cle ? parCle.get(m.cle) : undefined;
          return (
            <article key={m.id} className="mj-carte">
              <div className="mj-entete">
                <div>
                  <p className="mj-date">{new Date(m.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                  <h2 className="mj-titre">{m.titre}</h2>
                </div>
                {f ? (
                  <Pastille ton={f.active ? "succes" : "attention"}>{f.active ? "Active" : "Coupée"}</Pastille>
                ) : (
                  <Pastille>{m.cle ? "Interrupteur introuvable" : "Toujours active"}</Pastille>
                )}
              </div>
              <p className="mj-resume">{m.resume}</p>
              <p className="mj-verif">
                <strong>Vérifier :</strong> {m.verification}
              </p>
              {f ? (
                <div className="mj-pied">
                  <p className="mj-meta">
                    {GROUPES[f.groupe] ?? f.groupe} · {f.description} · dernière modification {jour(f.miseAJourLe)}
                  </p>
                  <InterrupteurFonctionnalite cle={f.cle} active={f.active} libelle={f.libelle} />
                </div>
              ) : (
                <p className="mj-meta">{m.sansInterrupteur ?? "Cette fonctionnalité n'est pas encore enregistrée dans la base."}</p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
