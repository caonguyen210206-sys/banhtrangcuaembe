const STORAGE_KEY = 'tutorflow-v3';
const API_URL_KEY = 'tutorflow-api-url';
const defaultState = {
  students: [],
  documents: [],
  assignments: [],
  results: [],
  activities: [],
  currentDraft: null
};

let state = loadState();
let currentStep = 1;
let apiState = { connected: false, testing: false };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return { ...structuredClone(defaultState), ...stored };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getApiBase() {
  const configured = localStorage.getItem(API_URL_KEY) || window.TUTORFLOW_API_URL || '';
  if (configured) return configured.trim().replace(/\/+$/, '').replace(/\/api$/, '');
  if (!location.hostname.endsWith('.github.io') && location.protocol.startsWith('http')) return location.origin;
  return '';
}

function apiUrl(path) {
  const base = getApiBase();
  if (!base) throw new Error('Chưa cấu hình URL backend AI.');
  return `${base}${path}`;
}

async function apiFetch(path, options = {}, timeoutMs = 120000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(apiUrl(path), { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Yêu cầu thất bại (${response.status}).`);
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Yêu cầu quá thời gian chờ.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function initials(name) {
  return name.trim().split(/\s+/).slice(-2).map(part => part[0]?.toUpperCase()).join('') || 'HS';
}

function formatDateTime(value) {
  if (!value) return 'Chưa đặt';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatFileSize(bytes) {
  if (!bytes) return 'Không rõ dung lượng';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function notify(title, message) {
  $('#toastTitle').textContent = title;
  $('#toastMessage').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => $('#toast').classList.remove('show'), 3200);
}

function addActivity(icon, title, detail) {
  state.activities.unshift({ icon, title, detail, createdAt: Date.now() });
  state.activities = state.activities.slice(0, 8);
  saveState();
  renderDashboard();
}

const views = $$('.view');
const navItems = $$('.nav-item');
const titles = { dashboard: 'Tổng quan', students: 'Học sinh', documents: 'Tài liệu', assignment: 'Tạo & giao bài', results: 'Kết quả' };

function goToView(id) {
  views.forEach(view => view.classList.toggle('active', view.id === id));
  navItems.forEach(item => item.classList.toggle('active', item.dataset.view === id));
  $('#pageTitle').textContent = titles[id] || 'TutorFlow';
  $('#sidebar').classList.remove('open');
  if (id === 'assignment') refreshAssignmentPrerequisite();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-view]');
  if (target) goToView(target.dataset.view);
});

$('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#today').textContent = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()).replace(/^./, c => c.toUpperCase());

function renderApiStatus(status, text) {
  const button = $('#openApiSettings');
  button.classList.remove('connected', 'error');
  if (status === 'connected') button.classList.add('connected');
  if (status === 'error') button.classList.add('error');
  $('#apiStatusText').textContent = text;
}

async function testApiConnection({ quiet = false, urlOverride = '' } = {}) {
  if (apiState.testing) return false;
  apiState.testing = true;
  const original = localStorage.getItem(API_URL_KEY);
  if (urlOverride) localStorage.setItem(API_URL_KEY, urlOverride.replace(/\/+$/, ''));
  try {
    renderApiStatus('pending', 'Đang kiểm tra AI');
    const health = await apiFetch('/api/health', {}, 12000);
    apiState.connected = Boolean(health.ok && health.aiConfigured);
    renderApiStatus(apiState.connected ? 'connected' : 'error', apiState.connected ? `AI: ${health.model}` : 'Backend thiếu API key');
    if (!quiet) showConnectionResult(apiState.connected, apiState.connected ? `Kết nối thành công với ${health.model}.` : 'Backend hoạt động nhưng chưa có OPENAI_API_KEY.');
    return apiState.connected;
  } catch (error) {
    apiState.connected = false;
    renderApiStatus('error', 'Chưa kết nối AI');
    if (!quiet) showConnectionResult(false, error.message);
    return false;
  } finally {
    if (urlOverride && original) localStorage.setItem(API_URL_KEY, original);
    if (urlOverride && !original) localStorage.removeItem(API_URL_KEY);
    apiState.testing = false;
  }
}

function showConnectionResult(ok, message) {
  const result = $('#connectionResult');
  result.textContent = message;
  result.className = `connection-result show ${ok ? 'ok' : 'no'}`;
}

function openApiModal() {
  $('#apiUrlInput').value = getApiBase();
  $('#connectionResult').className = 'connection-result';
  $('#apiModal').classList.add('open');
  $('#apiModal').setAttribute('aria-hidden', 'false');
}

function closeApiModal() {
  $('#apiModal').classList.remove('open');
  $('#apiModal').setAttribute('aria-hidden', 'true');
}

$('#openApiSettings').addEventListener('click', openApiModal);
$$('[data-close-api]').forEach(button => button.addEventListener('click', closeApiModal));
$('#testApiButton').addEventListener('click', async () => {
  const url = $('#apiUrlInput').value.trim();
  if (!url) return showConnectionResult(false, 'Hãy nhập URL backend.');
  await testApiConnection({ urlOverride: url });
});
$('#apiForm').addEventListener('submit', async event => {
  event.preventDefault();
  const url = $('#apiUrlInput').value.trim().replace(/\/+$/, '');
  if (!url) return showConnectionResult(false, 'Hãy nhập URL backend.');
  localStorage.setItem(API_URL_KEY, url);
  const ok = await testApiConnection();
  if (ok) setTimeout(closeApiModal, 500);
});

function renderDashboard() {
  const readyDocuments = state.documents.filter(item => item.openaiFileId && item.status === 'Sẵn sàng').length;
  const completed = Number(state.students.length > 0) + Number(readyDocuments > 0) + Number(state.assignments.length > 0);
  $('#setupCount').textContent = `${completed}/3 hoàn tất`;
  $('#studentSetupCard').classList.toggle('complete', state.students.length > 0);
  $('#documentSetupCard').classList.toggle('complete', readyDocuments > 0);
  $('#assignmentSetupCard').classList.toggle('complete', state.assignments.length > 0);
  $('#activityEmpty').hidden = state.activities.length > 0;
  $('#activityList').innerHTML = state.activities.map(item => `<div class="activity-item"><span>${item.icon}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></div></div>`).join('');
}

function renderStudents() {
  $('#studentsEmpty').hidden = state.students.length > 0;
  $('#studentList').innerHTML = state.students.map(student => `
    <article class="student-card">
      <div class="student-card-header"><span class="avatar">${initials(student.name)}</span><div><h3>${escapeHtml(student.name)}</h3><p>${escapeHtml(student.grade)}</p></div></div>
      <div class="student-meta"><div><span>Mục tiêu</span><strong>${escapeHtml(student.goal || 'Chưa thiết lập')}</strong></div><div><span>Bài đã giao</span><strong>${state.assignments.filter(a => a.studentId === student.id).length}</strong></div><div><span>Kết quả</span><strong>${state.results.filter(r => r.studentId === student.id).length}</strong></div></div>
      <button class="button secondary" data-create-for="${student.id}">Tạo bài tập</button>
    </article>`).join('');
  updateAssignmentSelects();
}

function openStudentModal() {
  $('#studentModal').classList.add('open');
  $('#studentModal').setAttribute('aria-hidden', 'false');
  setTimeout(() => $('#studentName').focus(), 50);
}
function closeStudentModal() {
  $('#studentModal').classList.remove('open');
  $('#studentModal').setAttribute('aria-hidden', 'true');
  $('#studentForm').reset();
}
$('#openStudentForm').addEventListener('click', openStudentModal);
$('#emptyAddStudent').addEventListener('click', openStudentModal);
$$('[data-close-modal]').forEach(button => button.addEventListener('click', closeStudentModal));
$('#studentForm').addEventListener('submit', event => {
  event.preventDefault();
  const student = {
    id: crypto.randomUUID(),
    name: $('#studentName').value.trim(),
    grade: $('#studentGrade').value.trim(),
    goal: $('#studentGoal').value.trim(),
    note: $('#studentNote').value.trim(),
    createdAt: Date.now()
  };
  state.students.push(student);
  saveState();
  closeStudentModal();
  renderAll();
  addActivity('◎', 'Đã thêm học sinh', `${student.name} · ${student.grade}`);
  notify('Đã lưu học sinh', 'Hồ sơ đã sẵn sàng để tạo bài.');
});
$('#studentList').addEventListener('click', event => {
  const button = event.target.closest('[data-create-for]');
  if (!button) return;
  goToView('assignment');
  $('#studentSelect').value = button.dataset.createFor;
  updateConfigSummary();
});

const fileInput = $('#fileInput');
const uploadZone = $('#uploadZone');
function openFilePicker() {
  if (!apiState.connected) {
    notify('Chưa kết nối AI', 'Hãy cấu hình backend trước khi tải tài liệu.');
    openApiModal();
    return;
  }
  fileInput.click();
}
$('#topUploadButton').addEventListener('click', openFilePicker);
$('#chooseFileButton').addEventListener('click', openFilePicker);
['dragenter', 'dragover'].forEach(type => uploadZone.addEventListener(type, event => { event.preventDefault(); uploadZone.classList.add('drag'); }));
['dragleave', 'drop'].forEach(type => uploadZone.addEventListener(type, event => { event.preventDefault(); uploadZone.classList.remove('drag'); }));
uploadZone.addEventListener('drop', event => handleFile(event.dataTransfer.files[0]));
fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

async function handleFile(file) {
  if (!file) return;
  if (!apiState.connected && !(await testApiConnection({ quiet: true }))) {
    notify('Chưa kết nối AI', 'Không thể gửi file đến backend.');
    openApiModal();
    return;
  }

  const documentItem = {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
    status: 'Đang phân tích',
    createdAt: Date.now()
  };
  state.documents.push(documentItem);
  saveState();
  renderAll();

  try {
    const body = new FormData();
    body.append('file', file);
    const result = await apiFetch('/api/documents', { method: 'POST', body }, 240000);
    Object.assign(documentItem, {
      openaiFileId: result.fileId,
      analysis: result.analysis,
      status: 'Sẵn sàng',
      error: ''
    });
    saveState();
    renderAll();
    addActivity('▤', 'AI đã phân tích tài liệu', file.name);
    notify('Phân tích hoàn tất', 'Tài liệu đã sẵn sàng để tạo bài tập.');
  } catch (error) {
    Object.assign(documentItem, { status: 'Lỗi phân tích', error: error.message });
    saveState();
    renderAll();
    notify('Không thể phân tích', error.message);
  } finally {
    fileInput.value = '';
  }
}

function renderDocuments() {
  $('#documentsEmpty').hidden = state.documents.length > 0;
  $('#documentList').innerHTML = state.documents.map(item => {
    const chapterCount = item.analysis?.chapters?.length || 0;
    const topicCount = item.analysis?.chapters?.reduce((sum, chapter) => sum + (chapter.topics?.length || 0), 0) || 0;
    const statusClass = item.status === 'Đang phân tích' ? 'loading' : item.status === 'Lỗi phân tích' ? 'error' : '';
    return `<article class="document-card ${statusClass}">
      <div class="file-icon">${escapeHtml(item.type)}</div>
      <div><h3>${escapeHtml(item.analysis?.title || item.name)}</h3><p>${formatFileSize(item.size)} · ${escapeHtml(item.analysis?.grade || item.status)}</p>
      ${item.analysis ? `<div class="analysis-summary"><h4>${chapterCount} chương · ${topicCount} bài/chủ đề</h4><p>${escapeHtml(item.analysis.summary)}</p><div class="analysis-tags">${item.analysis.chapters.slice(0, 4).map(chapter => `<span>${escapeHtml(chapter.title)}</span>`).join('')}</div></div>` : item.error ? `<p>${escapeHtml(item.error)}</p>` : ''}</div>
      <div><span class="status-pill">${escapeHtml(item.status)}</span><button class="text-button" data-delete-document="${item.id}">Xóa</button></div>
    </article>`;
  }).join('');
  updateAssignmentSelects();
}

$('#documentList').addEventListener('click', async event => {
  const button = event.target.closest('[data-delete-document]');
  if (!button) return;
  const item = state.documents.find(document => document.id === button.dataset.deleteDocument);
  if (!item) return;
  if (item.openaiFileId && apiState.connected) {
    apiFetch(`/api/documents/${encodeURIComponent(item.openaiFileId)}`, { method: 'DELETE' }, 30000).catch(() => {});
  }
  state.documents = state.documents.filter(document => document.id !== item.id);
  saveState();
  renderAll();
  notify('Đã xóa tài liệu', 'Tài liệu đã được gỡ khỏi thư viện.');
});

function readyDocuments() {
  return state.documents.filter(item => item.openaiFileId && item.status === 'Sẵn sàng');
}

function refreshAssignmentPrerequisite() {
  const ready = state.students.length > 0 && readyDocuments().length > 0;
  $('#assignmentPrerequisite').hidden = ready;
  $('#assignmentWorkflow').hidden = !ready;
  updateAssignmentSelects();
  if (ready) showStep(currentStep);
}

function updateAssignmentSelects() {
  const currentStudent = $('#studentSelect')?.value;
  const currentDocument = $('#documentSelect')?.value;
  if ($('#studentSelect')) {
    $('#studentSelect').innerHTML = state.students.map(student => `<option value="${student.id}">${escapeHtml(student.name)} · ${escapeHtml(student.grade)}</option>`).join('');
    if (state.students.some(student => student.id === currentStudent)) $('#studentSelect').value = currentStudent;
  }
  if ($('#documentSelect')) {
    const documents = readyDocuments();
    $('#documentSelect').innerHTML = documents.map(item => `<option value="${item.id}">${escapeHtml(item.analysis?.title || item.name)}</option>`).join('');
    if (documents.some(item => item.id === currentDocument)) $('#documentSelect').value = currentDocument;
  }
  updateTopicSuggestions();
  updateConfigSummary();
}

function updateTopicSuggestions() {
  const item = state.documents.find(document => document.id === $('#documentSelect')?.value);
  const topics = item?.analysis?.chapters?.flatMap(chapter => chapter.topics?.map(topic => topic.title) || []) || [];
  $('#topicSuggestions').innerHTML = topics.map(topic => `<option value="${escapeHtml(topic)}"></option>`).join('');
}

function showStep(step) {
  currentStep = step;
  $$('.workflow-step').forEach(panel => panel.classList.toggle('active', Number(panel.dataset.stepPanel) === step));
  $$('#stepperTabs button').forEach(button => button.classList.toggle('active', Number(button.dataset.step) === step));
}

$('#stepperTabs').addEventListener('click', event => {
  const button = event.target.closest('[data-step]');
  if (!button) return;
  const target = Number(button.dataset.step);
  if (target <= currentStep) showStep(target);
});

['studentSelect', 'documentSelect', 'topicInput', 'questionCount', 'durationSelect', 'deadlineInput'].forEach(id => {
  $(`#${id}`).addEventListener('input', () => {
    if (id === 'documentSelect') updateTopicSuggestions();
    updateConfigSummary();
  });
});

