"use client";

import { useEffect, useRef, useState } from "react";
import { LIGNES_MAX_MENU_DU_JOUR, dateLisible, formaterPrixGnf, heureLisible, texteMenuDuJour, type LigneMenuDuJour } from "@/lib/menu/ouverture";

interface Props {
  nomRestaurant: string;
  logoUrl: string | null;
  /** Couleur #RRGGBB déjà validée côté serveur, ou null. */
  couleur: string | null;
  url: string;
  lignes: LigneMenuDuJour[];
  /** Date du jour (ISO), fournie par le serveur pour que l'image et le texte portent la même date. */
  dateIso: string;
}

const LARGEUR = 1080;
const HAUTEUR = 1920;

function chargerImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const abandon = setTimeout(() => resolve(null), 4000);
    image.onload = () => {
      clearTimeout(abandon);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(abandon);
      resolve(null);
    };
    image.src = src;
  });
}

function tronquer(ctx: CanvasRenderingContext2D, texte: string, largeurMax: number): string {
  if (ctx.measureText(texte).width <= largeurMax) return texte;
  let coupe = texte;
  while (coupe.length > 1 && ctx.measureText(`${coupe}…`).width > largeurMax) coupe = coupe.slice(0, -1);
  return `${coupe.trimEnd()}…`;
}

function dessiner(
  canvas: HTMLCanvasElement,
  o: { nom: string; logo: HTMLImageElement | null; couleur: string; lignes: LigneMenuDuJour[]; date: Date; url: string; police: string; policeTitre: string; encre: string; secondaire: string; rouge: string },
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = LARGEUR;
  canvas.height = HAUTEUR;
  ctx.fillStyle = "#FFF6ED";
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);

  // Bandeau du haut
  ctx.fillStyle = o.couleur;
  ctx.fillRect(0, 0, LARGEUR, 560);
  let xTexte = 80;
  if (o.logo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(160, 170, 90, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = "#FFF6ED";
    ctx.fillRect(70, 80, 180, 180);
    ctx.drawImage(o.logo, 70, 80, 180, 180);
    ctx.restore();
    xTexte = 290;
  }
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 64px ${o.policeTitre}`;
  ctx.fillText(tronquer(ctx, o.nom, LARGEUR - xTexte - 80), xTexte, 190);
  ctx.font = `700 150px ${o.policeTitre}`;
  ctx.fillText("Menu du jour", 80, 400);
  ctx.font = `500 52px ${o.police}`;
  const date = dateLisible(o.date);
  ctx.fillText(date.charAt(0).toUpperCase() + date.slice(1), 80, 485);

  // Lignes de plats : la zone de 640 à 1540 est partagée entre les plats, qui grossissent quand ils sont peu nombreux
  const n = o.lignes.length;
  const pas = Math.max(140, Math.min(230, Math.floor(900 / n)));
  const taille = n <= 3 ? 68 : n <= 4 ? 62 : 56;
  let y = 640 + (900 - n * pas) / 2 + pas * 0.62;
  for (const ligne of o.lignes) {
    const prix = formaterPrixGnf(ligne.prix);
    ctx.font = `700 ${Math.round(taille * 0.9)}px ${o.police}`;
    const largeurPrix = ctx.measureText(prix).width;
    ctx.fillStyle = o.encre;
    ctx.textAlign = "right";
    ctx.fillText(prix, LARGEUR - 80, y);
    ctx.textAlign = "left";
    // Le nom rétrécit (jusqu'à 44 px) avant d'être tronqué : un nom entier se lit mieux qu'un nom en gros coupé.
    const disponible = LARGEUR - 160 - largeurPrix - 30;
    let tailleNom = taille;
    ctx.font = `600 ${tailleNom}px ${o.police}`;
    while (tailleNom > 44 && ctx.measureText(ligne.nom).width > disponible) {
      tailleNom -= 2;
      ctx.font = `600 ${tailleNom}px ${o.police}`;
    }
    ctx.fillText(tronquer(ctx, ligne.nom, disponible), 80, y);
    const bas = ligne.prixAvantPromo !== null ? 82 : 50;
    if (ligne.prixAvantPromo !== null) {
      ctx.font = `500 38px ${o.police}`;
      ctx.fillStyle = o.secondaire;
      ctx.fillText(`au lieu de ${formaterPrixGnf(ligne.prixAvantPromo)}`, 80, y + 52);
    }
    ctx.strokeStyle = "rgba(43,33,29,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, y + bas);
    ctx.lineTo(LARGEUR - 80, y + bas);
    ctx.stroke();
    y += pas;
  }

  // Pied : heure de confirmation (deux lignes), appel à commander, comment retrouver le restaurant
  const plusRecente = o.lignes.reduce((max, l) => (l.confirmeLe > max ? l.confirmeLe : max), "");
  ctx.fillStyle = o.encre;
  ctx.font = `700 46px ${o.police}`;
  ctx.fillText(`Confirmé aujourd'hui à ${heureLisible(plusRecente)}`, 80, 1585);
  ctx.fillStyle = o.secondaire;
  ctx.font = `500 38px ${o.police}`;
  ctx.fillText("Les plats peuvent s'épuiser dans la journée.", 80, 1640);
  ctx.fillStyle = o.rouge;
  ctx.fillRect(80, 1685, LARGEUR - 160, 140);
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.font = `700 60px ${o.police}`;
  ctx.fillText("Commandez sur Speedfood", LARGEUR / 2, 1775);
  ctx.fillStyle = o.encre;
  ctx.font = `600 36px ${o.police}`;
  ctx.fillText(tronquer(ctx, o.url.replace(/^https?:\/\//, "").split("/")[0], LARGEUR - 160), LARGEUR / 2, 1875);
  ctx.textAlign = "left";
}

function versBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("image vide"))), "image/png");
    } catch (e) {
      reject(e);
    }
  });
}

