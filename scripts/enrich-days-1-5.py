#!/usr/bin/env python3
"""Enrich plan.json days 1-5 with web research data."""
import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLAN = ROOT / "plan.json"
ENRICH = ROOT / "enrichment"

ENRICHMENTS = {
    1: {
        "route_segments": [
            {"segment": "Poznań → Świecko (granica PL/DE)", "road": "A2", "km": "~280", "note": "Opłata koncesyjna AWSA Świecko–Konin"},
            {"segment": "Świecko → Berlin (obwodnica)", "road": "A12 → A10 Berliner Ring", "km": "~280", "note": "Unikaj centrum Berlina — A10 pełna obwodnica"},
            {"segment": "Berlin → Norymberga", "road": "A9 south", "km": "~280", "note": "Raststätte Frankenwald (most) ok. km 254"},
            {"segment": "Norymberga → Ingolstadt → Neustadt", "road": "A9 → wyjazd Neustadt/Kelheim", "km": "~120", "note": "Kelheim 15 km na wschód — alternatywa noclegowa"}
        ],
        "web_research": [
            {
                "topic": "E-winieta Austria 10-dniowa",
                "summary": "€12,80 dla auta do 3,5 t na shop.asfinag.at — natychmiastowa aktywacja. Kup przed wyjazdem z Polski; data startu = 13.09 (dzień 2, pierwszy wjazd na autostradę AT).",
                "source": "https://shop.asfinag.at/en/toll-products/digital-vignette/10-day-vignette-car/",
                "checked": "2026-07"
            },
            {
                "topic": "Opłaty A2 PL (Świecko–Konin)",
                "summary": "Odcinek koncesyjny AWSA: ~129 PLN za cały Świecko–Konin (kat. 1). Od 11.03.2026 nowe stawki segmentowe Nowy Tomyśl–Konin: 40 PLN/50 km × 3. Konin–Stryków bezpłatny dla aut <3,5 t.",
                "source": "https://www.autostrada-a2.pl/en/news/change-of-toll-rates-for-a2-motorway-in-nowy-tomysl-konin-section-2/",
                "checked": "2026-07"
            },
            {
                "topic": "Noclegi Neustadt an der Donau",
                "summary": "Gasthof Gigl (Herzog-Ludwig-Str. 6): parking wewnętrzny gratis, check-in 15:00–21:00, rezerwacja poza 21:00 wymaga kontaktu. Hotel Pflügler (Schwaig, Hauptstr. 14): parking gratis, 5 km od centrum.",
                "source": "https://www.gigl.de/",
                "checked": "2026-07"
            },
            {
                "topic": "Kelheim jako alternatywa",
                "summary": "Malownicze miasto nad Dunajem, 15 km od Neustadt. Parking P4 Donauvorland: płatny kwie–paź (€1/2h), zimą gratis. Altstadt 1 min pieszo od P4.",
                "source": "https://tourismus.kelheim.de/adressen/parkplatz-p4-donauvorland/",
                "checked": "2026-07"
            },
            {
                "topic": "Raststätte A9 (Frankenwald, Feucht, Köschinger Forst)",
                "summary": "Serways: Frankenwald Ost/West (km 254, most), Nürnberg-Feucht Ost (km 385), Köschinger Forst Ost (km 450) — wszystkie 24/7, stacje Aral/OMV, McDonald's, ładowarki EV.",
                "source": "https://www.serways.de/standorte/frankenwald-ost/",
                "checked": "2026-07"
            }
        ],
        "practical_tips": [
            "Kup e-winietę AT online przed wyjazdem — €12,80, start 13.09 (nie 12.09, bo Austrię dopiero w dniu 2)",
            "Tankuj w Niemczech przed Austrią — benzyna tańsza niż we Włoszech i Austrii",
            "Frankenwald Ost (A9 km 254) — jedyna mostowa Raststätte w Niemczech, dobry postój na lunch",
            "Neustadt: parking przy Gasthof Gigl w podwórzu — przy pełnym obłożeniu zaparkuj przy Altstadt",
            "Kelheim backup: jeśli brak miejsc w Neustadt, 15 km dalej, tańsze Gasthöfe nad Dunajem"
        ],
        "parking": {
            "destination": "Neustadt an der Donau — nocleg tranzytowy",
            "options": [
                {"name": "Gasthof Gigl — parking wewnętrzny", "type": "hotel", "price": "gratis dla gości", "gps_hint": "Herzog-Ludwig-Straße 6, 93333 Neustadt a.d. Donau", "note": "Check-in 15:00–21:00; przy pełnym parkingu — uliczny przy Altstadt"},
                {"name": "Hotel Pflügler — parking przed hotelem", "type": "hotel", "price": "gratis", "gps_hint": "Hauptstr. 14, Schwaig, 93333 Neustadt", "note": "5 km od centrum, spokojniejsza lokalizacja"},
                {"name": "Kelheim P4 Donauvorland (alternatywa)", "type": "public", "price": "€1/2h (kwie–paź 8–18), zimą gratis", "gps_hint": "Schloßweg, 93309 Kelheim", "note": "170 miejsc, 1 min do Altstadt Kelheim"}
            ],
            "tip": "Szukaj Gasthof z własnym parkingiem — centrum Neustadt ma ograniczoną liczbę miejsc"
        },
        "fuel_stops": [
            {"name": "Orlen / Shell przy A2 Świecko", "location": "A2 km ~10 PL, przed granicą", "road": "A2", "hours": "24h (stacja przy MOP)", "note": "Ostatnie tanie tankowanie w PL przed DE"},
            {"name": "Raststätte Frankenwald Ost", "location": "A9 km 254, Berg-Rudolphstein", "road": "A9", "hours": "24/7", "note": "Aral, McDonald's — lunch ~700 km od startu"},
            {"name": "Raststätte Nürnberg-Feucht Ost", "location": "A9 km 385, Feucht", "road": "A9", "hours": "24/7", "note": "OMV, dobre uzupełnienie przed Ingolstadt"},
            {"name": "Aral przy wyjeździe Neustadt", "location": "B16/B299, Neustadt a.d. Donau", "road": "lokalna", "hours": "zwykle 6–22", "note": "Tankowanie przed noclegiem — jutro długi etap do Włoch"}
        ],
        "opening_hours": {
            "gasthof_gigl_checkin": "15:00–21:00 (po 21:00 kontakt telefoniczny)",
            "raststaette_a9": "24/7"
        }
    },
    2: {
        "route_segments": [
            {"segment": "Neustadt → Norymberga → Rosenheim", "road": "A9 → A8", "km": "~200", "note": "Winieta AT aktywna od dziś"},
            {"segment": "Rosenheim → Innsbruck", "road": "A93 Inntal → A12", "km": "~100", "note": "A12 wymaga winiety AT"},
            {"segment": "Innsbruck → Brenner", "road": "A13 Sondermaut", "km": "~35", "note": "Streckenmaut €12,50 — bez winiety na A13, ale A12 wymaga"},
            {"segment": "Brenner → Bolzano → Werona", "road": "A22", "km": "~250", "note": "Bramki włoskie: bilet przy wjeździe, płatność przy wyjeździe"},
            {"segment": "Werona → Lukka → Barga", "road": "A1/A11 → SS12/SS445", "km": "~250", "note": "Ostatnie 50 km SS445 — kręta, wolno"}
        ],
        "web_research": [
            {
                "topic": "Streckenmaut A13 Brenner (AT)",
                "summary": "€12,50 za cały odcinek Innsbruck–granica (2026). A13 bez winiety, ale A12 Inntal wymaga winiety. Kup digital section toll na shop.asfinag.at — zielone pasy bez zatrzymania.",
                "source": "https://www.asfinag.at/en/toll/section-toll/",
                "checked": "2026-07"
            },
            {
                "topic": "Autostrada A22 Włochy (Brenner)",
                "summary": "Brak winiety — system bramkowy: bilet przy wjeździe, płatność przy wyjeździe. Gotówka, karta, Apple/Google Pay. Brenner–Campogalliano ~€22,30 (kat. A, maj 2025).",
                "source": "https://hogs.live/blog/brenner-pass-tolls",
                "checked": "2026-07"
            },
            {
                "topic": "Parking i ZTL Barga",
                "summary": "Barga Vecchia = ZTL. Parcheggio Porta Reale (Via Bellavista / Via del Sasso) — przy murach, średniej wielkości. Piazzale Matteotti — płatny, dolna część miasta. Viale Cesare Biondi 44 — darmowy, 900 m od centrum.",
                "source": "https://www.informagiovani-italia.com/where-to-park-in-barga.htm",
                "checked": "2026-07"
            },
            {
                "topic": "Droga SS445 Garfagnana",
                "summary": "Kręta droga górska — miejscowi jadą szybko, nie daj się poganiać. Zatoki wyprzedzania co kilkaset metrów. Traktory, rowerzyści, dzik na drodze. Przyjazd Barga ok. 16:00–17:00 realistyczny.",
                "source": "https://opera.techfgame.com/discovering-tuscany-valle-del-serchio.html",
                "checked": "2026-07"
            },
            {
                "topic": "Postój obiadowy A22",
                "summary": "Rovereto Sud lub Verona Sud — zjazd z autostrady, 'bar trattoria' przy stacji, nie przy samej bramce. Unikaj centrum Werony (ZTL, korki).",
                "source": "https://loveyouritaly.com/italian-toll-roads/",
                "checked": "2026-07"
            }
        ],
        "practical_tips": [
            "Kup Streckenmaut A13 Brenner online (€12,50) — oszczędza kolejkę na Mautstelle Schönberg",
            "Włochy A22: weź bilet przy wjeździe, płać kartą w pasie Carte (niebieski) — szybciej niż gotówka",
            "Zatankuj w Austrii lub na A22 przed Lukką — paliwo w IT tańsze niż po dotarciu do Garfagnany, ale droższe niż DE",
            "SS445: ostatnie 50 km — nie śpiesz się, ETA agriturismo zawoń z 30 min wyprzedzeniem",
            "Barga ZTL: NIGDY nie wjeżdżaj do murów — kamera przy Porta Reale, mandaty automatyczne"
        ],
        "parking": {
            "destination": "Barga — check-in BAZA 1",
            "options": [
                {"name": "Parcheggio Porta Reale", "type": "public", "price": "bezpłatny / niski", "gps_hint": "Via Bellavista, incrocio Via del Sasso — przy murach", "note": "Najbliżej centrum, 5 min pieszo do Duomo"},
                {"name": "Piazzale Matteotti", "type": "public", "price": "płatny", "gps_hint": "Via Piero Gobetti, dolna Barga", "note": "Większy parking, 10 min pieszo w górę"},
                {"name": "Viale Cesare Biondi 44", "type": "public", "price": "gratis", "gps_hint": "55051 Barga", "note": "900 m od centrum, przy szkole — backup gdy Porta Reale pełny"},
                {"name": "Parking agriturismo (Mologno/Loppia)", "type": "hotel", "price": "gratis dla gości", "gps_hint": "Naviguj Mologno LU / Loppia LU", "note": "Jeśli nocleg poza centrum — parkuj przy agriturismo"}
            ],
            "tip": "Przyjazd ok. 16–17: Porta Reale zwykle ma miejsca we wrześniu (poza weekendem)"
        },
        "fuel_stops": [
            {"name": "OMV Raststätte Holledau", "location": "A9 km ~450, Denkendorf", "road": "A9", "hours": "24/7", "note": "Ostatnie tanie DE przed Austrią — tankuj pełny bak"},
            {"name": "Eni/OMV Innsbruck area", "location": "A12/A93, Innsbruck", "road": "A12", "hours": "6–22", "note": "Uzupełnienie przed Brennerem"},
            {"name": "IP/Eni przy zjeździe A22 Rovereto Sud", "location": "SS240, Rovereto", "road": "A22 exit", "hours": "7–20", "note": "Postój obiadowy + tankowanie — poza bramką autostradową"},
            {"name": "Q8/Eni Castelnuovo di Garfagnana", "location": "SS445, Castelnuovo", "road": "SS445", "hours": "7–20", "note": "Ostatnie tankowanie przed Barga — stacja w dolinie"}
        ],
        "opening_hours": {
            "agriturismo_checkin": "14:00–19:00 typowo — zadzwoń z ETA",
            "a22_toll_booths": "24/7 (automaty)"
        }
    },
    3: {
        "web_research": [
            {
                "topic": "Grotta del Vento — bilety i godziny",
                "summary": "Otwarte cały rok (25 grudnia zamknięte). Itinerario 1: €10/1h, Itinerario 2: €18/2h. Rezerwacja online grottadelvento.com obowiązkowa w weekendy/wrześniu. Itinerario 3 tylko 2×/dziennie (10:00, 14:00). Tel. 0583 722024 (10–19).",
                "source": "https://grottadelvento.com/opening-times-and-prices/",
                "checked": "2026-07"
            },
            {
                "topic": "Temperatura jaskini",
                "summary": "Stała ~10°C przez cały rok — weź kurtkę nawet gdy na zewnątrz 24°C. Wejście zabronione z plecakami, parasolami, kijkami.",
                "source": "https://grottadelvento.com/book-now/",
                "checked": "2026-07"
            },
            {
                "topic": "Szlak Anello di Barga (CAI 108)",
                "summary": "Pętla 2–3 h od Porta Reale przez lasy kasztanowo-dębowe. Bezpłatny, oznaczony tablicą CAI. Wrzesień = idealna pogoda (16–24°C), mgła poranna na widok Apuan.",
                "source": "https://www.informagiovani-italia.com/dove-parcheggiare-barga.htm",
                "checked": "2026-07"
            },
            {
                "topic": "Parking Barga centrum",
                "summary": "ZTL w Barga Vecchia — kamery. Parcheggio Porta Reale przy murach (Via Bellavista). Rano 8–10 najlepsze światło i wolne miejsca.",
                "source": "https://www.informagiovani-italia.com/where-to-park-in-barga.htm",
                "checked": "2026-07"
            },
            {
                "topic": "Restauracja — weryfikacja nazwy",
                "summary": "Plan wskazuje 'Osteria dei Vecchi Sapori' w Barga — ta nazwa to restauracja w Mediolanie. W Barga szukaj: Osteria Il Borgo dei Sapori (Via Borgo 1, tel. 0583 724121) lub Trattoria L'Altana. Dania garfagnana: necci, pappardelle al cinghiale.",
                "source": "https://www.informagiovani-italia.com/cosa-mangiare-barga.htm",
                "checked": "2026-07"
            }
        ],
        "practical_tips": [
            "Rano 8:00: Duomo + Anello di Barga (2–3 h) — popołudnie Grotta del Vento",
            "Grotta del Vento: zarezerwuj online Itinerario 2 (2h, €18) — kurtka obowiązkowa (~10°C w jaskini)",
            "Parking Porta Reale rano prawie zawsze wolny we wrześniu — centrum pieszo 5 min",
            "Osteria: zweryfikuj nazwę — 'Vecchi Sapori' to Mediolan; w Barga → Il Borgo dei Sapori (Via Borgo 1)",
            "Grotta: check-in w biglietterii przed wejściem — drukowanie biletu nie wymagane"
        ],
        "parking": {
            "destination": "Barga — dzień wypadowy z bazy",
            "options": [
                {"name": "Parcheggio Porta Reale", "type": "public", "price": "bezpłatny", "gps_hint": "Via Bellavista / Via del Sasso, 55051 Barga", "note": "Start szlaku CAI 108 i wejście do centrum — zostaw auto tu na cały dzień"},
                {"name": "Grotta del Vento — parking", "type": "attraction", "price": "gratis", "gps_hint": "Località Fornovolasco, 55020 Vergemoli LU", "note": "Parking przy ticket office, ~20 min jazdy od Barga"},
                {"name": "Piazzale Matteotti", "type": "public", "price": "płatny", "gps_hint": "Dolna Barga", "note": "Backup gdy Porta Reale pełny (weekend)"}
            ],
            "tip": "Jeden parking na cały dzień: Porta Reale — rano Barga, popołudniu 20 min do Grotta"
        },
        "fuel_stops": [
            {"name": "IP Castelnuovo di Garfagnana", "location": "Via Roma / SS445", "road": "SS445", "hours": "7–20", "note": "Najbliższa stacja od Barga (~25 min) — nie potrzebna w dniu lokalnym, ale do weryfikacji poziomu paliwa"}
        ],
        "opening_hours": {
            "grotta_del_vento": "Cały rok (25.12 zamknięte) — sprawdź godziny tourów online",
            "duomo_barga": "Zwykle 8:00–12:00, 15:00–18:00 (msze w niedziele)",
            "osteria_barga": "Pranzo 12:00–14:30, cena 19:00–22:00 typowo"
        }
    },
    4: {
        "web_research": [
            {
                "topic": "Mercato Castelnuovo — KOREKTA DNIA",
                "summary": "Targ tygodniowy w Castelnuovo di Garfagnana to CZWARTEK (giovedì), 8:00–13:00, Piazza delle Erbe — NIE wtorek. Plan wymaga korekty: 15.09 (wt) = brak targu w Castelnuovo. Alternatywa wtorkowa: mercato Piazza al Serchio (20 min) lub Fornoli.",
                "source": "https://www.eventiesagre.it/Mercatini_Filiera+Corta/21184575_Mercato+Settimanale+Di+Castelnuovo+Di+Garfagnana.html",
                "checked": "2026-07"
            },
            {
                "topic": "Parco Orecchiella — wrzesień",
                "summary": "Centrum odwiedzających: do 14.09 codziennie 10–18, potem sob–nd 10–18 (wrzesień). Sentieristica i recinti faunistici ZAWSZE dostępne bezpłatnie. Muzea: €2 dorosły. Info: 0583 619098.",
                "source": "https://orecchiella.com/contatti-prenotazioni/",
                "checked": "2026-07"
            },
            {
                "topic": "Parking Castiglione di Garfagnana",
                "summary": "Parking przy Porta San Michele — przy bramie do średniowiecznych murów. Darmowy, mały — wystarczy na pół dnia zwiedzania.",
                "source": "https://www.informagiovani-italia.com/where-to-park-in-barga.htm",
                "checked": "2026-07"
            },
            {
                "topic": "Parking Orecchiella / Campaiano",
                "summary": "Centro Visitatori Orecchiella: darmowy parking przy Laghetti 6, San Romano. Droga SP324 kręta — dojazd od Castelnuovo przez Villa Collemandina/Corfino ~28 min.",
                "source": "https://orecchiella.com/",
                "checked": "2026-07"
            },
            {
                "topic": "Trattoria da Carlino — Castelnuovo",
                "summary": "Via Garibaldi 15 (nie Via Vittorio Emanuele). Pranzo 12:00–15:00, cena 19:00–22:00. Tel. 0583 644270. Zimą zamknięte w poniedziałki.",
                "source": "https://www.vetrina.toscana.it/attivita/ristorante-da-carlino/",
                "checked": "2026-07"
            }
        ],
        "practical_tips": [
            "KOREKTA: targ w Castelnuovo to CZWARTEK, nie wtorek — w dniu 4 kup farro IGP w sklepie albo pojedź na wtorkowy targ Piazza al Serchio",
            "Orecchiella: we wrześniu (po 14.09) centrum otwarte tylko sob–nd — ale szlaki CAI 587 ZAWSZE dostępne bezpłatnie",
            "Castiglione: obejście murów ~30 min — parking Porta San Michele, zero tłumów",
            "Orecchiella: weź kurtkę — 750–1200 m n.p.m., różnica temperatur 5–8°C",
            "Da Carlino: rezerwacja nie wymagana na lunch, ale przyjdź przed 13:00 — lokalni robotnicy zapełniają szybko"
        ],
        "parking": {
            "destination": "Trasa Castiglione → Orecchiella → Castelnuovo",
            "options": [
                {"name": "Castiglione — Porta San Michele", "type": "public", "price": "gratis", "gps_hint": "Castiglione di Garfagnana LU", "note": "Przy bramie do murów — zostaw na ~1 h"},
                {"name": "Orecchiella — Centro Visitatori", "type": "attraction", "price": "gratis", "gps_hint": "Località Laghetti 6, 55038 San Romano in Garfagnana", "note": "Start szlaku CAI 587 — parking przy muzeum"},
                {"name": "Castelnuovo — Piazzale Europa", "type": "public", "price": "gratis / niski", "gps_hint": "Piazzale Europa, Castelnuovo di Garfagnana", "note": "Duży parking, 5 min do centrum i Da Carlino"}
            ],
            "tip": "3 parkingi w ciągu dnia — nie musisz wracać do Bazy między punktami (wszystko <30 min jazdy)"
        },
        "fuel_stops": [],
        "opening_hours": {
            "orecchiella_centro": "Wrzesień do 14.09: codzi. 10–18; po 14.09: sob–nd 10–18. Sentieri: zawsze",
            "castelnuovo_mercato": "CZWARTEK 8:00–13:00 (Piazza delle Erbe) — nie wtorek!",
            "da_carlino": "Pranzo 12:00–15:00, cena 19:00–22:00"
        }
    },
    5: {
        "web_research": [
            {
                "topic": "Fortezza Verrucole — KRYTYCZNE: 16.09 to środa",
                "summary": "We wrześniu forteca otwarta pt–nd (od 15.09). 16.09.2026 (środa) = ZAMKNIĘTA. Alternatywa: spacer do fortecy z zewnątrz (widok 360° bezpłatny) lub przesuń wizytę na piątek/sobotę. Tel/WhatsApp: 379 2415958.",
                "source": "https://tuscanyplanet.com/en/verrucole-castle/",
                "checked": "2026-07"
            },
            {
                "topic": "Cennik Verrucole 2026",
                "summary": "Wstęp z przewodnikiem: €8 dorosły, €5 (6–18 lat). Wstęp częściowy (bez muzeum): €4. Rezerwacja via WhatsApp +39 379 2415958 (9–19). Wizyta ~1 h.",
                "source": "https://www.fortezzaverrucolearcheopark.it/it/informazioni.html",
                "checked": "2026-07"
            },
            {
                "topic": "Lago di Vagli — poziom wody wrzesień 2026",
                "summary": "Planowane oprożnienie i odsłonięcie Fabbriche di Careggine: lato 2027 (nie 2026). We wrześniu 2026 jezioro pełne — ruiny niewidoczne. Spacer po tamie i wzgórzach nadal warto.",
                "source": "https://www.lanazione.it/lucca/cronaca/nel-2027-lo-svaso-del-lago-di-vagli-ma-servono-parcheggi-e-strade-xlieyh3n",
                "checked": "2026-07"
            },
            {
                "topic": "Parking Lago di Vagli",
                "summary": "Darmowy parking przy Vagli Sotto (przed wsią). Przy tamie (Diga del Lago di Vagli) — parking przy SP, 2 min pieszo. Latem zapełnia się ~12:30 — przyjedź rano lub po 15:00.",
                "source": "https://evendo.com/locations/italy/lucca/attraction/lago-di-vagli",
                "checked": "2026-07"
            },
            {
                "topic": "Agriturismo Il Corniolo — weryfikacja lokalizacji",
                "summary": "Il Corniolo (agriturismoilcorniolo.it) leży w Castiglione di Garfagnana (Loc. Le Prade 25), NIE w Vagli Sotto/Careggine. Alternatywa lunch przy Vagli: Ristorante Bar Radicchi (taras nad jeziorem) lub La Ceragetta (Isola Santa, 25 min).",
                "source": "https://agriturismoilcorniolo.it/it/il-corniolo-si-presenta",
                "checked": "2026-07"
            }
        ],
        "practical_tips": [
            "UWAGA: 16.09 = środa — Fortezza Verrucole ZAMKNIĘTA (wrzesień pt–nd). Spacer zewnętrzny OK, wstęp od pt",
            "Lago di Vagli: ruiny Fabbriche NIE widoczne w 2026 — oprożnienie planowane na lato 2027",
            "Vagli: parking przy tamie zapełnia się w południe — jedź tam rano (9:00) lub po Verrucole",
            "Il Corniolo jest w Castiglione (35 km), nie Vagli — na lunch przy jeziorze: Bar Radicchi, Vagli Sotto",
            "Gorfigliano: mikrowioska, zero turystów — 20 min od Vagli, idealnie na koniec dnia"
        ],
        "parking": {
            "destination": "Verrucole → Lago di Vagli → Gorfigliano",
            "options": [
                {"name": "Verrucole — piazza przy kościele", "type": "public", "price": "gratis", "gps_hint": "Frazione Verrucole, San Romano in Garfagnana", "note": "Parkuj w wiosce, 10 min pieszo pod górę do fortecy"},
                {"name": "Diga del Lago di Vagli", "type": "attraction", "price": "gratis", "gps_hint": "55030 Vagli Sotto LU", "note": "Parking przy tamie — start spaceru wokół jeziora"},
                {"name": "Vagli Sotto — parking centralny", "type": "public", "price": "gratis", "gps_hint": "Vagli Sotto", "note": "Mały — latem pełny od 12:30, backup: ulica główna"},
                {"name": "Gorfigliano — przy kościele", "type": "public", "price": "gratis", "gps_hint": "55038 Minucciano LU", "note": "Kilka miejsc przy romańskim kościele"}
            ],
            "tip": "Verrucole rano (8:00) → Vagli po lunchu (13:00) → Gorfigliano wieczorem — logiczna pętla zgodna z drive ≤25 min"
        },
        "fuel_stops": [],
        "opening_hours": {
            "verrucole": "Wrzesień (od 15.09): pt–nd 10:30–18:30. 16.09 (środa) = ZAMKNIĘTE",
            "lago_vagli": "Tam i parking: całą dobę (bezpłatny)",
            "bar_radicchi_vagli": "Pranzo 12:00–14:30 typowo — potwierdź telefonicznie"
        }
    }
}


