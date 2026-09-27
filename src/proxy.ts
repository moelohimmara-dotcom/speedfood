import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase à chaque requête (pattern officiel @supabase/ssr)
 * et redirige vers /connexion si personne n'est connecté sur /restaurant/*.
 *
 * Ce fichier s'appelle `proxy.ts` (pas `middleware.ts`, déprécié depuis Next.js 16 —
 * voir node_modules/next/dist/docs/.../file-conventions/proxy.md). Par prudence,
 * l'authentification n'est PAS vérifiée uniquement ici : chaque page sous
 * /restaurant refait aussi son propre contrôle (src/app/restaurant/**), comme
 * recommandé par la documentation officielle ("Always verify authentication and
 * authorization inside each Server Function rather than relying on Proxy alone").
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

  if (!user && request.nextUrl.pathname.startsWith("/restaurant")) {
    const urlConnexion = request.nextUrl.clone();
    urlConnexion.pathname = "/connexion";
    urlConnexion.searchParams.set("suite", request.nextUrl.pathname);
    return NextResponse.redirect(urlConnexion);
  }

  return reponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
