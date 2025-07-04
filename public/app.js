document.addEventListener('DOMContentLoaded', () => {
    // Ensure jsPDF is loaded
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        console.error("jsPDF not loaded!");
        return;
    }

    // --- DOM Elements ---
    const generateBtn = document.getElementById('generate-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const storyForm = document.getElementById('story-form');
    const loadingDiv = document.getElementById('loading');
    const storyBookDiv = document.getElementById('story-book');
    const bookTitleEl = document.getElementById('book-title');
    const bookCoverEl = document.getElementById('book-cover');
    const bookPagesEl = document.getElementById('book-pages');
    const textModelSelect = document.getElementById('text-model');
    const imageModelSelect = document.getElementById('image-model');

    let currentBookData = null;

    // --- Functions ---

    // Fetch and populate both text and image models
    async function populateModels() {
        try {
            const response = await fetch('/api/models');
            if (!response.ok) throw new Error('Failed to fetch models.');
            const { textModels, imageModels } = await response.json();
            
            textModelSelect.innerHTML = ''; // Clear "Loading..."
            if (textModels && textModels.length > 0) {
                textModels.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.id;
                    if (model.id === 'mistral-31-24b') option.selected = true;
                    textModelSelect.appendChild(option);
                });
            } else {
                textModelSelect.innerHTML = `<option value="">No text models found</option>`;
            }

            imageModelSelect.innerHTML = ''; // Clear "Loading..."
            if (imageModels && imageModels.length > 0) {
                imageModels.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.id;
                    if (model.id === 'venice-sd35') option.selected = true;
                    imageModelSelect.appendChild(option);
                });
            } else {
                imageModelSelect.innerHTML = `<option value="">No image models found</option>`;
            }

        } catch (error) {
            textModelSelect.innerHTML = `<option value="">Could not load models</option>`;
            imageModelSelect.innerHTML = `<option value="">Could not load models</option>`;
            console.error(error);
        }
    }

    // Main generate button click handler
    generateBtn.addEventListener('click', async () => {
        const prompt = document.getElementById('story-prompt').value.trim();
        const gradeLevel = document.getElementById('grade-level').value;
        const language = document.getElementById('language').value;
        const artStyle = document.getElementById('art-style').value;
        const model = textModelSelect.value;
        const imageModel = imageModelSelect.value;

        if (!prompt || !model || !imageModel) {
            alert('Please enter a prompt and select both models.');
            return;
        }

        storyForm.classList.add('hidden');
        loadingDiv.classList.remove('hidden');
        storyBookDiv.classList.add('hidden');
        currentBookData = null;

        try {
            const response = await fetch('/api/story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, gradeLevel, language, artStyle, model, imageModel })
            });
            if (!response.ok) throw new Error((await response.json()).error || 'Failed to generate book.');
            
            currentBookData = await response.json();
            renderStoryBook(currentBookData);

        } catch (error) {
            console.error('Error generating story:', error);
            alert(`Error: ${error.message}`);
        } finally {
            loadingDiv.classList.add('hidden');
            storyForm.classList.remove('hidden');
        }
    });

    // Render the generated book to the HTML
    function renderStoryBook(data) {
        bookTitleEl.innerText = data.title;
        bookCoverEl.innerHTML = `<img src="${data.coverImageUrl}" alt="Cover for ${data.title}">`;
        bookPagesEl.innerHTML = ''; // Clear old pages
        
        data.story.forEach((pageText, index) => {
            const pageNumber = index + 1;
            const imageUrl = data.pageImageUrls[index];
            const pageElement = document.createElement('div');
            pageElement.className = 'page';
            pageElement.innerHTML = `
                <div class="page-image-container">
                    <img src="${imageUrl}" alt="Illustration for page ${pageNumber}">
                </div>
                <div class="page-content">
                    <div class="page-header"><h3>Page ${pageNumber}</h3></div>
                    <p class="page-text">${pageText}</p>
                </div>`;
            bookPagesEl.appendChild(pageElement);
        });

        storyBookDiv.classList.remove('hidden');
        downloadPdfBtn.classList.remove('hidden');
    }

    // PDF Download button click handler
    downloadPdfBtn.addEventListener('click', () => {
        if (!currentBookData) return alert("Please generate a story first!");
        createPdf(currentBookData);
    });

    // Final PDF generation with all layout improvements
    async function createPdf(data) {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        alert("Generating final PDF... Please wait for the download.");

        const fetchImageAsBase64 = async (url) => {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        };

        // Use built-in fonts for reliability
        console.log("Available fonts:", doc.getFontList());

        const page_width = doc.internal.pageSize.getWidth();
        const page_height = doc.internal.pageSize.getHeight();

        try {
            // Page 1: Full-bleed landscape cover (title included in the generated image)
            const coverImgBase64 = await fetchImageAsBase64(data.coverImageUrl);
            doc.addImage(coverImgBase64, 'JPEG', 0, 0, page_width, page_height);

            // Subsequent Pages with clean, simple design
            for (let i = 0; i < data.story.length; i++) {
                doc.addPage();
                
                // Simple yellow background
                doc.setFillColor(255, 255, 230); // Light yellow tint
                doc.rect(0, 0, page_width, page_height, 'F');
                
                // Simple border
                doc.setDrawColor(255, 182, 193); // Light pink border
                doc.setLineWidth(1);
                doc.rect(5, 5, page_width - 10, page_height - 10, 'S');
                
                // Image with rounded corners effect (simulated)
                const pageImgBase64 = await fetchImageAsBase64(data.pageImageUrls[i]);
                const imgSize = page_height / 1.8; 
                const imgX = (page_width - imgSize) / 2;
                const imgY = 15;
                
                // Add shadow behind image
                doc.setFillColor(0, 0, 0, 0.1);
                doc.rect(imgX + 2, imgY + 2, imgSize, imgSize, 'F');
                
                // Add the main image
                doc.addImage(pageImgBase64, 'JPEG', imgX, imgY, imgSize, imgSize);
                
                // No frame around image for cleaner look
                
                // Simple, clean story text
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(18);
                doc.setTextColor(0, 0, 0); // Pure black text
                
                const textY = imgY + imgSize + 20;
                const textWidth = page_width - 60;
                const textX = page_width / 2;
                
                // Split and add the story text
                const splitText = doc.splitTextToSize(data.story[i], textWidth);
                doc.text(splitText, textX, textY, { align: 'center' });
                
                // Simple page number
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.setTextColor(0, 0, 0); // Black text
                
                const pageNumX = page_width - 25;
                const pageNumY = page_height - 20;
                doc.text(`${i + 1}`, pageNumX, pageNumY, { align: 'center', baseline: 'middle' });
            }

            // Final "The End" page
            doc.addPage();
            
            // Create a subtle warm background
            doc.setFillColor(255, 255, 230); // Very light yellow tint (subtle)
            doc.rect(0, 0, page_width, page_height, 'F');
            
            // Add subtle decorative border
            doc.setDrawColor(255, 182, 193); // Light pink border
            doc.setLineWidth(1);
            doc.rect(5, 5, page_width - 10, page_height - 10, 'S');
            
            // "The End" image
            const endImgBase64 = await fetchImageAsBase64(data.endPageImageUrl);
            const endImgSize = page_height / 2; 
            const endImgX = (page_width - endImgSize) / 2;
            const endImgY = 20;
            
            // Add shadow behind image
            doc.setFillColor(0, 0, 0, 0.1);
            doc.rect(endImgX + 2, endImgY + 2, endImgSize, endImgSize, 'F');
            
            // Add the "The End" image
            doc.addImage(endImgBase64, 'JPEG', endImgX, endImgY, endImgSize, endImgSize);
            
            // No frame around image for cleaner look
            
            // "Made with Lots of Love by Vivek" text
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(24);
            doc.setTextColor(0, 0, 0); // Pure black text
            
            const signatureY = endImgY + endImgSize + 30;
            const signatureX = page_width / 2;
            
            doc.text('Made with Lots of Love by Vivek', signatureX, signatureY, { align: 'center' });
            
            // Add small decorative elements in corners
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);
            doc.setTextColor(255, 182, 193); // Light pink decorations
            doc.text('*', 15, 15);
            doc.text('*', page_width - 15, 15);
            doc.text('+', 15, page_height - 15);

            doc.save(`${data.title.replace(/ /g, '_')}.pdf`);
        } catch (error) {
            console.error("Error creating PDF:", error);
            alert("Failed to create PDF. See console for details.");
        }
    }

    // --- Initializer ---
    populateModels();
}); 