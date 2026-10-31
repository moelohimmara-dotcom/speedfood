"use client";

import { useEffect } from "react";
import { MESSAGE_ALLER, MESSAGE_PRET, MESSAGE_TEXTES, appliquerAuTexte, lireMessageApercu, type Remplacements } from "@/lib/cms/apercu-textes";

const ATTRIBUTS = ["placeholder", "aria-label", "title", "alt"] as const;

interface NoeudTexte {
  noeud: Text;
  original: string;
}
interface NoeudAttribut {
  element: Element;
  attribut: (typeof ATTRIBUTS)[number];
  original: string;
}

/**
 * Pont d'aperçu des textes (voir docs/TEXTES-SITE.md). Monté sur la page d'accueil UNIQUEMENT quand l'adresse contient
 * `?apercu_textes=1` ET que le serveur a vérifié que le visiteur peut éditer les contenus ; la page est alors affichée dans le cadre de
 * l'éditeur (même origine). Le pont reçoit les textes en cours de saisie et les remplace à la volée dans le DOM : rien n'est enregistré.
 * Il neutralise aussi les liens et formulaires du cadre pour qu'un clic ne fasse pas quitter l'aperçu.
 */
export function ApercuTextesPont() {
  useEffect(() => {
    const noeuds: NoeudTexte[] = [];
    const attributs: NoeudAttribut[] = [];
    let marque: HTMLElement | null = null;
    let minuteur: number | undefined;

    function collecter() {
      noeuds.length = 0;
      attributs.length = 0;
      const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          const parent = n.parentElement;
          if (!parent || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
          return n.nodeValue && n.nodeValue.trim() !== "" ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });
      for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) noeuds.push({ noeud: n as Text, original: (n as Text).nodeValue ?? "" });
      for (const element of Array.from(document.body.querySelectorAll("*"))) {
        for (const attribut of ATTRIBUTS) {
          const v = element.getAttribute(attribut);
          if (v && v.trim() !== "") attributs.push({ element, attribut, original: v });
        }
      }
    }

    function appliquer(table: Remplacements) {
      for (const n of noeuds) {
        const suivant = appliquerAuTexte(n.original, table);
        if (n.noeud.nodeValue !== suivant) n.noeud.nodeValue = suivant;
      }
      for (const a of attributs) {
        const suivant = appliquerAuTexte(a.original, table);
        if (a.element.getAttribute(a.attribut) !== suivant) a.element.setAttribute(a.attribut, suivant);
      }
    }

    function aller(texte: string) {
      const cle = texte.trim();
      const brut = noeuds.find((n) => n.original.trim() === cle)?.noeud.parentElement ?? attributs.find((a) => a.original.trim() === cle)?.element ?? null;
      const trouve = brut instanceof HTMLElement ? brut : null;
      if (!trouve) return;
      if (marque) marque.style.outline = "";
      window.clearTimeout(minuteur);
      trouve.scrollIntoView({ block: "center", behavior: "smooth" });
      trouve.style.outline = "3px solid #ff7a1a";
      trouve.style.outlineOffset = "4px";
      marque = trouve;
      minuteur = window.setTimeout(() => {
        if (marque) marque.style.outline = "";
        marque = null;
      }, 2500);
    }

    function recevoir(e: MessageEvent) {
      // Même origine seulement : l'éditeur et la page sont sur le même site.
      if (e.origin !== window.location.origin) return;
      const m = lireMessageApercu(e.data);
      if (!m) return;
      if (m.type === MESSAGE_TEXTES) appliquer(m.remplacements);
      else if (m.type === MESSAGE_ALLER) aller(m.texte);
    }

    // Un clic ne doit ni quitter l'aperçu ni envoyer un formulaire (recherche de zone, boutons de commande…).
    function bloquerNavigation(e: Event) {
      const cible = e.target as Element | null;
      if (cible?.closest("a[href], form")) e.preventDefault();
    }

    // Les sections se chargent par flux : on attend que la page soit peinte avant d'inventorier les textes.
    const demarrer = window.setTimeout(() => {
      collecter();
      window.parent.postMessage({ type: MESSAGE_PRET }, window.location.origin);
    }, 400);

    window.addEventListener("message", recevoir);
    document.addEventListener("click", bloquerNavigation, true);
    document.addEventListener("submit", bloquerNavigation, true);
    return () => {
      window.clearTimeout(demarrer);
      window.clearTimeout(minuteur);
      window.removeEventListener("message", recevoir);
      document.removeEventListener("click", bloquerNavigation, true);
      document.removeEventListener("submit", bloquerNavigation, true);
    };
  }, []);

  return null;
}
