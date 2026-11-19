/* SENTINEL — theme config: the agent watch and the agent link. */
const THEME = {
    name: "Sentinel",
    tilt: 0,
    hud(d) {
        const p = (n) => String(n).padStart(2, "0");
        const a = (d.getSeconds() / 60 * 360).toFixed(1) + "deg";
        const dl = document.querySelector(".BottomBar .DownloadStatus .DetailedDownloadProgress");
        const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        return "<div class='ring' style='--a:" + a + "'></div><div class='face'>" + p(d.getHours()) + ":" + p(d.getMinutes()) + "<small>" + days[d.getDay()] + " " + p(d.getDate()) + "</small></div>" +
               "<div class='st'><div class='on'>AGENT <b>ACTIVE</b></div><div>NETWORK <b>SECURE</b></div><div>" + (dl ? "SUPPLY <b>INBOUND</b>" : "SUPPLY <b>STABLE</b>") + "</div></div>";
    },
    boot() {
        return { className: "sn-link", ms: 3200, html: "<div><div class='c'><div class='t'>SENTINEL</div></div><div class='s'>AGENT LINK ESTABLISHED</div></div>" };
    }
};


/* ==========================================================================
   Shared theme engine (main Steam window).
   The theme's own config (THEME) is prepended to this file by the builder:
     THEME.name             theme name (guards against double loading)
     THEME.hud(date, ctx)   -> html string for the readout beside the menus, or null
     THEME.hudEvery         ms between readout refreshes (default 1000)
     THEME.boot()           -> { html, ms, className } for the startup screen, or null
     THEME.tilt             cover tilt strength in degrees (default 12; 0 disables)
     THEME.init(api)        theme extras; api = { flag, motion, onMove, onClick }
   Everything degrades to plain CSS if this never runs (html.mr-js gates JS styles).
   ========================================================================== */
