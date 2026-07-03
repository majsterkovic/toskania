#!/usr/bin/env node
/**
 * Rozbudowa dni 9–15: zapis enrichment + merge do plan.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLAN_PATH = join(ROOT, 'plan.json');
const ENRICHMENT_DIR = join(ROOT, 'enrichment');

const ENRICHMENTS = {
  9: {
    transfer_route:
      'Castelnuovo Berardenga → SS73/SR222 obwodnica Sieny (unikaj ZTL) → SS223 south (Siena–Grosseto) → Grosseto → SS1 Aurelia south → Albinia → SS74 → Pitigliano/Sovana',
    transfer_route_segments: [
      { segment: 'BAZA 2 → Monte Oliveto Maggiore', road: 'SR2/SP451', km: '~35', note: 'Rano (~8:30) przed transferem. Ostatni wstęp 12:20 / 17:40 (ora legale).' },
      { segment: 'Monte Oliveto → Asciano (lunch)', road: 'SP451/SP14', km: '~12', note: 'Crete Senesi — lunch La Lupa, potem wyjazd ~13:00.' },
      { segment: 'Asciano → Siena bypass', road: 'SP14 → SS438', km: '~25', note: 'Objazd centrum Sieny — nie wjeżdżaj w ZTL.' },
      { segment: 'Siena → Grosseto', road: 'SS223', km: '~75', note: 'Malownicza droga przez Crete Senesi i Maremmę. ~1 h 15 min.' },
      { segment: 'Grosseto → Pitigliano', road: 'SS1 → Albinia → SS74', km: '~55', note: 'SS74 przez Manciano — kręte odcinki, ostrożnie po zmroku.' },
    ],
    parking: {
      monte_oliveto: 'Parking przy Abbazia Monte Oliveto Maggiore — bezpłatny, duży plac. Naviguj: Monte Oliveto Maggiore Chiusure.',
      asciano: 'Parking Piazza del Grano lub Via Mameli — bezpłatny, centrum pieszo.',
      pitigliano_arrival: 'Przy check-in BAZY 3: parking przy agriturismo (Sassotondo ma własny). Do Pitigliano jutro: Parcheggio del Fosso.',
    },
    opening_hours: {
      monte_oliveto: 'Ora legale (wrzesień): 9:30–12:20 (ostatni wstęp 12:20), 14:30–17:40 (ostatni 17:40). Niedziela 20.09 = biglietto unico €7.',
      asciano_museo: 'Museo Archeologico Asciano: wt–nd 10:00–13:00, 15:00–19:00 (sprawdź w sezonie).',
    },
    attractions_patches: [
      {
        name: 'Monte Oliveto Maggiore',
        opening_hours: '9:30–12:20, 14:30–17:40 (ora legale wrzesień)',
        ticket_price: 'Nd 20.09: biglietto unico €7 (prevendita Vivaticket €6). Pn–cz: chiostro gratis, biblioteca €4.',
        note: 'Msza gregoriańska niedziela ~9:00 — przyjedź wcześniej lub po mszy.',
      },
      {
        name: 'Asciano — Crete Senesi',
        opening_hours: 'Centrum i muzeum: 10:00–13:00, 15:00–19:00 (sezon)',
        ticket_price: 'Muzeum Etruskie: ~€5',
      },
    ],
    accommodation: {
      note: 'Przyjazd ok. 16:00–17:00. Sassotondo: ostatnie 2,2 km droga sterrata — zwolnij. Check-in typowo 15:00–18:00, zadzwoń z ETA.',
      options: [
        { name: 'Agriturismo Sassotondo', type: 'Agriturismo biodynamiczne', address: 'Loc. Sassotondo, SP46 km 2, Sovana GR', price: '€80–110/noc', parking: 'bezpłatny na miejscu (sterrata ostatnie 2 km)', url: 'https://www.sassotondo.it/', note: 'Rezerwuj z wyprzedzeniem — winobranie we wrześniu' },
        { name: 'Agriturismo Valle del Fiora', type: 'Alternatywa', address: 'Dolina Fiora, Pitigliano GR', price: '€70–95/noc', parking: 'na miejscu', note: 'Cichsza dolina, 10 min od Pitigliano' },
      ],
    },
    practical_tips: [
      'Niedziela 20.09: Monte Oliveto otwarte — biglietto unico €7 (weekend). Wyjazd do BAZY 3 po lunchu ~13:00.',
      'SS223 Siena–Grosseto: malownicza ale wolniejsza niż A1 — zaplanuj 1 h 15 min do Grosseto.',
      'SS74 od Albinia: kręte odcinki — nie planuj nocnego dojazdu po 20:00 przy pierwszym razie.',
      'Sassotondo: naviguj „Loc. Sassotondo" z SP46 (km 2) — ostatnie 2,2 km szutrowe, jedź powoli.',
    ],
    web_research: [
      { topic: 'Monte Oliveto Maggiore — orari wrzesień', summary: 'Ora legale: 9:30–12:20 i 14:30–17:40. Nd 20.09 = biglietto unico €7 (Vivaticket €6). Cykl fresków Il Sodoma w chiostro.', source: 'https://www.monteolivetomaggiore.it/abbazia/orario-di-apertura/', checked: '2026-07' },
      { topic: 'Trasa Chianti → Maremma SS223/SS74', summary: 'Castelnuovo → obwodnica Sieny → SS223 (75 km, ~1h15) → Grosseto → SS1 → Albinia → SS74 → Pitigliano (~55 km). Unikaj centrum Sieny (ZTL).', source: 'https://pitigliano.org/en/info/how-to-get-here/', checked: '2026-07' },
      { topic: 'Agriturismo Sassotondo — dojazd', summary: 'SP46 Pitigliano–Sovana, zjazd km 2, 2,2 km sterrata. Tel. +39 351 6986750. Biodynamiczne wino od 1994.', source: 'http://www.sassotondo.it/it/visite.html', checked: '2026-07' },
    ],
    tips: [
      'Monte Oliveto: kup bilet online Vivaticket — unikniesz kolejki w niedzielę',
      'Tankuj w Grosseto lub Manciano — stacje rzadsze na SS74 w górach',
    ],
  },
  10: {
    parking: {
      pitigliano: 'Parcheggio del Fosso — płatny, poza ZTL, 5 min pieszo do centrum. Alternatywa: Piazza Nenni (bezpłatny, ~15 min pieszo).',
      via_cave: 'Via Cava San Giuseppe: parking przy cmentarzu (Cimitero di Pitigliano) — bezpłatny, mały.',
      ztl: 'ZTL w murach Pitigliano — kamery. Parkuj TYLKO poza murami (Fosso lub Nenni).',
    },
    opening_hours: {
      palazzo_orsini: 'Wt–cz 9:00–13:00, 14:00–17:00; pt–nd 9:00–13:00, 14:00–18:00. Poniedziałek ZAMKNIĘTE. Wstęp do 30 min przed zamknięciem.',
      sinagoga: '1 IV–31 X: 10:00–13:00, 14:30–18:00. Sobota ZAMKNIĘTA. Poniedziałek 21.09 = OTWARTE.',
      via_cave: 'Dostęp bezpłatny 24/7 — szlak samodzielny, bez biletu.',
    },
    food: {
      note: 'Wnętrze wydrążone w tufie. Rezerwacja: tel. 0564 616192 lub 335 1028814. Michelin Bib Gourmand — mało stolików, rezerwuj dzień wcześniej.',
      phone: '+39 0564 616192',
    },
    attractions_patches: [
      {
        name: 'Pitigliano — stare miasto',
        opening_hours: 'Palazzo Orsini: wt–cz 9–17, pt–nd 9–18 (pn zamknięte). Sinagoga: 10–13, 14:30–18 (sb zamknięte).',
        ticket_price: 'Palazzo Orsini €6 (integrato z katedrą Sovana €7,50). Sinagoga €6 / ridotto €5.',
      },
      {
        name: 'Via Cava di San Giuseppe + Via Cava di Poggio Prisca',
        opening_hours: '24/7, bezpłatny dostęp',
        ticket_price: 'Bezpłatnie',
        note: 'Szlak ~3 km loop. Latarka obowiązkowa. Mokro po deszczu — ślisko.',
      },
    ],
    practical_tips: [
      'Poniedziałek 21.09: Palazzo Orsini ZAMKNIĘTE — skup się na synagodze, Via Cave i spacerze po borgo.',
      'Sinagoga „Piccola Gerusalemme": Vicolo Manin — bagno rytualne, piec na matzę, muzeum w tufie. €6.',
      'Il Tufo Allegro: rezerwacja tel. 0564 616192 — Michelin, kilka stolików w tufie.',
      'Via Cave: start przy cmentarzu, ~1,5–2 h z powrotem. Quercus ilex (leccio) po obu stronach.',
    ],
    web_research: [
      { topic: 'Sinagoga Pitigliano — orari i biglietti', summary: '€6 intero, €5 ridotto. 1 IV–31 X: 10–13, 14:30–18. Zamknięte sobota. Vicolo Manin — „Piccola Gerusalemme".', source: 'https://www.comune.pitigliano.gr.it/vivere_il_comune/luoghi/luogo_9.html', checked: '2026-07' },
      { topic: 'Palazzo Orsini Pitigliano', summary: '€6 intero (2026). Pn zamknięte. Pt–nd do 18:00. Biglietto integrato z katedrą Sovana €7,50.', source: 'https://palazzo-orsini-pitigliano.it/index.php/it/orari-e-biglietti', checked: '2026-07' },
      { topic: 'Parking Pitigliano', summary: 'Parcheggio del Fosso (płatny, blisko) lub Piazza Nenni (darmowy, 15 min pieszo). ZTL w murach — kamery.', source: 'https://www.camperinfamiglia.com/pitigliano-la-piccola-gerusalemme/', checked: '2026-07' },
      { topic: 'Il Tufo Allegro — rezerwacja', summary: 'Vicolo della Costituzione 5. Tel. 0564 616192 / 335 1028814. Michelin Bib Gourmark — kuchnia w tufie.', source: 'https://guide.michelin.com/us/en/toscana/pitigliano/restaurant/il-tufo-allegro', checked: '2026-07' },
    ],
    tips: [
      'Poniedziałek: forteca zamknięta — Via Cave i synagoga to główne atrakcje dnia',
      'Il Tufo Allegro: zadzwoń rano na wieczorną rezerwację',
    ],
  },
  11: {
    parking: {
      sorano: 'Piazza Cairoli lub Parcheggio San Marco — bezpłatny, 2 min do Fortezza Orsini. Via Cava San Rocco: start od fortecy.',
      saturnia: 'Parking płatny przy SP10, ~450 m od kaskad. €2,50/h (8:00–20:00), EasyPark lub monety/karta. Camper max 2,20 m. Bezpłatnie 20:00–8:00.',
      saturnia_tip: 'NIE parkuj na poboczu SP10 — mandaty. Stary parking przy kaskadach zamknięty.',
    },
    opening_hours: {
      fortezza_orsini: '1 IV–30 IX: 10:00–13:00, 15:00–19:00. Wtorek 22.09 OTWARTE. Pn zamknięte (oprócz sierpnia/świąt). Visite sotterranee: 12:00, 15:00, 18:00.',
      saturnia: 'Cascate del Mulino: 24/7, wstęp bezpłatny. Parking 8:00–20:00.',
      cantina_ottava_rima: 'Śr–nd 12:00–14:30, 19:00–22:00. Wtorek OTWARTE. Poniedziałek zamknięte.',
      fidalma: 'Tradycyjna kuchnia maremmańska — lunch i dinner, rezerwacja zalecana.',
    },
    food: {
      place: 'Cantina L\'Ottava Rima — Sorano (lunch)',
      address: 'Via del Borgo 25, 58010 Sorano GR',
      dishes: [
        'taglieri Cinta Senese i formaggi locali',
        'pappardelle al cinghiale',
        'vini autoctoni z piwnicy w tufie',
      ],
      note: 'Enosteria w wykopanym tufie — Via del Borgo 25. Parking: Piazza del Municipio, zejście przez Via Selvi. Tel. +39 349 8024196. Alternatywa obiad: Ristorante Fidalma, Piazza Pietro Busatti.',
      price: '~€18–25/os',
      gps_hint: 'Via del Borgo 25, Sorano GR — zejście z Piazza del Municipio',
      phone: '+39 349 8024196',
    },
    attractions_patches: [
      {
        name: 'Sorano — Fortezza Orsini',
        opening_hours: '10:00–13:00, 15:00–19:00 (wrzesień). Visite sotterranee: 12:00, 15:00, 18:00.',
        ticket_price: 'Museo €3 / museo+sotterranei €6. Biglietto cumulativo €10 (Sorano+Sovana+Sorano).',
      },
      {
        name: 'Cascate del Mulino — Saturnia',
        opening_hours: '24/7 — wstęp bezpłatny',
        ticket_price: 'Bezpłatnie (parking €2,50/h 8–20)',
        note: '37,5°C, siarczane wody. Wtorek po 15:00 = mniej tłumów. Ręcznik + klapki obowiązkowe.',
      },
    ],
    practical_tips: [
      'Wtorek 22.09: Sorano rano (10:00 forteca), Saturnia po 15:00 — optymalna strategia tłumów.',
      'Saturnia parking: €2,50/h, EasyPark app. 450 m pieszo do kaskad. Nie parkuj na SP10.',
      'Fortezza Orsini: visite sotterranee o 12:00, 15:00, 18:00 — warto zaplanować 15:00 przed Saturnia.',
      'Via Cava San Rocco: spacer od fortecy — dębowy las Quercus ilex, ~45 min.',
    ],
    web_research: [
      { topic: 'Fortezza Orsini Sorano — orari wrzesień', summary: '1 IV–30 IX: 10–13, 15–19 codziennie (pn zamknięte poza sierpniem). Sotterranei: 12, 15, 18. Cumulativo €10.', source: 'https://www.museidimaremma.it/museo/museo-civico-archeologico/', checked: '2026-07' },
      { topic: 'Saturnia Cascate del Mulino — parking 2026', summary: 'Wstęp bezpłatny 24/7. Parking SP10: €2,50/h (8–20), EasyPark. 450 m pieszo. Camper max 2,20 m.', source: 'https://northabroad.com/saturnia-hot-springs-guide/', checked: '2026-07' },
      { topic: 'Cantina Ottava Rima Sorano', summary: 'Via del Borgo 25. Enosteria w tufie. Śr–nd 12–14:30, 19–22. Tel. +39 349 8024196.', source: 'https://cantinaottavarima.com/it/', checked: '2026-07' },
    ],
    tips: [
      'Poprawka: „Osteria La Botte Piena" nie istnieje — Cantina Ottava Rima lub Fidalma',
      'Saturnia: stary bezpłatny parking przy kaskadach zamknięty — tylko płatny SP10',
    ],
  },
  12: {
    parking: {
      sovana: 'Parking Via del Duomo — bezpłatny, centrum i necropoli 10 min pieszo. Bilety w Info Point przy Piazza del Pretorio.',
      lamone: 'Selva del Lamone: parking przy SP22 (Sovana–San Martino sul Fiora) — bezpłatny, mały. Sentiero n.3 start przy parkingu.',
      semproniano: 'Piazza del Popolo — bezpłatny, zamek Aldobrandeschi 5 min pieszo.',
    },
    opening_hours: {
      necropoli: '1 IV–30 IX: codziennie 10:00–19:00, ultimo ingresso 18:00. Środa 23.09 OTWARTE.',
      sassotondo_tasting: 'Degustacje: pon–nd 10:30 lub 15:30. Rezerwacja 24h wcześniej online lub tel. +39 351 6986750.',
      taverna_etrusca: 'Kolacja — rezerwacja zalecana. Piazza del Pretorio 16, Sovana.',
    },
    food: {
      place: 'Taverna Etrusca — Sovana (kolacja pożegnalna)',
      address: 'Piazza del Pretorio 16, 58010 Sovana GR',
      dishes: [
        'cinghiale in umido maremma',
        'pici al ragù di chianina',
        'vino locale z Maremmy',
      ],
      note: 'Kolacja w historycznym centrum Sovana. Sassotondo = TYLKO degustacja wina (10:30 lub 15:30, od €28–45/os), NIE kolacja. Rezerwuj: +39 0564 1640019 lub WhatsApp +39 349 1245540.',
      price: '~€25–35/os',
      gps_hint: 'Piazza del Pretorio 16, Sovana GR',
      phone: '+39 0564 1640019',
    },
    attractions_patches: [
      {
        name: 'Sovana — Necropoli Etrusca',
        opening_hours: '10:00–19:00 (ultimo ingresso 18:00)',
        ticket_price: '€7 intero / €5 ridotto. Cumulativo €10 (Sorano+Sovana). Tomba Ildebranda.',
      },
      {
        name: 'Selva del Lamone — Sentiero delle Querce',
        opening_hours: 'Całoroczny dostęp, bezpłatny',
        ticket_price: 'Bezpłatnie',
        note: 'Sentiero n.3 (Lacioni): ~2,6–3 km, 1h30, trudność E. Quercus cerris dominant. Weź wodę.',
      },
      {
        name: 'Semproniano',
        opening_hours: 'Borgo swobodny, zamek z zewnątrz',
        ticket_price: 'Bezpłatny spacer',
      },
    ],
    practical_tips: [
      'Ostatni pełny dzień Toskanii: Sovana rano (necropoli 3–4 h), Lamone po lunchu, Semproniano wieczorem.',
      'Sassotondo: degustacja 15:30 (nie kolacja!) — rezerwuj online sassotondo.it, od €28–45/os, 1h–1h15.',
      'Selva del Lamone sentiero 3: ~3 km, 1h30 — NAJLEPSZY las dębowy trasy, zero turystów.',
      'Kolacja pożegnalna: Taverna Etrusca Sovana — rezerwuj +39 0564 1640019.',
    ],
    web_research: [
      { topic: 'Necropoli Sovana — biglietti wrzesień', summary: '€7 intero, €5 ridotto. 10–19 (ultimo 18:00). Cumulativo €10 z Fortezza Orsini i musei Sovana.', source: 'https://www.museidimaremma.it/museo/necropoli-etrusca-di-sovana/', checked: '2026-07' },
      { topic: 'Selva del Lamone sentiero 3', summary: 'Sentiero dei Lacioni: ~3 km, 1h30, difficoltà E. Parking SP22. Quercus cerris, stagni stagionali (lacioni).', source: 'https://www.parchilazio.it/selvadellamone-ricerca_itinerari', checked: '2026-07' },
      { topic: 'Sassotondo degustazione', summary: 'Pon–nd 10:30 lub 15:30. Od €28–45/os. Rezerwacja 24h. Tel. +39 351 6986750. NIE serwuje kolacji.', source: 'http://www.sassotondo.it/it/visite.html', checked: '2026-07' },
      { topic: 'Taverna Etrusca Sovana', summary: 'Piazza del Pretorio 16. Tel. 0564 1640019, WhatsApp 349 1245540. Kolacja maremmańska.', source: 'https://www.tavernaetrusca.com/contatti/', checked: '2026-07' },
    ],
    tips: [
      'Sassotondo = degustacja wina, NIE kolacja — poprawka do planu',
      'Bilet necropoli €7 (nie €5) — cumulativo €10 opłaca się przy Sorano',
    ],
  },
  13: {
    route:
      'Pitigliano → SS74 → Manciano → Orvieto (A1 zjazd) → A1 north → obwodnica Florencji (Firenze-Incisa/Prato) → Bologna → Modena → A1/A4 → Milano bypass (Tangenziale) → A22 Brenner → Innsbruck → A93/A8 → Rosenheim → Wasserburg am Inn',
    route_segments: [
      { segment: 'Pitigliano → Orvieto', road: 'SS74 → SS2', km: '~55', note: 'Wyjazd 7:00. Kręte SS74 — pierwsze 45 min wolno.' },
      { segment: 'Orvieto → Florencja bypass', road: 'A1 north', km: '~160', note: 'Zjazd Orvieto/Chianciano. Unikaj centrum Florencji — ZTL i korki.' },
      { segment: 'Florencja → Bolonia', road: 'A1 north', km: '~105', note: 'Lunch: zjazd Bologna Borgo Panigale (~20 min do centrum) lub Modena Nord.' },
      { segment: 'Bolonia → Modena → Milano', road: 'A1/A14/A4', km: '~200', note: 'Tangenziale Milano — nie wjeżdżaj w centrum.' },
      { segment: 'Milano → Brenner', road: 'A4 → A22', km: '~280', note: 'Pedaggio A22 Modena–Brennero: ~€22,80 klasa A (2026, +1,46%).' },
      { segment: 'Brenner → Wasserburg', road: 'A22 → A93/A8', km: '~170', note: 'Innsbruck → Rosenheim → A94/B304 Wasserburg. Tankuj przed Brenner w IT lub po AT w DE.' },
    ],
    fuel_stops: [
      { name: 'IP Manciano / Orbetello', location: 'SS1/A12 przed zjazdem na A1', note: 'Ostatnie tanie tankowanie we Włoszech przed A1.' },
      { name: 'Autogrill Modena Nord', location: 'A1 km ~220', note: 'Postój lunch + paliwo. Tortellini in brodo na stacji.' },
      { name: 'Raststätte Brenner / Sterzing', location: 'A22 Brenner Pass', note: 'Postój na granicy IT/AT. Widok na Alpy.' },
    ],
    parking: {
      wasserburg: 'Altstadt: Parkplatz Innstraße (płatny dzień) lub bezpłatny przy hotelu. Wieczorny spacer nad Innem — 10 min z centrum.',
      hotel: 'Gasthof Staudham / Huberwirt: bezpłatny parking na miejscu.',
    },
    opening_hours: {
      bologna_lunch: 'Autogrill Modena Nord / Bologna Borgo Panigale: 24h na A1.',
      wasserburg_altstadt: 'Restauracje Altstadt: 11:30–22:00. Wieczorny spacer po murach nad Innem.',
    },
    accommodation: {
      note: 'Malownicze miasto na zakolu Innu. Wieczorny spacer Altstadt (15 min). Unikaj Monachium (drogo, brak parkingu).',
      options: [
        { name: 'Gasthof Staudham', type: 'Gasthof', address: 'Münchner Str. 30, 83512 Wasserburg am Inn', price: '€55–75/noc', parking: 'bezpłatny', url: 'https://gasthof-staudham.de/' },
        { name: 'Gasthof Huberwirt am Kellerberg', type: 'Gasthof', address: 'Salzburger Str. 25, 83512 Wasserburg am Inn', price: 'od €46/noc', parking: 'bezpłatny prywatny', note: 'Widok na Altstadt, śniadanie w cenie' },
        { name: 'Das Wasserburg Hotel', type: 'Hotel', address: 'Wasserburg am Inn', price: 'od €95/noc (single)', parking: 'bezpłatny (+ garaż €8/dzień)', url: 'https://daswasserburghotel.de/', note: 'Nowy hotel 2025, przy B304' },
      ],
    },
    practical_tips: [
      'Wyjazd 7:00 z Pitigliano — dotarcie Wasserburg ~17:00–18:00 (z 2×20 min postojami).',
      'A22 Brenner: ~€22,80 klasa A (cała trasa Modena–Brennero, 2026). Gotówka lub karta.',
      'Lunch: Bolonia Borgo Panigale (A1) — ostatnie tortellini. NIE zjeżdżaj do centrum Florencji.',
      'Tankuj w Niemczech po Brenner — tańsze niż we Włoszech i Austrii.',
      'Wieczór: spacer po Altstadt Wasserburg — malownicze miasto na zakolu Innu.',
    ],
    web_research: [
      { topic: 'A22 pedaggio Modena–Brennero 2026', summary: '€22,80 klasa A (cała tratta). +1,46% od 1 I 2026. Sistema chiuso — biglietto all\'ingresso.', source: 'https://www.telepass.com/it/privati/servizi/telepedaggio/a22-brennero-modena', checked: '2026-07' },
      { topic: 'Noclegi Wasserburg am Inn', summary: 'Gasthof Staudham (Münchner Str. 30), Huberwirt (Salzburger Str. 25, od €46), Das Wasserburg Hotel (od €95). Parking gratis.', source: 'https://gasthof-staudham.de/', checked: '2026-07' },
      { topic: 'Obwodnica Florencji A1', summary: 'Zjazd Firenze-Incisa lub Prato-Campi Bisenzio — unikaj ZTL i korków w centrum. Varco Elettronico = mandaty.', source: 'https://pitigliano.org/en/info/how-to-get-here/', checked: '2026-07' },
    ],
    tips: [
      'Pedaggio A22: przygotuj ~€25 gotówki lub kartę',
      'Wasserburg Altstadt: najlepszy wieczorny spacer tranzytu powrotnego',
    ],
  },
  14: {
    route:
      'Wasserburg am Inn → B304/A94 → A8 west (München-Ost) → A9 north → Nürnberg → A9 north → zjazd Hof-Nord/Hof-West → Hof (Saale)',
    route_segments: [
      { segment: 'Wasserburg → Monachium', road: 'B304/A94', km: '~45', note: 'Wyjazd 8:00. B304 malownicza dolina Innu.' },
      { segment: 'Monachium → Nürnberg', road: 'A8 → A9 north', km: '~165', note: '~1h 40 min. Raststätte Franconia na lunch.' },
      { segment: 'Nürnberg → Hof', road: 'A9 north', km: '~120', note: '~1h 10 min. Zjazd Hof-Nord lub Hof-West (B15).' },
    ],
    fuel_stops: [
      { name: 'Raststätte Irschenberg / Holzkirchen', location: 'A8 km ~90', note: 'Postój przed Monachium — mniej ruchu niż w mieście.' },
      { name: 'Raststätte Nürnberg-Feucht', location: 'A9 km ~410', note: 'Lunch w Frankenii — kiełbasy, piwo. 24h.' },
    ],
    parking: {
      hof: 'Pension przy zjeździe A9 (Hof-Nord/West) — parking gratis. Centrum Hof: płatny.',
    },
    accommodation: {
      note: 'Krótszy dzień (~4 h jazdy). Szukaj Pension/Gasthof przy zjeździe A9/A72, nie w centrum. Alternatywa: Naila, Rehau (tańsze).',
      options: [
        { name: 'Hotel Central Hof', type: 'Hotel', address: 'Kulmbacher Str. 2, 95030 Hof', price: '€70–90/noc', parking: 'bezpłatny na miejscu (+ Freiheitshalle obok)', url: 'https://www.sorat-hotels.com/en/hotel/central-hof.html', note: 'Przy węźle A9/A72/A93, dobre dla tranzytu' },
        { name: 'Fichtelgebirgshof', type: 'Landgasthof', address: 'przy A9 (Himmelkron)', price: '€50–70/noc', parking: '150 miejsc gratis', note: 'Bezpośrednio przy A9, 36 pokoi' },
        { name: 'Hotel Strauss', type: 'Gasthof', address: 'Bismarckstr. 31, 95028 Hof', price: '€55–75/noc', parking: 'bezpłatny przy hotelu', note: '3★, restauracja regionalna, pn zamknięte' },
      ],
    },
    practical_tips: [
      'Krótszy dzień — dotarcie Hof ~12:00–13:00. Czas na odpoczynek przed finałem.',
      'A9 Nürnberg–Hof: sprawdź baustellen na autobahn.de — roboty częste.',
      'Frankonia: lokalny Gasthof zamiast Raststätte — kiełbasy, Dunkelbier.',
      'Nocleg przy zjeździe A9 — nie w centrum Hof (tańsze, łatwiejszy wyjazd rano).',
    ],
    web_research: [
      { topic: 'Hotel Central Hof — parking A9', summary: 'Kulmbacher Str. 2. Bezpłatny parking. Przy A9/A72/A93. Zjazd Hof-Nord lub Hof-West.', source: 'https://www.sorat-hotels.com/en/hotel/central-hof/directions/car.html', checked: '2026-07' },
      { topic: 'Fichtelgebirgshof przy A9', summary: 'Bezpośrednio przy A9 Himmelkron. 150 darmowych miejsc. Od €50/noc.', source: 'https://www.hrs.de/de/hotel/62065', checked: '2026-07' },
      { topic: 'A9 Nürnberg–Hof', summary: '~120 km, ~1h 10 min bez trafficu. Raststätte Feucht na lunch.', source: 'https://de.wikivoyage.org/wiki/Bundesautobahn_9', checked: '2026-07' },
    ],
    tips: [
      'Zjazd Hof-Nord (A9) lub Hof-West (B15) — oba dobre dla noclegu tranzytowego',
      'Sprawdź A9 baustellen przed wyjazdem na autobahn.de',
    ],
  },
  15: {
    route:
      'Hof (Saale) → A72 north → Kreuz Chemnitz (A4) → A4 west → Drezno obwodnica → B97/Cottbus → A15 → Frankfurt (Oder) → A2 east → Świecko → Poznań',
    route_segments: [
      { segment: 'Hof → Chemnitz', road: 'A72', km: '~95', note: 'Wyjazd 7:00–7:30. A72 Vogtlandautobahn — płynna trasa.' },
      { segment: 'Chemnitz → Drezno', road: 'A4 west', km: '~80', note: 'Obwodnica Drezna — nie centrum. Uwaga na baustellen Saksonia.' },
      { segment: 'Drezno → Frankfurt (Oder)', road: 'A4 → A13 → A15', km: '~145', note: 'Przejście graniczne A15 → A2.' },
      { segment: 'Frankfurt (Oder) → Poznań', road: 'A2 east', km: '~150', note: 'Świecko — granica PL/DE. Opłata AW ~138 zł (Świecko–Konin). Dotarcie ~13:00–14:30.' },
    ],
    fuel_stops: [
      { name: 'Raststätte Sachsen / Hermsdorf', location: 'A4/A9 kier. Drezno', note: 'Postój na trasie Saksonia.' },
      { name: 'MOP Lubrza / Rzepin', location: 'A2 przed Świecko', note: 'Ostatnie tankowanie w PL lub taniej w DE przed granicą.' },
    ],
    parking: {
      arrival: 'Dotarcie do domu — brak noclegu. Lunch na trasie lub w Poznaniu.',
    },
    opening_hours: {
      border_swiecko: 'A2 Świecko: 24h. Videotolling PL od Konin.',
    },
    practical_tips: [
      'Finałowy etap ~5–5,5 h. Dotarcie Poznań 26.09 ok. 13:00–14:30 — 1 dzień przed deadline 27.09.',
      'A4 Saksonia: częste roboty drogowe — sprawdź baustellen autobahn.de rano.',
      'Granica Świecko (A2): najszybsza dla kierunku Poznań. Opłata A2 PL ~138 zł.',
      'Lunch: Raststätte Sachsen lub kanapki — krótki postój, cel dom.',
    ],
    web_research: [
      { topic: 'Trasa Hof → Poznań A72/A4/A2', summary: 'Hof → A72 → Chemnitz → A4 → Drezno → Frankfurt/Oder → A2 → Świecko → Poznań. ~470 km, 5–5,5 h.', source: 'https://conadrogach.pl/mapa-samochodowa/niemcy/autostrada-a72/', checked: '2026-07' },
      { topic: 'Opłaty A2 Polska 2026', summary: 'Świecko–Konin Modła ~138 zł. Videotolling bez zatrzymania. Przygotuj kartę.', source: 'https://rankomat.pl/samochod/autostrada-a2-w-polsce', checked: '2026-07' },
      { topic: 'A4 Baustellen Saksonia', summary: 'Roboty drogowe częste na A4 Drezno–Frankfurt. Sprawdź rano na autobahn.de.', source: 'https://www.autobahn.de/', checked: '2026-07' },
    ],
    tips: [
      'Deadline 27.09 — przy planowym harmonogramie w domu 26.09 po południu',
      'Tankuj przed Świecko w DE lub tuż po granicy w PL',
    ],
  },
};

// --- merge helpers (from merge-enrichment.mjs) ---
function mergeArrays(existing, incoming, keyFn) {
  if (!incoming?.length) return existing ?? [];
  const base = [...(existing ?? [])];
  const seen = new Set(base.map(keyFn));
  for (const item of incoming) {
    const k = keyFn(item);
    if (!seen.has(k)) {
      base.push(item);
      seen.add(k);
    }
  }
  return base;
}

function mergeObject(existing, incoming) {
  if (!incoming || typeof incoming !== 'object') return existing;
  if (!existing || typeof existing !== 'object') return { ...incoming };
  return { ...existing, ...incoming };
}

function mergeDay(planDay, enriched) {
  const merged = { ...planDay };

  for (const field of ['web_research', 'practical_tips', 'fuel_stops', 'route_segments']) {
    if (!enriched[field]) continue;
    if (field === 'web_research') {
      merged.web_research = mergeArrays(planDay.web_research, enriched[field], (x) => x.topic);
    } else if (field === 'practical_tips' || field === 'fuel_stops') {
      merged[field] = mergeArrays(planDay[field], enriched[field], (x) => (typeof x === 'string' ? x : x.name ?? JSON.stringify(x)));
    } else if (field === 'route_segments') {
      merged[field] = mergeArrays(planDay.route_segments, enriched[field], (x) => x.segment);
    }
  }

  for (const field of ['parking', 'opening_hours']) {
    if (enriched[field]) merged[field] = mergeObject(planDay[field], enriched[field]);
  }

  if (enriched.route && (!planDay.route || enriched.route.length > planDay.route.length)) {
    merged.route = enriched.route;
  }
  if (enriched.transfer_route) merged.transfer_route = enriched.transfer_route;
  if (enriched.transfer_route_segments) merged.transfer_route_segments = enriched.transfer_route_segments;

  for (const nested of ['accommodation', 'food']) {
    if (enriched[nested]) {
      merged[nested] = mergeObject(planDay[nested], enriched[nested]);
      if (enriched[nested].options?.length) {
        merged[nested].options = mergeArrays(
          planDay[nested]?.options,
          enriched[nested].options,
          (x) => x.name
        );
      }
    }
  }

  if (enriched.tips?.length) {
    merged.tips = mergeArrays(planDay.tips, enriched.tips, (x) => x);
  }

  if (enriched.attractions_patches?.length && merged.attractions?.length) {
    merged.attractions = merged.attractions.map((attr) => {
      const patch = enriched.attractions_patches.find((p) => p.name === attr.name);
      if (!patch) return attr;
      const { name, ...rest } = patch;
      return { ...attr, ...rest };
    });
  }

  return merged;
}

const plan = JSON.parse(readFileSync(PLAN_PATH, 'utf8'));
const mergedDays = [];

for (const [dayStr, enrichment] of Object.entries(ENRICHMENTS)) {
  const dayNum = parseInt(dayStr, 10);
  const idx = plan.days.findIndex((d) => d.day_num === dayNum);
  if (idx === -1) {
    console.warn(`Brak dnia ${dayNum}`);
    continue;
  }

  const merged = mergeDay(plan.days[idx], enrichment);
  plan.days[idx] = merged;
  mergedDays.push(dayNum);

  // backup pełnego dnia do enrichment/
  const backupPath = join(ENRICHMENT_DIR, `dzien-${String(dayNum).padStart(2, '0')}.json`);
  writeFileSync(backupPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`Zapisano ${backupPath}`);
}

const existing = plan.meta.enrichment_days ?? [];
plan.meta.enrichment_days = [...new Set([...existing, ...mergedDays])].sort((a, b) => a - b);
plan.meta.last_enriched = new Date().toISOString();

const out = JSON.stringify(plan, null, 2) + '\n';
JSON.parse(out);
writeFileSync(PLAN_PATH, out, 'utf8');

console.log(`\nScalono dni: ${mergedDays.join(', ')}`);
console.log(`meta.enrichment_days = ${plan.meta.enrichment_days.join(', ')}`);
