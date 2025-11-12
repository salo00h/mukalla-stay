const API = "http://localhost:3000";

const els = {
  tbody: document.getElementById("tbody"),
  empty: document.getElementById("empty"),
  search: document.getElementById("search"),
  status: document.getElementById("status"),
  refresh: document.getElementById("refresh"),
  sTotal: document.getElementById("sTotal"),
  sWait: document.getElementById("sWait"),
  sDeposit: document.getElementById("sDeposit"),
  sConfirmed: document.getElementById("sConfirmed"),
  toasts: document.getElementById("toasts"),
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  btnCancel: document.getElementById("btnCancel"),
  btnOk: document.getElementById("btnOk"),
  demoSeed: document.getElementById("demoSeed"),

  // 🧭 تبويبات + الأقسام
  tabBookings: document.getElementById("tabBookings"),
  tabStats: document.getElementById("tabStats"),
  tabUsers: document.getElementById("tabUsers"),
  tabLogs: document.getElementById("tabLogs"),

  bookingsSection: document.getElementById("bookingsSection"),
  statsSection: document.getElementById("statsSection"),
  usersSection: document.getElementById("usersSection"),
  logsSection: document.getElementById("logsSection"),
};


let allData = [];
let modalResolve;

// ✅ إشعارات صغيرة
function toast(msg, type = "info") {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = msg;
  els.toasts.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ✅ نافذة تأكيد
function confirmModal(title, body) {
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = body;
  els.modal.classList.add("show");
  return new Promise((resolve) => {
    modalResolve = resolve;
  });
}

els.btnCancel.onclick = () => {
  els.modal.classList.remove("show");
  modalResolve && modalResolve(false);
};

els.btnOk.onclick = () => {
  els.modal.classList.remove("show");
  modalResolve && modalResolve(true);
};

// ✅ دوال مساعدة
function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString("ar-EG") : "—";
}

function badge(status) {
  return `<span class="status ${status}">${status}</span>`;
}

function pill(text) {
  return `<span class="pill"><span class="dot blue"></span>${text}</span>`;
}

function btn(text, tone, onClick) {
  const id = "b" + Math.random().toString(36).slice(2);
  setTimeout(() => (document.getElementById(id).onclick = onClick), 0);
  return `<button id="${id}" class="btn-mini ${tone}">${text}</button>`;
}

// ✅ رسم كل صف حجز (مع صورة الإيصال)
function renderRows(data) {
  if (!data.length) {
    els.tbody.innerHTML = "<tr><td colspan='6' class='empty'>لا توجد حجوزات حاليًا.</td></tr>";
    return;
  }

  els.tbody.innerHTML = data.map(b => `
    <tr>
      <td>
        <div class="ref">${b.booking_ref}</div>
        <div style="color:var(--muted);font-size:12px;margin-top:6px">
          ${b.created_at ? new Date(b.created_at).toLocaleString("ar-EG") : ""}
        </div>
        ${b.deposit_proof_url ? `
          <div style="margin-top:6px">
            <a href="${b.deposit_proof_url}" target="_blank" style="color:#4da3ff;text-decoration:underline;">📎 عرض إيصال</a>
          </div>` : ""}
      </td>

      <td>
        <div style="font-weight:700">${b.client_name}</div>
        <div style="color:var(--muted);font-size:12px">${b.client_email}</div>
      </td>

      <td>
        <div style="font-weight:600">${b.hotel_name || "—"}</div>
        <div style="color:var(--muted);font-size:12px">${b.room_name || ""}</div>
      </td>

      <td>
        <div>${fmtDate(b.checkin_date)} → ${fmtDate(b.checkout_date)}</div>
      </td>

      <td>${badge(b.status)}</td>

      <td>
        ${
          b.status === "DEPOSIT_SENT"
            ? `<button class="btn" style="background:#1c9e4e" onclick="approveDeposit('${b.booking_ref}')">اعتماد العربون</button>`
            : b.status === "CONFIRMED" && !b.final_paid
            ? `<button class="btn" style="background:#00bcd4" onclick="approveFinal('${b.booking_ref}')">اعتماد الدفع الكامل</button>`
            : b.status === "CONFIRMED" && b.final_paid
            ? `<span class="pill"><span class="dot green"></span>تم الدفع الكامل ✅</span>`
            : ""

        }
      </td>
    </tr>
  `).join("");
}


