// Falls back to localhost:3001 for local development if VITE_API_URL
// isn't set. Set VITE_API_URL in frontend/.env to point at a deployed
// backend.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
