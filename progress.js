"use strict";

// Deterministic rewards: derived from actual habit logs instead of editable counters.
// Reversing a completion reverses the earned XP; imports naturally preserve progress.
// No penalties, purchase gates, fabricated rankings or competitive leaderboards.
(function () {
  const BADGES = Object.freeze([
    { id: "primera", icon: "✨", title: "Primer paso", description: "Tu primer hábito completado.", requirement: (m) => m.completions >= 1 },
    { id: "semilla", icon: "🌱", title: "Semilla de constancia", description: "10 hábitos completados.", requirement: (m) => m.completions >= 10 },
    { id: "impulso", icon: "🌟", title: "En movimiento", description: "50 hábitos completados.", requirement: (m) => m.completions >= 50 },
    { id: "centenar", icon: "🏆", title: "Cien pequeños pasos", description: "100 hábitos completados.", requirement: (m) => m.completions >= 100 },
    { id: "dia", icon: "☀️", title: "Día redondo", description: "Completa todos tus hábitos en un día.", requirement: (m) => m.perfectDays >= 1 },
    { id: "diez-dias", icon: "💚", title: "Días que cuentan", description: "10 días con todo completado.", requirement: (m) => m.perfectDays >= 10 },
    { id: "tres-rachas", icon: "🔥", title: "Tres días seguidos", description: "Tu mejor racha alcanza 3 días.", requirement: (m) => m.bestStreak >= 3 },
    { id: "siete-rachas", icon: "🌈", title: "Una semana presente", description: "Tu mejor racha alcanza 7 días.", requirement: (m) => m.bestStreak >= 7 },
    { id: "meta", icon: "🎯", title: "Meta lograda", description: "Cumple tu primera meta semanal.", requirement: (m) => m.weeklyGoals >= 1 },
    { id: "metas", icon: "🎖️", title: "Compromiso", description: "Cumple 10 metas semanales.", requirement: (m) => m.weeklyGoals >= 10 },
    { id: "nivel", icon: "🚀", title: "Nivel cinco", description: "Alcanza el nivel 5.", requirement: (m) => m.level >= 5 }
  ]);
  const TITLES = [
    { from: 1, title: "Explorador" },
    { from: 2, title: "En marcha" },
    { from: 4, title: "Constante" },
    { from: 7, title: "Inspirador" },
    { from: 12, title: "Maestro de hábitos" }
  ];
  const MAX_DAYS = 5000;

  function isoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function utcDate(text) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const value = new Date(text + "T12:00:00Z");
    return !Number.isNaN(value.getTime()) && isoDate(value) === text ? value : null;
  }

  function mondayKey(day) {
    const date = utcDate(day);
    if (!date) return null;
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    return isoDate(date);
  }

  function requiredXp(level) {
    const steps = Math.max(0, level - 1);
    return 100 * steps + 25 * steps * Math.max(0, steps - 1);
  }

  function levelFromXp(xp) {
    let level = 1;
    while (level < 1000 && xp >= requiredXp(level + 1)) level++;
    return level;
  }

  function calculate(data, today) {
    const habits = Array.isArray(data && data.habits) ? data.habits : [];
    const logs = data && data.logs && typeof data.logs === "object" ? data.logs : {};
    const validHabits = habits.filter((habit) => habit && typeof habit.id === "string" &&
      utcDate(habit.createdAt) && Number.isInteger(habit.weeklyTarget || 7));
    const byId = new Map(validHabits.map((habit) => [habit.id, habit]));
    const validToday = utcDate(today) ? today : isoDate(new Date());
    const completionsByDay = new Map();
    const weekly = new Map();
    let completions = 0, perfectDays = 0, todayDone = 0;
    const dates = Object.keys(logs).filter((day) => day <= validToday && utcDate(day))
      .sort().slice(-MAX_DAYS);

    for (const day of dates) {
      const ids = Array.isArray(logs[day]) ? logs[day] : [];
      const seen = new Set(ids.filter((id) => byId.has(id) && byId.get(id).createdAt <= day));
      if (!seen.size) continue;
      const count = seen.size;
      completions += count;
      completionsByDay.set(day, count);
      if (day === validToday) todayDone = count;
      const activeCount = validHabits.filter((habit) => habit.createdAt <= day).length;
      if (activeCount > 0 && count >= activeCount) perfectDays++;
      const monday = mondayKey(day);
      for (const id of seen) {
        const key = id + "|" + monday;
        weekly.set(key, (weekly.get(key) || 0) + 1);
      }
    }

    let weeklyGoals = 0;
    for (const [key, count] of weekly) {
      const boundary = key.lastIndexOf("|");
      const habit = byId.get(key.slice(0, boundary));
      if (habit && count >= Math.min(7, Math.max(1, habit.weeklyTarget || 7))) weeklyGoals++;
    }

    let bestStreak = 0, streak = 0, previous = null;
    for (const day of [...completionsByDay.keys()]) {
      const date = utcDate(day);
      const prior = new Date(date);
      prior.setUTCDate(prior.getUTCDate() - 1);
      streak = previous === isoDate(prior) ? streak + 1 : 1;
      bestStreak = Math.max(bestStreak, streak);
      previous = day;
    }

    const xp = completions * 10 + perfectDays * 20 + weeklyGoals * 35;
    const level = levelFromXp(xp);
    const from = requiredXp(level), to = requiredXp(level + 1);
    const rank = [...TITLES].reverse().find((title) => level >= title.from).title;
    const metrics = { completions, perfectDays, weeklyGoals, bestStreak, xp, level };
    const badges = BADGES.map(({ requirement, ...details }) => ({
      ...details, unlocked: requirement(metrics)
    }));
    const unlocked = badges.filter((badge) => badge.unlocked);
    const todayActive = validHabits.filter((habit) => habit.createdAt <= validToday).length;

    let headline = "Tu historia empieza con un pequeño paso";
    let detail = "Cada hábito que completes te acerca a tu siguiente nivel.";
    if (todayDone && todayDone < todayActive) {
      headline = "Hoy ya has sumado " + todayDone * 10 + " XP";
      detail = "Tus avances cuentan, incluso si hoy no lo haces todo.";
    } else if (todayDone && todayActive > 0 && todayDone >= todayActive) {
      headline = "¡Hoy lo has conseguido todo!";
      detail = "Has ganado experiencia por tus hábitos y por completar tu día.";
    } else if (completions) {
      headline = "Llevas " + completions + " pequeños logros";
      detail = "No importa si ayer descansaste: hoy puedes seguir avanzando.";
    }

    const scene = todayActive === 0 || !todayDone ? "amanecer"
      : todayDone >= todayActive ? "celebracion"
      : bestStreak >= 7 ? "bosque" : "enfoque";

    return {
      xp, level, rank, currentLevelXp: xp - from, nextLevelXp: to - from,
      remaining: to - xp, percentage: Math.round(100 * (xp - from) / (to - from)),
      metrics, badges, unlocked, headline, detail, scene,
      todayDone, todayActive
    };
  }

  window.HABITCLIK_PROGRESS = Object.freeze({
    calculate, requiredXp, levelFromXp,
    badges: BADGES.map(({ requirement, ...badge }) => badge)
  });
})();
