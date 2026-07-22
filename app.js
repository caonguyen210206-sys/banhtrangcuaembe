const views=[...document.querySelectorAll('.view')];
const navs=[...document.querySelectorAll('.nav')];
const titles={home:'Bắt đầu',students:'Học sinh',documents:'Tài liệu',create:'Tạo bài tập',assignments:'Bài đã giao',reports:'Kết quả'};
const sidebar=document.querySelector('#sidebar');
function go(id){views.forEach(v=>v.classList.toggle('active',v.id===id));navs.forEach(n=>n.classList.toggle('active',n.dataset.view===id));document.querySelector('#pageTitle').textContent=titles[id]||'TutorFlow';sidebar.classList.remove('open');window.scrollTo({top:0,behavior:'smooth'})}
document.addEventListener('click',e=>{const target=e.target.closest('[data-view]');if(target)go(target.dataset.view)});
document.querySelector('#menu').onclick=()=>sidebar.classList.toggle('open');
document.querySelector('#today').textContent=new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(new Date()).replace(/^./,c=>c.toUpperCase());

const toast=document.querySelector('#toast');
function notify(title,text){document.querySelector('#toastTitle').textContent=title;document.querySelector('#toastText').textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600)}

const studentModal=document.querySelector('#studentModal');
const studentForm=document.querySelector('#studentForm');
const studentEmpty=document.querySelector('#studentEmpty');
function openStudent(){studentModal.classList.remove('hidden')}
document.querySelector('#addStudent').onclick=openStudent;
document.querySelector('#addStudentEmpty').onclick=openStudent;
document.querySelector('#closeModal').onclick=()=>studentModal.classList.add('hidden');
document.querySelector('#continueStudent').onclick=()=>{studentModal.classList.add('hidden');studentEmpty.classList.add('hidden');studentForm.classList.remove('hidden')};
document.querySelector('#cancelStudent').onclick=()=>{studentForm.classList.add('hidden');studentEmpty.classList.remove('hidden')};
studentForm.onsubmit=e=>{e.preventDefault();notify('Đã lưu hồ sơ','Học sinh sẽ xuất hiện khi kết nối cơ sở dữ liệu.');studentForm.reset()};

const fileInput=document.querySelector('#fileInput');
const dropzone=document.querySelector('#dropzone');
const processCard=document.querySelector('#processCard');
const structureCard=document.querySelector('#structureCard');
function handleFile(file){if(!file)return;document.querySelector('#fileName').textContent=file.name;processCard.classList.remove('hidden');structureCard.classList.add('hidden');const steps=[[20,'Đang đọc nội dung và công thức…'],[45,'Đang chia chương và bài học…'],[70,'Đang nhận diện kỹ năng và dạng toán…'],[90,'Đang kiểm tra độ tin cậy…'],[100,'Hoàn tất phân tích. Cần gia sư duyệt cấu trúc.']];let i=0;const timer=setInterval(()=>{const [percent,text]=steps[i];document.querySelector('#processPercent').textContent=`${percent}%`;document.querySelector('#processBar').style.width=`${percent}%`;document.querySelector('#processText').textContent=text;i++;if(i===steps.length){clearInterval(timer);setTimeout(()=>structureCard.classList.remove('hidden'),350)}},550)}
document.querySelector('#uploadBtn').onclick=()=>fileInput.click();
document.querySelector('#chooseFile').onclick=()=>fileInput.click();
fileInput.onchange=()=>handleFile(fileInput.files[0]);
['dragenter','dragover'].forEach(name=>dropzone.addEventListener(name,e=>{e.preventDefault();dropzone.classList.add('drag')}));
['dragleave','drop'].forEach(name=>dropzone.addEventListener(name,e=>{e.preventDefault();dropzone.classList.remove('drag')}));
dropzone.addEventListener('drop',e=>handleFile(e.dataTransfer.files[0]));
document.querySelector('#approveStructure').onclick=()=>notify('Đã duyệt cấu trúc','Nội dung sẽ được dùng trong bước tạo bài tập.');

document.querySelector('#createForm').onsubmit=e=>{e.preventDefault();document.querySelector('#draftPanel').classList.remove('hidden');notify('Đã gửi yêu cầu','AI sẽ tạo bản nháp sau khi hệ thống được kết nối backend.');document.querySelector('#draftPanel').scrollIntoView({behavior:'smooth',block:'start'})};
