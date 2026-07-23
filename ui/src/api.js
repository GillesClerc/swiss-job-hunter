export const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8765";

// Optional shared-secret sent with every request. Baked into the frontend
// bundle at build time (same mechanism as VITE_API_BASE_URL). Only meaningful
// once the backend is also configured with a matching API_KEY — see
// config/settings.py. Leave both unset to keep today's no-auth behavior
// (fine for localhost/Tailscale-only deployments).
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

/** fetch() wrapper that attaches the shared API key header when configured. */
export function apiFetch(url, options = {}) {
  if (!API_KEY) return fetch(url, options);
  return fetch(url, { ...options, headers: { ...(options.headers || {}), "X-API-Key": API_KEY } });
}
