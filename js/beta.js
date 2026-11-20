/* Tesoro Desk — beta section: inline feedback form and live updates.
   D1 motion: the form grows out of the button that opened it and shrinks back;
   success and error panels grow from the submit button. Reduce Motion: crossfade. */
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const raf2 = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

  // —— Feedback form ——
  const panel = document.querySelector("#feedback-panel");
  const form = document.querySelector("#feedback-form");
  if (panel && form) {
    const openers = document.querySelectorAll("[data-feedback-open]");
    const label = panel.querySelector("[data-feedback-label]");
    const msgLabel = panel.querySelector("[data-msg-label]");
    const submitLabel = panel.querySelector("[data-submit-label]");
    const bugOnly = panel.querySelector("[data-bug-only]");
    const message = form.querySelector("#fb-message");
    const count = panel.querySelector("[data-count]");
    const box = panel.querySelector(".feedback-box");
    const success = panel.querySelector(".form-success");
    const errorBox = panel.querySelector(".form-error");
    const errorText = panel.querySelector("[data-error-text]");
    const submitBtn = form.querySelector('button[type="submit"]');
    let trigger = null;

    const setType = (type) => {
      const bug = type === "bug";
      form.querySelectorAll('input[name="type"]').forEach((r) => { r.checked = r.value === type; });
      if (label) label.textContent = bug ? "Bug" : "Feature";
      if (msgLabel) msgLabel.textContent = bug ? "What happened" : "What would you use";
      if (submitLabel) submitLabel.textContent = bug ? "Send the report" : "Send the request";
      if (message) message.placeholder = bug ? "What you did, what you expected, and what you saw." : "What you want Tesoro Desk to do, and when you would use it.";
      if (bugOnly) bugOnly.hidden = !bug;
      openers.forEach((b) => b.setAttribute("aria-expanded", String(!panel.hidden && b.dataset.feedbackOpen === type)));
    };

    const originFrom = (btn) => {
      const b = btn.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      panel.style.setProperty("--from-x", (b.left + b.width / 2 - p.left) + "px");
      panel.style.setProperty("--from-y", (b.top + b.height / 2 - p.top) + "px");
    };

    const resetStatus = () => {
      [success, errorBox].forEach((el) => { el.classList.remove("is-shown"); el.hidden = true; });
    };

    const open = (btn, type) => {
      trigger = btn;
      const wasOpen = !panel.hidden && panel.classList.contains("is-open");
      panel.hidden = false;
      setType(type);
      if (wasOpen) { message && message.focus(); return; }
      resetStatus();
      originFrom(btn);
      raf2(() => {
        panel.classList.add("is-open");
        setTimeout(() => {
          panel.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
          message && message.focus({ preventScroll: true });
        }, reduce ? 0 : 180);
      });
    };

    const close = () => {
      if (panel.hidden) return;
      if (trigger) originFrom(trigger);
      panel.classList.remove("is-open");
      openers.forEach((b) => b.setAttribute("aria-expanded", "false"));
      setTimeout(() => { panel.hidden = true; }, reduce ? 0 : 420);
      if (trigger) trigger.focus({ preventScroll: true });
    };

    openers.forEach((btn) => btn.addEventListener("click", () => {
      const type = btn.dataset.feedbackOpen;
      const isOpenSame = !panel.hidden && btn.getAttribute("aria-expanded") === "true";
      if (isOpenSame) close(); else open(btn, type);
    }));
    panel.querySelector("[data-feedback-close]").addEventListener("click", close);
    panel.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    form.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener("change", () => setType(r.value)));

    if (message && count) {
      const upd = () => { count.textContent = message.value.length + " / 2000"; };
      message.addEventListener("input", upd); upd();
    }

    const statusFromButton = (el) => {
      const b = submitBtn.getBoundingClientRect();
      const p = box.getBoundingClientRect();
      el.style.setProperty("--from-x", (b.left + b.width / 2 - p.left) + "px");
      el.style.setProperty("--from-y", (b.top + b.height / 2 - p.top) + "px");
    };
    const show = (el) => {
      resetStatus();
      statusFromButton(el);
      el.hidden = false;
      raf2(() => el.classList.add("is-shown"));
    };
    const showSuccess = () => {
      show(success);
      const h = success.querySelector("h3");
      setTimeout(() => h && h.focus({ preventScroll: true }), reduce ? 0 : 200);
    };
    const showError = (msg) => { if (errorText) errorText.textContent = msg; show(errorBox); };

    const hideStatus = (focusEl) => {
      [success, errorBox].forEach((el) => el.classList.remove("is-shown"));
      setTimeout(() => { resetStatus(); }, reduce ? 0 : 320);
      if (focusEl) focusEl.focus();
    };
    panel.querySelector("[data-feedback-again]").addEventListener("click", () => { form.reset(); setType(form.querySelector('input[name="type"]:checked').value); count && (count.textContent = "0 / 2000"); hideStatus(message); });
    panel.querySelector("[data-feedback-retry]").addEventListener("click", () => hideStatus(message));

    const isLocalPreview = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = form.querySelector("#fb-email");
      const text = (message.value || "").trim();
      if (text.length < 10) { showError("Please write at least 10 characters."); return; }
      if (text.length > 2000) { showError("Please keep it under 2000 characters."); return; }
      if (!email.checkValidity()) { showError("Please enter a valid email address."); return; }
      submitBtn.disabled = true;
      const data = new FormData(form);
      if (data.get("type") !== "bug") { data.delete("device"); data.delete("os"); }
      try {
        const res = await fetch("/api/feedback", { method: "POST", headers: { Accept: "application/json" }, body: data });
        let payload = null;
        try { payload = await res.json(); } catch { payload = null; }
        if (res.ok && payload && payload.ok !== false) { showSuccess(); return; }
        if (res.status >= 400 && res.status < 500 && payload) { showError(payload.message || "Please check the form and try again."); return; }
        // Local python preview only: no Pages Function, nothing stored. Never fake success in production.
        if (isLocalPreview) { console.info("Tesoro Desk feedback: local preview, no Pages Function, nothing stored. Showing the success state. See README.md."); showSuccess(); return; }
        showError("We could not send that right now. Please try again in a moment.");
      } catch (err) {
        if (isLocalPreview) { console.info("Tesoro Desk feedback: local preview, the request did not reach an API. Nothing stored.", err); showSuccess(); return; }
        showError("We could not reach the server. Please check your connection and try again.");
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // —— Live updates (reads /updates.json; static entries in the HTML are the no-JS fallback) ——
  const feed = document.querySelector("[data-updates-src]");
  if (feed && window.fetch) {
    const list = feed.querySelector("[data-updates-list]");
    const stamp = feed.querySelector("[data-updates-stamp]");
    const pad = (n) => String(n).padStart(2, "0");
    // Format in America/New_York, labelled ET. Date-only entries show the date only.
    const fmt = (iso) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.replace(/-/g, ".");
      const d = new Date(iso);
      if (isNaN(d)) return "";
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((p) => [p.type, p.value]));
      return `${parts.year}.${parts.month}.${parts.day} · ${parts.hour}:${parts.minute} ET`;
    };
    fetch(feed.dataset.updatesSrc, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((json) => {
        const entries = Array.isArray(json.entries) ? json.entries.slice(0, 6) : [];
        if (!entries.length) return;
        list.textContent = "";
        entries.forEach((e) => {
          const li = document.createElement("li");
          const t = document.createElement("time");
          t.className = "mono-label";
          t.dateTime = e.date;
          t.textContent = fmt(e.date);
          if (e.kind === "response") { const k = document.createElement("span"); k.className = "kind"; k.textContent = "Reply"; t.appendChild(k); }
          const p = document.createElement("p");
          p.textContent = e.title;
          li.append(t, p);
          list.appendChild(li);
        });
        if (stamp && json.updated) stamp.textContent = fmt(json.updated).split(" · ")[0];
      })
      .catch(() => { /* keep the static entries */ });
  }
})();
