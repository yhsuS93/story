/* eslint-env browser */
/* =====================================================================
   HERRRING Scroll-Story — Custom Element für Wix (Dev Mode / Velo)
   Ablage:  public/custom-elements/herrring-scrollstory.js
   Tag:     herrring-scrollstory

   Attribute
     frames-base          Pflicht. URL des Desktop-Ordners, mit Schrägstrich am Ende.
                          Erwartet dort f_0001.webp … f_0218.webp
     frames-base-mobile   Optional. Kleinere Sequenz für Geräte unter 768 px.
     frame-count          Optional, Vorgabe 218
     frame-count-mobile   Optional, Vorgabe 110
     bg-color             Optional, Vorgabe #2F2E2E — "transparent" lässt den
                          Wix-Abschnitt durchscheinen
     text-color           Optional, Vorgabe #FFFFFF
     accent-color         Optional, Vorgabe #3EA6FE (Blau der Wortmarke)
     number-color         Optional, Vorgabe #3EA6FE — Alternativen #F66762 oder #FFFFFF
     hud                  Optional, "off" blendet Texte und Fortschrittsleiste aus
     scroll-height        Optional, Vorgabe 300vh

   Die Animation bringt ihren eigenen Hintergrund mit (#2F2E2E). Mit
   bg-color="transparent" scheint stattdessen der Wix-Abschnitt durch.
   ===================================================================== */

const CSS = `
:host, .root { display:block; width:100%; position:relative; background:var(--bg,#2F2E2E); }
*{box-sizing:border-box}
.stage{position:sticky; top:0; height:100svh; overflow:hidden; background:var(--bg,#2F2E2E);
  display:grid; place-items:center}
canvas{display:block; width:100%; height:100%}
.hud{position:absolute; inset:0; pointer-events:none; padding:clamp(20px,5vw,64px);
  display:flex; flex-direction:column; justify-content:space-between;
  font-family:"Courier New",Courier,"Nimbus Mono PS",monospace;
  color:var(--fg,#fff); opacity:var(--hud,1)}
.hud-top{display:flex; justify-content:flex-end; align-items:flex-start}
.display{font-family:"Courier New",Courier,"Nimbus Mono PS",monospace; font-weight:700}
.no{font-size:clamp(40px,7.5vw,92px); line-height:.82; letter-spacing:-.01em;
  color:var(--num,#3EA6FE); opacity:.85; text-shadow:0 2px 16px rgba(0,0,0,.55)}
.cap{max-width:38ch}
.cap .rule{width:34px; height:1px; background:var(--accent,#3EA6FE); margin:0 0 18px;
  transform-origin:left}
.cap h2{margin:0 0 .7rem; font-size:clamp(19px,3.1vw,34px); line-height:1.12;
  letter-spacing:-.01em; text-shadow:0 2px 14px rgba(0,0,0,.7)}
.cap p{margin:0; font-size:clamp(12px,1.35vw,14px); line-height:1.7; opacity:.78;
  max-width:44ch; text-shadow:0 1px 12px rgba(0,0,0,.85)}
.chain{position:absolute; left:clamp(16px,4vw,56px); top:50%; transform:translateY(-50%);
  height:min(46svh,320px); width:44px; pointer-events:none; opacity:var(--hud,1)}
.spine,.fill{position:absolute; left:11px; top:0; width:1px}
.spine{bottom:0; background:var(--fg,#fff); opacity:.18}
.fill{height:0%; background:var(--accent,#3EA6FE)}
.tick{position:absolute; left:0; width:23px; height:1px; background:var(--fg,#fff);
  opacity:.18; transition:opacity .3s}
.tick.on{opacity:.9}
.tick i{position:absolute; left:31px; top:-7px; font-size:10px; letter-spacing:.06em;
  font-style:normal; font-family:"Courier New",Courier,monospace;
  color:var(--fg,#fff); opacity:.45; transition:opacity .3s}
.tick.on i{opacity:1}
.loader{position:absolute; inset:0; display:grid; place-items:center;
  font-family:"Courier New",Courier,monospace; font-size:11px; letter-spacing:.14em;
  color:var(--fg,#fff); opacity:.45; transition:opacity .4s}
.loader.done{opacity:0; pointer-events:none}
@media (max-width:640px){ .cap{max-width:30ch} .chain{display:none} }
`;

/* ==========================================================================
   Transparente Bildsequenz. Kein Hintergrund — der Abschnitt dahinter
   scheint durch. Die drei Videos wurden vorher freigestellt und so
   aufeinander ausgerichtet, dass die Schnittstellen deckungsgleich sind:
   V1 endet auf dem Volumen, mit dem V2 beginnt; V2 endet auf dem Haus,
   mit dem V3 beginnt. Deshalb sind keine Blenden nötig.
   ========================================================================== */
