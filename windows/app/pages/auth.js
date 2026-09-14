import React, { useState } from 'react';
export default function Auth() {
  const [mode, setMode] = useState('login');
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900/60 p-10 shadow-2xl backdrop-blur-sm">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Transfo</h1>
        <p className="text-neutral-400 text-sm mb-8">{mode === 'login' ? 'Sign in to your account' : 'Create a new account'}</p>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); window.location.href = '/'; }}>
          <input type="email" placeholder="Email address" className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition-colors" required />
          <input type="password" placeholder={mode === 'login' ? 'Password' : 'Create password'} className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition-colors" required />
          <button type="submit" className="w-full rounded-xl bg-amber-500 text-neutral-950 font-semibold py-3 hover:bg-amber-400 transition-colors">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <div className="mt-6 text-center text-sm text-neutral-400">
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="underline hover:text-neutral-200">{mode === 'login' ? 'Need an account?' : 'Already have an account?'}</button>
        </div>
      </div>
    </main>
  );
}
