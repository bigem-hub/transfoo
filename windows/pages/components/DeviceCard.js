import React from 'react';
export default function DeviceCard({ name, model, active, status, onRevoke }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 px-6 py-5 flex items-center justify-between">
      <div>
        <h3 className="font-medium">{name}</h3>
        <p className="text-xs text-neutral-400">{model} · {active}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">{status}</span>
        <button onClick={onRevoke} className="text-xs text-rose-400 hover:text-rose-300 px-2 py-0.5 rounded-lg hover:bg-rose-400/10">Revoke</button>
      </div>
    </div>
  );
}
