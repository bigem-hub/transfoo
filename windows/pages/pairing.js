import React, { useState, useEffect } from 'react';
export default function Pairing() {
  const [code, setCode] = useState('');
  useEffect(() => { setCode('TRF-' + Math.random().toString(36).slice(2, 8).toUpperCase()); }, []);
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-sans flex items-center justify-center">
      <div className="max-w-lg w-full rounded-3xl border border-neutral-800 bg-neutral-900/60 p-10 text-center shadow-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Pair device</h1>
        <p className="text-neutral-400 text-sm mb-8">Temporary session. No permanent credentials in this code.</p>
        <div className="w-48 h-48 mx-auto bg-neutral-950 rounded-2xl border border-neutral-800 flex items-center justify-center mb-6 shadow-inner">
          <svg width="160" height="160" viewBox="0 0 100 100" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="square"><rect x="10" y="10" width="30" height="30"/><rect x="60" y="10" width="30" height="30"/><rect x="10" y="60" width="30" height="30"/><rect x="60" y="60" width="30" height="30"/><rect x="35" y="35" width="30" height="30"/></svg>
        </div>
        <div className="font-mono text-2xl tracking-widest text-amber-400 mb-2">{code}</div>
        <p className="text-xs text-neutral-500 mb-8">Expires in 5 minutes. Scan from Android app.</p>
        <button onClick={() => alert('Pairing confirmed. Device added to trusted devices.')} className="rounded-xl bg-amber-500 text-neutral-950 font-semibold px-8 py-3 hover:bg-amber-400 transition-colors">Confirm pairing</button>
      </div>
    </main>
  );
}