def main():
    with open(PLAN, encoding="utf-8") as f:
        plan = json.load(f)

    for day in plan["days"]:
        num = day.get("day_num")
        if num not in ENRICHMENTS:
            continue
        extra = ENRICHMENTS[num]
        for key, val in extra.items():
            day[key] = val
        # Update outdated tips where needed
        if num == 1:
            day["tips"] = [
                "Granicę PL/DE przekrocz przez Świecko (A2) — opłata AWSA ~129 PLN do Konina",
                "E-winieta AT: €12,80/10 dni na shop.asfinag.at — kup w PL, start 13.09",
                "Zatankuj w Niemczech przed Austrią — paliwo tańsze niż we Włoszech",
                "Frankenwald Ost (A9 km 254) — dobry postój lunchowy w połowie trasy"
            ]
        if num == 2:
            day["tips"] = [
                "Streckenmaut Brenner A13: €12,50 — kup online na shop.asfinag.at",
                "A22 Włochy: bilet przy wjeździe, płatność kartą przy wyjeździe (~€15–22 Brenner–Werona)",
                "Ostatnie 50 km SS445 — kręta górska droga, zadzwoń do agriturismo z ETA",
                "Barga ZTL: parkuj Parcheggio Porta Reale, centrum pieszo 5 min"
            ]
        if num == 4:
            day["tips"] = [
                "KOREKTA: targ Castelnuovo = CZWARTEK (nie wtorek) — farro IGP w sklepie lub targ Piazza al Serchio we wt",
                "Orecchiella: szlaki zawsze otwarte; centrum/muzea w wrześniu sob–nd",
                "Castiglione: kompletne mury — obejście obwodu ~30 min",
                "Da Carlino: Via Garibaldi 15, lunch 12:00–15:00"
            ]
        if num == 5:
            day["tips"] = [
                "16.09 = środa: Verrucole ZAMKNIĘTA (wrzesień pt–nd) — spacer zewnętrzny lub zmiana dnia",
                "Lago di Vagli: ruiny Fabbriche niewidoczne w 2026 — oprożnienie planowane 2027",
                "Il Corniolo jest w Castiglione, nie Vagli — lunch: Bar Radicchi nad jeziorem",
                "Parking przy tamie Vagli — przyjedź rano, zapełnia się po południu"
            ]

        ENRICH.mkdir(exist_ok=True)
        out = ENRICH / f"dzien-{num:02d}.json"
        with open(out, "w", encoding="utf-8") as f:
            json.dump(day, f, ensure_ascii=False, indent=2)
        print(f"Wrote {out}")

    with open(PLAN, "w", encoding="utf-8") as f:
        json.dump(plan, f, ensure_ascii=False, indent=2)
    print(f"Updated {PLAN}")


if __name__ == "__main__":
    main()
