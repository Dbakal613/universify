import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });
  const loginResponse = NextResponse.redirect(new URL("/login", request.url));
  const homeResponse = NextResponse.redirect(new URL("/", request.url));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          [supabaseResponse, loginResponse, homeResponse].forEach(
            (response) => {
              cookiesToSet.forEach(({ name, value, options }) => {
                response.cookies.set(name, value, options);
              });

              Object.entries(headers).forEach(([key, value]) => {
                response.headers.set(key, value);
              });
            }
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = !error && Boolean(data?.claims.sub);
  const isAuthPage =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/signup";
  const isApiRoute =
    request.nextUrl.pathname === "/api" ||
    request.nextUrl.pathname.startsWith("/api/");

  if (isApiRoute) {
    return supabaseResponse;
  }

  if (!isAuthenticated && !isAuthPage) {
    return loginResponse;
  }

  if (isAuthenticated && isAuthPage) {
    return homeResponse;
  }

  return supabaseResponse;
}
