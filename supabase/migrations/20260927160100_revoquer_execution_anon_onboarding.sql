-- Même correctif que la migration 20260927150400 : REVOKE ... FROM PUBLIC ne
-- retire pas le droit d'exécution accordé explicitement à `anon` par Supabase à la
-- création de la fonction. Il faut le révoquer explicitement sur `anon`.
revoke execute on function fn_creer_restaurant_et_owner(text, uuid, uuid) from anon;
