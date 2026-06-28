// ==========================================
// CONFIGURACIÓN GLOBAL DEL BACKEND
// ==========================================
const TOKEN_TELEGRAM = "8293178025:AAFeYpP1xLkwgI6l6NmsTqoiWTMvIRi31qc"; 
const API_TELEGRAM = "https://api.telegram.org/bot" + TOKEN_TELEGRAM;
const ID_PLANTILLA_DOCS = "1J3u2dkQJAcGs2s0ErSyK7O9BFKYQVbEi8-RrnL3q_nU";

// ------------------------------------------
// 1. RECEPCIÓN DE ASISTENCIAS Y PETICIONES WEB (doGet)
// ------------------------------------------
function doGet(e) {
  try {
    if (e.parameter.qr) {
      var codigo = decodeURIComponent(e.parameter.qr).trim();
      var resultado = registrarAsistenciaPro(codigo);
      return ContentService.createTextOutput(JSON.stringify(resultado)).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (e.parameter.accion === "obtenerReporte") {
      var fechaFiltro = e.parameter.fecha; 
      var reporte = generarReporteDiario(fechaFiltro);
      return ContentService.createTextOutput(JSON.stringify(reporte)).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "ERROR", mensaje: "Acción no válida" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "ERROR", mensaje: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ------------------------------------------
// 2. RECEPCIÓN DE MENSAJES DE TELEGRAM (doPost)
// ------------------------------------------
function doPost(e) {
  var respuestaFreno = ContentService.createTextOutput("OK");
  try {
    if (!e || !e.postData || !e.postData.contents) return respuestaFreno;
    
    var contenido = JSON.parse(e.postData.contents);
    if (contenido.message && contenido.message.text) {
      var textoRecibido = contenido.message.text.trim();
      var chatIdUsuario = contenido.message.chat.id;
      
      if (textoRecibido.toUpperCase().startsWith("REGISTRAR")) {
        vincularRepresentanteTelegram(textoRecibido, chatIdUsuario);
      } else {
        enviarMensajeTelegram(chatIdUsuario, "🤖 *Sistema de Asistencia Institucional*\n\nPara activar las notificaciones automáticas, envíe el comando:\n\n`REGISTRAR [cedula_del_alumno]`");
      }
    }
  } catch (error) {
    console.error("Error en doPost: " + error.toString());
  }
  return respuestaFreno;
}

// ------------------------------------------
// 3. LÓGICA DE ASISTENCIA (ALINEACIÓN DE COLUMNAS CORRECTA)
// ------------------------------------------
function registrarAsistenciaPro(codigoFormateado) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetAlumnos = ss.getSheetByName("ALUMNOS");
  var sheetAsistencias = ss.getSheetByName("ASISTENCIAS");
  
  var datosAlumnos = sheetAlumnos.getDataRange().getValues();
  var codigoLimpio = codigoFormateado.trim(); 
  
  var alumnoEncontrado = null;
  
  // Buscar correspondencia exacta en ALUMNOS (Columna A = ID_Alumno)
  for (var i = 1; i < datosAlumnos.length; i++) {
    var idAlumnoTabla = datosAlumnos[i][0].toString().trim();
    if (idAlumnoTabla === codigoLimpio) {
      alumnoEncontrado = {
        id: idAlumnoTabla,
        nombre: datosAlumnos[i][1].toString().trim(),     // Columna B (Nombre_Alumno)
        curso: datosAlumnos[i][3].toString().trim(),      // Columna D (ID_Curso)
        chatIdTelegram: datosAlumnos[i][6].toString().trim() // Columna G (ChatID_Telegram_Padre)
      };
      break;
    }
  }
  
  if (!alumnoEncontrado) {
    return { status: "ERROR", mensaje: "El código (" + codigoLimpio + ") no consta en la nómina de alumnos." };
  }
  
  var ahora = new Date();
  var fechaHoy = Utilities.formatDate(ahora, "GMT-5", "dd/MM/yyyy");
  var horaActual = Utilities.formatDate(ahora, "GMT-5", "HH:mm:ss");
  
  // Control estricto anti-duplicados por día
  var registrosAsistencias = sheetAsistencias.getDataRange().getValues();
  for (var j = 1; j < registrosAsistencias.length; j++) {
    var idFila = registrosAsistencias[j][0].toString().trim(); // Columna A (ID_Asistencia)
    var fechaFila = registrosAsistencias[j][2].toString().trim(); // Columna C (Fecha)
    if (idFila === alumnoEncontrado.id && fechaFila === fechaHoy) {
      return { status: "ERROR", mensaje: alumnoEncontrado.nombre + " ya registró entrada hoy." };
    }
  }
  
  // Guardar respetando el orden exacto de tus columnas de ASISTENCIAS (A hasta G)
  sheetAsistencias.appendRow([
    alumnoEncontrado.id,          // A: ID_Asistencia
    alumnoEncontrado.nombre,      // B: ID_Alumno
    fechaHoy,                     // C: Fecha
    horaActual,                   // D: Hora
    "ENTRADA",                    // E: Tipo
    "Docente Guardia",            // F: ID_Docente
    "Código QR"                   // G: Metodo
  ]);
  
  // Disparar mensaje a Telegram si el representante está enlazado
  if (alumnoEncontrado.chatIdTelegram && alumnoEncontrado.chatIdTelegram !== "") {
    var mensajeNotificacion = "🔔 *REPORTE DE ASISTENCIA*\n\nEstimado representante, le informamos que el estudiante *" + alumnoEncontrado.nombre + "* ha ingresado a la institución de manera segura.\n\n📅 *Fecha:* " + fechaHoy + "\n⏰ *Hora:* " + horaActual + "\n📌 *Método:* Escaneo QR";
    enviarMensajeTelegram(alumnoEncontrado.chatIdTelegram, mensajeNotificacion);
  }
  
  return { status: "SUCCESS", mensaje: "Asistencia registrada con éxito para " + alumnoEncontrado.nombre };
}

// ------------------------------------------
// 4. GENERACIÓN DE REPORTES DIARIOS
// ------------------------------------------
function generarReporteDiario(fechaFiltro) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetAlumnos = ss.getSheetByName("ALUMNOS");
  var sheetAsistencias = ss.getSheetByName("ASISTENCIAS");
  
  var alumnos = sheetAlumnos.getDataRange().getValues();
  var asistencias = sheetAsistencias.getDataRange().getValues();
  
  var mapaAsistencias = {};
  for (var j = 1; j < asistencias.length; j++) {
    var fechaFila = asistencias[j][2].toString().trim();
    if (fechaFila === fechaFiltro) {
      var idAlu = asistencias[j][0].toString().trim(); // Columna A
      mapaAsistencias[idAlu] = asistencias[j][3].toString().trim(); // Columna D (Hora)
    }
  }
  
  var estudiantesReporte = [];
  var presentes = 0;
  var ausentes = 0;
  
  for (var i = 1; i < alumnos.length; i++) {
    var idAluNomina = alumnos[i][0].toString().trim();
    if (idAluNomina === "") continue;
    
    var estaPresente = mapaAsistencias.hasOwnProperty(idAluNomina);
    if (estaPresente) presentes++; else ausentes++;
    
    estudiantesReporte.push({
      nombre: alumnos[i][1], // Nombre_Alumno
      curso: alumnos[i][3],  // ID_Curso
      estado: estaPresente ? "PRESENTE" : "AUSENTE",
      hora: estaPresente ? mapaAsistencias[idAluNomina] : ""
    });
  }
  
  return { total: alumnos.length - 1, presentes: presentes, ausentes: ausentes, estudiantes: estudiantesReporte };
}

// ------------------------------------------
// 5. VINCULACIÓN DE REPRESENTANTES DESDE TELEGRAM
// ------------------------------------------
function vincularRepresentanteTelegram(texto, chatId) {
  var partes = texto.split(" ");
  if (partes.length < 2) {
    enviarMensajeTelegram(chatId, "⚠️ Formato inválido. Use:\n`REGISTRAR [cedula]`");
    return;
  }
  
  var cedulaIngresada = partes[1].trim();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetAlumnos = ss.getSheetByName("ALUMNOS");
  var datosAlumnos = sheetAlumnos.getDataRange().getValues();
  
  for (var i = 1; i < datosAlumnos.length; i++) {
    var cedulaFila = datosAlumnos[i][2].toString().trim(); // Columna C (Cedula)
    if (cedulaFila === cedulaIngresada) {
      sheetAlumnos.getRange(i + 1, 7).setValue(chatId.toString()); // Guarda en Columna G
      enviarMensajeTelegram(chatId, "✅ *¡Registro Exitoso!*\n\nUsted se ha vinculado al estudiante: *" + datosAlumnos[i][1] + "*.\nDesde este momento recibirá las alertas de entrada en tiempo real.");
      return;
    }
  }
  enviarMensajeTelegram(chatId, "❌ La cédula `" + cedulaIngresada + "` no coincide con ningún estudiante.");
}

// ------------------------------------------
// 6. ENVÍO POST A LA API DE TELEGRAM
// ------------------------------------------
function enviarMensajeTelegram(chatId, mensaje) {
  var url = API_TELEGRAM + "/sendMessage";
  var payload = { "chat_id": chatId, "text": mensaje, "parse_mode": "Markdown" };
  var opciones = { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload), "muteHttpExceptions": true };
  UrlFetchApp.fetch(url, opciones);
}

// ------------------------------------------
// 7. MENÚ DEL PANEL SUPERIOR
// ------------------------------------------
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🌟 PANEL DEL COLEGIO')
      .addItem('🪪 Generar Carnet Individual', 'solicitarCarnetIndividual')
      .addItem('📚 Generar Carnets por Curso Completo', 'solicitarCarnetsPorCurso')
      .addToUi();
}

