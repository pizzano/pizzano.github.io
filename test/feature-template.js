// ============================================================
// KØL MODÜL: Sepet animasyonu
// Dosya: modules/cart-animation.js
// ------------------------------------------------------------
// Bu dosya opsiyoneldir.
// Silersen site çalışmaya devam eder; sadece ürünün sepete uçma
// animasyonu ve sepet kıpırdama efekti kapanır.
// ============================================================
(function () {
  "use strict";

  window.KOLModules = window.KOLModules || {};

  let wiggleTimer = null;
  let reminderTimer = null;

  // Animasyon CSS'ini buradan ekliyoruz ki modül tek dosya halinde taşınabilsin.
  // Yani sadece bu dosyayı silmek özelliği kapatmak için yeterli olsun.
  function injectStyles() {
    if (document.getElementById("kol-cart-animation-styles")) return;
    const style = document.createElement("style");
    style.id = "kol-cart-animation-styles";
    style.textContent = `
      .product-modal.adding-to-cart .product-panel {
        opacity: 0.22;
        transform: scale(0.985);
        transition: opacity 180ms ease, transform 180ms ease;
      }

      .cart-flyer {
        position: fixed;
        z-index: 9999;
        pointer-events: none;
        overflow: hidden;
        transform-origin: top right;
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.25);
        will-change: transform, opacity, border-radius;
      }

      .cart-flyer.run {
        animation: flyIntoCart 900ms cubic-bezier(0.22, 0.78, 0.2, 1) forwards;
      }

      @keyframes flyIntoCart {
        0% { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 1; border-radius: 0; }
        45% { transform: translate(calc(var(--fly-x) * 0.38), calc(var(--fly-y) * 0.30)) scale(0.62) rotate(-5deg) skewY(-3deg); opacity: 0.92; border-radius: 18px; }
        75% { transform: translate(calc(var(--fly-x) * 0.78), calc(var(--fly-y) * 0.76)) scale(0.22) rotate(-18deg) skewY(-7deg); opacity: 0.78; border-radius: 38px; }
        100% { transform: translate(var(--fly-x), var(--fly-y)) scale(0.04) rotate(-28deg) skewY(-10deg); opacity: 0; border-radius: 999px; }
      }

      .cart-toggle.cart-wiggle { animation: cartWiggle 500ms ease-in-out 4; }
      .cart-toggle.cart-wiggle .cart-icon { transform-origin: 50% 55%; }

      @keyframes cartWiggle {
        0%, 100% { transform: translateX(0) rotate(0deg); }
        15% { transform: translateX(-2px) rotate(-8deg); }
        30% { transform: translateX(2px) rotate(7deg); }
        45% { transform: translateX(-2px) rotate(-6deg); }
        60% { transform: translateX(2px) rotate(5deg); }
        75% { transform: translateX(-1px) rotate(-3deg); }
      }

      @media (prefers-reduced-motion: reduce) {
        .cart-flyer.run, .cart-toggle.cart-wiggle { animation: none; }
      }
    `;
    document.head.appendChild(style);
  }

  // Sepet ikonunu kısa süre kıpırdatır.
  function wiggleCart({ cartToggle, duration = 2000 }) {
    if (!cartToggle) return;
    injectStyles();
    cartToggle.classList.remove("cart-wiggle");
    void cartToggle.offsetWidth;
    cartToggle.classList.add("cart-wiggle");
    window.clearTimeout(wiggleTimer);
    wiggleTimer = window.setTimeout(() => {
      cartToggle.classList.remove("cart-wiggle");
    }, duration);
  }

  // Sepette ürün varsa 20 saniyede bir hafif hatırlatma yapar.
  function scheduleReminder({ hasItems, cartModal, cartToggle, intervalMs = 20000, duration = 2000 }) {
    window.clearInterval(reminderTimer);
    if (!hasItems) return;
    reminderTimer = window.setInterval(() => {
      if (cartModal && cartModal.hidden) wiggleCart({ cartToggle, duration });
    }, intervalMs);
  }

  // Ürün modalının kopyasını alıp sepete doğru uçurur.
  function animateProductIntoCart({ productModal, cartToggle }) {
    return new Promise((resolve) => {
      injectStyles();
      const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const panel = document.querySelector(".product-panel");
      if (reduceMotion || !panel || !cartToggle || productModal.hidden) {
        wiggleCart({ cartToggle, duration: 2000 });
        resolve();
        return;
      }

      const from = panel.getBoundingClientRect();
      const to = cartToggle.getBoundingClientRect();
      const flyer = panel.cloneNode(true);
      flyer.classList.add("cart-flyer");
      flyer.setAttribute("aria-hidden", "true");
      flyer.style.width = `${from.width}px`;
      flyer.style.height = `${from.height}px`;
      flyer.style.left = `${from.left}px`;
      flyer.style.top = `${from.top}px`;
      flyer.style.setProperty("--fly-x", `${to.left + to.width / 2 - (from.left + from.width / 2)}px`);
      flyer.style.setProperty("--fly-y", `${to.top + to.height / 2 - (from.top + from.height / 2)}px`);

      document.body.appendChild(flyer);
      productModal.classList.add("adding-to-cart");

      requestAnimationFrame(() => flyer.classList.add("run"));

      window.setTimeout(() => {
        flyer.remove();
        productModal.classList.remove("adding-to-cart");
        wiggleCart({ cartToggle, duration: 2000 });
        resolve();
      }, 920);
    });
  }

  window.KOLModules.cartAnimation = {
    wiggleCart,
    scheduleReminder,
    animateProductIntoCart
  };
})();
