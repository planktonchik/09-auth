import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parse } from 'cookie';
import { checkServerSession } from './lib/api/serverApi';

const privateRoutes = ['/profile', '/notes'];
const publicRoutes = ['/sign-in', '/sign-up'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  const refreshToken = cookieStore.get('refreshToken')?.value;

  // Перевірка, чи маршрут є приватним або публічним
  const isPublicRoute = publicRoutes.some((route) => pathname.includes(route));
  const isPrivateRoute = privateRoutes.some((route) => pathname.includes(route));

  // Якщо немає accessToken, але є refreshToken — намагаємося оновити сесію
  if (!accessToken) {
    if (refreshToken) {
      const data = await checkServerSession();
      const setCookie = data.headers['set-cookie'];

      if (setCookie) {
        const cookieArray = Array.isArray(setCookie) ? setCookie : [setCookie];
        for (const cookieStr of cookieArray) {
          const parsed = parse(cookieStr);
          const options = {
            expires: parsed.Expires ? new Date(parsed.Expires) : undefined,
            path: parsed.Path,
            maxAge: Number(parsed['Max-Age']),
          };
          if (parsed.accessToken) cookieStore.set('accessToken', parsed.accessToken, options);
          if (parsed.refreshToken) cookieStore.set('refreshToken', parsed.refreshToken, options);
        }

        // Якщо маршрут публічний, редірект на головну
        if (isPublicRoute) {
          return NextResponse.redirect(new URL('/', request.nextUrl.origin), {
            headers: {
              Cookie: cookieStore.toString(),
            },
          });
        }
        // Якщо маршрут приватний, дозволяємо доступ
        if (isPrivateRoute) {
          return NextResponse.next({
            headers: {
              Cookie: cookieStore.toString(),
            },
          });
        }
      }
    }

    // Якщо ні accessToken, ні refreshToken немає
    if (isPublicRoute) {
      return NextResponse.next();
    }
    if (isPrivateRoute) {
      return NextResponse.redirect(new URL('/sign-in', request.nextUrl.origin));
    }
  }

  // Якщо accessToken існує
  if (isPublicRoute) {
    return NextResponse.redirect(new URL('/', request.nextUrl.origin));
  }
  if (isPrivateRoute) {
    return NextResponse.next();
  }

  // Обробка за замовчуванням для невідповідних маршрутів
  return NextResponse.next();
}

export const config = {
  matcher: ['/profile/:path*', '/notes/:path*', '/sign-in', '/sign-up'],
};