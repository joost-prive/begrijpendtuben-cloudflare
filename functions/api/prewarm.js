import { genereerVragenMetAi } from '../_lib/vragen.js';

export async function onRequestPost(context) {
  const { env, request } = context;

  let videoId = '';
  try {
    const body = await request.json();
    videoId = body.video_id || '';
  } catch {
    return Response.json({ status: 'skip' });
  }

  if (!videoId || !/^[A-Za-z0-9_\-]{11}$/.test(videoId)) {
    return Response.json({ status: 'skip' });
  }

  // Al in cache? Niks te doen.
  const cacheKey = `questions:${videoId}`;
  try {
    const cached = await env.KV.get(cacheKey);
    if (cached) return Response.json({ status: 'cached' });
  } catch {}

  const useAi = (env.USE_AI || 'false').toLowerCase() === 'true';
  const openaiApiKey = env.OPENAI_API_KEY || '';
  if (!useAi || !openaiApiKey) {
    return Response.json({ status: 'no-ai' });
  }

  // Haal video-info uit KV
  let video = null;
  try {
    const videos = await env.KV.get('active_videos', 'json');
    video = (videos || []).find(v => v.id === videoId);
  } catch {}
  if (!video) return Response.json({ status: 'unknown' });

  // Genereer vragen op de achtergrond via waitUntil
  // (het request retourneert meteen 202, de Worker draait door)
  context.waitUntil(
    (async () => {
      try {
        const vragen = await genereerVragenMetAi(videoId, video.titel, video.beschrijving, openaiApiKey);
        await env.KV.put(cacheKey, JSON.stringify(vragen));
      } catch (e) {
        console.error(`Pre-warm mislukt voor '${videoId}':`, e);
      }
    })()
  );

  return Response.json({ status: 'started' }, { status: 202 });
}
