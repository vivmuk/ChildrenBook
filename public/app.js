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
    const textModelSelect = document.getElementById('text-model');
    const imageModelSelect = document.getElementById('image-model');
    const storyPromptInput = document.getElementById('story-prompt');
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

    const progressMessages = [
        { index: 0, message: 'Weaving the perfect story arc…' },
        { index: 1, message: 'Designing a lovable main character…' },
        { index: 2, message: 'Painting colourful scenes for each page…' },
        { index: 3, message: 'Adding the finishing touches to your book…' }
    ];

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

    function toggleDownloadButtons(show) {
        const method = show ? 'remove' : 'add';
        downloadPdfBtnMain?.classList[method]('hidden');
        downloadPdfBtnTop?.classList[method]('hidden');
        if (downloadPdfBtnMain) downloadPdfBtnMain.disabled = !show;
        if (downloadPdfBtnTop) downloadPdfBtnTop.disabled = !show;
    }

    function setFormDisabled(disabled) {
        if (!storyForm) return;
        const controls = storyForm.querySelectorAll('textarea, select, button');
        controls.forEach(control => {
            if (control === downloadPdfBtnMain) return;
            control.disabled = disabled;
        });
        storyForm.classList.toggle('is-disabled', disabled);
    }

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
        if (loadingText) {
            loadingText.textContent = 'Weaving words and illustrations together…';
        }
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
        try {
            setStatus('Fetching the latest Venice.ai models…', 'info');
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

            const { textModels, imageModels } = await response.json();

            textModelSelect.innerHTML = '';
            if (Array.isArray(textModels) && textModels.length > 0) {
                textModels.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.id;
                    if (model.id === 'mistral-31-24b') option.selected = true;
                    textModelSelect.appendChild(option);
                });
            } else {
                textModelSelect.innerHTML = '<option value="">No text models found</option>';
            }

            imageModelSelect.innerHTML = '';
            if (Array.isArray(imageModels) && imageModels.length > 0) {
                imageModels.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.id;
                    if (model.id === 'venice-sd35') option.selected = true;
                    imageModelSelect.appendChild(option);
                });
            } else {
                imageModelSelect.innerHTML = '<option value="">No image models found</option>';
            }

            setStatus('Models ready! Choose your creative combo to begin.', 'success');
        } catch (error) {
            console.error('Failed to load models:', error);
            textModelSelect.innerHTML = '<option value="">Unable to load models</option>';
            imageModelSelect.innerHTML = '<option value="">Unable to load models</option>';
            setStatus(`We could not reach the Venice.ai models API: ${error.message}`, 'error');
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
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
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
        const artStyle = document.getElementById('art-style').value;
        const model = textModelSelect.value;
        const imageModel = imageModelSelect.value;

        if (!prompt) {
            setStatus('Please describe your story idea before generating.', 'error');
            return;
        }

        if (!model || !imageModel) {
            setStatus('Choose both a text model and an image model to continue.', 'error');
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
                body: JSON.stringify({ prompt, gradeLevel, language, artStyle, model, imageModel })
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
            setStatus('Your illustrated adventure is ready! Download it or tweak the prompt for another.', 'success');
        } catch (error) {
            console.error('Error generating story:', error);
            stopProgressAnimation(false);
            setStatus(`We hit a snag: ${error.message}`, 'error');
        } finally {
            loadingDiv?.classList.add('hidden');
            setFormDisabled(false);
        }
    });

    const handleDownloadClick = () => {
        if (!currentBookData) {
            setStatus('Generate a story before downloading the PDF.', 'error');
            return;
        }
        createPdf(currentBookData);
    };

    downloadPdfBtnMain?.addEventListener('click', handleDownloadClick);
    downloadPdfBtnTop?.addEventListener('click', handleDownloadClick);

    populateModels();
});
