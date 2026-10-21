# Lanzamiento de HabitClik en Google Play — siguiente tramo

> Estado a 21 de octubre de 2026: la APK de pruebas de HabitClik ya ha sido probada por su creador en Android: **notificaciones locales inmediatas y con la pantalla bloqueada funcionan**, y **exportar/restaurar copia JSON funciona en el dispositivo**. La app **NO está publicada** en Google Play y todavía no existe un AAB firmado para producción.

## 1. Qué está resuelto

- PWA y APK con Capacitor 8, adaptable a teléfonos Android.
- Progreso, XP, rachas, insignias, cinco sonidos CC0 y avisos independientes por hábito.
- Notificaciones locales de Android comprobadas en un móvil real por el usuario.
- Copias JSON exportadas y restauradas correctamente según las pruebas del usuario (el audio propio sigue sin incluirse).
- Diseño, fuente Nunito Sans (OFL), fondos ilustrados y frases automáticas v23; la última APK visual requiere volver a probarse en Android.
- SDK objetivo API 36 en compilaciones Android de prueba. El requisito oficial para nuevas apps desde el **31/08/2026** es **API 36+**.

## 2. Decisiones necesarias para generar un AAB válido

**No hace falta comprar un dominio para la versión con Capacitor**, porque la app se empaqueta localmente; la web de GitHub Pages puede mantenerse como página informativa. Sí necesitamos:

1. Titular de la publicación y **cuenta de desarrollador de Google Play Console** de su propiedad. Confirmar que está creada y verificada; no compartir claves ni contraseñas por el chat.
2. Elegir el **identificador de paquete final** antes de subir la primera versión (formato `com.organizacion.habitclik`). Evitar `dev.habitclik.preview` porque es el identificador temporal de las APK de prueba. Un `applicationId` no se puede cambiar para la misma ficha publicada.
3. Configurar **Play App Signing**, guardando la clave de subida y sus credenciales en un entorno controlado, nunca en este repositorio público. La compilación actual produce una **APK debug**, no un AAB de producción.
4. Incluir datos reales y contacto de privacidad del responsable en `privacy.html`, preparar una dirección de soporte pública y comprobar el formulario **Seguridad de los datos** según la app final.
5. Definir la comercialización: la app actual permite **tres hábitos gratis**; **Premium no tiene pago ni desbloqueo**. No anunciar funciones de pago activas; si se habilitan compras digitales, integrar la facturación que corresponda en Google Play.

## 3. Contenido preparado para la ficha

**Nombre recomendado:** HabitClik · Hábitos a tu ritmo

**Descripción breve propuesta:** Cuida tus hábitos, celebra tus avances y sigue a tu propio ritmo.

**Descripción ampliada:**

HabitClik te ayuda a encontrar un ritmo que puedas mantener, sin convertir cada día en una competición.

Crea tus hábitos, márcalos al completarlos y descubre cómo crece tu constancia. Consulta tu calendario y progreso, suma experiencia y desbloquea insignias por lo que haces de verdad.

- Hasta tres hábitos gratuitos.
- Objetivos diarios o semanales.
- Recordatorios individuales con horario y sonido propio.
- Niveles, XP y pequeños logros.
- Cuatro paisajes motivadores y frases que cambian automáticamente.
- Copias de seguridad para conservar tus registros.
- Funciones principales disponibles sin conexión tras instalar la app.

Los avisos de Android requieren permiso y su entrega puede variar según el ahorro de batería. Los hábitos se guardan localmente en el dispositivo. No hay cuentas ni sincronización automática entre móviles.

**Categoría sugerida:** Estilo de vida o Productividad (elegir una en Play Console).

**Recursos por preparar:** capturas **reales** en móvil Android, icono de alta resolución, imagen destacada de Play Store si se requiere, ficha de contenido/edad y correo o web de soporte.

## 4. Pruebas y publicación

- Generar un AAB de **release** firmado y subirlo a una pista de **pruebas internas**.
- Probar instalación y actualización desde Google Play, guardado/restauración del JSON, aviso tras reiniciar teléfono, permisos, varios tamaños de pantalla y uso sin conexión.
- Para **cuentas personales creadas después del 13 de noviembre de 2023**, Google exige normalmente una prueba **cerrada con al menos 12 testers inscritos durante 14 días consecutivos** antes de solicitar acceso a producción. Esta norma depende de la cuenta y no es universal.
- Preparar política de privacidad y declaración de Seguridad de los datos; completar cuestionarios de la ficha y enviar a revisión de Google.
- Tras las pruebas y la aprobación, abrir una versión gradual en producción.

## 5. Siguiente acción concreta

**Confirmar si existe ya una cuenta de desarrollador de Play Console y si será personal o de organización.** Con eso podemos escoger el `applicationId` definitivo, preparar un AAB firmado y organizar las pruebas internas. La clave de firma nunca debe guardarse en el GitHub público.

## Fuentes oficiales

- Target API 36 (desde 31/08/2026): https://support.google.com/googleplay/android-developer/answer/11926878
- Reglas de prueba para cuentas personales nuevas: https://support.google.com/googleplay/android-developer/answer/14151465
- Privacidad y Seguridad de los datos: https://support.google.com/googleplay/android-developer/answer/10144311
