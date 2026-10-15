'use client';
import { usePathname } from 'next/navigation';
import DreamSky from './DreamSky';

// The quiet Dream Sky behind every page that doesn't bring its own. It lives in the root
// layout, so the sky (and any ballerina mid-dance) carries on unbroken as you move between
// pages. Pages with their own sky (the feed and profiles light lanterns from real posts; login,
// signup and password reset get the full sky) are skipped, as are full-screen pages that
// cover it anyway (the Unity game, hangout and drawing rooms, video calls), so nothing animates
// out of sight.
const OWN_SKY = [/^\/$/, /^\/login/, /^\/signup/, /^\/forgot-password/, /^\/profile\//];
const COVERED = [/^\/play\/emmas-world/, /^\/play\/hangout\/[^/]+/, /^\/play\/draw\/[^/]+/, /^\/video\//];

export default function SiteSky() {
  const pathname = usePathname() ?? '';
  if ([...OWN_SKY, ...COVERED].some(pattern => pattern.test(pathname))) return null;
  return <DreamSky quiet seed={5} />;
}
