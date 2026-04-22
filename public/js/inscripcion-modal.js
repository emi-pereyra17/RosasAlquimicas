/**
 * Modal de inscripción / pago (pasos 1–2–3).
 * En cada página: botones con data-inscripcion-modal, data-producto, data-precio-badge.
 * Opcional: data-mp-url en el botón o window.ROSAS_MERCADOPAGO_URL (un solo link ARS, modo clásico).
 * Opcional: data-mp-url-mensual + data-mp-url-anual (dos links Mercado Pago en ARS) o
 *   window.ROSAS_MERCADOPAGO_URL_MENSUAL / ROSAS_MERCADOPAGO_URL_ANUAL.
 * Opcional: data-inscripcion-pla="mensual" o "anual" — con ambas URLs, abre un solo
 *   flujo de pago (cuota o plan anual) en lugar de los dos botones en el modal.
 * data-mp-sin-enlace="true": los botones de Mercado Pago no navegan (enlace pendiente).
 * Si no hay link de MP y no va data-mp-sin-enlace, el botón de pago abre WhatsApp pidiendo el enlace a Carla.
 */
(function () {
  "use strict";

  var WA_NUMBER = "34641091383";
  var EMAIL = "soycarlacalcaterra@gmail.com";

  var overlay = null;
  var dialogEl = null;
  var lastFocus = null;
  var mpNavPreventDefault = function (e) {
    e.preventDefault();
  };

  function injectStyles() {
    if (document.getElementById("rosas-inscripcion-modal-styles")) return;
    var s = document.createElement("style");
    s.id = "rosas-inscripcion-modal-styles";
    s.textContent =
      "#rosas-inscripcion-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box;}" +
      "#rosas-inscripcion-overlay[hidden]{display:none!important;}" +
      ".rosas-imodal-backdrop{position:absolute;inset:0;background:rgba(46,16,101,0.45);backdrop-filter:blur(4px);}" +
      ".rosas-imodal-panel{position:relative;z-index:1;width:100%;max-width:32rem;max-height:min(92vh,900px);overflow-y:auto;background:#fff;border-radius:1.25rem;box-shadow:0 25px 50px -12px rgba(46,16,101,0.35);padding:1.75rem 1.5rem 2rem;font-family:Montserrat,system-ui,sans-serif;color:#2e1065;scrollbar-width:thin;scrollbar-color:#ddd6fe #fafafa;}" +
      ".rosas-imodal-panel::-webkit-scrollbar{width:11px;}" +
      ".rosas-imodal-panel::-webkit-scrollbar-track{background:#f8fafc;border-radius:999px;margin:6px 0;}" +
      ".rosas-imodal-panel::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#ede9fe,#e9d5ff);border-radius:999px;border:3px solid #fafafa;}" +
      ".rosas-imodal-panel::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,#ddd6fe,#d8b4fe);}" +
      "@media(min-width:640px){.rosas-imodal-panel{padding:2rem 2.25rem 2.25rem;max-width:36rem;}}" +
      ".rosas-imodal-close{position:absolute;top:0.75rem;right:0.75rem;width:2.5rem;height:2.5rem;border:none;border-radius:9999px;background:rgba(139,92,246,0.12);color:#5b21b6;font-size:1.5rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;}" +
      ".rosas-imodal-close:hover{background:rgba(139,92,246,0.22);}" +
      ".rosas-imodal-close:focus-visible{outline:2px solid #a855f7;outline-offset:2px;}" +
      ".rosas-imodal-h1{font-family:Quicksand,Montserrat,sans-serif;font-weight:700;font-size:1.5rem;line-height:1.2;margin:0 0 0.35rem;color:#2e1065;}" +
      "@media(min-width:640px){.rosas-imodal-h1{font-size:1.75rem;}}" +
      ".rosas-imodal-sub{font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:1rem;line-height:1.35;margin:0 0 1.25rem;color:#7c3aed;}" +
      "@media(min-width:640px){.rosas-imodal-sub{font-size:1.125rem;}}" +
      ".rosas-imodal-badge{display:block;text-align:center;border:1px solid rgba(109,40,217,0.35);border-radius:9999px;padding:0.65rem 1rem;font-size:0.875rem;line-height:1.45;color:#4c1d95;margin-bottom:1.75rem;background:linear-gradient(135deg,#faf5ff 0%,#fff7ed 100%);}" +
      ".rosas-imodal-step{display:flex;gap:0.85rem;margin-bottom:1.75rem;align-items:flex-start;}" +
      ".rosas-imodal-step:last-of-type{margin-bottom:0;}" +
      ".rosas-imodal-num{flex-shrink:0;width:2rem;height:2rem;border:1.5px solid #6d28d9;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.9rem;color:#5b21b6;}" +
      ".rosas-imodal-step-body{flex:1;min-width:0;}" +
      ".rosas-imodal-step-title{font-weight:700;font-size:0.95rem;color:#2e1065;margin:0 0 0.35rem;}" +
      ".rosas-imodal-step-p{font-size:0.8125rem;line-height:1.55;color:#4c1d95;margin:0 0 0.75rem;}" +
      ".rosas-imodal-btn-mp{display:flex;width:100%;justify-content:center;align-items:center;gap:0.35rem;border:none;border-radius:9999px;padding:0.85rem 1.25rem;font-weight:700;font-size:0.9rem;color:#fff;cursor:pointer;background:linear-gradient(135deg,#7c3aed 0%,#c026d3 100%);box-shadow:0 8px 20px -6px rgba(109,40,217,0.55);text-decoration:none;transition:filter .15s,transform .1s;}" +
      ".rosas-imodal-btn-mp:hover{filter:brightness(1.06);}" +
      ".rosas-imodal-btn-mp:focus-visible{outline:2px solid #a855f7;outline-offset:2px;}" +
      ".rosas-imodal-btn-mp[aria-disabled='true']{cursor:not-allowed;opacity:0.78;filter:grayscale(0.15);}" +
      ".rosas-imodal-link-transfer{display:block;margin-top:0.65rem;font-size:0.8125rem;color:#6d28d9;text-align:center;}" +
      ".rosas-imodal-link-transfer a{color:inherit;text-decoration:underline;text-underline-offset:2px;}" +
      ".rosas-imodal-tip{display:flex;gap:0.65rem;align-items:flex-start;background:#fffbeb;border-left:3px solid #d97706;padding:0.75rem 0.85rem;border-radius:0 0.5rem 0.5rem 0;margin-top:0.5rem;font-size:0.75rem;line-height:1.5;color:#713f12;}" +
      ".rosas-imodal-tip-icon{flex-shrink:0;font-size:1rem;}" +
      ".rosas-imodal-btn-wa{display:inline-flex;width:100%;justify-content:center;align-items:center;gap:0.5rem;border:none;border-radius:9999px;padding:0.85rem 1.25rem;font-weight:700;font-size:0.9rem;color:#fff;cursor:pointer;background:#25d366;box-shadow:0 8px 20px -6px rgba(37,211,102,0.45);text-decoration:none;transition:filter .15s;}" +
      ".rosas-imodal-btn-wa:hover{filter:brightness(1.05);background:#20bd5a;}" +
      ".rosas-imodal-btn-wa:focus-visible{outline:2px solid #15803d;outline-offset:2px;}" +
      ".rosas-imodal-btn-wa svg{width:1.35rem;height:1.35rem;flex-shrink:0;}";
    document.head.appendChild(s);
  }

  function ensureModal() {
    if (document.getElementById("rosas-inscripcion-overlay")) {
      overlay = document.getElementById("rosas-inscripcion-overlay");
      dialogEl = overlay.querySelector(".rosas-imodal-panel");
      return;
    }
    overlay = document.createElement("div");
    overlay.id = "rosas-inscripcion-overlay";
    overlay.setAttribute("hidden", "");
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML =
      '<div class="rosas-imodal-backdrop" data-rosas-imodal-close tabindex="-1"></div>' +
      '<div class="rosas-imodal-panel" role="dialog" aria-modal="true" aria-labelledby="rosas-imodal-title">' +
      '<button type="button" class="rosas-imodal-close" data-rosas-imodal-close aria-label="Cerrar">×</button>' +
      '<h2 id="rosas-imodal-title" class="rosas-imodal-h1">Cómo inscribirte</h2>' +
      '<p class="rosas-imodal-sub">al <span id="rosas-imodal-producto"></span></p>' +
      '<p id="rosas-imodal-precio" class="rosas-imodal-badge" role="status"></p>' +
      '<div class="rosas-imodal-step">' +
      '<span class="rosas-imodal-num" aria-hidden="true">1</span>' +
      '<div class="rosas-imodal-step-body">' +
      '<h3 class="rosas-imodal-step-title">Elegí tu forma de pago</h3>' +
      '<p id="rosas-imodal-ars-p" class="rosas-imodal-step-p" style="margin-bottom:0.65rem"></p>' +
      '<div id="rosas-imodal-mp-legacy-wrap">' +
      '<a id="rosas-imodal-mp" class="rosas-imodal-btn-mp" href="#" target="_blank" rel="noopener noreferrer">👉 Pagar con Mercado Pago (ARS)</a>' +
      "</div>" +
      '<div id="rosas-imodal-mp-dual-wrap" hidden>' +
      '<a id="rosas-imodal-mp-mensual" class="rosas-imodal-btn-mp" href="#" target="_blank" rel="noopener noreferrer">💳 Membresía mensual (ARS)</a>' +
      '<a id="rosas-imodal-mp-anual" class="rosas-imodal-btn-mp" style="margin-top:0.5rem" href="#" target="_blank" rel="noopener noreferrer">💳 Membresía anual — pago único (ARS)</a>' +
      "</div>" +
      '<p id="rosas-imodal-forex-p" class="rosas-imodal-step-p" style="margin-top:1rem;margin-bottom:0.35rem"></p>' +
      '<a id="rosas-imodal-wa-forex" class="rosas-imodal-btn-wa" href="#" target="_blank" rel="noopener noreferrer">' +
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:1.35rem;height:1.35rem;flex-shrink:0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.883 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
      "Coordinar pago en USD o EUR</a></div></div>" +
      '<div class="rosas-imodal-step">' +
      '<span class="rosas-imodal-num" aria-hidden="true">2</span>' +
      '<div class="rosas-imodal-step-body">' +
      '<h3 class="rosas-imodal-step-title">Guardá el comprobante de pago</h3>' +
      '<p class="rosas-imodal-step-p">Después de pagar, guardá el comprobante o el registro del pago (en Mercado Pago, o lo que Carla te indique si abonaste por WhatsApp).</p>' +
      '<div class="rosas-imodal-tip"><span class="rosas-imodal-tip-icon" aria-hidden="true">💡</span><span>Si pagaste con Mercado Pago y ves <strong>Volver al sitio</strong>, podés usarla para regresar acá y seguir con el paso 3.</span></div>' +
      "</div></div>" +
      '<div class="rosas-imodal-step">' +
      '<span class="rosas-imodal-num" aria-hidden="true">3</span>' +
      '<div class="rosas-imodal-step-body">' +
      '<h3 class="rosas-imodal-step-title">Escribile a Carla por WhatsApp</h3>' +
      '<p class="rosas-imodal-step-p">Enviá el comprobante, tu mail y tu nombre completo para confirmar tu lugar.</p>' +
      '<a id="rosas-imodal-wa" class="rosas-imodal-btn-wa" href="#" target="_blank" rel="noopener noreferrer">' +
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.883 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
      "Escribirle a Carla</a></div></div></div>";
    document.body.appendChild(overlay);

    dialogEl = overlay.querySelector(".rosas-imodal-panel");

    overlay.addEventListener("click", function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute("data-rosas-imodal-close") != null) closeModal();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay && !overlay.hasAttribute("hidden")) {
        e.preventDefault();
        closeModal();
      }
    });
  }

  function resolveMpUrl(btnMpUrl) {
    var fromBtn = (btnMpUrl || "").trim();
    if (fromBtn) return fromBtn;
    if (typeof window !== "undefined" && window.ROSAS_MERCADOPAGO_URL) {
      var g = String(window.ROSAS_MERCADOPAGO_URL).trim();
      if (g) return g;
    }
    return "";
  }

  function resolveDualMpUrl(attrVal, winKey) {
    var a = (attrVal || "").trim();
    if (a) return a;
    if (typeof window !== "undefined" && window[winKey]) {
      var w = String(window[winKey]).trim();
      if (w) return w;
    }
    return "";
  }

  function mpFallbackWa(producto) {
    var t =
      "Hola Carla, ¿me pasás el link de Mercado Pago para inscribirme a " + producto + "? Gracias.";
    return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(t);
  }

  function waUrl(producto) {
    var t =
      "Hola Carla, te envío el comprobante de pago de la inscripción a *" +
      producto +
      "*.\n\n" +
      "Mi nombre completo:\n" +
      "Mi email:\n\n" +
      "Gracias.";
    return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(t);
  }

  function waUrlCoordinarForex(producto, frecuencia, pla) {
    var t;
    if (frecuencia && pla === "mensual") {
      t =
        "Hola Carla, quiero coordinar el pago en *dólares o euros* de la *cuota mensual* de: *" +
        producto +
        "*. Gracias.";
    } else if (frecuencia && pla === "anual") {
      t =
        "Hola Carla, quiero coordinar el pago en *dólares o euros* del *plan anual* (pago único) de: *" +
        producto +
        "*. Gracias.";
    } else if (frecuencia && !pla) {
      t =
        "Hola Carla, quiero coordinar el pago en *dólares o euros* de la inscripción a *" +
        producto +
        "* (mensual o anual, según acordemos). Gracias.";
    } else {
      t =
        "Hola Carla, quiero coordinar el pago en *dólares o euros* de la inscripción a *" +
        producto +
        "*. Gracias.";
    }
    return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(t);
  }

  function transferMailto(producto) {
    var subj = "Transferencia — " + producto;
    var body =
      "Hola Carla,\n\nQuiero abonar por transferencia la inscripción a: " +
      producto +
      ".\n\nGracias.";
    return (
      "mailto:" +
      EMAIL +
      "?subject=" +
      encodeURIComponent(subj) +
      "&body=" +
      encodeURIComponent(body)
    );
  }

  function openModal(opts) {
    lastFocus = document.activeElement;
    var producto = opts.producto || "esta propuesta";
    var precioBadge = opts.precioBadge || "";
    var mpUrl = resolveMpUrl(opts.mpUrl);
    var mpMensual = resolveDualMpUrl(
      opts.mpUrlMensual,
      "ROSAS_MERCADOPAGO_URL_MENSUAL"
    );
    var mpAnual = resolveDualMpUrl(
      opts.mpUrlAnual,
      "ROSAS_MERCADOPAGO_URL_ANUAL"
    );
    var frecuencia = !!(mpMensual && mpAnual);
    var pla = (opts.pla || "").trim().toLowerCase();
    if (pla !== "mensual" && pla !== "anual") pla = "";
    var useDual = frecuencia && !pla;

    document.getElementById("rosas-imodal-producto").textContent = producto;
    document.getElementById("rosas-imodal-precio").textContent = precioBadge;

    var wrapLegacy = document.getElementById("rosas-imodal-mp-legacy-wrap");
    var wrapDual = document.getElementById("rosas-imodal-mp-dual-wrap");
    var mpA = document.getElementById("rosas-imodal-mp");
    var mpM = document.getElementById("rosas-imodal-mp-mensual");
    var mpN = document.getElementById("rosas-imodal-mp-anual");

    mpA.removeEventListener("click", mpNavPreventDefault);
    if (mpM) mpM.removeEventListener("click", mpNavPreventDefault);
    if (mpN) mpN.removeEventListener("click", mpNavPreventDefault);

    if (useDual) {
      if (wrapLegacy) wrapLegacy.setAttribute("hidden", "");
      if (wrapDual) wrapDual.removeAttribute("hidden");
      if (opts.mpSinEnlace) {
        if (mpM) {
          mpM.href = "#";
          mpM.setAttribute("aria-disabled", "true");
          mpM.addEventListener("click", mpNavPreventDefault);
        }
        if (mpN) {
          mpN.href = "#";
          mpN.setAttribute("aria-disabled", "true");
          mpN.addEventListener("click", mpNavPreventDefault);
        }
      } else {
        if (mpM) {
          mpM.removeAttribute("aria-disabled");
          mpM.href = mpMensual;
        }
        if (mpN) {
          mpN.removeAttribute("aria-disabled");
          mpN.href = mpAnual;
        }
      }
    } else {
      if (wrapDual) wrapDual.setAttribute("hidden", "");
      if (wrapLegacy) wrapLegacy.removeAttribute("hidden");
      var resolvedSingle = mpUrl;
      if (pla === "mensual" && mpMensual) resolvedSingle = mpMensual;
      else if (pla === "anual" && mpAnual) resolvedSingle = mpAnual;
      else if (!resolvedSingle) resolvedSingle = mpMensual || mpAnual || "";
      if (opts.mpSinEnlace) {
        mpA.href = "#";
        mpA.setAttribute("aria-disabled", "true");
        mpA.addEventListener("click", mpNavPreventDefault);
      } else {
        mpA.removeAttribute("aria-disabled");
        mpA.href = resolvedSingle || mpFallbackWa(producto);
      }
    }

    var waForex = document.getElementById("rosas-imodal-wa-forex");
    if (waForex) {
      waForex.href = waUrlCoordinarForex(producto, frecuencia, pla);
    }
    var forexP = document.getElementById("rosas-imodal-forex-p");
    if (forexP) {
      if (useDual) {
        forexP.innerHTML =
          "<strong>Euros (€) o dólares (USD):</strong> el pago no va por Mercado Pago; escribile a Carla por WhatsApp para coordinar (mensual: 33 € o 33 USD; anual: 222 € o 222 USD, según el plan que elijas).";
      } else if (frecuencia && pla === "mensual") {
        forexP.innerHTML =
          "<strong>Euros (€) o dólares (USD):</strong> el pago no va por Mercado Pago; escribile a Carla por WhatsApp para coordinar (cuota mensual: 33 € o 33 USD).";
      } else if (frecuencia && pla === "anual") {
        forexP.innerHTML =
          "<strong>Euros (€) o dólares (USD):</strong> el pago no va por Mercado Pago; escribile a Carla por WhatsApp para coordinar (plan anual, pago único: 222 € o 222 USD).";
      } else {
        forexP.innerHTML =
          "<strong>Euros (€) o dólares (USD):</strong> escribile a Carla por WhatsApp para coordinar el pago.";
      }
    }
    var arsP = document.getElementById("rosas-imodal-ars-p");
    if (arsP) {
      if (useDual) {
        arsP.innerHTML =
          "<strong>Pesos argentinos (ARS):</strong> con Mercado Pago podés abonar <strong>por mes</strong> o el <strong>plan anual</strong> (pago único).";
      } else if (frecuencia && pla === "mensual") {
        arsP.innerHTML =
          "<strong>Pesos argentinos (ARS):</strong> con Mercado Pago podés abonar la <strong>cuota mensual</strong> de la membresía.";
      } else if (frecuencia && pla === "anual") {
        arsP.innerHTML =
          "<strong>Pesos argentinos (ARS):</strong> con Mercado Pago podés abonar el <strong>plan anual</strong> (pago único).";
      } else {
        arsP.innerHTML =
          "<strong>Pesos argentinos (ARS):</strong> Mercado Pago te permite usar diferentes medios de pago.";
      }
    }
    document.getElementById("rosas-imodal-wa").href = waUrl(producto);

    overlay.removeAttribute("hidden");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    var closeBtn = overlay.querySelector(".rosas-imodal-close");
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!overlay) return;
    var mpA = document.getElementById("rosas-imodal-mp");
    if (mpA) {
      mpA.removeEventListener("click", mpNavPreventDefault);
    }
    var mpM = document.getElementById("rosas-imodal-mp-mensual");
    var mpN = document.getElementById("rosas-imodal-mp-anual");
    if (mpM) mpM.removeEventListener("click", mpNavPreventDefault);
    if (mpN) mpN.removeEventListener("click", mpNavPreventDefault);
    overlay.setAttribute("hidden", "");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocus && typeof lastFocus.focus === "function") {
      try {
        lastFocus.focus();
      } catch (e) {}
    }
  }

  function bindTriggers() {
    document.querySelectorAll("[data-inscripcion-modal]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openModal({
          producto: btn.getAttribute("data-producto") || "",
          precioBadge: btn.getAttribute("data-precio-badge") || "",
          mpUrl: btn.getAttribute("data-mp-url"),
          mpUrlMensual: btn.getAttribute("data-mp-url-mensual"),
          mpUrlAnual: btn.getAttribute("data-mp-url-anual"),
          pla: btn.getAttribute("data-inscripcion-pla"),
          mpSinEnlace: btn.getAttribute("data-mp-sin-enlace") === "true",
        });
      });
    });
  }

  function init() {
    injectStyles();
    ensureModal();
    bindTriggers();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
