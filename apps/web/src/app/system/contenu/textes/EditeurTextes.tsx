"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enregistrerGroupeAction } from "@/lib/system-admin/emplacements";
import {
  MESSAGE_ALLER,
  MESSAGE_PRET,
  MESSAGE_TEXTES,
  construireRemplacements,
  estNonEnregistre,
  filtrerChamps,
  niveauCompteur,
  resumerGroupes,
  type EtatChamp,
  type FiltreChamps,
} from "@/lib/cms/apercu-textes";
import { Alert, Badge, Button } from "@/components/ui";
import { EtatVide, Panneau } from "@/components/admin/blocs";

export interface ChampTexte {
  cle: string;
  libelle: string;
  defaut: string;
  max: number;
  multiligne: boolean;
  /** Valeur enregistrée (surcharge), ou `null` si le défaut s'applique. */
  valeur: string | null;
}

interface Groupe {
  nom: string;
  champs: ChampTexte[];
}

type ChampEdite = EtatChamp & { max: number; multiligne: boolean };

const LARGEUR_TELEPHONE = 390;
const LARGEUR_ORDINATEUR = 1100;
const ECRAN_LARGE = "(min-width: 1100px)";

function useEcranLarge(): boolean {
  return useSyncExternalStore(
    (rappel) => {
      const m = window.matchMedia(ECRAN_LARGE);
      m.addEventListener("change", rappel);
      return () => m.removeEventListener("change", rappel);
    },
    () => window.matchMedia(ECRAN_LARGE).matches,
    () => false
  );
}

const ancre = (i: number) => `textes-${i}`;

/**
 * Éditeur des textes du site : aperçu en direct de la VRAIE page d'accueil (cadre de même origine, textes remplacés à la frappe),
 * sommaire avec recherche et filtres, enregistrement global avec suivi des modifications non enregistrées. Un texte enregistré est
 * en ligne aussitôt ; tant qu'il n'est pas enregistré, il n'existe que dans l'aperçu de cet écran.
 */
