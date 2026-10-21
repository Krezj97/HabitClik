# HabitClik para Android y Google Play

**Estado (21 de octubre de 2026):** HabitClik ya tiene una configuración para generar una APK de pruebas con Capacitor y una PWA adaptable a Android, pero **todavía NO hay un Android App Bundle (AAB) de producción firmado ni una publicación en Google Play**. No crear certificados de firma sin que el titular de la cuenta decida cómo administrarlos.

## Prototipo Android instalable (Capacitor)

**Ya se ha preparado un proceso independiente para compilar una APK de pruebas con Capacitor 8**, sin mover la web de GitHub Pages ni necesitar un dominio propio. El empaquetado se realiza desde `.github/workflows/android-preview.yml`, con identificador temporal `dev.habitclik.preview`, incluyendo todos los recursos de la app. Consulta [ANDROID-TESTING.md](ANDROID-TESTING.md) para las instrucciones y las limitaciones de la APK.

Este prototipo **no equivale** a una versión firmada para producción ni a una publicación en Google Play. Su almacenamiento es independiente del origen web de Chrome; la importación/exportación en WebView, las alarmas con la app cerrada y el funcionamiento en dispositivos reales requieren pruebas específicas. No se han creado certificados ni credenciales de producción.

### Alternativas para el lanzamiento comercial
- **Capacitor:** permite alojar los recursos localmente, añadir capacidades nativas cuando se implementen y compilar un AAB sin verificación de TWA en un dominio público; falta definir identificador definitivo, iconos, pagos, permisos y firma real.
- **Trusted Web Activity:** conserva el origen web existente y exige verificación Digital Asset Links en la raíz del origen, que el actual repositorio de GitHub Pages no controla.

## Estrategia inicial: Trusted Web Activity (TWA)

HabitClik es una PWA sin backend. El camino más corto para evaluarla como app Android es **Trusted Web Activity con Bubblewrap**. La TWA ejecuta la web mediante un navegador compatible y verifica la relación entre la web y la app mediante Digital Asset Links. No garantiza alarmas nativas en segundo plano. No se debe prometer que los recordatorios sonarán con la app cerrada.

