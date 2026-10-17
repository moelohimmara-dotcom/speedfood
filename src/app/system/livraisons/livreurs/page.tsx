import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { roleAPermission, sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerLivreursAdmin } from "@/lib/livraison/admin-lectures";
import { LIBELLES_CYCLE, estCycleLivreur, type CycleLivreur } from "@/lib/livraison/livreurs-regles";
import { ancienneteLisible } from "@/lib/disponibilite/etat";
import { CarteChiffre, EtatVide, PageHeader, Pastille } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { ActionsFiche, AjouterLivreurs, BoutonLivreur, SupprimerLivreursDemo } from "./ActionsLivreurs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Livreurs (administration)" };
export const dynamic = "force-dynamic";

const STATUTS = { hors_ligne: "Hors ligne", disponible: "En ligne", en_course: "En course" } as const;
const VEHICULES: Record<string, string> = { moto: "Moto", velo: "Vélo", voiture: "Voiture", pied: "À pied" };
const FILTRES: { cle: CycleLivreur | "tous"; libelle: string }[] = [
  { cle: "tous", libelle: "En activité" },
  { cle: "candidat", libelle: "À approuver" },
  { cle: "invite", libelle: "Invités" },
  { cle: "actif", libelle: "Actifs" },
  { cle: "suspendu", libelle: "Suspendus" },
  { cle: "archive", libelle: "Archivés" },
];

const tonCycle = (c: string) => (c === "actif" ? "succes" : c === "suspendu" || c === "archive" ? "danger" : c === "candidat" ? "attention" : "neutre");

/** Livreurs : fiches (créées, invitées, à approuver, actives, suspendues, archivées) et état de travail. Permission `commande.support`. */
export default async function LivreursPage({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
  const contexte = await exigerPermissionPage("commande.support");
  const { cycle: cycleDemande } = await searchParams;
  const filtre: CycleLivreur | "tous" = cycleDemande && estCycleLivreur(cycleDemande) ? cycleDemande : "tous";

  const tous = await listerLivreursAdmin();
  const maintenant = new Date();
  const actifs = tous.filter((l) => l.cycle === "actif");
  const compteTravail = (statut: keyof typeof STATUTS) => actifs.filter((l) => l.statut === statut).length;
  const aApprouver = tous.filter((l) => l.cycle === "candidat").length;
  const simules = tous.filter((l) => l.simule).length;
  const nombreParCycle = (c: string) => tous.filter((l) => l.cycle === c).length;
  const livreurs = tous.filter((l) => (filtre === "tous" ? l.cycle !== "archive" : l.cycle === filtre));

  return (
    <div>
      <PageHeader titre="Livreurs" description="Fiches des livreurs et leur état de travail. Un livreur doit être actif pour se mettre en ligne et recevoir des courses." />
      <SousNav entrees={sousSectionsAccessibles("Commandes", contexte.role)} />

      <div className="ad-cartes livreurs-compteurs">
        <CarteChiffre libelle="À approuver" valeur={aApprouver} sous="Compte activé, en attente de décision" ton={aApprouver > 0 ? "danger" : "neutre"} href={aApprouver > 0 ? "/system/livraisons/livreurs?cycle=candidat" : undefined} />
        <CarteChiffre libelle="En ligne" valeur={compteTravail("disponible")} sous="Prêts à recevoir une offre" ton={compteTravail("disponible") > 0 ? "succes" : "neutre"} />
        <CarteChiffre libelle="En course" valeur={compteTravail("en_course")} sous="Une livraison en cours" />
      </div>

      <div className="livreurs-barre">
        <AjouterLivreurs peutLierUnCompte={roleAPermission(contexte.role, "parametres.editer")} />
        <SupprimerLivreursDemo nombre={simules} />
      </div>

      <nav aria-label="Filtrer par état de la fiche" className="livreurs-filtres">
        {FILTRES.map((f) => {
          const n = f.cle === "tous" ? tous.filter((l) => l.cycle !== "archive").length : nombreParCycle(f.cle);
          return (
            <Link key={f.cle} href={f.cle === "tous" ? "/system/livraisons/livreurs" : `/system/livraisons/livreurs?cycle=${f.cle}`} className={`chip${filtre === f.cle ? " actif" : ""}`} aria-current={filtre === f.cle ? "page" : undefined}>
              {f.libelle} <span className="ad-secondaire">{n}</span>
            </Link>
          );
        })}
      </nav>

      {livreurs.length === 0 ? (
        <div className="ad-panneau">
          <EtatVide
            icone="acces"
            titre={filtre === "tous" ? "Aucun livreur" : "Aucune fiche dans cet état"}
            texte={filtre === "tous" ? "Ajoutez un livreur, ou créez des livreurs de démonstration pour essayer la répartition des courses." : "Choisissez un autre filtre pour voir les autres fiches."}
          />
        </div>
      ) : (
        <div className="ad-table-cadre">
          <table className="ad-table">
            <caption className="sr-only">Livreurs</caption>
            <thead>
              <tr>
                <th scope="col">Livreur</th>
                <th scope="col">Fiche</th>
                <th scope="col">Travail</th>
                <th scope="col">Position</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {livreurs.map((l) => (
                <tr key={l.id}>
                  <td className="ad-cellule-principale" data-label="Livreur">
                    {l.nom}
                    <span className="ad-secondaire livreurs-sous">
                      {l.simule ? "Démonstration" : [VEHICULES[l.vehicule] ?? l.vehicule, l.telephone].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td data-label="Fiche">
                    <Pastille ton={tonCycle(l.cycle)}>{estCycleLivreur(l.cycle) ? LIBELLES_CYCLE[l.cycle] : l.cycle}</Pastille>
                    {l.cycle === "invite" ? (
                      <span className="ad-secondaire livreurs-sous">
                        {l.lienValideJusqu ? `Lien valable jusqu'au ${new Date(l.lienValideJusqu).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : "Lien expiré"}
                      </span>
                    ) : null}
                    {l.motifCycle && (l.cycle === "suspendu" || l.cycle === "archive") ? <span className="ad-secondaire livreurs-sous">{l.motifCycle}</span> : null}
                  </td>
                  <td data-label="Travail">
                    {l.cycle === "actif" ? (
                      <>
                        <Pastille ton={l.statut === "disponible" ? "succes" : l.statut === "en_course" ? "attention" : "neutre"}>{STATUTS[l.statut]}</Pastille>
                        {l.statut !== "en_course" ? (
                          <div className="livreurs-sous">
                            <BoutonLivreur livreurId={l.id} nom={l.nom} enLigne={l.statut === "disponible"} />
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <span className="ad-secondaire">—</span>
                    )}
                  </td>
                  <td className="ad-secondaire" data-label="Position">
                    {l.aPosition && l.positionLe ? `Mise à jour ${ancienneteLisible(new Date(l.positionLe), maintenant)}` : "Inconnue"}
                  </td>
                  <td data-label="Actions">
                    <ActionsFiche livreurId={l.id} nom={l.nom} cycle={l.cycle} enCourse={l.statut === "en_course"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
