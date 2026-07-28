// Split out from trivia.ts (which imports db, a server-only module) so
// client components can use the category list without pulling in DB code.
export const CATEGORIES = ['Animals', 'Space & Science', 'Geography', 'Math & Numbers', 'History', 'Fun Facts'] as const;
export type Category = typeof CATEGORIES[number];
