import { Track } from './api';
import { useLikes } from '../store';

const DEEPSEEK_API_KEY = 'REDACTED_DEEPSEEK_API_KEY';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

export async function getMyWaveTracks(allTracks: Track[]): Promise<Track[]> {
  const likedIds = [...useLikes.getState().likes];

  if (likedIds.length === 0) {
    // No liked tracks - return random shuffle
    return [...allTracks].sort(() => Math.random() - 0.5).slice(0, 30);
  }

  const likedTracks = allTracks.filter((t) => likedIds.includes(t.id));
  const likedNames = likedTracks
    .slice(0, 20)
    .map((t) => `${t.artist} - ${t.title}`)
    .join('\n');

  const otherTracks = allTracks.filter((t) => !likedIds.includes(t.id));
  const otherNames = otherTracks
    .slice(0, 80)
    .map((t, i) => `${i}. ${t.artist} - ${t.title}`)
    .join('\n');

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a music recommendation engine. Given liked songs, pick the most similar tracks from a list. Return ONLY a JSON array of track indices (numbers), maximum 25. No explanation.',
          },
          {
            role: 'user',
            content: `Liked songs:\n${likedNames}\n\nAvailable tracks (pick by index):\n${otherNames}`,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!res.ok) throw new Error('DeepSeek API error');
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    const match = content.match(/\[[\d,\s]+\]/);
    if (match) {
      const indices: number[] = JSON.parse(match[0]);
      const recommended = indices
        .filter((i) => i >= 0 && i < otherTracks.length)
        .map((i) => otherTracks[i])
        .filter(Boolean);
      // Mix recommended with some liked
      const mixed = [
        ...likedTracks.sort(() => Math.random() - 0.5).slice(0, 5),
        ...recommended,
      ].sort(() => Math.random() - 0.5);
      return mixed.slice(0, 30);
    }
  } catch (e) {
    console.warn('MyWave DeepSeek error:', e);
  }

  // Fallback: random mix with liked boosted
  return [
    ...likedTracks.sort(() => Math.random() - 0.5),
    ...otherTracks.sort(() => Math.random() - 0.5).slice(0, 20),
  ].slice(0, 30);
}
