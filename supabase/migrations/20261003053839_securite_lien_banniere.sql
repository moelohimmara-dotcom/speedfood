-- Revue de securite independante, point 14 : le lien d'une banniere ne doit jamais etre
-- javascript:, data: ni http: avant tout affichage public. Verifie aussi en base.
alter table public.content_banners
  add constraint content_banners_lien_sur check (
    lien is null
    or (lien ~ '^/([^/]|$)' and lien !~ '[[:cntrl:]\\]' and length(lien) <= 500)
    or (lien ~ '^https://[^[:space:]\\]+$' and length(lien) <= 500)
  );
