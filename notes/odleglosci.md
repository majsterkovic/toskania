---
tags: [toskania, planowanie, referencja]
---

# Odległości i czasy dojazdu — tabela referencyjna

Notatka robocza (nie część strony) do szybkiej oceny "czy da się to jeszcze dokleić". Aktualny plan: [[Baza 1 - Barga]] (Garfagnana, dni 3–6) → [[Baza 2 - Chianti]] (Castelnuovo Berardenga, dni 7–15). Wariant 3-bazowy (z Val d'Orcia i Pitigliano) porzucony.

## Z Bazy 1 (Barga / Mologno, Garfagnana)

| Cel | Auto | Pociąg | Werdykt |
|---|---|---|---|
| [[Lucca]] | ~35–40 min | z Fornaci di Barga: 44 min do Lucki (przesiadka) | brama do reszty regionu |
| [[Piza]] | ~1h04 (56 km, SS12 bezpośrednio) | Fornaci di Barga → Lucca 44 min + Lucca → Pisa Centrale **~25–30 min** (Regionale, ~30 kursów/dobę, ~€3–4/os) | możliwe jako osobny dzień z Bargi, kosztem dnia 4 |
| [[Florencja]] | nie dotyczy (za daleko, zły kierunek pociągów) | Lucca → Firenze SMN: ~1h33, bardzo częste (co 20–30 min), pierwszy 5:05, ostatni 22:31 | technicznie możliwe z Bargi, ale w obecnym planie robimy to z Chianti (bliżej) |

## Z Bazy 2 (Chianti / Castelnuovo Berardenga, coords 43.365, 11.513)

Czasy **zweryfikowane OSRM-em** (2026-07) — okazało się, że JSON planu miał je mocno zaniżone dla dni południowych:

| Cel | Auto (OSRM) | JSON miał | Pociąg | Werdykt |
|---|---|---|---|---|
| [[Siena]] | **39 min** (24 km) | 25 min ❌ | — | pełny dzień D8 (19.09); drive_min poprawiony 25→39 |
| Monte Oliveto (D10) | **61 min** (41 km) | 28 min ❌ | — | poprawione 28→61; D10 daily_km 52→84 |
| Bagno Vignoni (D11) | **85 min** (58 km) | 45 min ❌ | — | patrz refaktor D11 niżej |
| Montalcino→baza (D11 powrót) | **82 min** (55 km) | ~40 min ❌ | — | najdłuższy powrót w planie |
| Brolio (D9) | 19 min (7 km) | 20 min ✓ | — | OK — Chianti jest blisko bazy |
| [[Florencja]] | nie dotyczy | — | Siena → Firenze SMN: ~1h20–1h40, co 60–90 min, ~24 kursy/dzień, bilet ~€10/os | **wdrożone jako D12 (23.09)** |
| [[San Gimignano]] | ~55 min (63 km, SS674) | — | brak sensownego bezpośredniego | **odrzucone** — patrz [[decyzje-otwarte]] |

### Wniosek strukturalny (ważne!)
Baza w Chianti (północ) jest realnie **daleko od południa** (Crete Senesi, Val d'Orcia). Dni D10 (Crete) i D11 (Val d'Orcia) to długie dni z 2,5–3,5 h jazdy. To wrodzona słabość wariantu 2-bazowego — sam plan oznacza te cele jako „ok: false" w `variants.base2_options`. **D11 przebudowany** (2026-07): kolejność Pienza→Bagno Vignoni→Montalcino (pętla 210 min zamiast 230), Palazzo Piccolomini pominięty bo we wtorki zamknięty. Nie dokładać nic więcej na południe z tej bazy.

## Val d'Orcia (nieużywana już baza z wariantu 3-bazowego, tylko dla porównania)

| Cel | Auto | Pociąg |
|---|---|---|
| Chiusi-Chianciano Terme | ~50–60 min | Chiusi → Firenze SMN: ~1h40–1h50, rzadziej (co ~2h, ~13 bezpośrednich/dzień) |

## Wnioski robocze

- **Florencja** — najlepszy dostęp z Chianti (przez Sienę), stąd wdrożona tam, nie z Bargi.
- **Piza** — ✅ **WYBRANA** (2026-07). W parze z [[Lucca|Lucką]], dojazd pociągiem z doliny Bargi, kosztem dnia 4 (Castiglione + Orecchiella). Powody: dojazd bez auta, dwa miejsca za cenę jednego (Lucca dotąd tylko mijana), blok Bargi ma luźniejszy dzień do poświęcenia niż napięty blok Chianti. Do wdrożenia — patrz [[decyzje-otwarte]].
- **San Gimignano** — ❌ **ODRZUCONE**. Za daleko (55 min z Chianti, bez kolei), wymagałby własnego dnia kosztem cięcia w i tak napiętym bloku Chianti. Przegrał z Pizą.
