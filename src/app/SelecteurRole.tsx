"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

/**
 * Remplace l'ancien faux formulaire d'inscription du prototype (qui ne
 * stockait rien qu'en localStorage, sans jamais recontacter personne). Ici,
 * chaque rôle mène vers une vraie action déjà fonctionnelle :
 * - client : aucune inscription n'est nécessaire pour commander (ADR-005),
 *   donc le vrai geste utile est de parcourir le catalogue.
 * - restaurateur : mène directement à /inscription (bloc 4, réel).
 */
export function SelecteurRole() {
  const [role, setRole] = useState<"client" | "restaurateur">("client");

  return (
    <div>
      <div className="role-toggle" role="group" aria-label="Vous êtes">
        <button
          type="button"
          className={role === "client" ? "active" : ""}
          aria-pressed={role === "client"}
          onClick={() => setRole("client")}
        >
          <svg className="icon" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
          </svg>
          Je suis client
        </button>
        <button
          type="button"
          className={role === "restaurateur" ? "active" : ""}
          aria-pressed={role === "restaurateur"}
          onClick={() => setRole("restaurateur")}
        >
          <svg className="icon" viewBox="0 0 24 24">
            <path d="M4 10v9h16v-9M3 10l2-6h14l2 6M3 10h18M9 19v-5h6v5" />
          </svg>
          Je suis restaurateur
        </button>
      </div>

      {role === "client" ? (
        <div className="cta-resultat">
          <p>
            Aucun compte n&apos;est nécessaire pour commander : parcourez les restaurants déjà
            disponibles et commandez directement.
          </p>
          <Link href="/restaurants">
            <Button pleineLargeur>Voir les restaurants disponibles</Button>
          </Link>
        </div>
      ) : (
        <div className="cta-resultat">
          <p>
            Créez votre compte restaurateur : gratuit pendant la phase pilote, votre établissement
            reste en attente de validation avant d&apos;apparaître au catalogue public.
          </p>
          <Link href="/inscription">
            <Button pleineLargeur>Créer mon compte restaurateur</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
