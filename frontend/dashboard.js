/* ════════════════════════════════════════════════
   MIT BLR RIDE SHARING — DASHBOARD.JS
   Version: 1.0.0
════════════════════════════════════════════════ */

'use strict';
function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
/* ══════════════════════════════════
   DATA STORE
══════════════════════════════════ */
/*
const DB = {
  requests: [
    //hard coded requests for testing
    { id: 'r1', from: 'MIT BLR', to: 'Kempegowda Airport', date: '2025-06-24', time: '17:30', status: 'open',    notes: 'Flexible on pickup point near gate.' },
    { id: 'r2', from: 'MIT BLR', to: 'Whitefield',         date: '2025-06-25', time: '08:00', status: 'open',    notes: '' },
    { id: 'r3', from: 'Koramangala', to: 'MIT BLR',        date: '2025-06-23', time: '19:15', status: 'matched', notes: 'Need to be there by 8 PM.' },
    { id: 'r4', from: 'Electronic City', to: 'MIT BLR',    date: '2025-06-22', time: '09:00', status: 'closed',  notes: '' },
    { id: 'r5', from: 'MIT BLR', to: 'Majestic',           date: '2025-06-20', time: '18:15', status: 'expired', notes: 'Connecting train at 7:30.' },
    { id: 'r6', from: 'MIT BLR', to: 'MG Road',            date: '2025-06-19', time: '11:00', status: 'matched', notes: '' },
  ],

  groups: [
    //hardcoded groups for testing
    {
      id: 'g1', from: 'MIT BLR', to: 'Airport', date: '2025-06-24', time: '17:30',
      members: [
        { initials: 'KM', color: '#2563EB' },
        { initials: 'AP', color: '#059669' },
        { initials: 'RS', color: '#D97706' },
      ],
      role: 'creator', status: 'active',
    },
    {
      id: 'g2', from: 'MIT BLR', to: 'Whitefield', date: '2025-06-25', time: '08:00',
      members: [
        { initials: 'KM', color: '#2563EB' },
        { initials: 'NR', color: '#7C3AED' },
      ],
      role: 'creator', status: 'active',
    },
    {
      id: 'g3', from: 'Koramangala', to: 'MIT BLR', date: '2025-06-26', time: '19:15',
      members: [
        { initials: 'SB', color: '#DC2626' },
        { initials: 'KM', color: '#2563EB' },
        { initials: 'PM', color: '#0891B2' },
        { initials: 'AV', color: '#059669' },
      ],
      role: 'member', status: 'active',
    },
    {
      id: 'g4', from: 'MIT BLR', to: 'Electronic City', date: '2025-06-27', time: '18:00',
      members: [
        { initials: 'RS', color: '#D97706' },
        { initials: 'KM', color: '#2563EB' },
      ],
      role: 'member', status: 'active',
    },
  ],

  matchingStudents: [
    { id: 'm1', name: 'Rahul S.',  initials: 'RS', color: '#D97706', time: '05:28 PM', notes: 'Okay with slight delay.', selected: true  },
    { id: 'm2', name: 'Priya M.',  initials: 'PM', color: '#0891B2', time: '05:30 PM', notes: 'Carry luggage, need boot space.', selected: true  },
    { id: 'm3', name: 'Arjun R.',  initials: 'AR', color: '#7C3AED', time: '05:35 PM', notes: '',   selected: false },
    { id: 'm4', name: 'Sneha K.',  initials: 'SK', color: '#059669', time: '05:40 PM', notes: 'Vegetarian. Very punctual.', selected: false },
  
    ],
};

/* ============================================
   AUTHENTICATED FETCH HELPER
============================================ */

async function apiFetch(url, options = {}) {

    const token = localStorage.getItem("token");

    const headers = {
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return fetch(url, {
        ...options,
        headers
    });
}

/* ══════════════════════════════════
   STATE
══════════════════════════════════ */
const State = {
  currentPage:    'dashboard',
  pageHistory:    [],
  requestFilter:  'all',
  groupFilter:    'my',
  searchQuery:    '',
  mobileNavOpen:  false,
  notifOpen:      false,
};

/* ══════════════════════════════════
   ROUTER
══════════════════════════════════ */
console.log("Reached navigate section");
function navigate(pageId) {
  const pages = document.querySelectorAll('.page');
  pages.forEach(p => p.classList.remove('active'));

  const target = document.getElementById('page-' + pageId);
  if (!target) { console.warn('Page not found:', pageId); return; }

  // Push history
  if (State.currentPage !== pageId) {
    State.pageHistory.push(State.currentPage);
  }
  State.currentPage = pageId;

  target.classList.add('active');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Sync navbar active state
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const navMap = { dashboard: 'navDashboard', profile: 'navProfile' };
  if (navMap[pageId]) {
    const el = document.getElementById(navMap[pageId]);
    if (el) el.classList.add('active');
  }

  // Sync mobile nav drawer active state
  document.querySelectorAll('.mobile-nav-link').forEach(l => l.classList.remove('active'));
  const mobileNavMap = {
    dashboard:       'mobileNavDashboard',
    profile:         'mobileNavProfile',
    'create-request':'mobileNavCreateRequest',
    'my-requests':   'mobileNavMyRequests',
    'active-groups': 'mobileNavActiveGroups',
  };
  if (mobileNavMap[pageId]) {
    const el = document.getElementById(mobileNavMap[pageId]);
    if (el) el.classList.add('active');
  }

  // Sync mobile bottom nav active state
  const mbnMap = {
    dashboard:       'mbnDashboard',
    'my-requests':   'mbnRequests',
    'create-request':'mbnCreate',
    'active-groups': 'mbnGroups',
    profile:         'mbnProfile',
  };
  if (mbnMap[pageId]) {
    setActiveMbn(mbnMap[pageId]);
  } else {
    document.querySelectorAll('.mbn-item').forEach(el => el.classList.remove('active'));
  }

  // Close mobile nav if open
  if (State.mobileNavOpen) closeMobileNav();

  // Page-specific init
  if (pageId === 'dashboard')     loadDashboardData();
  if (pageId === 'my-requests')   loadMyRideRequests();;
  if (pageId === 'active-groups') loadActiveGroups();
  if (pageId === "create-group") {

    loadMyRequests(
        inviteExistingGroup
            ? inviteExistingGroup.rideRequestId
            : null
    );

}
  if (pageId === 'create-request') initCreateForm();
  if (pageId === 'profile')       initProfile();
}
console.log("Navigate loaded");
//window.navigate = navigate;


/* History back */
function historyBack() {
  const prev = State.pageHistory.pop();
  if (prev) navigate(prev);
  else navigate('dashboard');
}

/* ══════════════════════════════════
   PARTICLE CANVAS
══════════════════════════════════ */
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeParticle() {
    return {
      x:       Math.random() * (W || 1200),
      y:       Math.random() * (H || 800),
      r:       Math.random() * 1.6 + 0.5,
      vx:      (Math.random() - 0.5) * 0.25,
      vy:      -(Math.random() * 0.35 + 0.08),
      life:    0,
      maxLife: Math.random() * 180 + 80,
      alpha:   0,
    };
  }

  function initPool() {
    particles = Array.from({ length: 90 }, makeParticle);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.life++;
      const frac = p.life / p.maxLife;
      p.alpha = frac < 0.25
        ? frac / 0.25
        : 1 - (frac - 0.25) / 0.75;
      if (p.life >= p.maxLife) Object.assign(p, makeParticle());
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -10) p.y = H + 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(96,165,250,${p.alpha * 0.45})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { resize(); });
  resize();
  initPool();
  draw();
}

/* ══════════════════════════════════
   DYNAMIC USERNAME & GREETING
══════════════════════════════════ */
function initUser() {
  const raw  = localStorage.getItem('userName') || localStorage.getItem('name') || '';
  const name = raw.trim();
  const first = name.split(' ')[0] || '';

  // Greeting word by time
  const hour = new Date().getHours();
  const greetWord = hour < 12 ? 'Good morning,'
    : hour < 17 ? 'Good afternoon,'
    : 'Good evening,';

  // Hero
  const greetEl = document.getElementById('heroGreetLine');
  const nameEl  = document.getElementById('heroName');
  if (greetEl) greetEl.textContent = greetWord;
  if (nameEl)  nameEl.textContent  = first || 'Welcome back';

  // Navbar
  const avatarEl   = document.getElementById('navAvatar');
  const usernameEl = document.getElementById('navUsername');
  if (first) {
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    if (avatarEl)   avatarEl.textContent   = initials;
    if (usernameEl) usernameEl.textContent = first;
  } else {
    if (avatarEl)   avatarEl.textContent   = 'ME';
    if (usernameEl) usernameEl.textContent = 'You';
  }

  // Profile page
  const profAv   = document.getElementById('profileAvatarLarge');
  const profName = document.getElementById('profileNameDisplay');
  const profInp  = document.getElementById('profileName');
  if (profAv)   profAv.textContent   = first ? first.slice(0, 2).toUpperCase() : 'ME';
  if (profName) profName.textContent = name || 'Your Name';
  if (profInp)  profInp.value        = name;

  const emailInp = document.getElementById('profileEmail');
  const savedEmail = localStorage.getItem('userEmail') || '';
  if (emailInp) emailInp.value = savedEmail || 'yourname@learner.manipal.edu';
}

/* ══════════════════════════════════
   DASHBOARD LIVE DATA
   (Hero stats, Recent Ride Requests, Upcoming Groups)
══════════════════════════════════ */
async function loadDashboardData() {

  try {
    const [reqRes, groupRes] = await Promise.all([
      apiFetch(`https://rideshare-backend-uv0p.onrender.com/my-ride-requests`),
      apiFetch(`https://rideshare-backend-uv0p.onrender.com/active-groups`)
    ]);

    const reqData   = reqRes.ok   ? await reqRes.json()   : { requests: [] };
    const groupData = groupRes.ok ? await groupRes.json() : [];

    const activeRequests = reqData.requests || [];
    const activeGroups   = Array.isArray(groupData) ? groupData : [];

    // Hero stats
    const openReqEl      = document.getElementById('heroOpenRequests');
    const activeGroupsEl = document.getElementById('heroActiveGroups');
    if (openReqEl)      openReqEl.textContent      = activeRequests.length;
    if (activeGroupsEl) activeGroupsEl.textContent = activeGroups.length;

    renderRecentRequests(activeRequests);
    renderUpcomingGroups(activeGroups);

  } catch (err) {
    console.error('Failed to load dashboard data:', err);
  }
}

