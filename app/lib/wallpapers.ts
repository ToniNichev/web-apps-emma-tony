import type { CSSProperties } from 'react';

export interface Wallpaper {
  id: string;
  label: string;
  preview: string;   // CSS value for the swatch circle
  style: CSSProperties;
  dark?: boolean;
}

// ── SVG patterns (URL-encoded for CSS background-image) ───
const HEARTS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath fill='%23f472b6' fill-opacity='0.4' d='M20 30C15 27 7 22 7 16 7 11.5 10.5 8.5 14.5 8.5 16.5 8.5 18 9.5 20 12 22 9.5 23.5 8.5 25.5 8.5 29.5 8.5 33 11.5 33 16 33 22 25 27 20 30Z'/%3E%3C/svg%3E")`;

const DAISIES = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50'%3E%3Cellipse cx='25' cy='16' rx='3.5' ry='7' fill='white' opacity='0.85'/%3E%3Cellipse cx='25' cy='16' rx='3.5' ry='7' fill='white' opacity='0.85' transform='rotate(60 25 25)'/%3E%3Cellipse cx='25' cy='16' rx='3.5' ry='7' fill='white' opacity='0.85' transform='rotate(120 25 25)'/%3E%3Cellipse cx='25' cy='16' rx='3.5' ry='7' fill='white' opacity='0.85' transform='rotate(180 25 25)'/%3E%3Cellipse cx='25' cy='16' rx='3.5' ry='7' fill='white' opacity='0.85' transform='rotate(240 25 25)'/%3E%3Cellipse cx='25' cy='16' rx='3.5' ry='7' fill='white' opacity='0.85' transform='rotate(300 25 25)'/%3E%3Ccircle cx='25' cy='25' r='6' fill='%23fbbf24'/%3E%3C/svg%3E")`;

const STARS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='10' cy='10' r='1.5' fill='white' opacity='0.7'/%3E%3Ccircle cx='35' cy='5' r='1' fill='white' opacity='0.5'/%3E%3Ccircle cx='55' cy='20' r='1.5' fill='white' opacity='0.7'/%3E%3Ccircle cx='20' cy='40' r='1' fill='white' opacity='0.5'/%3E%3Ccircle cx='50' cy='45' r='1.5' fill='white' opacity='0.6'/%3E%3Ccircle cx='5' cy='55' r='1' fill='white' opacity='0.5'/%3E%3Ccircle cx='30' cy='55' r='2' fill='white' opacity='0.8'/%3E%3C/svg%3E")`;

const BUTTERFLIES = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='50'%3E%3Cellipse cx='28' cy='18' rx='14' ry='9' fill='%23f9a8d4' opacity='0.85' transform='rotate(-20 28 18)'/%3E%3Cellipse cx='42' cy='18' rx='14' ry='9' fill='%23c4b5fd' opacity='0.85' transform='rotate(20 42 18)'/%3E%3Cellipse cx='30' cy='28' rx='9' ry='6' fill='%23f472b6' opacity='0.6' transform='rotate(20 30 28)'/%3E%3Cellipse cx='40' cy='28' rx='9' ry='6' fill='%23a78bfa' opacity='0.6' transform='rotate(-20 40 28)'/%3E%3Cellipse cx='35' cy='22' rx='2' ry='8' fill='%23a1a1aa'/%3E%3C/svg%3E")`;

const POLKA = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='15' cy='15' r='7' fill='%23f472b6' opacity='0.7'/%3E%3Ccircle cx='45' cy='12' r='5' fill='%2360a5fa' opacity='0.7'/%3E%3Ccircle cx='8' cy='45' r='5' fill='%234ade80' opacity='0.7'/%3E%3Ccircle cx='46' cy='46' r='7' fill='%23fbbf24' opacity='0.7'/%3E%3Ccircle cx='30' cy='33' r='5' fill='%23a78bfa' opacity='0.7'/%3E%3C/svg%3E")`;

const PAWS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cellipse cx='32' cy='42' rx='12' ry='10' fill='%23f9a8d4' opacity='0.85'/%3E%3Cellipse cx='16' cy='28' rx='7' ry='8' fill='%23f9a8d4' opacity='0.85'/%3E%3Cellipse cx='48' cy='28' rx='7' ry='8' fill='%23f9a8d4' opacity='0.85'/%3E%3Cellipse cx='24' cy='18' rx='6' ry='7' fill='%23f9a8d4' opacity='0.85'/%3E%3Cellipse cx='40' cy='18' rx='6' ry='7' fill='%23f9a8d4' opacity='0.85'/%3E%3C/svg%3E")`;

