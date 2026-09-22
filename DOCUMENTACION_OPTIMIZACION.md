# Documentación Técnica: Optimización de Arquitectura Cliente-Servidor

Este documento detalla los cambios arquitectónicos, de código y de base de datos implementados para optimizar el rendimiento, la seguridad y la concurrencia de la aplicación. Además, presenta un análisis comparativo de las métricas de rendimiento antes y después de la optimización.

---

## 1. Cambios Implementados

### 1.1 Base de Datos (PostgreSQL en Supabase)
**Problema:** Bajo pruebas de carga simulando alta concurrencia en la creación de citas (método POST), múltiples peticiones simultáneas lograban engañar la validación de código de JavaScript, insertando citas para el mismo profesional a la misma hora (Condición de Carrera / Race Condition).
**Solución:** 
- Se delegó la integridad referencial y de concurrencia directamente al motor de la base de datos (Postgres).
- Se ejecutó una migración (`db/migration_1.sql`) agregando una restricción única: `ALTER TABLE citas ADD CONSTRAINT cita_unica UNIQUE (profesional_id, fecha_hora);`.
- Esto garantiza que, a nivel atómico, sea imposible agendar citas cruzadas, independientemente del volumen de tráfico.

### 1.2 Backend (Node.js + Express)
**Problema:** El archivo `server.js` era un monolito que gestionaba conexiones, rutas y lógica. Bajo una carga de 500 conexiones concurrentes, el servidor colapsaba (tiempos de respuesta de hasta 10 segundos) por agotamiento del *Pool* de base de datos y saturación del *Event Loop* al parsear consultas masivas.
**Solución:**
1. **Modularización:** Se reestructuró el proyecto utilizando el patrón MVC (Controladores, Rutas y Configuración).
   - `src/config/db.js`: Administra el *Pool* de Postgres. Se aumentó el límite de conexiones a 20 (`max: 20`) y se implementó un *listener* de errores para evitar caídas de la aplicación por desconexiones inactivas.
   - `src/routes/api.js`: Centraliza las rutas de la API.
2. **Caché en Memoria:** En `src/controllers/citasController.js` y `profesionalesController.js`, se implementó un caché local (TTL de 3 y 10 segundos respectivamente). Esto significa que bajo un ataque o ráfaga de peticiones (ej. 500 peticiones en 1 segundo), solo la primera consulta golpea a Supabase; las 499 restantes se resuelven instantáneamente desde la memoria RAM de Node.js.
3. **Paginación:** Se agregaron los parámetros `LIMIT` y `OFFSET` (por defecto 50 registros) al endpoint `GET /api/citas`. Esto evita que la base de datos y Node.js se saturen serializando el historial completo de citas.
4. **Graceful Shutdown:** Se agregó soporte para interceptar señales `SIGTERM` / `SIGINT` en `server.js`, garantizando que el servidor cierre las conexiones activas a Postgres de manera limpia antes de apagarse.

### 1.3 Frontend (Vanilla JS)
**Problema:** El cliente no contaba con paginación, era vulnerable a ataques XSS y permitía enviar múltiples peticiones idénticas si el usuario hacía clics rápidos.
**Solución:**
1. **Prevención XSS:** Se creó una función de utilidad `escaparHTML(texto)` que utiliza la API del DOM (`document.createElement`) para sanitizar los nombres de los pacientes y profesionales antes de inyectarlos en la tabla (`innerHTML`).
2. **Deshabilitación de Botones:** Al hacer clic en "Reservar", el botón se deshabilita y cambia su texto a "Procesando..." hasta que la red responda, bloqueando peticiones duplicadas accidentales.
3. **Paginación en UI:** Se añadieron botones para navegar ("Anteriores" y "Siguientes") que interactúan con los nuevos parámetros `offset` y `limit` del backend.
4. **Separación de Responsabilidades:** Se extrajo el CSS a `public/styles.css` y la lógica a `public/app.js`, dejando un `index.html` limpio. Se implementó una validación dinámica en JS para que el `input type="datetime-local"` no permita seleccionar fechas pasadas en la interfaz.

---

## 2. Análisis de Métricas de Rendimiento (Autocannon)

Se realizaron pruebas de carga con la herramienta `autocannon` apuntando al entorno de producción en Render (Oregon). Las pruebas de baja carga (10 conexiones) confirmaron que el "piso" de latencia de red es de aproximadamente ~150ms.

El cambio más dramático y exitoso se observó en la **Prueba de Estrés Severo (GET /api/citas con 500 conexiones concurrentes durante 20 minutos)**.

### Tabla Comparativa de Estrés (500 Conexiones / 20 min)

| Métrica | Antes de la Optimización | Después de la Optimización | Mejora |
| :--- | :--- | :--- | :--- |
| **Peticiones Totales Procesadas** | 331,000 | 454,000 | **+ 37.1%** (123,000 más) |
| **Peticiones por Segundo (Avg)** | 276.07 req/sec | 377.85 req/sec | **+ 36.8%** de Throughput |
| **Latencia Promedio** | 1,813.67 ms (1.8s) | 1,324.29 ms (1.3s) | **- 27.0%** más rápido |
| **Latencia Máxima (Picos)** | 9,981 ms (~10s) | 4,616 ms (~4.6s) | **- 53.7%** (Se cortó a la mitad) |
| **Errores / Timeouts** | 11 timeouts | 3 timeouts | Mayor estabilidad de red |

### Conclusión de las Pruebas

1. **Aumento de Capacidad Bruta:** La combinación de la paginación (enviar menos datos por petición) y el caché en memoria (evitar viajar hasta Supabase cientos de veces por segundo) permitió al mismo servidor (con los mismos recursos de CPU/RAM de Render) procesar **123,000 peticiones adicionales** en el mismo marco de tiempo de 20 minutos.
2. **Estabilidad y Resiliencia:** Antes de la optimización, el servidor sufría picos de latencia de hasta 10 segundos debido al encolamiento excesivo en el *Pool* de base de datos. Con el caché y el aumento del Pool, los peores escenarios se redujeron a la mitad (4.6s), y los tiempos de espera (timeouts) bajaron significativamente.
3. **El Cuello de Botella se movió:** Inicialmente, el cuello de botella era la Base de Datos y la serialización JSON. Tras la optimización, el cuello de botella es estrictamente la capacidad de cómputo del contenedor de Render y la red internacional, confirmando que la aplicación a nivel de código ahora es altamente eficiente.
