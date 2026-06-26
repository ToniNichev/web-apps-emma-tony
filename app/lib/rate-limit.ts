const store = new Map<string, number[]>();

// Returns true if the request is allowed, false if rate limit exceeded.
// limit: max requests; windowMs: sliding window in ms.
export function rateLimit(ip: string, limit = 10, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const hits = (store.get(ip) ?? []).filter(t => now - t < windowMs);
  if (hits.length >= limit) return false;
  hits.push(now);
  store.set(ip, hits);
  return true;
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
