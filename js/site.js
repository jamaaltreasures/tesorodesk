/* Tesoro Desk — nav, scroll reveals, and the waitlist form. */

(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // —— Mobile nav: the panel grows out of the Menu button and shrinks back into it ——
  const toggle = document.querySelector(".nav-toggle");
  const panel = document.querySelector("#nav-panel");
  if (toggle && panel) {
    const place = () => {
      const t = toggle.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      panel.style.setProperty("--origin-x", (t.left + t.width / 2 - p.left) + "px");
    };
    const open = () => { place(); panel.classList.add("is-open"); toggle.setAttribute("aria-expanded", "true"); };
    const close = () => { panel.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); };
    toggle.addEventListener("click", () => (panel.classList.contains("is-open") ? close() : open()));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panel.classList.contains("is-open")) { close(); toggle.focus(); } });
    document.addEventListener("click", (e) => {
      if (!panel.classList.contains("is-open")) return;
      if (panel.contains(e.target) || toggle.contains(e.target)) return;
      close();
    });
    panel.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
  }

  // —— Scroll reveals (hero reveals are driven by the chest) ——
  const items = document.querySelectorAll(".reveal:not(.hero .reveal)");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add("is-in"));
  }
  // Safety: never leave hero content hidden if the chest script fails.
  document.querySelectorAll(".hero .reveal").forEach((el) => el.classList.add("is-in"));

  // —— Waitlist ——
  // TODO: When the Cloudflare Pages Function and D1 database are set up
  // (see README), this POST will reach /api/waitlist. The destination is
  // that Function; do not wire a third-party form host here.
  const form = document.querySelector("#waitlist-form");
  const panelForm = document.querySelector("#waitlist-panel");
  if (!form || !panelForm) return;

  const success = panelForm.querySelector(".waitlist-success");
  const errorBox = panelForm.querySelector(".waitlist-error");
  const errorText = panelForm.querySelector("[data-error-text]");
  const submitBtn = form.querySelector('button[type="submit"]');

  const originFromButton = () => {
    if (!submitBtn) return;
    const b = submitBtn.getBoundingClientRect();
    const p = panelForm.getBoundingClientRect();
    [success, errorBox].forEach((el) => {
      if (!el) return;
      el.style.setProperty("--from-x", (b.left + b.width / 2 - p.left) + "px");
      el.style.setProperty("--from-y", (b.top + b.height / 2 - p.top) + "px");
    });
  };
  const reveal = (el) => {
    el.hidden = false;
    // Next frame, so the transition runs from the button instead of cutting in.
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-shown")));
  };

  const showSuccess = () => {
    panelForm.classList.add("is-success");
    panelForm.classList.remove("is-error");
    originFromButton();
    if (errorBox) { errorBox.classList.remove("is-shown"); errorBox.hidden = true; }
    if (success) reveal(success);
    const heading = success && success.querySelector("h3");
    if (heading) setTimeout(() => heading.focus({ preventScroll: true }), reduce ? 0 : 200);
  };

  const showError = (message) => {
    panelForm.classList.add("is-error");
    panelForm.classList.remove("is-success");
    if (errorText) errorText.textContent = message || "Something went wrong. Please try again.";
    originFromButton();
    if (success) { success.classList.remove("is-shown"); success.hidden = true; }
    if (errorBox) reveal(errorBox);
  };

  const retry = panelForm.querySelector("[data-retry]");
  if (retry) retry.addEventListener("click", () => {
    panelForm.classList.remove("is-error");
    errorBox.classList.remove("is-shown");
    setTimeout(() => { errorBox.hidden = true; }, reduce ? 0 : 320);
    const input = form.querySelector("#email");
    if (input) input.focus();
  });

  const isLocalPreview = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const emailInput = form.querySelector("#email");
    if (emailInput && !emailInput.checkValidity()) {
      showError("Please enter a valid email address.");
      return;
    }
    if (submitBtn) submitBtn.disabled = true;

    const data = new FormData(form);
    // Droplet backend: waitlist signups are stored through /api/feedback as type "general".
    data.set("type", "general");
    data.set("message", "Waitlist signup (" + (data.get("source") || "landing") + ")");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data,
      });

      let payload = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      if (res.ok && payload && payload.ok !== false) {
        showSuccess();
        return;
      }

      if (res.status >= 400 && res.status < 500) {
        showError((payload && payload.message) || "Please enter a valid email address.");
        return;
      }

      // Local python preview (or any missing Function): the request fails
      // or the host is not the Pages runtime. Show the success state and
      // leave a console note — do not pretend a remote write happened.
      console.info(
        "Tesoro Desk waitlist: no Pages Function on this local server, so the address was not stored. Showing the success state for preview. See README.md for Cloudflare Pages + D1 setup."
      );
      if (isLocalPreview) { showSuccess(); return; }
      showError("We could not save that right now. Please try again in a moment.");
    } catch (err) {
      console.info(
        "Tesoro Desk waitlist: the request did not reach an API (expected on the local python server). Showing the success state for preview. The address was not stored. See README.md for Cloudflare Pages + D1 setup.",
        err
      );
      if (isLocalPreview) { showSuccess(); return; }
      showError("We could not reach the server. Please check your connection and try again.");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();