function renderRecentRequests(requests) {
  const tbody       = document.getElementById('recentReqTableBody');
  const mobileWrap  = document.getElementById('recentReqMobileCards');
  const emptyState  = document.getElementById('recentReqEmpty');
  const desktopTable = document.querySelector('#page-dashboard .requests-table.desktop-table');
  if (!tbody || !mobileWrap) return;

  if (!requests.length) {
    tbody.innerHTML = '';
    mobileWrap.innerHTML = '';
    if (desktopTable) desktopTable.style.display = 'none';
    mobileWrap.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (desktopTable) desktopTable.style.display = '';
  mobileWrap.style.display = '';
  if (emptyState) emptyState.style.display = 'none';

  const sorted = [...requests].sort((a, b) => {
    const da = new Date(`${a.ride_date}T${a.ride_time || '00:00'}`);
    const db = new Date(`${b.ride_date}T${b.ride_time || '00:00'}`);
    return da - db;
  }).slice(0, 4);

  const statusBadge = (r) => {
    if (r.groupStatus === 'ingroup') return `<span class="badge badge-purple">Matched</span>`;
    if (r.groupStatus === 'pending') return `<span class="badge badge-purple">Pending</span>`;
    return `<span class="badge badge-green">Open</span>`;
  };

  const arrowSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;

  tbody.innerHTML = sorted.map(r => `
    <tr onclick="navigate('my-requests')">
      <td class="td-from">${escapeHTML(r.source)}</td>
      <td class="td-arrow">${arrowSvg}</td>
      <td class="td-to">${escapeHTML(r.destination)}</td>
      <td>${formatDateLabel(r.ride_date)}</td>
      <td>${formatTime(r.ride_time)}</td>
      <td>${statusBadge(r)}</td>
    </tr>`).join('');

  mobileWrap.innerHTML = sorted.map(r => `
    <div class="req-mini-card" onclick="navigate('my-requests')">
      <div class="req-mini-route">${escapeHTML(r.source)} <span class="arr">→</span> ${escapeHTML(r.destination)}</div>
      <div class="req-mini-meta">${formatDateLabel(r.ride_date)} · ${formatTime(r.ride_time)}</div>
      ${statusBadge(r)}
    </div>`).join('');
}

function renderUpcomingGroups(groups) {
  const list       = document.getElementById('upcomingGroupsList');
  const emptyState = document.getElementById('upcomingGroupsEmpty');
  if (!list) return;

  if (!groups.length) {
    list.innerHTML = '';
    list.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  list.style.display = '';
  if (emptyState) emptyState.style.display = 'none';

  const sorted = [...groups].sort((a, b) => {
    const da = new Date(`${a.ride_date}T${a.ride_time || '00:00'}`);
    const db = new Date(`${b.ride_date}T${b.ride_time || '00:00'}`);
    return da - db;
  }).slice(0, 3);

  const calSvg    = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const peopleSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`;
  const arrowSvg2 = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--sky)"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;

  list.innerHTML = sorted.map(g => `
    <div class="glass glass-lift upcoming-card" onclick="navigate('active-groups')">
      <div class="upcoming-route">
        <span class="uc-from">${escapeHTML(g.source)}</span>
        ${arrowSvg2}
        <span class="uc-to">${escapeHTML(g.destination)}</span>
      </div>
      <div class="upcoming-meta">
        <span>${calSvg} ${formatDateLabel(g.ride_date)}, ${formatTime(g.ride_time)}</span>
        <span>${peopleSvg} ${g.currentMembers} member${g.currentMembers === 1 ? '' : 's'}</span>
      </div>
      <span class="badge badge-green">${g.status === 'active' ? 'Active' : 'Pending'}</span>
    </div>`).join('');
}

/* ══════════════════════════════════
   NOTIFICATION PANEL
══════════════════════════════════ */
let notifications = [];

async function loadNotifications() {

    try {

        const response = await apiFetch(
            `https://rideshare-backend-uv0p.onrender.com/notifications`
        );

        const data = await response.json();

        if (!response.ok) {
            showToast(data.message || "Failed to load notifications", "error");
            return;
        }

        notifications = data;

        renderNotifications();

    } catch (err) {

        console.error(err);

        showToast("Server Error", "error");

    }

}
function toggleNotif() {
  const panel = document.getElementById('notifPanel');
  const btn   = document.getElementById('notifBtn');
  if (!panel) return;
  State.notifOpen = panel.classList.toggle('open');
  btn.setAttribute('aria-expanded', State.notifOpen);
  if (State.notifOpen) {

    loadNotifications();

  }
}

async function clearNotifs() {


    const response = await apiFetch(
        "https://rideshare-backend-uv0p.onrender.com/notification/read-all",
        {
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:null
        }
    );

    if(response.ok){

        notifications.forEach(n=>n.isRead=true);

        renderNotifications();

    }

}

/* Close panel on outside click */
document.addEventListener('click', e => {
  const panel = document.getElementById('notifPanel');
  const btn   = document.getElementById('notifBtn');
  if (!panel || !State.notifOpen) return;
  if (!panel.contains(e.target) && !btn.contains(e.target)) {
    panel.classList.remove('open');
    State.notifOpen = false;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
});

function renderNotifications() {

    const list = document.getElementById("notifList");

    if (!list) return;

    updateNotificationBadge();

    if (!notifications.length) {
        
        list.innerHTML = `
          <div class="notif-empty">

              <div>

                  <div style="font-size:30px;margin-bottom:8px;">
                  </div>

                  <div>No notifications yet</div>

              </div>

          </div>
          `;

        return;
    }

list.innerHTML = notifications.map(n => `

<div class="notif-item ${n.isRead ? "" : "unread"}"
     onclick="markNotificationRead('${n.id}')">

    <div class="notif-dot"
         style="background:${getNotificationColor(n.type)}">
    </div>

    <div class="notif-body">

        <p>

            <strong>${escapeHTML(n.title)}</strong><br>

            ${escapeHTML(n.message)}

        </p>

        <time>

            ${formatNotificationTime(n.createdAt)}

        </time>

    </div>

</div>

`).join("");

}
function getNotificationColor(type){

    switch(type){

        case "INVITATION_RECEIVED":
            return "var(--success)";

        case "JOIN_REQUEST":
            return "var(--sky)";

        case "INVITATION_ACCEPTED":
        case "JOIN_ACCEPTED":
            return "var(--purple)";

        case "MEMBER_LEFT":
            return "orange";

        case "GROUP_DISSOLVED":
            return "red";

        case "RIDE_COMPLETED":
            return "var(--success)";

        default:
            return "var(--muted-dim)";
    }

}
function formatNotificationTime(date){

    const diff =
        (Date.now() - new Date(date)) / 1000;

    if(diff < 60)
        return "Just now";

    if(diff < 3600)
        return `${Math.floor(diff/60)} min ago`;

    if(diff < 86400)
        return `${Math.floor(diff/3600)} hr ago`;

    return new Date(date).toLocaleDateString();

}
async function markNotificationRead(id) {

    try {

        const response = await apiFetch(
            "https://rideshare-backend-uv0p.onrender.com/notification/read",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    notificationId: id
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {

            showToast(
                data.message || "Failed to update notification",
                "error"
            );

            return;

        }

        const notif = notifications.find(n => n.id === id);

        if (notif) notif.isRead = true;

        renderNotifications();

    }

    catch (err) {

        console.error(err);

        showToast("Server Error", "error");

    }

}

function updateNotificationBadge() {

    const badge = document.getElementById("notifBadge");

    if (!badge) return;

    const unread = notifications.filter(n => !n.isRead).length;

    if (unread === 0) {

        badge.style.display = "none";

    }

    else {

        badge.style.display = "flex";
        badge.textContent = unread;

    }

}

/* ══════════════════════════════════
   MOBILE NAV
══════════════════════════════════ */
function toggleMobileNav() {
  State.mobileNavOpen ? closeMobileNav() : openMobileNav();
}

function openMobileNav() {
  const nav  = document.getElementById('mobileNav');
  const icon = document.getElementById('hamburgerIcon');
  if (!nav) return;
  nav.classList.add('open');
  nav.setAttribute('aria-hidden', 'false');
  State.mobileNavOpen = true;
  if (icon) icon.innerHTML = `
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>`;
  document.body.style.overflow = 'hidden';
}

function closeMobileNav() {
  const nav  = document.getElementById('mobileNav');
  const icon = document.getElementById('hamburgerIcon');
  if (!nav) return;
  nav.classList.remove('open');
  nav.setAttribute('aria-hidden', 'true');
  State.mobileNavOpen = false;
  if (icon) icon.innerHTML = `
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>`;
  document.body.style.overflow = '';
}

/* ══════════════════════════════════
   MOBILE BOTTOM NAV
══════════════════════════════════ */
function setActiveMbn(id) {
  document.querySelectorAll('.mbn-item').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

/* ══════════════════════════════════
   BUTTON RIPPLE
══════════════════════════════════ */
function attachRipple(btn) {
  btn.addEventListener('click', function(e) {
    const r    = document.createElement('span');
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    r.className = 'ripple';
    r.style.cssText = `
      width:${size}px;height:${size}px;
      left:${e.clientX - rect.left - size / 2}px;
      top:${e.clientY - rect.top - size / 2}px;
    `;
    btn.appendChild(r);
    r.addEventListener('animationend', () => r.remove());
  });
}

function initRipples() {
  document.querySelectorAll('.btn').forEach(attachRipple);
}

/* ══════════════════════════════════
   TOAST
══════════════════════════════════ */
function showToast(message, type = 'info', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = icons[type] || icons.info;
  toast.appendChild(document.createTextNode(message));
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('exit');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

/* ══════════════════════════════════
   LOGOUT
══════════════════════════════════ */
function handleLogout() {
  openModal('modalLogout');
}

function closeLogoutModal(e) {
  if (e && e.target !== document.getElementById('modalLogout')) return;
  closeModal('modalLogout');
}

function confirmLogout() {
  closeModal('modalLogout');
  localStorage.removeItem("token");
  localStorage.removeItem("userId");
  localStorage.removeItem('userName');
  localStorage.removeItem('userEmail');
  showToast('Logging out…', 'info', 1200);
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 1300);
}

/* ══════════════════════════════════
   CREATE RIDE REQUEST PAGE
══════════════════════════════════ */
function initCreateForm() {
  // Set minimum date to today
  const dateInput = document.getElementById('crDate');
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    dateInput.value = today;
  }

  // Populate time select with :00, :15, :30, :45
  const timeSelect = document.getElementById('crTime');
  if (timeSelect && timeSelect.options.length <= 1) {
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 15, 30, 45]) {
        const hh  = String(h).padStart(2, '0');
        const mm  = String(m).padStart(2, '0');
        const val = `${hh}:${mm}`;
        const ampm = h < 12 ? 'AM' : 'PM';
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const label = `${String(h12).padStart(2, '0')}:${mm} ${ampm}`;
        const opt = new Option(label, val);
        timeSelect.appendChild(opt);
      }
    }
  }

  // Places autocomplete suggestions (simulated)
  initPlacesAutocomplete('crFrom');
  initPlacesAutocomplete('crTo');
}

/* Simulated Google Places autocomplete */
const PLACES = [
  'MIT BLR Campus',
  'Kempegowda International Airport',
  'Majestic (KSR Railway Station)',
  'Whitefield',
  'Electronic City',
  'Koramangala',
  'Indiranagar',
  'MG Road',
  'HSR Layout',
  'Bellandur',
  'Sarjapur Road',
  'Marathahalli',
  'Yelahanka',
  'Tumkur Road',
  'Silk Board',
  'Baglur Cross',
  'Church Street'
];

