// RP ID must be the domain (no scheme/port) the site is actually served from —
// WebAuthn silently rejects ceremonies where it doesn't match exactly.
export const RP_NAME = "Emma's Space";
export const RP_ID = process.env.NODE_ENV === 'production' ? 'emma-tony.com' : 'localhost';
export const ORIGIN = process.env.NODE_ENV === 'production' ? 'https://emma-tony.com' : 'http://localhost:3000';