const RAINBOW = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='42'%3E%3Crect width='40' height='6' y='0' fill='%23f87171' opacity='0.65'/%3E%3Crect width='40' height='6' y='6' fill='%23fb923c' opacity='0.65'/%3E%3Crect width='40' height='6' y='12' fill='%23fbbf24' opacity='0.65'/%3E%3Crect width='40' height='6' y='18' fill='%234ade80' opacity='0.65'/%3E%3Crect width='40' height='6' y='24' fill='%2360a5fa' opacity='0.65'/%3E%3Crect width='40' height='6' y='30' fill='%23a78bfa' opacity='0.65'/%3E%3Crect width='40' height='6' y='36' fill='%23f472b6' opacity='0.65'/%3E%3C/svg%3E")`;

const FLOWERS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cellipse cx='30' cy='20' rx='5' ry='10' fill='%23f472b6' opacity='0.75'/%3E%3Cellipse cx='30' cy='20' rx='5' ry='10' fill='%23f9a8d4' opacity='0.75' transform='rotate(72 30 30)'/%3E%3Cellipse cx='30' cy='20' rx='5' ry='10' fill='%23fda4af' opacity='0.75' transform='rotate(144 30 30)'/%3E%3Cellipse cx='30' cy='20' rx='5' ry='10' fill='%23f472b6' opacity='0.75' transform='rotate(216 30 30)'/%3E%3Cellipse cx='30' cy='20' rx='5' ry='10' fill='%23f9a8d4' opacity='0.75' transform='rotate(288 30 30)'/%3E%3Ccircle cx='30' cy='30' r='7' fill='%23fbbf24'/%3E%3C/svg%3E")`;

const ICECREAM = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='60'%3E%3Ccircle cx='20' cy='18' r='14' fill='%23f9a8d4'/%3E%3Ccircle cx='14' cy='13' r='5' fill='%23fda4af'/%3E%3Ccircle cx='26' cy='11' r='4' fill='%23fecdd3'/%3E%3Cpolygon points='8,30 32,30 20,58' fill='%23fbbf24'/%3E%3Cline x1='15' y1='39' x2='20' y2='57' stroke='%23d97706' stroke-width='1.5'/%3E%3Cline x1='25' y1='39' x2='20' y2='57' stroke='%23d97706' stroke-width='1.5'/%3E%3C/svg%3E")`;

const SPARKLES = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='70' height='70'%3E%3Cpath d='M20 6 L22.5 17 L34 20 L22.5 23 L20 34 L17.5 23 L6 20 L17.5 17Z' fill='%23fbbf24' opacity='0.9'/%3E%3Cpath d='M53 28 L54.5 36 L62 38 L54.5 40 L53 48 L51.5 40 L44 38 L51.5 36Z' fill='%23f472b6' opacity='0.9'/%3E%3Cpath d='M14 52 L15 57 L20 58 L15 59 L14 64 L13 59 L8 58 L13 57Z' fill='%2360a5fa' opacity='0.9'/%3E%3Ccircle cx='52' cy='12' r='2' fill='%23a78bfa' opacity='0.8'/%3E%3Ccircle cx='10' cy='30' r='1.5' fill='%234ade80' opacity='0.8'/%3E%3C/svg%3E")`;

const CLOUDS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='56'%3E%3Ccircle cx='28' cy='34' r='13' fill='white' opacity='0.9'/%3E%3Ccircle cx='42' cy='26' r='17' fill='white' opacity='0.9'/%3E%3Ccircle cx='58' cy='34' r='12' fill='white' opacity='0.9'/%3E%3Crect x='16' y='34' width='55' height='12' fill='white' opacity='0.9'/%3E%3Ccircle cx='72' cy='16' r='5' fill='%23fde68a' opacity='0.8'/%3E%3Ccircle cx='14' cy='14' r='3' fill='%23fde68a' opacity='0.6'/%3E%3C/svg%3E")`;

const UNICORN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M30 8 L32 22 L36 22 L30 8Z' fill='%23fbbf24'/%3E%3Ccircle cx='30' cy='28' r='14' fill='%23f9a8d4'/%3E%3Cellipse cx='24' cy='34' rx='3' ry='4' fill='%23fda4af'/%3E%3Cellipse cx='36' cy='34' rx='3' ry='4' fill='%23fda4af'/%3E%3Ccircle cx='26' cy='24' r='2' fill='%23374151'/%3E%3Ccircle cx='34' cy='24' r='2' fill='%23374151'/%3E%3Cpath d='M24 38 Q30 42 36 38' stroke='%23f472b6' stroke-width='1.5' fill='none'/%3E%3Cpath d='M18 18 Q16 10 22 12' stroke='%23a78bfa' stroke-width='2' fill='none'/%3E%3Cpath d='M42 18 Q44 10 38 12' stroke='%23f472b6' stroke-width='2' fill='none'/%3E%3C/svg%3E")`;