// ✅ اعتماد العربون من قبل الإدارة
async function approveDeposit(ref) {
  const yes = confirm("هل أنت متأكد من اعتماد العربون؟");
  if (!yes) return;

  try {
    const res = await fetch(`${API}/api/admin/approve-deposit/${ref}`, { method: "POST" });
    const j = await res.json();

    if (j.ok) {
      toast("✅ تم اعتماد العربون بنجاح");
      await fetchAll(); // تحديث الجدول مباشرة بعد الاعتماد
    } else {
      toast("❌ حدث خطأ أثناء الاعتماد");
    }
  } catch (err) {
    console.error(err);
    toast("⚠️ فشل الاتصال بالسيرفر");
  }
}
// ✅ اعتماد الدفع الكامل من قبل الإدارة
async function approveFinal(ref) {
  const yes = confirm("هل تريد اعتماد الدفع الكامل؟");
  if (!yes) return;

  try {
    const res = await fetch(`${API}/api/admin/approve-final/${ref}`, { method: "POST" });
    const j = await res.json();
    if (j.ok) {
      toast("✅ تم اعتماد الدفع الكامل بنجاح");
      await fetchAll(); // تحديث الجدول بعد الاعتماد
    } else {
      toast("❌ " + (j.error || "حدث خطأ أثناء الاعتماد"));
    }
  } catch (err) {
    console.error(err);
    toast("⚠️ فشل الاتصال بالسيرفر");
  }
}


// ✅ إحصائيات
function stats(data) {
  els.sTotal.textContent = data.length;
  els.sWait.textContent = data.filter((x) => x.status === "WAITING_HOTEL_CONFIRM").length;
  els.sDeposit.textContent = data.filter((x) => x.status === "AWAITING_DEPOSIT").length;
  els.sConfirmed.textContent = data.filter((x) => x.status === "CONFIRMED").length;
}

// ✅ جلب جميع الحجوزات
async function fetchAll() {
  els.tbody.innerHTML = `
    <tr><td colspan="6"><div class="skeleton"></div></td></tr>
    <tr><td colspan="6"><div class="skeleton"></div></td></tr>
    <tr><td colspan="6"><div class="skeleton"></div></td></tr>
  `;
  try {
    const res = await fetch(API + "/api/bookings");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();

    // ✅ تحقق أن البيانات صحيحة
    if (!j || !j.bookings) {
      toast("⚠️ لم يتم العثور على بيانات حجز");
      return;
    }

    allData = j.bookings;
    stats(allData);
    renderRows(allData);
  } catch (e) {
    console.error("❌ fetchAll error:", e);
    toast("خطأ في جلب البيانات ❌");
  }
}

// ✅ فلترة البحث
function applyFilter() {
  const q = els.search.value.trim().toLowerCase();
  const st = els.status.value;
  const filtered = allData.filter((b) => {
    const hit = (b.booking_ref + " " + b.client_email + " " + b.client_name).toLowerCase().includes(q);
    const okSt = !st || b.status === st;
    return hit && okSt;
  });
  renderRows(filtered);
}

// ✅ تنفيذ إجراء عام (تأكيد، رفض، إلغاء)
async function act(url, method, questionHtml) {
  const yes = await confirmModal("تأكيد الإجراء", questionHtml);
  if (!yes) return;
  try {
    const r = await fetch(API + url, { method, headers: { "Content-Type": "application/json" } });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "Action failed");
    toast("تم التنفيذ بنجاح ✅");
    await fetchAll();
  } catch (e) {
    console.error(e);
    toast("فشل تنفيذ الإجراء ❌");
  }
}

// ✅ التبديل بين التبويبات
els.tabBookings.onclick = () => {
  els.bookingsSection.style.display = "block";
  els.statsSection.style.display = "none";
  els.tabBookings.classList.remove("ghost");
  els.tabStats.classList.add("ghost");
};

els.tabStats.onclick = async () => {
  els.bookingsSection.style.display = "none";
  els.statsSection.style.display = "block";
  els.tabStats.classList.remove("ghost");
  els.tabBookings.classList.add("ghost");
  await loadDashboard();
};


