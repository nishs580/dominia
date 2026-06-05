// lib/timeAgo.js
// First relative-time util in the repo. Used by ActivityLogEvent renderers (Prompt 3).
// Output is Geist Mono uppercase compact form: NOW, 3M AGO, 2H AGO, 5D AGO, MAR 14.

export function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'NOW';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}M AGO`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}H AGO`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}D AGO`;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}
