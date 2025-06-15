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

            // Subsequent Pages with enhanced children's book design
            for (let i = 0; i < data.story.length; i++) {
                doc.addPage();
                
                // Create dynamic gradient background based on page content
                const pageContent = data.story[i].toLowerCase();
                let bgColor1, bgColor2;
                
                // Choose gradient colors based on story content
                if (pageContent.includes('night') || pageContent.includes('dark') || pageContent.includes('moon')) {
                    bgColor1 = [25, 25, 112]; // Midnight blue
                    bgColor2 = [72, 61, 139]; // Dark slate blue
                } else if (pageContent.includes('forest') || pageContent.includes('tree') || pageContent.includes('green')) {
                    bgColor1 = [240, 255, 240]; // Honeydew
                    bgColor2 = [144, 238, 144]; // Light green
                } else if (pageContent.includes('ocean') || pageContent.includes('water') || pageContent.includes('blue')) {
                    bgColor1 = [240, 248, 255]; // Alice blue
                    bgColor2 = [173, 216, 230]; // Light blue
                } else if (pageContent.includes('sunset') || pageContent.includes('orange') || pageContent.includes('warm')) {
                    bgColor1 = [255, 248, 220]; // Cornsilk
                    bgColor2 = [255, 218, 185]; // Peach puff
                } else {
                    bgColor1 = [255, 255, 230]; // Default light yellow
                    bgColor2 = [255, 250, 205]; // Lemon chiffon
                }
                
                // Create gradient effect with multiple rectangles
                for (let g = 0; g < 20; g++) {
                    const ratio = g / 19;
                    const r = Math.round(bgColor1[0] + (bgColor2[0] - bgColor1[0]) * ratio);
                    const green = Math.round(bgColor1[1] + (bgColor2[1] - bgColor1[1]) * ratio);
                    const b = Math.round(bgColor1[2] + (bgColor2[2] - bgColor1[2]) * ratio);
                    
                    doc.setFillColor(r, green, b);
                    doc.rect(0, g * (page_height / 20), page_width, page_height / 20, 'F');
                }
                
                // Add decorative themed border
                doc.setDrawColor(255, 182, 193); // Light pink border
                doc.setLineWidth(2);
                doc.rect(8, 8, page_width - 16, page_height - 16, 'S');
                
                // Add corner decorative elements based on theme
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(16);
                doc.setTextColor(255, 182, 193);
                
                if (pageContent.includes('night') || pageContent.includes('moon')) {
                    doc.text('★', 15, 20); doc.text('☾', page_width - 15, 20);
                    doc.text('✦', 15, page_height - 15); doc.text('★', page_width - 15, page_height - 15);
                } else if (pageContent.includes('forest') || pageContent.includes('tree')) {
                    doc.text('🌿', 15, 20); doc.text('🍃', page_width - 15, 20);
                    doc.text('🌱', 15, page_height - 15); doc.text('🌿', page_width - 15, page_height - 15);
                } else if (pageContent.includes('ocean') || pageContent.includes('water')) {
                    doc.text('🌊', 15, 20); doc.text('🐚', page_width - 15, 20);
                    doc.text('🌊', 15, page_height - 15); doc.text('🐚', page_width - 15, page_height - 15);
                } else {
                    doc.text('✿', 15, 20); doc.text('❀', page_width - 15, 20);
                    doc.text('✾', 15, page_height - 15); doc.text('✿', page_width - 15, page_height - 15);
                }
                
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
                
                // Enhanced typography with drop caps and larger fonts
                const storyText = data.story[i];
                const firstLetter = storyText.charAt(0);
                const restOfText = storyText.substring(1);
                
                const textY = imgY + imgSize + 25;
                const textWidth = page_width - 80; // More padding for better readability
                const textX = page_width / 2;
                
                // Create a decorative text background
                doc.setFillColor(255, 255, 255, 0.7); // Semi-transparent white
                doc.roundedRect(textX - (textWidth / 2) - 15, textY - 15, textWidth + 30, 60, 8, 8, 'F');
                
                // Add decorative border around text area
                doc.setDrawColor(255, 182, 193);
                doc.setLineWidth(1);
                doc.roundedRect(textX - (textWidth / 2) - 15, textY - 15, textWidth + 30, 60, 8, 8, 'S');
                
                // Drop cap - large first letter
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(36);
                doc.setTextColor(220, 20, 60); // Crimson color for drop cap
                const dropCapX = textX - (textWidth / 2) + 5;
                doc.text(firstLetter, dropCapX, textY + 5);
                
                // Main story text - larger and more readable
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(20); // Increased from 18 to 20
                doc.setTextColor(0, 0, 0); // Pure black text
                
                // Position text to flow around drop cap
                const mainTextX = dropCapX + 25; // Start after drop cap
                const mainTextWidth = textWidth - 30; // Adjust width for drop cap
                const splitText = doc.splitTextToSize(restOfText, mainTextWidth);
                
                // Add the main story text
                doc.text(splitText, mainTextX, textY, { align: 'left' });
                
                // Add small decorative elements around text
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(12);
                doc.setTextColor(255, 182, 193);
                
                // Add themed margin decorations based on content
                const marginDecoY = textY + 35;
                if (pageContent.includes('magic') || pageContent.includes('fairy')) {
                    doc.text('✨', textX - (textWidth / 2) - 25, marginDecoY);
                    doc.text('⭐', textX + (textWidth / 2) + 20, marginDecoY);
                } else if (pageContent.includes('animal') || pageContent.includes('zoo')) {
                    doc.text('🐾', textX - (textWidth / 2) - 25, marginDecoY);
                    doc.text('🦋', textX + (textWidth / 2) + 20, marginDecoY);
                } else if (pageContent.includes('adventure') || pageContent.includes('journey')) {
                    doc.text('🗺️', textX - (textWidth / 2) - 25, marginDecoY);
                    doc.text('⚡', textX + (textWidth / 2) + 20, marginDecoY);
                } else {
                    doc.text('❤️', textX - (textWidth / 2) - 25, marginDecoY);
                    doc.text('🌟', textX + (textWidth / 2) + 20, marginDecoY);
                }
                
                // Enhanced page number with themed styling
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                
                const pageNumX = page_width - 30;
                const pageNumY = page_height - 25;
                
                // Create a themed page number background
                if (pageContent.includes('night') || pageContent.includes('moon')) {
                    doc.setFillColor(25, 25, 112); // Dark blue
                    doc.setTextColor(255, 255, 255); // White text
                    doc.circle(pageNumX, pageNumY, 15, 'F');
                    doc.text('☾', pageNumX - 8, pageNumY - 8);
                } else if (pageContent.includes('forest') || pageContent.includes('tree')) {
                    doc.setFillColor(144, 238, 144); // Light green
                    doc.setTextColor(0, 100, 0); // Dark green text
                    doc.circle(pageNumX, pageNumY, 15, 'F');
                    doc.text('🌿', pageNumX - 8, pageNumY - 8);
                } else if (pageContent.includes('ocean') || pageContent.includes('water')) {
                    doc.setFillColor(173, 216, 230); // Light blue
                    doc.setTextColor(0, 0, 139); // Dark blue text
                    doc.circle(pageNumX, pageNumY, 15, 'F');
                    doc.text('🌊', pageNumX - 8, pageNumY - 8);
                } else {
                    doc.setFillColor(255, 218, 185); // Peach
                    doc.setTextColor(139, 69, 19); // Saddle brown text
                    doc.circle(pageNumX, pageNumY, 15, 'F');
                    doc.text('✿', pageNumX - 8, pageNumY - 8);
                }
                
                // Page number text
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text(`${i + 1}`, pageNumX + 5, pageNumY + 2, { align: 'center', baseline: 'middle' });
                
                // Add additional margin illustrations based on story theme
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(14);
                doc.setTextColor(255, 182, 193);
                
                // Top margin decorations
                const topMarginY = 25;
                for (let m = 0; m < 3; m++) {
                    const marginX = 40 + (m * 60);
                    if (pageContent.includes('magic')) {
                        doc.text(['✨', '⭐', '🌟'][m], marginX, topMarginY);
                    } else if (pageContent.includes('animal')) {
                        doc.text(['🐾', '🦋', '🌸'][m], marginX, topMarginY);
                    } else if (pageContent.includes('adventure')) {
                        doc.text(['⚡', '🗺️', '🎯'][m], marginX, topMarginY);
                    } else {
                        doc.text(['❀', '✿', '❁'][m], marginX, topMarginY);
                    }
                }
                
                // Bottom margin decorations
                const bottomMarginY = page_height - 10;
                for (let m = 0; m < 2; m++) {
                    const marginX = 50 + (m * 100);
                    if (pageContent.includes('night')) {
                        doc.text(['★', '☾'][m], marginX, bottomMarginY);
                    } else if (pageContent.includes('nature')) {
                        doc.text(['🌿', '🍃'][m], marginX, bottomMarginY);
                    } else {
                        doc.text(['♡', '✾'][m], marginX, bottomMarginY);
                    }
                }
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