function getAssignmentConfig() {
  const student = state.students.find(item => item.id === $('#studentSelect').value);
  const documentItem = state.documents.find(item => item.id === $('#documentSelect').value);
  return {
    student,
    documentItem,
    topic: $('#topicInput').value.trim(),
    count: Number($('#questionCount').value),
    duration: Number($('#durationSelect').value),
    deadline: $('#deadlineInput').value,
    modes: $$('input[name="mode"]:checked').map(input => input.value),
    constraints: $('#constraintsInput').value.trim(),
    hints: $('#hintsToggle').checked,
    retry: $('#retryToggle').checked
  };
}

function updateConfigSummary() {
  if (!$('#configSummary')) return;
  const config = getAssignmentConfig();
  const values = [config.student?.name || 'Chưa chọn', config.documentItem?.analysis?.title || config.documentItem?.name || 'Chưa chọn', config.topic || 'Chưa nhập', `${config.count || 0} câu`];
  $$('#configSummary dd').forEach((item, index) => item.textContent = values[index]);
}

$('#startGeneration').addEventListener('click', async () => {
  const config = getAssignmentConfig();
  if (!config.student || !config.documentItem?.openaiFileId) return notify('Thiếu dữ liệu', 'Hãy chọn học sinh và tài liệu đã phân tích.');
  if (!config.topic) { notify('Thiếu chủ đề', 'Hãy nhập nội dung vừa dạy.'); $('#topicInput').focus(); return; }
  if (!config.deadline) { notify('Thiếu hạn hoàn thành', 'Hãy chọn hạn nộp.'); $('#deadlineInput').focus(); return; }
  if (!apiState.connected && !(await testApiConnection({ quiet: true }))) { notify('Mất kết nối AI', 'Hãy kiểm tra backend.'); openApiModal(); return; }
  showStep(2);
  await runGeneration(config);
});

