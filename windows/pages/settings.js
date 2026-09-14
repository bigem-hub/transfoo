import React from 'react';
export default function Settings() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-sans">
      <header className="max-w-5xl mx-auto mb-10 flex items-center justify-between"><h2 className="text-2xl font-bold">Settings</h2><a href="/" className="text-sm text-neutral-400 hover:text-amber-500">Back</a></header>
      <div className="max-w-5xl mx-auto space-y-4">
        {[
          {title:'Account', desc:'Update email, password, profile'},
          {title:'Security', desc:'Trusted devices, pairing sessions'},
          {title:'Notifications', desc:'Transfer complete, incoming file'},
          {title:'System', desc:'Start with Windows, tray behavior'},
        ].map(s => (
          <a key={s.title} href="#" className="block rounded-2xl border border-neutral-800 bg-neutral-900/30 px-8 py-6 hover:border-amber-500/30 transition-colors">
            <h3 className="font-medium mb-1">{s.title}</h3>
            <p className="text-sm text-neutral-400">{s.desc}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
