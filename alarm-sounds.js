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

  async function play(id, volume = 50) {
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
    choices, play, isValid: (value) => choices.some((choice) => choice.id === value)
  });
})();
