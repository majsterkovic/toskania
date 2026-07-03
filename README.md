# Toskania 2026

Plan podróży samochodowej Poznań → Toskania → Poznań (12–27 września 2026).

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

Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) uruchamia się przy każdym pushu na `main`.

**Jednorazowa konfiguracja** (jeśli deploy się nie udał):

1. Otwórz [Settings → Pages](https://github.com/majsterkovic/toskania/settings/pages)
2. **Build and deployment → Source:** wybierz **GitHub Actions**
3. W [Actions](https://github.com/majsterkovic/toskania/actions) uruchom ponownie ostatni workflow (*Re-run all jobs*)

Strona: **https://majsterkovic.github.io/toskania/**
