// Forme JWT pour traverser le vrai contrôle de syntaxe ; aucune signature ni identité réelle. Trois porteurs : deux clients factices et un restaurateur factice.
export const PORTEURS_CONTROLE = ['reservationClientA.reservationClientA.reservationClientA', 'reservationClientB.reservationClientB.reservationClientB', 'reservationResto.reservationResto.reservationResto'] as const;
export const COMPTES_CONTROLE = ['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1'] as const;
export const RESTAURANTS_CONTROLE = { ouvert: '11111111-1111-4111-8111-111111111111', ferme: '22222222-2222-4222-8222-222222222222' } as const;
