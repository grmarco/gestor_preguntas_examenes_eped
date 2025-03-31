// ==================================
//      Variables Globales
// ==================================
let questions = []; // Array para almacenar las preguntas
let nextId = 1;     // Contador para IDs únicos
let editingIndex = null; // Índice de la pregunta que se está editando (en el array 'questions')
let questionsTable; // Variable para guardar la instancia de DataTables
let currentlyPreviewingRow = null; // <<<--- NUEVA VARIABLE GLOBAL

// ==================================
//      Referencias a Elementos DOM
// ==================================
const form = document.getElementById('question-form');
const preview = document.getElementById('markdown-preview');
const markdownInput = document.getElementById('question-markdown');
const ocrInput = document.getElementById('ocr-image');
const attachedInput = document.getElementById('attached-image');
// const tableBody = document.querySelector('#questions-table tbody'); // No necesario con DataTables
const addQuestionBtn = document.getElementById('add-question-btn');
const modal = document.getElementById('form-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalTitle = document.getElementById('modal-title');
const submitButton = form.querySelector('button[type="submit"]');
const apiKeyInput = document.getElementById('api-key');
const generateMarkdownBtn = document.getElementById('generate-markdown');
const suggestTopicBtn = document.getElementById('suggest-topic');
const exportJsonBtn = document.getElementById('export-json');
const importJsonInput = document.getElementById('import-json');
const exportWordBtn = document.getElementById('export-word');

// ==================================
//      Funciones de Persistencia (LocalStorage)
// ==================================
function saveToStorage() {
  try {
    localStorage.setItem('questions', JSON.stringify(questions));
    localStorage.setItem('nextId', nextId.toString());
  } catch (e) {
    console.error("Error guardando en localStorage:", e);
    alert("Error al guardar los datos.");
  }
}

function loadFromStorage() {
  const storedQuestions = localStorage.getItem('questions');
  questions = []; // Resetear antes de cargar
  if (storedQuestions) {
    try {
      const parsedQuestions = JSON.parse(storedQuestions);
      if (Array.isArray(parsedQuestions)) {
          questions = parsedQuestions.filter(q => q && typeof q.id !== 'undefined');
      } else { console.warn("Datos de 'questions' en localStorage no eran un array, ignorando."); }
    } catch (e) { console.error("Error parseando 'questions' desde localStorage:", e); }
  }

  const storedId = localStorage.getItem('nextId');
  nextId = 1; // Default
  if (storedId) {
    const parsedId = parseInt(storedId);
    if (!isNaN(parsedId) && parsedId > 0) { nextId = parsedId; }
    else { console.warn("nextId en localStorage no era un número válido, reseteando a 1."); }
  }

  if (questions.length > 0) {
     const maxId = Math.max(0, ...questions.map(q => q.id || 0));
     nextId = Math.max(nextId, maxId + 1);
  }

  if (preview) { preview.innerHTML = 'Selecciona una pregunta ("Ver más") para ver la previsualización.'; }
  console.log(`Datos cargados: ${questions.length} preguntas. Próximo ID: ${nextId}`);
}

// ==================================
//      Funciones del Modal
// ==================================
function openModal(index = null) {
    editingIndex = index;
    form.reset();
    ocrInput.value = '';
    attachedInput.value = '';

    if (index !== null && questions[index]) {
        modalTitle.textContent = 'Editar Pregunta';
        submitButton.textContent = 'Actualizar pregunta';
        const q = questions[index];
        const markdownSinImagen = (q.questionMarkdown || '').replace(/\n\n!\[Imagen adjunta\]\(data:image\/jpeg;base64,[^)]+\)(\s*)$/, '');
        markdownInput.value = markdownSinImagen;
        document.getElementById('points').value = q.points || '';
        document.getElementById('topic').value = q.topic || '';
        document.getElementById('mode').value = q.mode || '';
        document.getElementById('description').value = q.description || '';
        document.getElementById('year').value = q.exam?.year || '';
        document.getElementById('month').value = q.exam?.month || '';
        document.getElementById('week').value = q.exam?.week || '';
    } else {
        modalTitle.textContent = 'Añadir Nueva Pregunta';
        submitButton.textContent = 'Guardar pregunta';
        editingIndex = null;
    }
    modal.classList.add('is-visible');
    document.body.classList.add('modal-open');
}

