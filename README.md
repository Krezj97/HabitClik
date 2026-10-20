# HabitClik 🌱

**HabitClik** es una aplicación web sencilla para seguir tus hábitos cotidianos, registrar pequeños logros y mantener la constancia. Su interfaz está en español y se adapta a escritorio y móvil.

## Funcionalidades

- ✅ Crear y **editar** hábitos diarios o con objetivo de **1 a 7 días por semana**, conservando el historial al modificarlos.
- 📅 Marcar o desmarcar los hábitos completados hoy.
- 📊 Visualizar el progreso del día, las metas semanales de lunes a domingo, la actividad semanal y las estadísticas de los últimos 7 días.
- 🔥 Consultar la racha general de días activos y las rachas por hábito: en días para hábitos diarios y en semanas completas con la meta alcanzada para los demás.
- 💾 Guardar automáticamente los datos en el navegador (`localStorage`).
- ⬇️ Exportar una copia de seguridad JSON e importar datos previamente exportados.
- 🗑️ Eliminar hábitos y su historial tras confirmación.
- 📲 Instalar la web como aplicación cuando el navegador admita la instalación.
- 📴 Abrir y utilizar la aplicación sin conexión **después de una primera visita con conexión**.

## Ejecutar en local

No requiere cuentas, frameworks ni dependencias. Para que el modo sin conexión y la instalación funcionen correctamente, usa un servidor local en lugar de abrir `index.html` como archivo:

```bash
python -m http.server 8000
```

Abre http://localhost:8000. En este origen seguro de desarrollo, el navegador puede registrar el *service worker*.

## Publicar con GitHub Pages

1. Abre **Settings → Pages** en el repositorio.
2. En **Build and deployment**, elige **Deploy from a branch**.
3. Selecciona la rama **main** y la carpeta **/(root)** y guarda.
4. Cuando GitHub confirme el despliegue, la web debería estar en **https://krezj97.github.io/HabitClik/**.

Esta dirección es la esperada **después de activar Pages**; no implica que ya esté publicado. GitHub Pages proporciona HTTPS y permite usar el *service worker*.

## Instalar en el móvil u ordenador

- **Android / Chrome compatible:** abre la web y usa «Instalar HabitClik» si el navegador muestra el botón, o el menú de Chrome **Instalar aplicación / Añadir a pantalla de inicio**.
- **iPhone / Safari:** abre la web en Safari, pulsa **Compartir → Añadir a pantalla de inicio**. Safari no usa el evento `beforeinstallprompt`, por lo que el botón de instalación propio de la web puede no aparecer.
- **Ordenador (navegador compatible):** usa la opción de instalar del navegador si está disponible.

La instalación depende del navegador y sus criterios. Conéctate al menos una vez para guardar los recursos de la aplicación. Posteriormente podrás abrir el panel sin conexión; los datos seguirán en este dispositivo.

## Estructura

- `index.html`: paneles, formulario y metadatos PWA.
- `styles.css`: diseño responsive.
- `app.js`: hábitos, rachas, estadísticas, copias de seguridad e instalación.
- `manifest.webmanifest`: identidad y configuración de instalación.
- `sw.js`: caché de los recursos estáticos y navegación sin conexión.
- `icon.svg` y `icons/`: iconos de la aplicación.

## Privacidad y límites

Los datos se guardan **solo en el navegador y dispositivo utilizados**, no se sincronizan con otros dispositivos ni se envían a un servidor. Borrar los datos del sitio en el navegador puede eliminar tu progreso; usa **Exportar datos** con frecuencia. La instalación como PWA **no sustituye a una copia de seguridad**.

Las rachas se calculan por días consecutivos con al menos una actividad completada. La racha por hábito requiere marcar ese hábito en días consecutivos. Si todavía no has marcado nada hoy, se considera la racha que continuaba ayer. Las metas semanales se cuentan de lunes a domingo, y cambiar una meta se aplica también al cálculo de las rachas anteriores (los registros diarios permanecen). Un hábito creado a mitad de semana no reduce automáticamente su meta de esa primera semana. No hay todavía recordatorios, inicio de sesión ni sincronización en la nube.

La primera vez se muestran tres hábitos de ejemplo que puedes eliminar o reemplazar.

## Próximos pasos sugeridos

- Mejoras de historial y posibilidad de marcar días anteriores.
- Recordatorios opcionales y mejoras adicionales de accesibilidad.
- Sincronización entre dispositivos con cuenta, si se necesita.
- Pruebas automatizadas de flujos completos en distintos navegadores.

## Licencia

No se ha definido todavía una licencia de distribución para este repositorio.
