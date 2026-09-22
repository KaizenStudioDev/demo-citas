const SERVIDOR = ""; // O la URL de Render en producción

let paginaActual = 0;
const LIMITE_PAGINA = 50;

// Utilidad para escapar HTML y evitar XSS
function escaparHTML(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// Configurar restricción visual de fecha mínima
function configurarFechaMinima() {
  const inputFecha = document.getElementById('fecha');
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
  inputFecha.min = ahora.toISOString().slice(0, 16);
}

// --- Pedir la lista de profesionales al servidor ---
async function cargarProfesionales() {
  const respuesta = await fetch(SERVIDOR + "/api/profesionales");
  const profesionales = await respuesta.json();
  const select = document.getElementById("profesional");
  select.innerHTML = profesionales
    .map(p => `<option value="${p.id}">${escaparHTML(p.nombre)} — ${escaparHTML(p.especialidad)}</option>`)
    .join("");
}

// --- Pedir la lista de citas paginada ---
async function cargarCitas(offset = 0) {
  paginaActual = offset;
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  
  if(btnPrev) btnPrev.disabled = offset === 0;

  const respuesta = await fetch(`${SERVIDOR}/api/citas?limit=${LIMITE_PAGINA}&offset=${offset}`);
  const citas = await respuesta.json();
  
  if(btnNext) btnNext.disabled = citas.length < LIMITE_PAGINA;

  const tabla = document.getElementById("tabla-citas");
  tabla.innerHTML = citas
    .map(c => `<tr>
                 <td>${escaparHTML(c.paciente)}</td>
                 <td>${escaparHTML(c.profesional)}</td>
                 <td>${new Date(c.fecha_hora).toLocaleString("es-CO")}</td>
               </tr>`)
    .join("");
}

function cambiarPagina(delta) {
  const nuevoOffset = paginaActual + (delta * LIMITE_PAGINA);
  if (nuevoOffset >= 0) {
    cargarCitas(nuevoOffset);
  }
}

// --- Enviar una nueva cita ---
async function crearCita() {
  const boton = document.getElementById("btn-reservar");
  boton.disabled = true;
  boton.textContent = "Procesando...";

  const valorFecha = document.getElementById("fecha").value;
  const datos = {
    paciente: document.getElementById("paciente").value,
    profesional_id: document.getElementById("profesional").value,
    fecha_hora: valorFecha ? new Date(valorFecha).toISOString() : "",
  };

  try {
    const respuesta = await fetch(SERVIDOR + "/api/citas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    const resultado = await respuesta.json();

    const mensaje = document.getElementById("mensaje");
    if (respuesta.ok) {
      const prof = document.getElementById("profesional");
      mensaje.className = "ok";
      mensaje.innerHTML = `
        <strong>✓ Cita confirmada</strong> (código ${resultado.id})<br>
        Paciente: ${escaparHTML(datos.paciente)}<br>
        Profesional: ${escaparHTML(prof.options[prof.selectedIndex].text)}<br>
        Fecha: ${new Date(datos.fecha_hora).toLocaleString("es-CO")}`;
      
      document.getElementById("paciente").value = "";
      document.getElementById("fecha").value = "";
      cargarCitas(0); // Recargar desde la primera página
    } else {
      mensaje.className = "error";
      mensaje.textContent = "El servidor la rechazó: " + resultado.error;
    }
  } catch (err) {
    console.error("Error de red", err);
    alert("Error de conexión al guardar la cita.");
  } finally {
    boton.disabled = false;
    boton.textContent = "Reservar";
  }
}

// --- Al abrir la página ---
window.addEventListener('DOMContentLoaded', async () => {
  const estado = document.getElementById("estado-servidor");
  configurarFechaMinima();
  
  try {
    const r = await fetch(SERVIDOR + "/api/salud");
    const s = await r.json();
    estado.textContent = "Servidor activo · respuesta recibida a las " +
      new Date(s.hora).toLocaleTimeString("es-CO");
    await cargarProfesionales();
    await cargarCitas();
  } catch (e) {
    estado.textContent = "No hay conexión con el servidor. Sin él, este cliente no puede hacer nada.";
  }
});