function closeModal() {
    modal.classList.remove('is-visible');
    document.body.classList.remove('modal-open');
    editingIndex = null;
}

// ==================================
//      Funciones de Renderizado y UI (con DataTables)
// ==================================
function initializeDataTable() {
    console.log("Inicializando/Recargando DataTable...");
    if ($.fn.dataTable.isDataTable('#questions-table')) {
        console.log("Destruyendo instancia DataTable existente.");
        questionsTable.destroy();
        $('#questions-table tbody').empty();
    }

    const dataForTable = questions.map((q, index) => {
        const resumenRaw = (q.questionMarkdown || '').replace(/!\[.*?\]\(data:.*?\)/g, '');
        const resumenTexto = resumenRaw.length > 100 ? resumenRaw.slice(0, 100) + '...' : resumenRaw;
        const resumenHTML = marked.parseInline(resumenTexto || '*Vacío*');
        return [
            q.id, q.topic || 'N/A', q.mode || 'N/A', q.exam?.year || 'N/A', q.exam?.month || 'N/A', q.exam?.week || 'N/A',
            `<div class="resumen-content">${resumenHTML}</div>`,
            q.description || '',
            `<button onclick="openModal(${index})" title="Editar">✏️</button> <button onclick="deleteQuestion(${index})" title="Eliminar">🗑️</button>`,
            `<input type="checkbox" onchange="toggleSelect(this, ${index})" ${q.selected ? 'checked' : ''} aria-label="Seleccionar pregunta ${q.id}">`
        ];
    });

    try {
        questionsTable = $('#questions-table').DataTable({
            data: dataForTable,
            columns: [
                { title: "ID" }, { title: "Tema" }, { title: "Modalidad" }, { title: "Año" }, { title: "Mes" }, { title: "Semana" },
                { title: "Vista previa", orderable: false, searchable: false }, { title: "Descripción" },
                { title: "Acciones", orderable: false, searchable: false }, { title: "Seleccionar", orderable: false, searchable: false }
            ],
            language: { url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/es-ES.json', searchPlaceholder: "Buscar..." },
            paging: true, pageLength: 10, searching: true, order: [[0, 'asc']],
            rowCallback: function(row, data, dataIndex) {
                 const questionId = data[0];
                 const originalQuestion = questions.find(q => q.id === questionId);
                 $(row).toggleClass('selected', !!(originalQuestion && originalQuestion.selected));
             }
        });
        console.log("DataTable inicializado correctamente.");
    } catch(e) {
        console.error("Error inicializando DataTables:", e);
        alert("Error al inicializar la tabla de preguntas.");
    }
}

// ==================================
//      Funciones de Interacción (Eventos de Botones en Tabla, etc.)
// ==================================
// En app.js

// Función llamada desde los onclick (Ver Más y clic en fila)
window.previewQuestion = (id) => {
    const index = questions.findIndex(q => q.id === id);
    console.log(`Preview request for ID: ${id}, found index: ${index}`);

    if (index !== -1) {
        const q = questions[index]; // Obtener la pregunta

        // --- INICIO: Lógica de Resaltado ---
        // 1. Quitar resaltado anterior
        if (currentlyPreviewingRow) {
            currentlyPreviewingRow.classList.remove('previewing'); // Usa una clase CSS específica
            currentlyPreviewingRow = null;
        }

        // 2. Encontrar la nueva fila en DataTables por ID
        let newRowElement = null;
        if (questionsTable) {
            questionsTable.rows().every(function() { // Itera sobre las filas de DataTables
                const rowData = this.data(); // Obtiene los datos de la fila actual
                if (rowData && rowData[0] === id) { // Compara el ID (asumiendo que está en la primera columna de datos)
                    newRowElement = this.node(); // Obtiene el elemento <tr>
                    return false; // Detener la búsqueda
                }
                return true;
            });
        }

        // 3. Aplicar resaltado si se encontró la fila
        if (newRowElement) {
            newRowElement.classList.add('previewing'); // Aplica la nueva clase
            currentlyPreviewingRow = newRowElement; // Guarda la referencia
            console.log("   Fila resaltada:", newRowElement);
        } else {
             console.warn(`No se encontró la fila TR para resaltar (ID: ${id})`);
             // Si no se encuentra (ej. está en otra página de DataTables),
             // nos aseguramos que 'currentlyPreviewingRow' quede null.
             currentlyPreviewingRow = null;
        }
        // --- FIN: Lógica de Resaltado ---


        // --- Lógica para mostrar el contenido en el div #preview (como antes) ---
        if (preview) {
            try { preview.innerHTML = marked.parse(q.questionMarkdown || '*No hay contenido.*'); }
            catch(e) { preview.innerHTML = '<p style="color:red">Error Markdown.</p>'; console.error("Error marked.parse:", e);}
            // El scroll puede ser útil incluso sin altura fija, si la preview es muy larga
            preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else { console.error("Elemento #markdown-preview no encontrado."); }
        // --- Fin Lógica de Mostrar Contenido ---

    } else { // Si no se encontró la pregunta por ID
        console.error(`Pregunta con ID ${id} no encontrada para previsualizar.`);
        // Quitar resaltado si se intentó previsualizar una inexistente
        if (currentlyPreviewingRow) {
            currentlyPreviewingRow.classList.remove('previewing');
            currentlyPreviewingRow = null;
        }
        if (preview) { preview.innerHTML = '<em>Pregunta no encontrada.</em>'; }
    }
}; // Fin de previewQuestionById



window.toggleSelect = (checkboxElement, index) => {
    if (!questions[index]) { console.warn(`Índice inválido en toggleSelect: ${index}`); return; }
    const isSelected = checkboxElement.checked;
    questions[index].selected = isSelected;
    saveToStorage();
    // Actualizar clase en la fila de DataTables de forma segura por ID
    if (questionsTable) {
         const questionId = questions[index].id;
         questionsTable.rows().every(function() { // Itera sobre TODAS las filas (incluso en otras páginas)
             const rowData = this.data();
             if (rowData && rowData[0] === questionId) {
                 $(this.node()).toggleClass('selected', isSelected);
                 return false; // Detener iteración
             }
             return true;
         });
    } else { console.warn("DataTables no inicializado en toggleSelect."); }
};

window.deleteQuestion = (index) => {
    if (!questions[index]) return;
    const questionId = questions[index].id;
    if (confirm(`¿Eliminar pregunta ID ${questionId}?`)) {
        questions.splice(index, 1); // Eliminar del array
        saveToStorage();
        initializeDataTable(); // Recargar tabla
        // === Actualizar Gráfico ===
        if (typeof generateTopicStatsChart === 'function') {
             generateTopicStatsChart(questions); // Pasar los datos actualizados
        } else { console.warn("Función generateTopicStatsChart no encontrada."); }
        // =========================
        if (preview) { preview.innerHTML = 'Pregunta eliminada.'; }
    }
};

// ==================================
//      Event Listeners Principales
// ==================================
// --- Modal ---
if (addQuestionBtn) addQuestionBtn.addEventListener('click', () => openModal());
if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
if (modal) modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal?.classList.contains('is-visible')) closeModal(); });

