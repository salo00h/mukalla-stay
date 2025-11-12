const API = "http://localhost:3000";

async function loadPendingHotels() {
  const box = document.getElementById("hotelsList");
  const empty = document.getElementById("emptyMsg");
  box.innerHTML = "";
  empty.style.display = "block";

  try {
    const res = await fetch(`${API}/api/admin/hotels/pending`);
    const j = await res.json();
    if (!res.ok || j.ok === false) throw new Error(j.error || "فشل تحميل البيانات");

    const hotels = j.hotels || [];
    if (!hotels.length) return;

    empty.style.display = "none";
    box.innerHTML = hotels
      .map(
        (h) => `
        <div class="card">
          <div class="row">
            <div>
              <b>${h.name}</b><br>
              <span class="muted">${h.area} — ${h.address}</span><br>
              <span style="color:gray;">📧 ${h.email}</span>
            </div>
            <div class="row" style="gap:6px;">
              <button class="approve" onclick="approveHotel(${h.id})">تفعيل ✅</button>
              <button class="reject" onclick="rejectHotel(${h.id})">رفض ❌</button>
            </div>
          </div>
        </div>`
      )
      .join("");
  } catch (err) {
    console.error(err);
    box.innerHTML = `<div class="muted">⚠️ ${err.message}</div>`;
  }
}

async function approveHotel(id) {
  if (!confirm("تأكيد تفعيل الفندق؟")) return;
  try {
    const res = await fetch(`${API}/api/admin/hotels/${id}/approve`, { method: "POST" });
    const j = await res.json();
    alert(j.message || "تم التفعيل بنجاح");
    loadPendingHotels();
  } catch (e) {
    alert("⚠️ فشل التفعيل: " + e.message);
  }
}

async function rejectHotel(id) {
  if (!confirm("هل تريد رفض هذا الفندق؟")) return;
  try {
    const res = await fetch(`${API}/api/admin/hotels/${id}/reject`, { method: "POST" });
    const j = await res.json();
    alert(j.message || "تم الرفض بنجاح");
    loadPendingHotels();
  } catch (e) {
    alert("⚠️ فشل الرفض: " + e.message);
  }
}

loadPendingHotels();
