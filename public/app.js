document.addEventListener('DOMContentLoaded', () => {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
        console.error('jsPDF not loaded!');
        return;
    }

    const API_PATHS = window.__API_PATHS__ || ['/api', '/.netlify/functions'];

    const generateBtn = document.getElementById('generate-btn');
    const downloadPdfBtnMain = document.getElementById('download-pdf-btn');
    const downloadPdfBtnTop = document.getElementById('download-pdf-btn-top');
    const storyForm = document.getElementById('story-form');
    const loadingDiv = document.getElementById('loading');
    const loadingText = loadingDiv ? loadingDiv.querySelector('.loading__text') : null;
    const storyBookDiv = document.getElementById('story-book');
    const bookTitleEl = document.getElementById('book-title');
    const bookCoverEl = document.getElementById('book-cover');
    const bookPagesEl = document.getElementById('book-pages');
    const imageModelSelect = document.getElementById('image-model');
    const storyPromptInput = document.getElementById('story-prompt');
    const adultConfirmation = document.getElementById('adult-confirmation');
    const artStyleSelect = document.getElementById('art-style');

    const FUN_FACTS = [
        "Did you know? The average children's book has 32 pages, but ours has 8 pages of pure magic! ✨",
        "Fun fact: Children who read books with diverse characters show more empathy! 💙",
        "Amazing: A child's imagination can create over 100 different story endings for the same beginning! 🌟",
        "Cool fact: Reading together increases vocabulary 8 times faster than reading alone! 📚",
        "Did you know? Illustrations help children remember stories 3 times better! 🎨",
        "Wonderful: Every story you create becomes a unique keepsake forever! 💝",
        "Neat fact: AI can generate images in seconds that would take artists hours! 🚀",
        "Amazing: Your child's favorite story character can boost their reading time by 40%! 🦸",
        "Did you know? Bedtime stories improve sleep quality AND vocabulary! 😴📖",
        "Cool: The most popular children's book character types are animals and magical beings! 🐻✨",
        "Fun fact: Children who create stories are 60% more creative in problem-solving! 🧩",
        "Amazing: Different art styles help children appreciate global cultures! 🌍",
        "Did you know? Repetitive phrases in stories help early readers build confidence! 💪",
        "Neat: Your child's brain grows new neural connections every time they hear a new story! 🧠",
        "Wonderful: Personalized stories make children 3x more likely to ask for more books! 📚❤️"
    ];

    const ART_STYLE_OPTIONS = [
        { value: 'Studio Ghibli', label: 'Studio Ghibli', defaultSelected: true },
        { value: 'Hayao Miyazaki style', label: 'Hayao Miyazaki style' },
        { value: 'Midcentury American cartoon', label: 'Midcentury American cartoon' },
        { value: 'Amar Chitra Katha', label: 'Amar Chitra Katha' },
        { value: 'Chacha Chaudhary', label: 'Chacha Chaudhary' },
        { value: 'xkcd Comics', label: 'xkcd Comics' },
        { value: 'Old cartoon', label: 'Old cartoon' },
        { value: 'Indian Warli art', label: 'Indian Warli art' }
    ];

    if (artStyleSelect) {
        artStyleSelect.innerHTML = '';
        ART_STYLE_OPTIONS.forEach((optionDef, index) => {
            const option = document.createElement('option');
            option.value = optionDef.value;
            option.textContent = optionDef.label;
            if (optionDef.defaultSelected || (!ART_STYLE_OPTIONS.some(opt => opt.defaultSelected) && index === 0)) {
                option.selected = true;
            }
            artStyleSelect.appendChild(option);
        });
    }

    const statusBanner = document.getElementById('status-banner');
    const statusBannerIcon = statusBanner ? statusBanner.querySelector('.status-banner__icon') : null;
    const statusBannerText = statusBanner ? statusBanner.querySelector('.status-banner__text') : null;
    const statusBannerClose = statusBanner ? statusBanner.querySelector('.status-banner__close') : null;
    const progressSteps = Array.from(document.querySelectorAll('.progress-tracker__step'));
    const views = Array.from(document.querySelectorAll('.view'));
    const navButtons = Array.from(document.querySelectorAll('.app-nav__item'));
    const quickNavButtons = Array.from(document.querySelectorAll('[data-nav-target]'));
    const ctaCreate = document.getElementById('cta-create');

    let currentBookData = null;
    let progressTimers = [];
    let progressActiveIndex = 0;
    let funFactInterval = null;
    let currentFactIndex = 0;

    const progressMessages = [
        { index: 0, message: 'Creating your story blueprint with AI magic…' },
        { index: 1, message: 'Designing a lovable main character…' },
        { index: 2, message: 'Painting vibrant scenes for each page…' },
        { index: 3, message: 'Adding the finishing touches to your book…' }
    ];

    function rotateFunFacts() {
        if (loadingText && FUN_FACTS.length > 0) {
            currentFactIndex = (currentFactIndex + 1) % FUN_FACTS.length;
            loadingText.textContent = FUN_FACTS[currentFactIndex];
            loadingText.style.animation = 'none';
            setTimeout(() => {
                loadingText.style.animation = 'fadeInUp 0.5s ease';
            }, 10);
        }
    }

    statusBannerClose?.addEventListener('click', () => {
        statusBanner?.classList.add('hidden');
    });

    function showView(viewName) {
        if (!viewName) return;
        views.forEach(view => {
            view.classList.toggle('is-active', view.dataset.view === viewName);
        });
        navButtons.forEach(button => {
            button.classList.toggle('is-active', button.dataset.nav === viewName);
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (viewName === 'create') {
            requestAnimationFrame(() => {
                if (!storyPromptInput) return;
                try {
                    storyPromptInput.focus({ preventScroll: true });
                } catch (error) {
                    storyPromptInput.focus();
                }
            });
        }
    }

    navButtons.forEach(button => {
        button.addEventListener('click', () => showView(button.dataset.nav));
    });

    quickNavButtons.forEach(button => {
        button.addEventListener('click', () => showView(button.dataset.navTarget));
    });

    ctaCreate?.addEventListener('click', () => showView('create'));


    function setFormDisabled(disabled) {
        if (!storyForm) return;
        const controls = storyForm.querySelectorAll('textarea, select, button');
        controls.forEach(control => {
            if (control === downloadPdfBtnMain) return;
            if (control === generateBtn && !disabled && adultConfirmation) {
                control.disabled = !adultConfirmation.checked;
            } else {
                control.disabled = disabled;
            }
        });
        storyForm.classList.toggle('is-disabled', disabled);
    }

    function enforceAdultConfirmation() {
        if (!generateBtn) return;
        if (adultConfirmation) {
            generateBtn.disabled = !adultConfirmation.checked;
        }
    }

    adultConfirmation?.addEventListener('change', () => {
        enforceAdultConfirmation();
    });

    enforceAdultConfirmation();

    function setStatus(message, type = 'info') {
        if (!statusBanner || !statusBannerIcon || !statusBannerText) return;
        statusBanner.classList.remove('hidden', 'status-banner--success', 'status-banner--error');
        const icons = { info: '✨', success: '🎉', error: '⚠️' };
        statusBannerIcon.textContent = icons[type] || icons.info;
        statusBannerText.textContent = message;
        if (type === 'success') {
            statusBanner.classList.add('status-banner--success');
        } else if (type === 'error') {
            statusBanner.classList.add('status-banner--error');
        }
    }

    function resetProgress() {
        progressSteps.forEach(step => step.classList.remove('is-active', 'is-complete', 'is-error'));
    }

    function activateProgress(index) {
        progressSteps.forEach((step, idx) => {
            step.classList.toggle('is-active', idx === index);
            step.classList.toggle('is-complete', idx < index);
            if (idx > index) {
                step.classList.remove('is-error');
            }
        });
        progressActiveIndex = index;
    }

    function startProgressAnimation() {
        resetProgress();
        activateProgress(0);
        setStatus(progressMessages[0].message, 'info');
        
        // Start with first fun fact
        currentFactIndex = Math.floor(Math.random() * FUN_FACTS.length);
        if (loadingText) {
            loadingText.textContent = FUN_FACTS[currentFactIndex];
        }
        
        // Rotate fun facts every 5 seconds
        if (funFactInterval) clearInterval(funFactInterval);
        funFactInterval = setInterval(rotateFunFacts, 5000);
        
        progressTimers = progressMessages.slice(1).map((item, idx) => {
            const delay = (idx + 1) * 3500;
            return setTimeout(() => {
                activateProgress(item.index);
                setStatus(item.message, 'info');
            }, delay);
        });
    }

    function stopProgressAnimation(success) {
        progressTimers.forEach(clearTimeout);
        progressTimers = [];
        
        // Stop fun facts rotation
        if (funFactInterval) {
            clearInterval(funFactInterval);
            funFactInterval = null;
        }
        
        if (success) {
            progressSteps.forEach(step => {
                step.classList.remove('is-active', 'is-error');
                step.classList.add('is-complete');
            });
        } else {
            const active = progressSteps.find(step => step.classList.contains('is-active')) || progressSteps[progressActiveIndex];
            if (active) {
                active.classList.remove('is-active');
                active.classList.add('is-error');
            }
        }
    }

    async function fetchWithFallback(endpoint, options = {}) {
        let lastError = null;
        for (let i = 0; i < API_PATHS.length; i += 1) {
            const base = API_PATHS[i];
            try {
                const response = await fetch(`${base}${endpoint}`, options);
                if (response.status === 404 && i < API_PATHS.length - 1) {
                    lastError = new Error(`Endpoint not found at ${base}`);
                    continue;
                }
                return response;
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error('Unable to reach the API.');
    }

    async function populateModels() {
        if (!imageModelSelect) {
            console.error('Image model dropdown is missing from the page.');
            return;
        }

        try {
            imageModelSelect.disabled = true;
            imageModelSelect.innerHTML = '<option value="">Loading…</option>';

            setStatus('Fetching the latest Venice.ai image models…', 'info');
            const response = await fetchWithFallback('/models');
            if (!response.ok) {
                let message = 'Could not fetch models from Venice.ai.';
                try {
                    const data = await response.json();
                    if (data?.error) message = data.error;
                } catch (err) {
                    console.warn('Failed to parse models error response', err);
                }
                throw new Error(message);
            }

            const data = await response.json();
            const { imageModels = [], fallback = false } = data;

            const renderOption = (selectEl, model, fallbackLabel) => {
                const option = document.createElement('option');
                option.value = model.id;
                const label = model.model_spec?.name || fallbackLabel || model.id;
                option.textContent = `${label} (${model.id})`;
                const promptLimit = model.model_spec?.constraints?.promptCharacterLimit;
                if (promptLimit) {
                    option.dataset.promptLimit = promptLimit;
                }
                selectEl.appendChild(option);
                return option;
            };

            imageModelSelect.innerHTML = '';
            if (Array.isArray(imageModels) && imageModels.length > 0) {
                imageModels.forEach(model => {
                    const option = renderOption(imageModelSelect, model, 'Safe image model');
                    if (model.id === 'qwen-image') {
                        option.selected = true;
                    }
                });
                if (!imageModelSelect.value) {
                    imageModelSelect.value = imageModels[0].id;
                }
            } else {
                imageModelSelect.innerHTML = '<option value="">No image models found</option>';
            }

            if (fallback) {
                setStatus('Offline demo mode: using built-in storyteller and illustrator.', 'info');
            } else {
                setStatus('Models ready! Choose your creative combo to begin.', 'success');
            }
            imageModelSelect.disabled = false;
        } catch (error) {
            console.error('Failed to load models:', error);
            imageModelSelect.innerHTML = '<option value="">Unable to load models</option>';
            setStatus(`We could not reach the Venice.ai models API: ${error.message}`, 'error');
            imageModelSelect.disabled = true;
        }
    }

    function renderStoryBook(data) {
        bookTitleEl.textContent = data.title;
        bookCoverEl.innerHTML = '';
        const coverImg = document.createElement('img');
        coverImg.src = data.coverImageUrl;
        coverImg.alt = `Cover for ${data.title}`;
        bookCoverEl.appendChild(coverImg);

        const pageImages = Array.isArray(data.pageImageUrls) ? data.pageImageUrls : [];
        bookPagesEl.innerHTML = '';
        data.story.forEach((pageText, index) => {
            const pageNumber = index + 1;
            const imageUrl = pageImages[index] || '';

            const pageElement = document.createElement('div');
            pageElement.className = 'page';

            const imageContainer = document.createElement('div');
            imageContainer.className = 'page-image-container';
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = `Illustration for page ${pageNumber}`;
            imageContainer.appendChild(img);

            const pageContent = document.createElement('div');
            pageContent.className = 'page-content';

            const header = document.createElement('div');
            header.className = 'page-header';
            const heading = document.createElement('h3');
            heading.textContent = `Page ${pageNumber}`;
            header.appendChild(heading);

            const paragraph = document.createElement('p');
            paragraph.className = 'page-text';
            paragraph.textContent = pageText;

            pageContent.append(header, paragraph);
            pageElement.append(imageContainer, pageContent);
            bookPagesEl.appendChild(pageElement);
        });

        storyBookDiv.classList.remove('hidden');
    }

    async function fetchImageAsBase64(url) {
        // If it's already a data URL (base64), return it directly
        if (url.startsWith('data:')) {
            return url;
        }
        
        // Otherwise, fetch and convert to base64
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Failed to fetch image:', error);
            // Return a placeholder or rethrow
            throw error;
        }
    }

    async function createPdf(data) {
        if (!data) {
            setStatus('Please generate a story before downloading the PDF.', 'error');
            return;
        }

        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        setStatus('Compiling a printable PDF of your adventure…', 'info');

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        try {
            const coverImgBase64 = await fetchImageAsBase64(data.coverImageUrl);
            doc.addImage(coverImgBase64, 'JPEG', 0, 0, pageWidth, pageHeight);

            for (let i = 0; i < data.story.length; i += 1) {
                doc.addPage();
                doc.setFillColor(255, 255, 230);
                doc.rect(0, 0, pageWidth, pageHeight, 'F');
                doc.setDrawColor(255, 182, 193);
                doc.setLineWidth(1);
                doc.rect(5, 5, pageWidth - 10, pageHeight - 10, 'S');

                const pageImgBase64 = await fetchImageAsBase64(data.pageImageUrls[i]);
                const imgSize = pageHeight / 1.8;
                const imgX = (pageWidth - imgSize) / 2;
                const imgY = 15;

                doc.setFillColor(0, 0, 0, 0.1);
                doc.rect(imgX + 2, imgY + 2, imgSize, imgSize, 'F');
                doc.addImage(pageImgBase64, 'JPEG', imgX, imgY, imgSize, imgSize);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(18);
                doc.setTextColor(0, 0, 0);

                const textY = imgY + imgSize + 20;
                const textWidth = pageWidth - 60;
                const textX = pageWidth / 2;
                const splitText = doc.splitTextToSize(data.story[i], textWidth);
                doc.text(splitText, textX, textY, { align: 'center' });

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text(`${i + 1}`, pageWidth - 25, pageHeight - 20, { align: 'center', baseline: 'middle' });
            }

            if (data.endPageImageUrl) {
                doc.addPage();
                doc.setFillColor(255, 255, 230);
                doc.rect(0, 0, pageWidth, pageHeight, 'F');
                doc.setDrawColor(255, 182, 193);
                doc.setLineWidth(1);
                doc.rect(5, 5, pageWidth - 10, pageHeight - 10, 'S');

                const endImgBase64 = await fetchImageAsBase64(data.endPageImageUrl);
                const endImgSize = pageHeight / 2;
                const endImgX = (pageWidth - endImgSize) / 2;
                const endImgY = 20;

                doc.setFillColor(0, 0, 0, 0.1);
                doc.rect(endImgX + 2, endImgY + 2, endImgSize, endImgSize, 'F');
                doc.addImage(endImgBase64, 'JPEG', endImgX, endImgY, endImgSize, endImgSize);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(24);
                doc.text('Made with Lots of Love by Vivek', pageWidth / 2, endImgY + endImgSize + 30, { align: 'center' });

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(12);
                doc.setTextColor(255, 182, 193);
                doc.text('*', 15, 15);
                doc.text('*', pageWidth - 15, 15);
                doc.text('+', 15, pageHeight - 15);
            }

            doc.save(`${data.title.replace(/ /g, '_')}.pdf`);
            setStatus('PDF ready! Check your downloads for the finished book.', 'success');
        } catch (error) {
            console.error('Error creating PDF:', error);
            setStatus('Failed to create the PDF. Please try again.', 'error');
        }
    }

    generateBtn?.addEventListener('click', async () => {
        const prompt = storyPromptInput?.value.trim() || '';
        const gradeLevel = document.getElementById('grade-level').value;
        const language = document.getElementById('language').value;
        const artStyle = artStyleSelect?.value || 'Studio Ghibli';
        const imageModel = imageModelSelect.value;

        if (!prompt) {
            setStatus('Please describe your story idea before generating.', 'error');
            return;
        }

        if (!adultConfirmation?.checked) {
            setStatus('Please confirm you are an adult supervising this experience for kids.', 'error');
            adultConfirmation?.focus();
            return;
        }

        if (!imageModel) {
            setStatus('Please wait for image models to load.', 'error');
            return;
        }

        toggleDownloadButtons(false);
        setFormDisabled(true);
        loadingDiv?.classList.remove('hidden');
        storyBookDiv.classList.add('hidden');
        currentBookData = null;

        startProgressAnimation();

        try {
            const response = await fetchWithFallback('/story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, gradeLevel, language, artStyle, imageModel })
            });

            if (!response.ok) {
                let message = 'Failed to generate the book.';
                try {
                    const errorData = await response.json();
                    if (errorData?.error) message = errorData.error;
                    else if (errorData?.details) message = errorData.details;
                } catch (err) {
                    console.warn('Failed to parse story error response', err);
                    if (response.statusText) message = response.statusText;
                }
                throw new Error(message);
            }

            currentBookData = await response.json();
            renderStoryBook(currentBookData);
            stopProgressAnimation(true);
            toggleDownloadButtons(true);
            setStatus('Your illustrated adventure is ready! Download PDF or interactive HTML book!', 'success');
        } catch (error) {
            console.error('Error generating story:', error);
            stopProgressAnimation(false);
            setStatus(`We hit a snag: ${error.message}`, 'error');
        } finally {
            loadingDiv?.classList.add('hidden');
            setFormDisabled(false);
        }
    });

    async function createInteractiveHTML(data) {
        if (!data) {
            setStatus('Please generate a story before downloading the HTML book.', 'error');
            return;
        }

        setStatus('Creating your interactive HTML book...', 'info');

        // Convert all images to base64
        const coverImageBase64 = await fetchImageAsBase64(data.coverImageUrl);
        const pageImagesBase64 = await Promise.all(data.pageImageUrls.map(url => fetchImageAsBase64(url)));
        const endImageBase64 = data.endPageImageUrl ? await fetchImageAsBase64(data.endPageImageUrl) : null;

        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title} - Interactive Storybook</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;700&family=Quicksand:wght@400;600;700&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: 'Quicksand', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .book-container {
            max-width: 900px;
            width: 100%;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }
        
        .book-header {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .book-header h1 {
            font-family: 'Comfortaa', cursive;
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .book-header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .page-display {
            position: relative;
            min-height: 600px;
            display: flex;
            flex-direction: column;
        }
        
        .page {
            display: none;
            flex-direction: column;
            padding: 40px;
            animation: fadeIn 0.5s ease-in;
        }
        
        .page.active {
            display: flex;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .page-image {
            width: 100%;
            max-height: 400px;
            object-fit: contain;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
            margin-bottom: 30px;
        }
        
        .page-text {
            font-size: 1.25rem;
            line-height: 1.8;
            color: #333;
            text-align: center;
            padding: 0 20px;
        }
        
        .page-number {
            text-align: center;
            color: #999;
            font-size: 0.9rem;
            margin-top: 20px;
            font-weight: 600;
        }
        
        .navigation {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 30px;
            background: #f8f9fa;
            border-top: 2px solid #e9ecef;
        }
        
        .nav-btn {
            padding: 12px 30px;
            font-size: 1rem;
            font-weight: 600;
            border: none;
            border-radius: 50px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-family: 'Quicksand', sans-serif;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        
        .nav-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }
        
        .nav-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .progress-bar {
            flex: 1;
            margin: 0 30px;
            height: 8px;
            background: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transition: width 0.3s ease;
            border-radius: 10px;
        }
        
        .end-page {
            text-align: center;
            padding: 60px 40px;
        }
        
        .end-page h2 {
            font-family: 'Comfortaa', cursive;
            font-size: 3rem;
            color: #667eea;
            margin-bottom: 20px;
        }
        
        @media (max-width: 768px) {
            .book-header h1 { font-size: 1.8rem; }
            .page { padding: 20px; }
            .page-text { font-size: 1.1rem; }
            .navigation { flex-direction: column; gap: 15px; }
            .progress-bar { margin: 0; width: 100%; }
        }
    </style>
</head>
<body>
    <div class="book-container">
        <div class="book-header">
            <h1>${data.title}</h1>
            <p>An interactive storybook adventure</p>
        </div>
        
        <div class="page-display">
            <div class="page active" data-page="0">
                <img src="${coverImageBase64}" alt="Book Cover" class="page-image">
                <div class="page-text">
                    <h2 style="font-family: 'Comfortaa', cursive; font-size: 2rem; color: #667eea;">${data.title}</h2>
                </div>
                <div class="page-number">Cover</div>
            </div>
            
            ${data.story.map((text, index) => `
            <div class="page" data-page="${index + 1}">
                <img src="${pageImagesBase64[index]}" alt="Page ${index + 1}" class="page-image">
                <div class="page-text">${text}</div>
                <div class="page-number">Page ${index + 1} of ${data.story.length}</div>
            </div>
            `).join('')}
            
            ${endImageBase64 ? `
            <div class="page" data-page="${data.story.length + 1}">
                <div class="end-page">
                    <img src="${endImageBase64}" alt="The End" class="page-image">
                    <h2>The End</h2>
                    <p style="font-size: 1.2rem; color: #666; margin-top: 10px;">Thank you for reading!</p>
                </div>
                <div class="page-number">The End</div>
            </div>
            ` : ''}
        </div>
        
        <div class="navigation">
            <button class="nav-btn" id="prev-btn" onclick="previousPage()">← Previous</button>
            <div class="progress-bar">
                <div class="progress-fill" id="progress-fill"></div>
            </div>
            <button class="nav-btn" id="next-btn" onclick="nextPage()">Next →</button>
        </div>
    </div>
    
    <script>
        let currentPage = 0;
        const totalPages = ${endImageBase64 ? data.story.length + 2 : data.story.length + 1};
        
        function updatePage() {
            document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
            document.querySelector(\`[data-page="\${currentPage}"]\`).classList.add('active');
            
            document.getElementById('prev-btn').disabled = currentPage === 0;
            document.getElementById('next-btn').disabled = currentPage === totalPages - 1;
            
            const progress = (currentPage / (totalPages - 1)) * 100;
            document.getElementById('progress-fill').style.width = progress + '%';
        }
        
        function nextPage() {
            if (currentPage < totalPages - 1) {
                currentPage++;
                updatePage();
            }
        }
        
        function previousPage() {
            if (currentPage > 0) {
                currentPage--;
                updatePage();
            }
        }
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') nextPage();
            if (e.key === 'ArrowLeft') previousPage();
        });
        
        updatePage();
    </script>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.title.replace(/ /g, '_')}_Interactive.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setStatus('Interactive HTML book downloaded! Open it in any browser.', 'success');
    }

    function toggleDownloadButtons(show) {
        const method = show ? 'remove' : 'add';
        downloadPdfBtnMain?.classList[method]('hidden');
        downloadPdfBtnTop?.classList[method]('hidden');
        document.getElementById('download-html-btn')?.classList[method]('hidden');
        document.getElementById('download-html-btn-top')?.classList[method]('hidden');
        
        if (downloadPdfBtnMain) downloadPdfBtnMain.disabled = !show;
        if (downloadPdfBtnTop) downloadPdfBtnTop.disabled = !show;
        const htmlBtn = document.getElementById('download-html-btn');
        const htmlBtnTop = document.getElementById('download-html-btn-top');
        if (htmlBtn) htmlBtn.disabled = !show;
        if (htmlBtnTop) htmlBtnTop.disabled = !show;
    }

    const handleDownloadPdfClick = () => {
        if (!currentBookData) {
            setStatus('Generate a story before downloading the PDF.', 'error');
            return;
        }
        createPdf(currentBookData);
    };

    const handleDownloadHtmlClick = () => {
        if (!currentBookData) {
            setStatus('Generate a story before downloading the HTML book.', 'error');
            return;
        }
        createInteractiveHTML(currentBookData);
    };

    downloadPdfBtnMain?.addEventListener('click', handleDownloadPdfClick);
    downloadPdfBtnTop?.addEventListener('click', handleDownloadPdfClick);
    
    document.getElementById('download-html-btn')?.addEventListener('click', handleDownloadHtmlClick);
    document.getElementById('download-html-btn-top')?.addEventListener('click', handleDownloadHtmlClick);

    populateModels();
});
