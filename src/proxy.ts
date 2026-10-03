import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Corps minimal d'une 404 servie par le proxy pour /system (copie de la page introuvable). */
const PAGE_INTROUVABLE_HTML = `<!doctype html>
<html lang="fr">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page introuvable</title></head>
  <body style="font-family: system-ui, sans-serif; text-align: center; padding: 4rem 1rem;">
    <h1>Page introuvable</h1>
    <p>Cette page n&apos;existe pas.</p>
  </body>
</html>`;

/**
 * Rafraîchit la session Supabase à chaque requête (pattern officiel @supabase/ssr),
 * redirige vers /connexion si personne n'est connecté sur /restaurant/*, et
 * refuse les visiteurs sans session sur /system (CMS système, bloc 8a).
 *
 * Ce fichier s'appelle `proxy.ts` (pas `middleware.ts`, déprécié depuis Next.js 16 —
 * voir node_modules/next/dist/docs/.../file-conventions/proxy.md). Par prudence,
 * l'authentification n'est PAS vérifiée uniquement ici : chaque page sous
 * /restaurant refait aussi son propre contrôle (src/app/restaurant/**) et chaque
 * page sous /system via src/lib/system-admin/contexte.ts, comme recommandé par la
 * documentation officielle ("Always verify authentication and authorization
 * inside each Server Function rather than relying on Proxy alone").
 */
export async function proxy(request: NextRequest) {
  let reponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !cle) {
    return reponse;
  }

  const supabase = createServerClient(url, cle, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesASetter) {
        for (const { name, value } of cookiesASetter) {
          request.cookies.set(name, value);
        }
        reponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesASetter) {
          reponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // "/restaurant/..." et "/restaurant" exact = console protégée ; "/restaurants/..."
  // = fiches publiques du catalogue, qui doivent rester accessibles sans compte.
  const cheminProtege =
    request.nextUrl.pathname === "/restaurant" ||
    request.nextUrl.pathname.startsWith("/restaurant/");

  if (!user && cheminProtege) {
    const urlConnexion = request.nextUrl.clone();
    urlConnexion.pathname = "/connexion";
    urlConnexion.searchParams.set("suite", request.nextUrl.pathname);
    return NextResponse.redirect(urlConnexion);
  }

  // "/system/..." et "/system" exact = CMS système (bloc 8a, ADR-010). Un
  // visiteur sans session reçoit une 404 identique à une URL inexistante :
  // aucune redirection vers /connexion qui révélerait l'existence du CMS.
  // Le rôle système lui-même n'est PAS vérifié ici (pas de requête en plus) :
  // chaque page /system le refait via src/lib/system-admin/contexte.ts.
  const cheminSysteme =
    request.nextUrl.pathname === "/system" ||
    request.nextUrl.pathname.startsWith("/system/");

  if (!user && cheminSysteme) {
    return new NextResponse(PAGE_INTROUVABLE_HTML, {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Double authentification (facultative mais, une fois activée, EXIGÉE) : un compte qui a un
  // facteur confirmé ne peut pas utiliser les consoles avec une session au seul mot de passe
  // (niveau aal1). Il est renvoyé saisir son code. Les comptes sans double authentification
  // ne sont pas touchés. La même règle est appliquée côté base (migration
  // double_authentification_aal2) pour les appels directs à l'API.
  if (user && (cheminProtege || cheminSysteme)) {
    const { data: niveau } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (niveau && niveau.nextLevel === "aal2" && niveau.currentLevel !== "aal2") {
      const urlVerification = request.nextUrl.clone();
      urlVerification.pathname = "/connexion/verification";
      urlVerification.search = "";
      urlVerification.searchParams.set("suite", request.nextUrl.pathname);
      return NextResponse.redirect(urlVerification);
    }
  }

  return reponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