function initPlacesAutocomplete(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  // Remove old dropdown if any
  const old = document.getElementById(inputId + '-dropdown');
  if (old) old.remove();

  const dropdown = document.createElement('div');
  dropdown.id = inputId + '-dropdown';
  dropdown.style.cssText = `
    position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:400;
    background:rgba(8,16,32,.97);backdrop-filter:blur(24px);
    border:1px solid rgba(255,255,255,.15);border-radius:12px;
    overflow:hidden;display:none;
    box-shadow:0 16px 48px rgba(0,0,0,.5);
  `;
  input.parentElement.style.position = 'relative';
  input.parentElement.appendChild(dropdown);

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { dropdown.style.display = 'none'; return; }
    const matches = PLACES.filter(p => p.toLowerCase().includes(q)).slice(0, 6);
    if (!matches.length) { dropdown.style.display = 'none'; return; }

    dropdown.innerHTML = matches.map(p => `
      <div class="ac-item" style="
        padding:11px 16px;font-size:13.5px;cursor:pointer;
        transition:background .15s;display:flex;align-items:center;gap:10px;
        border-bottom:1px solid rgba(255,255,255,.05);color:#fff;
      " onmouseover="this.style.background='rgba(255,255,255,.06)'"
         onmouseout="this.style.background=''"
         onclick="selectPlace('${escapeHTML(inputId)}','${escapeHTML(p)}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z"/></svg>
        ${escapeHTML(p)}
      </div>
    `).join('');
    dropdown.style.display = 'block';
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

function selectPlace(inputId, value) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(inputId + '-dropdown');
  if (input) input.value = value;
  if (dropdown) dropdown.style.display = 'none';
}

function updateCounter(inputId, counterId) {
  const input   = document.getElementById(inputId);
  const counter = document.getElementById(counterId);
  if (input && counter) counter.textContent = input.value.length;
}
/*
function submitRideRequest() {
  const from  = (document.getElementById('crFrom')?.value || '').trim();
  const to    = (document.getElementById('crTo')?.value || '').trim();
  const date  = document.getElementById('crDate')?.value || '';
  const time  = document.getElementById('crTime')?.value || '';
  const notes = (document.getElementById('crNotes')?.value || '').trim();

  if (!from) { showToast('Please enter a starting point', 'error'); return; }
  if (!to)   { showToast('Please enter a destination',    'error'); return; }
  if (!date) { showToast('Please select a date',          'error'); return; }
  if (!time) { showToast('Please select a time',          'error'); return; }

  // Validate email domain conceptually — user is already logged in via OTP
  const newRequest = {
    id:     'r' + Date.now(),
    from, to, date, time,
    status: 'open',
    notes,
  };
  DB.requests.unshift(newRequest);

  showToast('Ride request posted successfully!', 'success');

  // Reset form
  document.getElementById('crFrom').value  = '';
  document.getElementById('crTo').value    = '';
  document.getElementById('crNotes').value = '';
  const counter = document.getElementById('crCounter');
  if (counter) counter.textContent = '0';

  // Navigate to my requests
  setTimeout(() => navigate('my-requests'), 800);
}
*/
let creatingRideRequest = false;
let updatingRideRequest = false;
async function createRideRequest() {
  console.log("BUTTON CLICKED");
  if (creatingRideRequest) return;

creatingRideRequest = true;

const submitBtn = document.querySelector("#page-create-request .btn-blue");
const originalBtnHTML = submitBtn.innerHTML;

submitBtn.disabled = true;
submitBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
    </svg>
    Posting...
`;
  const source  = (document.getElementById('crFrom')?.value || '').trim();
  const destination    = (document.getElementById('crTo')?.value || '').trim();
  const ride_date  = document.getElementById('crDate')?.value || '';
  const ride_time  = document.getElementById('crTime')?.value || '';
  const notes = (document.getElementById('crNotes')?.value || '').trim();
  if (editingRideRequest) {
    return updateRideRequest();
  }
  if (!source) { showToast('Please enter a starting point', 'error'); return; }
  if (!destination)   { showToast('Please enter a destination',    'error'); return; }
  if (!ride_date) { showToast('Please select a date',          'error'); return; }
  if (!ride_time) { showToast('Please select a time',          'error'); return; }
  if (source.toLowerCase() ===destination.toLowerCase()) {
    showToast("Source and destination cannot be the same","error");
    return;
  }
  const today =new Date().toISOString().split("T")[0];
  if (ride_date < today) {
    showToast("Cannot create rides for past dates",
        "error");
    return;
  }
  if (ride_date === today) {
    const now = new Date();
    const currentTime =String(now.getHours()).padStart(2, "0") +":" +String(now.getMinutes()).padStart(2, "0");
    if (ride_time <= currentTime) {
        showToast(
            "Please choose a future time",
            "error"
        );
        return;
    }
}
  console.log({
    source,
    destination,
    ride_date,
    ride_time,
    notes
  });
try{
    const response =
        await apiFetch(
            "https://rideshare-backend-uv0p.onrender.com/create-request",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    source,
                    destination,
                    ride_date,
                    ride_time,
                    notes
                })
            }
        );

    const data = await response.json();
    console.log("CREATE REQUEST RESPONSE:", data);
    if (!response.ok) {

    showToast(data.error || data.message, "error");
    return;

}

showToast(data.message, "success");

const newRequestId = data.request.id;
await loadMyRequests(newRequestId);
navigate("create-group");

}
catch(err){

    console.error(err);
    showToast("Unable to connect to server.","error");

}
finally{

    creatingRideRequest = false;

    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnHTML;

}
}
async function updateRideRequest() {
    if (updatingRideRequest) return;

    updatingRideRequest = true;
    const updateBtn = document.querySelector("#page-create-request .btn-blue");
const originalBtnHTML = updateBtn.innerHTML;

updateBtn.disabled = true;
updateBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
    </svg>
    Updating...
`;
    console.log("editingRequestId =", editingRequestId);
    try {

        const response = await apiFetch(`https://rideshare-backend-uv0p.onrender.com/ride-request/${editingRequestId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    source: document.getElementById("crFrom").value.trim(),
                    destination: document.getElementById("crTo").value.trim(),
                    ride_date: document.getElementById("crDate").value,
                    ride_time: document.getElementById("crTime").value,
                    notes: document.getElementById("crNotes").value.trim()
                })
            }
        );
        

        const data = await response.json();

console.log("SERVER RESPONSE:", data);

if (!response.ok) {
    throw new Error(JSON.stringify(data));
}

        showToast("Ride request updated successfully.", "success");
        const updatedRequestId = editingRequestId;
        editingRideRequest = false;
        editingRequestId = null;

        document.querySelector(
            "#page-create-request .page-title"
        ).textContent = "Create Ride Request";

        document.querySelector(
            "#page-create-request .btn-blue"
        ).innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            Post Request
        `;
        await loadMyRequests(updatedRequestId);

        const updated = myRequests.find(
    r => r.id === updatedRequestId
);

if (updated) {

    selectedRequest = updated;

    renderSelectedRequest();

    renderRequestDropdown();

}
navigate("create-group");

    } catch (err) {
        showToast(err.message, "error");
    }
    finally {

    updatingRideRequest = false;

    updateBtn.disabled = false;

    updateBtn.innerHTML = originalBtnHTML;

}
}

/* ══════════════════════════════════
   MY RIDE REQUESTS — MOCK DATA
   (Replace with Supabase calls later)
══════════════════════════════════ */

/* live copies — JS can mutate these; backend will replace them */
let liveInvitations = [];
let liveActiveRequests = [];
let liveHistory = [];
/* which request the delete modal is targeting */
let _deleteTargetId   = null;
/* which group the leave/whatsapp modal is targeting */
let _leaveTargetId    = null;
let _waTargetGroupId  = null;

/* ── Segmented control switch ── */
let mrActiveTab = 'active';
async function loadMyRideRequests() {


    const response = await apiFetch(
        `https://rideshare-backend-uv0p.onrender.com/my-ride-requests`
    );
    if (!response.ok) {
      showToast("Failed to load ride requests","error");
      return;
    }
    const data = await response.json();
    console.log(data.invitations);
    if (!response.ok) {

        showToast(data.error, "error");
        return;

    }

    /* Pending Invitations */

    liveInvitations = data.invitations.map(inv => ({

        id: inv.id,
        groupId: inv.group_id,
        senderName: inv.sender_request.users.name,

        senderInitials: inv.sender_request.users.name
            .split(" ")
            .map(x => x[0])
            .join("")
            .substring(0,2)
            .toUpperCase(),

        senderColor: "#2563EB",

        from: inv.sender_request.source,

        to: inv.sender_request.destination,

        date: inv.sender_request.ride_date,

        time: inv.sender_request.ride_time,

        seats: inv.ride_groups.max_members,

        _state: "idle"

    }));


    /* Active Requests */

    liveActiveRequests = data.requests.map(r => ({

        id: r.id,

        from: r.source,

        to: r.destination,

        date: r.ride_date,

        time: r.ride_time,

        max_members: r.ride_groups?.max_members || 4,

        groupStatus: r.groupStatus,

        outgoingInvites: r.outgoingInvites || [],

        groupSummary: r.groupSummary

    }));


    /* History */

    liveHistory = (data.history || []).map(h => ({
    id: h.id,
    from: h.from,
    to: h.to,
    date: h.date,
    time: h.time,
    completedAt: h.completedAt,
    rideType: h.rideType,
    members: h.members || [],
    max_members: h.max_members || 1
}));

    renderRequests();

}
function switchMrTab(tab, btn) {
  mrActiveTab = tab;
  document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('mrTabActive').style.display  = tab === 'active'  ? 'block' : 'none';
  document.getElementById('mrTabHistory').style.display = tab === 'history' ? 'block' : 'none';
}

/* ── Main render entry point (called by router) ── */
function renderRequests() {
  renderInvitations();
  renderActiveRequests();
  renderHistory();
}

/* ── Pending Invitations ── */
function renderInvitations() {
  const list    = document.getElementById('invitationsList');
  const countEl = document.getElementById('invitationCount');
  if (!list) return;

  const active = liveInvitations.filter(i => i._state === 'idle');
  if (countEl) countEl.textContent = active.length;

  if (!active.length) {
    list.innerHTML = `<div class="mr-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.07 12 19.79 19.79 0 0 1 1 3.18 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>
      <p>No pending invitations</p>
    </div>`;
    return;
  }

  const arrowSvg   = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
  const calSvg     = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const clockSvg   = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const peopleSvg  = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`;

  list.innerHTML = active.map(inv => `
    <div class="inv-card" id="inv-${inv.id}">
      <div class="inv-card-top">
        <div class="inv-sender-av" style="background:${inv.senderColor}">${inv.senderInitials}</div>
        <div class="inv-info">
          <div class="inv-sender-name">${escapeHTML(inv.senderName)} invited you</div>
          <div class="inv-route">
            <span class="inv-from">${escapeHTML(inv.from)}</span>
            ${arrowSvg}
            <span>${escapeHTML(inv.to)}</span>
          </div>
          <div class="inv-meta">
            <span>${calSvg} ${formatDateLabel(inv.date)}</span>
            <span>${clockSvg} ${formatTime(inv.time)}</span>
            <span>${peopleSvg} ${inv.seats} seats</span>
          </div>
        </div>
        <div class="inv-badge-wrap">
          <span class="badge badge-amber">● Pending</span>
        </div>
      </div>
      <div class="inv-actions">
        <button class="btn-accept" id="acc-${inv.id}" onclick="acceptInvitation('${inv.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Accept
        </button>
        <button class="btn-reject" id="rej-${inv.id}" onclick="rejectInvitation('${inv.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Reject
        </button>
      </div>
    </div>`).join('');
}

async function acceptInvitation(id) {

    const inv = liveInvitations.find(i => i.id === id);

    if (!inv) return;

    console.log(inv);
    console.log({
    groupId: inv.groupId
});
    const response = await apiFetch(
        "https://rideshare-backend-uv0p.onrender.com/accept-invitation",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
              groupId: inv.groupId
            })

        }
    );

    const data = await response.json();

    if (!response.ok) {

        showToast(data.message || "Failed", "error");

        return;

    }

    showToast("Invitation accepted!", "success");

    await loadNotifications();

    await loadMyRideRequests();
    await loadActiveGroups();

}

async function rejectInvitation(id) {

    const inv = liveInvitations.find(i => i.id === id);

    if (!inv) return;
    try {

        const response = await apiFetch(
            "https://rideshare-backend-uv0p.onrender.com/reject-invitation",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    groupId: inv.groupId
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            showToast(data.message || "Failed to reject invitation.", "error");
            return;
        }

        showToast("Invitation rejected.", "success");
        await loadNotifications();
        await loadMyRideRequests();
        await loadMatchingGroups(selectedRequest.id);
    }

    catch (err) {

        console.error(err);

        showToast("Server error.", "error");

    }

}

async function handleCancelInvitation(groupId, invitationId) {

    try {

        const response = await apiFetch(
            "https://rideshare-backend-uv0p.onrender.com/cancel-invitation",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({

                    invitationId
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {

            showToast(
                data.message || "Failed to cancel invitation.",
                "error"
            );

            return;

        }

        showToast(
            data.message || "Invitation cancelled.",
            "success"
        );

        await loadNotifications();
        await loadActiveGroups();
        await loadMyRideRequests();
    }

    catch (err) {

        console.error(err);

        showToast(
            "Server Error",
            "error"
        );

    }

}

/* ── Active ride requests ── */
function renderActiveRequests() {
  const list    = document.getElementById('activeRequestsList');
  const countEl = document.getElementById('activeReqCount');
  if (!list) return;
  if (countEl) countEl.textContent = liveActiveRequests.length;

  if (!liveActiveRequests.length) {
    list.innerHTML = `<div class="mr-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z"/></svg>
      <p>No active ride requests</p>
    </div>`;
    return;
  }

  const arrowSvg  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
  const calSvg    = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const clockSvg  = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const peopleSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  const trashSvg  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`;
  const chevronSvg= `<svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

  const outgoingStatusMap = {
    pending:  { cls: 'badge-status-pending',  label: 'Pending'  },
    accepted: { cls: 'badge-status-accepted', label: 'Accepted' },
    rejected: { cls: 'badge-status-rejected', label: 'Rejected' },
    expired:  { cls: 'badge-status-expired',  label: 'Expired'  },
  };

  list.innerHTML = liveActiveRequests.map(r => {
    /* ── right-side badge markup depends on status ── */
    let badgeHtml;
    if (r.groupStatus === 'pending') {
      const pendingCount = (r.outgoingInvites || []).filter(o => o.status === 'pending').length;
      badgeHtml = `
        <button class="arc-badge-toggle" id="arc-toggle-${r.id}" onclick="toggleOutgoingPanel('${r.id}')">
          🟡 Requests Pending (${pendingCount}) ${chevronSvg}
        </button>`;
    } else if (r.groupStatus === 'looking') {
      badgeHtml = `<span class="badge badge-looking arc-status-badge">🟢 Looking for Group</span>`;
    } else {
      badgeHtml = `<span class="badge badge-ingroup arc-status-badge">🔵 In Active Group</span>`;
    }

    /* ── expandable outgoing invitations panel (pending only) ── */
    let expandPanelHtml = '';
    if (r.groupStatus === 'pending' && r.outgoingInvites?.length) {
      const itemsHtml = r.outgoingInvites.map(o => {
        const cfg = outgoingStatusMap[o.status] || outgoingStatusMap.pending;
        return `
          <div class="arc-outgoing-item">
            <div class="arc-outgoing-av" style="background:${o.color}">${escapeHTML(o.initials)}</div>
            <span class="arc-outgoing-name">${escapeHTML(o.name)}</span>
            <span class="badge ${cfg.cls}">${cfg.label}</span>
          </div>`;
      }).join('');
      expandPanelHtml = `
        <div class="arc-expand-panel" id="arc-expand-${r.id}" style="display:none">
          <div class="arc-expand-title">Outgoing Invitations</div>
          <div class="arc-outgoing-list">${itemsHtml}</div>
        </div>`;
    }

    /* ── compact "Current Group" summary row (ingroup only) ── */
    let groupSummaryHtml = '';
    if (r.groupStatus === 'ingroup' && r.groupSummary) {
      groupSummaryHtml = `
        <div class="arc-group-summary-row">
          <div class="arc-group-summary-left">
            ${peopleSvg}
            <span><strong>${r.groupSummary.currentMembers}</strong> / ${r.groupSummary.max_members} Members</span>
          </div>
          <button class="btn-open-active-group" onclick="navigate('active-groups')">
            Open Active Group
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>`;
    }

    return `
      <div class="arc-card">
        <div class="arc-card-row">
          <div class="arc-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z"/></svg>
          </div>
          <div class="arc-body">
            <div class="arc-route">
              ${escapeHTML(r.from)} ${arrowSvg} <span class="arc-to">${escapeHTML(r.to)}</span>
            </div>
            <div class="arc-meta">
              <span>${calSvg} ${formatDateLabel(r.date)}</span>
              <span>${clockSvg} ${formatTime(r.time)}</span>
              <span>${peopleSvg} Max ${r.max_members} members</span>
            </div>
          </div>
          <div class="arc-right">
            ${badgeHtml}
            <button class="btn-delete-req" onclick="openDeleteModal('${r.id}')">
              ${trashSvg} Delete Ride Request
            </button>
          </div>
        </div>
        ${expandPanelHtml}
        ${groupSummaryHtml}
      </div>`;
  }).join('');
}

/* ── Toggle the Outgoing Invitations panel for a pending request ── */
function toggleOutgoingPanel(requestId) {
  const panel = document.getElementById('arc-expand-' + requestId);
  const btn   = document.getElementById('arc-toggle-' + requestId);
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (btn) btn.classList.toggle('open', !isOpen);
}

/* ── Ride history ── */

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;

  if (!liveHistory.length) {
    list.innerHTML = `<div class="mr-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/></svg>
      <p>No completed rides yet</p>
    </div>`;
    return;
  }

  const arrowSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
  const calSvg   = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const clockSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const peopleSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`;

  list.innerHTML = liveHistory.map(h => {
    const membersHtml = (h.members || []).map(m =>
      `<div class="hist-member-av" style="background:${m.color}" title="${escapeHTML(m.initials)}">${escapeHTML(m.initials)}</div>`
    ).join('');

    const rideTypeLabel = h.rideType === 'group' ? 'Group Ride' : 'Solo Ride';
    const completedLabel = h.completedAt
      ? new Date(h.completedAt).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit'
        })
      : 'Completed';

    return `
      <div class="hist-card">
        <div class="hist-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>

        <div class="hist-body">
          <div class="hist-route">
            ${escapeHTML(h.from)} ${arrowSvg} <span class="hist-to">${escapeHTML(h.to)}</span>
          </div>
          <div class="hist-meta">
            <span>${calSvg} ${formatDateLabel(h.date)}</span>
            <span>${clockSvg} ${formatTime(h.time)}</span>
            <span>${peopleSvg} ${rideTypeLabel}</span>
          </div>
          <div class="hist-meta" style="margin-top:6px;opacity:.85">
            <span>Finished: ${completedLabel}</span>
          </div>
        </div>

        <div class="hist-right">
          <span class="badge badge-green">✓ Completed</span>
          <div class="hist-members">${membersHtml}</div>
        </div>
      </div>`;
  }).join('');
}

