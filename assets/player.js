/* Protected course player
   - Encrypted HLS (AES-128). Playlists come signed from the "play" edge function, key only for the active device.
   - Moving watermark with the student's email/phone, re-created if removed (video pauses meanwhile).
   - No download/PiP/context menu, pauses when the tab is hidden, fullscreen keeps the watermark. */
const Player = (() => {
  let hls = null, el = null, video = null, mark = null, wmTimer = null, blobs = [], onTime = null, wmText = "";
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function build(host) {
    host.innerHTML = `
      <div class="pl" tabindex="0">
        <video playsinline webkit-playsinline disablepictureinpicture disableremoteplayback controlslist="nodownload noplaybackrate noremoteplayback" preload="metadata"></video>
        <div class="pl-shield"></div>
        <div class="pl-wm" aria-hidden="true"></div>
        <div class="pl-wm2" aria-hidden="true"></div>
        <div class="pl-center"><button class="pl-big" type="button" aria-label="Play"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/></svg></button></div>
        <div class="pl-spin" hidden></div>
        <div class="pl-msg" hidden></div>
        <div class="pl-bar">
          <button class="pl-b pl-pp" type="button" aria-label="Play/Pause"><svg viewBox="0 0 24 24"><path class="i-play" d="M7 4.5v15l12.5-7.5z" fill="currentColor"/><g class="i-pause" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></g></svg></button>
          <button class="pl-b pl-back" type="button" aria-label="10 second peeche"><svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a6 6 0 11-6 6H4a8 8 0 108-8z" fill="currentColor"/><text x="12" y="16.5" font-size="6.5" text-anchor="middle" fill="currentColor" font-family="sans-serif" font-weight="700">10</text></svg></button>
          <div class="pl-time mono"><span class="pl-cur">0:00</span> / <span class="pl-dur">0:00</span></div>
          <div class="pl-seek"><div class="pl-buf"></div><div class="pl-fill"></div><input type="range" min="0" max="1000" value="0" aria-label="Seek"></div>
          <button class="pl-b pl-speed mono" type="button" aria-label="Speed">1x</button>
          <button class="pl-b pl-q mono" type="button" aria-label="Quality">Auto</button>
          <button class="pl-b pl-mute" type="button" aria-label="Mute"><svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path class="i-vol" d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg></button>
          <button class="pl-b pl-fs" type="button" aria-label="Full screen"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg></button>
        </div>
        <div class="pl-blackout" hidden>Recording allowed nahi hai</div>
      </div>`;
    el = host.querySelector(".pl"); video = el.querySelector("video"); mark = el.querySelector(".pl-wm");
    wire();
  }

  const fmtT = (s) => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`; };
  const q = (s) => el.querySelector(s);

  function wire() {
    const pp = () => (video.paused ? video.play().catch(() => {}) : video.pause());
    q(".pl-big").onclick = pp; q(".pl-pp").onclick = pp; q(".pl-shield").onclick = pp;
    q(".pl-shield").ondblclick = () => toggleFs();
    q(".pl-back").onclick = () => (video.currentTime = Math.max(0, video.currentTime - 10));
    video.addEventListener("play", () => el.classList.add("playing"));
    video.addEventListener("pause", () => el.classList.remove("playing"));
    video.addEventListener("waiting", () => (q(".pl-spin").hidden = false));
    video.addEventListener("playing", () => (q(".pl-spin").hidden = true));
    video.addEventListener("canplay", () => (q(".pl-spin").hidden = true));
    video.addEventListener("loadedmetadata", () => (q(".pl-dur").textContent = fmtT(video.duration)));
    const seek = q(".pl-seek input");
    video.addEventListener("timeupdate", () => {
      q(".pl-cur").textContent = fmtT(video.currentTime);
      const p = video.duration ? video.currentTime / video.duration : 0;
      q(".pl-fill").style.width = p * 100 + "%"; if (!seek.matches(":active")) seek.value = Math.round(p * 1000);
      onTime && onTime(video.currentTime, video.duration);
    });
    video.addEventListener("progress", () => { try { const b = video.buffered; if (b.length && video.duration) q(".pl-buf").style.width = (b.end(b.length - 1) / video.duration) * 100 + "%"; } catch {} });
    seek.addEventListener("input", () => { if (video.duration) video.currentTime = (seek.value / 1000) * video.duration; });
    const speeds = [1, 1.25, 1.5, 1.75, 2, 0.75];
    q(".pl-speed").onclick = (e) => { const i = (speeds.indexOf(video.playbackRate) + 1) % speeds.length; video.playbackRate = speeds[i]; e.currentTarget.textContent = speeds[i] + "x"; };
    q(".pl-mute").onclick = () => { video.muted = !video.muted; el.classList.toggle("muted", video.muted); };
    q(".pl-q").onclick = (e) => {
      if (!hls) return;
      const lv = hls.levels.map((l, i) => ({ i, h: l.height })).sort((a, b) => b.h - a.h);
      const order = [-1, ...lv.map((x) => x.i)];
      const next = order[(order.indexOf(hls.currentLevel === -1 || hls.autoLevelEnabled ? -1 : hls.currentLevel) + 1) % order.length];
      hls.currentLevel = next; e.currentTarget.textContent = next === -1 ? "Auto" : hls.levels[next].height + "p";
    };
    q(".pl-fs").onclick = toggleFs;
    el.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "k") { e.preventDefault(); pp(); }
      if (e.key === "ArrowRight") video.currentTime += 10;
      if (e.key === "ArrowLeft") video.currentTime -= 10;
      if (e.key === "f") toggleFs();
    });
    let idle; el.addEventListener("pointermove", () => { el.classList.add("ui"); clearTimeout(idle); idle = setTimeout(() => el.classList.remove("ui"), 2600); });

    // deterrents
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    video.addEventListener("enterpictureinpicture", () => document.exitPictureInPicture && document.exitPictureInPicture());
    document.addEventListener("visibilitychange", () => { if (document.hidden && video && !video.paused) video.pause(); });
    addEventListener("keyup", (e) => { if (e.key === "PrintScreen") blackout(); });
    addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["s", "u", "p"].includes(k)) e.preventDefault();
      if (e.metaKey && e.shiftKey && ["3", "4", "5"].includes(k)) blackout();
    });
  }
  function blackout() { const b = q(".pl-blackout"); if (!b) return; video.pause(); b.hidden = false; setTimeout(() => (b.hidden = true), 2500); }

  function toggleFs() {
    const doc = document;
    if (doc.fullscreenElement || doc.webkitFullscreenElement || el.classList.contains("pseudo-fs")) {
      if (doc.exitFullscreen && doc.fullscreenElement) doc.exitFullscreen(); else if (doc.webkitExitFullscreen && doc.webkitFullscreenElement) doc.webkitExitFullscreen();
      el.classList.remove("pseudo-fs"); document.body.classList.remove("no-scroll"); return;
    }
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req && !isIOS) { req.call(el).then?.(() => screen.orientation?.lock?.("landscape").catch(() => {})).catch(() => {}); }
    else { el.classList.add("pseudo-fs"); document.body.classList.add("no-scroll"); } // iPhone: keep our own fullscreen so the watermark stays on top
  }

  function startWatermark(m) {
    wmText = [m.email, m.phone, m.id].filter(Boolean).join("  ·  ");
    const place = () => {
      if (!el) return;
      if (!el.contains(mark)) { // removed via devtools: rebuild and pause
        video.pause(); mark = document.createElement("div"); mark.className = "pl-wm"; el.append(mark);
      }
      mark.textContent = wmText;
      mark.style.left = 4 + Math.random() * 58 + "%"; mark.style.top = 6 + Math.random() * 76 + "%";
      const w2 = q(".pl-wm2"); if (w2) w2.textContent = wmText;
    };
    place(); clearInterval(wmTimer); wmTimer = setInterval(place, 4500);
    const hiddenMark = () => { const cs = getComputedStyle(mark); return cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.1; };
    new MutationObserver(() => { if (!el.contains(mark)) { video.pause(); place(); } }).observe(el, { childList: true });
    setInterval(() => { if (el && el.contains(mark) && hiddenMark() && !video.paused) { video.pause(); mark.removeAttribute("class"); mark.className = "pl-wm"; mark.removeAttribute("style"); place(); } }, 1500);
  }

  function message(html) { const m = q(".pl-msg"); m.innerHTML = html; m.hidden = !html; }

  async function load(host, slug, opts = {}) {
    destroy(); build(host); onTime = opts.onTime || null;
    q(".pl-spin").hidden = false;
    const r = await fn("acad-play", { slug, device: DEVICE });
    q(".pl-spin").hidden = true;
    if (!r.ok) {
      const e = r.data?.error;
      if (e === "device") { message(`<b>Ye account kisi aur device pe chal raha hai.</b><p>Course ek waqt mein ek device pe chalta hai. Yahan dekhne ke liye neeche button dabayein; doosre device se video band ho jayegi.</p><button class="btn btn-primary btn-sm" data-claim>Is device pe dekhein</button>`);
        q("[data-claim]").onclick = async () => { await sb.rpc("acad_claim_device", { p_device: DEVICE, p_label: deviceLabel() }); load(host, slug, opts); }; }
      else if (e === "locked") message(`<b>Ye lesson locked hai.</b><p>Enroll karne ke baad foran khul jayega.</p><a class="btn btn-primary btn-sm" href="#enroll">Enroll karein</a>`);
      else if (e === "not uploaded") message(`<b>Ye lesson jald upload hoga.</b>`);
      else message(`<b>Video load nahi hui.</b><p>Internet check karein aur dobara try karein.</p><button class="btn btn-ghost btn-sm" data-retry>Dobara try karein</button>`), q("[data-retry]") && (q("[data-retry]").onclick = () => load(host, slug, opts));
      return false;
    }
    const { variants, mark: m } = r.data;
    startWatermark(m);
    const mk = (t) => { const u = URL.createObjectURL(new Blob([t], { type: "application/vnd.apple.mpegurl" })); blobs.push(u); return u; };
    const master = "#EXTM3U\n#EXT-X-VERSION:3\n" + variants.map((v) => `#EXT-X-STREAM-INF:BANDWIDTH=${v.bw},RESOLUTION=${v.res}\n${mk(v.playlist)}`).join("\n") + "\n";
    const src = mk(master);
    if (window.Hls && Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60, capLevelToPlayerSize: true, startLevel: -1, abrEwmaDefaultEstimate: 1500000, fragLoadingMaxRetry: 6, keyLoadingMaxRetry: 4 });
      hls.loadSource(src); hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { if (opts.start) video.currentTime = opts.start; });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, d) => { if (hls.autoLevelEnabled) q(".pl-q").textContent = "Auto · " + hls.levels[d.level].height + "p"; });
      hls.on(Hls.Events.ERROR, (_, d) => {
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (d.details === "keyLoadError") message(`<b>Session khatam ho gaya.</b><p>Shayad aap ne doosre device pe login kiya. Page refresh karein.</p>`);
          else hls.startLoad();
        } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else message("<b>Video chalne mein masla.</b><p>Page refresh karein.</p>");
      });
    } else {
      message(`<b>Ye browser support nahi karta.</b><p>iPhone pe iOS 17 ya naya, ya Chrome/Safari ka latest version use karein.</p>`);
      return false;
    }
    return true;
  }
  function destroy() {
    clearInterval(wmTimer);
    if (hls) { hls.destroy(); hls = null; }
    blobs.forEach((u) => URL.revokeObjectURL(u)); blobs = [];
    if (el) { el.classList.remove("pseudo-fs"); document.body.classList.remove("no-scroll"); }
  }
  return { load, destroy, get video() { return video; } };
})();