export function EditeurTextes({ groupes, lectureSeule, urlApercu = "/?apercu_textes=1" }: { groupes: Groupe[]; lectureSeule: boolean; urlApercu?: string }) {
  const routeur = useRouter();
  const grandEcran = useEcranLarge();
  const [enCours, demarrer] = useTransition();

  // --- État : base en ligne, saisies. La base est resynchronisée quand le serveur envoie de nouvelles valeurs (après un enregistrement).
  const tousLesChamps = useMemo(() => groupes.flatMap((g) => g.champs.map((c) => ({ ...c, groupe: g.nom }))), [groupes]);
  const signature = useMemo(() => JSON.stringify(tousLesChamps.map((c) => [c.cle, c.valeur])), [tousLesChamps]);
  const baseDepuis = (champs: typeof tousLesChamps) => Object.fromEntries(champs.map((c) => [c.cle, c.valeur ?? c.defaut]));
  const [signatureVue, setSignatureVue] = useState(signature);
  const [enLigne, setEnLigne] = useState<Record<string, string>>(() => baseDepuis(tousLesChamps));
  const [perso, setPerso] = useState<Record<string, boolean>>(() => Object.fromEntries(tousLesChamps.map((c) => [c.cle, c.valeur !== null])));
  const [saisies, setSaisies] = useState<Record<string, string>>(() => baseDepuis(tousLesChamps));
  if (signatureVue !== signature) {
    // Nouvelles valeurs du serveur : un champ non modifié suit la nouvelle base, un champ en cours de modification garde la saisie.
    const nouvelle = baseDepuis(tousLesChamps);
    setSignatureVue(signature);
    setSaisies((s) => Object.fromEntries(tousLesChamps.map((c) => [c.cle, (s[c.cle] ?? "").trim() === (enLigne[c.cle] ?? "").trim() ? nouvelle[c.cle] : s[c.cle]])));
    setEnLigne(nouvelle);
    setPerso(Object.fromEntries(tousLesChamps.map((c) => [c.cle, c.valeur !== null])));
  }

  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ton: "succes" | "danger"; texte: string } | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<FiltreChamps>("tous");
  const [appareil, setAppareil] = useState<"telephone" | "ordinateur">("telephone");
  const [apercuOuvert, setApercuOuvert] = useState(false);

  const champs: ChampEdite[] = useMemo(
    () => tousLesChamps.map((c) => ({ cle: c.cle, groupe: c.groupe, libelle: c.libelle, defaut: c.defaut, max: c.max, multiligne: c.multiligne, enLigne: enLigne[c.cle] ?? c.defaut, personnalise: perso[c.cle] ?? false, saisie: saisies[c.cle] ?? c.defaut })),
    [tousLesChamps, enLigne, perso, saisies]
  );
  const nonEnregistres = champs.filter(estNonEnregistre);
  const resumes = useMemo(() => resumerGroupes(champs), [champs]);
  const visibles = useMemo(() => new Set(filtrerChamps(champs, recherche, filtre).map((c) => c.cle)), [champs, recherche, filtre]);
  const nombreVisibles = visibles.size;

  // --- Enregistrement : un appel par groupe touché ; les champs d'un groupe refusé restent modifiés, avec leur message.
  function enregistrerTout() {
    if (lectureSeule || nonEnregistres.length === 0 || enCours) return;
    setMessage(null);
    setErreurs({});
    demarrer(async () => {
      const groupesTouches = [...new Set(nonEnregistres.map((c) => c.groupe))];
      const erreursChamps: Record<string, string> = {};
      const erreursGlobales: string[] = [];
      let groupesEnregistres = 0;
      for (const nom of groupesTouches) {
        const fd = new FormData();
        fd.set("groupe", nom);
        for (const c of champs.filter((x) => x.groupe === nom)) {
          fd.set(`v:${c.cle}`, c.saisie);
          fd.set(`i:${c.cle}`, c.enLigne);
        }
        const r = await enregistrerGroupeAction({}, fd);
        Object.assign(erreursChamps, r.erreurs ?? {});
        if (r.erreur) erreursGlobales.push(r.erreur);
        else groupesEnregistres += 1;
      }
      setErreurs(erreursChamps);
      if (erreursGlobales.length > 0) {
        setMessage({ ton: "danger", texte: [...new Set(erreursGlobales)].join(" ") });
      } else {
        setMessage({ ton: "succes", texte: `${nonEnregistres.length} texte${nonEnregistres.length > 1 ? "s" : ""} enregistré${nonEnregistres.length > 1 ? "s" : ""} : en ligne dès maintenant.` });
      }
      if (groupesEnregistres > 0) routeur.refresh();
    });
  }

  function toutAnnuler() {
    setSaisies(Object.fromEntries(champs.map((c) => [c.cle, c.enLigne])));
    setErreurs({});
    setMessage(null);
  }

  // Ctrl/Cmd + S enregistre ; fermer l'onglet avec des modifications non enregistrées demande confirmation.
  const enregistrerRef = useRef(enregistrerTout);
  useEffect(() => {
    enregistrerRef.current = enregistrerTout;
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
  const modifications = nonEnregistres.length;
  useEffect(() => {
    if (modifications === 0) return;
    function avant(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", avant);
    return () => window.removeEventListener("beforeunload", avant);
  }, [modifications]);

  // --- Aperçu : la vraie page d'accueil dans un cadre de même origine ; les saisies lui sont envoyées à la frappe.
  const cadre = useRef<HTMLIFrameElement>(null);
  const zoneApercu = useRef<HTMLDivElement>(null);
  const [pret, setPret] = useState(false);
  const [largeurZone, setLargeurZone] = useState(0);
  useEffect(() => {
    function recevoir(e: MessageEvent) {
      if (e.origin !== window.location.origin || e.source !== cadre.current?.contentWindow) return;
      if ((e.data as { type?: unknown } | null)?.type === MESSAGE_PRET) setPret(true);
    }
    window.addEventListener("message", recevoir);
    return () => window.removeEventListener("message", recevoir);
  }, []);
  useEffect(() => {
    const zone = zoneApercu.current;
    if (!zone) return;
    const observateur = new ResizeObserver((entrees) => setLargeurZone(entrees[0]?.contentRect.width ?? 0));
    observateur.observe(zone);
    return () => observateur.disconnect();
  }, [grandEcran, apercuOuvert]);
  const remplacements = useMemo(() => construireRemplacements(champs.map((c) => ({ enLigne: c.enLigne, saisie: c.saisie }))), [champs]);
  useEffect(() => {
    if (!pret) return;
    const id = window.setTimeout(() => cadre.current?.contentWindow?.postMessage({ type: MESSAGE_TEXTES, remplacements }, window.location.origin), 120);
    return () => window.clearTimeout(id);
  }, [pret, remplacements]);
  function montrerDansApercu(texteEnLigne: string) {
    cadre.current?.contentWindow?.postMessage({ type: MESSAGE_ALLER, texte: texteEnLigne }, window.location.origin);
  }

  const largeurPage = appareil === "telephone" ? LARGEUR_TELEPHONE : LARGEUR_ORDINATEUR;
  const echelle = largeurZone > 0 ? Math.min(1, largeurZone / largeurPage) : 1;
  const hauteurZone = appareil === "telephone" ? 720 : 640;
  const afficherApercu = grandEcran || apercuOuvert;

  const panneauApercu = (
    <aside className="etx-apercu" aria-label="Aperçu de la page d'accueil">
      <div className="etx-apercu-tete">
        <strong>Aperçu en direct</strong>
        <div className="etx-appareils" role="group" aria-label="Taille de l'aperçu">
          <button type="button" aria-pressed={appareil === "telephone"} className={`chip ${appareil === "telephone" ? "actif" : ""}`} onClick={() => setAppareil("telephone")}>
            Téléphone
          </button>
          <button type="button" aria-pressed={appareil === "ordinateur"} className={`chip ${appareil === "ordinateur" ? "actif" : ""}`} onClick={() => setAppareil("ordinateur")}>
            Ordinateur
          </button>
        </div>
      </div>
      <p className="ad-aide-champ">La page réelle, avec vos textes en cours de saisie. Rien n&apos;est publié avant « Enregistrer ». Cliquez dans un champ pour voir où il apparaît.</p>
      <div ref={zoneApercu} className="etx-zone" style={{ height: hauteurZone * echelle }}>
        {afficherApercu ? (
          <iframe
            key={signature}
            ref={cadre}
            title="Aperçu de la page d'accueil"
            src={urlApercu}
            className="etx-cadre"
            style={{ width: largeurPage, height: hauteurZone, transform: `scale(${echelle})` }}
            onLoad={() => setPret(false)}
          />
        ) : null}
      </div>
      {afficherApercu && !pret ? <p className="ad-aide-champ" role="status">Chargement de l&apos;aperçu…</p> : null}
    </aside>
  );

  return (
    <div className="etx">
      <div className="etx-colonne">
        <div className="etx-outils">
          <label className="etx-recherche">
            <span className="sr-only">Rechercher un texte</span>
            <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un texte, un bouton, un titre…" autoComplete="off" />
          </label>
          <div className="etx-filtres" role="group" aria-label="Filtrer les textes">
            {([
              ["tous", "Tous"],
              ["personnalises", "Personnalisés"],
              ["non_enregistres", `Non enregistrés${modifications > 0 ? ` (${modifications})` : ""}`],
            ] as const).map(([cle, libelle]) => (
              <button key={cle} type="button" aria-pressed={filtre === cle} className={`chip ${filtre === cle ? "actif" : ""}`} onClick={() => setFiltre(cle)}>
                {libelle}
              </button>
            ))}
          </div>
          <nav className="etx-sommaire" aria-label="Sections de la page d'accueil">
            {resumes.map((g, i) => (
              <a key={g.nom} href={`#${ancre(i)}`} className="etx-sommaire-lien">
                {g.nom.replace(/^Accueil : /, "")}
                <span className="etx-sommaire-n">
                  {g.nonEnregistres > 0 ? <strong>{g.nonEnregistres} à enregistrer</strong> : g.personnalises > 0 ? `${g.personnalises} modifié${g.personnalises > 1 ? "s" : ""}` : `${g.total}`}
                </span>
              </a>
            ))}
          </nav>
          {!grandEcran ? (
            <Button type="button" variante="secondary" onClick={() => setApercuOuvert((o) => !o)} aria-expanded={apercuOuvert}>
              {apercuOuvert ? "Masquer l'aperçu" : "Afficher l'aperçu"}
            </Button>
          ) : null}
        </div>

        {!grandEcran && apercuOuvert ? panneauApercu : null}

        {nombreVisibles === 0 ? (
          <EtatVide icone="contenu" titre="Aucun texte ne correspond" texte="Changez la recherche ou le filtre pour revoir les textes." />
        ) : (
          <div className="ad-textes">
            {groupes.map((g, i) => {
              const champsVisibles = champs.filter((c) => c.groupe === g.nom && visibles.has(c.cle));
              if (champsVisibles.length === 0) return null;
              return (
                <Panneau key={g.nom} titre={g.nom} id={ancre(i)}>
                  <div className="ad-textes-champs">
                    {champsVisibles.map((c) => (
                      <Champ
                        key={c.cle}
                        champ={c}
                        erreur={erreurs[c.cle]}
                        lectureSeule={lectureSeule}
                        onChange={(v) => setSaisies((s) => ({ ...s, [c.cle]: v }))}
                        onOriginal={() => setSaisies((s) => ({ ...s, [c.cle]: c.defaut }))}
                        onAnnuler={() => setSaisies((s) => ({ ...s, [c.cle]: c.enLigne }))}
                        onFocus={() => montrerDansApercu(c.enLigne)}
                      />
                    ))}
                  </div>
                </Panneau>
              );
            })}
          </div>
        )}

        <div className="etx-barre" role="region" aria-label="Enregistrement">
          <div aria-live="polite" className="etx-barre-etat">
            {message ? <span className={message.ton === "danger" ? "etx-barre-erreur" : "etx-barre-ok"}>{message.texte}</span> : modifications > 0 ? <strong>{modifications} modification{modifications > 1 ? "s" : ""} non enregistrée{modifications > 1 ? "s" : ""}</strong> : <span>Tout est enregistré.</span>}
          </div>
          <div className="etx-barre-actions">
            <Button type="button" variante="secondary" disabled={modifications === 0 || enCours} onClick={toutAnnuler}>
              Annuler les modifications
            </Button>
            <Button type="button" disabled={modifications === 0 || enCours || lectureSeule} onClick={enregistrerTout}>
              {enCours ? "Enregistrement…" : `Enregistrer${modifications > 0 ? ` (${modifications})` : ""}`}
            </Button>
          </div>
        </div>
        {message?.ton === "danger" && Object.keys(erreurs).length === 0 ? <Alert ton="danger">{message.texte}</Alert> : null}
      </div>

      {grandEcran ? panneauApercu : null}
    </div>
  );
}

/** Un champ : saisie, compteur à trois niveaux, état (personnalisé, non enregistré), texte d'origine replié, retour au texte d'origine ou à la version en ligne. */
function Champ({
  champ,
  erreur,
  lectureSeule,
  onChange,
  onOriginal,
  onAnnuler,
  onFocus,
}: {
  champ: ChampEdite;
  erreur?: string;
  lectureSeule: boolean;
  onChange: (valeur: string) => void;
  onOriginal: () => void;
  onAnnuler: () => void;
  onFocus: () => void;
}) {
  const id = `texte-${champ.cle.replace(/\./g, "-")}`;
  const longueur = champ.saisie.trim().length;
  const niveau = niveauCompteur(longueur, champ.max);
  const modifie = estNonEnregistre(champ);
  const identiqueAuDefaut = champ.saisie.trim() === champ.defaut.trim();

  return (
    <div className={`field ad-texte-champ${erreur ? " has-error" : ""}${modifie ? " etx-champ-modifie" : ""}`}>
      <div className="ad-texte-entete">
        <label htmlFor={id}>{champ.libelle}</label>
        <span className="etx-etats">
          {modifie ? <Badge ton="danger">Non enregistré</Badge> : champ.personnalise ? <Badge ton="neutre">Personnalisé</Badge> : null}
        </span>
      </div>
      {champ.multiligne ? (
        <textarea id={id} rows={3} readOnly={lectureSeule} value={champ.saisie} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} aria-invalid={erreur ? true : undefined} aria-describedby={`${id}-aide`} />
      ) : (
        <input id={id} type="text" readOnly={lectureSeule} value={champ.saisie} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} aria-invalid={erreur ? true : undefined} aria-describedby={`${id}-aide`} />
      )}
      <div className="ad-texte-pied" id={`${id}-aide`}>
        <details className="etx-origine">
          <summary>Texte d&apos;origine</summary>
          <p className="ad-texte-defaut">{champ.defaut}</p>
          {!lectureSeule && !identiqueAuDefaut ? (
            <button type="button" className="etx-lien" onClick={onOriginal}>
              Remettre le texte d&apos;origine
            </button>
          ) : null}
        </details>
        <span className={`ad-texte-compteur etx-compteur-${niveau}`} aria-label={`${longueur} caractères sur ${champ.max}`}>
          {longueur} / {champ.max}
        </span>
      </div>
      {modifie && !lectureSeule ? (
        <button type="button" className="etx-lien" onClick={onAnnuler}>
          Annuler ma modification
        </button>
      ) : null}
      {erreur ? <span className="field-error">{erreur}</span> : null}
    </div>
  );
}
