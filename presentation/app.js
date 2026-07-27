(() => {
  const slides = Array.from(document.querySelectorAll(".slide"));
  const counter = document.getElementById("slideCounter");
  const progressBar = document.getElementById("progressBar");
  const dotsRoot = document.getElementById("dots");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const deck = document.getElementById("deck");

  let index = 0;
  let touchX = null;

  const pad = (n) => String(n).padStart(2, "0");

  function renderDots() {
    dotsRoot.innerHTML = "";
    slides.forEach((slide, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dot" + (i === index ? " is-active" : "");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-label", slide.dataset.title || `Слайд ${i + 1}`);
      btn.setAttribute("aria-selected", i === index ? "true" : "false");
      btn.addEventListener("click", () => go(i));
      dotsRoot.appendChild(btn);
    });
  }

  function go(next) {
    const total = slides.length;
    index = (next + total) % total;
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === index);
    });
    counter.textContent = `${pad(index + 1)} / ${pad(total)}`;
    progressBar.style.width = `${((index + 1) / total) * 100}%`;
    renderDots();
    history.replaceState(null, "", `#${index + 1}`);
  }

  function next() {
    go(index + 1);
  }

  function prev() {
    go(index - 1);
  }

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  document.querySelectorAll("[data-next]").forEach((el) => {
    el.addEventListener("click", next);
  });

  window.addEventListener("keydown", (event) => {
    const tag = event.target && event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable) {
      return;
    }

    if (
      event.key === "ArrowRight" ||
      event.key === "PageDown" ||
      event.key === " " ||
      event.key === "Enter"
    ) {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      prev();
    } else if (event.key === "Home") {
      event.preventDefault();
      go(0);
    } else if (event.key === "End") {
      event.preventDefault();
      go(slides.length - 1);
    }
  });

  window.addEventListener(
    "touchstart",
    (event) => {
      touchX = event.changedTouches[0].clientX;
    },
    { passive: true }
  );

  window.addEventListener(
    "touchend",
    (event) => {
      if (touchX === null) return;
      const dx = event.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) < 50) return;
      if (dx < 0) next();
      else prev();
    },
    { passive: true }
  );

  const fromHash = Number.parseInt(location.hash.replace("#", ""), 10);
  const start = Number.isFinite(fromHash) ? fromHash - 1 : 0;
  go(start);
  deck.focus({ preventScroll: true });
})();