/*
function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;

  if (!liveHistory.length) {
    list.innerHTML = `<div class="mr-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/></svg>
      <p>No completed rides yet</p>
    </div>`;
    return;
  }

  const arrowSvg  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
  const calSvg    = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const clockSvg  = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

  list.innerHTML = liveHistory.map(h => {
    const membersHtml = h.members.map(m =>
      `<div class="hist-member-av" style="background:${m.color}" title="${escapeHTML(m.initials)}">${escapeHTML(m.initials)}</div>`
    ).join('');
    return `
      <div class="hist-card">
        <div class="hist-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="hist-body">
          <div class="hist-route">
            ${escapeHTML(h.from)} ${arrowSvg} <span class="hist-to">${escapeHTML(h.to)}</span>
          </div>
          <div class="hist-meta">
            <span>${calSvg} ${formatDateLabel(h.date)}</span>
            <span>${clockSvg} ${formatTime(h.time)}</span>
          </div>
        </div>
        <div class="hist-right">
          <span class="badge badge-green">✓ Completed</span>
          <div class="hist-members">${membersHtml}</div>
        </div>
      </div>`;
  }).join('');
}
*/

/* ── Delete modal ── */
function openDeleteModal(requestId) {
  _deleteTargetId = requestId;
  const req = liveActiveRequests.find(r => r.id === requestId);
  if (!req) return;

  const titleEl   = document.getElementById('deleteModalTitle');
  const msgEl     = document.getElementById('deleteModalMsg');
  const confirmEl = document.getElementById('deleteModalConfirmBtn');

  const msgs = {
    looking: {
      title: 'Delete Ride Request',
      msg:   'This ride request has not been grouped yet.\n\nAre you sure you want to delete it?',
      btn:   'Delete',
    },
    pending: {
      title: 'Delete Ride Request',
      msg:   'Deleting this ride request will cancel all pending invitations sent and received.\n\nContinue?',
      btn:   'Delete',
    },
    ingroup: {
      title: 'Leave Group & Delete',
      msg:   'You are currently part of an active ride group.\n\nDeleting this ride request will remove you from the group.\n\nContinue?',
      btn:   'Leave Group & Delete',
    },
  };

  const cfg = msgs[req.groupStatus] || msgs.looking;
  if (titleEl)   titleEl.textContent   = cfg.title;
  if (msgEl)     msgEl.textContent     = cfg.msg;
  if (confirmEl) confirmEl.textContent = cfg.btn;

  openModal('modalDeleteRequest');
}

