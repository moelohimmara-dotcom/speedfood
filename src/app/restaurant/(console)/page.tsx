import Link from "next/link";
import type { Metadata } from "next";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { chargerApercusCommandes } from "@/lib/commande/requetes";
import type { ApercuCommandeRestaurant } from "@/lib/contracts/commande";
import { ancienneteLisible } from "@/lib/disponibilite/etat";
import { enRetard, minutesDepuis } from "@/lib/alertes/commandes";
import { BoutonsPartage } from "@/components/BoutonsPartage";
import { cheminRestaurant, texteRestaurant, urlAbsolue } from "@/lib/partage/liens";
import { origineDuSite } from "@/lib/partage/origine";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { formaterDelaiValidation } from "@/lib/parametres/assistance-format";
import { ListeDemarrage } from "@/components/ListeDemarrage";
import { CarteChiffre, EtatVide, PageHeader, Panneau, Pastille, Volet } from "@/components/admin/blocs";
import { GraphiqueBarresJours, Legende, COULEURS_CATEGORIE, LIBELLES_CATEGORIE, Tendance, Variation } from "@/components/admin/graphiques";
import { comparerPeriodes, construireJours, tauxAcceptation, variation, type LigneSerie } from "@/lib/system-admin/pilotageCalculs";
import { BasculesStatut } from "./BasculesStatut";

/** Accueil de l'espace restaurateur : le service d'abord (ouvert, pause), puis ce qui attend une réponse, puis les chiffres des 7 derniers jours. */
export const metadata: Metadata = { title: "Accueil" };

const PERIODE = 7;
const STATUT_POUR_GRAPHIQUE: Record<string, string> = {
  en_attente: "en_attente",
  attente_confirmation_client: "en_attente",
  acceptee: "acceptee",
  prete: "prete",
  terminee: "terminee",
  refusee: "refusee",
  annulee: "annulee",
};