(function () {
    "use strict";
    const KEY = "__theme_" + (THEME.name || "x").replace(/\W/g, "");
    if (window[KEY]) return;
    window[KEY] = true;

    const root = document.documentElement;
    root.classList.add("mr-js");
    const cs = () => getComputedStyle(root);
    const motion = () => { const v = parseFloat(cs().getPropertyValue("--mr-motion")); return isNaN(v) ? 1 : v; };
    const flag = (name) => cs().getPropertyValue(name).trim();
    const moveHooks = [], clickHooks = [];

    /* ---- Navigator indicator ------------------------------------------- */
    let indicator = null, lastKey = "";
    function placeIndicator(force) {
        const nav = document.querySelector(".SuperNav");
        if (!nav) return;
        if (!indicator || !nav.contains(indicator)) {
            indicator = document.createElement("div");
            indicator.className = "mr-nav-indicator";
            nav.insertBefore(indicator, nav.firstChild);
            force = true;
        }
        const sel = nav.querySelector(".SuperNavMenu.Selected > .MenuButton");
        if (!sel) { indicator.style.opacity = "0"; return; }
        const n = nav.getBoundingClientRect(), r = sel.getBoundingClientRect();
        const x = r.left - n.left, key = Math.round(x) + ":" + Math.round(r.width) + ":" + Math.round(r.top - n.top);
        if (!force && key === lastKey) return;
        const first = lastKey === "";
        lastKey = key;
        if (first) indicator.style.transition = "none";
        indicator.style.opacity = "1";
        indicator.style.top = (r.top - n.top) + "px";
        indicator.style.height = r.height + "px";
        indicator.style.width = r.width + "px";
        indicator.style.transform = "translateX(" + x + "px)";
        if (first) requestAnimationFrame(() => { indicator.style.transition = ""; });
    }

    /* ---- Cursor light + cover tilt -------------------------------------- */
    const ISLANDS = ".MainPanel, .Library > .Container > div:not(.MainPanel)";
    let pending = null, lastIsland = null, tilted = null, raf = 0;
    function resetTilt(el) {
        ["--mr-rx", "--mr-ry", "--mr-gx", "--mr-gy"].forEach((p) => el.style.removeProperty(p));
        if (tilted === el) tilted = null;
    }
    function onMove(e) {
        pending = e;
        if (raf) return;
        raf = requestAnimationFrame(() => {
            raf = 0;
            const ev = pending;
            if (!ev || !ev.target || !ev.target.closest) return;
            if (flag("--mr-cursor-light") !== "off") {
                const island = ev.target.closest(ISLANDS);
                if (lastIsland && lastIsland !== island) { lastIsland.style.removeProperty("--mr-mx"); lastIsland.style.removeProperty("--mr-my"); }
                if (island) {
                    const r = island.getBoundingClientRect();
                    island.style.setProperty("--mr-mx", (ev.clientX - r.left) + "px");
                    island.style.setProperty("--mr-my", (ev.clientY - r.top) + "px");
                }
                lastIsland = island;
            }
            const box = ev.target.closest(".LibraryItemBox");
            if (tilted && tilted !== box) resetTilt(tilted);
            const amt = THEME.tilt === undefined ? 12 : THEME.tilt;
            if (box && amt && motion() > 0 && flag("--mr-tilt") !== "off") {
                const r = box.getBoundingClientRect();
                const px = (ev.clientX - r.left) / r.width, py = (ev.clientY - r.top) / r.height;
                box.style.setProperty("--mr-ry", ((px - 0.5) * amt).toFixed(2));
                box.style.setProperty("--mr-rx", ((0.5 - py) * amt).toFixed(2));
                box.style.setProperty("--mr-gx", (px * 100).toFixed(1) + "%");
                box.style.setProperty("--mr-gy", (py * 100).toFixed(1) + "%");
                tilted = box;
            }
            for (const h of moveHooks) { try { h(ev); } catch (err) {} }
        });
    }

    /* ---- Readout beside the menus --------------------------------------- */
    function placeHud() {
        if (!THEME.hud) return;
        const bar = document.querySelector(".RootMenuBar");
        if (!bar || flag("--od-hud") === "off") return;
        let hud = bar.parentElement.querySelector(":scope > .od-hud");
        const fresh = !hud;
        if (!hud) { hud = document.createElement("div"); hud.className = "od-hud"; bar.after(hud); }
        // Steam re-renders the title bar now and then; the readout is re-added within a second,
        // while its content only refreshes at the theme's own pace.
        const now = Date.now();
        if (!fresh && now - (placeHud.at || 0) < (THEME.hudEvery || 1000)) return;
        placeHud.at = now;
        const html = THEME.hud(new Date(), { flag });
        if (html != null && (fresh || hud.__last !== html)) { hud.innerHTML = html; hud.__last = html; }
    }

    /* ---- Startup screen, once per Steam start --------------------------- */
    function bootScreen(force) {
        if (!THEME.boot || flag("--od-boot") === "off" || motion() === 0) return;
        const k = "boot-" + KEY;
        if (!force) { try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); } catch (e) {} }
        const b = THEME.boot();
        if (!b) return;
        const el = document.createElement("div");
        el.className = "od-boot " + (b.className || "");
        el.innerHTML = b.html;
        document.body.appendChild(el);
        if (b.after) { try { b.after(el); } catch (e) {} }
        setTimeout(() => el.remove(), b.ms || 3000);
    }

    function start() {
        document.addEventListener("pointermove", onMove, { passive: true });
        document.addEventListener("pointerleave", () => { if (tilted) resetTilt(tilted); }, { passive: true });
        document.addEventListener("click", (e) => { for (const h of clickHooks) { try { h(e); } catch (err) {} } }, true);
        window.addEventListener("resize", () => placeIndicator(true), { passive: true });
        let queued = false;
        new MutationObserver(() => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => { queued = false; placeIndicator(false); });
        }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => placeIndicator(true));
            setInterval(() => { const nav = document.querySelector(".SuperNav"); if (nav && !nav.__mrRO) { nav.__mrRO = true; ro.observe(nav); } }, 1500);
        }
        placeHud();
        setInterval(placeHud, Math.min(1000, THEME.hudEvery || 1000));
        bootScreen(false);
        window.__themeReplayBoot = () => bootScreen(true);
        placeIndicator(true);
        setTimeout(() => placeIndicator(true), 600);
        if (THEME.init) {
            try {
                THEME.init({ flag, motion, root, onMove: (f) => moveHooks.push(f), onClick: (f) => clickHooks.push(f) });
            } catch (e) { console.warn("[theme] init failed", e); }
        }
    }
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
