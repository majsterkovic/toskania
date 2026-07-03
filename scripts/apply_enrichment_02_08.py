#!/usr/bin/env python3
"""Apply web-research enrichment to plan.json days 2-8 and write enrichment/*.json backups."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLAN = ROOT / "plan.json"
ENRICHMENT_DIR = ROOT / "enrichment"

ENRICHMENT_BY_DAY = {
    2: {
        "route_segments": [
            {"segment": "Neustadt → Rosenheim", "road": "A9/A8", "km": "~120", "note": "Tankowanie w Niemczech przed Austrią. Unikaj weekendowych korków na A8 w kierunku Monachium (niedziela = ruch powrotny z Alp)."},
            {"segment": "Rosenheim → Innsbruck", "road": "A93 Inntal", "km": "~95", "note": "Dolina Innu — piękna, ale ograniczenia prędkości. Winieta AT obowiązkowa od pierwszego km."},
            {"segment": "Innsbruck → Brenner", "road": "A13", "km": "~35", "note": "Opłata odcinkowa A13 (Brenner) €12,50 jednorazowo — osobno od winiety. Most Lueg: w 2026 możliwe zwężenia i korki w weekendy."},
            {"segment": "Brenner → Bolzano", "road": "A22", "km": "~55", "note": "Włoska autostrada — pobierz biglietto na bramce. Bolzano = pierwszy duży postój po granicy."},
            {"segment": "Bolzano → Werona", "road": "A22", "km": "~145", "note": "Dolina Adige. Rovereto Sud = dobry postój lunchowy (zjazd z A22)."},
            {"segment": "Werona → Lukka", "road": "A4/A11", "km": "~175", "note": "Objazd Werony (Verona Sud). A11 Firenze-Mare do Lucca."},
            {"segment": "Lukka → Barga", "road": "SS12/SS445", "km": "~50", "note": "Ostatnie 50 km kręte (SR445) — 60–90 min. Zadzwoń do agriturismo z ETA."},
        ],
        "parking": {
            "barga_arrival": "Centrum Barga = ZTL z kamerami. Parkuj przy Parcheggio Porta Reale (Via Bellavista, przy murach) lub Piazzale Matteotti (płatny, dolna część miasta). Nie wjeżdżaj przez Porta Reale bez zezwolenia.",
            "agriturismo": "Większość agriturismo w okolicach Mologno/Loppia ma własny parking — nawiguj bezpośrednio na adres noclegu, nie do centrum Barga.",
            "tip": "Po 16:00 przyjazd = zmęczenie + kręta SS445. Lepiej zatankować w Fornaci di Barga (dolina) niż szukać stacji na wzgórzu."
        },
        "fuel_stops": [
            {"name": "Tankowanie poranne Neustadt/Kelheim", "location": "B299/B16", "km_from_start": 0, "note": "Pełny bak przed Austrią. Ostatnia niemiecka cena paliwa na trasie."},
            {"name": "Raststätte Holzkirchen / Irschenberg", "location": "A8/A93", "road": "A8", "opening_hours": "24/7", "note": "Postój przed lub po Monachium — tankowanie + kawa przed Inntal."},
            {"name": "Tankowanie Innsbruck / Vomp", "location": "A12/A13", "road": "A13", "opening_hours": "24/7", "note": "Ostatnia stacja przed Brennerem. Kup e-opłatę A13 Brenner online jeśli nie masz."},
            {"name": "Autogrill Bolzano Sud", "location": "A22 km ~60", "road": "A22", "opening_hours": "6:00–22:00", "note": "Pierwszy duży postój we Włoszech — tankowanie, WC, snack. Tuż po zejściu z Alp."},
            {"name": "Area servizio Rovereto Sud", "location": "A22, Rovereto", "road": "A22", "opening_hours": "24/7", "note": "Idealny postój lunchowy — zjazd z autostrady, bar/trattoria w okolicy."},
            {"name": "Tankowanie przed Lucca", "location": "A11 Capannori/Chiesa", "road": "A11", "opening_hours": "24/7", "note": "Zatankuj przed zejściem na SS445 — stacji mało w górach Garfagnany."},
        ],
        "opening_hours": {
            "brenner_border": "Granica AT/IT: 24h (ruch ciągły, korki weekendowe 10:00–18:00)",
            "a22_toll_booths": "24h — płatność kartą/gotówką na wyjeździe",
            "agriturismo_checkin": "Typowo 15:00–19:00 — zadzwoń jeśli ETA po 18:00",
            "barga_restaurants_evening": "Osterie 19:00–22:30 — kolacja w agriturismo lub L'Osteria (Piazza Angelio)"
        },
        "practical_tips": [
            "Kup winietę AT (10 dni €12,80) + opłatę odcinkową A13 Brenner (€12,50) przed wyjazdem — shop.asfinag.at",
            "Niedziela 13.09 = ruch powrotny z Alp na A13/A22 — wyjedź o 7:00, unikaj południa na Brennerze",
            "Włochy: bramki autostradowe — gotówka EUR lub karta. Szacunek pedaggio A22+A11: ~€35–45 na samochód",
            "Lunch: zjazd A22 Rovereto Sud (nie na autostradzie) — bar/trattoria ~€10–15",
            "SS445 Fornaci→Barga: kręte, wąskie odcinki — zwolnij, przepuszczaj lokalnych. Czas realny 60–90 min",
            "Zadzwoń do agriturismo z ETA gdy miniesz Lucca — ostatnie 50 km bez zasięgu w niektórych tunelach"
        ],
        "web_research": [
            {"topic": "Winieta Austria 10-dniowa + A13 Brenner 2026", "summary": "Winieta 10-dniowa €12,80 (natychmiastowa online). A13 Brenner = osobna opłata odcinkowa €12,50 jednorazowo (nie wymaga winiety na tym odcinku, ale winieta potrzebna na A93/A12).", "source": "https://shop.asfinag.at/en/toll-products/digital-vignette/10-day-vignette-car", "checked": "2026-07"},
            {"topic": "Korki Brenner 2026 — most Lueg", "summary": "A13/A22 to główny korytarz transalpijski. W 2026 ograniczenia na moście Lueg (Austria) = możliwe zwężenia. Najgorsze: sob–nd lipiec–wrzesień 10:00–18:00. Niedziela = ruch powrotny z Włoch.", "source": "https://italyonfoot.com/italy/brenner-traffic-italy-2026/", "checked": "2026-07"},
            {"topic": "Pedaggio A22 Brennero-Modena", "summary": "System zamknięty: biglietto na wjeździe, płatność na wyjeździe. Cała trasa Modena–Brenner ~€22,80 (klasa A, 2026). Wzrost +1,46% od 01.01.2026.", "source": "https://www.autobrennero.it/en/on-the-road/toll/what-it-is-and-how-it-is-calculated/", "checked": "2026-07"},
            {"topic": "Barga parking i ZTL", "summary": "Centrum historyczne = ZTL monitorowana kamerami. Parking przy Porta Reale (Via Bellavista) lub płatny Piazzale Matteotti. Wjazd do murów tylko z zezwoleniem.", "source": "https://www.informagiovani-italia.com/where-to-park-in-barga.htm", "checked": "2026-07"},
            {"topic": "Dojazd Lucca → Barga SS445", "summary": "38 km z Lucca, ~45–60 min. SS12 do Borgo a Mozzano, potem SR445 przez Fornaci di Barga. Kręta droga górska — nie dla nocnej jazdy po zmęczeniu.", "source": "https://discovertuscany.com/garfagnana/how-to-get-to-barga.html", "checked": "2026-07"},
            {"topic": "Szacunek opłat tranzytowych dzień 2", "summary": "A13 Brenner €12,50 + A22 ~€15–20 (Brenner–Werona) + A11 ~€5–8 (Werona–Lucca) ≈ €35–45 łącznie. Płatność kartą na bramkach.", "source": "https://www.insidertipps-italien.com/en/auto/road-toll/motorway/brenner-toll.html", "checked": "2026-07"},
        ],
    },
    3: {
        "parking": {
            "barga_centro": "Parcheggio Porta Reale — bezpłatny parking przy murach (Via Bellavista / incrocio Via del Sasso). 5 min pieszo do Duomo. ZTL za Porta Reale — nie wjeżdżaj bez permitu.",
            "alternatives": "Piazzale Matteotti (płatny, dolna Barga) — więcej miejsc. Parking camperów: Via Hayange (kontynuacja Via Marconi).",
            "grotta_del_vento": "Parking przy ticket office w Fornovolasco — bezpłatny, mały. Przyjazd 20 min z Barga przez kręte serpentyny.",
            "tip": "Rano (8:00) Porta Reale prawie pusty. Po 11:00 więcej aut — ale wciąż bez tłumów jak w Lucca."
        },
        "fuel_stops": [
            {"name": "Distributore Barga (Via Piero Gobetti)", "location": "Barga bassa, angolo Via Roma", "note": "Jedyna stacja w mieście — otwarta w dzień, tankuj rano przed wycieczką."},
            {"name": "IP Fornaci di Barga", "location": "SS445, dolina Serchio", "note": "Alternatywa w dolinie — łatwiejszy dojazd niż centrum Barga."},
        ],
        "opening_hours": {
            "duomo_barga": "Katedra: zwykle 8:00–12:00 i 15:00–18:00 (sprawdź tablicę przy wejściu). Wieża: sezon letni ~10:00–18:00, bilety ~€3.",
            "grotta_del_vento": "1.04–2.11: Itinerario 1 co godz. 10–18; It.2 o 11,15,17; It.3 o 10,14. Bilety online grottadelvento.com. Check-in w kasie przed wejściem.",
            "grotta_prices": "Itinerario 1: €10 (1h), It.2: €18 (2h), It.3: €25 (3h). Tel. 0583 722024 (10:00–19:00).",
            "osteria_il_borgo_dei_sapori": "Via Borgo 1 — sprawdź tablicę; typowo 12:00–14:30 i 19:00–22:00. Rezerwacja zalecana w weekend.",
            "l_osteria_piazza_angelio": "Pn zamknięte; Wt–Nd 11:00–15:00, 19:00–24:00. Tel. +39 335 5387113"
        },
        "practical_tips": [
            "Rano 8:00–10:00 = najlepsze światło na Duomo i widok na Alpy Apuańskie z tarasu katedry",
            "Grotta del Vento: zarezerwuj Itinerario 1 (~16:00) online — po południowej wędrówce. Weź kurtkę (10°C w jaskini)",
            "UWAGA: „Osteria dei Vecchi Sapori” w planie = prawdopodobnie „Osteria Il Borgo dei Sapori” (Via Borgo 1) lub „L'Osteria” (Piazza Angelio 13) — obie w Barga",
            "Szlak Anello CAI 108: start Porta Reale, 2–3h, oznaczenia czerwono-białe. Bezpłatny, bez rezerwacji",
            "Necci con ricotta i castagnaccio — dania sezonowe wrześniowe, pytaj o menu del giorno"
        ],
        "web_research": [
            {"topic": "Grotta del Vento — orario estivo", "summary": "1.04–2.11: It.1 co godz. 10–18; It.2: 11,15,17; It.3: 10,14. Otwarte codziennie (25.12 zamknięte). Prenotazione online zalecana.", "source": "https://grottadelvento.com/it/orari-biglietteria/", "checked": "2026-07"},
            {"topic": "Grotta del Vento — ceny 2026", "summary": "It.1 €10, It.2 €18, It.3 €25. Ridotto per bambini 4–10, soci CAI. Check-in alla biglietteria prima dell'ingresso.", "source": "https://grottadelvento.com/opening-times-and-prices/", "checked": "2026-07"},
            {"topic": "Parking Barga ZTL", "summary": "ZTL w centrum storico z kamerami. Parking Porta Reale przy murach — bezpłatny, medium size. Camper: Via Hayange.", "source": "https://www.informagiovani-italia.com/dove-parcheggiare-barga.htm", "checked": "2026-07"},
            {"topic": "Ristoranti Barga — Borgo dei Sapori", "summary": "Osteria Il Borgo dei Sapori, Via Borgo 1 — cucina garfagnana locale. L'Osteria Piazza Angelio 13: Pn chiuso, Mar-Dom 11–15, 19–24.", "source": "https://www.paginegialle.it/barga-lu/ristoranti/riccardo-negri_2", "checked": "2026-07"},
            {"topic": "Anello di Barga CAI 108", "summary": "Pętla 2–3h od Porta Reale przez castagneti e faggi. Szlak oznaczony tablicą CAI. Bezpłatny dostęp.", "source": "https://discovertuscany.com/garfagnana/how-to-get-to-barga.html", "checked": "2026-07"},
        ],
        "food_note": "Plan wymienia „Osteria dei Vecchi Sapori” — w Barga istnieją: Osteria Il Borgo dei Sapori (Via Borgo 1) i L'Osteria (Piazza Angelio 13). Zweryfikuj przy rezerwacji.",
    },
    4: {
        "parking": {
            "castiglione": "Parcheggio Porta Inferi — 26 miejsc, tuż przy murach (inauguracja 2024). Alternatywa: Via Soccorso 3 — parking przy bramie miasta, toalety, woda.",
            "orecchiella": "Centro Visitatori Campaiano (Località Laghetti 6) — parking przy centrum. Dostęp do szlaków bezpłatny; muzea płatne.",
            "castelnuovo": "Piazzale Europa — główny parking przy stolicy doliny. Wtorek = targ na Piazza Umberto I.",
            "tip": "Kolejność: Castiglione rano → Orecchiella (kurtka!) → Castelnuovo na lunch i targ"
        },
        "fuel_stops": [
            {"name": "ENI Castelnuovo di Garfagnana", "location": "Via Roma / SS445", "note": "Stacja w stolicy doliny — tankuj przed powrotem do bazy."},
        ],
        "opening_hours": {
            "orecchiella_centro_visitatori": "Wrzesień 2026: 10:00–18:00 codziennie do nd 14.09, potem sob–nd. Bilet: €2 dorosły, €1 bambini 6–11.",
            "orecchiella_sentieri": "Szlaki (recinto orsi, rete sentieristica) — dostęp wolny 24h. Muzea i recinti faunistici wg godzin centrum.",
            "castiglione_mura": "Mury i borgo: dostęp wolny 24h. Rocca: sprawdź tablicę — zwykle 10:00–18:00 sezon letni.",
            "castelnuovo_mercato": "Wtorek rano: targ na Piazza Umberto I — farro IGP, formaggi, salumi. 8:00–13:00.",
            "trattoria_da_carlino": "Pranzo 12:00–15:00, cena 19:00–22:00. Pn chiuso in inverno (wrzesień = otwarte). Tel. 0583 644270"
        },
        "practical_tips": [
            "Wtorek 15.09 = targ w Castelnuovo — kup farro della Garfagnana IGP na pamiątkę",
            "Orecchiella: wejście od Campaiano, szlak 587 w dół — łącznie ~2h. Weź kurtkę (1200 m n.p.m.)",
            "Castiglione: obejście murów ~30 min — jeden z najlepiej zachowanych borgo fortificato w Toskanii",
            "Dogs: nie wnoszą się do płatnej strefy Orecchiella (muzea/recinti)",
            "Castelnuovo: forteca Ariosto — wstęp bezpłatny do dziedzińca, muzeum wg tablicy"
        ],
        "web_research": [
            {"topic": "Parco Orecchiella — orario 2026", "summary": "Settembre: 10–18 tutti i giorni fino a domenica 14, poi sab–dom. Aree sentieristiche sempre accessibili. Chiusura per allerta meteo possibile.", "source": "https://orecchiella.com/contatti-prenotazioni/", "checked": "2026-07"},
            {"topic": "Orecchiella — biglietti", "summary": "Centro Visitatori + musei: €2 adulti, €1 bambini 6–11, gratis sotto 6. Cani non ammessi in area a pagamento.", "source": "https://orecchiella.com/contatti-prenotazioni/", "checked": "2026-07"},
            {"topic": "Castiglione — nuovo parcheggio Porta Inferi", "summary": "26 posti auto inaugurati 2024, 2 passi dal centro storico. Investimento €203k — risolve problema sosta lungo SP.", "source": "https://www.lanazione.it/lucca/cronaca/castiglione-inaugura-il-parcheggio-b9ff5c3e", "checked": "2026-07"},
            {"topic": "Trattoria da Carlino — orari", "summary": "Pranzo 12–15, cena 19–22. Lunedì chiuso in inverno. Via Garibaldi 13–15, Castelnuovo. Tel. 0583 644270.", "source": "https://www.vetrina.toscana.it/attivita/ristorante-da-carlino/", "checked": "2026-07"},
            {"topic": "Sentiero CAI 587 Orecchiella", "summary": "~4 km, 2h, przez łąki alpejskie i dąb burgundzki (750–1100 m). Start Campaiano — visitor center.", "source": "https://orecchiella.com/", "checked": "2026-07"},
        ],
    },
    5: {
        "parking": {
            "verrucole": "Parking przy frazione Verrucole — mały plac u podnóża wzgórza. 10 min pieszo pod górę do fortecy. GPS: 44.178728, 10.332161.",
            "lago_vagli": "Parking przy tamie (Diga del Lago di Vagli) — bezpłatny, widok na jezioro. Ścieżki od tamy wzdłuż brzegu.",
            "agriturismo_corniolo": "Loc. Vagli Sotto, Careggine — parking na miejscu po rezerwacji pranzo.",
            "tip": "Verrucole rano (10:00) → Lago Vagli → lunch Il Corniolo (rezerwacja!)"
        },
        "fuel_stops": [
            {"name": "IP Castelnuovo / Gallicano", "location": "SS445 dolina", "note": "Tankuj rano przed wyjazdem w góry — stacji mało przy Vagli."},
        ],
        "opening_hours": {
            "fortezza_verrucole": "Wrzesień 2026: czw–nd 10:30–18:30 (ostatnie wejście 1h przed zamknięciem). Środa 16.09 = czwartek w planie? Dzień 5 = 16.09 środa — sprawdź: pt–nd lub czw–nd. Tel/WhatsApp +39 379 241 5958.",
            "verrucole_tickets": "Ingresso con visita guidata €8, parziale €4, ragazzi 6–18 €5. Prenotazione consigliata.",
            "lago_vagli": "Dostęp do tamy 24h. Ruiny Fabbriche di Careggine: NIE widoczne we wrześniu 2026 — planowany svuotamento lago estate 2027.",
            "agriturismo_il_corniolo": "Pranzo tipico: prenotazione obbligatoria dzień wcześniej. Tipico 12:30–14:30."
        },
        "practical_tips": [
            "Lago di Vagli: ruiny Fabbriche di Careggine pod wodą — svuotamento zaplanowany na lato 2027, nie 2026",
            "Fortezza Verrucole: rezerwuj przez WhatsApp +39 379 241 5958 — tury co ~1h, max grupa",
            "Wędrówka do fortecy: strome podejście 15 min — buty trekkingowe, woda",
            "Il Corniolo: zadzwoń dzień wcześniej na „pranzo tipico” (~€18–22/os) — fagioli di Sorana IGP",
            "Gorfigliano: 10 min postój fotograficzny — romański kościół, brak infrastruktury turystycznej"
        ],
        "web_research": [
            {"topic": "Fortezza delle Verrucole — orari e prezzi", "summary": "Settembre: gio–dom 10:30–18:30. Tour guidato €8, ingresso parziale €4. Prenotazione WhatsApp 3792415958 (9–19).", "source": "https://www.fortezzaverrucolearcheopark.it/it/informazioni.html", "checked": "2026-07"},
            {"topic": "Lago di Vagli — svuotamento 2027", "summary": "Fabbriche di Careggine sotto acqua dal 1994. Svuotamento ufficiale previsto estate 2027 (non 2026). Enel non ha più urgenza tecnica.", "source": "https://www.lanazione.it/lucca/cronaca/nel-2027-lo-svaso-del-lago-di-vagli-ma-servono-parcheggi-e-strade-xlieyh3n", "checked": "2026-07"},
            {"topic": "Lago di Vagli — accesso", "summary": "Diga accessibile, parking gratuito. Spacer po tamie i ścieżkach wschodniego brzegu — bezpłatny, bez oznakowania.", "source": "https://toscanashopping.it/blog/luoghi-da-scoprire/il-lago-di-vagli-e-il-paese-sommerso/", "checked": "2026-07"},
            {"topic": "Verrucole Archeopark — prenotazione", "summary": "Visita guidata ~1h + tempo libero negli spazi esterni. Prenotazione non obbligatoria ma altamente consigliata.", "source": "https://www.fortezzaverrucolearcheopark.it/en/", "checked": "2026-07"},
        ],
    },
    6: {
        "route_segments": [
            {"segment": "Barga → Borgo a Mozzano", "road": "SS445/SS12", "km": "~25", "note": "Zjazd z gór do doliny Serchio. Ponte del Diavolo tuż przy SS12."},
            {"segment": "Borgo a Mozzano → Bagni di Lucca", "road": "SS12", "km": "~12", "note": "W dół doliny — Bagni di Lucca po prawej (Via Lodovica/SP20)."},
            {"segment": "Bagni di Lucca → Lucca → A11", "road": "SS12/A11", "km": "~35", "note": "Tankowanie przed wjazdem na A11. Unikaj ZTL centrum Lucca."},
            {"segment": "A11 → Siena", "road": "A11/E70/Siena Sud", "km": "~110", "note": "Superstrada Siena-Bettolle. Raccordo do Castelnuovo Berardenga."},
            {"segment": "Siena Sud → BAZA 2", "road": "SP408/SS326", "km": "~25", "note": "Wjazd w Chianti — kręte drogi do agriturismo. ETA 16:00–17:00."},
        ],
        "parking": {
            "ponte_diavolo": "Parcheggio al Ponte del Diavolo — bezpłatny, 24h, przy SS12 tuż przy moście (strona wschodnia). Most pieszy — 15 min spacer.",
            "bagni_lucca": "Parking przy Ponte delle Catene lub centrum — strefy płatne. Terme Bernabò: Via Bagni Caldi 36 — kilka miejsc parkingowych.",
            "transfer_tip": "Bagaż w aucie cały dzień — zaparkuj przy moście, zwiedzaj pieszo, wróć po lunchu na transfer"
        },
        "fuel_stops": [
            {"name": "Tankowanie Garfagnana przed A11", "location": "Fornaci di Barga / Capannori", "road": "SS12", "note": "Ostatnie tankowanie przed autostradą — obowiązkowe przed transferem do Chianti."},
            {"name": "Area servizio Lucca Est / Chiesa", "location": "A11", "road": "A11", "opening_hours": "24/7", "note": "Opcjonalny postój na A11 — kawa przed Sieną."},
            {"name": "IP Castelnuovo Berardenga", "location": "SP408, Chianti", "km_from_start": "~195", "note": "Zatankuj przy dotarciu do bazy — stacji mało na wiejskich drogach Chianti."},
        ],
        "opening_hours": {
            "ponte_del_diavolo": "Dostęp 24h (obiekt na zewnątrz). Najlepsze światło: 8:00–10:00 rano — mgła nad Serchio.",
            "bagni_bernabo_spa": "Bagno Bernabò: Pn–Nd 9:00–18:00. Tel. +39 331 171 9014. Rezerwacja zalecana.",
            "casino_bagni": "Casinò di Bagni di Lucca — muzeum (najstarsze kasyno Włoch, nieaktywne) — 10:00–18:00 sezon.",
            "trattoria_da_giulio": "UWAGA: Trattoria da Giulio (Via Casalini 1) — sprawdź godziny; typowo 12:00–14:30. Rezerwacja na lunch przed przejazdem.",
            "agriturismo_baza2_checkin": "15:00–19:00 — zadzwoń z A11 z ETA"
        },
        "practical_tips": [
            "Ponte del Diavolo: przyjedź przed 10:00 — po 11:00 autokary turystyczne z Lucca",
            "Bagni di Lucca: 1–1,5h — Ponte delle Catene, English Church, opcjonalnie kąpiel termalna Bernabò",
            "Wyjazd do BAZY 2 po lunchu ~13:30 — 195 km, realnie 2h15–2h45 z postojem",
            "Tankowanie obowiązkowe przed A11 — stacji mało w Chianti poza Gaiole/Castelnuovo Berardenga",
            "Zadzwoń do agriturismo BAZA 2 z A11 — check-in 16:00–17:00, droga do Vagliagli kręta"
        ],
        "web_research": [
            {"topic": "Ponte del Diavolo — parking i dostęp", "summary": "Parking gratuito 24h przy SS12, obie strony. Most pedonale — 5 min. Tre osterie accanto al ponte.", "source": "https://www.viaggieritratti.it/ponte-del-diavolo-di-borgo-a-mozzano/", "checked": "2026-07"},
            {"topic": "Bagno Bernabò Bagni di Lucca", "summary": "Terme storiche (Elisa Bonaparte 1810). Aperto 9–18 tutti i giorni. Bagno romano in marmo. Tel. 331 171 9014.", "source": "https://bellabagnidilucca.com/2025/09/23/a-roman-bath-at-bernabo-spa/", "checked": "2026-07"},
            {"topic": "Trasa Barga → Chianti", "summary": "SS445→SS12→A11→Siena Sud→SP408. ~195 km, 2h15 bez postojów. Pedaggio A11 ~€8–10.", "source": "https://www.toscana.info/en/lucca/lucca-province/barga/", "checked": "2026-07"},
            {"topic": "Terme Bagni di Lucca — stato 2026", "summary": "Hotel Terme Bagni di Lucca: piscina aperta, stabilimento termale principale chiuso. Bernabò (Ponte a Serraglio) operativo.", "source": "https://www.terme-bagnidilucca.it/", "checked": "2026-07"},
        ],
    },
    7: {
        "parking": {
            "castello_brolio": "Parking u podnóża zamku — bezpłatny, duży. Via Madonna a Brolio, Gaiole in Chianti. Wejście pieszo 5 min pod górę.",
            "radda_chianti": "Piazzale del Castello — parking przy murach miasteczka. ZTL w centrum — parkuj na piazzale.",
            "bosco_brolio": "Ten sam parking co zamek — ścieżka Sentiero delle Querce od bramy zamku.",
            "tip": "Brolio rano (10:00 otwarcie) → Bosco → Radda na lunch/wino"
        },
        "fuel_stops": [
            {"name": "IP Gaiole in Chianti", "location": "SP408, centrum", "note": "Stacja w centrum Chianti — tankuj rano przed objazdem winnic."},
        ],
        "opening_hours": {
            "castello_brolio": "20.03–12.10.2026: codziennie 10:00–19:00 (biglietteria do 18:00). 18.09 = pt: otwarte. Biglietto giardini+bastioni+degustazione ~€15.",
            "brolio_tours": "Visita libera: no prenotazione. Tour guidati (Classic €28): prenotazione su visit.ricasoli.com.",
            "radda_shops": "Winiarnie i enoteche: 10:00–13:00, 15:00–19:00. Sobota = więcej otwartych punktów.",
            "osteria_passignano": "Pn–Sb: pranzo 12:15–14:15, cena 19:30–21:30. Nd chiuso. 18.09 = piątek OK na lunch. Tel. +39 055 8071278 — prenotazione obbligatoria.",
            "bosco_brolio": "Szlak wokół murów: dostęp 24h, bezpłatny — najlepszy rano"
        },
        "practical_tips": [
            "Brolio: przyjedź na 10:00 (otwarcie) — 1,5h na zamek, ogrody i degustację Chianti Classico",
            "Bosco di Brolio: pętla Sentiero delle Querce 2–3 km — dąb omszony i burgundzki, bezpłatnie od parkingu",
            "Radda: mniej turystyczna niż Greve — lokalne enoteche z degustacją €5–10",
            "Osteria di Passignano: Michelin — rezerwuj telefonicznie min. 2 tyg. wcześniej. Piątek lunch = OK",
            "Winiarnie w settembre: vendemmia (zbiór winogron) — możliwe krótsze godziny, sprawdź przed wyjazdem"
        ],
        "web_research": [
            {"topic": "Castello di Brolio — orari 2026", "summary": "20.03–12.10: 10–19 tutti i giorni (biglietteria fino 18). 13–31.10: 10–18. Ingresso giardini con degustazione.", "source": "https://www.ricasoli.com/castello/", "checked": "2026-07"},
            {"topic": "Castello di Brolio — prezzi", "summary": "Visita libera giardini+bastioni+cappella+degustazione: ~€15. Classic Tour con cantina: ~€28, prenotazione obbligatoria.", "source": "https://toscanashopping.it/blog/luoghi-da-scoprire/castello-di-brolio-prezzi-orari-e-come-arrivare/", "checked": "2026-07"},
            {"topic": "Osteria di Passignano — orari", "summary": "Mar–Sab 12:15–14:15, 19:30–21:30. Domenica chiuso. Prenotazione: +39 055 8071278. Michelin star dal 2007.", "source": "https://www.osteriadipassignano.com/en/contact-us/", "checked": "2026-07"},
            {"topic": "Radda in Chianti — enoteche", "summary": "Borgo medievale, Palazzo del Podestà XIV sec. Enoteche aperte 10–13 e 15–19. Meno affollata di Greve.", "source": "https://www.ricasoli.com/castello/", "checked": "2026-07"},
            {"topic": "Bosco di Brolio — sentiero", "summary": "Sentiero delle Querce: 2–3 km loop od parkingu zamku. Quercus pubescens i Q. cerris.", "source": "https://www.ricasoli.com/castello/", "checked": "2026-07"},
        ],
    },
    8: {
        "parking": {
            "santa_caterina": "Parcheggio Santa Caterina — Via Esterna di Fontebranda 13. 473 miejsc, kryty, 24h. €2/h, €35/dzień. Schody ruchome do centrum (gratis). Max wysokość 2,0 m.",
            "san_domenico": "Parcheggio San Domenico — alternatywa, podobne ceny. Blisko Basilica San Domenico.",
            "stadio_fortezza": "Parcheggio Stadio-Fortezza — €2/h (7:00–20:00), €26/dzień. 15 min pieszo do Campo. Tańszy na krótki postój.",
            "tip": "Sobota 19.09: wyjazd 7:00 z bazy → parking Santa Caterina 7:25 → Campo 7:35 pieszo. Wyjazd przed 14:00."
        },
        "fuel_stops": [
            {"name": "IP Castelnuovo Berardenga", "location": "baza Chianti", "note": "Tankuj rano przed wyjazdem do Sieny — paliwo na powrót."},
        ],
        "opening_hours": {
            "piazza_campo": "Dostęp 24h. Torre del Mangia: 10:00–19:00 (mar–ott), ostatnie wejście 18:30.",
            "duomo_siena": "18.09 sobota: 10:00–19:00 (sezon). Niedziela: 9:30–18:00 (podłoga odkryta). Ostatnie wejście 30 min przed zamknięciem.",
            "pavimento_mosaico": "Podłoga mozaikowa ODKRYTA 18.08–15.11.2026 — wyższy bilet OPA SI (€16 vs €14). Warto!",
            "libreria_piccolomini": "W kompleksie Duomo — ten sam bilet OPA SI Pass.",
            "trattoria_papei": "Sob 19.09: pranzo 12:00–15:00, cena 19:00–22:30. Cucina 12:00–22:30. Tel. 0577 280894 (prenotazioni 10:00–19:00).",
            "opera_duomo_ticket_office": "Piazza Duomo 7 + Visitor Center Via di Città 48 — 9:30–19:00"
        },
        "practical_tips": [
            "SOBOTA = kluczowy dzień: wyjazd 7:00, Campo o 7:30 prawie pusty. Tłumy od 10:00, szczyt po 11:00",
            "Bilety Duomo: kup online operaduomo.siena.it — OPA SI Pass (€16 con pavimento). Unikniesz kolejki o 9:30",
            "Podłoga mozaikowa: odkryta do 15.11.2026 — główny powód wizyty we wrześniu!",
            "Parking Santa Caterina: €2/h = ~€8 za 4h poranną wizytę. W dni festiwali parkingi gratis",
            "Trattoria Papei: za Palazzo Pubblico, niewidoczna z Campo — rezerwuj lunch na 12:00",
            "Powrót do bazy przed 14:00 — sobota popołudnie w Sienie = korki i tłumy"
        ],
        "web_research": [
            {"topic": "Parking Santa Caterina Siena", "summary": "473 posti, coperto, 24h. €2/h, €35/giorno. Scale mobili gratuite verso centro. Max altezza 2,0 m.", "source": "https://sigericospa.it/parcheggio-santa-caterina/", "checked": "2026-07"},
            {"topic": "Duomo Siena — orari settembre 2026", "summary": "1.04–31.10: 10–19 lun–sab. Festivi: 9:30–18 (con pavimento scoperto 18.08–15.11). Ultimo ingresso 30 min prima.", "source": "https://operaduomo.siena.it/en/the-cathedral/", "checked": "2026-07"},
            {"topic": "Pavimento mosaico — scopertura 2026", "summary": "Pavimento scoperto 27.06–31.07 e 18.08–15.11.2026. Biglietto OPA SI: €16 (vs €14 standard).", "source": "https://operaduomo.siena.it/en/visiting/", "checked": "2026-07"},
            {"topic": "Antica Trattoria Papei — orari", "summary": "Cucina 12:00–22:30. Sabato: pranzo 12–15, cena 19–22:30. Prenotazioni: 0577 280894 (10–19). Piazza del Mercato 6.", "source": "https://anticatrattoriapapei.com/reservations/", "checked": "2026-07"},
            {"topic": "Siena senza turisti — strategia", "summary": "7:00 wyjazd → 7:30 Campo vuoto. Folla da 10:00. Sabato = giorno più affollato — via prima delle 14:00.", "source": "https://www.terredisiena.it/en/siena-en/where-to-park-in-siena/", "checked": "2026-07"},
        ],
    },
}


def deep_merge(base: dict, extra: dict) -> dict:
    """Merge extra into base; extra values win for scalars, dicts merge recursively."""
    out = dict(base)
    for k, v in extra.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def main() -> None:
    with PLAN.open(encoding="utf-8") as f:
        plan = json.load(f)

    for day in plan["days"]:
        num = day.get("day_num")
        if num is None or num < 2 or num > 8:
            continue
        extra = ENRICHMENT_BY_DAY.get(num, {})
        merged = deep_merge(day, extra)
        # Update day in plan
        idx = plan["days"].index(day)
        plan["days"][idx] = merged
        # Write enrichment backup
        ENRICHMENT_DIR.mkdir(parents=True, exist_ok=True)
        out_path = ENRICHMENT_DIR / f"dzien-{num:02d}.json"
        with out_path.open("w", encoding="utf-8") as ef:
            json.dump(merged, ef, ensure_ascii=False, indent=2)
        print(f"Wrote {out_path}")

    with PLAN.open("w", encoding="utf-8") as f:
        json.dump(plan, f, ensure_ascii=False, indent=2)
    print(f"Updated {PLAN}")


if __name__ == "__main__":
    main()
