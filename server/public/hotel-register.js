const API = "http://localhost:3000";

document.getElementById("hotelSignup")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const fd = new FormData(form);

  try {
    const res = await fetch(`${API}/api/public/hotels/register`, {
      method: "POST",
      body: fd,
    });

    const j = await res.json();
    if (!res.ok || j.ok === false) throw new Error(j.error || "فشل التسجيل");

    document.getElementById("signupMsg").textContent =
      "✅ تم إرسال الطلب. سيتم التواصل معك بعد مراجعة الإدارة.";
    form.reset();
  } catch (err) {
    document.getElementById("signupMsg").textContent = "❌ " + err.message;
  }
});
