async function generateMarkdownFromImage(file, apiKey) {
    const base64Image = await toBase64(file);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Extrae el enunciado de esta imagen en formato Markdown." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }],
        temperature: 0.2
      })
    });
  
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "[Error al procesar imagen]";
  }
  
  async function suggestTopic(markdown, apiKey) {
    const temas = [
      "Tema 1: Estructuras de Datos Básicas",
      "Tema 2: Recursividad",
      "Tema 3: Análisis Básico de Algoritmos",
      "Tema 4: Listas",
      "Tema 5: Pilas y Colas",
      "Tema 6: Árboles",
      "Tema 7: Árboles de búsqueda binaria"
    ];
    const prompt = `A continuación tienes el enunciado de una pregunta de informática. Dime cuál de estos temas corresponde mejor, y responde solo con el texto exacto del tema:\n\n${temas.join("\n")}\n\nPregunta:\n${markdown}`;
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      })
    });
  
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "[Tema no detectado]";
  }
  
  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  