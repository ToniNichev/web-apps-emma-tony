interface ShieldResult { violates: boolean; raw: string; }

async function shieldCheck(messages: { role: 'user' | 'assistant'; content: string }[]): Promise<ShieldResult> {
  try {
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'shieldgemma:2b', messages, stream: false }),
    });
    if (!res.ok) return { violates: true, raw: '' };
    const data = await res.json();
    const content: string = data.message?.content?.trim() ?? '';
    return { violates: content.toLowerCase().startsWith('yes'), raw: content };
  } catch {
    // Moderation service unreachable — fail closed, not open.
    return { violates: true, raw: '' };
  }
}

export async function isPromptSafe(prompt: string): Promise<boolean> {
  const { violates } = await shieldCheck([{ role: 'user', content: prompt }]);
  return !violates;
}

export async function isResponseSafe(prompt: string, response: string): Promise<boolean> {
  const { violates } = await shieldCheck([
    { role: 'user', content: prompt },
    { role: 'assistant', content: response },
  ]);
  return !violates;
}
