const editor = document.getElementById('code');
const lineNumbers = document.getElementById('lineNumbers');
const saveState = document.getElementById('saveState');
const fileType = document.getElementById('fileType');
const fileTree = document.getElementById('fileTree');
const searchInput = document.getElementById('fileSearch');
const saveButton = document.getElementById('save');
const stdout = document.getElementById('stdout');
const files = new Map();
const buffers = new Map();
const savedBuffers = new Map();
const activity = JSON.parse(localStorage.getItem('assessment-activity') || '[]');
let activePath = '';
let activeQuestion = null;
let requestCounter = 0;
const openFiles = [];
const closedFiles = [];
const collapsedFolders = new Set();
let workspaceCollapsed = false;
let toastTimer;
let searchTimer;
const apiBase = String(window.ASSESSMENT_API_BASE || '').replace(/\/$/, '');
function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('X-Assessment-Question', activeQuestion?.id || localStorage.getItem('assessment-question') || 'customer-integration');
  return fetch(apiBase + url, { ...options, headers });
}
function sourceStorageKey(questionId = activeQuestion?.id || 'customer-integration') { return 'assessment-source-' + questionId; }
function editableSourceFiles() {
  if (activePath) buffers.set(activePath, editor.value);
  return Object.fromEntries(Array.from(files).filter(([, metadata]) => metadata.editable).map(([filePath]) => [filePath, buffers.get(filePath)]));
}
function saveSourceFilesLocally() { localStorage.setItem(sourceStorageKey(), JSON.stringify(editableSourceFiles())); }
function savedMongoState() {
  try { return JSON.parse(localStorage.getItem('assessment-mongo-state-' + (activeQuestion?.id || '')) || '{}'); }
  catch { return {}; }
}
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}
function recordActivity(message) {
  const item = { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), message };
  activity.unshift(item);
  if (activity.length > 60) activity.length = 60;
  localStorage.setItem('assessment-activity', JSON.stringify(activity));
  renderActivity();
}
function renderActivity() {
  const panel = document.getElementById('activityContent');
  panel.replaceChildren();
  if (!activity.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'Search, inspect, edit, and run the codebase to build your debugging trail.'; panel.append(empty); return;
  }
  for (const item of activity) {
    const row = document.createElement('div'); row.className = 'activity-row';
    const time = document.createElement('time'); time.textContent = item.time;
    const message = document.createElement('span'); message.textContent = item.message;
    row.append(time, message); panel.append(row);
  }
}
function isDirty(filePath) { return buffers.has(filePath) && buffers.get(filePath) !== savedBuffers.get(filePath); }
function updateEditorState() {
  if (!activePath) return;
  buffers.set(activePath, editor.value);
  const lines = editor.value.split('\n').length;
  lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
  const dirty = isDirty(activePath);
  const activeRow = Array.from(fileTree.querySelectorAll('.tree-file')).find((row) => row.dataset.path === activePath);
  if (activeRow) activeRow.querySelector('.tree-dirty').style.display = dirty ? 'block' : 'none';
  renderEditorTabs();
  if (saveState) {
    saveState.textContent = dirty ? 'Unsaved changes' : 'All changes saved';
    saveState.style.color = dirty ? '#c0802c' : '';
  }
}
function renderFileTree() {
  fileTree.replaceChildren();
  const renderedFolders = new Set();
  for (const [filePath, metadata] of files) {
    const parts = filePath.split('/');
    let folderPath = '';
    let hiddenByCollapse = workspaceCollapsed;
    for (const folder of parts.slice(0, -1)) {
      folderPath = folderPath ? folderPath + '/' + folder : folder;
      if (hiddenByCollapse) continue;
      const currentFolderPath = folderPath;
      if (!renderedFolders.has(currentFolderPath)) {
        renderedFolders.add(currentFolderPath);
        const heading = document.createElement('button');
        heading.className = 'tree-folder';
        heading.type = 'button';
        heading.setAttribute('aria-expanded', String(!collapsedFolders.has(currentFolderPath)));
        heading.style.paddingLeft = (8 + (currentFolderPath.split('/').length - 1) * 12) + 'px';
        heading.textContent = (collapsedFolders.has(currentFolderPath) ? '▸  ' : '▾  ') + folder;
        heading.addEventListener('click', () => {
          if (collapsedFolders.has(currentFolderPath)) collapsedFolders.delete(currentFolderPath);
          else collapsedFolders.add(currentFolderPath);
          renderFileTree();
        });
        fileTree.append(heading);
      }
      if (collapsedFolders.has(currentFolderPath)) hiddenByCollapse = true;
    }
    if (hiddenByCollapse) continue;
    const row = document.createElement('button'); row.className = 'tree-file' + (activePath === filePath ? ' active' : '');
    row.dataset.path = filePath;
    const icon = document.createElement('span'); icon.className = 'tree-icon';
    const ext = filePath.split('.').pop();
    icon.textContent = ext === 'js' ? 'JS' : ext === 'md' ? 'MD' : '·';
    icon.classList.add('icon-' + ext);
    const label = document.createElement('span'); label.textContent = filePath.split('/').pop();
    const dirty = document.createElement('i'); dirty.className = 'tree-dirty'; dirty.style.display = isDirty(filePath) ? 'block' : 'none';
    row.append(icon, label, dirty);
    if (parts.length > 1) row.style.paddingLeft = (20 + (parts.length - 2) * 12) + 'px';
    row.title = filePath + (metadata.editable ? '' : ' · read only');
    row.addEventListener('click', () => openFile(filePath));
    fileTree.append(row);
  }
}
function renderEditorTabs() {
  const tabs = document.getElementById('editorTabs');
  tabs.replaceChildren();
  for (const filePath of openFiles) {
    const tab = document.createElement('div');
    tab.className = 'editor-tab' + (filePath === activePath ? ' active' : '') + (isDirty(filePath) ? ' dirty' : '');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(filePath === activePath));
    const ext = filePath.split('.').pop();
    const icon = document.createElement('span');
    icon.className = 'tree-icon' + (ext === 'md' ? ' icon-md' : '');
    icon.textContent = ext === 'js' ? 'JS' : ext === 'md' ? 'MD' : '·';
    const label = document.createElement('span'); label.textContent = filePath.split('/').pop();
    label.title = filePath;
    const close = document.createElement('button'); close.className = 'tab-close'; close.type = 'button';
    close.setAttribute('aria-label', 'Close ' + filePath); close.title = 'Close'; close.textContent = '×';
    close.addEventListener('click', (event) => { event.stopPropagation(); closeFile(filePath); });
    tab.append(icon, label, close);
    tab.addEventListener('click', () => openFile(filePath));
    tabs.append(tab);
  }
}
function closeFile(filePath) {
  if (activePath) buffers.set(activePath, editor.value);
  const index = openFiles.indexOf(filePath);
  if (index < 0) return;
  openFiles.splice(index, 1);
  closedFiles.push(filePath);
  if (closedFiles.length > 20) closedFiles.shift();
  if (activePath === filePath) {
    const nextPath = openFiles[Math.min(index, openFiles.length - 1)];
    if (nextPath) openFile(nextPath, false);
    else {
      activePath = '';
      editor.value = '';
      editor.readOnly = true;
      editor.classList.add('read-only');
      fileType.textContent = '';
      saveButton.style.display = 'none';
      lineNumbers.replaceChildren();
      saveState.textContent = 'All changes saved';
      saveState.style.color = '';
    }
  }
  renderEditorTabs(); renderFileTree();
  recordActivity('Closed ' + filePath + (isDirty(filePath) ? ' · unsaved changes kept in buffer' : ''));
}
function setView(view) {
  document.querySelectorAll('.view-tab').forEach((tab) => tab.classList.toggle('selected', tab.dataset.view === view));
  document.getElementById('testResults').classList.toggle('hidden', view === 'activity');
  document.getElementById('activityContent').classList.toggle('hidden', view !== 'activity');
}
function showStdout(text) { stdout.textContent = text || '(no output)'; }
function showResults(data, heading, view) {
  const results = document.getElementById('testResults');
  results.replaceChildren();
  const title = document.createElement('div'); title.className = 'run-heading'; title.textContent = heading; results.append(title);
  for (const item of data.results || []) {
    const row = document.createElement('div'); row.className = 'test-result';
    const icon = document.createElement('span'); icon.className = 'test-icon ' + (item.passed ? 'pass' : 'fail'); icon.textContent = item.passed ? '✓' : '✕';
    const name = document.createElement('span'); name.textContent = item.name;
    row.append(icon, name);
    if (item.error) { const error = document.createElement('span'); error.className = 'test-error'; error.textContent = item.error; row.append(error); }
    results.append(row);
  }
  if (data.hiddenTotal) {
    const hidden = document.createElement('div'); hidden.className = 'hidden-note';
    hidden.textContent = 'Hidden checks: ' + data.hiddenPassed + '/' + data.hiddenTotal + ' passed'; results.append(hidden);
  }
  showStdout(data.stdout);
  setView(view || 'output');
}
function renderQuestionCards(questions) {
  const cards = document.getElementById('questionCards');
  cards.replaceChildren();
  for (const question of questions) {
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'question-card';
    const meta = document.createElement('span'); meta.className = 'question-card-meta'; meta.textContent = question.category + ' · ' + question.level;
    const title = document.createElement('strong'); title.textContent = question.title;
    const summary = document.createElement('span'); summary.textContent = question.summary;
    const action = document.createElement('span'); action.className = 'question-card-action'; action.textContent = 'Open codebase  →';
    card.append(meta, title, summary, action);
    card.addEventListener('click', () => chooseQuestion(question.id));
    cards.append(card);
  }
}
async function loadQuestions() {
  const response = await apiFetch('/scenario-api/questions');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load assessment questions');
  renderQuestionCards(data.questions);
}
function renderBrowserHeaders(headers) {
  const container = document.getElementById('browserHeaders');
  container.replaceChildren();
  for (const header of headers) {
    const row = document.createElement('div'); row.className = 'header-row'; row.dataset.headerName = header.name;
    const label = document.createElement('span'); label.textContent = header.name;
    if (header.editable) {
      const input = document.createElement('input'); input.value = header.value; input.setAttribute('aria-label', header.name + ' header');
      row.append(label, input);
    } else {
      const value = document.createElement('span'); value.className = 'muted'; value.textContent = header.value;
      if (header.name.toLowerCase() === 'x-request-id') value.dataset.requestId = 'true';
      row.append(label, value);
    }
    container.append(row);
  }
}
function getBrowserHeaders(nextRequestId = false) {
  const headers = {};
  document.querySelectorAll('#browserHeaders .header-row').forEach((row) => {
    const name = row.dataset.headerName;
    const input = row.querySelector('input');
    const requestId = row.querySelector('[data-request-id]');
    headers[name] = input ? input.value : requestId && nextRequestId ? 'req-browser-' + String(++requestCounter).padStart(3, '0') : row.querySelector('.muted')?.textContent || '';
    if (requestId && nextRequestId) requestId.textContent = headers[name];
  });
  return headers;
}
async function chooseQuestion(questionId) {
  if (activeQuestion && !await saveAllSourceFiles()) return;
  if (activeQuestion) localStorage.setItem(document.getElementById('customerUpdate').dataset.storageKey, document.getElementById('customerUpdate').value);
  try {
    const response = await apiFetch('/scenario-api/select', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not open question');
    activeQuestion = data.question;
    localStorage.setItem('assessment-question', activeQuestion.id);
    document.title = activeQuestion.title + ' · Debugging Assessment';
    files.clear(); buffers.clear(); savedBuffers.clear(); openFiles.length = 0; closedFiles.length = 0; collapsedFolders.clear();
    workspaceCollapsed = false; activePath = ''; editor.value = ''; lineNumbers.replaceChildren();
    document.getElementById('workspaceToggle').setAttribute('aria-expanded', 'true');
    document.querySelector('#workspaceToggle .folder-icon').textContent = '▾';
    document.getElementById('workspaceName').textContent = activeQuestion.workspaceName;
    document.getElementById('reportTitle').textContent = activeQuestion.reportTitle;
    const report = document.getElementById('scenarioCopy'); report.replaceChildren();
    for (const paragraph of activeQuestion.report) { const p = document.createElement('p'); p.textContent = paragraph; report.append(p); }
    document.getElementById('questionCategory').textContent = '● ' + activeQuestion.category;
    document.getElementById('questionLevel').textContent = '◷ ' + activeQuestion.level;
    document.getElementById('questionTip').textContent = activeQuestion.tip;
    document.getElementById('browserHint').textContent = activeQuestion.browserHint;
    document.getElementById('path').value = activeQuestion.browser.path;
    document.getElementById('requestBody').value = JSON.stringify(activeQuestion.browser.body, null, 2);
    renderBrowserHeaders(activeQuestion.browser.headers);
    const updateKey = 'customer-update-' + activeQuestion.id;
    document.getElementById('customerUpdate').value = localStorage.getItem(updateKey) || '';
    document.getElementById('customerUpdate').dataset.storageKey = updateKey;
    document.getElementById('testSummary').textContent = 'Run code or tests to see output';
    document.getElementById('testSummary').style.color = '';
    document.getElementById('testResults').innerHTML = '<div class="empty-state">Run Code to inspect this scenario. Run tests to check the behavior.</div>';
    setView('output');
    document.getElementById('responseMeta').textContent = 'Send a request to inspect status, body, and logs';
    document.getElementById('response').innerHTML = '<div class="response-placeholder">Response and integration logs will appear here.</div>';
    showStdout('');
    document.getElementById('searchResults').classList.add('hidden'); fileTree.classList.remove('hidden'); searchInput.value = '';
    await loadWorkspace();
    document.getElementById('questionPicker').classList.add('hidden');
    document.getElementById('closeQuestionPicker').classList.remove('hidden');
    recordActivity('Selected assessment · ' + activeQuestion.title);
  } catch (error) { toast('Could not load assessment: ' + error.message); }
}
async function loadWorkspace() {
  const response = await apiFetch('/scenario-api/files');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load workspace');
  let localOverrides = {};
  try { localOverrides = JSON.parse(localStorage.getItem(sourceStorageKey()) || '{}'); } catch {}
  for (const file of data.files) {
    files.set(file.path, { editable: file.editable });
    const content = file.editable && typeof localOverrides[file.path] === 'string' ? localOverrides[file.path] : file.content;
    buffers.set(file.path, content);
    savedBuffers.set(file.path, content);
  }
  renderFileTree();
  await openFile('README.md', false);
  recordActivity('Candidate workspace opened');
}
async function openFile(filePath, log = true, line = 0) {
  if (!files.has(filePath)) return;
  if (activePath) buffers.set(activePath, editor.value);
  activePath = filePath;
  if (!openFiles.includes(filePath)) openFiles.push(filePath);
  const metadata = files.get(filePath);
  editor.value = buffers.get(filePath);
  const ext = filePath.split('.').pop();
  fileType.textContent = ext === 'js' ? 'JavaScript · Node.js' : 'Markdown';
  editor.readOnly = !metadata.editable;
  editor.classList.toggle('read-only', !metadata.editable);
  saveButton.style.display = metadata.editable ? 'inline-block' : 'none';
  renderFileTree();
  renderEditorTabs();
  updateEditorState();
  if (line > 0) {
    const offset = editor.value.split('\n').slice(0, line - 1).reduce((sum, item) => sum + item.length + 1, 0);
    editor.focus(); editor.setSelectionRange(offset, offset);
    editor.scrollTop = Math.max(0, (line - 2) * 20);
  }
  if (log) recordActivity('Opened ' + filePath + (line ? ' at line ' + line : ''));
}
async function saveCurrentFile() {
  if (!activePath || !files.get(activePath)?.editable) { toast('This reference file is read only.'); return true; }
  buffers.set(activePath, editor.value);
  if (!isDirty(activePath)) return true;
  saveSourceFilesLocally();
  savedBuffers.set(activePath, editor.value);
  updateEditorState(); renderFileTree(); recordActivity('Saved ' + activePath);
  return true;
}
async function saveAllSourceFiles() {
  if (activePath) buffers.set(activePath, editor.value);
  for (const filePath of files.keys()) {
    if (!files.get(filePath).editable || !isDirty(filePath)) continue;
    savedBuffers.set(filePath, buffers.get(filePath));
    recordActivity('Saved ' + filePath);
  }
  saveSourceFilesLocally();
  updateEditorState(); renderFileTree();
  return true;
}
editor.addEventListener('input', updateEditorState);
editor.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') { event.preventDefault(); if (editor.readOnly) return; editor.setRangeText('  ', editor.selectionStart, editor.selectionEnd, 'end'); updateEditorState(); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveCurrentFile().then((ok) => ok && toast('File saved')); }
});
saveButton.addEventListener('click', async () => { if (await saveCurrentFile()) toast('File saved'); });
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const query = searchInput.value.trim();
    if (!query) { document.getElementById('searchResults').classList.add('hidden'); fileTree.classList.remove('hidden'); return; }
    const response = await apiFetch('/scenario-api/search?q=' + encodeURIComponent(query));
    const data = await response.json();
    const panel = document.getElementById('searchResults'); panel.replaceChildren(); panel.classList.remove('hidden'); fileTree.classList.add('hidden');
    if (!data.matches.length) { panel.textContent = 'No matches found'; }
    for (const match of data.matches) {
      const button = document.createElement('button'); button.className = 'search-result';
      const location = document.createElement('span'); location.textContent = match.path + ':' + match.line;
      const excerpt = document.createElement('small'); excerpt.textContent = match.text;
      button.append(location, excerpt); button.addEventListener('click', () => openFile(match.path, true, match.line)); panel.append(button);
    }
    recordActivity('Searched codebase for “' + query + '” · ' + data.matches.length + ' matches');
  }, 400);
});
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') { event.preventDefault(); searchInput.focus(); searchInput.select(); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w' && activePath) { event.preventDefault(); closeFile(activePath); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'tab' && openFiles.length > 1) {
    event.preventDefault();
    const step = event.shiftKey ? -1 : 1;
    const current = openFiles.indexOf(activePath);
    openFile(openFiles[(current + step + openFiles.length) % openFiles.length]);
  }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 't' && closedFiles.length) {
    event.preventDefault(); openFile(closedFiles.pop());
  }
});
async function runCode() {
  const button = document.getElementById('runCode'); button.disabled = true; button.textContent = 'Running…';
  try {
    if (!await saveAllSourceFiles()) return;
    recordActivity('Ran sample integration request');
    const input = JSON.parse(document.getElementById('requestBody').value);
    const response = await apiFetch('/scenario-api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, headers: getBrowserHeaders(true), questionId: activeQuestion.id, sourceFiles: editableSourceFiles(), mongoState: savedMongoState() }) });
    const data = await response.json();
    if (data.mongoState) localStorage.setItem('assessment-mongo-state-' + activeQuestion.id, JSON.stringify(data.mongoState));
    const item = { name: data.runtimeError ? 'Runtime error: ' + data.runtimeError : 'Execution completed · application returned HTTP ' + data.status, passed: !data.runtimeError && data.status < 400 };
    showResults({ results: [item], stdout: data.stdout }, 'Run Code output', 'output');
    document.getElementById('testSummary').textContent = data.runtimeError ? 'Runtime error' : 'Program finished · HTTP ' + data.status;
    if (data.request) showBrowserOutput({ request: data.request, response: data.response, logs: data.logs }, data.status, 'Run Code');
  } catch (error) { toast('Run failed: ' + error.message); }
  finally { button.disabled = false; button.innerHTML = '▶&nbsp; Run Code'; }
}
async function runTests(submit = false) {
  const button = document.getElementById('runTests');
  const submitButton = document.getElementById('submitAssessment');
  button.disabled = true; submitButton.disabled = true; button.textContent = 'Running…';
  try {
    if (!await saveAllSourceFiles()) return;
    const customerUpdate = document.getElementById('customerUpdate').value.trim();
    if (submit && !customerUpdate) { toast('Add a short customer update before submitting.'); return; }
    recordActivity(submit ? 'Submitted assessment and customer update' : 'Ran visible and hidden integration checks');
    const response = await apiFetch('/scenario-api/tests/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(submit ? { customerUpdate } : {}), questionId: activeQuestion.id, sourceFiles: editableSourceFiles() }) });
    const data = await response.json();
    showResults(data, submit ? 'Assessment submission' : 'Automated integration checks', 'tests');
    document.getElementById('testSummary').textContent = data.passed + '/' + data.total + ' checks passed';
    document.getElementById('testSummary').style.color = data.passed === data.total ? '#168760' : '#c0524a';
    if (submit) toast('Assessment submitted · ' + data.passed + '/' + data.total + ' checks · customer update included');
  } catch (error) { toast('Test run failed: ' + error.message); }
  finally { button.disabled = false; submitButton.disabled = false; button.textContent = 'Run tests'; }
}
document.getElementById('runCode').addEventListener('click', runCode);
document.getElementById('runTests').addEventListener('click', () => runTests(false));
document.getElementById('submitAssessment').addEventListener('click', () => runTests(true));
function showBrowserOutput(data, status, statusText) {
  const pre = document.createElement('pre'); pre.className = 'response-code'; pre.textContent = JSON.stringify(data, null, 2);
  document.getElementById('response').replaceChildren(pre);
  document.getElementById('responseMeta').textContent = status + ' ' + (statusText || '') + ' · status and integration logs';
}
async function sendRequest() {
  const route = document.getElementById('path').value.trim();
  if (!route.startsWith('/')) { toast('Path must start with /'); return; }
  const button = document.getElementById('send'); button.disabled = true; button.textContent = '…';
  let body;
  try { body = JSON.stringify(JSON.parse(document.getElementById('requestBody').value)); }
  catch { toast('Request body must be valid JSON'); button.disabled = false; button.textContent = 'Send'; return; }
  const started = performance.now();
  try {
    const response = await apiFetch('/scenario-api' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...getBrowserHeaders(true) }, body: JSON.stringify({ payload: JSON.parse(body), __assessment: { questionId: activeQuestion.id, sourceFiles: editableSourceFiles(), mongoState: savedMongoState() } }) });
    const data = await response.json();
    if (data.mongoState) localStorage.setItem('assessment-mongo-state-' + activeQuestion.id, JSON.stringify(data.mongoState));
    document.getElementById('responseMeta').textContent = response.status + ' ' + response.statusText + ' · ' + Math.round(performance.now() - started) + ' ms';
    const pre = document.createElement('pre'); pre.className = 'response-code'; pre.textContent = JSON.stringify(data, null, 2);
    document.getElementById('response').replaceChildren(pre); showStdout(data.stdout);
    recordActivity('Sent POST ' + route + ' · HTTP ' + response.status);
  } catch (error) {
    document.getElementById('responseMeta').textContent = 'Request failed';
    const pre = document.createElement('pre'); pre.className = 'response-code'; pre.textContent = error.message;
    document.getElementById('response').replaceChildren(pre);
  } finally { button.disabled = false; button.textContent = 'Send'; }
}
document.getElementById('send').addEventListener('click', sendRequest);
function clearResults() {
  document.getElementById('responseMeta').textContent = 'Send a request to inspect status, body, and logs';
  document.getElementById('response').innerHTML = '<div class="response-placeholder">Partner response and integration logs will appear here.</div>';
  document.getElementById('testSummary').textContent = 'Run code or tests to see output';
  document.getElementById('testResults').innerHTML = '<div class="empty-state">Run Code to see console.log output. Run tests to check the integration behavior.</div>';
  showStdout(''); recordActivity('Cleared results');
}
document.getElementById('browserReset').addEventListener('click', clearResults);
document.getElementById('reset').addEventListener('click', clearResults);
document.getElementById('saveUpdate').addEventListener('click', () => {
  localStorage.setItem(document.getElementById('customerUpdate').dataset.storageKey || 'customer-integration-update', document.getElementById('customerUpdate').value);
  toast('Customer update saved'); recordActivity('Saved customer update');
});
const themeToggle = document.getElementById('themeToggle');
function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeToggle.textContent = theme === 'dark' ? 'Light' : 'Dark';
  themeToggle.title = 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme';
  localStorage.setItem('assessment-theme', theme);
}
applyTheme(localStorage.getItem('assessment-theme') || 'dark');
themeToggle.addEventListener('click', () => applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark'));
document.getElementById('workspaceToggle').addEventListener('click', (event) => {
  workspaceCollapsed = !workspaceCollapsed;
  event.currentTarget.setAttribute('aria-expanded', String(!workspaceCollapsed));
  event.currentTarget.querySelector('.folder-icon').textContent = workspaceCollapsed ? '▸' : '▾';
  renderFileTree();
});
document.getElementById('customerUpdate').value = localStorage.getItem('customer-integration-update') || '';
document.getElementById('changeQuestion').addEventListener('click', () => document.getElementById('questionPicker').classList.remove('hidden'));
document.getElementById('closeQuestionPicker').addEventListener('click', () => document.getElementById('questionPicker').classList.add('hidden'));
document.querySelectorAll('.view-tab').forEach((tab) => tab.addEventListener('click', () => setView(tab.dataset.view)));
async function startEnvironment() {
  const bootScreen = document.getElementById('bootScreen');
  const bootLog = document.getElementById('bootLog');
  const shown = new Set();
  try {
    while (true) {
      const response = await apiFetch('/assessment/status');
      const state = await response.json();
      document.getElementById('bootMessage').textContent = state.message;
      const progressBar = document.getElementById('bootProgress');
      if (progressBar) progressBar.style.width = state.progress + '%';
      for (const line of state.logs) if (!shown.has(line)) { shown.add(line); const entry = document.createElement('div'); entry.textContent = '✓ ' + line; bootLog.append(entry); }
      if (state.error) throw new Error(state.error);
      if (state.ready) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    await loadQuestions();
    document.getElementById('activityContent').classList.add('hidden');
    document.getElementById('questionPicker').classList.remove('hidden');
    document.getElementById('bootMessage').textContent = 'Assessment environment ready';
    setTimeout(() => bootScreen.classList.add('finished'), 350);
  } catch (error) {
    document.getElementById('bootMessage').textContent = 'Environment startup failed: ' + error.message;
  }
}
renderActivity();
startEnvironment();