// --- Formulario (Añadir/Editar) ---
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitButton.textContent = 'Guardando...'; submitButton.disabled = true;
        try {
            // ... (Lógica para obtener markdown, imagen, y crear objeto 'data') ...
            let markdown = markdownInput.value.trim();
            let adjuntarImagenBase64 = null;
            const attachedFile = attachedInput.files[0];
            if (attachedFile) { adjuntarImagenBase64 = await fileToBase64(attachedFile); }
            let markdownFinal = markdown;
            if (editingIndex !== null && questions[editingIndex] && !adjuntarImagenBase64) {
                const originalQuestion = questions[editingIndex];
                const matchImagenOriginal = (originalQuestion.questionMarkdown || '').match(/(\n\n!\[Imagen adjunta\]\(data:image\/jpeg;base64,[^)]+\))(\s*)$/);
                if (matchImagenOriginal && matchImagenOriginal[1]) { markdownFinal += matchImagenOriginal[1]; }
            } else if (adjuntarImagenBase64) { markdownFinal += `\n\n![Imagen adjunta](data:image/jpeg;base64,${adjuntarImagenBase64})`; }

            const data = {
                questionMarkdown: markdownFinal, points: document.getElementById('points').value, topic: document.getElementById('topic').value,
                mode: document.getElementById('mode').value, description: document.getElementById('description').value,
                exam: { year: document.getElementById('year').value, month: document.getElementById('month').value, week: document.getElementById('week').value, },
                selected: false // Default
            };

            if (editingIndex !== null && questions[editingIndex]) { // Editar
                data.id = questions[editingIndex].id; data.selected = questions[editingIndex].selected;
                questions[editingIndex] = data;
            } else { data.id = nextId++; questions.push(data); } // Añadir

            saveToStorage();
            initializeDataTable(); // Recargar tabla
            // === Actualizar Gráfico ===
            if (typeof generateTopicStatsChart === 'function') {
                 generateTopicStatsChart(questions); // Pasar los datos actualizados
            } else { console.warn("Función generateTopicStatsChart no encontrada."); }
            // =========================
            closeModal();

        } catch (error) {
            console.error("Error al guardar pregunta:", error); alert("Error al guardar: " + error.message);
            // Restaurar botón en caso de error
            submitButton.textContent = (editingIndex !== null) ? 'Actualizar pregunta' : 'Guardar pregunta';
            submitButton.disabled = false;
        }
    });
}