function closeDeleteModal(e) {
  if (e && e.target !== document.getElementById('modalDeleteRequest')) return;
  closeModal('modalDeleteRequest');
  _deleteTargetId = null;
}

async function confirmDeleteRequest() {

    try {

        const response = await apiFetch(
            `https://rideshare-backend-uv0p.onrender.com/ride-request/${editingRequestId}`,
            {
                method: "DELETE"
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Failed to delete ride request.");
        }

        // Remove from frontend only AFTER backend succeeds
        liveActiveRequests = liveActiveRequests.filter(
            r => r.id !== _deleteTargetId
        );

        closeModal('modalDeleteRequest');
        _deleteTargetId = null;

        renderActiveRequests();

        showToast(result.message, "success");
        await loadNotifications();

    } catch (err) {

        console.error(err);

        showToast(err.message, "error");

    }

}

/* stubs kept for backwards compatibility */
function filterRequests(status, btn) { /* old filter removed — no-op */ }
function searchRequests(q) { /* old search removed — no-op */ }

/* ══════════════════════════════════
   ACTIVE GROUPS — MOCK DATA
   (Replace with Supabase calls later)
══════════════════════════════════ */
/*
const MOCK_GROUPS = [
  {
    id: 'ag1',
    from: 'MIT BLR', to: 'Kempegowda Airport',
    date: '2025-06-24', time: '17:30',
    max_members: 4,
    waLink: '',
    members: [
      { id: 'me',  name: 'Kushal M.',  initials: 'KM', color: '#2563EB', isCreator: true,  isMe: true  },
      { id: 'rs',  name: 'Rahul S.',   initials: 'RS', color: '#D97706', isCreator: false, isMe: false },
    ],
  },
  {
    id: 'ag2',
    from: 'MIT BLR', to: 'Whitefield',
    date: '2025-06-25', time: '08:00',
    max_members: 3,
    waLink: 'https://chat.whatsapp.com/example123',
    members: [
      { id: 'sb',  name: 'Siddharth B.', initials: 'SB', color: '#DC2626', isCreator: true,  isMe: false },
      { id: 'me2', name: 'Kushal M.',     initials: 'KM', color: '#2563EB', isCreator: false, isMe: true  },
      { id: 'pm',  name: 'Priya M.',      initials: 'PM', color: '#0891B2', isCreator: false, isMe: false },
    ],
  },
];
*/

/* live copy of groups */
let liveGroups = [];
async function loadActiveGroups() {
    const userId = localStorage.getItem("userId");
    try {

        const response = await apiFetch(
            `https://rideshare-backend-uv0p.onrender.com/active-groups`
        );

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || "Failed to load active groups", "error");
            return;
        }
      liveGroups = data.map(group => ({

    id: group.groupId,

    groupId: group.groupId,

    rideRequestId: group.rideRequestId,

    creatorRideRequestId: group.creatorRideRequestId,

    from: group.source,

    to: group.destination,

    date: group.ride_date,

    time: group.ride_time,

    max_members: group.max_members,

    currentMembers: group.currentMembers,

    availableSeats: group.availableSeats,

    waLink: group.whatsappLink || "",

    creatorId: group.creatorId,

    members: group.members.map(member => ({

        id: member.user_id,

        name: member.name,

        initials: member.name
            .split(" ")
            .map(x => x[0])
            .join("")
            .substring(0,2)
            .toUpperCase(),

        color:
            "#" +
            Math.floor(Math.random()*16777215)
                .toString(16)
                .padStart(6,"0"),

        isCreator: member.user_id === group.creatorId,

        isMe: member.user_id === userId

    }))
    ,

        joinRequests: group.joinRequests.map(r => ({

            id: r.id,

            userId: r.userId,

            requestId: r.requestId,

            name: r.name,
            initials: r.name
                .split(" ")
                .map(x=>x[0])
                .join("")
                .substring(0,2)
                .toUpperCase(),

            color:"#2563EB"

        })),
        pendingInvitations: group.pendingInvitations.map(i => ({

          id:i.id,

          userId:i.userId,

          requestId:i.requestId,

          name:i.name,

          initials:i.name
              .split(" ")
              .map(x=>x[0])
              .join("")
              .substring(0,2)
              .toUpperCase(),

          color:"#7C3AED",

          status:i.status

      })),

      }));

        renderGroups();

    } catch (err) {

        console.error(err);

        showToast("Server Error","error");

    }

}

