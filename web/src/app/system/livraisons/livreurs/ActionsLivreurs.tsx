"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  basculerLivreurAction,
  creerLivreurPourCompteAction,
  creerLivreursDemoAction,
  supprimerLivreursDemoAction,
  type EtatActionLivraisonAdmin,
} from "@/lib/system-admin/livraisons";
import {
  apercuListeLivreursAction,
  approuverLivreurAction,
  archiverLivreurAction,
  consulterDossierLivreurAction,
  creerLivreurIndividuelAction,
  creerLivreursGroupeAction,
  reactiverLivreurAction,
  refuserLivreurAction,
  regenererLienAction,
  supprimerDossierLivreurAction,
  suspendreLivreurAction,
  type ApercuListe,
  type EtatCreationLivreurs,
  type LienAffiche,
} from "@/lib/system-admin/livreurs";
import { Alert, Button } from "@/components/ui";
import { useConfirmation, useNotification } from "@/components/console/ConsoleProviders";
import { LiensCrees } from "./LiensCrees";
import type { DossierLivreur } from "@/lib/livraison/livreurs-service";

const LIBELLES_PIECES: Record<string, string> = { carte_identite: "Carte d'identité", passeport: "Passeport", permis: "Permis de conduire", autre: "Autre pièce" };

const etatInitial: EtatActionLivraisonAdmin = {};
const etatCreationInitial: EtatCreationLivreurs = {};

type Mode = "un" | "plusieurs" | "demo" | "compte";

// ---------------------------------------------------------------- un livreur

