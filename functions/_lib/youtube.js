import { MAX_DUUR_SEC } from './kanalen.js';
import { classificeerNiveau } from './niveau.js';

const CREDITS_KW = [
  'Credits:', 'credits:', 'Regie:', 'regie:', 'Animatie:', 'animatie:',
  'Productie:', 'productie:', 'Camera:', 'camera:', 'Muziek:', 'muziek:',
  'Tekst en regie', 'tekst en regie', 'Een productie van', 'een productie van',
  'Met dank aan', 'met dank aan', 'Meer informatie:', 'meer informatie:',
  'Volg ons', 'volg ons', 'Abonneer', 'abonneer', 'Subscribe', 'subscribe',
  'Kijk ook op', 'kijk ook op', '\u00A9 ', 'www.', 'http',
];

function filterBeschrijving(tekst) {
  if (!tekst) return '';
  for (const kw of CREDITS_KW) {
    const idx = tekst.indexOf(kw);
    if (idx !== -1) {
      tekst = tekst.substring(0, idx).trim().replace(/[,;:\-]+$/, '');
    }
  }
  return tekst.length >= 30 ? tekst : '';
}

function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function parseIsoDuur(iso) {
  const m = (iso || '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0');
}

function formatDuur(seconden) {
  return `${Math.floor(seconden / 60)}:${String(seconden % 60).padStart(2, '0')}`;
}

async function haalDuurViaApi(videoIds, youtubeApiKey) {
  if (!youtubeApiKey) return {};
  const duuren = {};
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      part: 'contentDetails',
      id: batch.join(','),
      key: youtubeApiKey,
    });
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
        headers: { 'User-Agent': 'BegrijpendTuben/1.0' },
      });
      const data = await res.json();
      for (const item of (data.items || [])) {
        const sec = parseIsoDuur(item.contentDetails.duration);
        if (sec !== null) duuren[item.id] = sec;
      }
    } catch (e) {
      console.error('YouTube API fout:', e);
    }
  }
  return duuren;
}

export async function filterOpDuur(videos, youtubeApiKey) {
  if (!youtubeApiKey) return videos;
  const videoIds = videos.map(v => v.id);
  const duuren = await haalDuurViaApi(videoIds, youtubeApiKey);
  return videos
    .filter(v => {
      const sec = duuren[v.id];
      return sec === undefined || sec <= MAX_DUUR_SEC;
    })
    .map(v => ({
      ...v,
      duur: duuren[v.id] ? formatDuur(duuren[v.id]) : null,
    }));
}

export async function fetchRssVideos(channelId, naam, categorie, emoji, maxItems = 10) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BegrijpendTuben/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xmlText = await res.text();

    // Cloudflare Workers heeft geen ingebouwde XML-parser;
    // we gebruiken regex om de RSS-entries te parsen.
    const entries = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    while ((match = entryRegex.exec(xmlText)) !== null && entries.length < maxItems) {
      const entry = match[1];

      const vidMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
      const titelMatch = entry.match(/<title>(.*?)<\/title>/);
      if (!vidMatch || !titelMatch) continue;

      const videoId = vidMatch[1];
      const titel = decodeXmlEntities(titelMatch[1]);

      let beschrijving = '';
      const descMatch = entry.match(/<media:description>([\s\S]*?)<\/media:description>/);
      if (descMatch && descMatch[1]) {
        const rauw = decodeXmlEntities(descMatch[1].substring(0, 500).replace(/\n/g, ' ').trim());
        beschrijving = filterBeschrijving(rauw);
      }

      const vandaag = new Date().toISOString().split('T')[0];
      const niveau = classificeerNiveau(titel, beschrijving);

      entries.push({
        id: videoId,
        titel,
        beschrijving: beschrijving || `Filmpje van ${naam}.`,
        categorie,
        kanaal: naam,
        emoji,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        tags: [naam.toLowerCase().replace(/ /g, ''), categorie.toLowerCase()],
        toegevoegd: vandaag,
        niveau,
      });
    }

    return entries;
  } catch (e) {
    console.error(`RSS fout voor ${naam}:`, e);
    return [];
  }
}