Documentación oficial:
- [Crear una TWA con Bubblewrap](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start)
- [Verificación y Digital Asset Links](https://developer.chrome.com/docs/android/trusted-web-activity/android-for-web-devs)
- [Requisitos de API objetivo para Google Play](https://support.google.com/googleplay/android-developer/answer/11926878)

### Impedimento actual: URL bajo GitHub Pages

La dirección web actual es `https://krezj97.github.io/HabitClik/`. Esa dirección es una **ruta de proyecto** dentro del origen `https://krezj97.github.io`. La TWA debe encontrar su verificación en `https://krezj97.github.io/.well-known/assetlinks.json`, NO dentro de `/HabitClik/.well-known/`. Este repositorio de proyecto no controla la raíz de ese dominio.

**No hay que publicar un assetlinks.json ficticio**: eso daría una falsa sensación de verificación. Las opciones correctas son:
1. Asignar a HabitClik un **dominio propio** HTTPS (recomendado) y publicar la web allí, desde la raíz. GitHub Pages admite dominios personalizados.
2. Cambiar a un repositorio de sitio de usuario que controle la raíz del origen correspondiente, y gestionar el archivo de verificación allí.
3. En vez de TWA, utilizar un contenedor nativo como Capacitor, si se necesitan notificaciones y alarmas nativas reales, almacenamiento propio o más integración con Android; requiere un desarrollo y revisión específicos.

### Preparar la compilación, cuando exista el dominio

1. Conectar el dominio y comprobar que `https://DOMINIO/manifest.webmanifest` y `https://DOMINIO/privacy.html` funcionan sin redirecciones inesperadas. Verificar también el *scope* y que el sitio es propiedad del titular de la app.
2. Elegir el **identificador definitivo de paquete** (ejemplo ilustrativo: `com.empresa.habitclik`). No usar ese ejemplo sin decidir el propietario.
3. Instalar Node.js, Java/JDK y Android SDK en un equipo controlado por el responsable de la firma.
4. Instalar Bubblewrap:

   ```bash
   npm install -g @bubblewrap/cli
   bubblewrap init --manifest=https://DOMINIO/manifest.webmanifest
   ```

5. Configurar el paquete y los certificados **reales**. No añadir archivos `.jks`, contraseñas, credenciales ni archivos AAB firmados al repositorio público. Usar firma y gestión de claves según Google Play App Signing.
6. Verificar en el proyecto Android generado que `targetSdkVersion` sea **36 o superior** (exigencia de Google Play para nuevas apps a partir del 31 de agosto de 2026). Bubblewrap puede cambiar versiones: no asumir que lo configura automáticamente. Actualizar el proyecto, compilar y probar un APK en dispositivo. Preparar un **Android App Bundle (.aab)** para Play Console.
7. Obtener en Play Console la huella **SHA-256 del certificado de firma de la aplicación**. No confundirla con la huella del certificado de carga.
8. Generar el archivo correcto, una vez conocidos esos datos:

   ```bash
   node android/generate-assetlinks.cjs com.empresa.habitclik "AA:BB:...:FF" "https://DOMINIO/"
   ```

   Sustituye el ejemplo por la huella real de **32 bytes** (`AA:BB:...`, 95 caracteres). Sirve el JSON generado en `https://DOMINIO/.well-known/assetlinks.json` con tipo de contenido JSON. Verifica desde un Android real que la TWA aparece a pantalla completa y no como pestaña personalizada.
9. Enviar el AAB a una pista **interna o cerrada** de Play Console antes de producción. Probar instalación limpia, actualización, pérdida de conectividad, comportamiento de navegación Android y persistencia de datos.

### Revisión de tienda y cumplimiento, pendiente

- **Política de privacidad:** `https://DOMINIO/privacy.html` existe en la web. Antes de publicar, incluir los datos reales del responsable y un contacto de soporte verificable; completar la ficha de **Seguridad de los datos** con las prácticas reales de la versión Android, no solo con las de la web actual.
- **Google Play Payments:** HabitClik tiene un límite local de **3 hábitos gratis**, pero **Premium no se puede comprar**. Si se decide cobrar por la capacidad adicional, implementar primero la facturación autorizada aplicable (Google Play Billing o el régimen alternativo permitido, sujeto a sus requisitos) y validación de derechos de acceso **en un servidor**. No fingir cobros ni desbloqueos.
- **Permisos:** solicitar solo lo imprescindible. El prototipo PWA usa notificaciones opcionales del navegador; una futura app que prometa alarmas en segundo plano deberá implementar y verificar las APIs nativas correspondientes antes de anunciar esa función.
- **Página de la ficha:** preparar icono, imágenes reales de teléfonos Android, descripción precisa, política de privacidad y contenido de pruebas; no subir capturas generadas como si fueran una pantalla real.
- **QA:** probar Android 10-16, dispositivos pequeños (320/360/393 px), fuente Android al 200%, modo horizontal, teclado visible, navegación por gestos, pulsaciones, caché offline, importaciones, niveles/XP, permisos de notificación y cambio de sonidos. Hasta hacer pruebas físicas, **no se debe afirmar que está homologada para todos estos dispositivos**.
- **Almacenamiento:** los hábitos se guardan en localStorage, y el audio propio en IndexedDB del origen. Eliminar datos del navegador o de la app puede borrarlos. Ofrecer exportación antes de migrar de dominio: **cambiar el origen rompe el acceso automático al almacenamiento local**; la migración se debe diseñar y comunicar antes del lanzamiento.

## Optimizaciones Android ya incluidas en la web

- Barra inferior de cuatro pestañas, al alcance del pulgar, y zonas táctiles ampliadas.
- Soporte de áreas seguras de pantalla, recorte frontal y barra de navegación por gestos.
- Cuadrícula de hábitos, controles y calendario adaptados a 320-480 px.
- Diálogos y formularios más cómodos con teclado y fuente ampliada.
- Navegación Atrás/Adelante del navegador, rutas de sección y actualización de datos al regresar a la app.
- Accesos directos para Mi día, Estadísticas, Calendario y Avisos en el manifiesto PWA.
- Página de privacidad pública y almacenada sin conexión.
- Archivos de audio e ilustraciones empaquetados en la caché del service worker.

## Seguridad y tareas posteriores

Antes de generar un AAB firmado hacen falta **el dominio definitivo, la cuenta de Google Play y el nombre definitivo del paquete**. No subir claves privadas al repositorio, no modificar el dominio en producción sin un plan de exportación/restauración de hábitos y no afirmar que el contenedor TWA garantiza recordatorios cuando la app está cerrada.
