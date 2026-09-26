import { CAPTURE_ACTIONS, CAPTURE_UNITS } from './capture-queue.mjs';

const api = globalThis.browser || globalThis.chrome;
const byId = (id) => document.getElementById(id);
let state;

function setStatus(message, error = false) {
  const element = byId('status');
  element.textContent = message;
  element.classList.toggle('error', error);
}

function context() {
  return {
    projectId: byId('project-id').value,
    areaId: byId('area-id').value,
    noteId: byId('note-id').value,
    taskId: byId('task-id').value,
    question: byId('question').value,
  };
}

function renderChoices() {
  byId('action').replaceChildren(...CAPTURE_ACTIONS.map((action) => new Option(action.label, action.id)));
  byId('unit').replaceChildren(...CAPTURE_UNITS.map((unit) => new Option(unit.label, unit.id)));
  byId('action').addEventListener('change', () => {
    const action = CAPTURE_ACTIONS.find((item) => item.id === byId('action').value) || CAPTURE_ACTIONS[0];
    byId('action-help').textContent = action.request;
  });
  byId('unit').addEventListener('change', renderTabs);
  byId('action').dispatchEvent(new Event('change'));
}

function renderTabs() {
  const group = byId('tab-picker');
  const isGroup = byId('unit').value === 'tabs';
  group.classList.toggle('hidden', !isGroup);
  const unit = CAPTURE_UNITS.find((item) => item.id === byId('unit').value) || CAPTURE_UNITS[0];
  byId('unit-help').textContent = unit.description;
  if (!isGroup || !state) return;
  const container = byId('tabs');
  container.replaceChildren(...state.tabs.map((tab) => {
    const label = document.createElement('label');
    label.className = 'tab-option';
    const input = document.createElement('input');
    input.type = 'checkbox'; input.name = 'tab'; input.value = String(tab.id); input.checked = tab.active;
    const copy = document.createElement('span');
    const title = document.createElement('strong'); title.textContent = tab.title || tab.url;
    const url = document.createElement('small'); url.textContent = tab.url;
    copy.append(title, url); label.append(input, copy); return label;
  }));
}

function renderState(next) {
  state = next;
  const settings = state.settings;
  byId('endpoint').value = settings.endpoint;
  byId('language').value = settings.language;
  const savedContext = settings.context || {};
  for (const key of ['projectId', 'areaId', 'noteId', 'taskId', 'question']) byId(key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)).value = savedContext[key] || '';
  byId('queue-count').textContent = `${state.queue.length} queued`;
  renderTabs();
  const queue = byId('queue');
  queue.replaceChildren(...state.queue.map((item) => {
    const row = document.createElement('div'); row.className = 'queue-item';
    const title = document.createElement('strong'); title.textContent = item.title || item.url;
    const detail = document.createElement('small'); detail.textContent = item.lastError || `Retry ${item.attempts ? `after attempt ${item.attempts}` : 'pending'}`;
    row.append(title, detail); return row;
  }));
}

async function send(message) {
  const response = await api.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || 'The extension request failed.');
  return response;
}

byId('capture-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Capturing…');
  try {
    const unit = byId('unit').value;
    const tabIds = [...document.querySelectorAll('input[name="tab"]:checked')].map((input) => Number(input.value));
    if (unit === 'tabs' && !tabIds.length) throw new Error('Choose at least one tab.');
    const result = await send({ type: 'capture', actionId: byId('action').value, unit, tabIds, context: context() });
    setStatus(`${result.sent} sent${result.queued ? `, ${result.queued} queued for retry` : ''}${result.duplicates ? `, ${result.duplicates} already queued` : ''}.`);
    renderState(await send({ type: 'state' }));
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Capture failed.', true);
  }
});

byId('settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const apiKey = byId('api-key').value;
    const result = await send({
      type: 'settings',
      endpoint: byId('endpoint').value,
      language: byId('language').value,
      apiKey,
      context: context(),
    });
    byId('api-key').value = '';
    renderState({ ...state, settings: result.settings });
    setStatus(result.settings.hasApiKey ? 'Connection saved.' : 'Connection saved without an API key.');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Could not save connection.', true);
  }
});

byId('retry').addEventListener('click', async () => {
  setStatus('Retrying queued captures…');
  try {
    const result = await send({ type: 'retry' });
    renderState(await send({ type: 'state' }));
    setStatus(`${result.queued} capture${result.queued === 1 ? '' : 's'} remain queued.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Retry failed.', true);
  }
});

renderChoices();
send({ type: 'state' }).then(renderState).catch((error) => setStatus(error instanceof Error ? error.message : 'Could not load extension state.', true));
