// ============================================================
// KØL MODÜL: Modern sepete ekleme animasyonu
// Dosya: modules/cart-animation.js
// ------------------------------------------------------------
// Bu dosya opsiyoneldir.
// Silersen site çalışmaya devam eder; sadece sepet animasyonu kapanır.
//
// Türkçe not:
// - Ürün sepete eklenince küçük modern bir kart sepete doğru uçar.
// - Modal açıkken gerçek sepet ikonu arkada kalabildiği için hedefte
//   geçici bir parlayan sepet noktası gösteriyoruz.
// - Animasyon bitince modal kapanır, sonra gerçek sepet ikonu 2 saniye
//   kıpırdar. Böylece mobilde de net görünür.
// ============================================================
(function () {
  "use strict";

  window.KOLModules = window.KOLModules || {};

  let wiggleTimer = null;
  let reminderTimer = null;

  function injectStyles() {
    if (document.getElementById("kol-cart-animation-styles")) return;

    const style = document.createElement("style");
    style.id = "kol-cart-animation-styles";
    style.textContent = `
      .product-modal.adding-to-cart .product-panel {
        opacity: 0.38;
        transform: scale(0.992);
        transition: opacity 180ms ease, transform 180ms ease;
      }

      .kol-cart-flyer {
        position: fixed;
        z-index: 100000;
        pointer-events: none;
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr);
        gap: 10px;
        align-items: center;
        width: min(280px, calc(100vw - 28px));
        min-height: 62px;
        padding: 10px 12px;
        border-radius: 18px;
        background: #ffffff;
        color: #26313c;
        border: 1px solid rgba(0, 0, 0, 0.08);
        box-shadow: 0 18px 46px rgba(0, 0, 0, 0.28);
        transform-origin: center center;
        will-change: transform, opacity, filter;
      }

      .kol-cart-flyer-thumb {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        background: linear-gradient(135deg, #f7be4b, #d96b24);
        background-size: cover;
        background-position: center;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
      }

      .kol-cart-flyer-text {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .kol-cart-flyer-text strong,
      .kol-cart-flyer-text span {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .kol-cart-flyer-text strong {
        font-size: 14px;
        line-height: 1.15;
      }

      .kol-cart-flyer-text span {
        font-size: 12px;
        color: #68737d;
      }

      .kol-cart-flyer.run {
        animation: kolFlyToCart 960ms cubic-bezier(0.18, 0.88, 0.22, 1) forwards;
      }

      @keyframes kolFlyToCart {
        0% {
          transform: translate3d(0, 0, 0) scale(1) rotate(0deg) skew(0deg, 0deg);
          opacity: 1;
          filter: blur(0);
        }
        32% {
          transform: translate3d(calc(var(--fly-x) * 0.22), calc(var(--fly-y) * 0.10 + var(--arc-y)), 0) scale(0.88) rotate(-3deg) skew(-1deg, -2deg);
          opacity: 0.98;
        }
        62% {
          transform: translate3d(calc(var(--fly-x) * 0.66), calc(var(--fly-y) * 0.48 + var(--arc-y) * 0.40), 0) scale(0.48) rotate(9deg) skew(8deg, -10deg);
          opacity: 0.88;
          border-radius: 26px;
        }
        84% {
          transform: translate3d(calc(var(--fly-x) * 0.92), calc(var(--fly-y) * 0.86), 0) scale(0.18) rotate(-14deg) skew(14deg, -16deg);
          opacity: 0.55;
          filter: blur(0.2px);
        }
        100% {
          transform: translate3d(var(--fly-x), var(--fly-y), 0) scale(0.04) rotate(-22deg) skew(18deg, -20deg);
          opacity: 0;
          border-radius: 999px;
          filter: blur(1px);
        }
      }

      .kol-cart-target-flash {
        position: fixed;
        z-index: 99999;
        pointer-events: none;
        width: 54px;
        height: 54px;
        border-radius: 999px;
        background: rgba(207, 102, 0, 0.14);
        box-shadow: 0 0 0 0 rgba(207, 102, 0, 0.34), inset 0 0 0 2px rgba(207, 102, 0, 0.28);
        transform: translate(-50%, -50%) scale(0.72);
        animation: kolCartTargetFlash 980ms ease-out forwards;
      }

      .kol-cart-target-flash::after {
        content: "🛒";
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        font-size: 22px;
      }

      @keyframes kolCartTargetFlash {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.56); box-shadow: 0 0 0 0 rgba(207, 102, 0, 0.34); }
        18% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        72% { opacity: 0.92; box-shadow: 0 0 0 18px rgba(207, 102, 0, 0); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.18); box-shadow: 0 0 0 24px rgba(207, 102, 0, 0); }
      }

      .cart-toggle.kol-cart-wiggle,
      .cart-toggle.cart-wiggle {
        animation: kolCartWiggle 680ms ease-in-out 3;
        transform-origin: 50% 50%;
      }

      .cart-toggle.kol-cart-wiggle #cartCount,
      .cart-toggle.cart-wiggle #cartCount {
        animation: kolCartCountPop 680ms ease-in-out 3;
      }

      @keyframes kolCartWiggle {
        0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
        12% { transform: translate3d(-3px, 0, 0) rotate(-10deg) scale(1.04); }
        24% { transform: translate3d(3px, -1px, 0) rotate(9deg) scale(1.08); }
        38% { transform: translate3d(-2px, 1px, 0) rotate(-7deg) scale(1.05); }
        54% { transform: translate3d(2px, 0, 0) rotate(6deg) scale(1.03); }
        74% { transform: translate3d(-1px, 0, 0) rotate(-3deg) scale(1.01); }
      }

      @keyframes kolCartCountPop {
        0%, 100% { transform: scale(1); }
        35% { transform: scale(1.32); }
        70% { transform: scale(0.92); }
      }

      @media (max-width: 560px) {
        .kol-cart-flyer {
          width: min(245px, calc(100vw - 24px));
          grid-template-columns: 36px minmax(0, 1fr);
          min-height: 56px;
          padding: 9px 10px;
          border-radius: 16px;
        }

        .kol-cart-flyer-thumb {
          width: 36px;
          height: 36px;
          border-radius: 10px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .kol-cart-flyer.run,
        .kol-cart-target-flash,
        .cart-toggle.kol-cart-wiggle,
        .cart-toggle.cart-wiggle,
        .cart-toggle.kol-cart-wiggle #cartCount,
        .cart-toggle.cart-wiggle #cartCount {
          animation: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function isUsableRect(rect) {
    return rect && rect.width > 4 && rect.height > 4 && rect.left > -200 && rect.top > -200;
  }

  // Mobilde sepet ikonu modalın arkasında kalsa bile hedef noktayı sağ üstten hesaplıyoruz.
  function getCartTargetRect(cartToggle) {
    const rect = cartToggle ? cartToggle.getBoundingClientRect() : null;
    if (isUsableRect(rect)) return rect;

    return {
      left: Math.max(12, window.innerWidth - 62),
      top: 8,
      width: 50,
      height: 50
    };
  }

  function getStartRect(productModal) {
    const addButton = document.querySelector("#addConfiguredProduct");
    const photo = productModal?.querySelector?.(".product-photo");
    const panel = productModal?.querySelector?.(".product-panel") || document.querySelector(".product-panel");

    const buttonRect = addButton?.getBoundingClientRect?.();
    if (isUsableRect(buttonRect)) return buttonRect;

    const photoRect = photo?.getBoundingClientRect?.();
    if (isUsableRect(photoRect)) return photoRect;

    const panelRect = panel?.getBoundingClientRect?.();
    if (isUsableRect(panelRect)) return panelRect;

    return {
      left: window.innerWidth / 2 - 120,
      top: window.innerHeight / 2 - 30,
      width: 240,
      height: 60
    };
  }

  function makeFlyer({ productModal, from, to }) {
    const title = productModal?.querySelector?.("#productTitle")?.textContent?.trim() || "Lagt i handlekurv";
    const price = document.querySelector("#productTotal")?.textContent?.trim() || "";
    const image = productModal?.querySelector?.(".product-photo")?.style?.backgroundImage || "";

    const flyer = document.createElement("div");
    flyer.className = "kol-cart-flyer";
    flyer.setAttribute("aria-hidden", "true");
    flyer.innerHTML = `
      <span class="kol-cart-flyer-thumb"></span>
      <span class="kol-cart-flyer-text"><strong></strong><span></span></span>
    `;

    flyer.querySelector("strong").textContent = title;
    flyer.querySelector("span span").textContent = price ? `${price} · lagt til` : "Lagt til";

    const thumb = flyer.querySelector(".kol-cart-flyer-thumb");
    if (image) thumb.style.backgroundImage = image;

    const startLeft = Math.min(Math.max(12, from.left), Math.max(12, window.innerWidth - 292));
    const startTop = Math.min(Math.max(12, from.top), Math.max(12, window.innerHeight - 82));
    const targetX = to.left + to.width / 2 - (startLeft + 140);
    const targetY = to.top + to.height / 2 - (startTop + 31);

    flyer.style.left = `${startLeft}px`;
    flyer.style.top = `${startTop}px`;
    flyer.style.setProperty("--fly-x", `${targetX}px`);
    flyer.style.setProperty("--fly-y", `${targetY}px`);
    flyer.style.setProperty("--arc-y", `${targetY > 0 ? -70 : 55}px`);

    return flyer;
  }

  function showTargetFlash(to) {
    const flash = document.createElement("div");
    flash.className = "kol-cart-target-flash";
    flash.style.left = `${to.left + to.width / 2}px`;
    flash.style.top = `${to.top + to.height / 2}px`;
    document.body.appendChild(flash);
    window.setTimeout(() => flash.remove(), 1100);
  }

  // Sepet ikonunu kısa süre kıpırdatır.
  function wiggleCart({ cartToggle, duration = 2000 }) {
    if (!cartToggle) return;
    injectStyles();

    cartToggle.classList.remove("cart-wiggle", "kol-cart-wiggle");
    void cartToggle.offsetWidth;
    cartToggle.classList.add("kol-cart-wiggle");

    window.clearTimeout(wiggleTimer);
    wiggleTimer = window.setTimeout(() => {
      cartToggle.classList.remove("cart-wiggle", "kol-cart-wiggle");
    }, duration);
  }

  // Sepette ürün varsa 20 saniyede bir hafif hatırlatma yapar.
  function scheduleReminder({ hasItems, cartModal, cartToggle, intervalMs = 20000, duration = 2000 }) {
    window.clearInterval(reminderTimer);
    if (!hasItems) return;

    reminderTimer = window.setInterval(() => {
      const cartIsClosed = !cartModal || cartModal.hidden;
      const productIsOpen = document.body.classList.contains("modal-open");
      if (cartIsClosed && !productIsOpen) wiggleCart({ cartToggle, duration });
    }, intervalMs);
  }

  // Ürünü modern küçük kart olarak sepete doğru uçurur.
  function animateProductIntoCart({ productModal, cartToggle }) {
    return new Promise((resolve) => {
      injectStyles();

      const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const from = getStartRect(productModal);
      const to = getCartTargetRect(cartToggle);

      if (reduceMotion) {
        // Modal kapandıktan sonra görünür olsun diye hafif gecikme veriyoruz.
        window.setTimeout(() => wiggleCart({ cartToggle, duration: 2000 }), 80);
        resolve();
        return;
      }

      const flyer = makeFlyer({ productModal, from, to });
      document.body.appendChild(flyer);
      showTargetFlash(to);
      productModal?.classList?.add("adding-to-cart");

      requestAnimationFrame(() => {
        requestAnimationFrame(() => flyer.classList.add("run"));
      });

      window.setTimeout(() => {
        flyer.remove();
        productModal?.classList?.remove("adding-to-cart");

        // Çok önemli: resolve önce çalışır, app.js modalı kapatır.
        // Sonra 80ms sonra gerçek sepet ikonu kıpırdar. Mobilde artık görünür.
        resolve();
        window.setTimeout(() => wiggleCart({ cartToggle, duration: 2000 }), 80);
      }, 980);
    });
  }

  window.KOLModules.cartAnimation = {
    wiggleCart,
    scheduleReminder,
    animateProductIntoCart
  };
})();
