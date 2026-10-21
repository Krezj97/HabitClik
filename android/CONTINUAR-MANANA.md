# Punto de continuación · HabitClik

## ESTADO VIGENTE — 21 de octubre de 2026, 20:02 (Madrid)

**Esta es la sección vigente al retomar.** Los apartados siguientes son históricos y pueden describir versiones anteriores.

- Repositorio: https://github.com/Krezj97/HabitClik — rama main.
- App: https://krezj97.github.io/HabitClik/
- Commit funcional comprobado: cf96debc750daddf4815f8c95e4a4e41d356d268.
- Versión PWA: **v26**.
- [Pruebas automáticas — SUCCESS](https://github.com/Krezj97/HabitClik/actions/runs/39633880745).
- [Android preview APK — SUCCESS](https://github.com/Krezj97/HabitClik/actions/runs/39633880489), artefacto HabitClik-Android-PRUEBAS-APK, disponible hasta 04/11/2026.
- [GitHub Pages — SUCCESS](https://github.com/Krezj97/HabitClik/actions/runs/39633879901).
- Los tres procesos verificados corresponden al mismo commit.

### Diseño actual

- La imagen compartida por el usuario es la referencia clave: cabecera con paisaje y saludo, progreso flotante, hábitos compactos, frases ilustradas cambiantes, nivel e insignias, y barra inferior.
- Estructura implementada en pantalla principal: home-welcome, hero-main, motivation-poster, top-data-menu; tipografía Nunito Sans local, fondos SVG.
- La última incidencia visible fue la **escasa legibilidad de los textos de la barra lateral de escritorio**. El CSS v26 actual incluye una corrección real del contraste para textos, iconos, enlaces y estados activos/inactivos. Incluye además mejoras de presentación en Estadísticas e insignias.
- No se trata solo del CSS sugerido en el chat: la corrección está en el repositorio. Las pruebas, APK y Pages ya han pasado; cualquier validación visual debe hacerse en navegador real.
- Frases configurables cada 15 s, con controles manuales; verificar en móvil si persisten incidencias.

### Verificaciones reales del usuario

- Llegaron las notificaciones nativas Android, inmediata y con pantalla bloqueada.
- El usuario pudo **exportar e importar su JSON** en Android.
- Antes de desinstalar una APK debug, guardar una copia fuera del dispositivo y confirmar el archivo, pues las firmas debug pueden cambiar. El JSON no contiene el audio personalizado.

### Para continuar hacia Google Play

1. Revisar v26 en escritorio y Android comparando con la imagen de referencia, especialmente el contraste del menú lateral.
2. Elegir un identificador de paquete definitivo. dev.habitclik.preview es temporal, **no de producción**.
3. Confirmar la cuenta Google Play Console y si es personal u organización, cuando resulte necesario.
4. Preparar AAB release firmado, gestionar Play App Signing y nunca subir claves privadas ni contraseñas al repositorio.
5. Completar datos reales de privacidad y soporte, capturas auténticas, ficha de Play Store y declaración de Seguridad de los datos, y pruebas según el tipo de cuenta.
6. Premium no tiene cobro ni desbloqueo real; no anunciarlo como función operativa.

Guías: android/LANZAMIENTO-GOOGLE-PLAY.md, android/PLAYSTORE.md, android/ANDROID-TESTING.md, android/NOTIFICACIONES-ANDROID.md.

---

## Historial anterior (puede describir versiones antiguas)


## Avance siguiente · recuperación y copia Android v22

- Tras confirmar el usuario que la APK v21 envía correctamente la notificación inmediata y la de pantalla bloqueada, se ha preparado **exportación JSON nativa Android** con Capacitor Filesystem y Share, sin permisos de almacenamiento global.
- Usa la opción **Guardar copia** en la APK para abrir el selector nativo de compartir/guardar y almacenar el archivo fuera de HabitClik. El archivo temporal dentro de la app no es una copia duradera por sí mismo.
- Al **importar**, se mantiene el selector de archivo HTML del WebView y validación previa de JSON. Es imprescindible probar importación y exportación en un Android real antes de desinstalar la versión anterior.
- Las builds de pruebas siguen firmadas con claves debug posiblemente distintas; la instalación encima de una APK anterior puede fallar y requerir desinstalar (cuidado: datos locales).
- El sistema de pagos Premium, certificado Play Signing, identificador definitivo del paquete y AAB de producción siguen pendientes.

---

## Mejoras de usabilidad · edición v20

La aplicación web y la próxima APK Android de pruebas incluyen:
- Frases motivacionales que van rotando despacio cada **20 segundos**, se pausan con la pestaña oculta o movimiento reducido y siguen permitiendo cambio manual.
- Importar/exportar una copia JSON dentro del menú **Opciones (⋯)**, en vez de botones grandes en la barra principal.
- **Alarmas independientes por hábito**, cada una con activación, hora, sonido y fecha del último aviso; configurables tanto al editar el hábito como desde Avisos. El ajuste de sonido general es separado. Se conservan historial y preferencias antiguas. **Los avisos solo pueden reproducirse con la app abierta/activa; todavía no son AlarmManager nativo Android.**
- Insignias accesibles incluso con un solo hábito gratuito; cuentan check-ins, días activos, rachas y metas reales, no la creación de 100 hábitos distintos.
- Frases, textos de bienvenida y mensajes de logros reescritos con tono más conversacional.
- Caché PWA **v20**. La rama `main` publica automáticamente en GitHub Pages.
- GitHub Actions `Android preview APK` ahora reconstruye la APK debug ante modificaciones de app.
- Antes de entregar una APK actualizada, comprobar que el artefacto pertenece al commit v20 más reciente y que el workflow concluyó **success**.

**Por validar en móvil físico:** reproducción y volumen de alarmas personalizadas, interacción con archivos de copia JSON dentro de Capacitor/WebView y avisos tras suspensión de la aplicación. No afirmar notificaciones nativas cuando está cerrada.

---

## Avance posterior · primera APK Android instalada como artefacto de pruebas

**21 de octubre de 2026:** se ha añadido un empaquetado **Capacitor 8.5.3** en `capacitor.config.json`, `package.json`, `android/prepare-web.cjs` y el flujo `.github/workflows/android-preview.yml`. La web se copia al paquete y permanece intacta en GitHub Pages.

- **Compilación APK DEBUG real:** [Android preview APK, ejecución 39599064718](https://github.com/Krezj97/HabitClik/actions/runs/39599064718) — **success**.
- **Descarga desde GitHub Actions:** artefacto `HabitClik-Android-PRUEBAS-APK`, ID `12344638836`, disponible hasta el **4 de noviembre de 2026**.
- **Tamaño del archivo APK:** 5.438.094 bytes. **SHA-256:** `d1cd0ccb1318f9b5e56fe4e8b30572b68becbb563e3741a121a7eb7506f0a145`.
- Verificados el manifiesto Android, clases, HTML empaquetado, cinco MP3 y **quince iconos nativos ya con el logo de HabitClik**.
- **Identidad de pruebas:** `dev.habitclik.preview`, nombre `HabitClik (Pruebas)`. La ruta generada `android-native/` no se sube a Git; la carpeta `android/` sigue guardando guías y scripts.
- **Pruebas y GitHub Pages tras el último cambio:** [checks 39599096436](https://github.com/Krezj97/HabitClik/actions/runs/39599096436) — **success**; [Pages 39599095805](https://github.com/Krezj97/HabitClik/actions/runs/39599095805) — **success**.
- Consulta [ANDROID-TESTING.md](ANDROID-TESTING.md) para instalación y escenarios pendientes. **Todavía no se ha probado en un dispositivo Android real ni se ha generado un AAB de producción**.
- La build de debug se firma con una clave de pruebas distinta en cada ejecución: para cambiar de APK puede requerirse desinstalar, lo que borra los datos locales si no hay copia exportada.

**Siguiente paso pendiente:** instalar la APK en un teléfono Android real, comprobar navegación, hábitos y XP, audios, exportación/importación y calendario; corregir los problemas específicos del WebView. Después elegir identidad de app comercial, permisos e integración de funciones nativas reales antes de Play Store.

---

**Guardado:** 21 de octubre de 2026

## Estado comprobado al cerrar
- **Web en producción:** https://krezj97.github.io/HabitClik/
- **Código:** https://github.com/Krezj97/HabitClik (rama `main`)
- **Última versión funcional comprobada:** optimización Android PWA v19, commit `38d5e24da7593bec7fc5bd8d54939453801aef94`.
- **Pruebas automáticas:** GitHub Actions `HabitClik checks`, ejecución [39514331853](https://github.com/Krezj97/HabitClik/actions/runs/39514331853): **success**.
- **GitHub Pages:** ejecución [39514331566](https://github.com/Krezj97/HabitClik/actions/runs/39514331566): **success**.
- Este archivo de resumen no implica un cambio funcional en la app.

## Lo ya implementado
- Interfaz responsive Android, menú inferior de cuatro pestañas, soporte para áreas seguras, pantallas pequeñas, objetivos táctiles amplios, formularios, teclado y botón Atrás.
- Progreso diario y hábitos arriba; XP, niveles e insignias; ilustraciones vectoriales con paisajes.
- Cinco MP3 licenciados CC0 y opción para subir alarma propia; volumen ajustable.
- PWA con caché sin conexión, manifiesto, accesos directos y política de privacidad (`privacy.html`).
- Hasta tres hábitos gratuitos (Premium aún sin pagos), sin borrar los hábitos antiguos que excedieran el límite.
- Guía técnica existente: [PLAYSTORE.md](PLAYSTORE.md).

## Siguiente sesión: Android / Play Store
1. Evaluar ruta práctica para un **APK de pruebas** y después **AAB**: TWA/Bubblewrap con dominio verificable, o Capacitor para integración Android más profunda.
2. **Decisión pendiente:** dominio público definitivo. El proyecto actual vive bajo `https://krezj97.github.io/HabitClik/`. Para una TWA verificada, `assetlinks.json` debe servirse en la raíz del origen, que este repo de proyecto no controla.
3. Preparar el proyecto Android de desarrollo cuando estén definidos origen y `applicationId`. No subir certificados `.jks`, contraseñas ni otros secretos.
4. Verificar en Android real navegación, caché/offline, diálogos, sonidos, exportación/importación, permisos y acceso a privacidad. No consta prueba real en dispositivo todavía.
5. Generar **AAB** para pruebas internas de Play Console, revisar el SDK objetivo vigente, política de privacidad, ficha de tienda y formulario Seguridad de los datos.
6. Si queremos **alarmas cuando la app está cerrada**, desarrollar funcionamiento nativo: empaquetar la web como TWA no añade por sí solo alarmas de Android.
7. **No existe integración Premium/pagos todavía.** Integrar facturación válida en Google Play y comprobación de derechos de acceso antes de habilitar compras.
8. Planificar exportación/migración de hábitos antes de cambiar de dominio, porque el almacenamiento local no se transfiere automáticamente entre orígenes.

## Importante al reanudar
El usuario solicitó: «optimízalo para móviles Android que lo lanzaremos por Play Store», después «vamos» y finalmente «seguimos mañana, guarda el progreso». Al reanudar, partir del estado de este archivo y de `android/PLAYSTORE.md`, comprobar el repositorio y continuar la preparación Android. No afirmar que la app ya esté en Google Play ni que exista un AAB firmado.
