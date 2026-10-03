-- Prix promo optionnel par plat (second prix affiche, pas un code coupon).
-- Un promo ne peut jamais depasser le prix normal.
alter table menu_items add column if not exists prix_promo integer
  check (prix_promo is null or (prix_promo >= 0 and prix_promo <= prix));