// --- Input Markdown (Preview en tiempo real) ---
if (markdownInput) {
    markdownInput.addEventListener('input', () => {
        if(preview) { try { preview.innerHTML = marked.parse(markdownInput.value || '*Escribe aquí...*'); } catch (e) { preview.innerHTML = '<p style="color: red;">Error Markdown.</p>';} }
    });
}

// --- Exportar JSON ---
if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
        console.log("Botón Exportar JSON presionado.");
        if (!questions || questions.length === 0) {
            console.log("No hay preguntas para exportar."); return alert("No hay preguntas para exportar.");
        }
        console.log(`Exportando ${questions.length} preguntas.`);
      try {
          const jsonString = JSON.stringify(questions, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none'; a.href = url;
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          a.download = `preguntas-${timestamp}.json`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          URL.revokeObjectURL(url);
          console.log("Exportación JSON iniciada.");
      } catch(e) {
          console.error("Error detallado al exportar JSON:", e); alert("Error al generar archivo JSON: " + e.message);
      }
    });
} else { console.warn("Elemento #export-json no encontrado."); }

// --- Importar JSON ---
if (importJsonInput) {
    importJsonInput.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
           try {
               const importedQuestions = JSON.parse(evt.target.result);
               if (!Array.isArray(importedQuestions)) throw new Error("El archivo JSON no contiene un array.");
               if (questions.length > 0 && !confirm(`Reemplazar ${questions.length} preguntas existentes con ${importedQuestions.length}?`)) {
                   importJsonInput.value = ''; return;
               }
               questions = importedQuestions.filter(q => q && typeof q.id !== 'undefined'); // Asegurar IDs
               nextId = questions.length > 0 ? Math.max(0, ...questions.map(q => q.id || 0)) + 1 : 1; // Recalcular nextId
               saveToStorage();
               initializeDataTable(); // Recargar tabla
               // === Actualizar Gráfico ===
               if (typeof generateTopicStatsChart === 'function') {
                    generateTopicStatsChart(questions); // Pasar los datos actualizados
               } else { console.warn("Función generateTopicStatsChart no encontrada."); }
               // =========================
               if(preview) preview.innerHTML = 'Datos importados.';
               alert(`Importadas ${questions.length} preguntas.`);
           } catch(err) { console.error("Error importando JSON:", err); alert(`Error al importar: ${err.message}`); }
           finally { importJsonInput.value = ''; } // Limpiar input
        };
        reader.onerror = () => { alert("Error al leer el archivo."); importJsonInput.value = ''; };
        reader.readAsText(file);
    });
}

