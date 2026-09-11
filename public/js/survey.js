let allParticipants = [];
let selectedName = null;
let selectedGender = null;
let participantId = null;
let oppositeGenderList = [];
let selectedPicks = { 1: null, 2: null, 3: null };

function showLoading(msg) {
  let el = document.getElementById('loadingOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loadingOverlay';
    el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,249,245,0.8);z-index:200;display:flex;align-items:center;justify-content:center;font-size:14px;color:#E17055;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'flex';
}

function hideLoading() {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = 'none';
}

async function init() {
  showLoading('加载中...');
  await loadParticipants();
  hideLoading();
}

async function loadParticipants() {
  const res = await fetch('/api/participants');
  allParticipants = await res.json();
  const nameSelect = document.getElementById('nameSelect');
  allParticipants.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    nameSelect.appendChild(opt);
  });
}

document.getElementById('nameSelect').addEventListener('change', async function() {
  const id = this.value;
  if (!id) return;
  selectedName = this.options[this.selectedIndex].textContent;
  participantId = parseInt(id);

  resetFromStep(2);

  showLoading('检查中...');
  const res = await fetch('/api/check-submitted', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: selectedName })
  });
  const data = await res.json();
  hideLoading();

  if (data.submitted) {
    showPage('donePage');
    return;
  }

  document.getElementById('step2').classList.add('active');
  document.querySelectorAll('.gender-btn').forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('active');
  });
});

function selectGender(gender, btn) {
  selectedGender = gender;
  document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const oppGender = gender === 'male' ? 'female' : 'male';
  const label = gender === 'male' ? '请从女生中选择（1~3位）' : '请从男生中选择（1~3位）';
  document.getElementById('pickLabel').textContent = label;

  oppositeGenderList = allParticipants.filter(p => p.gender === oppGender);

  for (let i = 1; i <= 3; i++) {
    const placeholder = i === 1 ? '请选择 ▼' : '可以不选 ▼';
    const sel = document.getElementById('pick' + i);
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    oppositeGenderList.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
    sel.disabled = false;
    selectedPicks[i] = null;
  }

  document.getElementById('step3').classList.add('active');
  updateSubmitButton();
}

document.querySelectorAll('.gender-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectGender(btn.dataset.gender, btn);
  });
});

for (let i = 1; i <= 3; i++) {
  document.getElementById('pick' + i).addEventListener('change', function() {
    const val = this.value;
    selectedPicks[i] = val ? parseInt(val) : null;
    updateDropdowns();
    updateSubmitButton();
  });
}

function updateDropdowns() {
  const selectedIds = Object.values(selectedPicks).filter(v => v !== null);
  for (let i = 1; i <= 3; i++) {
    const sel = document.getElementById('pick' + i);
    const currentValue = selectedPicks[i];
    Array.from(sel.options).forEach(opt => {
      if (!opt.value) return;
      const id = parseInt(opt.value);
      if (id === currentValue) {
        opt.hidden = false;
      } else if (selectedIds.includes(id)) {
        opt.hidden = true;
      } else {
        opt.hidden = false;
      }
    });
  }
}

function updateSubmitButton() {
  document.getElementById('submitBtn').disabled = false;
  document.getElementById('errorMsg').textContent = '';
}

document.getElementById('submitBtn').addEventListener('click', () => {
  document.getElementById('confirmModal').classList.add('active');
});

document.getElementById('modalCancel').addEventListener('click', () => {
  document.getElementById('confirmModal').classList.remove('active');
});

document.getElementById('modalConfirm').addEventListener('click', async () => {
  document.getElementById('confirmModal').classList.remove('active');
  const picks = [1, 2, 3]
    .filter(i => selectedPicks[i] !== null)
    .map(i => ({ id: selectedPicks[i] }));

  showLoading('提交中...');
  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: participantId, picks })
    });
    const data = await res.json();
    hideLoading();
    if (res.ok && data.success) {
      showPage('successPage');
    } else {
      document.getElementById('errorMsg').textContent = data.error || '提交失败，请重试';
    }
  } catch (e) {
    hideLoading();
    document.getElementById('errorMsg').textContent = '网络错误，请重试';
  }
});

function showPage(pageId) {
  document.getElementById('surveyPage').style.display = 'none';
  document.getElementById('successPage').classList.remove('active');
  document.getElementById('donePage').classList.remove('active');
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');
}

function resetFromStep(step) {
  for (let i = step; i <= 3; i++) {
    const el = document.getElementById('step' + i);
    if (el) el.classList.remove('active');
  }
  selectedGender = null;
  selectedPicks = { 1: null, 2: null, 3: null };
  document.querySelectorAll('.gender-btn').forEach(b => {
    b.classList.remove('active');
    b.disabled = false;
  });
  document.getElementById('errorMsg').textContent = '';
  document.getElementById('submitBtn').disabled = true;
}

init();