function solicitarCarnetIndividual() {
  var ui = SpreadsheetApp.getUi();
  var respuesta = ui.prompt('Generador Individual', 'Ingrese la Cédula del estudiante:', ui.ButtonSet.OK_CANCEL);
  if (respuesta.getSelectedButton() == ui.Button.OK) {
    var cedula = respuesta.getResponseText().trim();
    if (!cedula) return;
    ui.alert('⏳ Procesando', 'Generando documento PDF...', ui.ButtonSet.OK);
    var resultado = generarPdfCarnet(cedula);
    ui.alert(resultado.status === "SUCCESS" ? '🎉 ¡Éxito!' : '❌ Error', resultado.status === "SUCCESS" ? 'Carnet generado:\n' + resultado.url : resultado.mensaje, ui.ButtonSet.OK);
  }
}

function solicitarCarnetsPorCurso() {
  var ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ALUMNOS").getDataRange().getValues();
  var cursosSet = {};
  for (var i = 1; i < ss.length; i++) { if (ss[i][3]) cursosSet[ss[i][3].toString().trim()] = true; }
  var listaCursos = Object.keys(cursosSet).sort();
  var opcionesHtml = listaCursos.map(function(c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
  var htmlString = '<div style="font-family:Arial;padding:10px;"><p>Seleccione el Curso:</p><select id="cS" style="width:100%;padding:10px;margin-bottom:20px;">'+opcionesHtml+'</select><div style="text-align:right;"><button onclick="google.script.host.close()">Cancelar</button><button onclick="p()" style="background:#4F46E5;color:white;margin-left:10px;">Generar</button></div></div><script>function p(){google.script.run.ejecutarLoteDesdeDialogo(document.getElementById("cS").value);google.script.host.close();}</script>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(htmlString).setWidth(400).setHeight(180), 'Generador por Lotes');
}

function ejecutarLoteDesdeDialogo(c) {
  var r = generarPdfPorCursoLote(c);
  SpreadsheetApp.getUi().alert(r.status === "SUCCESS" ? '🎉 Lote Listo' : '❌ Error', r.status === "SUCCESS" ? 'Descargar Lote:\n' + r.url : r.mensaje, SpreadsheetApp.getUi().ButtonSet.OK);
}

function generarPdfCarnet(cedulaBuscar) {
  var ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ALUMNOS").getDataRange().getValues();
  var al = null;
  for (var i = 1; i < ss.length; i++) { if (ss[i][2].toString().trim() === cedulaBuscar) { al = { id: ss[i][0], nombre: ss[i][1], cedula: ss[i][2], curso: ss[i][3] }; break; } }
  if (!al) return { status: "ERROR", mensaje: "Cédula no hallada." };
  try {
    var c = DriveApp.getFileById(ID_PLANTILLA_DOCS).makeCopy("Temporal_" + al.cedula);
    var doc = DocumentApp.openById(c.getId()); var b = doc.getBody();
    b.replaceText("{{NOMBRE}}", al.nombre); b.replaceText("{{CEDULA}}", al.cedula); b.replaceText("{{CURSO}}", al.curso); b.replaceText("{{ID_ALUMNO}}", al.id);
    var img = UrlFetchApp.fetch("https://quickchart.io/qr?text=" + encodeURIComponent(al.id) + "&size=200&margin=1").getBlob();
    var f = b.findText("{{QR}}");
    if (f) { var t = f.getElement().asText(); var im = t.getParent().asParagraph().appendInlineImage(img); im.setWidth(120).setHeight(120); t.setText(t.getText().replace("{{QR}}", "")); }
    doc.saveAndClose(); var p = DriveApp.createFile(c.getAs(MimeType.PDF)).setName("🪪 CARNET - " + al.nombre + ".pdf"); p.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); c.setTrashed(true);
    return { status: "SUCCESS", url: p.getUrl() };
  } catch(e) { return { status: "ERROR", mensaje: e.toString() }; }
}

function generarPdfPorCursoLote(cursoBuscar) {
  var ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ALUMNOS").getDataRange().getValues();
  var list = [];
  for (var i = 1; i < ss.length; i++) { if (ss[i][3].toString().trim().toUpperCase() === cursoBuscar.toUpperCase()) { list.push({ id: ss[i][0], nombre: ss[i][1], cedula: ss[i][2], curso: ss[i][3] }); } }
  if (list.length === 0) return { status: "ERROR", mensaje: "Curso vacío." };
  try {
    var m = DocumentApp.create("Lote_Temp"); var bM = m.getBody(); bM.setMarginTop(30).setMarginBottom(30).setMarginLeft(30).setMarginRight(30);
    var pO = DocumentApp.openById(ID_PLANTILLA_DOCS).getBody();
    for (var k = 0; k < list.length; k++) {
      var est = list[k]; if (k > 0) bM.appendPageBreak();
      for (var j = 0; j < pO.getNumChildren(); j++) {
        var cl = pO.getChild(j).copy();
        if (cl.getType() == DocumentApp.ElementType.PARAGRAPH || cl.getType() == DocumentApp.ElementType.TABLE) {
          cl.replaceText("{{NOMBRE}}", est.nombre); cl.replaceText("{{CEDULA}}", est.cedula); cl.replaceText("{{CURSO}}", est.curso); cl.replaceText("{{ID_ALUMNO}}", est.id);
          var f = cl.findText("{{QR}}");
          if (f) { var img = UrlFetchApp.fetch("https://quickchart.io/qr?text=" + encodeURIComponent(est.id) + "&size=200&margin=1").getBlob(); var t = f.getElement().asText(); var im = t.getParent().asParagraph().appendInlineImage(img); im.setWidth(120).setHeight(120); t.setText(t.getText().replace("{{QR}}", "")); }
        }
        if (cl.getType() == DocumentApp.ElementType.PARAGRAPH) bM.appendParagraph(cl); else if (cl.getType() == DocumentApp.ElementType.TABLE) bM.appendTable(cl);
      }
    }
    m.saveAndClose(); var aD = DriveApp.getFileById(m.getId()); var p = DriveApp.createFile(aD.getAs(MimeType.PDF)).setName("📚 LOTES - " + cursoBuscar + ".pdf"); p.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); aD.setTrashed(true);
    return { status: "SUCCESS", url: p.getUrl() };
  } catch(e) { return { status: "ERROR", mensaje: e.toString() }; }
}
