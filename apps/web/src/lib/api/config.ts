/** Only NEXT_PUBLIC_API_URL is read on the client. Never put secrets here. */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");
export const API_PREFIX = `${API_BASE_URL}/api/v1`;
