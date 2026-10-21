"use strict";

/* HabitClik's optional Android backup bridge.
 * Share a JSON file stored temporarily in app cache via Android's share chooser.
 * Nothing is uploaded automatically or saved outside the app until the user
 * explicitly chooses a destination. Browser uses its original Blob download.
 */
(function () {
  const MAX_EXPORT = 1024 * 1024;
  const PATTERN = /^habitclik-\d{4}-\d{2}-\d{2}\.json$/;

  function isNative() {
    const c = window.Capacitor;
    return !!(c && typeof c.isNativePlatform === "function" &&
      c.isNativePlatform() && typeof c.getPlatform === "function" &&
      c.getPlatform() === "android");
  }

  function plugins() {
    if (!isNative()) return null;
    const p = window.Capacitor.Plugins;
    return p && p.Filesystem && p.Share ? {filesystem: p.Filesystem, share: p.Share} : null;
  }

  async function exportJSON(filename, data) {
    if (!isNative()) return {ok: false, reason: "web"};
    if (!PATTERN.test(filename) || typeof data !== "string" ||
      new TextEncoder().encode(data).byteLength > MAX_EXPORT ||
      new TextEncoder().encode(data).byteLength < 12) {
      return {ok: false, reason: "invalid"};
    }
    const p = plugins();
    if (!p) return {ok: false, reason: "missing-plugin"};
    // App-private cache does not require broad storage permission. The Android
    // chooser is responsible for granting temporary access to the recipient.
    const result = await p.filesystem.writeFile({
      path: filename, data, directory: "CACHE", encoding: "utf8",
      recursive: false
    });
    if (!result || !result.uri || !result.uri.startsWith("file://")) {
      return {ok: false, reason: "file"};
    }
    await p.share.share({
      title: "Copia de mis hábitos · HabitClik",
      text: "Guarda este archivo JSON fuera de HabitClik para poder recuperarlo si cambias de móvil o reinstalas la app.",
      files: [result.uri],
      dialogTitle: "Guardar o compartir mi copia"
    });
    return {ok: true, reason: "chooser"};
  }

  window.HABITCLIK_BACKUP = Object.freeze({
    isNative, isAvailable: () => !!plugins(), exportJSON
  });
})();
