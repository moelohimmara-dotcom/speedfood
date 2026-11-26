import {test} from 'node:test';
import assert from 'node:assert/strict';
import {etatFavori,libelleFavori} from '../src/connexion/favori-fiche.ts';
// Parité Kotlin (lot 1, B9) : le bouton favori de la fiche restaurant ne propose une action que sur un état LU (la bascule du serveur n'est pas idempotente).
const a='00000000-0000-4000-8000-000000000001';const b='00000000-0000-4000-8000-000000000002';
const fav=(id:string)=>({restaurantId:id,nom:'x',ouvert:true});
test('sans session : invitation à se connecter, jamais d’appel',()=>{
 assert.equal(etatFavori({connectee:false,favoris:null,erreurLecture:false},a),'connexion');
 assert.equal(etatFavori({connectee:false,favoris:[fav(a)],erreurLecture:false},a),'connexion');
});
test('session : lecture en cours = aucune action ; échec de lecture = réessayer ; sinon l’état réel',()=>{
 assert.equal(etatFavori({connectee:true,favoris:null,erreurLecture:false},a),'lecture');
 assert.equal(etatFavori({connectee:true,favoris:null,erreurLecture:true},a),'indisponible');
 assert.equal(etatFavori({connectee:true,favoris:[fav(b)],erreurLecture:false},a),'pas_favori');
 assert.equal(etatFavori({connectee:true,favoris:[fav(b),fav(a)],erreurLecture:false},a),'favori');
 assert.equal(etatFavori({connectee:true,favoris:[],erreurLecture:false},a),'pas_favori');
});
test('libellés : l’action annoncée est celle qui aura lieu ; aucun libellé pendant la lecture',()=>{
 assert.equal(libelleFavori('lecture','Chez Awa'),null);
 assert.match(libelleFavori('favori','Chez Awa')!,/^Retirer Chez Awa des favoris$/);
 assert.match(libelleFavori('pas_favori','Chez Awa')!,/^Ajouter Chez Awa aux favoris$/);
 assert.match(libelleFavori('connexion','Chez Awa')!,/Se connecter/);
 assert.match(libelleFavori('indisponible','Chez Awa')!,/Réessayer/);
});
