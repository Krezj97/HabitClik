# Punto de continuación · HabitClik
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
