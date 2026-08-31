'use client';

import { useActionState } from 'react';
import { login, type LoginState } from './actions';

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <main className="wrap">
      <header className="head">
        <h1>舍監管理登入</h1>
        <p className="sub">夜間點名看板</p>
      </header>
      <form action={action} className="card">
        <label className="field">
          <span>管理密碼</span>
          <input type="password" name="password" autoFocus placeholder="請輸入密碼" />
        </label>
        {state.error && <p className="err">{state.error}</p>}
        <button className="btn primary" disabled={pending}>
          {pending ? '登入中…' : '登入'}
        </button>
      </form>
    </main>
  );
}
