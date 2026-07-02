(function () {
  try {
    var theme = localStorage.getItem("theme");
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme:dark)").matches) {
      document.documentElement.setAttribute("data-theme", "dark");
    }

    var scale = localStorage.getItem("text-scale");
    if (scale) {
      var parsed = parseFloat(scale);
      if (parsed >= 0.85 && parsed <= 1.4) {
        document.documentElement.style.setProperty("--text-scale", String(parsed));
      }
    }
  } catch {
  }
})();