async function runGeneration(config) {
  $('#draftTitle').textContent = config.topic || 'Bài tập mới';
  $('#generationInline').classList.add('show');
  $('#generationMessage').textContent = 'AI đang đọc tài liệu và tạo câu hỏi mới…';
  $('#draftEmpty').hidden = true;
  $('#questionList').innerHTML = '';
  $$('.review-summary input[type="checkbox"]').forEach(input => input.checked = false);

  try {
    const draft = await apiFetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: config.documentItem.openaiFileId,
        topic: config.topic,
        count: config.count,
        grade: config.student.grade,
        modes: config.modes,
        constraints: config.constraints,
        studentContext: [config.student.goal, config.student.note].filter(Boolean).join('. ')
      })
    }, 240000);
    state.currentDraft = { ...draft, config: { ...config, student: { ...config.student }, documentItem: { ...config.documentItem } } };
    saveState();
    renderDraft();
    $('#generationMessage').textContent = `${draft.questions.length} câu đã được tạo. Hãy kiểm tra trước khi giao.`;
    addActivity('✦', 'AI đã tạo bản nháp', config.topic);
  } catch (error) {
    state.currentDraft = null;
    saveState();
    $('#draftEmpty').hidden = false;
    $('#draftEmpty').innerHTML = `<span>!</span><h3>Không thể tạo bài</h3><p>${escapeHtml(error.message)}</p>`;
    $('#generationMessage').textContent = 'Tạo bài thất bại.';
    notify('Không thể tạo bài', error.message);
  } finally {
    $('#generationInline').classList.remove('show');
  }
}

