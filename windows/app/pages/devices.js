import React from 'react';
export default function Devices() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-sans">
      <header className="max-w-5xl mx-auto mb-10 flex items-center justify-between"><h2 className="text-2xl font-bold">Devices</h2><a href="/" className="text-sm text-neutral-400 hover:text-amber-500">Back</a></header>
      <div className="max-w-5xl mx-auto space-y-4">
        {[
          {name:'Windows PC', model:'Acer Nitro', active:'Just now', status:'Connected'},
          {name:'Android Phone', model:'CMF Phone', active:'2 minutes ago', status:'Connected'},
        ].map(d => (
          <div key={d.name} className="rounded-2xl border border-neutral-800 bg-neutral-900/30 px-8 py-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">{d.name}</h3>
              <p className="text-neutral-400 text-sm">{d.model} · Last active: {d.active}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full">{d.status}</span>
              <button className="text-xs font-medium text-rose-400 hover:text-rose-300 px-3 py-1 rounded-lg hover:bg-rose-400/10 transition-colors" onClick={() => alert('Revoke device: ' + d.name)}>Revoke</button>
            </div>
          </div>
        ))}
      </div>
      <section className="max-w-5xl mx-auto mt-10 rounded-3xl border border-neutral-800 bg-neutral-900/20 p-8">
        <h3 className="text-lg font-semibold mb-4">Pair a new device</h3>
        <div className="flex items-center gap-6">
          <div className="w-32 h-32 bg-neutral-800 rounded-2xl flex items-center justify-center shadow-inner">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M8 8h2M8 16h2"/></svg>
          </div>
          <div>
            <p className="text-sm text-neutral-400 mb-2">Scan this QR from your Android device to start pairing.</p>
            <button onClick={() => { alert('Pairing session started (tmp token). Scan from Android.'); }} className="rounded-xl bg-amber-500 text-neutral-950 font-semibold px-5 py-2.5 text-sm hover:bg-amber-400 transition-colors">Generate pairing code</button>
          </div>
        </div>
      </section>
    </main>
  );
}