/* ── Render active groups ── */
function renderGroups() {
  const list = document.getElementById('activeGroupsList');
  if (!list) return;

  if (!liveGroups.length) {
    list.innerHTML = `<div class="mr-empty" style="padding:60px 20px">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      <p>No active groups</p>
      <span style="font-size:12px">Create or join a group from the Create Share Group page</span>
    </div>`;
    return;
  }

  const arrowSvg   = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
  const calSvg     = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const clockSvg   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const peopleSvg  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  const chatSvg    = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
  const leaveSvg   = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
  const inviteSvg  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

  const chevronSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  const acceptSvg  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const rejectSvg  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  list.innerHTML = liveGroups.map(g => {
    const seats = Math.max(0, g.max_members - g.members.length);
    const isFull   = seats <= 0;

    // Use group.availableSeats when provided by backend, otherwise fall back
    // to the computed seat count so behaviour is unchanged when the field is absent.
    const availableSeats = (typeof g.availableSeats === 'number') ? g.availableSeats : seats;

    const membersGridClass = g.members.length >= 3 ? ' ag-members-grid' : '';
    const membersHtml = g.members.map(m => `
      <div class="ag-member-row">
        <div class="ag-member-av" style="background:${m.color}">${escapeHTML(m.initials)}</div>
        <div class="ag-member-info">
          <div class="ag-member-name">
            ${escapeHTML(m.name)}
            ${m.isMe ? `<span style="font-size:10.5px;color:var(--muted);font-weight:500">(You)</span>` : ''}
            ${m.isCreator ? `<span class="ag-creator-badge">Creator</span>` : ''}
          </div>
        </div>
      </div>`).join('');

    // Join Requests — only render when data exists (no placeholder data)
    const joinRequests = g.joinRequests || [];
    const joinRequestsHtml = joinRequests.length ? `
          <div class="ag-divider"></div>
          <div class="ag-subsection-title">Join Requests (${joinRequests.length})</div>
          <div class="ag-request-list">
            ${joinRequests.map(r => `
              <div class="ag-request-row">
                <div class="ag-member-av" style="background:${r.color || '#2563EB'}">${r.initials || (r.name ? r.name.substring(0,2).toUpperCase() : '?')}</div>
                <div class="ag-request-name">${escapeHTML(r.name) || 'Unknown Student'}${r.requestedAt ? `<div class="ag-pending-status">Requested ${r.requestedAt}</div>` : ''}</div>
                <div class="ag-request-actions">
                  <button class="btn-reject-sm" onclick="handleRejectJoinRequest('${g.id}','${r.id}')">${rejectSvg} Reject</button>
                  <button class="btn-accept-sm" onclick="handleAcceptJoinRequest('${g.id}','${r.id}')">${acceptSvg} Accept</button>
                </div>
              </div>`).join('')}
          </div>` : '';

    // Pending Invitations — only render when data exists (no placeholder data)
    const pendingInvitations = g.pendingInvitations || [];
    const pendingInvitationsHtml = pendingInvitations.length ? `
          <div class="ag-divider"></div>
          <div class="ag-subsection-title">Pending Invitations (${pendingInvitations.length})</div>
          <div class="ag-pending-list">
            ${pendingInvitations.map(p => `
              <div class="ag-pending-row">
                <div class="ag-member-av" style="background:${p.color || '#7C3AED'}">${p.initials || (p.name ? p.name.substring(0,2).toUpperCase() : '?')}</div>
                <div class="ag-pending-name">${escapeHTML(p.name) || 'Unknown Student'}</div>
                <div class="ag-pending-status">${escapeHTML(p.status) || 'Pending'}</div>
                <div class="ag-request-actions">
                  <button class="btn-cancel-invite" onclick="handleCancelInvitation('${g.id}','${p.id}')">${rejectSvg} Cancel Invitation</button>
                </div>
              </div>`).join('')}
          </div>` : '';

    return `
      <div class="ag-container" id="agc-${g.id}">
        <div class="ag-container-inner">
          <div class="ag-accent"></div>

          <!-- Header -->
          <div class="ag-header">
            <div class="ag-header-left">
              <div class="ag-route">
                ${escapeHTML(g.from)} <span style="color:var(--sky)">${arrowSvg}</span>
                <span class="ag-to">${escapeHTML(g.to)}</span>
              </div>
              <div class="ag-meta">
                <span>${calSvg} ${formatDateLabel(g.date)}</span>
                <span>${clockSvg} ${formatTime(g.time)}</span>
                <span>${peopleSvg} ${g.members.length} / ${g.max_members} members</span>
              </div>
            </div>
            <div class="ag-header-right">
              <div class="ag-badges">
                <span class="badge badge-green">● Active</span>
                <div class="ag-seats-pill">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  ${isFull ? 'Full' : `${availableSeats} seat${availableSeats !== 1 ? 's' : ''} left`}
                </div>
              </div>
              <button class="ag-collapse-btn" onclick="toggleGroupCollapse('${g.id}')" aria-label="Collapse group">
                ${chevronSvg}
              </button>
            </div>
          </div>

          <div class="ag-body">
            <div class="ag-divider"></div>

            <!-- Members -->
            <div class="ag-members-title">Members</div>
            <div class="ag-members-list${membersGridClass}">
              ${membersHtml}
            </div>

            ${joinRequestsHtml}
            ${pendingInvitationsHtml}

            ${availableSeats > 0 ? `
            <div class="ag-divider"></div>

            <!-- Seats Available section -->
            <div class="ag-seats-section">
              <div class="ag-seats-info">
                <div class="ag-seats-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div>
                  <div class="ag-seats-title">${availableSeats} Seat${availableSeats !== 1 ? 's' : ''} Available</div>
                  <div class="ag-seats-sub">Invite up to ${availableSeats} more member${availableSeats !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <button class="btn-invite" onclick="inviteMembers('${g.id}')">
                ${inviteSvg} Invite Members
              </button>
            </div>` : ''}

            <div class="ag-divider"></div>

            <!-- Actions -->
            <div class="ag-actions">
              <button class="btn-chat" onclick="openWhatsappModal('${g.id}')">
                ${chatSvg} Group Chat
              </button>
              <button class="btn-leave" onclick="openLeaveModal('${g.id}')">
                ${leaveSvg} Leave Group
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}
function toggleGroupCollapse(groupId) {
  const el = document.getElementById('agc-' + groupId);
  if (!el) return;
  el.classList.toggle('is-collapsed');
}
function inviteMembers(groupId) {

    const group = liveGroups.find(g => g.id === groupId);
    
    if (!group) {

        showToast("Group not found", "error");

        return;

    }
    
    inviteExistingGroup = {

        groupId: group.groupId,

        max_members: group.max_members,

        rideRequestId: group.rideRequestId

    };
    const rideRequestId = group.rideRequestId;
    _chosenGroupSize = group.max_members;
/*
selectedRequest = myRequests.find(
    r => r.id === group.rideRequestId
);

if (!selectedRequest) {

    selectedRequest = {
        id: group.rideRequestId
    };

}
    */
    inviteMode = true;
    setTimeout(() => {

    const btn = document.getElementById("editRequestBtn");

    if (btn) {

        btn.disabled = true;

        btn.style.opacity = "0.5";

        btn.style.cursor = "not-allowed";

    }

}, 50);
    navigate("create-group");
/*
    renderSelectedRequest();
    renderRequestDropdown();
*/
    showToast('Select students to invite to your group', 'info');
    loadMatchingStudents();

}
/* stubs kept for backwards compat */
function filterGroups(type, btn) { /* old tabs removed */ }
function openGroup(groupId)       { /* no-op */ }


/* ── Leave group modal ── */
function openLeaveModal(groupId) {
  _leaveTargetId = groupId;
  openModal('modalLeaveGroup');
}
function closeLeaveModal(e) {
  if (e && e.target !== document.getElementById('modalLeaveGroup')) return;
  closeModal('modalLeaveGroup');
  _leaveTargetId = null;
}
async function confirmLeaveGroup() {
    try {

        const response = await apiFetch(
            "https://rideshare-backend-uv0p.onrender.com/leave-group",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    groupId: _leaveTargetId
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            showToast(data.message || "Failed to leave group", "error");
            return;
        }

        closeModal("modalLeaveGroup");
        _leaveTargetId = null;
        
        await loadNotifications();

        await loadActiveGroups();
        await loadMyRideRequests();

        showToast(data.message, "success");

    }
    catch(err){

        console.error(err);
        showToast("Server Error","error");

    }

}

async function handleAcceptJoinRequest(groupId, requestId) {

    try {

        const response = await apiFetch(
            "https://rideshare-backend-uv0p.onrender.com/accept-join-request",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    requestId                    
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            showToast(
                data.message || "Failed to accept request.",
                "error"
            );
            return;
        }

        showToast(
            data.message || "Join request accepted.",
            "success"
        );

        await loadActiveGroups();
        await loadMyRideRequests();
        await loadNotifications();
        if (selectedRequest?.id) {
    await loadMatchingGroups(selectedRequest.id);
}

    }

    catch (err) {

        console.error(err);

        showToast(
            "Server Error",
            "error"
        );

    }

}

async function handleRejectJoinRequest(groupId, requestId) {

    try {

        const response = await apiFetch(
            "https://rideshare-backend-uv0p.onrender.com/reject-join-request",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    requestId
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {

            showToast(
                data.message || "Failed to reject request.",
                "error"
            );

            return;

        }

        showToast(
            data.message || "Join request rejected.",
            "success"
        );

        await loadActiveGroups();
        await loadMyRideRequests();
        await loadNotifications();
        await loadMatchingGroups(selectedRequest.id);

    }

    catch (err) {

        console.error(err);

        showToast(
            "Server Error",
            "error"
        );

    }

}

/* ── WhatsApp modal ── */
function openWhatsappModal(groupId) {
  _waTargetGroupId = groupId;
  const group      = liveGroups.find(g => g.id === groupId);
  if (!group) return;

  const input  = document.getElementById('waLinkInput');
  const btnEl  = document.getElementById('waSubmitBtn');
  if (input) input.value = group.waLink || '';
  if (btnEl) btnEl.textContent = group.waLink ? 'Update Link' : 'Add Link';

  openModal('modalWhatsapp');
}
function closeWhatsappModal(e) {
  if (e && e.target !== document.getElementById('modalWhatsapp')) return;
  closeModal('modalWhatsapp');
  _waTargetGroupId = null;
}
async function saveWhatsappLink() {

    const input =document.getElementById("waLinkInput");
    const groupId = _waTargetGroupId;
    if (!input) return;

    const whatsappLink = input.value.trim();

    if (!whatsappLink) {

        showToast(
            "Please enter a WhatsApp link.",
            "error"
        );

        return;

    }

    try {

        const response = await apiFetch(
            "https://rideshare-backend-uv0p.onrender.com/group-whatsapp",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    groupId,
                    whatsappLink

                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {

            showToast(
                data.message || "Failed to save WhatsApp link.",
                "error"
            );

            return;

        }

        showToast(
            "WhatsApp link updated successfully.",
            "success"
        );

        await loadActiveGroups();

    }

    catch (err) {

        console.error(err);

        showToast(
            "Server Error",
            "error"
        );

    }

}


/* ══════════════════════════════════
   CREATE SHARE GROUP — DATA LAYER
   Replace DB.matchingStudents with these module-level variables.
   Backend will populate them via loadMyRequests() and loadMatchingStudents().
══════════════════════════════════ */
 
/**
 * The request currently selected on the Create Share Group page.
 * Shape mirrors a DB.requests entry so renderSelectedRequest() can read it.
 */
let editingRideRequest = false;
let editingRequestId = null;
let selectedRequest = {
  id:          '',
  source:      '',
  destination: '',
  ride_date:   '',
  ride_time:   '',
};
 
/**
 * All open ride requests belonging to the current user.
 * Populated by loadMyRequests().
 * Each entry must have: { id, source, destination, ride_date, ride_time }
 */
let myRequests = [];
 
/**
 * Students that match the currently selected request.
 * Populated by loadMatchingStudents(requestId).
 * Each entry must have: { id, name, initials, color, time, notes, selected }
 */
let matchingStudents = [];
let matchingGroups   = []; // existing groups looking for members on same route

/* ride request status for the status bar:
   'looking' | 'pending' | 'active' | 'done'
*/
let cgRequestStatus = 'looking';
let currentGroupId = null;
/* which group the join-modal is targeting */
let _joinTargetGroupId = null;
/* chosen group size in the size modal */
let _chosenGroupSize = 4;
 
/* ── Backend stubs ─────────────────────────────── */
 
/**
 * loadMyRequests()
 * Called when the Create Share Group page opens.
 * TODO: Replace the body with a Supabase apiFetch:
 *   const { data } = await supabase
 *     .from('ride_requests')
 *     .select('*')
 *     .eq('user_id', currentUserId)
 *     .eq('status', 'open');
 *   myRequests = data.map(r => ({ id: r.id, source: r.source, ... }));
 *   selectRequest(myRequests[0].id);
 */
function editSelectedRequest() {
  if (
    cgRequestStatus === "pending" ||
    cgRequestStatus === "active"
) {

    showToast(
        "Leave your group before editing this ride request.",
        "error"
    );

    return;
}

    if (!selectedRequest || !selectedRequest.id) {
        showToast("Please create or select a ride request first.", "error");
        return;
    }

    editingRideRequest = true;
    editingRequestId = selectedRequest.id;

    navigate("create-request");

    document.getElementById("crFrom").value = selectedRequest.source;
    document.getElementById("crTo").value = selectedRequest.destination;
    document.getElementById("crDate").value = selectedRequest.ride_date;
    document.getElementById("crTime").value = selectedRequest.ride_time;
    document.getElementById("crNotes").value = selectedRequest.notes || "";

    updateCounter("crNotes", "crCounter");

    document.querySelector(
        "#page-create-request .page-title"
    ).textContent = "Edit Ride Request";

    document.querySelector(
        "#page-create-request .btn-blue"
    ).innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
        Save Changes
    `;
}
async function loadMyRequests(preferredId = null) {
  const response = await apiFetch("https://rideshare-backend-uv0p.onrender.com/my-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: null
  });

  const data = await response.json();
  if (!response.ok) {
    showToast(data.message || "Failed to load requests", "error");
    return;
  }

  myRequests = data;
  renderRequests();

  if (preferredId) {
    const exists = myRequests.find(r => r.id === preferredId);
    if (exists) selectRequest(preferredId);
    else if (myRequests[0]) selectRequest(myRequests[0].id);
  } else if (!selectedRequest?.id && myRequests[0]) {
    selectRequest(myRequests[0].id);
  }
}
 
/**
 * loadMatchingStudents(requestId)
 * Called whenever the user picks a different request from the dropdown.
 * TODO: Replace the body with a Supabase apiFetch:
 *   const req = myRequests.find(r => r.id === requestId);
 *   const { data } = await supabase
 *     .from('ride_requests')
 *     .select('*, users(name)')
 *     .neq('user_id', currentUserId)
 *     .eq('source', req.source)
 *     .eq('destination', req.destination)
 *     .gte('ride_time', subtractMinutes(req.ride_time, 15))
 *     .lte('ride_time', addMinutes(req.ride_time, 15));
 *   matchingStudents = data.map(r => ({ id: r.id, name: r.users.name, ... }));
 *   renderMatchingStudents();
 */
async function loadMatchingStudents(requestId) {

    const req = myRequests.find(r => r.id === requestId);

    if (!req) return;

    const response = await apiFetch("https://rideshare-backend-uv0p.onrender.com/matching-students", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
        currentRideRequestId: req.id,
        source: req.source,
        destination: req.destination,
        ride_date: req.ride_date,
        ride_time: req.ride_time
    })
    });

    const data = await response.json();
    console.log(data);
    if (!response.ok) {
        console.error(data);
        showToast("Failed to load matching students", "error");
        return;
    }

    matchingStudents = data.map(student => ({
    id: student.id,               // ← ADD THIS
    request_id: student.id,
    user_id: student.user_id,
        name: student.name,
        initials: student.name
            .split(" ")
            .map(word => word[0])
            .join("")
            .substring(0, 2)
            .toUpperCase(),
        color: "#" + Math.floor(Math.random() * 16777215).toString(16),
        time: student.ride_time,
        notes: student.notes || "",
        selected: false
    }));

    renderMatchingStudents();
}
async function loadMatchingGroups(requestId) {

    const req = myRequests.find(r => r.id === requestId);

    if(!req) return;

    const response = await apiFetch("https://rideshare-backend-uv0p.onrender.com/matching-groups",{
        method:"POST",
        headers:{
            "Content-Type":"application/json"
        },
        body: JSON.stringify({
            source: req.source,
            destination: req.destination,
            ride_date: req.ride_date,
            ride_time: req.ride_time,
            currentRideRequestId: req.id
        })
    });

    const data=await response.json();

    if(!response.ok){
        showToast("Failed to load matching groups","error");
        return;
    }

    matchingGroups = data.map(group => ({

    id: group.id,

    route: group.route,

    time: group.time,

    leader: {
        name: group.leader,
        initials: group.leader
            .split(" ")
            .map(x => x[0])
            .join("")
            .substring(0,2)
            .toUpperCase(),
        color: "#2563EB"
    },

    members: group.members.map(member => ({
        initials: member.name
            .split(" ")
            .map(x=>x[0])
            .join("")
            .substring(0,2)
            .toUpperCase(),
        color:"#60A5FA"
    })),

    max_members: group.max_members,

    seatsLeft: group.seatsLeft,

    isCurrentGroup: group.isCurrentGroup,

    requestSent: group.requestSent,

    status: group.status

}));

    renderMatchingGroups();
}
async function loadGroupStatus() {

    if (!selectedRequest) {

        cgRequestStatus = "looking";
        currentGroupId = null;

        renderStatusBar();
        return;

    }

    const response = await apiFetch(
        "https://rideshare-backend-uv0p.onrender.com/group-status",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                rideRequestId: selectedRequest.id
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        return;
    }

    cgRequestStatus = data.status;
    currentGroupId = data.currentGroupId;

    renderStatusBar();

}
/* ── Internal: select a request and trigger matching load ── */
function selectRequest(requestId) {
  const req = myRequests.find(r => r.id === requestId);
  if (!req) return;
 
  selectedRequest = { ...req };
 
  renderSelectedRequest();
  renderRequestDropdown();       // keep dropdown list in sync (active highlight)
  
  loadMatchingStudents(requestId);
  loadMatchingGroups(requestId);

  loadGroupStatus();
}
 