function gnf(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} GNF`;
}

/** Agrège les commandes du restaurant en lignes (jour, statut, nombre, montant) pour les graphiques communs avec l'administration. */
function enSerie(commandes: ApercuCommandeRestaurant[]): LigneSerie[] {
  const parCle = new Map<string, LigneSerie>();
  for (const c of commandes) {
    const jour = c.creeLe.slice(0, 10);
    const statut = STATUT_POUR_GRAPHIQUE[c.etatDerive] ?? "en_attente";
    const cle = `${jour}|${statut}`;
    const ligne = parCle.get(cle) ?? { jour, statut, nb: 0, montant: 0 };
    ligne.nb += 1;
    ligne.montant += c.sousTotal;
    parCle.set(cle, ligne);
  }
  return [...parCle.values()];
}

export default async function AccueilConsolePage() {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant");
  const id = membership.restaurant_id;

  const [{ data: restaurant }, { count: nombrePlats }, commandes] = await Promise.all([
    supabase
      .from("restaurants")
      .select("nom, publie, ouvert, accepte_commandes, statut_mis_a_jour_le, motif_correction, photo_url, logo_url, horaires, moyens_paiement")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("restaurant_id", id).is("archive_le", null),
    chargerApercusCommandes(supabase, id).catch(() => [] as ApercuCommandeRestaurant[]),
  ]);

  const origine = await origineDuSite();
  const { whatsapp, delaiValidationHeures } = await lireReglagesAssistance();
  const urlRestaurant = urlAbsolue(origine, cheminRestaurant(id));
  const maintenant = new Date();

  const aTraiter = commandes.filter((c) => c.etatDerive === "en_attente");
  const enCours = commandes.filter((c) => ["attente_confirmation_client", "acceptee", "prete"].includes(c.etatDerive));
  const serie = enSerie(commandes);
  const jours = construireJours(serie, PERIODE, maintenant);
  const { courant, precedent } = comparerPeriodes(serie, PERIODE, maintenant);
  const taux = tauxAcceptation(courant);
  const demarrageIncomplet = restaurant
    ? !restaurant.photo_url || !restaurant.logo_url || (nombrePlats ?? 0) === 0 || restaurant.horaires.trim() === "" || restaurant.moyens_paiement.length === 0 || !restaurant.publie
    : false;

  return (
    <div>
      <PageHeader
        titre={restaurant?.nom ?? "Votre restaurant"}
        description="Votre service d'abord, puis les commandes qui attendent une réponse."
        actions={
          <>
            <Pastille ton={restaurant?.publie ? "succes" : "neutre"}>{restaurant?.publie ? "Publié" : "En attente de validation"}</Pastille>
            <Pastille ton={restaurant?.ouvert ? "succes" : "danger"}>{restaurant?.ouvert ? "Ouvert" : "Fermé"}</Pastille>
            {restaurant?.ouvert && restaurant.accepte_commandes === false ? <Pastille ton="attention">Commandes en pause</Pastille> : null}
          </>
        }
      />

      {restaurant?.motif_correction ? (
        <div className="ad-bandeau ad-bandeau-attention" role="note">
          <p style={{ margin: 0 }}>
            <strong>Une correction est demandée avant publication :</strong> {restaurant.motif_correction}
          </p>
        </div>
      ) : !restaurant?.publie ? (
        <div className="ad-bandeau ad-bandeau-attention" role="note">
          <p style={{ margin: 0 }}>
            Votre restaurant n&apos;est pas encore visible au catalogue. Une personne de l&apos;équipe Speedfood doit d&apos;abord le valider.
          </p>
        </div>
      ) : null}

      <div className="rc-service">
        {restaurant ? (
          <BasculesStatut
            ouvert={restaurant.ouvert}
            accepteCommandes={restaurant.accepte_commandes}
            miseAJour={ancienneteLisible(new Date(restaurant.statut_mis_a_jour_le), maintenant)}
          />
        ) : null}

        <Panneau
          titre="À traiter"
          compteur={aTraiter.length > 0 ? aTraiter.length : undefined}
          sansMarge
          actions={
            <Link href="/restaurant/commandes" className="lien-texte">
              Toutes les commandes
            </Link>
          }
        >
          {aTraiter.length === 0 ? (
            <EtatVide titre="Rien à traiter" texte="Les nouvelles commandes apparaissent ici, avec une alerte sonore si vous l'avez activée." />
          ) : (
            <ul className="rc-aTraiter-liste">
              {aTraiter.slice(0, 6).map((c) => {
                const retard = enRetard(c.creeLe, maintenant) ? minutesDepuis(c.creeLe, maintenant) : null;
                return (
                  <li key={c.id}>
                    <Link href="/restaurant/commandes" className="rc-commande">
                      <span className="rc-commande-titre">
                        {c.reference} · {c.clientNom}
                      </span>
                      <span className="rc-commande-montant">{gnf(c.sousTotal)}</span>
                      <span className="rc-commande-meta">
                        {c.mode === "livraison" ? "Livraison" : "Retrait"} · {ancienneteLisible(new Date(c.creeLe), maintenant)}
                        {retard !== null ? <span className="rc-retard"> · attend depuis {retard} min</span> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panneau>
      </div>

      <section className="ad-cartes" aria-label={`Chiffres des ${PERIODE} derniers jours`} style={{ marginTop: "var(--space-5)" }}>
        <CarteChiffre
          libelle={`Commandes, ${PERIODE} derniers jours`}
          valeur={courant.total}
          href="/restaurant/commandes"
          sous={<Variation valeur={variation(courant.total, precedent.total)} />}
          tendance={<Tendance valeurs={jours.map((j) => j.total)} />}
        />
        <CarteChiffre
          libelle="Montant des commandes"
          valeur={gnf(courant.montantRetenu)}
          sous="Commandes acceptées, prêtes ou terminées. Indicatif : le règlement se fait avec vos clients."
        />
        <CarteChiffre
          libelle="Commandes acceptées"
          valeur={taux === null ? "—" : `${Math.round(taux * 100)} %`}
          sous={taux === null ? "Aucune commande décidée sur la période" : "Part des commandes décidées que vous avez acceptées"}
          ton={taux !== null && taux < 0.6 ? "danger" : "neutre"}
        />
        <CarteChiffre libelle="En cours" valeur={enCours.length} href="/restaurant/commandes" sous="Acceptées, prêtes ou en attente de réponse du client" />
      </section>

      {courant.total > 0 ? (
        <Panneau titre={`Commandes par jour, ${PERIODE} derniers jours`}>
          <GraphiqueBarresJours jours={jours} identifiant="graphique-resto" />
          <Legende
            elements={(["terminees", "enCours", "enAttente", "ecartees"] as const).map((cat) => ({
              cle: cat,
              libelle: LIBELLES_CATEGORIE[cat],
              valeur: courant[cat],
              couleur: COULEURS_CATEGORIE[cat],
            }))}
          />
        </Panneau>
      ) : null}

      <div className="ad-volets">
        {restaurant && demarrageIncomplet ? (
          <Volet titre="Préparer ma page" ouvert resume="Ce qu'il reste à faire avant et pendant la validation">
            <ListeDemarrage
              etat={{
                photo: Boolean(restaurant.photo_url),
                logo: Boolean(restaurant.logo_url),
                plats: (nombrePlats ?? 0) > 0,
                horaires: restaurant.horaires.trim().length > 0,
                paiement: restaurant.moyens_paiement.length > 0,
                publie: restaurant.publie,
              }}
              delaiValidation={delaiValidationHeures ? formaterDelaiValidation(delaiValidationHeures) : null}
              whatsapp={whatsapp}
            />
          </Volet>
        ) : null}

        <Volet titre="Mon lien et mon QR code" resume={restaurant?.publie ? "À afficher dans votre établissement" : "Disponible après publication"}>
          {restaurant?.publie ? (
            <div className="partage-contenu">
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG généré par notre propre route, pas un asset du site. */}
              <img src={`/restaurants/${id}/qr`} alt="QR code de votre page Speedfood" width={150} height={150} className="partage-qr" />
              <div>
                <p className="partage-texte">
                  Affichez ce QR code dans votre établissement : le client le scanne et arrive sur votre page. Il ne contient que l&apos;adresse de votre page.
                </p>
                <div className="partage-actions">
                  <a href={`/restaurants/${id}/qr?telecharger=1`} className="btn btn-secondary">
                    Télécharger le QR code
                  </a>
                  <BoutonsPartage texte={texteRestaurant(restaurant?.nom ?? "Notre restaurant", urlRestaurant)} url={urlRestaurant} />
                </div>
              </div>
            </div>
          ) : (
            <p className="ad-aide-champ" style={{ margin: 0 }}>
              Votre lien, votre QR code et le partage WhatsApp seront disponibles dès que l&apos;équipe Speedfood aura validé et publié votre page.
            </p>
          )}
        </Volet>

        <Volet titre="Mon menu" resume={`${nombrePlats ?? 0} plat${(nombrePlats ?? 0) > 1 ? "s" : ""} au menu`}>
          <p style={{ margin: 0 }}>
            <Link href="/restaurant/menu" className="lien-texte">
              Gérer mes plats, mes sections et leur disponibilité
            </Link>
          </p>
        </Volet>
      </div>
    </div>
  );
}