function renderDraft() {
  const questions = state.currentDraft?.questions || [];
  $('#draftEmpty').hidden = questions.length > 0;
  $('#questionList').innerHTML = questions.map((question, index) => `
    <article class="question-card">
      <div class="question-card-head"><div><span>Câu ${index + 1}</span><span>${escapeHtml(question.difficulty)}</span><span>${escapeHtml(question.type)}</span><span>${escapeHtml(question.skill)}</span></div><button class="text-button" data-remove-question="${index}">Xóa</button></div>
      <h3>${escapeHtml(question.prompt)}</h3>
      <div class="question-meta">
        <details><summary>Đáp án</summary><p>${escapeHtml(question.answer)}</p></details>
        <details><summary>Lời giải</summary><ol>${question.solution.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol></details>
        <details><summary>Lỗi thường gặp</summary><p>${escapeHtml(question.common_error)}</p></details>
        <details><summary>Độ mới của câu hỏi</summary><p>${escapeHtml(question.novelty_note)}</p></details>
      </div>
      <div class="source-note"><span>Nguồn kiến thức: ${escapeHtml(question.source_reference)}</span></div>
    </article>`).join('');
}

$('#questionList').addEventListener('click', event => {
  const button = event.target.closest('[data-remove-question]');
  if (!button || !state.currentDraft) return;
  state.currentDraft.questions.splice(Number(button.dataset.removeQuestion), 1);
  saveState();
  renderDraft();
});

