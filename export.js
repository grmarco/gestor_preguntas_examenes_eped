// export.js

// Asumiendo que docx está disponible globalmente desde el script UMD en index.html
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ImageRun,
  AlignmentType,
  PageBreak,
  TabStopType,
  TabStopPosition,
  Numbering, // Necesario para crear la referencia, aunque no se pase la instancia
  LevelFormat, // Necesario para la configuración de niveles
  Indent,
  ShadingType // Para el fondo de bloques de código
} = docx;

// --- Función Auxiliar para convertir Markdown a Elementos docx ---
// (Incluye la lógica para procesar párrafos, encabezados, listas, imágenes, etc.)
function markdownToDocxChildren(markdownString, numberingConfigForRef) { // Pasamos config para referencia
  if (!markdownString) return [];

  const tokens = marked.lexer(markdownString);
  const children = [];
  console.log("Tokens de Marked:", tokens); // DEBUG

  // --- ¡Importante! ---
  // Creamos la instancia de Numbering aquí DENTRO para poder obtener
  // las referencias correctas, pero SÓLO pasaremos el objeto de configuración
  // al constructor del Document principal.
  // const listNumbering = new Numbering(numberingConfigForRef);
  // --- Fin Importante ---


  tokens.forEach(token => {
      try {
          switch (token.type) {
              case 'heading':
                  children.push(new Paragraph({
                      text: token.text || '', // Asegurar que text no sea undefined
                      heading: HeadingLevel[`HEADING_${token.depth}`] || HeadingLevel.HEADING_1,
                      spacing: { after: 120 }
                  }));
                  break;

              case 'paragraph':
                  const paragraphChildren = [];
                  (token.tokens || []).forEach(inlineToken => { // Asegurar que tokens exista
                       switch(inlineToken.type) {
                           case 'strong':
                               paragraphChildren.push(new TextRun({ text: inlineToken.text || '', bold: true }));
                               break;
                           case 'em':
                               paragraphChildren.push(new TextRun({ text: inlineToken.text || '', italics: true }));
                               break;
                           case 'codespan':
                                paragraphChildren.push(new TextRun({ text: inlineToken.text || '', font: { name: "Consolas" } }));
                               break;
                           case 'link':
                                paragraphChildren.push(new TextRun({ text: inlineToken.text || '', italics: true }));
                                paragraphChildren.push(new TextRun({ text: ` (${inlineToken.href || ''})`, size: 18, color: "777777" }));
                               break;
                           case 'image':
                               console.log("Procesando imagen:", inlineToken.href);
                               try {
                                   if (inlineToken.href && inlineToken.href.startsWith('data:image')) {
                                       const base64Data = inlineToken.href.split(',')[1];
                                       if (base64Data) {
                                           // Usar un tamaño máximo por defecto, Word ajustará proporción si solo das uno
                                           paragraphChildren.push(new ImageRun({
                                               data: base64Data,
                                               transformation: { width: 450 }, // Ancho máx en píxeles
                                               altText: { title: inlineToken.title || 'Imagen adjunta', description: inlineToken.text || '' }
                                           }));
                                       }
                                   } else {
                                       paragraphChildren.push(new TextRun({ text: `[Imagen: ${inlineToken.text || inlineToken.href || 'URL externa'}]`, italics: true, color: "777777" }));
                                   }
                               } catch (imgError) {
                                    console.error("Error procesando imagen:", imgError, inlineToken);
                                    paragraphChildren.push(new TextRun({ text: `[Error imagen]`, italics: true, color: "FF0000" }));
                               }
                               break;
                           case 'text':
                           case 'html':
                           default:
                               const cleanText = inlineToken.raw?.replace(/<[^>]*>?/gm, '') || inlineToken.text || '';
                               paragraphChildren.push(new TextRun(cleanText));
                               break;
                       }
                  });
                   if (paragraphChildren.length > 0) { // Solo añadir párrafo si tiene contenido
                      children.push(new Paragraph({ children: paragraphChildren, spacing: { after: 100 } }));
                   }
                  break;

              case 'list':
                  const isOrdered = token.ordered;
                  (token.items || []).forEach(item => {
                      const listItemChildren = [];
                      // Los items de lista contienen tokens, que a su vez pueden tener más tokens inline
                       if (item.tokens && item.tokens.length > 0) {
                           item.tokens.forEach(itemToken => {
                               // Generalmente el primer token es 'text' y contiene los inlines
                               if (itemToken.type === 'text' && itemToken.tokens) {
                                   itemToken.tokens.forEach(inline => {
                                       switch(inline.type) {
                                           case 'strong': listItemChildren.push(new TextRun({ text: inline.text || '', bold: true })); break;
                                           case 'em': listItemChildren.push(new TextRun({ text: inline.text || '', italics: true })); break;
                                           case 'codespan': listItemChildren.push(new TextRun({ text: inline.text || '', font: { name: "Consolas" } })); break;
                                           default: listItemChildren.push(new TextRun(inline.raw || inline.text || '')); break;
                                       }
                                   });
                               } else { // Si no es 'text' o no tiene sub-tokens, añadir como texto plano
                                    listItemChildren.push(new TextRun(itemToken.raw || itemToken.text || ''));
                               }
                           });
                       }

                       if (listItemChildren.length > 0) { // Añadir solo si hay contenido
                          children.push(new Paragraph({
                              children: listItemChildren,
                              numbering: {
                                  // Usar la referencia definida en la configuración global
                                  reference: isOrdered ? "lista-numerada" : "lista-vineta",
                                  level: 0 // Nivel 0 por defecto
                              },
                          }));
                       }
                  });
                  break;

              case 'code': // Bloque de código
                  children.push(new Paragraph({
                      text: token.text || '',
                      style: "codeBlockStyle", // Usar estilo personalizado
                      spacing: { after: 100 }
                  }));
                  break;

              case 'blockquote':
                   children.push(new Paragraph({
                       text: token.text || '',
                       style: "quoteStyle" // Usar estilo personalizado
                   }));
                  break;

              case 'hr':
                   children.push(new Paragraph({
                       border: { bottom: { color: "auto", space: 1, value: "single", size: 6 } },
                       spacing: { before: 100, after: 100 }
                   }));
                  break;

              case 'space': break; // Ignorar

              default:
                  console.warn("Token Markdown no manejado:", token.type, token);
                  if (token.raw || token.text) {
                       children.push(new Paragraph({ text: token.raw || token.text }));
                  }
                  break;
          }
      } catch (parseError) {
          console.error("Error procesando token:", token, parseError);
          children.push(new Paragraph({ children: [new TextRun({ text: `[Error procesando bloque ${token.type}]`, color: "FF0000", italics: true })] }));
      }
  });

  return children;
}


