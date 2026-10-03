-- Bucket unique de medias (photos restaurant/plat, logos, bannieres) : lecture
-- publique par URL, 5 Mo max, images uniquement. Aucune policy sur
-- storage.objects : tous les envois et suppressions passent par le service-role
-- cote serveur (src/lib/storage/images.ts), jamais depuis le navigateur.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medias', 'medias', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
