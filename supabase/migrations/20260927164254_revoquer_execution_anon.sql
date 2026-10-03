-- Supabase accorde par defaut l'execution au role anon a la creation d'une
-- fonction, meme apres `revoke ... from public` (voir 20260927150400). Retrait
-- explicite pour les deux fonctions de securite utilisees par les policies RLS.
revoke execute on function fn_est_membre_restaurant(uuid) from anon;
revoke execute on function fn_est_admin_systeme(text[]) from anon;
