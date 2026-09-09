import { esc } from './html.js';

export function mountChatWidget() {
  if (document.getElementById('chat-widget')) return;
  const el = document.createElement('div');
  el.id = 'chat-widget';
  el.innerHTML = `
    <button id="chat-toggle" aria-label="Otwórz czat" aria-expanded="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    </button>
    <div id="chat-panel" hidden>
      <div id="chat-header">
        <strong>Asystent wycieczki</strong>
        <span>pyta o plan Toskanii</span>
      </div>
      <div id="chat-gate">
        <label for="chat-password">Hasło grupy</label>
        <input id="chat-password" type="password" autocomplete="off" />
        <button id="chat-gate-submit" type="button">Dalej</button>
        <p id="chat-gate-error" hidden>Złe hasło, spróbuj ponownie.</p>
      </div>
      <div id="chat-who" hidden>
        <label for="chat-name-select">To Ty?</label>
        <select id="chat-name-select"></select>
        <button id="chat-who-existing" type="button">To ja</button>
        <label for="chat-name-new">Albo wpisz swoje imię</label>
        <input id="chat-name-new" type="text" />
        <button id="chat-who-new" type="button">Wejdź</button>
      </div>
      <div id="chat-messages" hidden role="log" aria-live="polite"></div>
      <form id="chat-form" hidden>
        <input id="chat-input" type="text" placeholder="Zapytaj o plan..." autocomplete="off" />
        <button type="submit">Wyślij</button>
      </form>
    </div>
  `;
  document.body.appendChild(el);
  wireToggle(el);
  wireGate(el);
  wireWho(el);
  wireForm(el);
}

function wireToggle(root) {
  const toggle = root.querySelector('#chat-toggle');
  const panel = root.querySelector('#chat-panel');
  toggle.addEventListener('click', () => {
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', String(willOpen));
  });
}

function wireGate(root) {
  root.querySelector('#chat-gate-submit').addEventListener('click', async () => {
    const password = root.querySelector('#chat-password').value;
    const res = await fetch('/api/auth/gate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const errorEl = root.querySelector('#chat-gate-error');
    if (!res.ok) {
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    await showWho(root);
  });
}

async function showWho(root) {
  root.querySelector('#chat-gate').hidden = true;
  const who = root.querySelector('#chat-who');
  who.hidden = false;
  const res = await fetch('/api/auth/who');
  const { users } = await res.json();
  const select = root.querySelector('#chat-name-select');
  select.innerHTML = users.map((u) => `<option value="${esc(String(u.id))}">${esc(u.display_name)}</option>`).join('');
}

function wireWho(root) {
  root.querySelector('#chat-who-existing').addEventListener('click', async () => {
    const select = root.querySelector('#chat-name-select');
    if (!select.value) return;
    await submitWho(root, { user_id: Number(select.value) });
  });
  root.querySelector('#chat-who-new').addEventListener('click', async () => {
    const newName = root.querySelector('#chat-name-new').value.trim();
    if (!newName) return;
    await submitWho(root, { new_name: newName });
  });
}

async function submitWho(root, payload) {
  const res = await fetch('/api/auth/who', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return;
  root.querySelector('#chat-who').hidden = true;
  root.querySelector('#chat-messages').hidden = false;
  root.querySelector('#chat-form').hidden = false;
}

function appendMessage(root, role, text) {
  const messages = root.querySelector('#chat-messages');
  const p = document.createElement('p');
  p.className = `chat-msg chat-msg--${role}`;
  p.innerHTML = `<strong>${role === 'user' ? 'Ty' : 'Asystent'}:</strong> ${esc(text)}`;
  messages.appendChild(p);
  messages.scrollTop = messages.scrollHeight;
  return p;
}

async function readSse(res, onEvent) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const rawEvent = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = 'message';
      let data = '';
      for (const line of rawEvent.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (data) onEvent(event, JSON.parse(data));
    }
  }
}

function wireForm(root) {
  const form = root.querySelector('#chat-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = root.querySelector('#chat-input');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    appendMessage(root, 'user', message);
    const pending = appendMessage(root, 'assistant', '…');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify({ message }),
      });
      if (res.status === 429) {
        pending.innerHTML = `<strong>Asystent:</strong> ${esc('Wykorzystano dzienny limit — spróbuj jutro.')}`;
        return;
      }
      if (!res.ok) {
        pending.innerHTML = `<strong>Asystent:</strong> ${esc('Asystent niedostępny, plan działa normalnie.')}`;
        return;
      }
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('text/event-stream') || !res.body?.getReader) {
        const { content } = await res.json();
        pending.innerHTML = `<strong>Asystent:</strong> ${esc(content)}`;
        return;
      }
      let statusLine = '';
      await readSse(res, (event, data) => {
        if (event === 'status') {
          statusLine = `szukam w planie (${esc(data.tool)}…)`;
          pending.innerHTML = `<strong>Asystent:</strong> ${statusLine}`;
        } else if (event === 'content') {
          pending.innerHTML = `<strong>Asystent:</strong> ${esc(data.content)}`;
        } else if (event === 'error') {
          pending.innerHTML = `<strong>Asystent:</strong> ${esc('Asystent niedostępny, plan działa normalnie.')}`;
        }
      });
    } catch {
      pending.innerHTML = `<strong>Asystent:</strong> ${esc('Asystent niedostępny, plan działa normalnie.')}`;
    }
  });
}
