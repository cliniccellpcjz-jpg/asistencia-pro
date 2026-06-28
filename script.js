let escaner;

function mostrarMensaje(texto, tipo){

  const msj =
    document.getElementById("resultado");

  msj.className =
    "badge " + tipo;

  msj.innerText = texto;
  msj.style.display = "block";
}

function verificarTokenDocente(){

  let token =
    localStorage.getItem(
      "token_docente"
    );

  if(!token){
    console.log(
      "Dispositivo sin token"
    );
  }

  return true;
}

function alLeerQR(texto){

  escaner.pause(true);

  mostrarMensaje(
    "⏳ Procesando QR: " + texto,
    "processing"
  );

  setTimeout(()=>{

    mostrarMensaje(
      "✅ ¡Asistencia Registrada por QR!",
      "success"
    );

    setTimeout(()=>{

      document
      .getElementById("resultado")
      .style.display = "none";

      escaner.resume();

    },2000);

  },800);
}

function iniciarCamara(){

  if(!verificarTokenDocente())
    return;

  document.getElementById(
    "btn-iniciar"
  ).style.display="none";

  document.getElementById(
    "btn-abrir-manual"
  ).style.display="none";

  document.getElementById(
    "lector-wrapper"
  ).style.display="block";

  mostrarMensaje(
    "Solicitando cámara...",
    "processing"
  );

  Html5Qrcode.getCameras()
  .then(dispositivos=>{

    if(dispositivos.length>0){

      escaner =
      new Html5Qrcode("lector");

      escaner.start(
        {facingMode:"environment"},
        {
          fps:15,
          qrbox:{
            width:250,
            height:250
          }
        },
        alLeerQR
      );

    }

  }).catch(()=>{

    mostrarMensaje(
      "❌ Error de cámara",
      "error"
    );

  });
}

function detenerCamara(){

  if(
    escaner &&
    escaner.isScanning
  ){

    escaner.stop().then(()=>{

      document
      .getElementById(
        "lector-wrapper"
      )
      .style.display="none";

      document
      .getElementById(
        "btn-iniciar"
      )
      .style.display="flex";

      document
      .getElementById(
        "btn-abrir-manual"
      )
      .style.display="flex";

    });

  }
}

function mostrarFormularioManual(){

  document.getElementById(
    "btn-iniciar"
  ).style.display="none";

  document.getElementById(
    "btn-abrir-manual"
  ).style.display="none";

  document.getElementById(
    "manual-wrapper"
  ).style.display="block";
}

function ocultarFormularioManual(){

  document.getElementById(
    "manual-wrapper"
  ).style.display="none";

  document.getElementById(
    "btn-iniciar"
  ).style.display="flex";

  document.getElementById(
    "btn-abrir-manual"
  ).style.display="flex";
}

function enviarRegistroManual(){

  let cedula =
  document.getElementById(
    "cedula-manual"
  ).value;

  if(!cedula){

    mostrarMensaje(
      "Ingrese una cédula",
      "error"
    );

    return;
  }

  mostrarMensaje(
    "✅ Registro Manual Exitoso",
    "success"
  );
}
