import { fetch as fetchExpo } from 'expo/fetch';
import { creerTransportHttp } from './transport-http';

// Choix explicite, même si le runtime est configuré pour le fetch XHR de RN
// (qui ignore redirect:error). Expo désactive les redirections dans OkHttp.
export const fetchHttp = creerTransportHttp(fetch, fetchExpo as typeof fetch);
