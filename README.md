# HabitClik 🌱

**HabitClik** es una aplicación web sencilla para seguir tus hábitos cotidianos, registrar pequeños logros y mantener la constancia. Su interfaz está en español y se adapta a escritorio y móvil.

## Funcionalidades

- ✅ Crear y **editar** hasta **3 hábitos gratis**, diarios o con objetivo de **1 a 7 días por semana**, conservando el historial al modificarlos.
- 📅 Marcar o desmarcar hábitos hoy o desde la sección **Calendario** para completar días pasados (nunca días futuros ni anteriores a la creación del hábito).
- 📊 Visualizar el progreso del día, las metas semanales de lunes a domingo, la actividad semanal y las estadísticas de los últimos 7 días.
- 🔥 Consultar la racha general de días activos y las rachas por hábito: en días para hábitos diarios y en semanas completas con la meta alcanzada para los demás.
- 💾 Guardar automáticamente los datos en el navegador (`localStorage`).
- ⬇️ Exportar una copia de seguridad JSON e importar datos previamente exportados.
- 🗑️ Eliminar hábitos y su historial tras confirmación.
- 📲 Instalar la web como aplicación cuando el navegador admita la instalación.
- 📴 Abrir y utilizar la aplicación sin conexión **después de una primera visita con conexión**.
- ⏰ Activar un **aviso diario opcional** dentro de la aplicación y elegir la hora; se muestra una vez al día cuando la app está activa y hay metas pendientes.
- 🔔 Activar voluntariamente **notificaciones del navegador**, sujetas a sus permisos y a que la app esté abierta/activa.
- ♪ Elegir entre **cinco alarmas naturales y musicales en MP3 con licencia CC0** (Brisa, Luz, Despertar, Buen día y Bosque) o subir **un archivo de audio propio** (MP3, M4A, WAV, OGG, AAC o WebM, máximo 8 MB), escucharlo, regular su volumen o eliminarlo. El volumen final está limitado por el navegador y el dispositivo.
- 📆 Exportar un archivo de calendario `.ics` con un evento diario recurrente y alarma previa para recibir avisos a través del calendario del dispositivo, incluso con HabitClik cerrada si el calendario lo permite.
- 💬 Ver **frases motivacionales** según el progreso del día y la duración de la racha, o pulsar para cambiar de frase.
- 🖼️ Cuatro ilustraciones vectoriales originales en el encabezado: amanecer, enfoque, bosque y celebración. Cambian según el progreso, y también puedes elegir otro paisaje.
- ✨ **Experiencia y niveles:** +10 XP por hábito, +20 XP por completar todos los hábitos activos de un día, +35 XP por cada meta semanal lograda. Una barra muestra cuánto falta para el siguiente nivel.
- 🏅 **Once insignias** por avances reales, rachas y metas. Los logros se ven en Estadísticas. Sin tablas de clasificación, presión social ni pérdidas de XP por descansar; los puntos se calculan desde el historial.

## Plan gratuito y Premium

HabitClik admite **hasta 3 hábitos nuevos en el plan gratuito**. En una instalación nueva los tres espacios están vacíos para que puedas elegir tus propios hábitos. Al intentar añadir un cuarto, la aplicación muestra el límite; no se crean hábitos adicionales.

**Premium y los pagos aún no están habilitados.** La interfaz informa de ello y no ofrece un botón de cobro ficticio. Para vender planes realmente sería necesario añadir una pasarela de pagos, cuentas y validación de acceso en un servidor: este límite implementado en JavaScript es de experiencia de usuario y no una barrera de seguridad contra manipulaciones locales.

- Puedes seguir completando, editando o eliminando hábitos con independencia del número.
- Si una persona ya tenía más de 3 hábitos antes de esta actualización, **todos sus datos y rachas se conservan** y no puede añadir otro hasta estar por debajo del límite.
- Las copias JSON con **más de 3 hábitos** no se importan al plan gratuito, para evitar saltarse el límite o truncar silenciosamente el historial. Conviene conservar la copia original hasta que exista Premium.

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

## Pruebas

Las comprobaciones de regresión utilizan **Node.js 22** y no requieren instalar paquetes:

```bash
node --check app.js
node --check sw.js
node --test tests/app.test.cjs
```

El flujo de GitHub Actions `.github/workflows/tests.yml` ejecuta automáticamente estas comprobaciones en cada cambio enviado al repositorio y en cada pull request.

## Estructura

