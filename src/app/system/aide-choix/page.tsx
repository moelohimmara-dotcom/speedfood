import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { gammesDesRestaurants } from "@/lib/decouverte/aide-choix-service";
import { demandesEnAttente } from "@/lib/decouverte/gamme-gestion";
import { GAMMES, LIBELLES_GAMME } from "@/lib/decouverte/aide-choix";
import { CarteChiffre, EtatVide, PageHeader, Panneau } from "@/components/admin/blocs";
import Link from "next/link";
import { SousNav } from "../SousNav";
import { ActionsGamme } from "./ActionsGamme";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aide au choix (administration)" };
export const dynamic = "force-dynamic";

const gnf = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("fr-FR")} GNF`);

/** Gammes de prix des restaurants et demandes de changement. Permission `commande.support`. Réglages : Paramètres → Aide au choix. */
export default async function AideChoixAdminPage() {
  const contexte = await exigerPermissionPage("commande.support");
  const [{ restaurants, reglages, erreur }, demandes] = await Promise.all([gammesDesRestaurants(), demandesEnAttente().catch(() => [])]);
  const parGamme = (g: string) => restaurants.filter((r) => r.effective === g).length;
  const sansGamme = restaurants.filter((r) => r.effective === null);
  const validees = restaurants.filter((r) => r.validee !== null);

  return (
    <div>
      <PageHeader titre="Aide au choix" description="Comment les restaurants sont répartis par gamme de prix et quelles demandes de changement attendent une décision." />
      <SousNav entrees={sousSectionsAccessibles("Commandes", contexte.role)} />

      {erreur ? (
        <p className="notation-erreur" role="alert">Impossible de lire les restaurants pour le moment.</p>
      ) : (
        <div className="ad-cartes">
          {GAMMES.map((g) => (
            <CarteChiffre key={g} libelle={LIBELLES_GAMME[g]} valeur={parGamme(g)} sous="restaurants" />
          ))}
          <CarteChiffre libelle="Sans gamme" valeur={sansGamme.length} sous="aucun plat disponible avec prix" ton={sansGamme.length > 0 ? "danger" : "neutre"} />
        </div>
      )}

      <Panneau titre={`Demandes à examiner (${demandes.length})`}>
        {demandes.length === 0 ? (
          <EtatVide icone="coche" titre="Aucune demande" texte="Quand un restaurateur demande une autre gamme, sa demande apparaît ici." />
        ) : (
          <ul className="notation-avis-liste">
            {demandes.map((d) => {
              const r = restaurants.find((x) => x.id === d.restaurantId);
              return (
                <li key={d.id} className="notation-avis-item">
                  <p className="notation-avis-entete">
                    <strong>{d.restaurantNom}</strong> demande <strong>{LIBELLES_GAMME[d.gammeDemandee]}</strong>
                    <span className="notation-aide"> · actuellement {r?.effective ? LIBELLES_GAMME[r.effective] : "sans gamme"}</span>
                  </p>
                  <p className="notation-aide">
                    Prix typique {gnf(r?.prixTypique ?? null)} · de {gnf(r?.prixMin ?? null)} à {gnf(r?.prixMax ?? null)} · {r?.nbPlatsDisponibles ?? 0} plats disponibles
                  </p>
                  <p className="notation-avis-texte">« {d.motif} »</p>
                  <ActionsGamme mode="decision" id={d.id} />
                </li>
              );
            })}
          </ul>
        )}
      </Panneau>

      <Panneau titre={`Gammes validées par l'exploitation (${validees.length})`}>
        {validees.length === 0 ? (
          <p className="notation-aide">Aucune. Toutes les gammes sont calculées d&apos;après les prix réels.</p>
        ) : (
          <ul className="notation-avis-liste">
            {validees.map((r) => (
              <li key={r.id} className="notation-avis-item">
                <p className="notation-avis-entete">
                  <strong>{r.nom}</strong> : {r.validee ? LIBELLES_GAMME[r.validee] : ""}
                  <span className="notation-aide"> · calculée {r.automatique ? LIBELLES_GAMME[r.automatique] : "—"}</span>
                </p>
                <ActionsGamme mode="retrait" id={r.id} />
              </li>
            ))}
          </ul>
        )}
      </Panneau>

      <Panneau titre="Restaurants sans gamme">
        {sansGamme.length === 0 ? (
          <p className="notation-aide">Tous les restaurants publiés ont une gamme.</p>
        ) : (
          <ul className="positionnement-liste">
            {sansGamme.map((r) => (
              <li key={r.id}>{r.nom}{r.communeNom ? ` (${r.communeNom})` : ""} : à compléter avec des plats disponibles et leurs prix.</li>
            ))}
          </ul>
        )}
      </Panneau>

      <p className="notation-aide">
        Seuils actuels : Économique jusqu&apos;à {gnf(reglages.seuils.economiqueJusqua)}, Intermédiaire jusqu&apos;à {gnf(reglages.seuils.intermediaireJusqua)}, Haut de gamme jusqu&apos;à {gnf(reglages.seuils.hautDeGammeJusqua)}.{" "}
        <Link href="/system/parametres/aide-choix" className="lien-texte">Régler les seuils</Link>
      </p>
    </div>
  );
}