const CHAPTERS = [
  {u:0.00, t:"Entwerfen",
   d:"Am Anfang steht das architektonische Konzept. Aus dem Grundriss entwickelt sich das Volumen — Kubatur, Proportion, Ausrichtung."},
  {u:0.32, t:"Ausarbeiten",
   d:"Das Konzept wird ausgearbeitet. Belichtung und Materialität werden festgelegt, aus dem Volumen wird Architektur."},
  {u:0.63, t:"Analysieren",
   d:"Zum Schluss werden Bauteile und Elemente konfiguriert, analysiert und visualisiert."}
];

const clamp = (v,a,b) => Math.min(b, Math.max(a, v));
const ready = im => !!(im && im.complete && im.naturalWidth);

function chapterAt(p) {
  let i = 0;
  for (let k = 0; k < CHAPTERS.length; k++) if (p >= CHAPTERS[k].u) i = k;
  return i;
}

function makeRenderer(cv, frames) {
  const ctx = cv.getContext("2d");
  let W = 0, H = 0;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function render(p) {
    if (!W) resize();
    ctx.clearRect(0, 0, W, H);
    let i = clamp(Math.round(p*(frames.length-1)), 0, frames.length-1);
    if (!ready(frames[i])) {
      // Sequenz lädt noch: nächstes bereits geladenes Bild nehmen,
      // damit die Fläche nie leer bleibt
      let a = i, b = i;
      while (a > 0 || b < frames.length-1) {
        if (a > 0 && ready(frames[--a])) { i = a; break; }
        if (b < frames.length-1 && ready(frames[++b])) { i = b; break; }
      }
    }
    const im = frames[i];
    if (!ready(im)) return;
    // einpassen, nie beschneiden — die Sequenz hat viel Leerraum
    const s = Math.min(W/im.naturalWidth, H/im.naturalHeight);
    const w = im.naturalWidth*s, h = im.naturalHeight*s;
    ctx.drawImage(im, (W-w)/2, (H-h)/2, w, h);
    return chapterAt(p);
  }

  return { render, resize };
}


/* Wix legt Custom Elements in Container mit fester Höhe und overflow:hidden.
   Dort läuft eine 300vh hohe Scrollstrecke ins Leere. Wir öffnen nur die
   Hüllen, die ausschließlich uns enthalten — fremde Layoutcontainer bleiben
   unangetastet. */
function unclip(host) {
  let n = host.parentElement, i = 0;
  while (n && i < 8 && n !== document.body) {
    if (n.childElementCount !== 1) break;
    n.style.height = "auto";
    n.style.minHeight = "0";
    n.style.maxHeight = "none";
    n.style.overflow = "visible";
    n = n.parentElement; i++;
  }
}

