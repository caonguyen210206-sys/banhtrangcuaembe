const STORAGE_KEY = 'tutorflow-v2';
const defaultState = { students: [], documents: [], assignments: [], results: [], activities: [] };
let state = loadState();
let currentStep = 1;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function loadState() {
  try {
    return { ...defaultState, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
  } catch {
    return JSON.parse(JSON.stringify(defaultState));
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function initials(name) {
  return name.trim().split(/\s+/).slice(-2).map(part => part[0]?.toUpperCase()).join('') || 'HS';
}

function formatDateTime(value) {
  if (!value) return 'Chưa đặt';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function notify(title, message) {
  $('#toastTitle').textContent = title;
  $('#toastMessage').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => $('#toast').classList.remove('show'), 2800);
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

function renderDashboard() {
  const completed = Number(state.students.length > 0) + Number(state.documents.length > 0) + Number(state.assignments.length > 0);
  $('#setupCount').textContent = `${completed}/3 hoàn tất`;
  $('#studentSetupCard').classList.toggle('complete', state.students.length > 0);
  $('#documentSetupCard').classList.toggle('complete', state.documents.length > 0);
  $('#assignmentSetupCard').classList.toggle('complete', state.assignments.length > 0);
  $('#activityEmpty').hidden = state.activities.length > 0;
  $('#activityList').innerHTML = state.activities.map(item => `
    <div class="activity-item"><span>${item.icon}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></div></div>
  `).join('');
}

function renderStudents() {
  $('#studentsEmpty').hidden = state.students.length > 0;
  $('#studentList').innerHTML = state.students.map(student => `
    <article class="student-card">
      <div class="student-card-header"><span class="avatar">${initials(student.name)}</span><div><h3>${escapeHtml(student.name)}</h3><p>${escapeHtml(student.grade)}</p></div></div>
      <div class="student-meta"><div><span>Mục tiêu</span><strong>${escapeHtml(student.goal || 'Chưa thiết lập')}</strong></div><div><span>Bài đã giao</span><strong>${state.assignments.filter(a => a.studentId === student.id).length}</strong></div><div><span>Kết quả</span><strong>${state.results.filter(r => r.studentId === student.id).length}</strong></div></div>
      <button class="button secondary" data-create-for="${student.id}">Tạo bài tập</button>
    </article>
  `).join('');
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
  notify('Đã lưu học sinh', 'Hồ sơ mới đã sẵn sàng để giao bài.');
});

$('#studentList').addEventListener('click', event => {
  const button = event.target.closest('[data-create-for]');
  if (!button) return;
  goToView('assignment');
  refreshAssignmentPrerequisite();
  $('#studentSelect').value = button.dataset.createFor;
  updateConfigSummary();
});

const fileInput = $('#fileInput');
const uploadZone = $('#uploadZone');
function openFilePicker() { fileInput.click(); }
$('#topUploadButton').addEventListener('click', openFilePicker);
$('#chooseFileButton').addEventListener('click', openFilePicker);

['dragenter', 'dragover'].forEach(type => uploadZone.addEventListener(type, event => {
  event.preventDefault();
  uploadZone.classList.add('drag');
}));
['dragleave', 'drop'].forEach(type => uploadZone.addEventListener(type, event => {
  event.preventDefault();
  uploadZone.classList.remove('drag');
}));
uploadZone.addEventListener('drop', event => handleFile(event.dataTransfer.files[0]));
fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

function handleFile(file) {
  if (!file) return;
  const documentItem = {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
    status: 'Đã tiếp nhận',
    createdAt: Date.now()
  };
  state.documents.push(documentItem);
  saveState();
  renderAll();
  addActivity('▤', 'Đã tải tài liệu', file.name);
  notify('Đã nhận tài liệu', 'Tệp đã được thêm vào thư viện.');
  fileInput.value = '';
}

function renderDocuments() {
  $('#documentsEmpty').hidden = state.documents.length > 0;
  $('#documentList').innerHTML = state.documents.map(documentItem => `
    <article class="document-card">
      <div class="file-icon">${escapeHtml(documentItem.type)}</div>
      <div><h3>${escapeHtml(documentItem.name)}</h3><p>${formatFileSize(documentItem.size)} · Tải lên ${new Intl.DateTimeFormat('vi-VN').format(new Date(documentItem.createdAt))}</p></div>
      <span class="status-pill">${escapeHtml(documentItem.status)}</span>
    </article>
  `).join('');
  updateAssignmentSelects();
}

function formatFileSize(bytes) {
  if (!bytes) return 'Không rõ dung lượng';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function refreshAssignmentPrerequisite() {
  const ready = state.students.length > 0 && state.documents.length > 0;
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
    if (state.students.some(s => s.id === currentStudent)) $('#studentSelect').value = currentStudent;
  }
  if ($('#documentSelect')) {
    $('#documentSelect').innerHTML = state.documents.map(documentItem => `<option value="${documentItem.id}">${escapeHtml(documentItem.name)}</option>`).join('');
    if (state.documents.some(d => d.id === currentDocument)) $('#documentSelect').value = currentDocument;
  }
  updateConfigSummary();
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
  $(`#${id}`).addEventListener('input', updateConfigSummary);
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
  const values = [
    config.student?.name || 'Chưa chọn',
    config.documentItem?.name || 'Chưa chọn',
    config.topic || 'Chưa nhập',
    `${config.count || 0} câu`
  ];
  $$('#configSummary dd').forEach((item, index) => item.textContent = values[index]);
}

$('#startGeneration').addEventListener('click', () => {
  const config = getAssignmentConfig();
  if (!config.topic) {
    notify('Thiếu chủ đề', 'Hãy nhập nội dung vừa dạy trước khi tiếp tục.');
    $('#topicInput').focus();
    return;
  }
  if (!config.deadline) {
    notify('Thiếu hạn hoàn thành', 'Hãy chọn hạn nộp cho bài tập.');
    $('#deadlineInput').focus();
    return;
  }
  showStep(2);
  runGeneration(config);
});

function runGeneration(config) {
  const stages = [
    ['Đang đọc nguồn kiến thức', 'Trích xuất kiến thức từ tài liệu', 25],
    ['Đang xây dựng dạng câu hỏi', 'Tạo cấu trúc câu hỏi mới', 50],
    ['Đang kiểm tra nội dung', 'Kiểm tra đáp án và độ khó', 75],
    ['Đang hoàn thiện bản nháp', 'So sánh độ trùng lặp', 100]
  ];
  const checks = $$('#generationChecks li');
  checks.forEach(item => item.classList.remove('done'));
  $('#continueToReview').hidden = true;
  let index = 0;
  const next = () => {
    const [title, message, progress] = stages[index];
    $('#generationTitle').textContent = title;
    $('#generationMessage').textContent = message;
    $('#generationProgress').style.width = `${progress}%`;
    checks[index].classList.add('done');
    index += 1;
    if (index < stages.length) setTimeout(next, 650);
    else {
      setTimeout(() => {
        $('#generationTitle').textContent = 'Bản nháp đã sẵn sàng';
        $('#generationMessage').textContent = `Cấu hình ${config.count} câu đã được chuẩn bị để duyệt.`;
        $('#continueToReview').hidden = false;
      }, 450);
    }
  };
  $('#generationProgress').style.width = '0';
  setTimeout(next, 200);
}

$('#continueToReview').addEventListener('click', () => {
  const config = getAssignmentConfig();
  $('#draftTitle').textContent = config.topic || 'Bài tập mới';
  showStep(3);
});

$('#regenerateDraft').addEventListener('click', () => {
  showStep(2);
  runGeneration(getAssignmentConfig());
});

$('#approveDraft').addEventListener('click', () => {
  const unchecked = $$('.review-summary input[type="checkbox"]:not(:checked)');
  if (unchecked.length) {
    notify('Chưa hoàn tất kiểm tra', 'Hãy xác nhận đủ ba mục trước khi duyệt.');
    return;
  }
  renderPublishSummary();
  showStep(4);
});

function renderPublishSummary() {
  const config = getAssignmentConfig();
  $('#publishSummary').innerHTML = `
    <p><span>Học sinh</span><strong>${escapeHtml(config.student?.name || '')}</strong></p>
    <p><span>Chủ đề</span><strong>${escapeHtml(config.topic)}</strong></p>
    <p><span>Số câu</span><strong>${config.count} câu</strong></p>
    <p><span>Thời gian dự kiến</span><strong>${config.duration} phút</strong></p>
    <p><span>Hạn hoàn thành</span><strong>${formatDateTime(config.deadline)}</strong></p>
  `;
}

$('#publishAssignment').addEventListener('click', () => {
  const config = getAssignmentConfig();
  const assignment = {
    id: crypto.randomUUID(),
    studentId: config.student.id,
    documentId: config.documentItem.id,
    topic: config.topic,
    count: config.count,
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
  saveState();
  addActivity('✦', 'Đã giao bài tập', `${config.student.name} · ${config.topic}`);
  renderAll();
  notify('Đã giao bài', 'Bài tập đã được lưu vào hệ thống.');
  resetAssignmentForm();
  goToView('dashboard');
});

function resetAssignmentForm() {
  $('#topicInput').value = '';
  $('#constraintsInput').value = '';
  $('#questionCount').value = 10;
  $('#deadlineInput').value = '';
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function renderAll() {
  renderDashboard();
  renderStudents();
  renderDocuments();
  renderResults();
  refreshAssignmentPrerequisite();
}

renderAll();
