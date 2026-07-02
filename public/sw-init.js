(function () {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", function () {
    var isLocalhost = ["localhost", "127.0.0.1", "::1"].indexOf(window.location.hostname) >= 0;

    if (!isLocalhost) {
      navigator.serviceWorker.register("/sw.js");
      return;
    }

    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      registrations.forEach(function (registration) {
        registration.unregister();
      });
    });

    if (window.caches) {
      caches.keys().then(function (keys) {
        keys
          .filter(function (key) {
            return key.indexOf("gear-tracker-") === 0;
          })
          .forEach(function (key) {
            caches.delete(key);
          });
      });
    }
  });
})();
