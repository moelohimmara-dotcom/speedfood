"use client";

import { useActionState } from "react";
import { modifierProfilAction, type EtatFormulaireProfil } from "@/lib/restaurant/actions";
import { Button, Alert } from "@/components/ui";
import { SelecteurCouleur } from "./SelecteurCouleur";

const etatInitial: EtatFormulaireProfil = {};

export function FormulaireProfil({
  horaires,
  consignes,
  photoUrl,
  logoUrl,
  couleurAccent,
}: {
  horaires: string;
  consignes: string;
  photoUrl: string | null;
  logoUrl: string | null;
  couleurAccent: string | null;
}) {
  const [etat, action, enCours] = useActionState(modifierProfilAction, etatInitial);

  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="photo">Photo de couverture</label>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
          <img
            src={photoUrl}
            alt=""
            style={{ width: 160, height: 120, objectFit: "cover", borderRadius: "var(--radius-md)", marginBottom: 8, display: "block" }}
          />
        ) : null}
        <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
        <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--secondaire)" }}>
          Affichée en haut de votre fiche publique. Format conseillé 3/2 (par exemple 1200 × 800).
          JPEG, PNG ou WebP, 5 Mo maximum. Laissez vide pour ne pas changer la photo actuelle.
        </p>
      </div>
      <div className="field">
        <label htmlFor="logo">Logo (votre emblème)</label>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
          <img
            src={logoUrl}
            alt=""
            style={{
              width: 64,
              height: 64,
              objectFit: "cover",
              borderRadius: "var(--radius-md)",
              marginBottom: 8,
              display: "block",
              border: "1px solid var(--bordure)",
            }}
          />
        ) : null}
        <input id="logo" name="logo" type="file" accept="image/jpeg,image/png,image/webp" />
        <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--secondaire)" }}>
          Affiché en pastille sur le bord de votre bannière et sur votre carte dans le catalogue.
          Format conseillé : carré (par exemple 512 × 512). JPEG, PNG ou WebP, 5 Mo maximum.
          Sans logo, c&apos;est votre initiale qui est affichée à cet emplacement.
        </p>
      </div>
      <div className="field">
        <label>Couleur d&apos;accent</label>
        <SelecteurCouleur valeurInitiale={couleurAccent} />
        <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--secondaire)" }}>
          Un liseré décoratif propre à votre restaurant, visible dans le catalogue et sur votre
          fiche. Facultatif.
        </p>
      </div>
      <div className="field">
        <label htmlFor="horaires">Horaires</label>
        <textarea
          id="horaires"
          name="horaires"
          rows={2}
          maxLength={500}
          defaultValue={horaires}
          placeholder="Ex. Lun-Sam 9h-21h"
        />
      </div>
      <div className="field">
        <label htmlFor="consignes">Consignes pour vos clients</label>
        <textarea
          id="consignes"
          name="consignes"
          rows={3}
          maxLength={1000}
          defaultValue={consignes}
          placeholder="Ex. Livraison uniquement dans un rayon de 5 km"
        />
      </div>
      {etat.erreur ? (
        <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
          {etat.erreur}
        </Alert>
      ) : null}
      {etat.succes ? (
        <Alert ton="succes" style={{ marginBottom: "var(--space-4)" }}>
          Modifications enregistrées.
        </Alert>
      ) : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
