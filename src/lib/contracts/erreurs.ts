/**
 * Contrat d'erreur uniforme pour les routes serveur.
 * Un handler ne doit jamais renvoyer une forme d'erreur ad hoc : toujours ce type.
 */
export interface ErreurApi {
  code:
    | "NON_AUTHENTIFIE"
    | "NON_AUTORISE"
    | "VALIDATION"
    | "INTROUVABLE"
    | "CONFLIT_ETAT"
    | "ERREUR_SERVEUR";
  message: string;
  /** Détails de validation par champ, si pertinent. Ne jamais y placer de données sensibles. */
  champs?: Record<string, string>;
}

export class ErreurMetier extends Error {
  constructor(
    public readonly code: ErreurApi["code"],
    message: string,
    public readonly champs?: Record<string, string>
  ) {
    super(message);
    this.name = "ErreurMetier";
  }

  toApi(): ErreurApi {
    return { code: this.code, message: this.message, champs: this.champs };
  }
}
