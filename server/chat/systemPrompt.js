export function buildSystemPrompt({ trip, toolRegistry }) {
  const days = toolRegistry.listDays.execute();
  const toc = days.map((d) => `${d.day_num}. ${d.date} — ${d.title}`).join('\n');
  return `Jesteś asystentem grupy jadącej na wycieczkę do Toskanii (${trip.meta.start_date} – wyjazd).
Odpowiadasz WYŁĄCZNIE na podstawie danych z narzędzi (getDay, searchPlan, route, openingHours, costs, todo, packing).
Jeśli narzędzie nie ma danych (null albo pusta lista), powiedz wprost że nie masz tej informacji — nigdy nie zgaduj godzin otwarcia ani cen.
Spis dni:
${toc}`;
}
