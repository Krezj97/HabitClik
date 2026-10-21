"use strict";

// Deterministic rewards: derived from actual habit logs instead of editable counters.
// Reversing a completion reverses the earned XP; imports naturally preserve progress.
// No penalties, purchase gates, fabricated rankings or competitive leaderboards.
(function () {
  // "Completions" are check-ins across days, not different habits.
  // All badges are reachable with just ONE of the three free habit slots.
  const BADGES = Object.freeze([
    { id: "primera", icon: "✨", title: "Mi primer día", description: "Has marcado un hábito por primera vez.", requirement: (m) => m.completions >= 1 },
    { id: "semilla", icon: "🌱", title: "Va echando raíces", description: "Llevas 5 veces cuidando tus hábitos.", requirement: (m) => m.completions >= 5 },
    { id: "impulso", icon: "🌟", title: "A mi ritmo", description: "Has sumado 20 pequeños avances.", requirement: (m) => m.completions >= 20 },
    { id: "centenar", icon: "🏆", title: "Un mes de detalles", description: "Has registrado avances en 30 días distintos.", requirement: (m) => m.activeDays >= 30 },
    { id: "dia", icon: "☀️", title: "Día para celebrar", description: "Has completado lo que te propusiste hoy.", requirement: (m) => m.perfectDays >= 1 },
    { id: "diez-dias", icon: "💚", title: "Días bien aprovechados", description: "Has completado tu lista en 5 días.", requirement: (m) => m.perfectDays >= 5 },
    { id: "tres-rachas", icon: "🔥", title: "Tres días seguidos", description: "Has estado presente durante 3 días seguidos.", requirement: (m) => m.bestStreak >= 3 },
    { id: "siete-rachas", icon: "🌈", title: "Una semana a tu manera", description: "Has avanzado durante 7 días seguidos.", requirement: (m) => m.bestStreak >= 7 },
    { id: "meta", icon: "🎯", title: "¡Meta cumplida!", description: "Has alcanzado tu primera meta semanal.", requirement: (m) => m.weeklyGoals >= 1 },
    { id: "metas", icon: "🎖️", title: "Cada semana cuenta", description: "Has alcanzado 3 metas semanales.", requirement: (m) => m.weeklyGoals >= 3 },
    { id: "nivel", icon: "🚀", title: "Sigo creciendo", description: "Has llegado al nivel 3.", requirement: (m) => m.level >= 3 }
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
    const metrics = { completions, activeDays: completionsByDay.size, perfectDays, weeklyGoals, bestStreak, xp, level };
    const badges = BADGES.map(({ requirement, ...details }) => ({
      ...details, unlocked: requirement(metrics)
    }));
    const unlocked = badges.filter((badge) => badge.unlocked);
    const todayActive = validHabits.filter((habit) => habit.createdAt <= validToday).length;

    let headline = "¿Con qué pequeño paso empezamos?";
    let detail = "No hace falta hacerlo perfecto. Solo empezar por algo que te haga bien.";
    if (todayDone && todayDone < todayActive) {
      headline = "¡Qué bien! Hoy ya llevas " + todayDone + (todayDone === 1 ? " hábito" : " hábitos");
      detail = "El resto puede esperar. Cada cosa a su tiempo.";
    } else if (todayDone && todayActive > 0 && todayDone >= todayActive) {
      headline = "¡Hoy lo has hecho genial!";
      detail = "Ya has terminado lo que te propusiste. Disfruta de ese momento.";
    } else if (completions) {
      headline = "Ya has dado " + completions + " pequeños pasos";
      detail = "Si hoy te apetece volver a empezar, aquí seguimos.";
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
