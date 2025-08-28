"use strict";

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM ELEMENT REFERENCES ---
    const canvas = document.getElementById('image-canvas');
    const ctx = canvas.getContext('2d');
    const imageLoader = document.getElementById('image-loader');
    const uploadPromptContainer = document.querySelector('.preview-area > div'); // The div that holds the prompt
    const toolsPanel = document.querySelector('.tools-panel');

    // Action Buttons
    const saveBtn = document.getElementById('save-btn');
    const shareBtn = document.getElementById('share-btn');
    const footerNote = document.getElementById('footer-note');

    // Inputs
    const outputWidthCheckbox = document.getElementById('enableOutputWidth');
    const outputWidthInput = document.getElementById('outputWidth');

    // --- STATE MANAGEMENT ---
    let originalImage = null;
    const state = {
        borderSize: 0,
        borderColor: '#FFFFFF',
        aspectRatio: 'original',
        quality: 92,
        sharpen: 0,
        brightness: 100,
        contrast: 100,
        saturate: 100,
        grayscale: 0,
        sepia: 0,
        outputWidth: null,
    };
    // A clean copy of the default state for resetting
    const defaultState = JSON.parse(JSON.stringify(state));

    // --- CORE RENDERING FUNCTION ---
    function renderImage() {
        if (!originalImage) return;

        // 1. Get original image dimensions
        const imgWidth = originalImage.naturalWidth;
        const imgHeight = originalImage.naturalHeight;

        // 2. Determine the target aspect ratio
        const targetRatio = state.aspectRatio === 'original' ? 
                            imgWidth / imgHeight : 
                            eval(state.aspectRatio);

        // 3. Calculate padded dimensions to fit the aspect ratio (letterboxing/pillarboxing)
        let paddedWidth, paddedHeight;
        const imgRatio = imgWidth / imgHeight;

        if (targetRatio > imgRatio) { // Target is wider than image (add padding on sides)
            paddedHeight = imgHeight;
            paddedWidth = paddedHeight * targetRatio;
        } else { // Target is taller than image (add padding on top/bottom)
            paddedWidth = imgWidth;
            paddedHeight = paddedWidth / targetRatio;
        }

        // 4. Calculate the additional border from the slider
        const shortestSide = Math.min(paddedWidth, paddedHeight);
        const borderPixels = shortestSide * (state.borderSize / 100);

        // 5. Set the final canvas size
        canvas.width = paddedWidth + borderPixels * 2;
        canvas.height = paddedHeight + borderPixels * 2;
        
        // 6. Fill the entire canvas with the border color
        ctx.fillStyle = state.borderColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 7. Apply all filters
        const filterString = `
            brightness(${state.brightness}%) 
            contrast(${state.contrast}%) 
            saturate(${state.saturate}%)
            grayscale(${state.grayscale}%)
            sepia(${state.sepia}%)
        `.trim();
        ctx.filter = filterString;

        // 8. Draw the original image centered inside the final canvas
        const drawX = (canvas.width - imgWidth) / 2;
        const drawY = (canvas.height - imgHeight) / 2;
        ctx.drawImage(originalImage, drawX, drawY);
        
        // 9. Apply sharpening (if needed)
        if (state.sharpen > 0) {
            applySharpening(state.sharpen);
        }
        
        ctx.filter = 'none'; // Reset filter
    }

    // --- HELPER FUNCTIONS ---
    function applySharpening(amount) {
        const w = canvas.width;
        const h = canvas.height;
        const imgData = ctx.getImageData(0, 0, w, h);
        const pixels = imgData.data;
        const src = new Uint8ClampedArray(pixels);
        const kernel = [ [0, -1, 0], [-1, 5, -1], [0, -1, 0] ];
        
        for (let i = 0; i < pixels.length; i += 4) {
            const x = (i / 4) % w;
            const y = Math.floor((i / 4) / w);
            if (x === 0 || x === w - 1 || y === 0 || y === h - 1) continue;

            let r = 0, g = 0, b = 0;
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = ((y + ky) * w + (x + kx)) * 4;
                    const weight = kernel[ky + 1][kx + 1];
                    r += src[idx] * weight;
                    g += src[idx + 1] * weight;
                    b += src[idx + 2] * weight;
                }
            }
            pixels[i]     = src[i] + (r - src[i]) * amount;
            pixels[i + 1] = src[i+1] + (g - src[i+1]) * amount;
            pixels[i + 2] = src[i+2] + (b - src[i+2]) * amount;
        }
        ctx.putImageData(imgData, 0, 0);
    }