// 📊 تحميل بيانات الإحصائيات العامة
async function loadDashboard() {
  try {
    const res = await fetch(`${API}/api/admin/dashboard`);
    const j = await res.json();
    if (!j.ok) throw new Error("خطأ في تحميل البيانات");

    // تأكد من أن هذه العناصر موجودة في HTML الخاص بك
    const totalHotels = document.getElementById("totalHotels");
    const totalBookings = document.getElementById("totalBookings");
    const activeClients = document.getElementById("activeClients");
    const siteRevenue = document.getElementById("siteRevenue");
    const hotelsRevenue = document.getElementById("hotelsRevenue");
    const avgBookingValue = document.getElementById("avgBookingValue");
    const occupancyRate = document.getElementById("occupancyRate");
    const topHotel = document.getElementById("topHotel");


    if (totalHotels) totalHotels.textContent = j.stats.totalHotels;
    if (totalBookings) totalBookings.textContent = j.stats.totalBookings;
    if (activeClients) activeClients.textContent = j.stats.activeClients;
    if (siteRevenue) siteRevenue.textContent = "$ " + j.stats.siteRevenue.toFixed(2);
    if (hotelsRevenue) hotelsRevenue.textContent = "$ " + j.stats.hotelsRevenue.toFixed(2);

    if (window.mainChart) window.mainChart.destroy();
    if (window.pieChart) window.pieChart.destroy();
    if (avgBookingValue) avgBookingValue.textContent = j.stats.avgBookingValue.toFixed(2) + " $";
    if (occupancyRate) occupancyRate.textContent = j.stats.occupancyRate + " %";
    if (topHotel) topHotel.textContent = j.stats.topHotel;


    const ctx = document.getElementById("chart");
    if (ctx) {
      window.mainChart = new Chart(ctx.getContext("2d"), {
        type: "bar",
        data: {
          labels: ["الفنادق", "الحجوزات", "العملاء", "أرباح الموقع", "أرباح الفنادق"],
          datasets: [{
            data: [
              j.stats.totalHotels,
              j.stats.totalBookings,
              j.stats.activeClients,
              j.stats.siteRevenue,
              j.stats.hotelsRevenue
            ],
            backgroundColor: ["#61d5ff","#6ca8ff","#facc15","#76ffa2","#c084fc"]
          }]
        },
        options: { responsive: false, maintainAspectRatio: false }
      });
    }

    const pie = document.getElementById("chartPie");
    if (pie) {
      window.pieChart = new Chart(pie.getContext("2d"), {
        type: "doughnut",
        data: {
          labels: ["فنادق", "عملاء نشطين", "حجوزات مؤكدة"],
          datasets: [{
            data: [j.stats.totalHotels, j.stats.activeClients, j.stats.totalBookings],
            backgroundColor: ["#61d5ff","#76ffa2","#facc15"]
          }]
        },
        options: { responsive: false, maintainAspectRatio: false }
      });
    }

  } catch (err) {
    console.error(err);
    toast("⚠️ فشل تحميل الإحصائيات");
  }
  await loadRevenueChart();
  await loadHotelRevenues();

}
async function loadRevenueChart() {
  const res = await fetch(`${API}/api/admin/revenue-by-month`);
  const j = await res.json();
  if (!j.ok) return;

  const ctx = document.getElementById("revenueChart");
  if (!ctx) return;

  new Chart(ctx.getContext("2d"), {
    type: "line",
    data: {
      labels: j.labels,
      datasets: [{
        label: "إيرادات الموقع ($)",
        data: j.values,
        borderColor: "#61d5ff",
        backgroundColor: "rgba(108,168,255,0.2)",
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(255,255,255,.06)" } },
        x: { grid: { color: "rgba(255,255,255,.04)" } },
      }
    }
  });
}

async function loadRevenueChart() {
  const res = await fetch(`${API}/api/admin/revenue-by-month`);
  const j = await res.json();
  if (!j.ok) return;

  const ctx = document.getElementById("revenueChart");
  if (!ctx) return;

  new Chart(ctx.getContext("2d"), {
    type: "line",
    data: {
      labels: j.labels,
      datasets: [{
        label: "إيرادات الموقع ($)",
        data: j.values,
        borderColor: "#61d5ff",
        backgroundColor: "rgba(108,168,255,0.2)",
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(255,255,255,.06)" } },
        x: { grid: { color: "rgba(255,255,255,.04)" } },
      }
    }
  });
}


// ✅ الأحداث
els.search.addEventListener("input", applyFilter);
els.status.addEventListener("change", applyFilter);
els.refresh.addEventListener("click", fetchAll);

els.demoSeed.addEventListener("click", async () => {
  try {
    const body = {
      hotel_id: 1,
      room_id: 1,
      client_name: "عميل تجريبي",
      client_email: "demo@mukalla.st",
      checkin_date: "2025-12-24",
      checkout_date: "2025-12-27",
    };
    const r = await fetch(API + "/api/bookings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "create failed");
    toast(`تم إنشاء حجز: <b class="ref">${j.booking_ref}</b>`);
    fetchAll();
  } catch (e) {
    console.error(e);
    toast("تعذّر إنشاء حجز تجريبي ❌");
  }
});

async function loadAdminStats() {
  const res = await fetch(`${API}/api/admin/stats`);
  const j = await res.json();
  if (!res.ok) return;
  $("#sHotels").textContent = j.hotels;
  $("#sClients").textContent = j.clients;
  $("#sRevenue").textContent = j.revenue + " $";
}

function notify(msg) {
  const n = document.createElement("div");
  n.className = "toast";
  n.textContent = msg;
  $("#notifications").appendChild(n);
  setTimeout(() => n.remove(), 4000);
}

// ✅ التبديل بين التبويبات
function showSection(section) {
  // أخفِ كل الأقسام
  [els.bookingsSection, els.statsSection, els.usersSection, els.logsSection].forEach(sec => sec.style.display = "none");

  // أزل تفعيل جميع الأزرار
  [els.tabBookings, els.tabStats, els.tabUsers, els.tabLogs].forEach(btn => btn.classList.add("ghost"));

  // أظهر القسم المطلوب
  section.style.display = "block";

  // فعّل الزر المرتبط
  if (section === els.bookingsSection) els.tabBookings.classList.remove("ghost");
  if (section === els.statsSection) els.tabStats.classList.remove("ghost");
  if (section === els.usersSection) els.tabUsers.classList.remove("ghost");
  if (section === els.logsSection) els.tabLogs.classList.remove("ghost");
}

// ربط الأزرار بالأقسام
els.tabBookings.onclick = () => showSection(els.bookingsSection);
els.tabStats.onclick = async () => {
  showSection(els.statsSection);
  await loadDashboard(); // ✅ يعيد تحميل بيانات الإحصائيات
};

els.tabUsers.onclick = () => { showSection(els.usersSection); loadUsers(); };
els.tabLogs.onclick = () => { showSection(els.logsSection); loadLogs(); };

// 👥 تحميل المستخدمين
async function loadUsers() {
  try {
    const res = await fetch(`${API}/api/admin/users`);
    const j = await res.json();
    const box = document.getElementById("usersGrid");
    box.innerHTML = "";

    j.users.forEach(u => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div style="font-weight:700">${u.name || "—"}</div>
        <div class="muted">${u.email || "بدون بريد"}</div>
        <div class="badge" style="margin-top:8px;background:${u.type === 'hotel' ? 'var(--brand)' : 'var(--good)'}">
          ${u.type === "hotel" ? "🏨 فندق" : "👤 عميل"}
        </div>
      `;
      box.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    toast("⚠️ فشل تحميل المستخدمين");
  }
}

// 🧾 تحميل سجل العمليات (فارغ مؤقتاً)
async function loadLogs() {
  const box = document.getElementById("logsList");
  box.innerHTML = "<div class='muted'>لا توجد سجلات بعد.</div>";
}


setInterval(async () => {
  try {
    const ping = await fetch(`${API}/`);
    document.getElementById("adminStatusDot").style.background = ping.ok ? "var(--good)" : "var(--bad)";
  } catch {
    document.getElementById("adminStatusDot").style.background = "var(--bad)";
  }
}, 5000);


async function loadHotelRevenues() {
  try {
    const res = await fetch(`${API}/api/admin/hotel-revenues`);
    const j = await res.json();
    if (!j.ok) throw new Error("فشل تحميل الإيرادات");

    const hotels = j.hotels.slice(0, 5);
    const ctx = document.getElementById("hotelsRevenueChart").getContext("2d");

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: hotels.map(h => h.hotel_name),
        datasets: [{
          label: "الإيرادات ($)",
          data: hotels.map(h => h.total_revenue),
          backgroundColor: "#61d5ff"
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    // لعرض التفاصيل
    document.getElementById("hotelRevenueList").innerHTML = hotels
      .map(h => `
         <div style="margin:6px 0;">
           🏨 <b>${h.hotel_name}</b> — ${h.total_revenue.toFixed(2)} $
          <button class="btn-mini primary" style="margin-inline-start:10px"
            onclick="showHotelDetails(${h.hotel_id}, '${h.hotel_name}')">عرض التفاصيل</button>
         </div>
      `)
      .join("");
  } catch (err) {
    console.error(err);
  }
}

async function showHotelDetails(hotelId, hotelName) {
  const modal = document.getElementById("hotelModal");
  const body = document.getElementById("hotelModalBody");
  const title = document.getElementById("hotelModalTitle");

  title.textContent = `📊 ${hotelName}`;
  body.innerHTML = "⏳ جاري التحميل...";
  modal.classList.add("show");

  try {
    const res = await fetch(`${API}/api/admin/hotel-details/${hotelId}`);
    const j = await res.json();
    if (!j.ok) throw new Error();

    body.innerHTML = `
      <div style="margin-bottom:10px;">
        <b>إجمالي الإيرادات:</b> ${j.stats.total_revenue.toFixed(2)} $<br>
        <b>عدد الحجوزات:</b> ${j.stats.total_bookings}
      </div>
      <table class="table">
        <thead><tr><th>المرجع</th><th>العميل</th><th>الغرفة</th><th>الحالة</th><th>المبلغ</th></tr></thead>
        <tbody>
          ${j.bookings.map(b => `
            <tr>
              <td>${b.booking_ref}</td>
              <td>${b.client_name}</td>
              <td>${b.room_name}</td>
              <td>${b.status}</td>
              <td>${b.amount || "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error(err);
    body.innerHTML = "⚠️ فشل تحميل البيانات.";
  }
}


// ✅ تحميل أولي + تحديث كل 30 ثانية
fetchAll();
setInterval(fetchAll, 30000);