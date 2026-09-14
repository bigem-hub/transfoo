import React, { useState, useCallback } from 'react';
export default function Transfer() {
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState({});
  const onDrop = useCallback(e => { e.preventDefault(); const newFiles = Array.from(e.dataTransfer.files).map(f => ({ name: f.name, size: f.size, type: f.type || 'file' })); setFiles(newFiles); }, []);
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-sans" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <header className="max-w-5xl mx-auto mb-10 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Send files</h2>
        <a href="/" className="text-sm text-neutral-400 hover:text-amber-500 transition-colors">Back</a>
      </header>
      <div className="max-w-5xl mx-auto rounded-3xl border-2 border-dashed border-neutral-800 p-12 flex flex-col items-center justify-center text-center hover:border-amber-500/40 transition-colors bg-neutral-900/20">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 mb-6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <h3 className="text-xl font-semibold mb-2">Drop files to send</h3>
        <p className="text-neutral-400 text-sm">Or drag onto this window. Direct local transfer to a paired Android device.</p>
        <input type="file" multiple className="hidden" id="picker" onChange={e => setFiles(Array.from(e.target.files || []).map(f => ({ name: f.name, size: f.size })))} />
        <label htmlFor="picker" className="mt-6 inline-block rounded-xl bg-neutral-800 hover:bg-neutral-700 px-6 py-3 text-sm font-medium cursor-pointer transition-colors">Choose files</label>
      </div>

      <div className="max-w-5xl mx-auto mt-10 space-y-3">
        {files.map((f, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/30 px-6 py-5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{f.name}</div>
              <div className="text-xs text-neutral-400">{(f.size / 1024 / 1024).toFixed(2)} MB · {f.type || 'File'}</div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
                <div className="h-full rounded-full bg-amber-500 w-[60%]" />
              </div>
            </div>
            <div className="text-xs text-neutral-300 font-medium">60%</div>
          </div>
        ))}
      </div>
    </main>
  );
}
