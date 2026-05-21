import { KANALEN } from '../_lib/kanalen.js';

export async function onRequestGet(context) {
  const { env } = context;
  const useAi = (env.USE_AI || 'false').toLowerCase() === 'true';
  const openaiApiKey = env.OPENAI_API_KEY || '';

  let aantalVideos = 0;
  try {
    const data = await env.KV.get('active_videos', 'json');
    if (data && Array.isArray(data)) aantalVideos = data.length;
  } catch {}

  return Response.json({
    ai_actief:         useAi && !!openaiApiKey,
    model:             useAi ? 'gpt-4o-mini' : 'dummy',
    api_key_ingesteld: !!openaiApiKey,
    actieve_videos:    aantalVideos,
    kanalen:           KANALEN.map(k => k.naam),
  });
}