/* ── Render the "Your Request" summary card ── */
function renderSelectedRequest() {
  const routeEl = document.getElementById('mrsRoute');
  const metaEl  = document.getElementById('mrsMeta');
  if (!routeEl || !metaEl) return;
 
  if (!selectedRequest.id) {
    routeEl.innerHTML = `<span style="color:var(--muted)">No open requests found</span>`;
    metaEl.textContent = 'Create a ride request first';
    return;
  }
 
  const arrowSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--sky);flex-shrink:0">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>`;
 
  routeEl.innerHTML =
    `<span style="font-weight:700">${escapeHTML(selectedRequest.source)}</span>` +
    arrowSvg +
    `<span style="color:var(--muted)">${escapeHTML(selectedRequest.destination)}</span>`;
 
  metaEl.textContent =
    `${formatDateLabel(selectedRequest.ride_date)} · ` +
    `${formatTime(selectedRequest.ride_time)}`;

  const editBtn = document.getElementById("mrsEditBtn");

if (editBtn) {
    editBtn.disabled = inviteMode;
    editBtn.style.opacity = inviteMode ? "0.5" : "";
    editBtn.style.pointerEvents = inviteMode ? "none" : "";
}
  const changeBtn = document.getElementById("mrsChangeBtn");

if (changeBtn) {
    changeBtn.disabled = inviteMode;
    changeBtn.style.opacity = inviteMode ? "0.5" : "";
    changeBtn.style.pointerEvents = inviteMode ? "none" : "";
}
  }
 
/* ── Render the items inside the dropdown ── */
function renderRequestDropdown() {
  const list = document.getElementById('reqDropdownList');
  if (!list) return;
 
  if (!myRequests.length) {
    list.innerHTML = `
      <div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">
        No open requests found
      </div>`;
    return;
  }
 
  const arrowSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>`;
 
  const checkSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`;
 
  const pinSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="10" r="3"/>
    <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z"/>
  </svg>`;
 
  list.innerHTML = myRequests.map(r => {
    const isActive = r.id === selectedRequest.id;
    return `
      <div class="req-drop-item ${isActive ? 'active' : ''}"
           onclick="pickRequest('${r.id}')">
        <div class="req-drop-icon">${pinSvg}</div>
        <div class="req-drop-body">
          <div class="req-drop-route">
            ${escapeHTML(r.source)} ${arrowSvg} <span style="color:var(--muted)">${escapeHTML(r.destination)}</span>
          </div>
          <div class="req-drop-meta">
            ${formatDateLabel(r.ride_date)} &nbsp;·&nbsp; ${formatTime(r.ride_time)}
          </div>
        </div>
        <div class="req-drop-check">${isActive ? checkSvg : ''}</div>
      </div>`;
  }).join('');
}
 
/* ── Toggle the dropdown open/closed ── */
function toggleRequestDropdown(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('reqDropdown');
  const chevron  = document.getElementById('mrsChevron');
  if (!dropdown) return;
 
  const isOpen = dropdown.style.display !== 'none';
  if (isOpen) {
    closeRequestDropdown();
  } else {
    renderRequestDropdown();
    dropdown.style.display = 'block';
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  }
}
 
function closeRequestDropdown() {
  const dropdown = document.getElementById('reqDropdown');
  const chevron  = document.getElementById('mrsChevron');
  if (dropdown) dropdown.style.display = 'none';
  if (chevron)  chevron.style.transform = 'rotate(0deg)';
}
 
/* ── Called when user clicks an item in the dropdown ── */
function pickRequest(requestId) {
  closeRequestDropdown();
  selectRequest(requestId);
}
 
/* ── Close dropdown on outside click ── */
document.addEventListener('click', e => {
  const dropdown = document.getElementById('reqDropdown');
  const btn      = document.getElementById('mrsChangeBtn');
  if (!dropdown || dropdown.style.display === 'none') return;
  if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
    closeRequestDropdown();
  }
});
 
/* ── Close dropdown on Escape (extend existing keyboard handler) ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const dropdown = document.getElementById('reqDropdown');
    if (dropdown && dropdown.style.display !== 'none') closeRequestDropdown();
  }
});
 
/* ══════════════════════════════════
   RENDER MATCHING STUDENTS
   (uses matchingStudents[] instead of DB.matchingStudents)
══════════════════════════════════ */
function renderMatchingStudents() {

    const list = document.getElementById("matchingList");

    if (!list) return;

    if (!matchingStudents.length) {

        list.innerHTML = `
        <div class="matching-empty">
            <svg width="36" height="36" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round">

                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>

            <p>No matching students yet</p>

            <span>
                Students who post the same route within ±15 mins will appear here
            </span>

        </div>
        `;

        updateContinueBtn();
        return;
    }

    const clockSvg = `
    <svg width="12" height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#60A5FA"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round">

        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>

    </svg>`;

    const homeSvg = `
    <svg width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round">

        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>

    </svg>`;

    list.innerHTML = matchingStudents.map(s => `

    <div class="match-card ${s.selected ? "selected" : ""}"
        id="mc-${s.id}"
        onclick="toggleStudentSelect('${s.id}')">

        <div class="match-checkbox">
            <svg width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round">

                <polyline points="20 6 9 17 4 12"/>

            </svg>
        </div>

        <div class="match-avatar"
        style="background:${s.color}">

            ${escapeHTML(s.initials)}

        </div>

        <div class="match-info">

            <div class="match-name">
                ${escapeHTML(s.name)}
            </div>

            <div class="match-meta">

                ${clockSvg}

                ${escapeHTML(s.time)}

                &nbsp;·&nbsp;

                ±15 min match

            </div>

            ${s.block ?
            `<div class="match-block">

                ${homeSvg}

                ${escapeHTML(s.block)}

            </div>`
            : ""}

            ${s.notes ?
            `<div class="match-notes">

                "${escapeHTML(s.notes)}"

            </div>`
            : ""}

        </div>

        <div class="match-right-col">

            ${s.compat ?
            `<span class="match-compat">
                ${escapeHTML(s.compat)}% match
            </span>`
            : ""}

            <span class="badge ${s.selected ? "badge-green" : "badge-muted"}">

                ${s.selected ? "Selected" : "Select"}

            </span>

        </div>

    </div>

    `).join("");

    updateContinueBtn();

}
 
function toggleStudentSelect(id) {

    const s = matchingStudents.find(x => x.id === id);

    if (!s) return;

    s.selected = !s.selected;

    const card = document.getElementById("mc-" + id);

    if (card) {

        card.classList.toggle("selected", s.selected);

        const chk = card.querySelector(".match-checkbox");

        const badge = card.querySelector(".badge");

        if (chk) {
            chk.style.backgroundColor =
                s.selected ? "#2563EB" : "";
        }

        if (badge) {

            badge.className =
                `badge ${s.selected ? "badge-green" : "badge-muted"}`;

            badge.textContent =
                s.selected ? "Selected" : "Select";
        }
    }

    updateContinueBtn();

}
 
function updateContinueBtn() {
  const count = matchingStudents.filter(s => s.selected).length;
  const wrap  = document.getElementById('cgContinueWrap');
  const btn   = document.getElementById('cgContinueBtn');
  if (!wrap || !btn) return;
  wrap.style.display = count > 0 ? 'block' : 'none';
  btn.textContent = `Continue with ${count} student${count !== 1 ? 's' : ''} →`;
}
let inviteExistingGroup = null;
let inviteMode = false;
async function createGroup() {

    const selected = matchingStudents.filter(s => s.selected);

    if (!selected.length) {
        showToast("Select at least one student", "error");
        return;
    }

    //--------------------------------------------------
    // Existing Group → Invite Members
    //--------------------------------------------------

    if (inviteExistingGroup) {
        console.log(inviteExistingGroup);
        const response = await apiFetch(
            "https://rideshare-backend-uv0p.onrender.com/invite-members-existinggc",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    groupId: inviteExistingGroup.groupId,

                    senderRequestId: inviteExistingGroup.rideRequestId,

                    selectedUsers: selected.map(s => ({

                        user_id: s.user_id,

                        request_id: s.request_id

                    }))

                })

            }
        );

        const data = await response.json();

        if (!response.ok) {

            showToast(data.message || data.error, "error");

            return;

        }

        showToast(data.message, "success");
        await loadNotifications();
        inviteExistingGroup = null;
        inviteMode = false;
        renderSelectedRequest();
        navigate("active-groups");
        const editBtn =document.getElementById("mrsEditBtn");
        if (editBtn) {
            editBtn.disabled = false;
            editBtn.style.opacity = "";
            editBtn.style.pointerEvents = "";
        }
        return;

    }

    //--------------------------------------------------
    // Brand New Group
    //--------------------------------------------------

    const response = await apiFetch("https://rideshare-backend-uv0p.onrender.com/create-group", {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({

            requestId: selectedRequest.id,

            selectedUsers: selected.map(s => ({

                user_id: s.user_id,

                request_id: s.request_id

            })),

            max_members: _chosenGroupSize

        })

    });

    const data = await response.json();

    if (!response.ok) {

        showToast(data.error || data.message, "error");

        return;

    }

    showToast(
        `Requests sent to ${data.invitedCount} student${data.invitedCount !== 1 ? "s" : ""}. Waiting for acceptance.`,
        "success"
    );
    await loadNotifications();
    setTimeout(() => {

        navigate("my-requests")

    }, 1000);

}
/* ═══════════════════════════════════
   MODAL: GROUP SIZE
═══════════════════════════════════ */
function openGroupSizeModal() {
  const selected = matchingStudents.filter(s => s.selected);
  if (!selected.length) {
    showToast('Select at least one student first', 'error');
    return;
  }

  const chipsEl = document.getElementById('selectedChips');
  if (chipsEl) {
    chipsEl.innerHTML = selected.map(s =>
      `<div class="student-chip">
        <div class="chip-av" style="background:${s.color}">${escapeHTML(s.initials)}</div>
        ${escapeHTML(s.name)}
      </div>`
    ).join('');
  }

  openModal('modalGroupSize');
}
function pickGroupSize(n) {
  _chosenGroupSize = n;
  document.querySelectorAll('.size-opt').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.size) === n);
  });
}

function closeModalGroupSize(e) {
  if (e && e.target !== document.getElementById('modalGroupSize')) return;
  closeModal('modalGroupSize');
}

function sendGroupRequests() {
    closeModal("modalGroupSize");
    createGroup();
}

function renderStatusBar(){

    const steps={

        looking:"csbLooking",

        pending:"csbPending",

        active:"csbActive"

    };

    Object.values(steps).forEach(id=>{

        document
            .getElementById(id)
            ?.classList.remove("active");

    });

    document
        .getElementById(steps[cgRequestStatus])
        ?.classList.add("active");

}
function renderMatchingGroups() {
  const list = document.getElementById('matchingGroupsList');
  if (!list) return;

  if (!matchingGroups.length) {
    list.innerHTML = `<div class="matching-empty">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
        <rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      </svg>
      <p>No matching groups found</p>
      <span>Groups on the same route will appear here once created</span>
    </div>`;
    return;
  }

  const arrowSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
  const clockSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const peopleSvg= `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

  list.innerHTML = matchingGroups.map(g => {
    const seatsLeft = g.seatsLeft;
    const isFull  = seatsLeft <= 0;
    const isSent  = g.status === 'sent';

    const memberAvsHtml = g.members.slice(0, 4).map(m =>
      `<div class="mg-member-av" style="background:${m.color}">${escapeHTML(m.initials)}</div>`
    ).join('') +
    (g.members.length > 4 ? `<div class="mg-member-count">+${g.members.length - 4}</div>` : '');

    let actionBtn;

if(g.isCurrentGroup){

    actionBtn=`
        <button
            class="btn-join-sent"
            disabled>
            Joined
        </button>
    `;

}
else if(isFull){

    actionBtn=`
        <span
        class="badge badge-muted"
        style="padding:8px 14px">
            Group Full
        </span>
    `;

}
else if(currentGroupId){

    actionBtn=`
        <button
        class="btn-join-group"
        onclick="alreadyInGroupToast()">
            Request to Join
        </button>
    `;

}
else if(g.requestSent){

    actionBtn=`
        <button
        class="btn-join-sent"
        disabled>
            ✓ Request Sent
        </button>
    `;

}
else{

    actionBtn=`
        <button
        class="btn-join-group"
        onclick="openJoinModal('${g.id}')">
            Request to Join
        </button>
    `;

}

    return `
      <div class="mg-card ${isFull ? 'mg-full' : ''} ${isSent ? 'mg-sent' : ''}">
        <div class="mg-card-top">
          <div class="mg-group-avatar">${g.members.length}/${g.max_members}</div>
          <div class="mg-info">
            <div class="mg-route">
              ${escapeHTML(g.route.from)}
              <span style="color:var(--sky)">${arrowSvg}</span>
              <span style="color:var(--muted)">${escapeHTML(g.route.to)}</span>
            </div>
            <div class="mg-meta">
              <span>${clockSvg} ${escapeHTML(g.time)}</span>
              <span>${peopleSvg} ${g.members.length} / ${g.max_members} members</span>
              ${!isFull ? `<span style="color:var(--success);font-weight:600">${seatsLeft} seat${seatsLeft !== 1 ? 's' : ''} left</span>` : ''}
            </div>
          </div>
          <div style="flex-shrink:0">
            <span class="badge ${isFull ? 'badge-muted' : isSent ? 'badge-blue' : 'badge-green'}">
              ${isFull ? 'Full' : isSent ? 'Pending' : 'Open'}
            </span>
          </div>
        </div>

        <div class="mg-card-bottom">
          <div class="mg-members-row">
            <div class="mg-member-avs">${memberAvsHtml}</div>
            <span class="mg-members-label"><strong>${g.members.length}</strong> / ${g.max_members} members</span>
          </div>
          <div class="mg-right-col">
            <div class="mg-leader">
              <div class="mg-leader-av" style="background:${g.leader.color}">${escapeHTML(g.leader.initials)}</div>
              ${escapeHTML(g.leader.name)}
            </div>
            ${actionBtn}
          </div>
        </div>
      </div>`;
  }).join('');
}
function alreadyInGroupToast(){

    showToast(

        "You are already in a group. Leave your current group before joining another group.",

        "error"

    );

}



