function getToken() {
  return localStorage.getItem('adminToken') || '';
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + getToken()
  };
}

function authFetch(url, opts = {}) {
  opts.headers = authHeaders();
  return fetch(url, opts);
}

(async () => {
  if (!getToken()) {
    window.location.href = '/admin/login';
    return;
  }
  const res = await fetch('/api/admin/auth', { headers: { 'Authorization': 'Bearer ' + getToken() } });
  const data = await res.json();
  if (!data.isAdmin) {
    window.location.href = '/admin/login';
    return;
  }
  loadPeople();
})();

document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById('panel-' + tab.dataset.tab);
    panel.classList.add('active');

    if (tab.dataset.tab === 'stats') loadStats();
    if (tab.dataset.tab === 'results') loadResults();
    if (tab.dataset.tab === 'matches') loadMatches();
  });
});

document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem('adminToken');
  window.location.href = '/admin/login';
});

async function loadPeople() {
  const res = await authFetch('/api/admin/participants');
  const people = await res.json();
  const container = document.getElementById('peopleTable');

  if (people.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无参加者</div>';
    return;
  }

  let html = `<table class="admin-table">
    <thead><tr>
      <th>ID</th><th>姓名</th><th>性别</th><th>状态</th><th>已提交</th><th>操作</th>
    </tr></thead><tbody>`;
  for (const p of people) {
    const isActive = parseInt(p.is_active) === 1 || p.is_active === true || p.is_active === 'true' || p.is_active === 1;
    const genderTag = p.gender === 'male'
      ? '<span class="tag male">男生</span>'
      : '<span class="tag female">女生</span>';
    const statusTag = isActive
      ? '<span class="tag active">有效</span>'
      : '<span class="tag inactive">停用</span>';
    const submittedTag = (parseInt(p.submitted) > 0) ? '✅ 已提交' : '—';
    html += `<tr>
      <td>${p.id}</td>
      <td>${escapeHtml(p.name)}</td>
      <td>${genderTag}</td>
      <td>${statusTag}</td>
      <td>${submittedTag}</td>
      <td>
        <button class="action-btn" onclick="editPerson(${p.id}, '${escapeAttr(p.name)}', '${p.gender}', ${isActive ? 1 : 0})">编辑</button>
        <button class="action-btn" onclick="togglePerson(${p.id}, ${isActive ? 1 : 0})">${isActive ? '停用' : '启用'}</button>
      </td>
    </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

document.getElementById('addBtn').addEventListener('click', async () => {
  const name = document.getElementById('newName').value.trim();
  const gender = document.getElementById('newGender').value;
  if (!name) return;
  const res = await authFetch('/api/admin/participants', {
    method: 'POST',
    body: JSON.stringify({ name, gender })
  });
  const data = await res.json();
  if (res.ok) {
    document.getElementById('newName').value = '';
    loadPeople();
  } else {
    alert(data.error || '添加失败');
  }
});

window.editPerson = function(id, name, gender, isActive) {
  const newName = prompt('姓名:', name);
  if (newName === null) return;
  const newGender = confirm('点击"确定"=男生，"取消"=女生') ? 'male' : 'female';
  authFetch(`/api/admin/participants/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name: newName.trim(), gender: newGender, is_active: !!isActive })
  }).then(() => loadPeople());
};