// --- Otros Botones y Eventos (OCR, Sugerir, Word, Pegar) ---
// (Se asume que el código para estos listeners está aquí y funciona)
// En app.js, dentro de los Event Listeners

if (exportWordBtn) {
    exportWordBtn.addEventListener('click', () => {
        const selectedQuestions = questions.filter(q => q.selected);
        if (selectedQuestions.length === 0) {
            return alert("Selecciona al menos una pregunta para exportar a Word.");
        }
        // Verificar si la función existe (definida en export.js)
        if (typeof generateWordDoc === 'function') {
            try {
                 // Llamar a la función de export.js pasándole las preguntas seleccionadas
                 generateWordDoc(selectedQuestions)
                    .then(() => {
                         console.log("Llamada a generateWordDoc completada (la descarga debe haberse iniciado).");
                    })
                    .catch(error => {
                         console.error("Error durante generateWordDoc:", error);
                         alert("Ocurrió un error al generar el documento Word.");
                    });
            } catch (error) { // Capturar errores síncronos si la llamada falla inmediatamente
                 console.error("Error llamando a generateWordDoc:", error);
                 alert("Error al iniciar la generación del documento Word.");
            }
        } else {
             alert("Error: La función para generar documentos Word (generateWordDoc) no está cargada. Revisa export.js.");
             console.error("Función generateWordDoc no definida.");
        }
    });
}

if (generateMarkdownBtn) { generateMarkdownBtn.addEventListener('click', async () => {
    const file = ocrInput.files[0]; const apiKey = apiKeyInput.value;
    if (!file) return alert("Selecciona imagen OCR."); if (!apiKey) return alert("Introduce API key.");
    if (typeof generateMarkdownFromImage !== 'function') return alert("Función generateMarkdownFromImage no definida (revisa openai.js).");
    generateMarkdownBtn.textContent = 'Generando...'; generateMarkdownBtn.disabled = true;
    try { const markdown = await generateMarkdownFromImage(file, apiKey); markdownInput.value = markdown; markdownInput.dispatchEvent(new Event('input', { bubbles: true })); }
    catch (error) { console.error("Error OCR:", error); alert("Error OCR: " + error.message); }
    finally { generateMarkdownBtn.textContent = 'Generar Markdown'; generateMarkdownBtn.disabled = false; ocrInput.value = ''; }
}); }

if (suggestTopicBtn) { suggestTopicBtn.addEventListener('click', async () => {
    const markdown = markdownInput.value; const apiKey = apiKeyInput.value;
    if (!markdown) return alert("Introduce enunciado."); if (!apiKey) return alert("Introduce API key.");
    if (typeof suggestTopic !== 'function') return alert("Función suggestTopic no definida (revisa openai.js).");
    suggestTopicBtn.textContent = 'Sugiriendo...'; suggestTopicBtn.disabled = true;
    try { const topic = await suggestTopic(markdown, apiKey); document.getElementById('topic').value = topic; alert(`Tema sugerido: ${topic}`); }
    catch (error) { console.error("Error Sugerir Tema:", error); alert("Error Sugerir Tema: " + error.message); }
    finally { suggestTopicBtn.textContent = 'Sugerir tema'; suggestTopicBtn.disabled = false; }
}); }

// Pegado desde portapapeles para ambas imágenes
document.addEventListener('paste', function (event) {
    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
    for (const item of items) {
      if (item.type.indexOf("image") === 0) {
        const blob = item.getAsFile();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const useFor = prompt("¿Esta imagen es para OCR o adjunta? (ocr / adjunta)");
        if (useFor === "ocr") {
          a.download = 'ocr-' + Date.now() + '.jpg';
          a.click();
          ocrInput.value = '';
          alert('Imagen pegada descargada. Selecciónala como OCR.');
        } else if (useFor === "adjunta") {
          a.download = 'imagen-' + Date.now() + '.jpg';
          a.click();
          attachedInput.value = '';
          alert('Imagen pegada descargada. Selecciónala como imagen adjunta.');
        }
      }
    }
  });

