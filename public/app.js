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
        await addFontToVFS('ComicNeue', 'https://github.com/google/fonts/raw/main/ofl/comicneue/ComicNeue-Regular.ttf');
        await addFontToVFS('BubblegumSans', 'https://github.com/google/fonts/raw/main/ofl/bubblegumsans/BubblegumSans-Regular.ttf');

        const page_width = doc.internal.pageSize.getWidth();
        const page_height = doc.internal.pageSize.getHeight();

        try {
            // Page 1: Full-bleed landscape cover with improved title banner
            const coverImgBase64 = await fetchImageAsBase64(data.coverImageUrl);
            doc.addImage(coverImgBase64, 'JPEG', 0, 0, page_width, page_height);
            
            const titleText = data.title;
            
            // Create a decorative banner background for the title
            const bannerHeight = 45;
            const bannerY = (page_height / 2) - (bannerHeight / 2);
            const bannerMargin = 30;
            
            // Main banner background with gradient effect
            doc.setFillColor(0, 0, 0, 0.7); // Semi-transparent black
            doc.roundedRect(bannerMargin, bannerY, page_width - (bannerMargin * 2), bannerHeight, 8, 8, 'F');
            
            // Inner lighter banner for depth
            doc.setFillColor(255, 255, 255, 0.9); // Semi-transparent white
            doc.roundedRect(bannerMargin + 3, bannerY + 3, page_width - (bannerMargin * 2) - 6, bannerHeight - 6, 5, 5, 'F');
            
            // Decorative border
            doc.setDrawColor(255, 215, 0); // Gold color
            doc.setLineWidth(2);
            doc.roundedRect(bannerMargin + 1, bannerY + 1, page_width - (bannerMargin * 2) - 2, bannerHeight - 2, 6, 6, 'S');
            
            // Title text with better contrast
            doc.setFont('BubblegumSans', 'normal');
            doc.setFontSize(48);
            
            // Text shadow for depth
            doc.setTextColor(0, 0, 0, 0.3); // Semi-transparent black shadow
            doc.text(titleText, (page_width / 2) + 1, (page_height / 2) + 1, { align: 'center', baseline: 'middle' });
            
            // Main title text
            doc.setTextColor(70, 130, 180); // Steel blue - child-friendly color
            doc.text(titleText, page_width / 2, page_height / 2, { align: 'center', baseline: 'middle' });
            
            // Add decorative stars around the banner
            doc.setFont('LuckiestGuy', 'normal');
            doc.setFontSize(24);
            doc.setTextColor(255, 215, 0); // Gold stars
            doc.text('★', bannerMargin - 15, page_height / 2, { align: 'center', baseline: 'middle' });
            doc.text('★', page_width - bannerMargin + 15, page_height / 2, { align: 'center', baseline: 'middle' });
            doc.text('★', page_width / 2 - 60, bannerY - 10, { align: 'center', baseline: 'middle' });
            doc.text('★', page_width / 2 + 60, bannerY - 10, { align: 'center', baseline: 'middle' });

            // Subsequent Pages with improved children-friendly design
            for (let i = 0; i < data.story.length; i++) {
                doc.addPage();
                
                // Create a warm, child-friendly background
                doc.setFillColor(255, 253, 240); // Warm ivory background
                doc.rect(0, 0, page_width, page_height, 'F');
                
                // Add subtle decorative border
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
                
                // Add decorative frame around image
                doc.setDrawColor(70, 130, 180); // Steel blue frame
                doc.setLineWidth(3);
                doc.rect(imgX - 2, imgY - 2, imgSize + 4, imgSize + 4, 'S');
                
                // Story text with child-friendly font
                doc.setFont('ComicNeue', 'normal');
                doc.setFontSize(20);
                doc.setTextColor(51, 51, 51); // Dark gray for better readability
                
                const textY = imgY + imgSize + 20;
                const textWidth = page_width - 60; // More padding
                const textX = page_width / 2;
                
                // Add text background for better readability
                const splitText = doc.splitTextToSize(data.story[i], textWidth);
                const textHeight = splitText.length * 8;
                const textBgY = textY - 5;
                
                doc.setFillColor(255, 255, 255, 0.8); // Semi-transparent white background
                doc.roundedRect(textX - (textWidth / 2) - 10, textBgY, textWidth + 20, textHeight + 10, 5, 5, 'F');
                
                // Add the story text
                doc.text(splitText, textX, textY, { align: 'center' });
                
                // Page number in a fun bubble
                doc.setFont('BubblegumSans', 'normal');
                doc.setFontSize(16);
                
                // Page number bubble
                const pageNumX = page_width - 25;
                const pageNumY = page_height - 20;
                doc.setFillColor(255, 215, 0); // Gold bubble
                doc.circle(pageNumX, pageNumY, 12, 'F');
                doc.setDrawColor(255, 165, 0); // Orange border
                doc.setLineWidth(2);
                doc.circle(pageNumX, pageNumY, 12, 'S');
                
                // Page number text
                doc.setTextColor(0, 0, 0);
                doc.text(`${i + 1}`, pageNumX, pageNumY + 2, { align: 'center', baseline: 'middle' });
                
                // Add small decorative elements in corners
                doc.setFont('LuckiestGuy', 'normal');
                doc.setFontSize(12);
                doc.setTextColor(255, 182, 193, 0.5); // Light pink decorations
                doc.text('❀', 15, 15);
                doc.text('❀', page_width - 15, 15);
                doc.text('☆', 15, page_height - 15);
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