- `index.html`: paneles, formulario y metadatos PWA.
- `styles.css`: diseño responsive.
- `app.js`: hábitos, rachas, estadísticas, avisos locales, copias de seguridad e instalación.
- `avisos.html` y `avisos.js`: controles de avisos, selección de sonido, permisos de notificaciones y calendario.
- `alarm-sounds.js`: cinco tonos sintetizados y almacenamiento de un audio personalizado con IndexedDB.
- `manifest.webmanifest`: identidad y configuración de instalación.
- `sw.js`: caché de los recursos estáticos y navegación sin conexión.
- `icon.svg` y `icons/`: iconos de la aplicación.

## Personalización y almacenamiento de audio

En **Avisos → Sonido de alarma → Mi alarma personalizada**, selecciona un archivo de audio desde tu dispositivo. La app lo guarda en **IndexedDB dentro de ese mismo navegador**, sin subirlo a servidores ni al repositorio. Al guardarlo, queda seleccionado automáticamente; puedes escucharlo con «Escuchar prueba» o eliminarlo desde «Eliminar audio».

Las copias de seguridad JSON de hábitos guardan el nombre del tono seleccionado, **pero no incluyen el archivo de audio**. Si cambias de navegador o dispositivo, necesitas volver a añadirlo. El audio personalizado puede borrarse si eliminas los datos del sitio. Si tu navegador bloquea IndexedDB, la aplicación mostrará el problema y podrás seguir utilizando los cinco sonidos integrados. Las alarmas solo funcionan mientras la aplicación está activa y el navegador permite reproducir sonido. Los sonidos de la biblioteca se han cambiado por mezclas de naturaleza, campanillas y música licenciadas. Los cinco tonos integrados se distribuyen con su documentación de origen y licencia en [SOUND-LICENSES.md](SOUND-LICENSES.md).

## Diseño

HabitClik utiliza una **paleta moderna grafito y azul petróleo**, con turquesa suave, tarjetas blancas y una gran cabecera ilustrada con cuatro escenas originales. El diseño se adapta al progreso del día sin entorpecer la lectura.

## Privacidad y límites

Los datos se guardan **solo en el navegador y dispositivo utilizados**, no se sincronizan con otros dispositivos ni se envían a un servidor. Borrar los datos del sitio en el navegador puede eliminar tu progreso; usa **Exportar datos** con frecuencia. La instalación como PWA **no sustituye a una copia de seguridad**.

Las rachas se calculan por días consecutivos con al menos una actividad completada. La racha por hábito requiere marcar ese hábito en días consecutivos. Si todavía no has marcado nada hoy, se considera la racha que continuaba ayer. Las metas semanales se cuentan de lunes a domingo, y cambiar una meta se aplica también al cálculo de las rachas anteriores (los registros diarios permanecen). Un hábito creado a mitad de semana no reduce automáticamente su meta de esa primera semana. Los avisos y las alarmas propias de HabitClik **no son notificaciones push en segundo plano**: funcionan con la página abierta o activa y pueden retrasarse si el navegador suspende la pestaña. Están desactivados por defecto. Las notificaciones del navegador solicitan permiso solo al pulsar el botón correspondiente; el sonido requiere que el navegador permita reproducir audio. Para alertas con la aplicación cerrada, usa el archivo `.ics` e impórtalo a un calendario compatible, habilita las notificaciones de ese calendario y comprueba que acepte las alarmas `VALARM`. El evento se repetirá **todos los días** hasta que lo elimines del calendario y es independiente de las metas semanales. No hay todavía sincronización entre dispositivos ni un servidor de notificaciones push.

La primera vez se muestran tres hábitos de ejemplo que puedes eliminar o reemplazar.

## Próximos pasos sugeridos

- Mejoras de historial y posibilidad de marcar días anteriores.
- Notificaciones push auténticas para usuarios suscritos con la aplicación cerrada (requieren un servicio servidor/push y configuración de permisos), además de mejoras adicionales de accesibilidad.
- Sincronización entre dispositivos con cuenta, si se necesita.
- Pruebas automatizadas de flujos completos en distintos navegadores.

## Licencia

No se ha definido todavía una licencia de distribución para este repositorio.

Los cuatro paisajes y las cinco alarmas MP3 están incluidos en la caché de la aplicación para poder verlos y escucharlos sin conexión después de la primera carga. Puedes cambiar el fondo manualmente desde el encabezado de Mi día.
