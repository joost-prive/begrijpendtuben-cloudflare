import { KANALEN, MAX_VIDEOS, ROTATIE_BATCH, ROTATIE_DAGEN } from '../_lib/kanalen.js';
import { classificeerNiveau } from '../_lib/niveau.js';
import { fetchRssVideos, filterOpDuur } from '../_lib/youtube.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const niveau = url.searchParams.get('niveau') || 'alles';

  let videos = await haalEnRoteerVideos(env);

  if (niveau === 'onderbouw' || niveau === 'bovenbouw') {
    videos = videos.filter(v => {
      const vn = v.niveau || 'alles';
      return vn === niveau || vn === 'alles';
    });
  }

  return Response.json(videos);
}

async function haalEnRoteerVideos(env) {
  const KV = env.KV;
  const youtubeApiKey = env.YOUTUBE_API_KEY || '';

  // Laad actieve videos uit KV
  let actieve = [];
  try {
    const data = await KV.get('active_videos', 'json');
    if (data && Array.isArray(data)) actieve = data;
  } catch {}

  const nu = new Date();

  // Voeg niveau toe aan videos zonder het veld
  let gewijzigd = false;
  for (const v of actieve) {
    if (!v.niveau) {
      v.niveau = classificeerNiveau(v.titel || '', v.beschrijving || '');
      gewijzigd = true;
    }
  }

  // Haal videos op voor kanalen die nog niet vertegenwoordigd zijn
  const kanalenAanwezig = new Set(actieve.map(v => v.kanaal));
  const ontbrekende = KANALEN.filter(k => !kanalenAanwezig.has(k.naam));
  if (ontbrekende.length > 0 && actieve.length >= 5) {
    const bestaandeIds = new Set(actieve.map(v => v.id));
    for (const k of ontbrekende) {
      let nieuw = await fetchRssVideos(k.channel_id, k.naam, k.categorie, k.emoji);
      nieuw = await filterOpDuur(nieuw, youtubeApiKey);
      const teVoegen = nieuw.filter(v => !bestaandeIds.has(v.id)).slice(0, 5);
      actieve.push(...teVoegen);
      teVoegen.forEach(v => bestaandeIds.add(v.id));
    }
    gewijzigd = true;
  }

  // Eerste keer of bijna leeg: vul vanuit RSS
  if (actieve.length < 5) {
    let alle = [];
    for (const k of KANALEN) {
      const rss = await fetchRssVideos(k.channel_id, k.naam, k.categorie, k.emoji);
      alle.push(...rss);
    }
    if (alle.length > 0) {
      alle = await filterOpDuur(alle, youtubeApiKey);
      actieve = alle.slice(0, MAX_VIDEOS);
      await KV.put('active_videos', JSON.stringify(actieve));
    }
    return actieve;
  }

  // Controleer of wekelijkse rotatie nodig is
  actieve.sort((a, b) => (a.toegevoegd || '2000-01-01').localeCompare(b.toegevoegd || '2000-01-01'));
  let oudsteDatum;
  try {
    oudsteDatum = new Date(actieve[0].toegevoegd);
  } catch {
    oudsteDatum = new Date(nu.getTime() - 8 * 86400000);
  }

  const dagenOud = (nu - oudsteDatum) / 86400000;

  if (dagenOud >= ROTATIE_DAGEN) {
    // Rotatie: verwijder oudste, voeg nieuw toe
    actieve = actieve.slice(ROTATIE_BATCH);
    const bestaandeIds = new Set(actieve.map(v => v.id));

    let alleNieuw = [];
    for (const k of KANALEN) {
      const rss = await fetchRssVideos(k.channel_id, k.naam, k.categorie, k.emoji, 15);
      alleNieuw.push(...rss);
    }
    alleNieuw = await filterOpDuur(alleNieuw, youtubeApiKey);
    const teVoegen = alleNieuw.filter(v => !bestaandeIds.has(v.id)).slice(0, ROTATIE_BATCH);
    actieve.push(...teVoegen);
    gewijzigd = true;
  }

  if (gewijzigd) {
    await KV.put('active_videos', JSON.stringify(actieve));
  }

  return actieve;
}
