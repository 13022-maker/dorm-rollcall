'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const pw = String(formData.get('password') ?? '');
  if (pw && pw === process.env.ADMIN_PASSWORD) {
    const jar = await cookies();
    jar.set('dorm_admin', process.env.ADMIN_TOKEN ?? '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12, // 12 小時
      secure: process.env.NODE_ENV === 'production',
    });
    redirect('/admin');
  }
  return { error: '密碼錯誤' };
}
