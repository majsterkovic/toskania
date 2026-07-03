# Toskania 2026

Plan podróży samochodowej Poznań → Toskania → Poznań (12–25 września 2026).

**Strona:** https://majsterkovic.github.io/toskania/

## Lokalnie

```bash
npm install
npm run dev      # http://localhost:5173/toskania/
npm run build
npm run preview
```

## Edycja

Zmień [`plan.json`](plan.json) i wypchnij na `main` — GitHub Actions automatycznie zbuduje i opublikuje stronę.

## Deploy

Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) uruchamia się przy każdym pushu na `main`. W ustawieniach repo: **Pages → Source: GitHub Actions**.
