"use strict";

// Five locally synthesized alarm tones. No external audio files or network calls.
// The audio context is started only after an explicit user action.
(function () {
  const choices = Object.freeze([
    Object.freeze({ id: "campanas", title: "Campanas", description: "Melódica y clara" }),
    Object.freeze({ id: "digital", title: "Digital", description: "Pulsos cortos y nítidos" }),
    Object.freeze({ id: "clasica", title: "Despertador", description: "Timbre firme y alterno" }),
    Object.freeze({ id: "alegre", title: "Alegre", description: "Secuencia musical ascendente" }),
    Object.freeze({ id: "energia", title: "Energía", description: "Pulsos graves y potentes" })
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
    if (activeCustomAudio) {
      activeCustomAudio.pause();
      activeCustomAudio = null;
    }
    if (activeCustomUrl) {
      URL.revokeObjectURL(activeCustomUrl);
      activeCustomUrl = null;
    }
  }

  async function getCustomInfo() {
    const record = await getCustom();
    return record ? { name: record.name, size: record.size, type: record.type } : null;
  }

  async function playCustom(volume) {
    const record = await getCustom();
    if (!record || !window.Audio || !window.URL || !window.URL.createObjectURL) return false;
    try {
      if (activeCustomAudio) activeCustomAudio.pause();
      if (activeCustomUrl) URL.revokeObjectURL(activeCustomUrl);
      const objectUrl = window.URL.createObjectURL(record.blob);
      const player = new window.Audio(objectUrl);
      activeCustomAudio = player;
      activeCustomUrl = objectUrl;
      player.volume = Math.min(1, Math.max(0.1, Number(volume) / 100 || 0.5));
      const release = () => {
        if (activeCustomAudio === player) {
          activeCustomAudio = null;
          activeCustomUrl = null;
          window.URL.revokeObjectURL(objectUrl);
        }
      };
      player.addEventListener("ended", release, { once: true });
      player.addEventListener("error", release, { once: true });
      // User files can be much longer than the built-in alarms.
      player.addEventListener("timeupdate", () => {
        if (player.currentTime >= 12) {
          player.pause();
          release();
        }
      });
      await player.play();
      return true;
    } catch (error) {
      console.warn("HabitClik: el formato del archivo no se pudo reproducir.", error);
      return false;
    }
  }


  async function play(id, volume = 50) {
    if (id === CUSTOM_ID) return playCustom(volume);
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    const pattern = Object.hasOwn(patterns, id) ? patterns[id] : patterns.campanas;
    const level = Number.isFinite(Number(volume))
      ? Math.min(100, Math.max(10, Number(volume))) : 50;

    try {
      if (!audioContext || audioContext.state === "closed") audioContext = new Context();
      if (audioContext.state === "suspended") {
        if (typeof audioContext.resume !== "function") return false;
        await audioContext.resume();
        if (audioContext.state === "suspended") return false;
      }

      // Significantly louder than the old 0.18 * volume implementation,
      // while keeping each oscillator below 0.5 amplitude to limit clipping.
      const peakGain = (0.08 + 0.42 * level / 100) * pattern.strength;
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
        envelope.connect(audioContext.destination);
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
    choices, play, customId: CUSTOM_ID, saveCustom, getCustomInfo, removeCustom,
    isValid: (value) => value === CUSTOM_ID || choices.some((choice) => choice.id === value)
  });
})();