function FormulaireUnLivreur({ onLiens }: { onLiens: (liens: LienAffiche[]) => void }) {
  const router = useRouter();
  const notifier = useNotification();
  const [etat, action, enCours] = useActionState(creerLivreurIndividuelAction, etatCreationInitial);
  const formulaire = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (etat.liens && etat.succes) {
      notifier("succes", etat.succes);
      formulaire.current?.reset();
      onLiens(etat.liens);
      router.refresh();
    }
    // Réagit à chaque nouveau résultat uniquement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat]);

  return (
    <form ref={formulaire} action={action} className="livreurs-formulaire">
      <div className="livreurs-formulaire-ligne">
        <div className="field">
          <label htmlFor="liv-un-nom">Nom complet</label>
          <input id="liv-un-nom" name="nom" required minLength={2} maxLength={80} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="liv-un-tel">Téléphone (WhatsApp)</label>
          <input id="liv-un-tel" name="telephone" required inputMode="tel" maxLength={24} placeholder="+224 622 12 34 56" autoComplete="off" />
        </div>
      </div>
      <div className="livreurs-formulaire-ligne">
        <div className="field">
          <label htmlFor="liv-un-vehicule">Véhicule</label>
          <select id="liv-un-vehicule" name="vehicule" defaultValue="moto">
            <option value="moto">Moto</option>
            <option value="velo">Vélo</option>
            <option value="voiture">Voiture</option>
            <option value="pied">À pied</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="liv-un-email">E-mail (facultatif)</label>
          <input id="liv-un-email" name="email" type="email" maxLength={120} autoComplete="off" />
        </div>
      </div>
      {etat.erreur ? (
        <p className="field-error" role="alert">
          {etat.erreur}
        </p>
      ) : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Création…" : "Créer la fiche et le lien d'activation"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------- plusieurs livreurs

function FormulairePlusieurs({ onLiens }: { onLiens: (liens: LienAffiche[]) => void }) {
  const router = useRouter();
  const notifier = useNotification();
  const [texte, setTexte] = useState("");
  const [apercu, setApercu] = useState<ApercuListe | null>(null);
  const [refuses, setRefuses] = useState<{ numero: number; erreur: string }[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function lireFichier(fichier: File | undefined) {
    if (!fichier) return;
    if (fichier.size > 60_000) {
      setErreur("Fichier trop volumineux : 100 livreurs au plus par envoi.");
      return;
    }
    const lecteur = new FileReader();
    lecteur.onload = () => {
      setTexte(String(lecteur.result ?? ""));
      setApercu(null);
      setErreur(null);
    };
    lecteur.readAsText(fichier, "utf-8");
  }

  function controler() {
    setErreur(null);
    setRefuses([]);
    demarrer(async () => {
      const r = await apercuListeLivreursAction(texte);
      if ("erreur" in r) setErreur(r.erreur);
      else setApercu(r);
    });
  }

  function creer() {
    setErreur(null);
    demarrer(async () => {
      const r = await creerLivreursGroupeAction(texte);
      if (r.erreur) setErreur(r.erreur);
      if (r.refuses) setRefuses(r.refuses);
      if (r.liens && r.liens.length > 0) {
        notifier("succes", r.succes ?? "Fiches créées.");
        onLiens(r.liens);
        setTexte("");
        setApercu(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="livreurs-formulaire">
      <div className="field">
        <label htmlFor="liv-liste">Un livreur par ligne : nom ; téléphone ; véhicule ; e-mail (les deux derniers facultatifs)</label>
        <textarea
          id="liv-liste"
          rows={7}
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value);
            setApercu(null);
          }}
          placeholder={"Mamadou Diallo ; 622 12 34 56 ; moto\nFatoumata Camara ; 666 11 22 33 ; vélo"}
          spellCheck={false}
        />
      </div>
      <div className="field">
        <label htmlFor="liv-fichier">… ou importer un fichier CSV ou texte (tableur exporté en CSV)</label>
        <input id="liv-fichier" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => lireFichier(e.target.files?.[0])} />
      </div>
      <div className="livreurs-actions-ligne">
        <Button type="button" variante="secondary" disabled={enCours || texte.trim() === ""} onClick={controler}>
          {enCours && !apercu ? "Contrôle…" : "Contrôler la liste"}
        </Button>
        {apercu && apercu.valides > 0 ? (
          <Button type="button" disabled={enCours} onClick={creer}>
            {enCours ? "Création…" : `Créer ${apercu.valides} fiche${apercu.valides > 1 ? "s" : ""}`}
          </Button>
        ) : null}
      </div>
      {erreur ? <Alert ton="danger">{erreur}</Alert> : null}

      {apercu ? (
        <div className="livreurs-apercu">
          <p role="status">
            <strong>{apercu.valides}</strong> ligne{apercu.valides > 1 ? "s" : ""} valide{apercu.valides > 1 ? "s" : ""}
            {apercu.invalides > 0 ? (
              <>
                , <strong>{apercu.invalides}</strong> à corriger
              </>
            ) : null}
            {apercu.tropDeLignes ? ". Seules les 100 premières lignes sont prises en compte." : "."}
          </p>
          <div className="ad-table-cadre">
            <table className="ad-table">
              <caption className="sr-only">Contrôle de la liste</caption>
              <thead>
                <tr>
                  <th scope="col">Ligne</th>
                  <th scope="col">Livreur</th>
                  <th scope="col">Contrôle</th>
                </tr>
              </thead>
              <tbody>
                {apercu.lignes.map((l) => (
                  <tr key={l.numero}>
                    <td data-label="Ligne">{l.numero}</td>
                    <td data-label="Livreur">{l.nom ? `${l.nom} · ${l.telephone} · ${l.vehicule}` : "—"}</td>
                    <td data-label="Contrôle" className={l.erreur ? "livreurs-erreur" : "livreurs-ok"}>
                      {l.erreur ?? "Valide"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {refuses.length > 0 ? (
        <Alert ton="danger">
          Lignes non créées :
          <ul>
            {refuses.map((r) => (
              <li key={r.numero}>
                Ligne {r.numero} : {r.erreur}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- démonstration et compte existant

function BlocDemo({ onFait }: { onFait: () => void }) {
  const router = useRouter();
  const notifier = useNotification();
  const [enCours, demarrer] = useTransition();
  return (
    <div className="livreurs-formulaire">
      <p className="ad-secondaire">
        3 livreurs simulés, déjà actifs et en ligne, placés dans des quartiers de Conakry. Ils répondent seuls aux offres et roulent vers le restaurant puis le client :
        idéal pour essayer la livraison. Ils ne passent pas par l&apos;approbation.
      </p>
      <Button
        type="button"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            const r = await creerLivreursDemoAction();
            if (r.erreur) notifier("erreur", r.erreur);
            else {
              notifier("succes", r.succes ?? "Livreurs créés.");
              onFait();
            }
            router.refresh();
          })
        }
      >
        {enCours ? "Création…" : "Créer 3 livreurs de démonstration"}
      </Button>
    </div>
  );
}

function FormulaireCompteExistant({ onFait }: { onFait: () => void }) {
  const notifier = useNotification();
  const router = useRouter();
  const [etat, action, enCours] = useActionState(creerLivreurPourCompteAction, etatInitial);
  const formulaire = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (etat.succes) {
      notifier("succes", etat.succes);
      formulaire.current?.reset();
      router.refresh();
      onFait();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat]);
  return (
    <form ref={formulaire} action={action} className="livreurs-formulaire">
      <p className="ad-secondaire">
        Pour une personne qui a <strong>déjà</strong> un compte Speedfood : sa fiche est créée <strong>active</strong> d&apos;office (c&apos;est vous qui l&apos;approuvez). Elle ouvre ensuite{" "}
        <strong>/livreur</strong> avec son compte. Réservé au super administrateur.
      </p>
      <div className="field">
        <label htmlFor="liv-email">Adresse e-mail du compte</label>
        <input id="liv-email" name="email" type="email" required autoComplete="off" />
      </div>
      <div className="livreurs-formulaire-ligne">
        <div className="field">
          <label htmlFor="liv-nom">Nom affiché</label>
          <input id="liv-nom" name="nom" required minLength={2} maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="liv-tel">Téléphone (facultatif)</label>
          <input id="liv-tel" name="telephone" inputMode="tel" maxLength={20} />
        </div>
      </div>
      {etat.erreur ? (
        <p className="field-error" role="alert">
          {etat.erreur}
        </p>
      ) : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Création…" : "Lier ce compte"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------- fenêtre d'ajout

const ONGLETS: { mode: Mode; libelle: string; reserve?: boolean }[] = [
  { mode: "un", libelle: "Un livreur" },
  { mode: "plusieurs", libelle: "Plusieurs" },
  { mode: "demo", libelle: "Démonstration" },
  { mode: "compte", libelle: "Compte existant", reserve: true },
];

/** Bouton « Ajouter des livreurs » : une fenêtre à quatre onglets, chacun expliqué. Les liens créés restent affichés jusqu'à fermeture. */
export function AjouterLivreurs({ peutLierUnCompte }: { peutLierUnCompte: boolean }) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>("un");
  const [liens, setLiens] = useState<LienAffiche[]>([]);

  function fermer() {
    dialogue.current?.close();
    setLiens([]);
  }

  return (
    <>
      <Button type="button" aria-haspopup="dialog" onClick={() => dialogue.current?.showModal()}>
        Ajouter des livreurs
      </Button>
      <dialog ref={dialogue} className="ad-dialogue livreurs-dialogue" aria-labelledby="livreurs-ajout-titre" onClose={() => setLiens([])}>
        <div className="ad-dialogue-corps">
          <h2 id="livreurs-ajout-titre">Ajouter des livreurs</h2>
          <div className="ad-onglets-compacts" role="tablist" aria-label="Façon d'ajouter">
            {ONGLETS.filter((o) => !o.reserve || peutLierUnCompte).map((o) => (
              <button
                key={o.mode}
                type="button"
                role="tab"
                aria-selected={mode === o.mode}
                className={`chip${mode === o.mode ? " actif" : ""}`}
                onClick={() => {
                  setMode(o.mode);
                  setLiens([]);
                }}
              >
                {o.libelle}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {mode === "un" ? (
              <>
                <p className="ad-secondaire">
                  Créez la fiche, puis envoyez à la personne son <strong>lien d&apos;activation</strong> par WhatsApp : elle crée son compte (ou se connecte) et devient livreur après
                  votre approbation.
                </p>
                <FormulaireUnLivreur onLiens={setLiens} />
              </>
            ) : null}
            {mode === "plusieurs" ? <FormulairePlusieurs onLiens={setLiens} /> : null}
            {mode === "demo" ? <BlocDemo onFait={fermer} /> : null}
            {mode === "compte" && peutLierUnCompte ? <FormulaireCompteExistant onFait={fermer} /> : null}
          </div>

          <LiensCrees liens={liens} />

          <div className="ad-dialogue-actions">
            <Button type="button" variante="secondary" onClick={fermer}>
              Fermer
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

// ---------------------------------------------------------------- actions sur une fiche

function useAction() {
  const router = useRouter();
  const notifier = useNotification();
  const [enCours, demarrer] = useTransition();
  function lancer(travail: () => Promise<{ erreur?: string; succes?: string }>) {
    demarrer(async () => {
      const r = await travail();
      if (r.erreur) notifier("erreur", r.erreur);
      else if (r.succes) notifier("succes", r.succes);
      router.refresh();
    });
  }
  return { enCours, lancer };
}

/** Boutons d'une fiche selon son cycle : lien (créée, invitée), approuver ou refuser (à approuver), suspendre, réactiver, archiver. */
export function ActionsFiche({
  livreurId,
  nom,
  cycle,
  enCourse,
  aDossier = false,
  peutVoirDossier = false,
}: {
  livreurId: string;
  nom: string;
  cycle: string;
  enCourse: boolean;
  aDossier?: boolean;
  peutVoirDossier?: boolean;
}) {
  const confirmer = useConfirmation();
  const notifier = useNotification();
  const { enCours, lancer } = useAction();
  const [liens, setLiens] = useState<LienAffiche[]>([]);
  const [chargement, demarrerLien] = useTransition();
  const [dossier, setDossier] = useState<DossierLivreur | null | undefined>(undefined);

  async function avecMotif(titre: string, action: string, libelleMotif: string, travail: (motif: string) => Promise<{ erreur?: string; succes?: string }>) {
    const r = await confirmer({ titre, message: <p>{nom}</p>, libelleAction: action, danger: true, niveau: "motif", libelleMotif });
    if (r.confirme) lancer(() => travail(r.motif ?? ""));
  }

  function nouveauLien() {
    demarrerLien(async () => {
      const r = await regenererLienAction(livreurId);
      if (r.erreur) notifier("erreur", r.erreur);
      else setLiens(r.liens ?? []);
    });
  }

  return (
    <div className="livraison-actions">
      {cycle === "cree" || cycle === "invite" ? (
        <Button type="button" variante="secondary" disabled={chargement} onClick={nouveauLien}>
          {chargement ? "Génération…" : "Nouveau lien d'activation"}
        </Button>
      ) : null}
      {cycle === "candidat" ? (
        <>
          <Button type="button" disabled={enCours} onClick={() => lancer(() => approuverLivreurAction(livreurId))}>
            Approuver
          </Button>
          <Button type="button" variante="secondary" disabled={enCours} onClick={() => avecMotif(`Refuser ${nom} ?`, "Refuser", "Motif du refus", (m) => refuserLivreurAction(livreurId, m))}>
            Refuser
          </Button>
        </>
      ) : null}
      {cycle === "actif" ? (
        <Button type="button" variante="secondary" disabled={enCours || enCourse} title={enCourse ? "En course : terminez-la d'abord" : undefined} onClick={() => avecMotif(`Suspendre ${nom} ?`, "Suspendre", "Motif de la suspension", (m) => suspendreLivreurAction(livreurId, m))}>
          Suspendre
        </Button>
      ) : null}
      {cycle === "suspendu" ? (
        <Button type="button" disabled={enCours} onClick={() => lancer(() => reactiverLivreurAction(livreurId))}>
          Réactiver
        </Button>
      ) : null}
      {["cree", "invite", "actif", "suspendu"].includes(cycle) ? (
        <Button type="button" variante="secondary" disabled={enCours || enCourse} onClick={() => avecMotif(`Archiver ${nom} ?`, "Archiver", "Motif de l'archivage", (m) => archiverLivreurAction(livreurId, m))}>
          Archiver
        </Button>
      ) : null}
      {aDossier && peutVoirDossier ? (
        <Button
          type="button"
          variante="secondary"
          disabled={chargement}
          onClick={() =>
            demarrerLien(async () => {
              const r = await consulterDossierLivreurAction(livreurId);
              if (r.erreur) notifier("erreur", r.erreur);
              else setDossier(r.dossier ?? null);
            })
          }
        >
          Voir le dossier
        </Button>
      ) : null}
      {dossier !== undefined ? (
        <dialog
          className="ad-dialogue livreurs-dialogue"
          ref={(el) => {
            if (el && !el.open) el.showModal();
          }}
          onClose={() => setDossier(undefined)}
        >
          <div className="ad-dialogue-corps">
            <h2>Dossier de {nom}</h2>
            {dossier === null ? (
              <p>Aucun dossier.</p>
            ) : (
              <dl className="livreurs-dossier">
                <dt>Pièce d&apos;identité</dt>
                <dd>{dossier.pieceType ? `${LIBELLES_PIECES[dossier.pieceType] ?? dossier.pieceType} · ${dossier.pieceNumero ?? ""}` : "Non demandée"}</dd>
                <dt>Contact d&apos;urgence</dt>
                <dd>{dossier.urgenceNom ? `${dossier.urgenceNom} · ${dossier.urgenceTelephone ?? ""}` : "Non demandé"}</dd>
                <dt>Consentement donné le</dt>
                <dd>{dossier.consentementLe ? new Date(dossier.consentementLe).toLocaleDateString("fr-FR") : "—"}</dd>
              </dl>
            )}
            <p className="ad-secondaire">Cette consultation est inscrite dans le journal d&apos;audit.</p>
            <div className="ad-dialogue-actions">
              {dossier !== null ? (
                <Button
                  type="button"
                  variante="danger"
                  disabled={enCours}
                  onClick={async () => {
                    const rep = await confirmer({
                      titre: `Supprimer le dossier de ${nom} ?`,
                      message: <p>La pièce d&apos;identité et le contact d&apos;urgence sont effacés définitivement.</p>,
                      libelleAction: "Supprimer le dossier",
                      danger: true,
                    });
                    if (!rep.confirme) return;
                    lancer(() => supprimerDossierLivreurAction(livreurId));
                    setDossier(undefined);
                  }}
                >
                  Supprimer le dossier
                </Button>
              ) : null}
              <Button type="button" variante="secondary" onClick={() => setDossier(undefined)}>
                Fermer
              </Button>
            </div>
          </div>
        </dialog>
      ) : null}
      {liens.length > 0 ? (
        <dialog
          className="ad-dialogue livreurs-dialogue"
          ref={(el) => {
            if (el && !el.open) el.showModal();
          }}
          onClose={() => setLiens([])}
        >
          <div className="ad-dialogue-corps">
            <h2>Lien d&apos;activation</h2>
            <LiensCrees liens={liens} />
            <div className="ad-dialogue-actions">
              <Button type="button" variante="secondary" onClick={() => setLiens([])}>
                Fermer
              </Button>
            </div>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- inchangés

/** Supprime les livreurs de démonstration libres, après confirmation. */
export function SupprimerLivreursDemo({ nombre }: { nombre: number }) {
  const router = useRouter();
  const confirmer = useConfirmation();
  const notifier = useNotification();
  const [enCours, demarrer] = useTransition();
  if (nombre === 0) return null;
  return (
    <Button
      type="button"
      variante="secondary"
      disabled={enCours}
      onClick={async () => {
        const reponse = await confirmer({
          titre: "Supprimer les livreurs de démonstration ?",
          message: <p>Seuls ceux qui ne sont pas en course sont supprimés. Les livraisons déjà terminées gardent leur historique.</p>,
          libelleAction: "Supprimer",
          danger: true,
        });
        if (!reponse.confirme) return;
        demarrer(async () => {
          const r = await supprimerLivreursDemoAction();
          notifier(r.erreur ? "erreur" : "succes", r.erreur ?? r.succes ?? "Terminé.");
          router.refresh();
        });
      }}
    >
      Supprimer les livreurs de démonstration
    </Button>
  );
}

/** Mettre un livreur actif en ligne ou hors ligne. */
export function BoutonLivreur({ livreurId, nom, enLigne }: { livreurId: string; nom: string; enLigne: boolean }) {
  const router = useRouter();
  const notifier = useNotification();
  const [enCours, demarrer] = useTransition();
  return (
    <Button
      type="button"
      variante="secondary"
      disabled={enCours}
      aria-label={`${enLigne ? "Mettre hors ligne" : "Mettre en ligne"} ${nom}`}
      onClick={() =>
        demarrer(async () => {
          const r = await basculerLivreurAction(livreurId, !enLigne);
          if (r.erreur) notifier("erreur", r.erreur);
          router.refresh();
        })
      }
    >
      {enLigne ? "Mettre hors ligne" : "Mettre en ligne"}
    </Button>
  );
}