window.togglePerson = async function(id, isActive) {
  try {
    const res = await authFetch(`/api/admin/participants/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: !isActive })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '操作失败');
      return;
    }
    loadPeople();
  } catch (e) {
    alert('网络错误: ' + e.message);
  }
};

async function loadStats() {
  const [statsRes, resultsRes] = await Promise.all([
    authFetch('/api/admin/stats'),
    authFetch('/api/admin/results')
  ]);
  const stats = await statsRes.json();
  const results = await resultsRes.json();

  const grid = document.getElementById('statsGrid');
  grid.innerHTML = `
    <div class="stat-box"><div class="num">${stats.total}</div><div class="label">总人数</div></div>
    <div class="stat-box"><div class="num">${stats.males}</div><div class="label">男生人数</div></div>
    <div class="stat-box"><div class="num">${stats.females}</div><div class="label">女生人数</div></div>
    <div class="stat-box"><div class="num">${stats.submitted}</div><div class="label">已提交人数</div></div>
    <div class="stat-box"><div class="num">${stats.notSubmitted}</div><div class="label">未提交人数</div></div>
    <div class="stat-box"><div class="num">${stats.rate}%</div><div class="label">提交率</div></div>
    <div class="stat-box"><div class="num">${stats.mutualCount}</div><div class="label">双向选择数量</div></div>
  `;

  const likeList = document.getElementById('likeCountList');
  if (results.pickCount.length === 0) {
    likeList.innerHTML = '<div class="empty-state">暂无数据</div>';
    return;
  }
  likeList.innerHTML = results.pickCount.map(lc => {
    const genderTag = lc.gender === 'male'
      ? '<span class="tag male">男生</span>'
      : '<span class="tag female">女生</span>';
    return `<div class="like-count-item">
      <span>${escapeHtml(lc.name)} ${genderTag}</span>
      <span class="tag good">被选 ${lc.count} 次</span>
    </div>`;
  }).join('');
}

async function loadResults() {
  const res = await authFetch('/api/admin/results');
  const data = await res.json();
  const container = document.getElementById('resultsTable');

  if (data.submissions.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无提交记录</div>';
    return;
  }

  let html = `<table class="admin-table">
    <thead><tr>
      <th>提交者</th><th>性别</th><th>第一选择</th><th>第二选择</th><th>第三选择</th><th>提交时间</th><th>操作</th>
    </tr></thead><tbody>`;
  for (const s of data.submissions) {
    const genderTag = s.participant_gender === 'male'
      ? '<span class="tag male">男生</span>'
      : '<span class="tag female">女生</span>';
    const pickNames = s.picks.map(p => escapeHtml(p.name)).join(' / ') || '—';
    html += `<tr>
      <td>${escapeHtml(s.participant_name)}</td>
      <td>${genderTag}</td>
      <td>${s.picks[0] ? escapeHtml(s.picks[0].name) : '—'}</td>
      <td>${s.picks[1] ? escapeHtml(s.picks[1].name) : '—'}</td>
      <td>${s.picks[2] ? escapeHtml(s.picks[2].name) : '—'}</td>
      <td>${s.submitted_at}</td>
      <td><button class="action-btn" style="color:#E17055;border-color:#E17055" onclick="deleteSubmission(${s.id}, '${escapeHtml(s.participant_name)}')">删除</button></td>
    </tr>`;
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function loadMatches() {
  const res = await authFetch('/api/admin/results');
  const data = await res.json();

  const mutualEl = document.getElementById('mutualList');
  if (data.mutualLikes.length === 0) {
    mutualEl.innerHTML = '<div class="empty-state">暂无双向选择</div>';
  } else {
    mutualEl.innerHTML = data.mutualLikes.map(m => {
      return `<div class="mutual-item">
        ❤️ <strong>${escapeHtml(m.person_a.name)}</strong>
        <span style="color:var(--muted)">(${m.person_a.gender_text})</span>
        ↔
        <strong>${escapeHtml(m.person_b.name)}</strong>
        <span style="color:var(--muted)">(${m.person_b.gender_text})</span>
      </div>`;
    }).join('');
  }

  const oneWayEl = document.getElementById('oneWayList');
  if (data.oneWayLikes.length === 0) {
    oneWayEl.innerHTML = '<div class="empty-state">暂无单向选择</div>';
  } else {
    oneWayEl.innerHTML = data.oneWayLikes.map(o => {
      return `<div class="oneway-item">
        ${escapeHtml(o.from.name)} → ${escapeHtml(o.to.name)}
      </div>`;
    }).join('');
  }
}

document.getElementById('exportSubmissions').addEventListener('click', () => {
  window.open('/api/admin/export/submissions?token=' + getToken(), '_blank');
});

document.getElementById('exportMatches').addEventListener('click', () => {
  window.open('/api/admin/export/matches?token=' + getToken(), '_blank');
});

window.deleteSubmission = async function(id, name) {
  if (!confirm(`确定删除 ${name} 的提交记录吗？\n删除后该人可以重新填写。`)) return;
  const res = await authFetch(`/api/admin/submissions/${id}`, { method: 'DELETE' });
  if (res.ok) {
    loadResults();
  } else {
    alert('删除失败');
  }
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
