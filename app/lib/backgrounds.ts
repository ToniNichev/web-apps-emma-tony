export interface BgOption {
  id: string;
  label: string;
  preview: string;   // gradient/color string for the picker circle
  darkText: boolean; // true = use dark text on this bg
}

export const BACKGROUNDS: BgOption[] = [
  { id: 'none',     label: 'None',    preview: '#f3f4f6',                                         darkText: true  },
  { id: 'sunset',   label: 'Sunset',  preview: 'linear-gradient(135deg,#f97316,#ec4899)',          darkText: false },
  { id: 'ocean',    label: 'Ocean',   preview: 'linear-gradient(135deg,#38bdf8,#2dd4bf)',          darkText: false },
  { id: 'purple',   label: 'Purple',  preview: 'linear-gradient(135deg,#a855f7,#ec4899)',          darkText: false },
  { id: 'forest',   label: 'Forest',  preview: 'linear-gradient(135deg,#4ade80,#2dd4bf)',          darkText: true  },
  { id: 'gold',     label: 'Gold',    preview: 'linear-gradient(135deg,#fbbf24,#f97316)',          darkText: true  },
  { id: 'midnight', label: 'Night',   preview: 'linear-gradient(135deg,#1e1b4b,#7c3aed)',         darkText: false },
  { id: 'rose',     label: 'Rose',    preview: 'linear-gradient(135deg,#fb7185,#fda4af)',          darkText: true  },
  { id: 'hearts',   label: 'Hearts',  preview: '#fce7f3',                                         darkText: true  },
  { id: 'daisies',  label: 'Daisies', preview: '#fef9c3',                                         darkText: true  },
];

export function getBg(id: string | null | undefined): BgOption {
  return BACKGROUNDS.find(b => b.id === id) ?? BACKGROUNDS[0];
}
