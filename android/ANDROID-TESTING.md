# HabitClik · Android APK de pruebas

**Objetivo:** probar HabitClik en teléfonos Android reales **antes** de cerrar la identidad comercial y la ficha de Google Play.

## Qué estamos construyendo

El repositorio contiene una configuración de **Capacitor 8.5.3**. Se usa el identificador provisional `dev.habitclik.preview` y el nombre **HabitClik (Pruebas)**. Los HTML, JS, CSS, iconos, sonidos y fondos se **copian dentro de la APK**, por lo que este prototipo no necesita comprar un dominio ni conectarse a la web remota al iniciarse.

El job [Android preview APK](https://github.com/Krezj97/HabitClik/actions/workflows/android-preview.yml) se puede ejecutar mediante **Run workflow**, desde la rama `main`. Requiere acceso al repositorio GitHub y la disponibilidad de los ejecutores de GitHub Actions.

Cuando el job termine con éxito:
1. Abre la ejecución verde en GitHub → **Artifacts** → **HabitClik-Android-PRUEBAS-APK**.
2. Descarga el ZIP y extrae `app-debug.apk`.
3. Pasa el APK a un Android de pruebas, ábrelo y acepta instalarlo solo si confías en la procedencia del repositorio y el paquete. Android puede requerir permitir temporalmente instalaciones desde esa fuente.
4. Busca **HabitClik (Pruebas)**, añade un hábito y verifica la navegación entre Mi día, Estadísticas, Calendario y Avisos. Prueba con internet desconectado.
5. **No incluyas contraseñas, documentos privados ni datos importantes** en esta build de desarrollo.

El archivo es una **APK debug**, firmada con la clave de depuración generada durante la compilación. **No es el AAB de producción**, no permite instalar una actualización firmada con otra clave de depuración sobre la anterior y no debe enviarse a Google Play. Si una APK posterior no actualiza, exporta primero los hábitos, desinstala el prototipo y vuelve a importar la copia.

## Pruebas obligatorias en un móvil real

- Android con fuentes normales y grandes, modo de gestos y botones del sistema, pantallas estrechas y orientación horizontal.
- Crear, editar, completar y desmarcar hasta tres hábitos; comparar el progreso y XP; usar navegación inferior y botón Atrás.
- Cerrar y reabrir; reiniciar el móvil; probar sin conexión y verificar que los hábitos siguen ahí.
- Elegir cada MP3, escuchar una prueba y controlar el volumen. Subir un audio propio; verificar compatibilidad del selector nativo y su almacenamiento.
- Exportar JSON, importarlo y comprobar que datos/historial sean correctos. **Importar o descargar archivos desde el WebView puede requerir una integración nativa**; no se ha homologado todavía.
- Exportar un evento de calendario, solicitar notificaciones solo cuando haga falta, entrar en Privacidad y abrir enlaces externos.
- Comprobar que no se prometen alarmas en segundo plano. La WebView puede suspenderse cuando se cierra la aplicación.

## Datos y migración

La app de prueba **no comparte automáticamente** el almacenamiento local de Chrome/GitHub Pages. Las versiones con origen web distinto mantienen espacios separados. Antes de cualquier cambio de APK, dominio, paquete o firma, exporta una copia JSON en la web antigua y comprueba si la app nueva puede importarla; el archivo de alarma personal no va incluido en ese JSON.

## Requisitos para publicar en Google Play

No hay firma de producción, cuenta de Play Console conectada, compras Premium operativas ni test en dispositivo real. Antes de producción hay que fijar un nombre de paquete comercial, incorporar un icono de lanzamiento y pantalla de inicio de marca, preparar AAB firmado y la política de privacidad con contacto real. También hay que verificar que el paquete final cumpla con el **target SDK API 36 o superior**, y realizar una fase de prueba interna o cerrada.

Consulta [PLAYSTORE.md](PLAYSTORE.md) para la estrategia TWA con dominio propio o la ruta nativa con Capacitor. La prueba con Capacitor **elimina el requisito de dominio para probar la APK**, no los requisitos de publicación en Play Store.
