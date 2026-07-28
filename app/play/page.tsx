import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/auth';

export const dynamic = 'force-dynamic';

const GAMES = [
  { href: '/play/draw', emoji: '🎨', title: 'Draw & Guess', description: 'Take turns drawing and guessing the word!' },
  { href: '/play/hangout', emoji: '🏡', title: 'Hangout Room', description: 'Walk around, chat, and decorate a shared space with friends.' },
  { href: '/play/rps', emoji: '✊', title: 'Rock-Paper-Scissors', description: 'Challenge a friend — first to 3 wins!' },
  { href: '/play/trivia', emoji: '🧠', title: 'Trivia Duel', description: 'Test your knowledge — 8 questions, most correct wins!' },
];

export default async function PlayHubPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <main className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      <div className="mb-5">
        <h1 className="text-2xl font-bold brand-text">Play 🎮</h1>
        <p className="text-sm text-gray-400 mt-1">Games to play together with friends</p>
      </div>
      <div className="space-y-3">
        {GAMES.map(g => (
          <Link
            key={g.href}
            href={g.href}
            className="card flex items-center gap-4 p-5 hover:bg-purple-50 transition"
          >
            <span className="text-4xl">{g.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-800">{g.title}</p>
              <p className="text-sm text-gray-400 mt-0.5">{g.description}</p>
            </div>
            <span className="text-purple-400 text-sm font-semibold flex-shrink-0">Play →</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
