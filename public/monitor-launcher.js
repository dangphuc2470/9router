(function () {
  function injectTabletButtons() {
    // 1. Sidebar injection (Add "Tablet Monitor" under "Quota Tracker")
    const quotaNavs = document.querySelectorAll('a[href="/dashboard/quota"], a[href$="/quota"]');
    quotaNavs.forEach((nav) => {
      const parent = nav.parentElement;
      if (!parent || parent.querySelector('[data-tablet-monitor-nav]')) return;
      const link = document.createElement("a");
      link.setAttribute("data-tablet-monitor-nav", "true");
      link.href = "/monitor";
      link.target = "_blank";
      link.className =
        "flex items-center gap-3 px-3 py-1 rounded-lg transition-all group text-text-muted hover:bg-surface-2 hover:text-text-main";
      link.style.cursor = "pointer";
      link.innerHTML = `
        <span class="material-symbols-outlined text-[18px] text-[#0A84FF] transition-colors">tablet_mac</span>
        <span class="text-[13px] font-medium text-text-main">Tablet Monitor</span>
        <span class="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-[3px] bg-[#0A84FF]/15 text-[#0A84FF]">1200p</span>
      `;
      nav.insertAdjacentElement("afterend", link);
    });

    // 2. Header injection on /dashboard/quota
    const headerTitle = document.querySelector("h1");
    if (headerTitle && (headerTitle.textContent.includes("Quota Tracker") || window.location.pathname.includes("/quota"))) {
      const header = document.querySelector("header");
      if (header) {
        // Look for the actions container on the right side of header
        const headerActions = header.querySelector(".flex.items-center.gap-1.shrink-0") || header.lastElementChild;
        if (headerActions && !header.querySelector('[data-tablet-monitor-btn]')) {
          const btn = document.createElement("a");
          btn.setAttribute("data-tablet-monitor-btn", "true");
          btn.href = "/monitor";
          btn.target = "_blank";
          btn.className =
            "flex items-center gap-1.5 px-3 h-8 rounded-lg border border-[#0A84FF]/40 bg-[#0A84FF]/15 text-[#0A84FF] hover:bg-[#0A84FF]/25 transition-all text-xs font-semibold mr-1 shadow-sm";
          btn.title = "Open 1920x1200 Tablet Monitor with PUBG-style Quota bars & Xcode Console Log";
          btn.innerHTML = `
            <span class="material-symbols-outlined text-[17px]">tablet_mac</span>
            <span class="hidden sm:inline">Tablet Monitor</span>
            <span class="material-symbols-outlined text-[14px] opacity-70">open_in_new</span>
          `;
          headerActions.insertBefore(btn, headerActions.firstChild);
        }
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectTabletButtons);
  } else {
    injectTabletButtons();
  }
  // Run on interval to persist across Next.js client-side route changes and hydration
  setInterval(injectTabletButtons, 800);
})();
