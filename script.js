let escaner;

// TU URL DE APLICACIÓN WEB DE GOOGLE APPS SCRIPT (CEREBRO)
const urlGoogle = "https://script.google.com/macros/s/AKfycbxHw7Yvwc2Prl5BuiNoK-QyT0OEFkTtHN3hCceCpVpMjo7j97IsmczJ4zx5LSVoTzTi4Q/exec";

function mostrarMensaje(texto, tipo) {
  const msj = document.getElementById("resultado");
  msj.className = "badge " + tipo;
  msj.innerText = texto;
  msj.style.display = "block";
}

function verificarTokenDocente() {
  let token = localStorage.getItem("token_docente");
  if (!token) {
    console.log("Dispositivo sin token");
  }
  return true;
}

// 1. CONEXIÓN REAL DEL ESCÁNER QR
function alLeerQR(texto) {
  escaner.pause(true);
  mostrarMensaje("⏳ Procesando QR en Base de Datos...", "processing");

  // Enviamos el código QR a Google Sheets usando el parámetro ?qr=
  fetch(`${urlGoogle}?qr=${encodeURIComponent(texto)}`)
    .then(response => response.json())
    .then(data => {
      if (data.status === "SUCCESS") {
        mostrarMensaje("✅ " + data.mensaje, "success");
      } else {
        mostrarMensaje("❌ " + data.mensaje, "error");
      }
      
      // Espera 3 segundos mostrando el resultado y reactiva la cámara
      setTimeout(() => {
        document.getElementById("resultado").style.display = "none";
        escaner.resume();
      }, 3000);
    })
    .catch(err => {
      mostrarMensaje("❌ Error de conexión con el servidor.", "error");
      setTimeout(() => escaner.resume(), 3000);
    });
}

// 2. CONEXIÓN REAL DEL INGRESO MANUAL (SIN CARNET)
function enviarRegistroManual() {
  let cedula = document.getElementById("cedula-manual").value;

  if (!cedula) {
    mostrarMensaje("Ingrese una cédula", "error");
    return;
  }

  mostrarMensaje("⏳ Procesando ingreso manual...", "processing");

  // Pasamos el ID manual como si fuera un QR (ALU- + Cédula)
  let codigoFormateado = "ALU-" + cedula.trim();

  fetch(`${urlGoogle}?qr=${encodeURIComponent(codigoFormateado)}`)
    .then(response => response.json())
    .then(data => {
      if (data.status === "SUCCESS") {
        mostrarMensaje("✅ " + data.mensaje, "success");
        setTimeout(() => {
          ocultarFormularioManual();
          document.getElementById("cedula-manual").value = "";
        }, 2000);
      } else {
        mostrarMensaje("❌ " + data.mensaje, "error");
      }
    })
    .catch(err => {
      mostrarMensaje("❌ Error de conexión con el servidor.", "error");
    });
}

function iniciarCamara() {
  if (!verificarTokenDocente()) return;

  document.getElementById("btn-iniciar").style.display = "none";
  document.getElementById("btn-abrir-manual").style.display = "none";
  document.getElementById("lector-wrapper").style.display = "block";
  document.getElementById("resultado").style.display = "none";

  mostrarMensaje("Solicitando cámara...", "processing");

  Html5Qrcode.getCameras()
    .then(dispositivos => {
      if (dispositivos.length > 0) {
        escaner = new Html5Qrcode("lector");
        
        // Intenta encender la cámara trasera por defecto
        escaner.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 250, height: 250 } },
          alLeerQR
        )
        .then(() => {
          document.getElementById("resultado").style.display = "none";
        })
        .catch(() => {
          // Si falla (como en PC), usa la primera cámara disponible (webcam frontal)
          escaner.start(
            dispositivos[0].id,
            { fps: 15, qrbox: { width: 250, height: 250 } },
            alLeerQR
          ).then(() => {
            document.getElementById("resultado").style.display = "none";
          });
        });
      }
    })
    .catch(() => {
      mostrarMensaje("❌ Error de cámara. Conceda permisos.", "error");
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
  }
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
}
