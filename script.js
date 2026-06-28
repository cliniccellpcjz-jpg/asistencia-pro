// ==========================================
// CONFIGURACIÓN DE NÚCLEO - INTERFAZ PRO
// ==========================================
let escaner;
const urlGoogle = "https://script.google.com/macros/s/AKfycbxHw7Yvwc2Prl5BuiNoK-QyT0OEFkTtHN3hCceCpVpMjo7j97IsmczJ4zx5LSVoTzTi4Q/exec";

// ------------------------------------------
// 1. SISTEMA DE RUTEO Y PESTAÑAS (TAB BAR)
// ------------------------------------------
function cambiarPestaña(idVista, elemento) {
  detenerCamara();
  ocultarFormularioManual();
  
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  document.querySelectorAll('.tab-item').forEach(ti => ti.classList.remove('active'));
  
  document.getElementById(idVista).classList.add('active');
  elemento.classList.add('active');

  if (idVista === 'vista-reportes') {
    const picker = document.getElementById('filtro-fecha');
    if (!picker.value) {
      const hoy = new Date();
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

  let partes = fechaInput.split('-');
  let fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;

  const contenedorLista = document.getElementById('lista-estudiantes-container');
  contenedorLista.innerHTML = '<p style="color: #4F46E5; font-weight:600; margin-top:20px; font-size:14px;">⏳ Consultando base de datos en tiempo real...</p>';

  fetch(`${urlGoogle}?accion=obtenerReporte&fecha=${encodeURIComponent(fechaFormateada)}`)
    .then(res => {
      if (!res.ok) throw new Error("Error en respuesta de red");
      return res.json();
    })
    .then(data => {
      document.getElementById('num-total').innerText = data.total || 0;
      document.getElementById('num-presentes').innerText = data.presentes || 0;
      document.getElementById('num-ausentes').innerText = data.ausentes || 0;

      if (!data.estudiantes || data.estudiantes.length === 0) {
        contenedorLista.innerHTML = '<p style="color: #6B7280; margin-top:20px; font-size:14px;">No existen alumnos registrados en la nómina global.</p>';
        return;
      }

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
  if (escaner) {
    escaner.pause(true);
  }
  mostrarMensaje("⏳ Procesando código QR en la base de datos...", "processing");

  // Enviamos el código QR limpio (Ej: ALU-1206414011) para que machee directo contra la Columna A del Excel
  fetch(`${urlGoogle}?qr=${encodeURIComponent(texto.trim())}`)
    .then(response => response.json())
    .then(data => {
      if (data.status === "SUCCESS") {
        mostrarMensaje("✅ " + data.mensaje, "success");
      } else {
        mostrarMensaje("❌ " + data.mensaje, "error");
      }
      
      setTimeout(() => {
        document.getElementById("resultado").style.display = "none";
        if (escaner && escaner.isScanning) {
          escaner.resume();
        }
      }, 2500);
    })
    .catch(err => {
      console.error("Error en lectura QR: ", err);
      mostrarMensaje("❌ Error de comunicación con el servidor.", "error");
      setTimeout(() => {
        if (escaner && escaner.isScanning) {
          escaner.resume();
        }
      }, 2500);
    });
}

// ------------------------------------------
// 4. CAPTURA DE ASISTENCIA VÍA REGISTRO MANUAL
// ------------------------------------------
function enviarRegistroManual() {
  let cedula = document.getElementById("cedula-manual").value;

  if (!cedula || cedula.trim() === "") {
    mostrarMensaje("Por favor, ingrese un número de cédula válido.", "error");
    return;
  }

  mostrarMensaje("⏳ Procesando registro manual de asistencia...", "processing");
  
  // 🚨 CORRECCIÓN: El registro manual ahora formatea el código como un QR (ALU- + Cédula)
  // De esta forma, el backend recibe el mismo tipo de dato exacto sin importar si fue escaneado o escrito.
  let codigoFormateado = "ALU-" + cedula.trim();

  fetch(`${urlGoogle}?qr=${encodeURIComponent(codigoFormateado)}`)
    .then(response => response.json())
    .then(data => {
      if (data.status === "SUCCESS") {
        mostrarMensaje("✅ " + data.mensaje, "success");
        setTimeout(() => {
          ocultarFormularioManual();
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
// 5. INFRAESTRUCTURA DE CONTROL DE CÁMARA Y PERMISOS
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
        
        escaner.start(
          { facingMode: "environment" },
          { fps: 20, qrbox: { width: 260, height: 260 } },
          alLeerQR
        )
        .then(() => {
          document.getElementById("resultado").style.display = "none";
        })
        .catch(() => {
          escaner.start(
            dispositivos[0].id,
            { fps: 20, qrbox: { width: 260, height: 260 } },
            alLeerQR
          ).then(() => {
            document.getElementById("resultado").style.display = "none";
          }).catch(err => {
            console.error("Error definitivo de hardware: ", err);
            mostrarMensaje("❌ Permiso denegado por el navegador. Revise el candadito.", "error");
            detenerCamara();
          });
        });
      } else {
        mostrarMensaje("❌ No se detectó ninguna cámara en este dispositivo.", "error");
        detenerCamara();
      }
    })
    .catch(err => {
      console.error("Error al obtener cámaras: ", err);
      mostrarMensaje("❌ Permiso denegado. Active la cámara en su navegador.", "error");
      detenerCamara();
    });
}

function detenerCamara() {
  if (escaner && escaner.isScanning) {
    escaner.stop().then(() => {
      resetearUIEscaner();
    }).catch(err => {
      console.error("Error al detener el escáner: ", err);
      resetearUIEscaner();
    });
  } else {
    resetearUIEscaner();
  }
}

function resetearUIEscaner() {
  document.getElementById("lector-wrapper").style.display = "none";
  document.getElementById("btn-iniciar").style.display = "flex";
  document.getElementById("btn-abrir-manual").style.display = "flex";
  document.getElementById("resultado").style.display = "none";
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

function ocultarFormularioManual() {
  document.getElementById("manual-wrapper").style.display = "none";
  document.getElementById("btn-iniciar").style.display = "flex";
  document.getElementById("btn-abrir-manual").style.display = "flex";
  document.getElementById("resultado").style.display = "none";
  document.getElementById("cedula-manual").value = "";
}
