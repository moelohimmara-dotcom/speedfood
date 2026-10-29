"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enregistrerServiceSurPlaceAction } from "@/lib/table/actions";
import { LIBELLES_VALIDATION, REGLAGES_VALIDATION, type ReglageValidation, type ServiceTable } from "@/lib/table/regles";
import { ORDRE_PROFILS, PROFILS, appliquerProfil, profilCorrespondant, reglagesIdentiques, resumerService, validationEffective, type ProfilService, type ReglagesSurPlace } from "@/lib/table/profils";
import { Alert, Button } from "@/components/ui";

interface Props {
  reglages: ReglagesSurPlace;
  /** Tables actuellement ouvertes : elles gardent leur fonctionnement, on le dit avant un changement. */
  tablesOuvertes: number;
}

const LIBELLES_MODE: Record<ServiceTable, { titre: string; phrase: string; client: string; personnel: string }> = {
  table: {
    titre: "À table",
    phrase: "Une note par table, réglée à la fin du repas auprès du serveur.",
    client: "Table 7 · addition 65 000 GNF",
    personnel: "Le serveur voit la table, ses commandes et l'addition.",
  },
  comptoir: {
    titre: "Au comptoir",
    phrase: "Chaque commande reçoit un numéro d'appel, le client voit « prête » sur son téléphone.",
    client: "Votre numéro : 42 · prête",
    personnel: "La cuisine voit le numéro à appeler.",
  },
};

/**
 * Service sur place en UNE carte : interrupteur, profils en un clic, façon de servir, compte, validation. Un seul enregistrement
 * (barre fixe avec le nombre de changements). Désactivé, le reste est grisé : on ne règle pas un service éteint sans le savoir.
 */
