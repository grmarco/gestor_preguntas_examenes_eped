let topicChartInstance = null; // Guardar la instancia para poder destruirla/actualizarla

function generateTopicStatsChart(questionsData) {
    console.log("Generando gráfico de estadísticas de temas...");
    const ctx = document.getElementById('topicStatsChart');
    if (!ctx) {
        console.error("Elemento canvas 'topicStatsChart' no encontrado.");
        return;
    }

    // 1. Procesar los Datos
    const stats = {}; // Objeto para almacenar: { año: { tema1: count, tema2: count }, ... }
    const years = new Set();
    const topics = new Set();

    questionsData.forEach(q => {
        const year = q.exam?.year;
        const topic = q.topic || 'Sin Tema'; // Agrupar preguntas sin tema

        if (year) {
            const yearStr = year.toString(); // Usar strings para claves de objeto
            years.add(yearStr);
            topics.add(topic);

            if (!stats[yearStr]) {
                stats[yearStr] = {}; // Crear objeto para el año si no existe
            }
            if (!stats[yearStr][topic]) {
                stats[yearStr][topic] = 0; // Inicializar contador para el tema en ese año
            }
            stats[yearStr][topic]++; // Incrementar contador
        }
    });

    const sortedYears = Array.from(years).sort(); // Eje X: Años ordenados
    const sortedTopics = Array.from(topics).sort(); // Leyenda/Datasets: Temas ordenados

    // Necesitamos una paleta de colores. Puedes definirla tú o usar una librería.
    // Ejemplo básico de colores (¡mejora esto para más temas!)
    const defaultColors = [
        'rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)',
        'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)',
        'rgba(199, 199, 199, 0.7)', 'rgba(83, 102, 255, 0.7)', 'rgba(40, 159, 64, 0.7)'
    ];
    const topicColors = {};
    sortedTopics.forEach((topic, index) => {
         topicColors[topic] = defaultColors[index % defaultColors.length]; // Ciclar colores
    });


    // 2. Preparar Datos para Chart.js
    const datasets = sortedTopics.map(topic => {
        // Para cada tema, crea un array con su count para cada año (0 si no aparece)
        const dataCounts = sortedYears.map(year => stats[year]?.[topic] || 0);
        return {
            label: topic,               // Nombre del tema
            data: dataCounts,           // Array de counts por año
            backgroundColor: topicColors[topic], // Color de relleno
            borderColor: topicColors[topic].replace('0.7', '1'), // Borde más opaco
            borderWidth: 1,
            fill: true, // Importante para Stacked Area
            // stack: 'combined' // Necesario si usas 'bar' para barras apiladas
            // tension: 0.1 // Suavizar líneas en area chart (opcional)
        };
    });

    // 3. Configuración del Gráfico (Stacked Area)
    const config = {
        type: 'line', // Para Stacked Area, se usa 'line' con fill: true y opciones de apilado
        data: {
            labels: sortedYears, // Eje X: Años
            datasets: datasets   // Los datos por tema
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Permite controlar altura con CSS/style
            plugins: {
                title: {
                    display: false, // Ya tenemos un H2, pero puedes poner título aquí
                    // text: 'Evolución de Temas por Año'
                },
                tooltip: {
                    mode: 'index', // Mostrar tooltip para todos los datasets en ese índice (año)
                    intersect: false,
                },
                legend: {
                    position: 'bottom', // Posición de la leyenda
                },
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Año'
                    },
                },
                y: {
                    title: {
                        display: true,
                        text: 'Nº de Preguntas'
                    },
                    stacked: true, // ¡Importante para apilar las áreas!
                    beginAtZero: true
                }
            }
        }
    };

     // --- Configuración Alternativa (Stacked Bar) ---
     /*
     const config = {
         type: 'bar',
         data: {
             labels: sortedYears,
             datasets: datasets.map(ds => ({ ...ds, stack: 'combined' })) // Añadir 'stack' aquí
         },
         options: {
             responsive: true,
             maintainAspectRatio: false,
             plugins: { // ... (igual que antes) ... },
             scales: {
                 x: {
                     stacked: true, // Apilar en eje X
                     title: { display: true, text: 'Año' }
                 },
                 y: {
                     stacked: true, // Apilar en eje Y
                     title: { display: true, text: 'Nº de Preguntas' },
                     beginAtZero: true
                 }
             }
         }
     };
     */


        // --- stats.js (continuación) ---

    // 4. Renderizar el Gráfico

    // Destruir gráfico anterior si existe (siempre es bueno hacerlo antes de decidir si crear uno nuevo)
    if (topicChartInstance) {
        console.log("Destruyendo instancia de gráfico existente.");
        topicChartInstance.destroy();
        topicChartInstance = null; // Asegurarse que la variable quede limpia
    }
    // ***** INICIO DE LA CORRECCIÓN *****
    // Verificar si hay datos suficientes para dibujar el gráfico
    if (sortedYears.length > 0 && datasets.length > 0) {

        // Crear nueva instancia de Chart.js con la configuración
        try {
            topicChartInstance = new Chart(ctx, config);
            console.log("Gráfico generado/actualizado.");
             // Opcional: Asegurarse que el contenedor del canvas esté visible
             ctx.parentElement.style.display = ''; // O 'block'
        } catch (chartError) {
            console.error("Error al crear la instancia de Chart.js:", chartError);
            alert("Error al generar el gráfico de estadísticas.");
             // Limpiar canvas por si acaso
            ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
             // Opcional: Ocultar el contenedor si falla
             // ctx.parentElement.style.display = 'none';
        }

    } else {
        // Esto se ejecuta si NO hay años o NO hay datasets (temas)
        console.log("No hay datos suficientes (años o temas) para generar el gráfico.");
        // Limpiar el canvas si ya estaba dibujado
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        // Opcional: Añadir un mensaje al usuario DENTRO del contenedor del gráfico
        // Comprobar si el mensaje ya existe para no duplicarlo
        const noDataDiv = ctx.parentElement.querySelector('.no-stats-message');
        if (!noDataDiv) {
             const messageElement = document.createElement('p');
             messageElement.textContent = 'No hay suficientes datos para mostrar las estadísticas.';
             messageElement.className = 'no-stats-message'; // Clase para identificar/estilizar
             messageElement.style.textAlign = 'center';
             messageElement.style.padding = '2em';
             messageElement.style.color = 'var(--text-secondary)';
             // Insertar el mensaje ANTES del canvas (o después, como prefieras)
             ctx.insertAdjacentElement('beforebegin', messageElement);
        }
         // Opcional: Ocultar solo el canvas, manteniendo el título y el mensaje
         // ctx.style.display = 'none';
         // Ocultar todo el contenedor si se prefiere
         // ctx.parentElement.style.display = 'none';

    }
    // ***** FIN DE LA CORRECCIÓN *****

} // Fin de la función generateTopicStatsChart