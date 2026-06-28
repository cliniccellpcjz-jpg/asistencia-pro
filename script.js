// ==========================================
// CONFIGURACIÓN DE NÚCLEO - INTERFAZ PRO
// ==========================================
let escaner;
// Tu URL exacta de la Web App de Google Apps Script (Cerebro Central)
const urlGoogle = "https://script.google.com/macros/s/AKfycbxHw7Yvwc2Prl5BuiNoK-QyT0OEFkTtHN3hCceCpVpMjo7j97IsmczJ4zx5LSVoTzTi4Q/exec";

// ------------------------------------------
// 1. SISTEMA DE RUTEO Y PESTAÑAS (TAB BAR)
// ------------------------------------------
function cambiarPestaña(idVista, elemento) {
  // Limpieza de estados activos antes de cambiar de pantalla
  detenerCamara();
  ocultarFormularioManual();
  
  // Remover clases activas de todas las vistas y botones del Tab Bar
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  document.querySelectorAll('.tab-item').forEach(ti => ti.classList.remove('active'));
  
  // Activar la vista y el botón seleccionado por el docente
  document.getElementById(idVista).classList.add('active');
  elemento.classList.add('active');

  // Inicializar la vista de reportes con la fecha actual del sistema
  if (idVista === 'vista-reportes') {
    const picker = document.getElementById('filtro-fecha');
    if (!picker.value) {
      const hoy = new Date();
      // Ajustar zona horaria local para el formato YYYY-MM-DD
      const offset = hoy.getTimezoneOffset();
      const fechaLocal = new Date(hoy.getTime() - (offset * 60 * 1000));
      picker.value = fechaLocal.toISOString().split('T')[0];
      cargarReporteServidor();
    }
  }
}

// ------------------------------------------
// 2. CONSULTA ASÍNCRONA DE REPORTES HISTÓRICOS
// ------------------------------------------
function cargarReporteServidor() {
  let fechaInput = document.getElementById('filtro-fecha').value;
  if (!fechaInput) return;

  // Transformar fecha de formato HTML (YYYY-MM-DD) a formato Sheets (DD/MM/YYYY)
  let partes = fechaInput.split('-');
  let fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;

  const contenedorLista = document.getElementById('lista-estudiantes-container');
  contenedorLista.innerHTML = '<p style="color: #4F46E5; font-weight:600; margin-top:20px; font-size:14px;">⏳ Consultando base de datos en tiempo real...</p>';

  // Petición fetch al backend pasando la acción de reporte y la fecha
  fetch(`${urlGoogle}?accion=obtenerReporte&fecha=${encodeURIComponent(fechaFormateada)}`)
    .then(res => {
      if (!res.ok) throw new Error("Error en respuesta de red");
      return res.json();
    })
    .then(data => {
      // Renderizar los marcadores de las tarjetas de métricas superiores
      document.getElementById('num-total').innerText = data.total;
      document.getElementById('num-presentes').innerText = data.presentes;
      document.getElementById('num-ausentes').innerText = data.ausentes;

      // Validar si existen alumnos en la respuesta de la nómina
      if (!data.estudiantes || data.estudiantes.length === 0) {
        contenedorLista.innerHTML = '<p style="color: #6B7280; margin-top:20px; font-size:14px;">No existen alumnos registrados en la nómina global.</p>';
        return;
      }

      // Construcción dinámica de la lista interactiva de estudiantes
      let htmlLista = "";
      data.estudiantes.forEach(est => {
        let claseBadge = est.estado === "PRESENTE" ? "pres" : "aus";
        let textoBadge = est.estado === "PRESENTE" ? `🟢 ${est.hora}` : "🔴 Falta";
        
        htmlLista += `
          <div class="item-alumno">
            <div class="info">
              <h4>${est.nombre}</h4>
              <p>Curso: ${est.curso}</p>
            </div>
            <span class="status-badge ${claseBadge}">${textoBadge}</span>
          </div>
        `;
      });
      contenedorLista.innerHTML = htmlLista;
    })
    .catch(err => {
      console.error("Error cargando reporte: ", err);
      contenedorLista.innerHTML = '<p style="color: #EF4444; font-weight:600; margin-top:20px; font-size:14px;">❌ Error crítico al conectar con el servidor de Google.</p>';
    });
}

// ------------------------------------------
// 3. CAPTURA DE ASISTENCIA VÍA ESCÁNER QR
// ------------------------------------------
function alLeerQR(texto) {
  escaner.pause(true);
  mostrarMensaje("⏳ Procesando código QR en la base de datos...", "processing");

  // Envío del ID escaneado al script central
  fetch(`${urlGoogle}?qr=${encodeURIComponent(texto)}`)
    .then(response => response.json())
    .then(data => {
      if (data.status === "SUCCESS") {
        mostrarMensaje("✅ " + data.mensaje, "success");
      } else {
        mostrarMensaje("❌ " + data.mensaje, "error");
      }
      
      // Mostrar la alerta por 3 segundos y reactivar el motor del escáner
      setTimeout(() => {
        document.getElementById("resultado").style.display = "none";
        escaner.resume();
      }, 3000);
    })
    .catch(err => {
      console.error("Error en lectura QR: ", err);
      mostrarMensaje("❌ Error de comunicación con el servidor.", "error");
      setTimeout(() => escaner.resume(), 3000);
    });
}

