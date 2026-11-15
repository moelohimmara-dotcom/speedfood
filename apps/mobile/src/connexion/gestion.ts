import { creerAuth } from './client';
import { GestionSession } from './session';
import { coffreSession } from './coffre';
import { fetchHttp } from './http-natif';
/** Une seule session pour tout l'écran : le compte et l'envoi de commande partagent la même instance. */
export const gestion = new GestionSession(creerAuth(fetchHttp), coffreSession);