// DELETE your old resetAll function and REPLACE it with these two:

    function resetStateAndUI() {
        if (!originalImage) return;
        
        // 1. Reset the state object to its default values
        Object.assign(state, defaultState);

        // 2. Update all UI controls to match the reset state
        document.querySelectorAll('input[type="range"]').forEach(el => {
            el.value = state[el.id] || defaultState[el.id];
            const display = document.getElementById(`${el.id}-value-display`);
            if (display) display.textContent = `${el.value}%`;
        });

        document.querySelector('#sharpen-btns .active')?.classList.remove('active');
        document.querySelector('#sharpen-btns button[data-value="0"]').classList.add('active');
        
        document.querySelector('#aspect-ratio-btns .active')?.classList.remove('active');
        document.querySelector('#aspect-ratio-btns button[data-ratio="original"]').classList.add('active');
        
        outputWidthCheckbox.checked = false;
        outputWidthInput.value = '';
        outputWidthInput.disabled = true;

        // Also update the color picker's UI
        if (window.pickr) {
            pickr.setColor(defaultState.borderColor);
        }
    }

    function resetAll() {
        if (!originalImage) return;
        resetStateAndUI();
        renderImage();
    }

    // --- EVENT HANDLING ---
    function setupEventListeners() {
        // Image Loading (Label and Drag & Drop)
        imageLoader.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleImageUpload(e.target.files[0]);
            }
            e.target.value = null; // Reset input to allow re-uploading the same file
        });
        document.body.addEventListener('dragover', (e) => e.preventDefault());
        document.body.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleImageUpload(e.dataTransfer.files[0]);
            }
        });

        // Initialize Color Picker
        const pickr = Pickr.create({
            el: '.color-picker-container',
            theme: 'classic',
            default: state.borderColor,
            root: { container: 'body' },
            components: {
                preview: true, opacity: false, hue: true,
                interaction: { hex: true, input: true, save: true }
            }
        });
        pickr.on('change', (color) => {
            state.borderColor = color.toHEXA().toString();
            renderImage();
        }).on('save', () => pickr.hide());
        
        // Tool Panel Interactions (Sliders and Buttons)
        toolsPanel.addEventListener('input', (e) => {
            if (!originalImage || !e.target.id) return;
            const { id, value } = e.target;
            if (id === 'outputWidth') {
                state.outputWidth = value ? parseInt(value) : null;
            } else if (state.hasOwnProperty(id)) {
                state[id] = parseFloat(value);
                const display = document.getElementById(`${id}-value-display`);
                if (display) display.textContent = `${value}%`;
                renderImage();
            }
        });

        toolsPanel.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!originalImage || !button) return;

            if (button.dataset.ratio || button.dataset.value) {
                const parentGroup = button.parentElement;
                parentGroup.querySelector('.active')?.classList.remove('active');
                button.classList.add('active');
                if (button.dataset.ratio) state.aspectRatio = button.dataset.ratio;
                if (button.dataset.value) state.sharpen = parseFloat(button.dataset.value);
            } else if (button.dataset.color) {
                state.borderColor = button.dataset.color;
                pickr.setColor(state.borderColor); // Sync picker with preset
            }
            renderImage();
        });

        // Other Listeners
        outputWidthCheckbox.addEventListener('change', () => {
            outputWidthInput.disabled = !outputWidthCheckbox.checked;
            if (!outputWidthCheckbox.checked) {
                state.outputWidth = null;
                outputWidthInput.value = '';
            }
        });

        saveBtn.addEventListener('click', downloadImage);
        shareBtn.addEventListener('click', shareImage);
        document.getElementById('theme-switcher').addEventListener('click', () => {
            document.documentElement.classList.toggle('dark-theme');
            document.documentElement.classList.toggle('light-theme');
        });
    }

    // REPLACE IT WITH THIS FINAL VERSION
    function handleImageUpload(file) {
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            originalImage = new Image();
            originalImage.onload = () => {
                // Step 1: Update the page layout
                uploadPromptContainer.style.display = 'none';
                canvas.style.display = 'block';
                updateUIState(true);

                // Step 2: Reset the application state and all UI controls
                resetStateAndUI();

                // Step 3: Schedule the first image render for the next browser frame
                requestAnimationFrame(renderImage);
            };
            originalImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    // --- EXPORT & UI STATE FUNCTIONS ---
    function getFinalCanvas() {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const useResize = state.outputWidth && state.outputWidth < w;

        if (useResize) {
            const newHeight = h * (state.outputWidth / w);
            tempCanvas.width = state.outputWidth;
            tempCanvas.height = newHeight;
            tempCtx.drawImage(canvas, 0, 0, state.outputWidth, newHeight);
        } else {
            tempCanvas.width = w;
            tempCanvas.height = h;
            tempCtx.drawImage(canvas, 0, 0);
        }
        return tempCanvas;
    }

    function downloadImage() {
        if (!originalImage) return;
        const finalCanvas = getFinalCanvas();
        const link = document.createElement('a');
        link.download = `edited-${Date.now()}.jpg`;
        link.href = finalCanvas.toDataURL('image/jpeg', state.quality / 100);
        link.click();
    }
    
    async function shareImage() {
        if (!originalImage || !navigator.share) return;
        const finalCanvas = getFinalCanvas();
        finalCanvas.toBlob(async (blob) => {
            const file = new File([blob], 'edited-image.jpg', { type: 'image/jpeg' });
            try {
                await navigator.share({ files: [file], title: 'Image edited with QuickEdit Studio' });
            } catch (err) { console.error('Share failed:', err.message); }
        }, 'image/jpeg', state.quality / 100);
    }
    
    function updateUIState(isImageLoaded) {
        saveBtn.disabled = !isImageLoaded;
        shareBtn.disabled = !isImageLoaded;
        footerNote.style.display = isImageLoaded ? 'none' : 'block';
    }

    // --- INITIALIZATION ---
    setupEventListeners();
    updateUIState(false);
});
