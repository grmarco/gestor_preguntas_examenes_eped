document.getElementById("export-word").addEventListener("click", () => {
    const selected = questions.filter(q => q.selected);
    if (selected.length === 0) return alert("Selecciona al menos una pregunta.");
  
    const doc = new docx.Document();
  
    selected.forEach(q => {
      doc.addSection({
        children: [
          new docx.Paragraph({
            children: [new docx.TextRun({ text: q.questionMarkdown, break: 1 })],
          }),
          new docx.Paragraph(""),
        ],
      });
    });
  
    docx.Packer.toBlob(doc).then(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "examen.docx";
      a.click();
    });
  });
  