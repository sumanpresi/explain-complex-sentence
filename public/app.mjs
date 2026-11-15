const $ = id => document.getElementById(id);
const account = 'sumanpresi86geology@gmail.com';
const clientId = '802821811865-n3l99l05scl1k2pv3bs2uctrd129p7k8.apps.googleusercontent.com';
const driveBase = 'https://www.googleapis.com/drive/v3/';
const sampleSelection = 'a dedicated team be constituted under the expert in GSI taking officers from GSI who have developed expertise on NGDR to undertake data cleaning';
const sampleText = 'Secretary (M) directed that ' + sampleSelection + ' and ensure the quality and effective utilization of the available data.';
const sampleAnswer = 'A GSI expert should lead a team of GSI officers experienced in NGDR to clean the data.';
const catalogs = {
  gemini: 'gemini-4-argon gemini-3.8-flash gemini-3.8-live gemini-3.6-flash gemini-3.5-transcribe gemini-3.1-flash-lite gemini-3.1-flash-lite-image gemini-2.5-pro gemini-2.5-flash',
  openai: 'gpt-6-astra gpt-6.1-sol gpt-6.1-terra gpt-6-luna gpt-5.6 gpt-5.6-sol gpt-5.6-terra gpt-5.6-luna gpt-5.5 gpt-5.5-pro gpt-5.4 gpt-5.4-pro gpt-5.4-mini',
  claude: 'claude-fable-5-2 claude-opus-5-5 claude-sonnet-5-5 claude-haiku-5-5 claude-fable-5-1 claude-fable-5 claude-opus-5 claude-opus-4-8 claude-opus-4-7 claude-opus-4-6 claude-sonnet-5 claude-sonnet-4-6 claude-haiku-4-5'
};
const formatNames = {
  'application/vnd.google-apps.document': 'Google Docs',
  'application/vnd.google-apps.spreadsheet': 'Google Sheets',
  'application/vnd.google-apps.presentation': 'Google Slides',
  'application/vnd.google-apps.folder': 'Folder',
  'application/vnd.google-apps.shortcut': 'Shortcut',
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint'
};
let token = '', tokenTimer, searchVersion = 0, readVersion = 0, explainVersion = 0;
let nextPage = '', folder = '', displayed = '', context = '', currentFile = '', previewUrl = '';
let settings = {provider:'gemini', model:'gemini-2.5-flash', key:''};
let installEvent;
function notice(message) { $('notice').textContent = message; }
function answer(message, copy = false) {
  $('answer').textContent = message;
  $('copy').hidden = !copy;
}
function setSelection(text, excerpt = '') {
  if ($('selection').value !== text || context !== excerpt) {
    explainVersion++;
    $('explain').disabled = false;
    answer('Your one-line explanation will appear here.');
  }
  $('selection').value = text;
  context = excerpt;
  $('selection-status').textContent = text ? text.length + ' characters selected' : 'Select text in the document or paste a passage.';
}
function renderText(text) { displayed = text; $('paper').textContent = text; }
function resetReader() {
  readVersion++;
  explainVersion++;
  $('explain').disabled = false;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = '';
  setSelection('');
  answer('Your one-line explanation will appear here.');
}
function sample() {
  resetReader();
  currentFile = '';
  $('file-kind').textContent = 'SAMPLE DOCUMENT';
  $('file-title').textContent = 'Meeting minutes';
  $('drive-link').hidden = true;
  renderText(sampleText);
  const mark = document.createElement('mark');
  mark.textContent = sampleSelection;
  $('paper').replaceChildren('Secretary (M) directed that ', mark, ' and ensure the quality and effective utilization of the available data.');
  setSelection(sampleSelection, sampleText);
  markCurrent();
}
function connected(value) {
  $('drive-status').textContent = value ? 'Connected' : 'Disconnected';
  $('connect').textContent = value ? 'Disconnect' : 'Connect Drive';
  $('query').disabled = $('search').disabled = !value;
}
function disconnect(message, revoke = true) {
  const oldToken = token;
  token = '';
  clearTimeout(tokenTimer);
  if (revoke && oldToken) window.google?.accounts.oauth2.revoke(oldToken, () => {});
  searchVersion++;
  folder = '';
  nextPage = '';
  $('more').hidden = true;
  $('query').value = '';
  $('files').textContent = 'Connect Drive to search your documents.';
  connected(false);
  resetStyleDrive();
  closeMail();
  sample();
  notice(message);
}
async function drive(path, params = {}, options = {}) {
  const activeToken = token;
  if (!activeToken) throw new Error('Connect Google Drive to continue.');
  const url = new URL(path, driveBase);
  url.search = new URLSearchParams(params);
  const result = await fetch(url, {...options, headers:{...options.headers,Authorization:'Bearer ' + activeToken}});
  if (result.status === 401 && activeToken === token) disconnect('Your Drive session expired. Connect again to continue.', false);
  if (!result.ok) {
    const problem = await result.json().catch(() => ({}));
    throw new Error(problem.error?.message || 'Google Drive request failed.');
  }
  return result;
}
$('connect').onclick = () => {
  if (token) return disconnect('Drive disconnected.');
  if (!window.google?.accounts?.oauth2) return notice('Google sign-in is still loading. Try again in a moment.');
  notice('');
  window.google.accounts.oauth2.initTokenClient({
    client_id:clientId, hint:account, include_granted_scopes:false,
    scope:'https://www.googleapis.com/auth/drive.readonly ' + styleScope,
    error_callback: error => notice(error.type === 'popup_closed' ? 'Google sign-in was closed.' : 'Google sign-in could not open. Check popup settings and the authorized origin.'),
    callback: async response => {
      if (response.error || !response.access_token) return notice(response.error_description || 'Google Drive authorization failed.');
      token = response.access_token;
      try {
        const data = await (await drive('about',{fields:'user(emailAddress)'})).json();
        if (data.user?.emailAddress?.toLowerCase() !== account) {
          return disconnect('Choose ' + account + ' when connecting Drive.');
        }
        tokenTimer = setTimeout(() => disconnect('Your Drive session expired. Connect again to continue.', false), Math.max(1, Number(response.expires_in) - 25 || 3500) * 1000);
        connected(true);
        styleWritable = window.google.accounts.oauth2.hasGrantedAllScopes(response, styleScope);
        styleLoad = loadDriveStyle(token);
        await listFiles();
      } catch (error) { if (token) disconnect(error.message, false); }
    }
  }).requestAccessToken({prompt:'select_account'});
};
function driveLiteral(input) { return input.replaceAll('\\', '\\\\').replaceAll("'", "\\'"); }
function formatName(file) { return formatNames[file.mimeType] || file.mimeType?.split('/')[0] || 'Drive file'; }
function markCurrent() {
  for (const row of $('files').querySelectorAll('.file')) row.setAttribute('aria-current', String(row.dataset.id === currentFile));
}
function renderFile(file) {
  const row = document.createElement('button');
  const icon = document.createElement('span');
  const label = document.createElement('span');
  const type = document.createElement('small');
  row.className = 'file';
  row.dataset.id = file.id;
  icon.className = 'doc-icon';
  icon.textContent = file.mimeType === 'application/pdf' ? 'PDF' : 'Aa';
  label.textContent = file.name;
  type.textContent = formatName(file);
  label.append(type);
  row.append(icon, label);
  row.onclick = () => file.mimeType === 'application/vnd.google-apps.folder'
    ? (folder = file.id, $('query').value = '', listFiles())
    : openFile(file, true);
  $('files').append(row);
}
async function listFiles(append = false) {
  const request = ++searchVersion;
  $('more').hidden = true;
  $('search').disabled = true;
  if (!append) { $('files').textContent = 'Loading Drive files…'; nextPage = ''; }
  const query = driveLiteral($('query').value.trim());
  const conditions = ['trashed = false'];
  if (folder) conditions.push("'" + driveLiteral(folder) + "' in parents");
  if (query) conditions.push("(name contains '" + query + "' or fullText contains '" + query + "')");
  try {
    const result = await drive('files', {
      q:conditions.join(' and '), fields:'nextPageToken,incompleteSearch,files(id,name,mimeType,webViewLink,resourceKey,size,capabilities(canDownload),shortcutDetails(targetId))',
      pageSize:'35', orderBy:'modifiedTime desc', supportsAllDrives:'true', includeItemsFromAllDrives:'true',
      ...(append && nextPage ? {pageToken:nextPage} : {})
    });
    const data = await result.json();
    if (request !== searchVersion) return;
    if (!append) {
      $('files').replaceChildren();
      if (folder) {
        const back = document.createElement('button');
        back.textContent = '← All Drive files';
        back.onclick = () => { folder = ''; listFiles(); };
        $('files').append(back);
      }
    }
    for (const file of data.files || []) renderFile(file);
    if (!data.files?.length && !append) $('files').append(document.createTextNode('No matching files.'));
    nextPage = data.nextPageToken || '';
    $('more').hidden = !nextPage;
    markCurrent();
    notice(data.incompleteSearch ? 'Some shared drives could not be searched. Try a narrower search.' : '');
  } catch (error) {
    if (request === searchVersion) { $('files').textContent = error.message; nextPage = ''; }
  } finally {
    if (request === searchVersion && token) $('search').disabled = false;
  }
}
$('search-form').onsubmit = event => { event.preventDefault(); folder = ''; listFiles(); };
$('more').onclick = () => listFiles(true);
$('sample').onclick = sample;
const fileFields = 'id,name,mimeType,webViewLink,resourceKey,size,capabilities(canDownload),shortcutDetails(targetId)';
function openLink(file) {
  const fallback = new URL('https://drive.google.com/open');
  fallback.searchParams.set('id', file.id);
  if (file.resourceKey) fallback.searchParams.set('resourcekey', file.resourceKey);
  if (!file.webViewLink) return fallback.toString();
  const url = new URL(file.webViewLink);
  return url.protocol === 'https:' && ['drive.google.com','docs.google.com'].includes(url.hostname) ? url.toString() : fallback.toString();
}
async function openFile(file, scroll = false) {
  resetReader();
  const request = readVersion;
  currentFile = file.id;
  markCurrent();
  $('file-kind').textContent = formatName(file).toUpperCase();
  $('file-title').textContent = file.name;
  $('drive-link').href = openLink(file);
  $('drive-link').hidden = false;
  renderText('Loading document…');
  if (scroll && matchMedia('(max-width:700px)').matches) $('file-title').scrollIntoView({block:'start'});
  try {
    if (file.mimeType === 'application/vnd.google-apps.shortcut' && file.shortcutDetails?.targetId) {
      const target = await (await drive('files/' + encodeURIComponent(file.shortcutDetails.targetId), {fields:fileFields, supportsAllDrives:'true'})).json();
      if (request !== readVersion) return;
      if (target.mimeType === 'application/vnd.google-apps.folder') { folder = target.id; listFiles(); renderText('This shortcut points to a folder. Choose a file from the library.'); return; }
      if (target.mimeType !== 'application/vnd.google-apps.shortcut') return openFile(target);
    }
    const type = file.mimeType || '';
    const path = 'files/' + encodeURIComponent(file.id);
    const download = () => drive(path, {alt:'media',supportsAllDrives:'true'});
    const exported = mimeType => drive(path + '/export', {mimeType});
    const exportTypes = {'application/vnd.google-apps.document':'text/plain','application/vnd.google-apps.spreadsheet':'application/zip','application/vnd.google-apps.presentation':'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
    let text = '';
    if (file.capabilities?.canDownload === false) throw new Error('Drive does not allow this file to be downloaded or exported.');
    if (Number(file.size) > 25 * 1024 * 1024) throw new Error('This file is too large for the in-app reader.');
    if (exportTypes[type] === 'text/plain') {
      text = await (await exported('text/plain')).text();
    } else if (/^text\//.test(type) || /\.(csv|tsv|txt|log|md|json|xml|html|yaml|yml|rtf)$/i.test(file.name)) {
      text = await (await download()).text();
    } else if (type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
      const pdf = await pdfjs.getDocument({data:await (await download()).arrayBuffer(),isEvalSupported:false}).promise;
      try {
        const pages = [];
        for (let i = 1; i <= pdf.numPages && request === readVersion; i++) {
          const page = await pdf.getPage(i);
          pages.push((await page.getTextContent()).items.map(item => (item.str || '') + (item.hasEOL ? '\n' : ' ')).join(''));
        }
        text = pages.join('\n\n');
      } finally { await pdf.destroy(); }
    } else if (/\.(docx|pptx|xlsx|odt|ods|odp|epub)$/i.test(file.name) || exportTypes[type]) {
      const {default: JSZip} = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
      const sheet = type === 'application/vnd.google-apps.spreadsheet';
      const source = sheet ? await exported('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') :
        exportTypes[type] ? await exported(exportTypes[type]) : await download();
      const zip = await JSZip.loadAsync(await source.arrayBuffer());
      text = await officeText(zip);
    } else if (/^(image\/(png|jpeg|gif|webp|avif|bmp)|video\/|audio\/)/.test(type)) {
      const media = document.createElement(type.startsWith('image/') ? 'img' : type.split('/')[0]);
      const bytes = await (await download()).arrayBuffer();
      if (request !== readVersion) return;
      previewUrl = URL.createObjectURL(new Blob([bytes],{type}));
      media.src = previewUrl;
      media.controls = true;
      media.alt = file.name;
      displayed = '';
      $('paper').replaceChildren(media, document.createTextNode('\nPaste a transcript or passage below to get an explanation.'));
      return;
    } else throw new Error('This format needs its original viewer.');
    if (request === readVersion) renderText(text.trim() ? text : 'This file has no selectable text. Open it in Drive and paste a passage below.');
  } catch (error) {
    if (request === readVersion) renderText(error.message + ' Open the file in Drive, then paste a passage below.');
  }
}
async function officeText(zip) {
  const names = Object.keys(zip.files).filter(n => /^(word\/document\.xml|ppt\/slides\/slide\d+\.xml|xl\/worksheets\/sheet\d+\.xml|content\.xml|.+\.xhtml)$/i.test(n))
    .sort((a,b) => a.localeCompare(b,undefined,{numeric:true}));
  const parse = async name => new DOMParser().parseFromString(await zip.file(name).async('text'), 'application/xml');
  const tags = (node, name) => [...node.getElementsByTagNameNS('*', name)];
  const strings = zip.file('xl/sharedStrings.xml') ? tags(await parse('xl/sharedStrings.xml'),'si').map(el => tags(el,'t').map(t => t.textContent).join('')) : [];
  const sections = [];
  for (const name of names) {
    const xml = await parse(name);
    if (name.startsWith('xl/')) {
      sections.push(tags(xml,'row').map(row => tags(row,'c').map(cell => {
        const value = tags(cell,'v')[0]?.textContent || '';
        return cell.getAttribute('t') === 's' ? strings[Number(value)] || '' : tags(cell,'t').map(t => t.textContent).join('') || value;
      }).join(' | ')).join('\n'));
    } else {
      sections.push(tags(xml,'p').map(p => {
        const runs = tags(p,'t');
        return runs.length ? runs.map(t => t.textContent).join('') : p.textContent;
      }).join('\n'));
    }
  }
  return sections.join('\n\n');
}
document.addEventListener('selectionchange', () => {
  const selection = getSelection();
  const paper = $('paper');
  if (!selection?.rangeCount || selection.isCollapsed || !paper.contains(selection.anchorNode) || !paper.contains(selection.focusNode)) return;
  const range = selection.getRangeAt(0);
  const chosen = selection.toString().trim().slice(0,4000);
  if (!chosen || !displayed || paper.textContent !== displayed) return;
  const prefix = document.createRange();
  prefix.selectNodeContents(paper);
  prefix.setEnd(range.startContainer, range.startOffset);
  const start = prefix.toString().length;
  const end = start + range.toString().length;
  let left = start, right = end;
  while (left > Math.max(0,start - 500) && !/[.!?\n]/.test(displayed[left - 1])) left--;
  while (right < Math.min(displayed.length,end + 500) && !/[.!?\n]/.test(displayed[right])) right++;
  setSelection(chosen, displayed.slice(left, Math.min(displayed.length,right + 1)).trim());
});
$('selection').oninput = () => {
  context = '';
  explainVersion++;
  $('explain').disabled = false;
  $('selection-status').textContent = $('selection').value.trim() ? 'Passage ready to explain.' : 'Select text in the document or paste a passage.';
  answer('Your one-line explanation will appear here.');
};
function populateModels(preferred, accessible) {
  const provider = $('provider').value;
  $('model').replaceChildren();
  for (const id of catalogs[provider].split(' ')) {
    const option = new Option(id + (accessible && !accessible.includes(id) ? ' · unconfirmed' : ''),id);
    $('model').add(option);
  }
  if ([...$('model').options].some(option => option.value === preferred)) $('model').value = preferred;
}
$('settings').onclick = () => {
  $('provider').value = settings.provider;
  $('key').value = settings.key;
  $('models-feedback').textContent = '';
  populateModels(settings.model);
  $('model-dialog').showModal();
};
$('close-settings').onclick = () => $('model-dialog').close();
$('model-dialog').addEventListener('close', () => { $('key').value = ''; });
$('provider').onchange = () => {
  $('key').value = $('provider').value === settings.provider ? settings.key : '';
  $('models-feedback').textContent = '';
  populateModels($('provider').value === settings.provider ? settings.model : 'gemini-2.5-flash');
};
async function api(action, payload) {
  const result = await fetch('/api/ai', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
  const data = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(data.error || 'The explanation service is unavailable.');
  return data;
}
$('check-models').onclick = async () => {
  const provider = $('provider').value;
  const key = $('key').value.trim();
  if (!key) { $('models-feedback').textContent = 'Enter an API key to check model access.'; return; }
  $('check-models').disabled = true;
  $('models-feedback').textContent = 'Checking provider…';
  try {
    const {models} = await api('models',{provider,key});
    if (provider !== $('provider').value || key !== $('key').value.trim()) return;
    populateModels($('model').value, models);
    const matches = catalogs[provider].split(' ').filter(id => models.includes(id)).length;
    $('models-feedback').textContent = matches + ' requested models found in the provider list. Generation support can vary by model.';
  } catch (error) { $('models-feedback').textContent = error.message; }
  finally { $('check-models').disabled = false; }
};
$('model-form').onsubmit = event => {
  event.preventDefault();
  settings = {provider:$('provider').value, model:$('model').value, key:$('key').value.trim()};
  $('model-status').textContent = settings.key ? settings.model : 'Sample mode';
  $('model-dialog').close();
};
$('explain').onclick = async () => {
  const selected = $('selection').value.trim();
  if (!selected) return answer('Select text in the reader or paste a passage first.');
  if (!settings.key) {
    if (!currentFile && selected === sampleSelection) return answer(sampleAnswer,true);
    return answer('Add an API key in Model settings to explain this passage.');
  }
  const request = ++explainVersion;
  $('explain').disabled = true;
  answer('Writing a one-line explanation…');
  try {
    const data = await api('explain',{...settings,selected,context:context.slice(0,5200)});
    if (request === explainVersion) {
      answer(data.explanation,true);
      if (matchMedia('(max-width:700px)').matches) $('explanation-title').scrollIntoView({block:'nearest'});
    }
  } catch (error) { if (request === explainVersion) answer(error.message); }
  finally { if (request === explainVersion) $('explain').disabled = false; }
};
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('answer').textContent); notice('Explanation copied.'); }
  catch { notice('Select and copy the explanation manually.'); }
};
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installEvent = event;
  $('install').hidden = false;
});
$('install').onclick = async () => {
  if (!installEvent) return;
  await installEvent.prompt();
  installEvent = undefined;
  $('install').hidden = true;
};
window.addEventListener('appinstalled', () => { $('install').hidden = true; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
sample();
const styleNotesKey = 'sentence-lens-writing-style';
const styleScope = 'https://www.googleapis.com/auth/drive.file';
const personalMarker = 'writing-style-v1';
const initialStyle = "Write in clear, courteous Indian English. Keep routine emails brief and use a specific subject. For monthly submissions, include the report or dataset name and reporting month in the subject.\n\nFor formal groups, use \"महोदय/महोदया\" followed by \"Sir/Madam,\" where bilingual addressing is appropriate. For a known recipient, use \"Sir,\" or \"Madam,\" as appropriate. Close bilingual official mail with \"सादर/Regards,\".\n\nFor routine submissions, name the attachment and reporting period. One sentence is enough when sharing the file for information. When forwarding an email, refer to the earlier message and state the action or response needed, if any.\n\nFor review requests, name the draft documents and ask the recipient to convey concurrence or suggest changes. State who will give final approval when known. Keep review, concurrence and approval distinct.";
const profiles = {
  personal: {mailbox:'suman1.das@gsi.gov.in', seed:initialStyle},
  m3c: {mailbox:'ddg.m3c@gsi.gov.in', seed:[
    'Write in the DDG M3C office voice. Match the requested language: English-only or Hindi first followed by the English version. Keep bilingual facts and actions aligned.',
    'For hall bookings and video conference link requests, state the meeting purpose, date, time and exact arrangement requested. For draft minutes, name the meeting and invite comments by the supplied deadline. For ATR replies, identify the points and attachment.',
    'Include an approval line only if approval is supplied. Use VERY URGENT only when expressly required. Use a named DDG signature, a for-DDG block, or a designation-only block only as authorised by the user.'
  ].join('\n\n')},
  helpdesk: {mailbox:'ngdr_helpdesk@gsi.gov.in', seed:''}
};
const styleProfile = $('writing-profile');
const profileKey = id => id === 'personal' ? styleNotesKey : styleNotesKey + ':' + id;
const profileMarker = id => id === 'personal' ? personalMarker : 'writing-style-v1-' + id;
let styleNotes;
let styleFileId = '', styleLoad = Promise.resolve(), styleWritable = false, styleBusy = false, styleReady = false;
const styleEditor = $('writing-style-notes');
const styleStatus = $('writing-training-status');
const styleSave = $('save-style-notes');
const unsavedStyles = new Map();
let styleRequest = 0;
function showCachedStyle() {
  const id = styleProfile.value;
  styleNotes = profiles[id].seed;
  try { styleNotes = localStorage.getItem(profileKey(id))?.slice(0,3000) ?? styleNotes; } catch {}
  styleEditor.value = unsavedStyles.get(id) ?? styleNotes;
}
styleEditor.oninput = () => unsavedStyles.set(styleProfile.value, styleEditor.value);
styleProfile.onchange = () => {
  const session = token;
  const writable = styleWritable;
  resetStyleDrive();
  styleWritable = writable;
  showCachedStyle();
  if (session) styleLoad = loadDriveStyle(session);
};
showCachedStyle();

function cacheStyle(notes) {
  styleNotes = notes;
  try { localStorage.setItem(profileKey(styleProfile.value), notes); } catch {}
}
function resetStyleDrive() {
  styleRequest++;
  styleProfile.disabled = false;
  styleFileId = '';
  styleWritable = styleReady = styleBusy = false;
  styleSave.disabled = false;
  styleLoad = Promise.resolve();
  styleStatus.textContent = 'Connect Drive to sync notes.';
}
async function loadDriveStyle(session) {
  const profile = styleProfile.value;
  const current = () => session === token && profile === styleProfile.value && request === styleRequest;
  const request = ++styleRequest;
  const original = styleEditor.value;
  styleSave.disabled = true;
  styleStatus.textContent = 'Checking Google Drive…';
  try {
    const data = await (await drive('files',{
      q:"trashed = false and appProperties has { key='sentenceLens' and value='"  + profileMarker(profile) + "' }",
      fields:'files(id)', orderBy:'modifiedTime desc', pageSize:1
    })).json();
    if (!current()) return;
    const id = data.files?.[0]?.id;
    if (id) {
      const saved = await (await drive('files/' + encodeURIComponent(id),{alt:'media'})).json();
      if (!current()) return;
      if (typeof saved.notes !== 'string' || saved.notes.length > 3000) throw new Error('The saved Drive style file could not be read.');
      styleFileId = id;
      // Preserve edits made before or during sign-in.
      if (styleEditor.value === original && !unsavedStyles.has(profile)) styleEditor.value = saved.notes;
      cacheStyle(saved.notes);
    }
    styleReady = true;
    styleStatus.textContent = !styleWritable ? 'Reconnect and allow file access to save to Drive.' :
      id ? 'Style notes loaded from Google Drive.' : 'Save your style notes to Google Drive.';
  } catch (error) {
    if (current()) styleStatus.textContent = error.message + ' Drafts can still use the notes on this browser.';
  } finally {
    if (current()) styleSave.disabled = false;
  }
}

styleSave.onclick = async () => {
  if (!token) { $('connect').click(); return; }
  if (styleBusy) return;
  if (!styleWritable) { styleStatus.textContent = 'Reconnect Drive and allow file access.'; return; }
  const session = token;
  const profile = styleProfile.value;
  const notes = styleEditor.value.trim().slice(0,3000);
  if (!styleReady) await (styleLoad = loadDriveStyle(session));
  if (session !== token || profile !== styleProfile.value || !styleReady || styleBusy) return;
  styleBusy = styleSave.disabled = styleProfile.disabled = true;
  styleStatus.textContent = 'Saving to Google Drive…';
  try {
    const data = JSON.stringify({notes});
    const filePath = 'files' + (styleFileId ? '/' + encodeURIComponent(styleFileId) : '');
    const upload = 'https://www.googleapis.com/upload/drive/v3/' + filePath;
    const boundary = 'sentence-lens-' + crypto.randomUUID();
    const metadata = JSON.stringify({name:profile === 'personal' ? 'Sentence Lens - Writing Style.json' : 'Sentence Lens - ' + profiles[profile].mailbox + ' Style.json',mimeType:'application/json',appProperties:{sentenceLens:profileMarker(profile)}});
    const body = styleFileId ? data : '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + metadata +
      '\r\n--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + data + '\r\n--' + boundary + '--';
    const result = await drive(upload, {uploadType:styleFileId ? 'media' : 'multipart',fields:'id'}, {
      method:styleFileId ? 'PATCH' : 'POST',
      headers:{'Content-Type':styleFileId ? 'application/json' : 'multipart/related; boundary=' + boundary},
      body
    });
    const saved = await result.json();
    if (session !== token) return;
    styleFileId = saved.id;
    cacheStyle(notes);
    if (styleEditor.value.trim() === notes) unsavedStyles.delete(profile);
    styleStatus.textContent = 'Style notes saved to Google Drive.';
  } catch (error) {
    if (session === token) { styleReady = false; styleStatus.textContent = error.message; }
  } finally {
    if (session === token) styleBusy = styleSave.disabled = styleProfile.disabled = false;
  }
};

$('copy-mail-request').onclick = async () => {
  const folder = $('writing-folder').value;
  const id = styleProfile.value;
  const count = $('writing-review-count').value;
  const limit = count === 'all' ? 'all accessible messages' : 'up to ' + count + ' suitable messages';
  const request = 'Use my signed-in NIC Workplace session to review ' + limit + ' in the ' + folder +
    ' folder of ' + profiles[id].mailbox + '. Start with the newest messages and report progress in batches. ' +
    (id === 'personal' ? 'Use only text I authored. In Inbox, use only my clearly attributed writing in threads. ' :
      'Identify authors where visible. Learn office conventions across delegates, and keep any observations about my personal voice separate. For Inbox, use only text authored by this office or its delegates. ') +
    'Skip automated notices, OTPs, attachments and quoted duplicates. Report how many messages you reviewed and any coverage limits. ' +
    'Finish with one copy-ready block of reusable style notes under 3,000 characters, without quoting mail bodies, naming correspondents or including operational details.';
  const feedback = $('writing-training-status');
  try {
    await navigator.clipboard.writeText(request);
    feedback.textContent = 'Review request copied.';
  } catch {
    feedback.textContent = request;
  }
};

const draft = $('writing-result');
draft.oninput = () => { $('copy-draft').disabled = !draft.value.trim(); };
$('writing-form').onsubmit = async event => {
  event.preventDefault();
  const status = $('writing-status');
  const button = $('write-draft');
  if (button.disabled) return;
  const notes = $('writing-input').value.trim();
  if (!notes) { status.textContent = 'Enter a rough draft or notes.'; return; }
  if (!settings.key) { status.textContent = 'Add an API key in Model settings first.'; return; }
  const previousDraft = draft.value;
  const profile = styleProfile.value;
  button.disabled = true;
  status.textContent = 'Writing draft…';
  try {
    await styleLoad;
    if (profile !== styleProfile.value) { status.textContent = 'Writing profile changed. Click Write draft again.'; return; }
    const data = await api('draft', {
      ...settings, notes, styleNotes, profile, format:$('writing-format').value, audience:$('writing-audience').value.trim()
    });
    if (profile !== styleProfile.value) { status.textContent = 'Writing profile changed. Click Write draft again.'; return; }
    if (draft.value === previousDraft) {
      draft.value = data.draft;
      draft.oninput();
      status.textContent = 'Draft ready.';
    } else {
      status.textContent = 'Your edits were preserved. Generate again to replace them.';
    }
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
};

$('copy-draft').onclick = async () => {
  try {
    await navigator.clipboard.writeText(draft.value);
    $('writing-status').textContent = 'Draft copied.';
  } catch {
    $('writing-status').textContent = 'Select and copy the draft manually.';
  }
};

let mailPassword = '';
let mailFolder = 'inbox';
let mailOffset = null;
let mailRequest = 0;
let mailController;
const mailStatus = $('mail-status');
const mailList = $('mail-messages');

function closeMail() {
  mailRequest++;
  mailController?.abort();
  mailPassword = '';
  mailOffset = null;
  $('mail-password').value = '';
  $('mail-connect').disabled = false;
  $('mail-inbox').disabled = $('mail-sent').disabled = $('mail-more').disabled = false;
  $('mail-more').hidden = $('mail-workspace').hidden = $('mail-disconnect').hidden = true;
  mailList.replaceChildren();
  showMailPreview();
  mailStatus.textContent = '';
}

function showMailPreview(message) {
  $('mail-subject').textContent = message?.subject || 'Select a message';
  $('mail-from').textContent = message ? [message.correspondent, mailDate(message.date)].filter(Boolean).join(' · ') : '';
  $('mail-body').textContent = message ?
    (message.body || 'No text preview is available. Open this message in NIC Workplace.') +
      (message.partial ? '\n\nPreview limited. Open NIC Workplace for the full message.' : '') : '';
}
function mailDate(value) {
  const date = value && new Date(value);
  return date && Number.isFinite(date.valueOf()) ? date.toLocaleString() : '';
}

async function requestMail(fields, update) {
  mailController?.abort();
  mailController = new AbortController();
  const id = ++mailRequest;
  const folder = mailFolder;
  mailStatus.textContent = fields.uid ? 'Opening message…' : 'Loading ' + (folder === 'sent' ? 'Sent' : 'Inbox') + '…';
  $('mail-connect').disabled = $('mail-inbox').disabled = $('mail-sent').disabled = $('mail-more').disabled = true;
  const controller = mailController;
  const deadline = setTimeout(() => controller.abort(), 35000);
  let result;
  try {
    result = await fetch('/api/mail',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({driveToken:token,password:mailPassword,folder,...fields}),
      cache:'no-store',
      signal:controller.signal
    });
    const data = await result.json().catch(() => null);
    if (!result.ok) throw new Error(data?.error || 'The mail service returned HTTP ' + result.status + '. Try again or open NIC Workplace.');
    if (!data) throw new Error('The mail service returned an unreadable response. Try again.');
    if (id === mailRequest) {
      mailStatus.textContent = '';
      update(data);
    }
  } catch (error) {
    if (id === mailRequest) {
      const timedOut = controller.signal.aborted;
      if ($('mail-workspace').hidden) closeMail();
      mailStatus.textContent = timedOut ? 'The mail request timed out. Try again or open NIC Workplace.' :
        !result ? 'Your browser could not reach the mail service. Try opening Sentence Lens in a regular Safari or Chrome tab, or use Open NIC Workplace above.' : error.message;
    }
  } finally {
    clearTimeout(deadline);
    if (id === mailRequest) $('mail-connect').disabled = $('mail-inbox').disabled = $('mail-sent').disabled = $('mail-more').disabled = false;
  }
}

function openMailFolder(folder, offset = 0) {
  if (!mailPassword) return;
  mailFolder = folder;
  $('mail-inbox').setAttribute('aria-pressed',String(folder === 'inbox'));
  $('mail-sent').setAttribute('aria-pressed',String(folder === 'sent'));
  if (!offset) {
    mailList.replaceChildren();
    showMailPreview();
    $('mail-more').hidden = true;
  }
  return requestMail({offset},data => {
    $('mail-workspace').hidden = false;
    mailOffset = data.nextOffset;
    $('mail-more').hidden = mailOffset === null;
    if (!offset && !data.messages.length) mailStatus.textContent = 'This folder is empty.';
    const visibleUids = new Set([...mailList.querySelectorAll('button')].map(row => row.dataset.uid));
    for (const message of data.messages) {
      if (visibleUids.has(String(message.uid))) continue;
      const li = document.createElement('li');
      const button = document.createElement('button');
      const meta = document.createElement('small');
      button.type = 'button';
      button.dataset.uid = message.uid;
      meta.textContent = [message.correspondent,mailDate(message.date)].filter(Boolean).join(' · ');
      button.append(message.subject,meta);
      button.onclick = () => requestMail({uid:message.uid,validity:data.validity},({message:opened}) => {
        for (const row of mailList.querySelectorAll('button')) row.setAttribute('aria-current',String(row === button));
        showMailPreview(opened);
      });
      li.append(button);
      mailList.append(li);
    }
  });
}

$('mail-form').onsubmit = event => {
  event.preventDefault();
  if (!token || $('connect').textContent !== 'Disconnect') {
    mailStatus.textContent = 'Connect Drive at the top of the page, then open your Inbox.';
    return;
  }
  const password = $('mail-password').value.replace(/\s/g,'');
  if (!/^[!-~]{12}$/.test(password)) {
    mailStatus.textContent = 'Enter your 12-character NIC app password.';
    return;
  }
  mailPassword = password;
  $('mail-password').value = '';
  $('mail-disconnect').hidden = false;
  openMailFolder('inbox');
};
$('mail-disconnect').onclick = closeMail;
$('mail-inbox').onclick = () => openMailFolder('inbox');
$('mail-sent').onclick = () => openMailFolder('sent');
$('mail-more').onclick = () => {
  if (mailOffset !== null) openMailFolder(mailFolder,mailOffset);
};
