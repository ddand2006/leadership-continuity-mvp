import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const redirectUrl = new URL(
    "/auth?message=Session+reset.+Please+sign+in+again.",
    request.url,
  );
  const response = NextResponse.redirect(redirectUrl);

  for (const cookie of cookieStore.getAll()) {
    if (!cookie.name.startsWith("sb-")) {
      continue;
    }

    cookieStore.delete(cookie.name);
    response.cookies.set(cookie.name, "", {
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
  }

  return response;
}
