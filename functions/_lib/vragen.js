export async function genereerVragenMetAi(videoId, videoTitel, videoBeschrijving, openaiApiKey) {
  const heeftInhoud = videoBeschrijving.trim().length > 80;

  const inhoudRichtlijn = heeftInhoud
    ? 'FOCUS UITSLUITEND op de inhoud van het filmpje: feiten die worden uitgelegd, hoe iets werkt, welke begrippen voorkomen, wat er getoond of besproken wordt.'
    : 'Stel vragen op basis van wat je kunt afleiden uit de titel en beschrijving.';

  const prompt = `Je bent een kindvriendelijke leraar voor kinderen van 8 jaar.

Er is net een YouTube-filmpje bekeken:
- Titel: ${videoTitel}
- Beschrijving: ${videoBeschrijving}

${inhoudRichtlijn}

Maak precies 5 meerkeuze-vragen die toetsen of het kind de INHOUD van het filmpje heeft begrepen.

VERBODEN vragen (sla deze categorie\u00EBn volledig over):
- Vragen over abonneren, liken, delen of andere YouTube-acties
- Vragen over het YouTube-kanaal, de maker of de presentator
- Vragen over de naam van het programma of de serie
- Vragen over hoe oud het filmpje is of wanneer het gemaakt is
- Vragen over of het filmpje leuk/interessant was
- Vragen over de doelgroep of leeftijdsgeschiktheid

Gebruik eenvoudige, duidelijke taal.

Geef je antwoord ALLEEN als geldige JSON (geen extra tekst erbuiten), in dit exacte formaat:
[
  {
    "vraag": "Wat is de vraag?",
    "opties": ["Optie A", "Optie B", "Optie C"],
    "correct": "Optie A",
    "uitleg": "Korte uitleg waarom dit het goede antwoord is."
  }
]

Regels:
- Precies 3 antwoordopties per vraag
- Precies 1 correct antwoord
- De uitleg is maximaal 1 zin
- Alles in het Nederlands`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Je geeft altijd antwoord als pure JSON, zonder markdown of uitleg eromheen.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API fout: ${res.status} ${errText}`);
  }

  const data = await res.json();
  let tekst = data.choices[0].message.content.trim();

  // Strip markdown code fences
  if (tekst.startsWith('```')) {
    tekst = tekst.split('```')[1];
    if (tekst.startsWith('json')) tekst = tekst.substring(4);
    tekst = tekst.trim();
  }

  return JSON.parse(tekst);
}
