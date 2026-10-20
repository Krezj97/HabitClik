# Licencias y procedencia de los sonidos de HabitClik

## Nueva colección: cinco alarmas naturales y musicales

HabitClik incorpora cinco muestras convertidas a MP3 a partir de las versiones abreviadas de la colección abierta [OpenAlarm, de gretzke](https://github.com/gretzke/open-alarm). Los archivos originales de esa colección tienen licencias individuales: **no** se asume que la licencia MIT del código de OpenAlarm cubra su música.

Elegimos exclusivamente pistas marcadas **Creative Commons Zero (CC0)** por los autores o por el catálogo de atribución de OpenAlarm. CC0 permite copiar, modificar y redistribuir los sonidos, también comercialmente. Se reconocen los creadores por transparencia.

Catálogo original, procedencia y licencias: [OpenAlarm / Ringtones / SOURCES.md](https://github.com/gretzke/open-alarm/blob/main/OpenAlarm/Resources/Ringtones/SOURCES.md).

| En HabitClik | Archivo propio (MP3) | Fuente en OpenAlarm | Autor / fuente original | Licencia |
|---|---|---|---|---|
| **Brisa** – campanillas suaves | `sounds/campanas.mp3` | `ringtone_classic_koshichime.caf` | Membeth, *Koshi wind chime*, Wikimedia Commons | CC0 |
| **Luz** – melodía tranquila | `sounds/digital.mp3` | `ringtone_dawn_wisdominthesun.caf` | Kevin MacLeod, *Wisdom in the Sun*, FreePD | CC0 |
| **Despertar** – campanas | `sounds/clasica.mp3` | `ringtone_classic_twinbell.caf` | cryptidcat, *Twin bell alarm clock*, Freesound | CC0 |
| **Buen día** – música alegre | `sounds/alegre.mp3` | `ringtone_dawn_motions.caf` | Rafael Krux, *Motions*, FreePD | CC0 |
| **Bosque** – canto de pájaros | `sounds/energia.mp3` | `ringtone_nature_morningbirds.caf` | Joseph Sardin, *Réveil des oiseaux*, Wikimedia Commons | CC0 |

Los archivos se descargan desde el commit `60590dca0bb1b00247c0be861030b06bf0941178` del repositorio de OpenAlarm, y su integridad se compara con las huellas Git de la fuente **antes de convertirlos**.

Se procesan clips de unos 10 segundos, con fundidos suaves y limitación de picos, utilizando FFmpeg y códec MP3 compatible con navegadores móviles. Las pistas resultantes se guardan localmente en HabitClik y se precargan para escuchar las alarmas incluso sin conexión después de la primera carga. Se puede regular su volumen.

Estos clips se entregan como pequeños avisos y no como música de fondo continua. Los sistemas operativos y navegadores pueden limitar la reproducción del audio con la web cerrada o en segundo plano.

## Audio personalizado

Cada persona puede seleccionar un archivo de audio propio. Ese archivo se guarda **solo** en el almacenamiento local del navegador; HabitClik no lo transmite ni redistribuye. Los derechos de las alarmas personales son responsabilidad de quien aporta los archivos.

## Ilustraciones del encabezado

Los cuatro fondos del recuadro principal (`art/amanecer.svg`, `art/enfoque.svg`, `art/bosque.svg` y `art/celebracion.svg`) son ilustraciones vectoriales originales creadas para HabitClik. No contienen material de bancos de imágenes ni de terceros.
