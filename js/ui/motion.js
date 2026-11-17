// =========================================================
// AportFy — ui/motion.js
// Efeitos de movimento: luz que segue o mouse nos cartões, "pulo" dos
// valores que mudam e gráficos com entrada mais suave. O visual fica em
// css/custom.css (seção "Movimento"); nada aqui altera texto ou dados.
// =========================================================

const BUMP_TARGETS = ".kpi-card h3, #networth-total, #inv-kpi-total";

export function bindMotion() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  // Luz dos cartões: um cálculo por quadro, só no cartão sob o mouse.
  let pending = null;
  document.addEventListener(
    "pointermove",
    (e) => {
      const card = e.pointerType === "mouse" && e.target.closest?.(".glass-card");
      if (!card) return;
      if (!pending) requestAnimationFrame(() => {
        const { card, x, y } = pending;
        pending = null;
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${x - r.left}px`);
        card.style.setProperty("--my", `${y - r.top}px`);
      });
      pending = { card, x: e.clientX, y: e.clientY };
    },
    { passive: true }
  );

  // Valor novo: reinicia a animação de entrada (só a classe muda; o texto é o do app).
  const bump = new MutationObserver((mutations) => {
    new Set(mutations.map((m) => (m.target.nodeType === 1 ? m.target : m.target.parentElement).closest(BUMP_TARGETS))).forEach((el) => {
      if (!el) return;
      el.classList.remove("value-bump");
      void el.offsetWidth;
      el.classList.add("value-bump");
    });
  });
  document.querySelectorAll(BUMP_TARGETS).forEach((el) => bump.observe(el, { childList: true, characterData: true, subtree: true }));

  // Gráficos: entrada mais longa e com desaceleração suave.
  if (window.Chart) Object.assign(window.Chart.defaults.animation, { duration: 900, easing: "easeOutQuart" });
}
