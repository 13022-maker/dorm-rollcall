import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 保護整個 /admin，但放行 /admin/login
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/admin/login')) return NextResponse.next();

  const token = req.cookies.get('dorm_admin')?.value;
  if (token !== process.env.ADMIN_TOKEN) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
