# Prueba de notificaciones nativas en Android (HabitClik v21)

HabitClik ahora incluye el complemento oficial **@capacitor/local-notifications 8.3.1** en su APK de pruebas. No depende de las notificaciones del navegador dentro de Android WebView.

## Cómo probarlo en un móvil

1. Descarga la **nueva APK v21** desde el último artefacto `HabitClik-Android-PRUEBAS-APK` del flujo [Android preview APK](https://github.com/Krezj97/HabitClik/actions/workflows/android-preview.yml). No uses la APK anterior.
2. **Antes de reinstalar**: si tienes hábitos importantes en la APK vieja, entra en **Opciones → Guardar copia**, guarda el JSON en un lugar seguro y comprueba que el archivo existe. Las builds debug pueden usar firmas distintas. Desinstalar la versión previa borra los hábitos locales si no se ha guardado la copia.
3. Instala la nueva APK. En **Avisos → Notificaciones → Activar en Android**, acepta el permiso que muestra el propio sistema (Android 13+). Si está bloqueado, entra en **Ajustes → Aplicaciones → HabitClik (Pruebas) → Notificaciones** y permítelo.
4. Pulsa **Enviar prueba**. El aviso debe verse en la barra de notificaciones de Android. Puede no aparecer como banner si el teléfono no muestra ventanas emergentes; desliza hacia abajo para comprobarlo.
5. Pulsa **Probar con pantalla bloqueada (20 s)** y bloquea la pantalla. Se programa una notificación Android **aproximadamente** 20 segundos después; Android puede retrasarla por ahorro de batería.
6. Crea un hábito, entra en **Avisos → Un aviso para cada hábito**, actívalo y pon una hora futura. La APK programa hasta **7 días de avisos locales** con su propio canal y tono, sin depender del recordatorio general. Abre HabitClik al menos una vez por semana para renovar los 7 días.
7. Comprueba los ajustes de **volumen de notificaciones**, **No molestar** y **ahorro de batería**. El control de volumen de previsualización dentro de HabitClik no controla la intensidad de las notificaciones del sistema.

## Lo que sí hace y los límites actuales

- Las notificaciones Android las gestiona el sistema y pueden llegar cuando HabitClik está en segundo plano o la pantalla está bloqueada, sin conexión ni servidor.
- El complemento requiere permiso de notificaciones. **No** solicita el permiso especial para alarmas exactas: la hora es **aproximada** y depende de Android y el fabricante. No promete despertar al usuario como un despertador.
- Los sonidos Brisa, Luz, Despertar, Buen día y Bosque están empaquetados como recursos nativos `res/raw`, con un canal Android por tono. Si el hábito usa un audio personalizado de IndexedDB, el recordatorio Android utiliza **Brisa** como sustituto; el archivo personal continúa disponible en la previsualización web, pero no se puede usar directamente como tono nativo sin más integración.
- Las alarmas se actualizan cuando se crean, editan, eliminan o completan hábitos, al entrar en Avisos o al volver a abrir la app. Los hábitos completados antes de su aviso se excluyen al sincronizar.
- No se agregan servicios de mensajería, cuentas ni servidores de notificaciones. Las notificaciones locales las programa el propio móvil.
- Si la prueba no aparece, primero verifica **si Android concedió permiso**, comprueba la cortina de notificaciones, luego usa la prueba programada y consulta los ajustes del sistema.

## Cambios de compilación

`package.json` incluye el paquete oficial, `native-notifications.js` gestiona permisos/canales/pruebas/programación de avisos sin pedir permisos en la web y `.github/workflows/android-preview.yml` añade los MP3 de CC0 a los recursos nativos.

El paquete es todavía **APK debug**; no es AAB firmado para Google Play. Se necesita probarlo en un teléfono físico antes de declarar fiabilidad real en segundo plano.