/** Choix des plats, aperçu de l'image 1080×1920 (format statut WhatsApp), partage ou enregistrement. Tout se fait dans le navigateur. */
export function MenuDuJour({ nomRestaurant, logoUrl, couleur, url, lignes, dateIso }: Props) {
  const [choisis, setChoisis] = useState<string[]>(() => lignes.slice(0, LIGNES_MAX_MENU_DU_JOUR).map((l) => l.id));
  const [message, setMessage] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement | null | undefined>(undefined);
  const date = new Date(dateIso);
  const selection = lignes.filter((l) => choisis.includes(l.id));

  function style() {
    const racine = getComputedStyle(document.documentElement);
    const titre = document.querySelector("h1");
    return {
      police: getComputedStyle(document.body).fontFamily || "sans-serif",
      policeTitre: (titre ? getComputedStyle(titre).fontFamily : "") || "sans-serif",
      encre: racine.getPropertyValue("--encre").trim() || "#2B211D",
      secondaire: racine.getPropertyValue("--secondaire").trim() || "#75695F",
      rouge: racine.getPropertyValue("--rouge-fonce").trim() || "#A32D1F",
    };
  }

  async function peindre(avecLogo: boolean) {
    const canvas = canvasRef.current;
    if (!canvas || selection.length === 0) return;
    await document.fonts?.ready;
    if (avecLogo && logoUrl && logoRef.current === undefined) logoRef.current = await chargerImage(logoUrl);
    dessiner(canvas, { nom: nomRestaurant, logo: avecLogo ? (logoRef.current ?? null) : null, couleur: couleur ?? "#8B2E22", lignes: selection, date, url, ...style() });
  }

  useEffect(() => {
    void peindre(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- le dessin dépend des plats choisis ; le reste est stable pour la page.
  }, [choisis]);

  async function obtenirImage(): Promise<Blob> {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("pas d'image");
    try {
      return await versBlob(canvas);
    } catch {
      // Le logo vient d'un autre domaine : si le navigateur refuse de l'exporter, on refait l'image sans lui.
      await peindre(false);
      return versBlob(canvas);
    }
  }

  const texte = texteMenuDuJour(nomRestaurant, selection, url, date);
  const nomFichier = `menu-du-jour-${dateIso.slice(0, 10)}.png`;

  async function partager() {
    setMessage("");
    try {
      const blob = await obtenirImage();
      const fichier = new File([blob], nomFichier, { type: "image/png" });
      if (navigator.canShare?.({ files: [fichier] })) {
        await navigator.share({ files: [fichier], text: texte });
        return;
      }
      enregistrer(blob);
      setMessage("Image enregistrée. Ouvrez WhatsApp, choisissez « Statut » puis cette image.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMessage("Impossible de préparer l'image. Réessayez ou copiez le texte.");
    }
  }

  function enregistrer(blob: Blob) {
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(blob);
    lien.download = nomFichier;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 10_000);
  }

  async function telecharger() {
    setMessage("");
    try {
      enregistrer(await obtenirImage());
      setMessage("Image enregistrée dans vos fichiers.");
    } catch {
      setMessage("Impossible de préparer l'image. Réessayez.");
    }
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte);
      setMessage("Texte copié. Collez-le dans WhatsApp.");
    } catch {
      setMessage("Copie impossible sur cet appareil. Sélectionnez le texte ci-dessous.");
    }
  }

  function basculer(id: string) {
    setChoisis((actuels) => {
      if (actuels.includes(id)) return actuels.filter((x) => x !== id);
      if (actuels.length >= LIGNES_MAX_MENU_DU_JOUR) return actuels;
      return [...actuels, id];
    });
  }

  return (
    <div className="rc-mj">
      <div className="rc-mj-choix">
        <h2 className="rc-mj-titre">Plats à montrer</h2>
        <p className="rc-mj-aide">
          {choisis.length} sur {LIGNES_MAX_MENU_DU_JOUR} au plus. Seuls les plats confirmés récemment sont proposés.
        </p>
        <ul className="rc-mj-liste">
          {lignes.map((l) => {
            const coche = choisis.includes(l.id);
            const plein = !coche && choisis.length >= LIGNES_MAX_MENU_DU_JOUR;
            return (
              <li key={l.id}>
                <label className="rc-mj-ligne" data-plein={plein}>
                  <input type="checkbox" checked={coche} onChange={() => basculer(l.id)} disabled={plein} />
                  <span className="rc-mj-nom">{l.nom}</span>
                  <span className="rc-mj-prix">{formaterPrixGnf(l.prix)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rc-mj-apercu">
        {selection.length === 0 ? (
          <p className="rc-mj-vide">Choisissez au moins un plat pour voir l&apos;image.</p>
        ) : (
          <canvas ref={canvasRef} className="rc-mj-canvas" role="img" aria-label={`Aperçu du menu du jour de ${nomRestaurant} : ${selection.map((l) => l.nom).join(", ")}`} />
        )}
        <div className="rc-mj-actions">
          <button type="button" className="btn btn-primary" onClick={partager} disabled={selection.length === 0}>
            Partager mon menu
          </button>
          <button type="button" className="btn btn-secondary" onClick={telecharger} disabled={selection.length === 0}>
            Enregistrer l&apos;image
          </button>
          <button type="button" className="btn btn-secondary" onClick={copier} disabled={selection.length === 0}>
            Copier le texte
          </button>
        </div>
        <p className="rc-mj-message" role="status">
          {message}
        </p>
      </div>
    </div>
  );
}
