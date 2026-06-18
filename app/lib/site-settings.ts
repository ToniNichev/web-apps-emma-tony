import db from './db';

export interface SiteSettings {
  site_name: string;
  site_tagline: string;
  default_theme: string;
  banner_enabled: string;
  banner_text: string;
  banner_image: string;
  banner_bg: string;
  luna_name: string;
  luna_persona: string;
}

export const DEFAULT_LUNA_PERSONA = 'You love talking about art, animals, music, creative stories, fun facts, jokes, and games like 20 questions or would-you-rather. Be encouraging, upbeat, and use emojis naturally but not excessively.';

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
    luna_name:      map.luna_name      || 'Luna',
    luna_persona:   map.luna_persona   || DEFAULT_LUNA_PERSONA,
  };
}