// ==================================
//      Funciones Auxiliares
// ==================================
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file provided."));
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result?.toString().split(',')[1];
      if (res) resolve(res); else reject(new Error("Failed to read file as Base64."));
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

// ==================================
//      Inicialización al Cargar la Página
// ==================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM cargado.");
    // Verificar dependencias
    if (typeof $ === 'undefined' || typeof $.fn.dataTable === 'undefined') {
         console.error("jQuery o DataTables no están cargados!");
         alert("Error crítico: Librerías de tabla no cargadas. La funcionalidad puede ser limitada.");
         // Podrías decidir no continuar o usar una tabla básica si esto falla
         // return;
    }
     if (typeof marked === 'undefined') { console.warn("Librería Marked (markdown) no cargada."); }
     if (typeof Chart === 'undefined') { console.warn("Librería Chart.js no cargada."); }
     // ... otras verificaciones si es necesario ...

     const questionsTableBody = document.querySelector('#questions-table tbody');
     if (!questionsTableBody) {
         console.error("Elemento tbody de la tabla de preguntas no encontrado.");
         // Puedes decidir detener la ejecución o continuar sin esta funcionalidad
     }

    loadFromStorage();     // Cargar datos del localStorage

    // Inicializar DataTables (si está disponible)
    if (typeof $.fn.dataTable !== 'undefined') {
        initializeDataTable();
    } else {
        // Fallback: Si DataTables no cargó, al menos intenta mostrar algo básico (requeriría adaptar/crear una función renderSimpleTable)
        console.error("Intentando renderizar sin DataTables (funcionalidad limitada).");
        // renderSimpleTable(); // Necesitarías crear esta función
    }

    // Generar gráfico inicial (si está disponible)
    if (typeof generateTopicStatsChart === 'function') {
        generateTopicStatsChart(questions);
    } else {
        console.warn("Función generateTopicStatsChart no encontrada (revisa stats.js). El gráfico no se mostrará.");
    }


    // === INICIO: Añadir Listener para Clic en Filas ===
    if (questionsTableBody) {
        questionsTableBody.addEventListener('click', (event) => {
            const targetElement = event.target; // Elemento exacto donde se hizo clic

            // 1. Ignorar clics en elementos interactivos existentes
            if (targetElement.tagName === 'BUTTON' ||
                targetElement.tagName === 'INPUT' ||
                targetElement.tagName === 'A' || // Si tuvieras enlaces
                targetElement.closest('button') || // Ignorar si se hace clic DENTRO de un botón
                targetElement.closest('input'))
            {
                console.log("Clic en elemento interactivo, ignorando para preview de fila.");
                return; // No hacer nada
            }

            // 2. Encontrar la fila (TR) padre más cercana
            const row = targetElement.closest('tr');
            if (!row) {
                 console.log("Clic fuera de una fila.");
                 return; // No se hizo clic en una fila válida
            }

             // 3. Asegurarse que la fila pertenece a ESTE tbody (importante si hay tablas anidadas, raro aquí)
             if (!questionsTableBody.contains(row)) {
                  console.log("Clic en fila, pero no dentro del tbody esperado.");
                 return;
             }


            // 4. Obtener el ID de la primera celda de esa fila
            const idCell = row.cells[0]; // La primera celda (columna ID)
            if (!idCell) {
                console.warn("No se pudo encontrar la celda de ID en la fila:", row);
                return;
            }

            const id = parseInt(idCell.textContent, 10); // Convertir a número
            if (isNaN(id)) {
                console.warn("No se pudo extraer un ID numérico de la celda:", idCell.textContent);
                return;
            }

            // 5. Llamar a la función de previsualización
            console.log(`Clic en fila detectado para ID: ${id}`);
            previewQuestion(id); // Reutilizar la función existente

        });
        console.log("Listener de clic en filas añadido al tbody.");
    }
});