/* ═══════════════════════════════════
   MODAL: JOIN GROUP
═══════════════════════════════════ */
function openJoinModal(groupId) {
  _joinTargetGroupId = groupId;
  const g = matchingGroups.find(x => x.id === groupId);
  if (!g) return;

  const arrowSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--sky)"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;

  const card = document.getElementById('joinModalGroupCard');
  if (card) {
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div style="width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,var(--indigo),#818CF8);
          display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0">
          ${g.members.length}/${g.max_members}
        </div>
        <div>
          <div style="font-size:14.5px;font-weight:700;display:flex;align-items:center;gap:6px">
            ${escapeHTML(g.route.from)} ${arrowSvg} <span style="color:var(--muted)">${escapeHTML(g.route.to)}</span>
          </div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${escapeHTML(g.time)} · ${g.members.length}/${g.max_members} members</div>
        </div>
      </div>
      <div style="display:flex;gap:6px">
        ${g.members.map(m => `<div style="width:26px;height:26px;border-radius:50%;background:${m.color};
          display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:700">${escapeHTML(m.initials)}</div>`).join('')}
      </div>`;
  }

  openModal('modalJoinGroup');
}

function closeModalJoin(e) {
  if (e && e.target !== document.getElementById('modalJoinGroup')) return;
  closeModal('modalJoinGroup');
  _joinTargetGroupId = null;
}

async function sendJoinRequest() {

    if (!selectedRequest) {

    showToast(
        "Please select a ride request first.",
        "error"
    );

    return;

}

    const response = await apiFetch(
        "https://rideshare-backend-uv0p.onrender.com/join-group",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                groupId: _joinTargetGroupId,

                senderRequestId: selectedRequest.id

            })

        }
    );

    const data = await response.json();

    if (!response.ok) {

        showToast(data.message, "error");

        return;

    }

    closeModal("modalJoinGroup");

    showToast(data.message, "success");
    await loadNotifications();
    await loadMatchingGroups(selectedRequest.id);
    await loadGroupStatus();

}

async function loadJoinRequests() {


    const response = await apiFetch(
        `https://rideshare-backend-uv0p.onrender.com/join-requests`
    );

    const data = await response.json();

    console.log(data.requests);

    // Render cards with Accept / Reject buttons
}

/* ═══════════════════════════════════
   MODAL HELPERS
═══════════════════════════════════ */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}

/* close modals on Escape — extend existing keydown listener */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closeModal('modalGroupSize');
  closeModal('modalJoinGroup');
  closeModal('modalLogout');
});


/* ══════════════════════════════════
   PROFILE PAGE
══════════════════════════════════ */
async function initProfile() {

    const response = await apiFetch("https://rideshare-backend-uv0p.onrender.com/profile");


    const user = await response.json();

    const initials =user.name? user.name.substring(0,2).toUpperCase(): "US";
    document.getElementById("profileAvatarLarge").innerText = initials;

    document.getElementById("profileName").value = user.name || "";
    document.getElementById("profileEmail").value =user.mail || "";
    document.getElementById("profilePhone").value =user.phone || "";
    document.getElementById("profileBlock").value =user.block || "";
    document.getElementById("profileYear").value =user.year_branch || "";
    document.getElementById("profileNameDisplay").innerText = user.name;
    document.getElementById("profileEmailDisplay").innerText = user.mail;
    document.getElementById("profileAvatarLarge").innerText =initials
}

async function saveProfile() {

    const payload = {
        name: document.getElementById("profileName").value,
        phone: document.getElementById("profilePhone").value,
        block: document.getElementById("profileBlock").value,
        year_branch: document.getElementById("profileYear").value
    };

    const response = await apiFetch(
        "https://rideshare-backend-uv0p.onrender.com/update-profile",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        }
    );

    const data = await response.json();

    if (data.success) {

        localStorage.setItem("userName", payload.name);

        initUser();

        showToast(
            "Profile updated successfully",
            "success"
        );

    } else {

        showToast(
            data.message || "Failed to update profile",
            "error"
        );

    }
}

/* ══════════════════════════════════
   HELPERS
══════════════════════════════════ */
function statusBadge(status) {
  const map = {
    open:    '<span class="badge badge-green">Open</span>',
    matched: '<span class="badge badge-purple">Matched</span>',
    closed:  '<span class="badge badge-muted">Closed</span>',
    expired: '<span class="badge badge-red">Expired</span>',
  };
  return map[status] || '<span class="badge badge-muted">Unknown</span>';
}

function formatDateLabel(dateStr) {
  if (!dateStr) return '—';
  const d     = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff  = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
}

/* ══════════════════════════════════
   INTERSECTION OBSERVER — FADE IN
══════════════════════════════════ */
function initScrollAnimations() {
  const animatables = document.querySelectorAll(
    '.qa-card, .req-full-card, .group-card, .upcoming-card, .hero-stat, .safety-banner'
  );

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'pageFadeIn .45s ease both';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  animatables.forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
}

/* ══════════════════════════════════
   KEYBOARD SHORTCUTS
══════════════════════════════════ */
function initKeyboard() {
  document.addEventListener('keydown', e => {
    // Escape closes panels
    if (e.key === 'Escape') {
      if (State.mobileNavOpen) closeMobileNav();
      if (State.notifOpen) {
        const panel = document.getElementById('notifPanel');
        if (panel) panel.classList.remove('open');
        State.notifOpen = false;
      }
    }
  });
}

/* ══════════════════════════════════
   SWIPE-TO-CLOSE MOBILE NAV
══════════════════════════════════ */
function initSwipe() {
  let startX = 0;
  const nav  = document.getElementById('mobileNav');
  if (!nav) return;

  nav.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  nav.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].clientX - startX;
    if (diff < -60 && State.mobileNavOpen) closeMobileNav();
  }, { passive: true });
}

/* ══════════════════════════════════
   TIME-BASED HERO COLOUR ACCENT
══════════════════════════════════ */
function applyTimeAccent() {
  const hour = new Date().getHours();
  let color;
  if (hour < 6)        color = '#6366F1'; // midnight — indigo
  else if (hour < 12)  color = '#60A5FA'; // morning  — sky
  else if (hour < 18)  color = '#2563EB'; // afternoon — blue
  else                 color = '#818CF8'; // evening  — soft indigo
  document.documentElement.style.setProperty('--sky', color);
}

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Background
  initParticles();

  // UI
  applyTimeAccent();
  initUser();
  loadNotifications();
  initRipples();
  initKeyboard();
  initSwipe();

  // Start on dashboard
  navigate('dashboard');

  // Animate on scroll (slight delay so initial page is visible)
  setTimeout(initScrollAnimations, 300);
  setInterval(loadNotifications, 30000);
  // Init create form defaults (so time list is ready)
  initCreateForm();
});

