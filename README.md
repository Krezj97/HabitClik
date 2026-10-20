# HabitClik 🌱

**HabitClik** es una aplicación web sencilla para seguir tus hábitos cotidianos, registrar pequeños logros y mantener la constancia. La interfaz está en español y se adapta a escritorio y móvil.

## Funcionalidades

- ✅ Crear hábitos diarios y organizarlos por categoría.
- 📅 Marcar o desmarcar los hábitos completados hoy.
- 📊 Visualizar el progreso del día, la actividad semanal y las estadísticas de los últimos 7 días.
- 🔥 Consultar la racha actual, la mejor racha general y las rachas de cada hábito.
- 💾 Guardar automáticamente los datos en el navegador (localStorage).
- ⬇️ Exportar una copia de seguridad JSON e importar datos previamente exportados.
- 🗑️ Eliminar hábitos y su historial tras confirmación.

## Cómo abrirla

No requiere instalación, cuentas ni servidor. Abre `index.html` en un navegador moderno, o sirve la carpeta con un servidor estático.

Ejemplo con Python:

```bash
python -m http.server 8000
```

Después abre http://localhost:8000.

## Estructura

- `index.html`: interfaz semántica, paneles y formulario de hábitos.
- `styles.css`: diseño responsive.
- `app.js`: lógica de hábitos, rachas, estadísticas y copias de seguridad.

## Privacidad y límites de esta primera versión

Los datos se guardan **solo en el navegador y dispositivo utilizados**, no se sincronizan con otros dispositivos ni se envían a un servidor. Borrar los datos del sitio en el navegador puede eliminar tu progreso; usa **Exportar datos** con frecuencia para conservar una copia.

Las rachas se calculan por días consecutivos con al menos una actividad completada. La racha por hábito requiere marcar ese hábito en días consecutivos. Si todavía no has marcado nada hoy, se considera la racha que continuaba ayer. Por ahora todos los hábitos son diarios; no hay notificaciones, inicio de sesión ni sincronización en la nube.

Al abrir la aplicación por primera vez se muestran tres hábitos de ejemplo, que puedes eliminar o reemplazar.

## Próximos pasos sugeridos

- Edición de hábitos y metas personalizadas (p. ej., tres veces por semana).
- PWA instalable con uso sin conexión.
- Recordatorios opcionales y accesibilidad adicional.
- Sincronización entre dispositivos con una cuenta, si se necesita.

## Licencia

No se ha definido todavía una licencia de distribución para este repositorio.
