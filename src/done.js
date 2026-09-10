/**
 * Wspólny stan odhaczeń (rezerwacje, todo) — localStorage pod kluczem
 * `todo-done-<storage_key>`. Ten sam klucz czyta Praktyczne (checkboxy),
 * oś czasu i strona dnia (badki rezerwacji gasną po odhaczeniu).
 * Statyczna strona nie ma backendu, więc to jedyny trwały zapis — per
 * przeglądarka/urządzenie.
 */

export function doneStorageKey(trip) {
  return `todo-done-${trip?.meta?.storage_key || 'default'}`;
}

/** Zwraca Set id odhaczonych pozycji. Bezpieczne poza przeglądarką (testy, build). */
export function getDoneIds(key) {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch {
    return new Set();
  }
}

export function setDoneId(key, id, done) {
  const set = getDoneIds(key);
  if (done) set.add(id);
  else set.delete(id);
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // brak dostępu do storage (tryb prywatny?) — stan ulotny, bez crasha
  }
}

/** Odfiltrowuje odhaczone pozycje (po `id`) z listy rezerwacji danego dnia. */
export function withoutDone(bookings, doneSet) {
  if (!doneSet?.size) return bookings || [];
  return (bookings || []).filter((b) => !doneSet.has(b.id));
}