export function ServiceSurPlace({ reglages: serveur, tablesOuvertes }: Props) {
  const routeur = useRouter();
  const [enCours, demarrer] = useTransition();
  const signature = JSON.stringify(serveur);
  const [signatureVue, setSignatureVue] = useState(signature);
  const [base, setBase] = useState<ReglagesSurPlace>(serveur);
  const [actuels, setActuels] = useState<ReglagesSurPlace>(serveur);
  if (signatureVue !== signature) {
    // Nouvelles valeurs du serveur (après un enregistrement) : on repart de la base enregistrée.
    setSignatureVue(signature);
    setBase(serveur);
    setActuels((a) => (reglagesIdentiques(a, base) ? serveur : a));
  }
  const [message, setMessage] = useState<{ ton: "succes" | "danger"; texte: string } | null>(null);
  const [detailsOuverts, setDetailsOuverts] = useState(false);

  const modifie = !reglagesIdentiques(actuels, base);
  const profil = profilCorrespondant(actuels);
  const validation = validationEffective(actuels);
  const impact = useMemo(() => {
    if (tablesOuvertes === 0 || !modifie) return null;
    if (base.actif && !actuels.actif) return `${tablesOuvertes} table${tablesOuvertes > 1 ? "s sont" : " est"} ouverte${tablesOuvertes > 1 ? "s" : ""} : elles restent consultables et se règlent normalement, mais plus aucune nouvelle commande ne sera acceptée.`;
    if (base.service !== actuels.service) return `${tablesOuvertes} table${tablesOuvertes > 1 ? "s sont" : " est"} ouverte${tablesOuvertes > 1 ? "s" : ""} : elles gardent leur fonctionnement actuel, le nouveau mode s'applique aux commandes suivantes.`;
    return null;
  }, [tablesOuvertes, modifie, base, actuels]);

  function changer(patch: Partial<ReglagesSurPlace>) {
    setMessage(null);
    setActuels((a) => ({ ...a, ...patch }));
  }

  function enregistrer() {
    if (!modifie || enCours) return;
    setMessage(null);
    demarrer(async () => {
      const r = await enregistrerServiceSurPlaceAction(actuels);
      if (r.ok) {
        setBase(actuels);
        setMessage({ ton: "succes", texte: "Réglages enregistrés : ils s'appliquent aux prochaines commandes." });
        routeur.refresh();
      } else {
        setMessage({ ton: "danger", texte: r.erreur });
      }
    });
  }

  // Ctrl/Cmd + S enregistre ; fermer l'onglet avec des changements non enregistrés demande confirmation.
  const enregistrerRef = useRef(enregistrer);
  useEffect(() => {
    enregistrerRef.current = enregistrer;
  });
  useEffect(() => {
    function touche(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        enregistrerRef.current();
      }
    }
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, []);
  useEffect(() => {
    if (!modifie) return;
    function avant(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", avant);
    return () => window.removeEventListener("beforeunload", avant);
  }, [modifie]);

  return (
    <div className="ssp">
      <p className="ssp-resume" aria-live="polite">
        {resumerService(base)}
      </p>

      <section className="ssp-carte" aria-labelledby="ssp-titre">
        <div className="ssp-tete">
          <div>
            <h2 id="ssp-titre" className="ssp-titre">
              1. Activer le service sur place
            </h2>
            <p className="ssp-aide">Vos clients commandent depuis leur téléphone en scannant un QR. Désactivé, plus aucune nouvelle commande sur place n&apos;est acceptée, même avec des QR déjà imprimés.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={actuels.actif}
            aria-labelledby="ssp-titre"
            className={`ssp-interrupteur${actuels.actif ? " ssp-interrupteur-actif" : ""}`}
            onClick={() => changer({ actif: !actuels.actif })}
          >
            <span className="ssp-interrupteur-bouton" aria-hidden="true" />
            <span className="ssp-interrupteur-texte">{actuels.actif ? "Activé" : "Désactivé"}</span>
          </button>
        </div>

        <fieldset className="ssp-reglages" disabled={!actuels.actif}>
          <legend className="ssp-titre ssp-titre-2">2. Choisir votre façon de servir</legend>
          {!actuels.actif ? <p className="ssp-aide">Activez le service pour régler ces options.</p> : null}

          <div className="ssp-profils" role="group" aria-label="Profils prêts à l'emploi">
            <span className="ssp-etiquette">Partir d&apos;un profil :</span>
            {ORDRE_PROFILS.map((p: ProfilService) => (
              <button key={p} type="button" aria-pressed={profil === p} className={`chip ${profil === p ? "actif" : ""}`} title={PROFILS[p].description} onClick={() => changer(appliquerProfil(actuels, p))}>
                {PROFILS[p].libelle}
              </button>
            ))}
            {profil === null ? <span className="ssp-etiquette">Personnalisé</span> : null}
          </div>
          {profil !== null ? <p className="ssp-aide">{PROFILS[profil].description}</p> : null}

          <div className="ssp-modes" role="radiogroup" aria-label="Façon de servir">
            {(Object.keys(LIBELLES_MODE) as ServiceTable[]).map((m) => (
              <label key={m} className={`ssp-mode${actuels.service === m ? " ssp-mode-choisi" : ""}`}>
                <input type="radio" name="ssp-service" checked={actuels.service === m} onChange={() => changer({ service: m })} />
                <span className="ssp-mode-titre">{LIBELLES_MODE[m].titre}</span>
                <span className="ssp-aide">{LIBELLES_MODE[m].phrase}</span>
                <span className="ssp-maquette" aria-hidden="true">
                  Ce que voit le client : <strong>{LIBELLES_MODE[m].client}</strong>
                </span>
                <span className="ssp-aide">{LIBELLES_MODE[m].personnel}</span>
              </label>
            ))}
          </div>

          <div className="ssp-bloc">
            <h3 className="ssp-sous-titre">Faut-il un compte pour commander ?</h3>
            <label className="ssp-case">
              <input type="checkbox" checked={actuels.sansCompte} onChange={(e) => changer({ sansCompte: e.target.checked })} />
              <span>Autoriser à commander sans compte</span>
            </label>
            <p className="ssp-aide">Plus rapide pour vos clients (idéal en fast-food). Le serveur valide alors toujours leur première commande.</p>
            <button type="button" className="ssp-lien" aria-expanded={detailsOuverts} onClick={() => setDetailsOuverts((o) => !o)}>
              {detailsOuverts ? "Masquer le détail" : "En savoir plus"}
            </button>
            {detailsOuverts ? (
              <p className="ssp-aide">
                Avec un compte, Speedfood sait qui commande et peut décourager les fausses commandes à distance. Sans compte, c&apos;est la présence de votre personnel qui rassure : la première commande de chaque table est toujours vérifiée.
              </p>
            ) : null}
          </div>

          <div className="ssp-bloc">
            <h3 className="ssp-sous-titre">Votre personnel valide-t-il les commandes ?</h3>
            <div className="ssp-validations" role="radiogroup" aria-label="Validation par le personnel">
              {REGLAGES_VALIDATION.map((v: ReglageValidation) => (
                <label key={v} className="ssp-case">
                  <input type="radio" name="ssp-validation" checked={actuels.validation === v} onChange={() => changer({ validation: v })} />
                  <span>{LIBELLES_VALIDATION[v]}</span>
                </label>
              ))}
            </div>
            {validation !== actuels.validation ? (
              <p className="ssp-aide" role="note">
                Comme les commandes sans compte sont autorisées, la première commande de chaque table sera quand même validée.
              </p>
            ) : null}
          </div>
        </fieldset>
      </section>

      <div className="ssp-barre" role="region" aria-label="Enregistrement du service sur place">
        <div aria-live="polite" className="ssp-barre-etat">
          {message ? <span className={message.ton === "danger" ? "ssp-erreur" : "ssp-ok"}>{message.texte}</span> : modifie ? <strong>Modifications non enregistrées</strong> : <span>Tout est enregistré.</span>}
        </div>
        <div className="ssp-barre-actions">
          <Button type="button" variante="secondary" disabled={!modifie || enCours} onClick={() => { setActuels(base); setMessage(null); }}>
            Annuler
          </Button>
          <Button type="button" disabled={!modifie || enCours} onClick={enregistrer}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
      {impact ? <Alert ton="info">{impact}</Alert> : null}
    </div>
  );
}
