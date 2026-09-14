import React from 'react';
export default function Notification({ title, body }) {
  return (
    <div className="fixed bottom-6 right-6 rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl px-5 py-4 max-w-sm animate-[fadeIn_0.3s_ease]">
      <h4 className="font-semibold text-sm">{title}</h4>
      <p className="text-neutral-400 text-xs mt-1">{body}</p>
    </div>
  );
}
