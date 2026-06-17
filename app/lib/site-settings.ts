import db from './db';

export interface SiteSettings {
  site_name: string;
  site_tagline: string;
  default_theme: string;
  banner_enabled: string;
  banner_text: string;
  banner_image: string;
  banner_bg: string;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const [rows] = await db.execute('SELECT `key`, `value` FROM site_settings') as any[];
  const map: Record<string, string> = {};
  for (const row of rows as any[]) map[row.key] = row.value ?? '';
  return {
    site_name:      map.site_name      || "Emma's Space",
    site_tagline:   map.site_tagline   || '',
    default_theme:  map.default_theme  || 'bloom',
    banner_enabled: map.banner_enabled || '0',
    banner_text:    map.banner_text    || '',
    banner_image:   map.banner_image   || '',
    banner_bg:      map.banner_bg      || 'none',
  };
}
