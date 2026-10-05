"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { creerPlatAction, type EtatFormulaireMenu } from "@/lib/menu/actions";
import { Input, Button, Alert } from "@/components/ui";
import { interpreterDictee, PRIX_RAPIDES } from "@/lib/menu/saisieRapide";
import { reduireImage } from "@/lib/menu/reduireImage";

const etatInitial: EtatFormulaireMenu = {};

interface Section {
  id: string;
  nom: string;
}

/** Reconnaissance vocale du navigateur (Chrome, Edge, Safari) : absente ailleurs, le bouton « Dicter » n'apparaît alors pas. */
interface Reconnaissance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type FabriqueReconnaissance = new () => Reconnaissance;
function fabrique(): FabriqueReconnaissance | null {
  const w = window as unknown as { SpeechRecognition?: FabriqueReconnaissance; webkitSpeechRecognition?: FabriqueReconnaissance };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
const abonner = () => () => {};
const dicteeDisponible = () => fabrique() !== null;
const pasDeDictee = () => false;

/** Renseigne un champ non contrôlé et prévient le formulaire du changement. */
function remplirChamp(formulaire: HTMLFormElement | null, nom: string, valeur: string) {
  const champ = formulaire?.elements.namedItem(nom);
  if (champ instanceof HTMLInputElement) {
    champ.value = valeur;
    champ.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function IconeMicro() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function IconeAppareil() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function FormulairePlat({ sections = [] }: { sections?: Section[] }) {
  const [etat, action, enCours] = useActionState(creerPlatAction, etatInitial);
  const formRef = useRef<HTMLFormElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [ecoute, setEcoute] = useState(false);
  const [message, setMessage] = useState("");
  const dictee = useSyncExternalStore(abonner, dicteeDisponible, pasDeDictee);

  useEffect(() => {
    if (!etat.erreur) {
      formRef.current?.reset();
    }
  }, [etat]);

  // Libère l'aperçu quand on en change ou qu'on quitte la page.
  useEffect(() => {
    return () => {
      if (apercu) URL.revokeObjectURL(apercu);
    };
  }, [apercu]);

  async function choisirPhoto(fichier: File | undefined) {
    if (!fichier) return;
    setMessage("");
    const reduite = await reduireImage(fichier);
    if (photoRef.current) {
      const lot = new DataTransfer();
      lot.items.add(reduite);
      photoRef.current.files = lot.files;
    }
    setApercu(URL.createObjectURL(reduite));
  }

  function dicter() {
    const Fabrique = fabrique();
    if (!Fabrique) return;
    setMessage("");
    const r = new Fabrique();
    r.lang = "fr-FR";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const phrase = e.results[0]?.[0]?.transcript ?? "";
      const { nom, prix } = interpreterDictee(phrase);
      if (nom) remplirChamp(formRef.current, "nom", nom);
      if (prix !== null) remplirChamp(formRef.current, "prix", String(prix));
      setMessage(
        nom || prix !== null
          ? `Compris : « ${phrase} ». Vérifiez le nom et le prix avant d'ajouter.`
          : "Je n'ai pas compris. Réessayez ou écrivez le nom du plat."
      );
    };
    r.onerror = () => setMessage("La dictée n'a pas fonctionné (micro refusé ou pas de connexion). Écrivez le nom du plat.");
    r.onend = () => setEcoute(false);
    setEcoute(true);
    r.start();
  }

  return (
    <form
      action={action}
      ref={formRef}
      onReset={() => {
        setApercu(null);
        setMessage("");
      }}
    >
      <div className="field depot-photo">
        <label htmlFor="photo">Photo du plat</label>
        <input
          id="photo"
          ref={photoRef}
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const fichier = e.target.files?.[0];
            // Un fichier choisi dans la galerie est réduit comme une photo prise sur place.
            if (fichier) void choisirPhoto(fichier);
          }}
        />
        <div className="saisie-actions">
          <button type="button" className="btn btn-secondary" onClick={() => cameraRef.current?.click()}>
            <IconeAppareil />
            Prendre une photo
          </button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void choisirPhoto(e.target.files?.[0])} tabIndex={-1} />
        </div>
        {apercu ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob) de la photo choisie, jamais envoyé tel quel.
          <img src={apercu} alt="Aperçu de la photo choisie" className="saisie-apercu" />
        ) : null}
        <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--secondaire)" }}>
          JPEG, PNG ou WebP. Les grandes photos sont réduites automatiquement. Facultatif.
        </p>
      </div>

      {dictee ? (
        <div className="saisie-dictee">
          <button type="button" className="btn btn-secondary" onClick={dicter} disabled={ecoute} aria-pressed={ecoute}>
            <IconeMicro />
            {ecoute ? "Je vous écoute…" : "Dicter le nom et le prix"}
          </button>
          <p className="aide-champ" style={{ margin: 0 }}>
            Dites par exemple : « Attiéké poisson, vingt-cinq mille ». La dictée passe par le service vocal de votre navigateur.
          </p>
        </div>
      ) : null}
      <p className="saisie-message" role="status">
        {message}
      </p>

      <Input label="Nom du plat" name="nom" type="text" required maxLength={120} />
      <Input label="Description" name="description" type="text" maxLength={500} />
      <div className="champs-ligne">
        <Input label="Prix (GNF)" name="prix" type="number" min={0} max={5_000_000} step={1} required inputMode="numeric" />
        <div className="field">
          <label htmlFor="prix_promo">Prix promo (GNF)</label>
          <input id="prix_promo" name="prix_promo" type="number" min={0} step={1} inputMode="numeric" />
        </div>
      </div>
      <div className="saisie-prix" role="group" aria-label="Prix courants">
        {PRIX_RAPIDES.map((p) => (
          <button
            key={p}
            type="button"
            className="saisie-prix-bouton"
            aria-label={`Prix ${p.toLocaleString("fr-FR")} GNF`}
            onClick={() => remplirChamp(formRef.current, "prix", String(p))}
          >
            {p.toLocaleString("fr-FR").replace(/ /g, " ")}
          </button>
        ))}
      </div>
      <p className="aide-champ">Prix promo : facultatif, inférieur ou égal au prix normal. Laissez vide pour ne pas proposer de promo.</p>
      {sections.length > 0 ? (
        <div className="field">
          <label htmlFor="section_id">Section du menu</label>
          <select id="section_id" name="section_id" defaultValue="">
            <option value="">Aucune section</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.nom}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {etat.erreur ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          {etat.erreur}
        </Alert>
      ) : null}
      <Button type="submit" pleineLargeur disabled={enCours}>
        {enCours ? "Ajout…" : "Ajouter le plat"}
      </Button>
    </form>
  );
}
