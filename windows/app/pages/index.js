import React from 'react';
export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-sans selection:bg-amber-500/30">
      <header className="max-w-5xl mx-auto mb-16">
        <h1 className="text-5xl font-extrabold tracking-tight">Transfo</h1>
        <p className="text-neutral-400 mt-3 text-lg">Account-based file transfer. Direct over your local network.</p>
      </header>

      <section className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
        <a href="#" className="group block rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 hover:border-amber-500/40 transition-colors shadow-none hover:shadow-[0_0_40px_-12px_rgba(245,158,11,0.15)]">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Send files</h2>
          <p className="text-neutral-400 text-sm leading-relaxed">Select files from your PC, choose a paired device, and start a direct local transfer.</p>
        </a>
        <a href="#" className="group block rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 hover:border-amber-500/40 transition-colors shadow-none hover:shadow-[0_0_40px_-12px_rgba(245,158,11,0.15)]">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M8 8h2M8 16h2"/></svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Devices</h2>
          <p className="text-neutral-400 text-sm leading-relaxed">Manage paired devices, revoke access, and see connection status.</p>
        </a>
        <a href="#" className="group block rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 hover:border-amber-500/40 transition-colors shadow-none hover:shadow-[0_0_40px_-12px_rgba(245,158,11,0.15)]">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Pair with QR</h2>
          <p className="text-neutral-400 text-sm leading-relaxed">Generate a short-lived pairing session. Scan from Android. No permanent passwords in QR.</p>
        </a>
      </section>

      <section className="max-w-5xl mx-auto mt-20">
        <h3 className="text-2xl font-semibold mb-8">Connected devices</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">Windows PC</h4>
              <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2.5 py-0.5 rounded-full">Connected</span>
            </div>
            <p className="text-neutral-500 text-sm">Acer Nitro · Last active: Just now</p>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">Android Phone</h4>
              <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2.5 py-0.5 rounded-full">Connected</span>
            </div>
            <p className="text-neutral-500 text-sm">CMF Phone · Last active: 2 minutes ago</p>
          </div>
        </div>
      </section>
    </main>
  );
}