$('#regenerateDraft').addEventListener('click', async () => {
  const config = getAssignmentConfig();
  await runGeneration(config);
});

$('#approveDraft').addEventListener('click', () => {
  if (!state.currentDraft?.questions?.length) return notify('Chưa có câu hỏi', 'Hãy tạo bản nháp trước.');
  const unchecked = $$('.review-summary input[type="checkbox"]:not(:checked)');
  if (unchecked.length) return notify('Chưa hoàn tất kiểm tra', 'Hãy xác nhận đủ ba mục trước khi duyệt.');
  renderPublishSummary();
  showStep(3);
});

function renderPublishSummary() {
  const config = getAssignmentConfig();
  const questionCount = state.currentDraft?.questions?.length || 0;
  $('#publishSummary').innerHTML = `<p><span>Học sinh</span><strong>${escapeHtml(config.student?.name || '')}</strong></p><p><span>Chủ đề</span><strong>${escapeHtml(config.topic)}</strong></p><p><span>Số câu</span><strong>${questionCount} câu</strong></p><p><span>Thời gian dự kiến</span><strong>${config.duration} phút</strong></p><p><span>Hạn hoàn thành</span><strong>${formatDateTime(config.deadline)}</strong></p>`;
}

$('#publishAssignment').addEventListener('click', () => {
  const config = getAssignmentConfig();
  if (!state.currentDraft?.questions?.length) return notify('Thiếu bản nháp', 'Không có câu hỏi để giao.');
  const assignment = {
    id: crypto.randomUUID(),
    studentId: config.student.id,
    documentId: config.documentItem.id,
    topic: config.topic,
    questions: state.currentDraft.questions,
    duration: config.duration,
    deadline: config.deadline,
    modes: config.modes,
    constraints: config.constraints,
    hints: config.hints,
    retry: config.retry,
    resultVisibility: $('#resultVisibility').value,
    attempts: $('#attemptSelect').value,
    status: 'Đã giao',
    createdAt: Date.now()
  };
  state.assignments.push(assignment);
  state.currentDraft = null;
  saveState();
  addActivity('✓', 'Đã giao bài tập', `${config.student.name} · ${config.topic}`);
  renderAll();
  notify('Đã giao bài', 'Bài tập và câu hỏi AI đã được lưu.');
  resetAssignmentForm();
  goToView('dashboard');
});

function resetAssignmentForm() {
  $('#topicInput').value = '';
  $('#constraintsInput').value = '';
  $('#questionCount').value = 10;
  $('#deadlineInput').value = '';
  $('#questionList').innerHTML = '';
  $('#draftEmpty').hidden = false;
  $$('.review-summary input[type="checkbox"]').forEach(input => input.checked = false);
  currentStep = 1;
  showStep(1);
  updateConfigSummary();
}

function renderResults() {
  $('#resultsEmpty').hidden = state.results.length > 0;
  $('#resultList').innerHTML = state.results.map(result => {
    const student = state.students.find(item => item.id === result.studentId);
    return `<article class="result-card"><div class="result-score">${escapeHtml(String(result.score))}</div><div><h3>${escapeHtml(result.topic)}</h3><p>${escapeHtml(student?.name || 'Học sinh')} · ${formatDateTime(result.submittedAt)}</p></div><button class="button secondary">Xem chi tiết</button></article>`;
  }).join('');
}

function renderAll() {
  renderDashboard();
  renderStudents();
  renderDocuments();
  renderResults();
  refreshAssignmentPrerequisite();
  renderDraft();
}

renderAll();
testApiConnection({ quiet: true });
