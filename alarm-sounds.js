"use strict";

// Five verified CC0 WAV notification recordings, with a synthesized fallback if an asset is unavailable.
// The audio context is started only after an explicit user action.
(function () {
  // WAV recordings from AKX Notifications, released under CC0.
  // Old IDs are preserved so existing user preferences continue working.
  const choices = Object.freeze([
    Object.freeze({ id: "campanas", title: "Aurora", description: "Acordes cálidos y elegantes", file: "./sounds/campanas.wav" }),
    Object.freeze({ id: "digital", title: "Pulse", description: "Aviso digital claro y discreto", file: "./sounds/digital.wav" }),
    Object.freeze({ id: "clasica", title: "Clásica", description: "Alarma breve y definida", file: "./sounds/clasica.wav" }),
    Object.freeze({ id: "alegre", title: "Destellos", description: "Brillante y musical", file: "./sounds/alegre.wav" }),
    Object.freeze({ id: "energia", title: "Horizonte", description: "Tono llamativo y moderno", file: "./sounds/energia.wav" })
  ]);

  // Frequencies in Hz, duration in seconds and interval before the next note.
  const patterns = {
    campanas: {
      wave: "sine", strength: 1,
      notes: [[659.25, 0.33, 0.36], [783.99, 0.33, 0.36],
        [987.77, 0.5, 0.54], [783.99, 0.43, 0.45]]
    },
    digital: {
      wave: "square", strength: 0.58,
      notes: [[880, 0.16, 0.23], [880, 0.16, 0.28],
        [1174.66, 0.19, 0.31], [880, 0.16, 0.23],
        [880, 0.16, 0.28], [1174.66, 0.27, 0.29]]
    },
    clasica: {
      wave: "sawtooth", strength: 0.57,
      notes: [[523.25, 0.2, 0.24], [659.25, 0.2, 0.24],
        [523.25, 0.2, 0.24], [659.25, 0.2, 0.31],
        [523.25, 0.26, 0.30], [659.25, 0.33, 0.35]]
    },
    alegre: {
      wave: "triangle", strength: 0.98,
      notes: [[523.25, 0.22, 0.24], [659.25, 0.22, 0.24],
        [783.99, 0.22, 0.24], [1046.5, 0.36, 0.42],
        [783.99, 0.2, 0.23], [1046.5, 0.36, 0.40]]
    },
    energia: {
      wave: "triangle", strength: 1,
      notes: [[392, 0.28, 0.32], [392, 0.28, 0.34],
        [587.33, 0.3, 0.35], [783.99, 0.41, 0.43],
        [587.33, 0.3, 0.35]]
    }
  };

  let audioContext = null;

  const CUSTOM_ID = "personalizada";
  const DB_NAME = "habitclik-custom-audio";
  const STORE_NAME = "sounds";
  const STORAGE_ID = "selected";
  const MAX_FILE_BYTES = 8 * 1024 * 1024;
  const SUPPORTED_EXTENSIONS = /\.(mp3|m4a|aac|wav|ogg|oga|webm)$/i;
  let customCache = null;
  let activeCustomAudio = null;
  let activeCustomUrl = null;
  let activeGain = null;
  let activeGainBase = 1;
  let activeLevel = 50;
  let activeBuiltinOscillators = [];

  function clampLevel(value) {
    return Number.isFinite(Number(value))
      ? Math.min(100, Math.max(0, Number(value))) : 50;
  }

  // Wider perceived dynamic range than the original near-flat slider.
  function loudness(level) {
    return 0.008 + 0.492 * Math.pow(clampLevel(level) / 100, 2.2);
  }

  function setVolume(value) {
    const level = clampLevel(value);
    if (activeGain) {
      const relative = loudness(level) / loudness(activeLevel);
      activeGain.gain.value = activeGainBase * relative;
    }
    if (activeCustomAudio && !activeGain) {
      // Fallback for browsers without a Web Audio media-element source.
      activeCustomAudio.volume = level / 100;
    }
    return level;
  }

  function stopPrevious() {
    if (activeCustomAudio) {
      activeCustomAudio.pause();
      activeCustomAudio = null;
    }
    if (activeCustomUrl) {
      window.URL.revokeObjectURL(activeCustomUrl);
      activeCustomUrl = null;
    }
    for (const oscillator of activeBuiltinOscillators) {
      try { oscillator.stop(); } catch (error) { /* already stopped */ }
    }
    activeBuiltinOscillators = [];
    activeGain = null;
    activeGainBase = 1;
  }

  function validateCustom(file) {
    if (!file || typeof file.size !== "number" || file.size < 1) {
      throw new Error("Selecciona un archivo de audio que no esté vacío.");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error("El archivo supera los 8 MB. Prueba con un audio más corto.");
    }
    const name = typeof file.name === "string" ? file.name : "";
    const mime = typeof file.type === "string" ? file.type.toLowerCase() : "";
    if (!SUPPORTED_EXTENSIONS.test(name) ||
        (mime && !mime.startsWith("audio/") && mime !== "application/ogg")) {
      throw new Error("Usa un archivo MP3, M4A, WAV, OGG, AAC o WebM de audio.");
    }
    return { name: name.slice(0, 150), size: file.size, type: mime };
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("Este navegador no permite guardar audios personalizados."));
        return;
      }
      let request;
      try {
        request = window.indexedDB.open(DB_NAME, 1);
      } catch (error) {
        reject(error);
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento de audio."));
      request.onblocked = () => reject(new Error("Cierra otras pestañas de HabitClik y vuelve a intentarlo."));
    });
  }

  async function customTransaction(operation, value) {
    const db = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, operation === "get" ? "readonly" : "readwrite");
        const store = tx.objectStore(STORE_NAME);
        let valueRead = null;
        const request = operation === "get" ? store.get(STORAGE_ID)
          : operation === "put" ? store.put(value, STORAGE_ID)
          : store.delete(STORAGE_ID);
        request.onsuccess = () => { valueRead = request.result; };
        tx.oncomplete = () => resolve(valueRead);
        tx.onerror = () => reject(tx.error || request.error || new Error("No se pudo guardar el audio."));
        tx.onabort = () => reject(tx.error || new Error("El guardado de audio se interrumpió."));
      });
    } finally {
      db.close();
    }
  }

  async function getCustom() {
    if (customCache) return customCache;
    const stored = await customTransaction("get");
    if (stored && stored.blob && typeof stored.name === "string") {
      customCache = stored;
      return stored;
    }
    return null;
  }

  async function saveCustom(file) {
    const metadata = validateCustom(file);
    const record = { ...metadata, blob: file };
    await customTransaction("put", record);
    customCache = record;
    return { name: record.name, size: record.size, type: record.type };
  }

  async function removeCustom() {
    await customTransaction("delete");
    customCache = null;
    stopPrevious();
  }

  async function getCustomInfo() {
    const record = await getCustom();
    return record ? { name: record.name, size: record.size, type: record.type } : null;
  }

  async function playCustom(volume) {
    // IndexedDB survives page reloads. A Web Audio gain node is essential here:
    // several mobile browsers ignore changes to HTMLMediaElement.volume.
    const record = await getCustom();
    if (!record || !window.Audio || !window.URL || !window.URL.createObjectURL) return false;
    let objectUrl = null;
    let player = null;
    stopPrevious();
    try {
      objectUrl = window.URL.createObjectURL(record.blob);
      player = new window.Audio(objectUrl);
      activeCustomAudio = player;
      activeCustomUrl = objectUrl;
      activeLevel = clampLevel(volume);

      const Context = window.AudioContext || window.webkitAudioContext;
      if (Context) {
        if (!audioContext || audioContext.state === "closed") audioContext = new Context();
        if (audioContext.state === "suspended" && typeof audioContext.resume === "function") {
          await audioContext.resume();
        }
        if (audioContext.state !== "suspended" &&
            typeof audioContext.createMediaElementSource === "function") {
          try {
            const source = audioContext.createMediaElementSource(player);
            const master = audioContext.createGain();
            master.gain.value = loudness(activeLevel) / loudness(100);
            source.connect(master);
            master.connect(audioContext.destination);
            activeGain = master;
            activeGainBase = master.gain.value;
            // Route through Web Audio rather than mobile's fixed media volume.
            player.volume = 1;
          } catch (error) {
            // Some browsers do not expose this routing for their audio element.
            console.warn("HabitClik: ruta Web Audio no disponible; usando el reproductor.", error);
            activeGain = null;
            activeGainBase = 1;
          }
        }
      }
      if (!activeGain) player.volume = clampLevel(volume) / 100;

      const release = () => {
        if (activeCustomAudio === player) {
          activeCustomAudio = null;
          activeGain = null;
          activeCustomUrl = null;
          window.URL.revokeObjectURL(objectUrl);
        }
      };
      player.addEventListener("ended", release, { once: true });
      player.addEventListener("error", release, { once: true });
      player.addEventListener("timeupdate", () => {
        if (player.currentTime >= 12) {
          player.pause();
          release();
        }
      });
      await player.play();
      return true;
    } catch (error) {
      console.warn("HabitClik: no se pudo reproducir el archivo.", error);
      if (player) player.pause();
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
      activeCustomAudio = null;
      activeCustomUrl = null;
      activeGain = null;
      return false;
    }
  }

  async function playSample(choice, volume) {
    if (!window.Audio) return false;
    stopPrevious();
    const level = clampLevel(volume);
    let player = null;
    try {
      player = new window.Audio(choice.file);
      player.preload = "auto";
      activeCustomAudio = player;
      activeLevel = level;
      const Context = window.AudioContext || window.webkitAudioContext;
      if (Context) {
        if (!audioContext || audioContext.state === "closed") audioContext = new Context();
        if (audioContext.state === "suspended" && typeof audioContext.resume === "function") {
          await audioContext.resume();
        }
        if (audioContext.state !== "suspended" &&
            typeof audioContext.createMediaElementSource === "function") {
          try {
            const source = audioContext.createMediaElementSource(player);
            const master = audioContext.createGain();
            master.gain.value = loudness(level) / loudness(100);
            source.connect(master);
            master.connect(audioContext.destination);
            activeGain = master;
            activeGainBase = master.gain.value;
            player.volume = 1;
          } catch (error) {
            console.warn("HabitClik: no se puede enrutar el WAV al mezclador.", error);
          }
        }
      }
      if (!activeGain) player.volume = level / 100;
      const release = () => {
        if (activeCustomAudio === player) {
          activeCustomAudio = null;
          activeGain = null;
          activeGainBase = 1;
        }
      };
      player.addEventListener("ended", release, { once: true });
      player.addEventListener("error", release, { once: true });
      await player.play();
      return true;
    } catch (error) {
      if (player) player.pause();
      if (activeCustomAudio === player) activeCustomAudio = null;
      activeGain = null;
      activeGainBase = 1;
      console.warn("HabitClik: muestra WAV no disponible, usando tono alternativo.", error);
      return false;
    }
  }

  async function play(id, volume = 50) {
    if (id === CUSTOM_ID) return playCustom(volume);
    const choice = choices.find((item) => item.id === id) || choices[0];
    if (await playSample(choice, volume)) return true;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    const pattern = Object.hasOwn(patterns, id) ? patterns[id] : patterns.campanas;
    const level = clampLevel(volume);

    try {
      if (!audioContext || audioContext.state === "closed") audioContext = new Context();
      if (audioContext.state === "suspended") {
        if (typeof audioContext.resume !== "function") return false;
        await audioContext.resume();
        if (audioContext.state === "suspended") return false;
      }

      stopPrevious();
      activeLevel = level;
      const peakGain = loudness(level) * pattern.strength;
      const master = audioContext.createGain();
      master.gain.value = 1;
      master.connect(audioContext.destination);
      activeGain = master;
      activeGainBase = 1;
      let when = audioContext.currentTime + 0.035;
      for (const [frequency, duration, advance] of pattern.notes) {
        const oscillator = audioContext.createOscillator();
        const envelope = audioContext.createGain();
        oscillator.type = pattern.wave;
        oscillator.frequency.value = frequency;
        envelope.gain.setValueAtTime(0.0001, when);
        envelope.gain.exponentialRampToValueAtTime(peakGain, when + 0.02);
        envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
        oscillator.connect(envelope);
        envelope.connect(master);
        activeBuiltinOscillators.push(oscillator);
        oscillator.start(when);
        oscillator.stop(when + duration + 0.01);
        when += advance;
      }
      return true;
    } catch (error) {
      console.warn("HabitClik: no se pudo reproducir la alarma.", error);
      return false;
    }
  }

  window.HABITCLIK_SOUNDS = Object.freeze({
    choices, play, setVolume, customId: CUSTOM_ID, saveCustom, getCustomInfo, removeCustom,
    isValid: (value) => value === CUSTOM_ID || choices.some((choice) => choice.id === value)
  });
})();
