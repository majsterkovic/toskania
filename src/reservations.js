const GROUP_ORDER = ['required', 'optional', 'done'];
const GROUP_LABELS = {
  required: 'Slot obowiązkowy',
  optional: 'Warto',
  done: 'Już zrobione',
};

export function reservationCategory(todo) {
  return (todo?.categories || []).find((c) => c.id === 'rezerwacje') || null;
}

export function reservationGroups(todo) {
  const items = reservationCategory(todo)?.items || [];
  const buckets = { required: [], optional: [], done: [] };
  for (const item of items) {
    const key = buckets[item.group] ? item.group : 'optional';
    buckets[key].push(item);
  }
  for (const id of GROUP_ORDER) {
    buckets[id].sort((a, b) => (a.day_num ?? 99) - (b.day_num ?? 99));
  }
  return GROUP_ORDER.filter((id) => buckets[id].length).map((id) => ({
    id,
    name: GROUP_LABELS[id],
    items: buckets[id],
  }));
}

export function todoForChecklist(todo) {
  if (!todo?.categories) return todo;
  return {
    ...todo,
    categories: todo.categories.filter((c) => c.id !== 'rezerwacje'),
  };
}

export { GROUP_LABELS, GROUP_ORDER };