function boot(root, host, opt) {
  const cv = root.querySelector("canvas");
  const capT = root.querySelector(".cap h2");
  const capD = root.querySelector(".cap p");
  const rule = root.querySelector(".cap .rule");
  const noEl = root.querySelector(".no");
  const fill = root.querySelector(".fill");
  const ticks = [...root.querySelectorAll(".tick")];
  const loader = root.querySelector(".loader");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const mobile = innerWidth < 768;
  const base = (mobile && opt.mobileBase) ? opt.mobileBase : opt.base;
  const count = (mobile && opt.mobileBase) ? opt.mobileCount : opt.count;

  const frames = new Array(count);
  let R = null, chapter = -1, done = 0, started = false;
  const OPEN_AT = Math.max(1, Math.ceil(count*0.35));

  for (let i = 0; i < count; i++) {
    const im = new Image();
    im.decoding = "async";
    im.onload = im.onerror = () => {
      done++;
      loader.textContent = "LADE SEQUENZ  " + Math.round(done/count*100) + "%";
      if (!started && done >= OPEN_AT) { started = true; start(); }
      else if (started && R) paint(lastP);
    };
    im.src = base + "f_" + String(i+1).padStart(4, "0") + ".webp";
    frames[i] = im;
  }

  const gsapOk = () => !!(window.gsap && window.ScrollTrigger);

  function setChapter(i) {
    if (i === chapter || i == null) return;
    const first = chapter < 0;
    chapter = i;
    const write = () => {
      capT.textContent = CHAPTERS[i].t;
      capD.textContent = CHAPTERS[i].d;
      noEl.textContent = String(i+1).padStart(2, "0");
    };
    ticks.forEach((el, k) => el.classList.toggle("on", k <= i));
    if (reduce || !gsapOk()) { write(); return; }
    if (first) {
      write();
      window.gsap.fromTo([capT, capD], {y:12, opacity:0},
        {y:0, opacity:1, duration:.5, stagger:.06, ease:"power2.out"});
      window.gsap.fromTo(rule, {scaleX:0}, {scaleX:1, duration:.5, ease:"power2.out"});
      return;
    }
    window.gsap.to([capT, capD], {
      y:-10, opacity:0, duration:.22, ease:"power2.in",
      onComplete: () => {
        write();
        window.gsap.fromTo([capT, capD], {y:12, opacity:0},
          {y:0, opacity:1, duration:.5, stagger:.06, ease:"power2.out"});
        window.gsap.fromTo(rule, {scaleX:0}, {scaleX:1, duration:.45, ease:"power2.out"});
      }
    });
  }

  let lastP = 0;
  function paint(p) {
    lastP = p;
    setChapter(R.render(p));
    fill.style.height = (p*100) + "%";
  }

  function start() {
    loader.classList.add("done");
    R = makeRenderer(cv, frames);
    R.resize();

    unclip(host);
    const span = host.getBoundingClientRect().height - innerHeight;
    if (span <= 0) {
      console.warn(
        "[scrollstory] Keine Scrollstrecke: Elementhöhe " +
        Math.round(host.getBoundingClientRect().height) + "px bei Fensterhöhe " +
        innerHeight + "px. Der umgebende Wix-Container begrenzt die Höhe — " +
        "Sektion auf 'auto' stellen oder das Element im Editor höher ziehen."
      );
    }

    if (gsapOk()) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      const proxy = { p: 0 };
      window.gsap.to(proxy, {
        p: 1, ease: "none",
        onUpdate: () => paint(proxy.p),
        scrollTrigger: {
          trigger: host, start: "top top", end: "bottom bottom",
          scrub: reduce ? true : 0.5, invalidateOnRefresh: true
        }
      });
      window.ScrollTrigger.addEventListener("refreshInit", () => R.resize());
      addEventListener("resize", () => { R.resize(); window.ScrollTrigger.refresh(); }, {passive:true});
      paint(0);
    } else {
      let target = 0, cur = 0, raf = null;
      const progress = () => {
        const r = host.getBoundingClientRect();
        const span = r.height - innerHeight;
        return span <= 0 ? 0 : clamp(-r.top/span, 0, 1);
      };
      const tick = () => {
        cur += (target - cur)*0.18;
        if (Math.abs(target - cur) < 0.0004) { cur = target; raf = null; }
        else raf = requestAnimationFrame(tick);
        paint(cur);
      };
      const onScroll = () => {
        target = progress();
        if (reduce) { cur = target; paint(cur); return; }
        if (!raf) raf = requestAnimationFrame(tick);
      };
      addEventListener("scroll", onScroll, {passive:true});
      addEventListener("resize", () => { R.resize(); onScroll(); }, {passive:true});
      onScroll(); paint(0);
    }
  }
}


const GSAP_URLS = [
  "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"
];

function loadScript(src) {
  return new Promise(res => {
    if ([...document.scripts].some(s => s.src === src)) return res();
    const s = document.createElement("script");
    s.src = src; s.async = false;
    s.onload = s.onerror = () => res();
    document.head.appendChild(s);
  });
}

async function ensureGsap() {
  if (window.gsap && window.ScrollTrigger) return;
  for (const u of GSAP_URLS) await loadScript(u);
}

class HerrringScrollStory extends HTMLElement {
  async connectedCallback() {
    const attr = (n, d) => this.getAttribute(n) || d;
    const slash = s => s ? s.replace(/\/?$/, "/") : "";
    const root = this.attachShadow({mode:"open"});
    root.innerHTML = "<style>" + CSS + "</style>" + `
<div class="stage">
  <canvas></canvas>
  <div class="hud">
    <div class="hud-top">
      <div class="no display">01</div>
    </div>
    <div class="cap">
      <div class="rule"></div>
      <h2 class="display"></h2>
      <p></p>
    </div>
  </div>
  <div class="chain"><div class="spine"></div><div class="fill"></div><div class="tick" style="top:0.0000%"><i>01</i></div><div class="tick" style="top:50.0000%"><i>02</i></div><div class="tick" style="top:100.0000%"><i>03</i></div></div>
  <div class="loader">LADE SEQUENZ</div>
</div>
`;

    this.style.display = "block";
    this.style.position = "relative";
    this.style.setProperty("height", attr("scroll-height", "300vh"), "important");
    this.style.setProperty("max-height", "none", "important");
    this.style.setProperty("--bg", attr("bg-color", "#2F2E2E"));
    this.style.setProperty("--fg", attr("text-color", "#FFFFFF"));
    this.style.setProperty("--accent", attr("accent-color", "#3EA6FE"));
    this.style.setProperty("--num", attr("number-color", "#3EA6FE"));
    if (attr("hud", "on") === "off") this.style.setProperty("--hud", "0");

    await ensureGsap();
    boot(root, this, {
      base:        slash(attr("frames-base", "")),
      count:       parseInt(attr("frame-count", "218"), 10),
      mobileBase:  slash(attr("frames-base-mobile", "")),
      mobileCount: parseInt(attr("frame-count-mobile", "110"), 10)
    });
  }
}

if (!customElements.get("herrring-scrollstory")) {
  customElements.define("herrring-scrollstory", HerrringScrollStory);
}