// ── Wallpaper list ────────────────────────────────────────
export const WALLPAPERS: Wallpaper[] = [
  // Plain
  { id: 'none',        label: 'None',        preview: '#f9fafb', style: {} },
  { id: 'pink',        label: 'Pink',        preview: '#fce7f3', style: { backgroundColor: '#fce7f3' } },
  { id: 'lavender',    label: 'Lavender',    preview: '#f3e8ff', style: { backgroundColor: '#f3e8ff' } },
  { id: 'mint',        label: 'Mint',        preview: '#d1fae5', style: { backgroundColor: '#d1fae5' } },
  { id: 'sky',         label: 'Sky',         preview: '#e0f2fe', style: { backgroundColor: '#e0f2fe' } },
  { id: 'peach',       label: 'Peach',       preview: '#fff7ed', style: { backgroundColor: '#fff7ed' } },
  { id: 'lemon',       label: 'Lemon',       preview: '#fefce8', style: { backgroundColor: '#fefce8' } },
  // Gradients
  { id: 'sunset',      label: 'Sunset',      preview: 'linear-gradient(135deg,#f97316,#ec4899)', style: { background: 'linear-gradient(135deg,#f97316,#ec4899)' }, dark: true },
  { id: 'ocean',       label: 'Ocean',       preview: 'linear-gradient(135deg,#38bdf8,#2dd4bf)', style: { background: 'linear-gradient(135deg,#38bdf8,#2dd4bf)' }, dark: true },
  { id: 'purple',      label: 'Purple',      preview: 'linear-gradient(135deg,#a855f7,#ec4899)', style: { background: 'linear-gradient(135deg,#a855f7,#ec4899)' }, dark: true },
  { id: 'midnight',    label: 'Night',       preview: 'linear-gradient(135deg,#1e1b4b,#7c3aed)', style: { background: 'linear-gradient(135deg,#1e1b4b,#7c3aed)' }, dark: true },
  { id: 'rose',        label: 'Rose',        preview: 'linear-gradient(135deg,#fb7185,#fda4af)', style: { background: 'linear-gradient(135deg,#fb7185,#fda4af)' }, dark: true },
  // Patterns — classic
  { id: 'hearts',      label: 'Hearts',      preview: '#fce7f3', style: { backgroundColor: '#fce7f3', backgroundImage: HEARTS,      backgroundSize: '40px 40px' } },
  { id: 'daisies',     label: 'Daisies',     preview: '#fef9c3', style: { backgroundColor: '#fef9c3', backgroundImage: DAISIES,     backgroundSize: '50px 50px' } },
  { id: 'stars',       label: 'Stars',       preview: 'linear-gradient(135deg,#0f172a,#1e1b4b)', style: { backgroundColor: '#0f172a', backgroundImage: STARS,       backgroundSize: '60px 60px' }, dark: true },
  // Patterns — fun
  { id: 'butterflies', label: 'Butterflies', preview: '#f5f3ff', style: { backgroundColor: '#f5f3ff', backgroundImage: BUTTERFLIES, backgroundSize: '70px 50px' } },
  { id: 'flowers',     label: 'Flowers',     preview: '#fce7f3', style: { backgroundColor: '#fff7f0', backgroundImage: FLOWERS,     backgroundSize: '60px 60px' } },
  { id: 'paws',        label: 'Paw prints',  preview: '#ffe4e6', style: { backgroundColor: '#fff0f5', backgroundImage: PAWS,        backgroundSize: '64px 64px' } },
  { id: 'polka',       label: 'Polka dots',  preview: 'white',   style: { backgroundColor: 'white',   backgroundImage: POLKA,       backgroundSize: '60px 60px' } },
  { id: 'rainbow',     label: 'Rainbow',     preview: 'linear-gradient(to bottom,#f87171,#fb923c,#fbbf24,#4ade80,#60a5fa,#a78bfa)', style: { backgroundColor: 'white', backgroundImage: RAINBOW, backgroundSize: '40px 42px' } },
  { id: 'icecream',    label: 'Ice cream',   preview: '#d1fae5', style: { backgroundColor: '#ecfdf5', backgroundImage: ICECREAM,    backgroundSize: '40px 60px' } },
  { id: 'sparkles',    label: 'Sparkles',    preview: '#fefce8', style: { backgroundColor: '#fefce8', backgroundImage: SPARKLES,    backgroundSize: '70px 70px' } },
  { id: 'clouds',      label: 'Clouds',      preview: '#bfdbfe', style: { backgroundColor: '#bfdbfe', backgroundImage: CLOUDS,      backgroundSize: '90px 56px' } },
  { id: 'unicorn',     label: 'Unicorn',     preview: 'linear-gradient(135deg,#f9a8d4,#c4b5fd)', style: { backgroundColor: '#fdf4ff', backgroundImage: UNICORN, backgroundSize: '60px 60px' } },
];
