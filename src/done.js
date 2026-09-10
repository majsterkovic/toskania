/**
 * Wspólny stan odhaczeń (rezerwacje, todo) — localStorage pod kluczem
 * `todo-done-<storage_key>`. Ten sam klucz czyta Praktyczne (checkboxy),
 * oś czasu i strona dnia (badki rezerwacji gasną po odhaczeniu).
 * Statyczna strona nie ma backendu, więc to jedyny trwały zapis — per
 * przeglądarka/urządzenie.
 *
 * Format zapisu: { v: 2, done: [...id], undone: [...id] }.
 * - `done`: jawnie odhaczone przez użytkownika.
 * - `undone`: pozycje domyślnie zrobione (grupa `done` w trip.json),
 *   które użytkownik celowo ODoczył — bez tego nie dałoby się odróżnić
 *   "odhaczone" od "nigdy nie tknięte".
 * Starszy format (sama tablica done) jest czytany i migrowany przy zapisie.
 */

export function doneStorageKey(trip) {
  return `todo-done-${trip?.meta?.storage_key || 'default'}`;
}

function readRaw(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

/** Zwraca { done: Set, undone: Set } ze storage (puste gdy brak). */
export function getDoneState(key) {
  const raw = readRaw(key);
  if (Array.isArray(raw)) return { done: new Set(raw), undone: new Set() };
  if (raw && typeof raw === 'object') {
    return { done: new Set(raw.done || []), undone: new Set(raw.undone || []) };
  }
  return { done: new Set(), undone: new Set() };
}

/** Zwraca Set id odhaczonych pozycji. Bezpieczne poza przeglądarką (testy, build). */
export function getDoneIds(key) {
  return getDoneState(key).done;
}

/** Id pozycji domyślnie zrobionych (grupa `done` w danych — np. potwierdzone noclegi). */
export function defaultDoneIds(todo) {
  const ids = new Set();
  for (const cat of todo?.categories || []) {
    for (const item of cat.items || []) {
      if (item.group === 'done' && item.id) ids.add(item.id);
    }
  }
  return ids;
}

/**
 * Efektywny stan: jawnie odhaczone ∪ domyślnie zrobione − celowo odhaczone.
 * Tego używa render (Praktyczne, oś czasu, strona dnia) i checkboxy.
 */
export function getEffectiveDoneIds(todo, key) {
  const { done, undone } = getDoneState(key);
  const effective = new Set([...done, ...defaultDoneIds(todo)]);
  for (const id of undone) effective.delete(id);
  return effective;
}

export function setDoneId(key, id, done, isDefault = false) {
  const state = getDoneState(key);
  if (done) {
    state.done.add(id);
    state.undone.delete(id);
  } else {
    state.done.delete(id);
    if (isDefault) state.undone.add(id);
    else state.undone.delete(id);
  }
  try {
    localStorage.setItem(key, JSON.stringify({ v: 2, done: [...state.done], undone: [...state.undone] }));
  } catch {
    // brak dostępu do storage (tryb prywatny?) — stan ulotny, bez crasha
  }
}

/** Odfiltrowuje odhaczone pozycje (po `id`) z listy rezerwacji danego dnia. */
export function withoutDone(bookings, doneSet) {
  if (!doneSet?.size) return bookings || [];
  return (bookings || []).filter((b) => !doneSet.has(b.id));
}
