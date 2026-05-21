import { genereerVragenMetAi } from '../_lib/vragen.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const videoId = url.searchParams.get('video_id') || 'standaard';

  // Valideer video_id: alleen 11 alfanumerieke tekens + - en _
  if (videoId !== 'standaard' && !/^[A-Za-z0-9_\-]{11}$/.test(videoId)) {
    return Response.json({ error: 'Ongeldig video_id' }, { status: 400 });
  }

  const useAi = (env.USE_AI || 'false').toLowerCase() === 'true';
  const openaiApiKey = env.OPENAI_API_KEY || '';

  // Check cache in KV
  const cacheKey = `questions:${videoId}`;
  try {
    const cached = await env.KV.get(cacheKey, 'json');
    if (cached) {
      return Response.json({
        video_id: videoId,
        vragen: cached,
        totaal: cached.length,
        bron: useAi && openaiApiKey ? 'ai' : 'dummy',
      });
    }
  } catch {}

  // Haal video-info uit KV (nooit van de client - voorkomt prompt injection)
  let titel = 'Educatieve video';
  let beschrijving = '';

  if (videoId !== 'standaard') {
    try {
      const videos = await env.KV.get('active_videos', 'json');
      const video = (videos || []).find(v => v.id === videoId);
      if (!video) {
        return Response.json({ error: 'Video niet gevonden' }, { status: 404 });
      }
      titel = video.titel;
      beschrijving = video.beschrijving;
    } catch {}
  }

  let vragen;
  if (useAi && openaiApiKey) {
    try {
      vragen = await genereerVragenMetAi(videoId, titel, beschrijving, openaiApiKey);
      // Cache het resultaat
      await env.KV.put(cacheKey, JSON.stringify(vragen));
    } catch (e) {
      console.error('OpenAI fout:', e);
      vragen = dummyVragen();
    }
  } else {
    vragen = dummyVragen();
  }

  return Response.json({
    video_id: videoId,
    vragen,
    totaal: vragen.length,
    bron: useAi && openaiApiKey ? 'ai' : 'dummy',
  });
}

function dummyVragen() {
  return [
    {
      vraag: 'Wat heb je geleerd van dit filmpje?',
      opties: ['Iets nieuws', 'Niets nieuws', 'Ik weet het niet'],
      correct: 'Iets nieuws',
      uitleg: 'Elk filmpje leert je iets nieuws!',
    },
  ];
}