// --- Función Principal para Generar el Documento Word ---
async function generateWordDoc(selectedQuestions) {
  if (!selectedQuestions || selectedQuestions.length === 0) {
      console.log("No hay preguntas seleccionadas para generar Word.");
      return;
  }
  console.log(`Generando documento Word con ${selectedQuestions.length} preguntas.`);

  const docChildren = [];

  // 1. Definir Estilos Personalizados (Opcional pero recomendado)
  const styles = {
      paragraphStyles: [
          {
              id: "codeBlockStyle", name: "Code Block", basedOn: "Normal", next: "Normal", quickFormat: true,
              run: { font: { name: "Consolas", size: 18 } }, // 9pt
              paragraph: {
                  indent: { left: 720 }, // 0.5 inch
                  spacing: { line: 276, before: 100, after: 100 },
                  shading: { type: ShadingType.CLEAR, fill: "F1F1F1", color: "auto" },
              },
          },
          {
               id: "quoteStyle", name: "Quote", basedOn: "Normal", next: "Normal",
               run: { italics: true, color: "555555" },
               paragraph: { indent: { left: 720 }, spacing: { after: 100 } },
          }
      ],
  };

  // 2. Definir Configuración de Numeración (Necesario para las listas)
  const numberingConfig = {
      // Esta es la ESTRUCTURA DE CONFIGURACIÓN que espera docx v8.x
      config: [
          {
              reference: "lista-numerada", // Referencia usada en los párrafos
              levels: [
                  {
                      level: 0, // Nivel de la lista
                      format: LevelFormat.DECIMAL, // 1, 2, 3...
                      text: "%1.", // Cómo se muestra (el número seguido de punto)
                      alignment: AlignmentType.LEFT,
                      style: { paragraph: { indent: { left: 720, hanging: 360 } } } // Sangría
                  },
                  // Añadir más objetos aquí para niveles 1, 2, etc. (sublistas) si es necesario
              ],
          },
          {
              reference: "lista-vineta", // Referencia para viñetas
              levels: [
                  {
                      level: 0,
                      format: LevelFormat.BULLET, // Viñeta
                      text: "•", // Carácter de viñeta
                      alignment: AlignmentType.LEFT,
                      style: { paragraph: { indent: { left: 720, hanging: 360 } } }
                  },
                  // Más niveles...
              ],
          }
      ],
  };

  // 3. Iterar y Convertir Preguntas
  selectedQuestions.forEach((q, index) => {
      console.log(`Procesando pregunta ID: ${q.id}`);
      // Título de la pregunta
      docChildren.push(new Paragraph({
          children: [
              new TextRun({ text: `Pregunta ${index + 1}`, bold: true, size: 28 }),
              new TextRun({ text: ` (ID: ${q.id}, Tema: ${q.topic || 'N/A'})`, size: 20, color: "777777" })
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 200 }
      }));

      // Contenido de la pregunta (convertido de Markdown)
      // Pasamos la config de numeración solo por si la necesitara internamente (aunque no debería)
      const questionContent = markdownToDocxChildren(q.questionMarkdown, numberingConfig);
      docChildren.push(...questionContent);

      // Separador entre preguntas
      if (index < selectedQuestions.length - 1) {
           docChildren.push(new Paragraph({ children: [new PageBreak()] })); // Salto de página
      }
  });

  // 4. Crear el Documento (Pasando la CONFIGURACIÓN de numeración)
  const doc = new Document({
       styles: styles,
       // === CORRECCIÓN: Pasar el objeto de CONFIGURACIÓN de numeración ===
       numbering: numberingConfig,
       // =============================================================
       sections: [{
          properties: {
               page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
          },
          children: docChildren,
       }]
  });

  // 5. Generar Blob y Descargar
  try {
      console.log("Empaquetando documento...");
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none"; a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `examen-${timestamp}.docx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log("Documento Word generado y descarga iniciada.");
  } catch (packError) {
      console.error("Error al empaquetar el documento Word:", packError);
      alert("Error al generar el archivo .docx: " + packError.message);
  }
}

// Exportar si usas módulos, si no, estará globalmente disponible para app.js
// export { generateWordDoc };