// ------------------------------------------
// 4. CAPTURA DE ASISTENCIA VÍA REGISTRO MANUAL
// ------------------------------------------
function enviarRegistroManual() {
  let cedula = document.getElementById("cedula-manual").value;

  if (!cedula) {
    mostrarMensaje("Por favor, ingrese un número de cédula válido.", "error");
    return;
  }

  mostrarMensaje("⏳ Procesando registro manual de asistencia...", "processing");
  // Formatear la cadena para que coincida con la nomenclatura de la base de datos (ALU- + Cédula)
  let codigoFormateado = "ALU-" + cedula.trim();

  fetch(`${urlGoogle}?qr=${encodeURIComponent(codigoFormateado)}`)
    .then(response => response.json())
    .then(data => {
      if (data.status === "SUCCESS") {
        mostrarMensaje("✅ " + data.mensaje, "success");
        // Cerrar el formulario y limpiar el campo de texto tras 2 segundos de éxito
        setTimeout(() => {
          ocultarFormularioManual();
          document.getElementById("cedula-manual").value = "";
        }, 2000);
      } else {
        mostrarMensaje("❌ " + data.mensaje, "error");
      }
    })
    .catch(err => {
      console.error("Error en registro manual: ", err);
      mostrarMensaje("❌ Error de comunicación con el servidor.", "error");
    });
}

// ------------------------------------------
// 5. INFRAESTRUCTURA DE CONTROL DE CÁMARA
// ------------------------------------------
function iniciarCamara() {
  document.getElementById("btn-iniciar").style.display = "none";
  document.getElementById("btn-abrir-manual").style.display = "none";
  document.getElementById("lector-wrapper").style.display = "block";
  document.getElementById("resultado").style.display = "none";

  mostrarMensaje("Solicitando acceso a la cámara...", "processing");

  Html5Qrcode.getCameras()
    .then(dispositivos => {
      if (dispositivos && dispositivos.length > 0) {
        escaner = new Html5Qrcode("lector");
        
        // Estrategia: Intentar encender la cámara trasera por defecto
        escaner.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 250, height: 250 } },
          alLeerQR
        )
        .then(() => {
          document.getElementById("resultado").style.display = "none";
        })
        .catch(() => {
          // Fallback: Si falla (ej. en PC sin cámara trasera), abrir la primera cámara disponible
          escaner.start(
            dispositivos[0].id,
            { fps: 15, qrbox: { width: 250, height: 250 } },
            alLeerQR
          ).then(() => {
            document.getElementById("resultado").style.display = "none";
          });
        });
      } else {
        mostrarMensaje("❌ No se detectó ninguna cámara en este dispositivo.", "error");
      }
    })
    .catch(err => {
      console.error("Error al obtener cámaras: ", err);
      mostrarMensaje("❌ Error físico de hardware o permisos denegados.", "error");
    });
}

function detenerCamara() {
  if (escaner && escaner.isScanning) {
    escaner.stop().then(() => {
      document.getElementById("lector-wrapper").style.display = "none";
      document.getElementById("btn-iniciar").style.display = "flex";
      document.getElementById("btn-abrir-manual").style.display = "flex";
      document.getElementById("resultado").style.display = "none";
    });
  } else {
    document.getElementById("lector-wrapper").style.display = "none";
    document.getElementById("btn-iniciar").style.display = "flex";
    document.getElementById("btn-abrir-manual").style.display = "flex";
    document.getElementById("resultado").style.display = "none";
  }
}

// ------------------------------------------
// 6. FUNCIONES COMPLEMENTARIAS DE LA INTERFAZ
// ------------------------------------------
function mostrarMensaje(texto, tipo) {
  const msj = document.getElementById("resultado");
  msj.className = "badge " + tipo;
  msj.innerText = texto;
  msj.style.display = "block";
}

function mostrarFormularioManual() {
  document.getElementById("btn-iniciar").style.display = "none";
  document.getElementById("btn-abrir-manual").style.display = "none";
  document.getElementById("manual-wrapper").style.display = "block";
  document.getElementById("resultado").style.display = "none";
}

// Limpiar y resetear el entorno del ingreso manual
function ocultarFormularioManual() {
  document.getElementById("manual-wrapper").style.display = "none";
  document.getElementById("btn-iniciar").style.display = "flex";
  document.getElementById("btn-abrir-manual").style.display = "flex";
  document.getElementById("resultado").style.display = "none";
  document.getElementById("cedula-manual").value = "";
}
