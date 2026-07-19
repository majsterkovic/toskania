---
tags: [toskania, baza, research, decyzja-otwarta]
---

# Baza 2 — kandydaci relokacji (research 2026-07-19)

Cel: znaleźć potencjalnie lepsze miejsce na bazę 2 niż obecne (okolice Castelnuovo Berardenga / Vagliagli), żeby mieć bliżej do wszystkich / do głównych atrakcji. Zob. też analizę centroidu w [[odleglosci]].

## Metoda
Macierz OSRM (`/table`, czasy 1-way) z 9 realnych kandydatów na bazę do **wszystkich** głównych atrakcji programu bazy 2. Waga Sieny ×2 (D11 + pociąg do [[Florencja|Florencji]] odjeżdża z Sieny). „Suma waż." = przybliżony ciężar jazdy całego bloku; „śr/dzień" = na jedno wyjście.

## Ranking (czasy 1-way, minuty)

| Kandydat | śr/dzień | max dzień | Uwaga |
|---|---|---|---|
| **Taverne/Isola d'Arbia (Siena SE)** | **40** | 65 | najbliżej wszystkiego, 17 min do Sieny |
| Monteroni d'Arbia | 42 | 66 | zbalansowany kompromis |
| **Buonconvento** | 44 | 82 | król południa (Val d'Orcia/Crete) |
| Castelnuovo B. (obecny pin) | 45 | 73 | obecna baza — środek stawki |
| Pianella / Ponte a Bozzone | 45 | 78 | pd. skraj Chianti Classico |
| Asciano (Crete) | 46 | 82 | blisko Crete, daleko od reszty |
| Murlo / Vescovado | 50 | 78 | — |
| San Quirico d'Orcia | 55 | 104 | głęboko na pd., Chianti/San Gim bardzo daleko |
| **Vagliagli (obecny agriturismo, północ)** | **73** | 112 | najgorszy — winowajca obecnego problemu |

### Macierz szczegółowa (1-way, min) — kluczowe wiersze

| Baza \ cel | Brolio | Radda | Siena | S.Gim | Monterig. | M.Oliveto | Asciano | Pienza | Montalc. | B.Vignoni |
|---|---|---|---|---|---|---|---|---|---|---|
| Taverne d'Arbia | 24 | 41 | **17** | 54 | 29 | 48 | 35 | 65 | 53 | 61 |
| Buonconvento | 56 | 73 | 42 | 82 | 58 | **18** | 26 | **36** | **23** | **32** |
| Pianella/P. a Bozzone | **11** | 23 | 24 | 58 | 33 | 65 | 39 | 69 | 70 | 78 |
| Monteroni d'Arbia | 39 | 57 | 26 | 66 | 41 | 35 | 24 | 54 | 40 | 49 |
| Castelnuovo (obecny) | 10 | 34 | 27 | 64 | 39 | 64 | 28 | 58 | 69 | 73 |
| Vagliagli (obecny N) | 39 | 27 | 57 | 78 | 60 | 98 | 72 | 102 | 103 | 112 |

**Kluczowa obserwacja:** obecna baza NIE jest tragiczna, jeśli agriturismo leży przy Castelnuovo B. (45 min/dzień). Prawdziwy problem to nocleg na **północy** (Vagliagli, 73 min/dzień). Największa bolączka każdej „chiantowej" bazy = dzień Val d'Orcia (D10).

## 3 PROPOZYCJE (wg priorytetu)

### A. „Najbliżej wszystkiego" — Siena SE (Taverne / Isola d'Arbia, Vico Alto)
- **Liczby:** 40 min/dzień (najlepszy), max 65. Siena **17 min** (bezcenne pod D11 + pociąg do Florencji), Brolio 24, Monteriggioni 29, San Gimignano 54, południe 48–65.
- **Charakter:** sieneńska wieś tuż pod miastem, oliwniki + winnice, świetnie skomunikowana. Mniej „zanurzenia w winnicach", bardziej efektywność + dostęp do miasta. Dużo agriturismo wokół Sieny.
- **Dla kogo:** minimalizacja jazdy i maksymalny dostęp do Sieny/Florencji.

### B. „Brama Val d'Orcia" — Buonconvento
- **Liczby:** 44 min/dzień, ale **słynne południe się zapada**: Monte Oliveto 18, Montalcino 23, Bagno Vignoni 32, Pienza 36, Asciano 26. Dzień Val d'Orcia (D10, dziś najdłuższy ~74–100 min 1-way) spada do ~30 min — transformacja. Koszt: Chianti daleko (Brolio 56, Radda 73), San Gimignano 82.
- **Charakter:** średniowieczne miasteczko w murach, na liście „najpiękniejszych borgo Włoch" (Touring Club), na Via Francigena („bonus conventus" = szczęśliwa wspólnota). Nieskażony krajobraz Crete/Val d'Orcia, gęsto agriturismo (np. Podere Cunina), Brunello pod bokiem, przy drodze i kolei Siena–Grosseto.
- **Dla kogo:** jeśli „główne atrakcje" = pocztówkowe południe (Val d'Orcia, Pienza, Montalcino, Crete). Wtedy warto przełożyć sekwencję: to Chianti/San Gimignano stają się „dalekim dniem", a nie Val d'Orcia.
- **Wariant pośredni:** Monteroni d'Arbia (42 min/dzień, bardziej zbalansowany, bliżej Sieny i Chianti niż Buonconvento) — hedge między A i B.

### C. „Zostajemy w winnicach Chianti" — południowy skraj Chianti Classico (Castelnuovo B. / Ponte a Bozzone / Pianella)
- **Liczby:** 45 min/dzień, max 78. Utrzymuje tożsamość Chianti (Brolio 11 — najlepszy dzień Chianti z opcji zbalansowanych, Radda 23, Siena 24). Południe wciąż 65–78 (wrodzona „kara Chianti"), ale dużo lepiej niż Vagliagli (100–112).
- **Charakter:** prawdziwe winnice Chianti Classico, „toskański sen", najdroższy, ale najbardziej klimatyczny (potwierdza to research: Chianti = najczęściej wybierany, ale najdroższy region).
- **Dla kogo:** trzymamy się pierwotnej decyzji o bazie w Chianti — tylko przesuwamy nocleg z północy (Vagliagli) na **południowy skraj** (okolice Castelnuovo B.). Minimalna zmiana, zero utraty klimatu. To praktycznie „obecny plan zrobiony dobrze".

## Rekomendacja
- Jeśli liczy się **spokój jazdy i miasto** → **A (Siena SE)**.
- Jeśli sercem wyjazdu jest **pocztówkowe południe** → **B (Buonconvento)** + rewizja sekwencji dni.
- Jeśli priorytetem jest **klimat winnic Chianti** (pierwotna decyzja) → **C**, byle nie na północy regionu.
- Baza 1 (Barga) — bez zmian, dobrze położona (zob. [[Baza 1 - Barga]]).

## Źródła
- OSRM `/table` (router.project-osrm.org), 2026-07-19.
- Buonconvento / Val d'Orcia base: discovertuscany.com, agriturismo.it, toscana.info.
- Porównanie regionów (Chianti vs Val d'Orcia): toscana.info, classicvillavacations.com, Rick Steves forum.

## Status
DECYZJA OTWARTA — czeka na wybór użytkownika. Zob. [[decyzje-otwarte]]. Zmiana bazy nie zmienia listy atrakcji, tylko czasy dojazdu (i ewentualnie kolejność dni, jeśli wariant B).
