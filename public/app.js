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

        const addFontToVFS = async (name, url) => {
            try {
                const fontResponse = await fetch(url);
                if (!fontResponse.ok) throw new Error(`Failed to fetch font ${name}`);
                const blob = await fontResponse.blob();
                const fontBase64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                doc.addFileToVFS(`${name}.ttf`, fontBase64);
                doc.addFont(`${name}.ttf`, name, 'normal');
            } catch (error) {
                console.error(`Could not fetch font ${name}, using default.`, error);
            }
        };

        await addFontToVFS('LuckiestGuy', 'https://github.com/google/fonts/raw/main/ofl/luckiestguy/LuckiestGuy-Regular.ttf');
        await addFontToVFS('PatrickHand', 'https://github.com/google/fonts/raw/main/ofl/patrickhand/PatrickHand-Regular.ttf');

        const page_width = doc.internal.pageSize.getWidth();
        const page_height = doc.internal.pageSize.getHeight();

        try {
            // Page 1: Full-bleed landscape cover with new font
            const coverImgBase64 = await fetchImageAsBase64(data.coverImageUrl);
            doc.addImage(coverImgBase64, 'JPEG', 0, 0, page_width, page_height);
            
            const titleText = data.title;
            doc.setFont('LuckiestGuy', 'normal');
            doc.setFontSize(52);
            doc.setTextColor('#000000'); // Shadow color
            doc.text(titleText, (page_width / 2) + 1, (page_height / 2) + 1, { align: 'center', baseline: 'middle' });
            doc.setTextColor('#FFFFFF'); // Main text color
            doc.text(titleText, page_width / 2, page_height / 2, { align: 'center', baseline: 'middle' });

            // Subsequent Pages
            doc.setFont('PatrickHand', 'normal'); // Switch to story font
            for (let i = 0; i < data.story.length; i++) {
                doc.addPage();
                doc.setFillColor('#FFF9E8');
                doc.rect(0, 0, page_width, page_height, 'F');
                
                const pageImgBase64 = await fetchImageAsBase64(data.pageImageUrls[i]);
                const imgSize = page_height / 1.7; 
                const imgX = (page_width - imgSize) / 2;
                doc.addImage(pageImgBase64, 'JPEG', imgX, 10, imgSize, imgSize);
                
                doc.setTextColor('#000000');
                doc.setFontSize(24);
                const textY = imgSize + 25;
                const textWidth = page_width - 40;
                const splitText = doc.splitTextToSize(data.story[i], textWidth);
                doc.text(splitText, page_width / 2, textY, { align: 'center' });
                
                doc.setFontSize(12);
                doc.text(`${i + 1}`, page_width - 15, page_height - 10);
            }

            doc.save(`${data.title.replace(/ /g, '_')}.pdf`);
        } catch (error) {
            console.error("Error creating PDF:", error);
            alert("Failed to create PDF. See console for details.");
        }
    }

    // --- Initializer ---
    populateModels();
}); 