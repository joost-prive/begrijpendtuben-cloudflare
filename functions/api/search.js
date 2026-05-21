export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const zoekterm  = (url.searchParams.get('q') || '').toLowerCase().trim();
  const catFilter = url.searchParams.get('categorie') || '';

  let alleVideos = [];
  try {
    const data = await env.KV.get('active_videos', 'json');
    if (data && Array.isArray(data)) alleVideos = data;
  } catch {}

  const resultaten = alleVideos.filter(video => {
    if (catFilter && video.categorie !== catFilter) return false;
    if (zoekterm) {
      const zoekbaar = (
        video.titel + ' ' +
        (video.kanaal || '') + ' ' +
        (video.tags || []).join(' ')
      ).toLowerCase();
      if (!zoekbaar.includes(zoekterm)) return false;
    }
    return true;
  });

  return Response.json(resultaten.slice(0, 12));
}
