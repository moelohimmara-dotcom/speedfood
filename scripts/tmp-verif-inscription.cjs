/* Vérification temporaire (à supprimer) : ce que l'inscription a réellement écrit en base. */
const fs = require("fs");

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")])
);

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

(async () => {
  const cible = process.argv[2];
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) { console.log("ERREUR liste:", error.message); return; }
  const u = data.users.find((x) => x.email === cible);
  if (!u) { console.log("utilisateur absent:", cible); return; }
  console.log("utilisateur trouve :", u.id);
  console.log("confirme le :", u.email_confirmed_at ?? "NON CONFIRME");
  console.log("metadonnees :", JSON.stringify(u.user_metadata));

  const { data: profils } = await supabase.from("client_profils").select("*").eq("utilisateur_id", u.id);
  console.log("client_profils :", JSON.stringify(profils ?? [], null, 2));

  const { data: tous } = await supabase
    .from("client_profils")
    .select("utilisateur_id, pseudo, avatar, telephone, nom_commande, adresse");
  console.log("tous les profils clients :", JSON.stringify(tous ?? [], null, 2));
})();