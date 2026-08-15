document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');
    const previewContainer = document.getElementById('preview-container');
    const imagePreview = document.getElementById('image-preview');
    
    const charsetSelect = document.getElementById('charset-select');
    const customCharset = document.getElementById('custom-charset');
    const widthSlider = document.getElementById('width-slider');
    const widthValue = document.getElementById('width-value');
    const thresholdSlider = document.getElementById('threshold-slider');
    const thresholdValue = document.getElementById('threshold-value');
    const renderModeRadios = document.querySelectorAll('input[name="render-mode"]');
    const transparentMode = document.getElementById('transparent-mode');
    
    const asciiOutput = document.getElementById('ascii-output');
    const hiddenCanvas = document.getElementById('hidden-canvas');
    const ctx = hiddenCanvas.getContext('2d');
    
    const btnCopy = document.getElementById('btn-copy');
    const copyText = document.getElementById('copy-text');
    const btnDownload = document.getElementById('btn-download');

    let currentImage = null;

    const charsets = {
        standard: "@#S%?*+;:,. ",
        block: "\u2588\u2593\u2592\u2591 ",
        minimal: ".:-=+*#%@ ",
        detailed: "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ",
        dot: ".*o0O@ "
    };

    function init() {
        setupEventListeners();
    }

    function setupEventListeners() {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFile(e.dataTransfer.files[0]);
            }
        });

        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        dropZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInput.click();
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
            }
        });

        charsetSelect.addEventListener('change', () => {
            if (charsetSelect.value === 'custom') {
                customCharset.classList.remove('hidden');
            } else {
                customCharset.classList.add('hidden');
            }
            updateAscii();
        });

        customCharset.addEventListener('input', updateAscii);

        widthSlider.addEventListener('input', () => {
            widthValue.textContent = widthSlider.value;
            updateAscii();
        });

        thresholdSlider.addEventListener('input', () => {
            thresholdValue.textContent = thresholdSlider.value;
            updateAscii();
        });

        renderModeRadios.forEach(radio => {
            radio.addEventListener('change', updateAscii);
        });

        transparentMode.addEventListener('change', updateAscii);

        btnCopy.addEventListener('click', copyToClipboard);
        btnDownload.addEventListener('click', downloadAscii);
    }

    function handleFile(file) {
        if (!file.type.startsWith('image/')) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                currentImage = img;
                imagePreview.src = e.target.result;
                previewContainer.style.display = 'block';
                updateAscii();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function getSelectedCharset() {
        let chars = "";
        if (charsetSelect.value === 'custom') {
            chars = customCharset.value;
            if (chars.length === 0) chars = " ";
        } else {
            chars = charsets[charsetSelect.value];
        }
        return chars;
    }

    function updateAscii() {
        if (!currentImage) return;

        const targetWidth = parseInt(widthSlider.value, 10);
        const threshold = parseInt(thresholdSlider.value, 10);
        const renderMode = document.querySelector('input[name="render-mode"]:checked').value;
        const isTransparent = transparentMode.checked;
        const charset = getSelectedCharset();

        // Adjust height for character aspect ratio (~0.5)
        const charAspectRatio = 0.5;
        const aspectRatio = currentImage.height / currentImage.width;
        const targetHeight = Math.floor(targetWidth * aspectRatio * charAspectRatio);

        hiddenCanvas.width = targetWidth;
        hiddenCanvas.height = targetHeight;
        ctx.drawImage(currentImage, 0, 0, targetWidth, targetHeight);

        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const data = imageData.data;
        
        let asciiStr = "";

        for (let y = 0; y < targetHeight; y++) {
            let row = "";
            for (let x = 0; x < targetWidth; x++) {
                const idx = (y * targetWidth + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                
                const grayscale = 0.299 * r + 0.587 * g + 0.114 * b;
                
                let isCharacter = false;
                if (renderMode === 'black') {
                    isCharacter = grayscale < threshold;
                } else {
                    isCharacter = grayscale >= threshold;
                }

                if (isCharacter) {
                    let charIdx = 0;
                    if (renderMode === 'black') {
                        // Darker = denser (lower grayscale = earlier in charset)
                        const ratio = Math.max(0, Math.min(1, grayscale / threshold));
                        charIdx = Math.floor(ratio * (charset.length - 1));
                    } else {
                        // Lighter = denser (higher grayscale = earlier in charset)
                        const range = 255 - threshold;
                        const ratio = range > 0 ? (255 - grayscale) / range : 0;
                        charIdx = Math.floor(Math.max(0, Math.min(1, ratio)) * (charset.length - 1));
                    }
                    row += charset[charIdx] || charset[charset.length - 1];
                } else {
                    row += isTransparent ? "" : " ";
                }
            }
            asciiStr += row + "\n";
        }

        asciiOutput.textContent = asciiStr;
        
        // Auto-scale font size
        const containerWidth = document.querySelector('.output-content').clientWidth - 48; // padding
        const estimatedCharWidth = 4.8; // approx width at 8px
        const maxFontSize = 12;
        const minFontSize = 4;
        
        let calculatedSize = Math.floor(containerWidth / targetWidth / 0.6);
        calculatedSize = Math.max(minFontSize, Math.min(maxFontSize, calculatedSize));
        asciiOutput.style.fontSize = `${calculatedSize}px`;
    }

    function copyToClipboard() {
        const text = asciiOutput.textContent;
        if (!text) return;
        
        navigator.clipboard.writeText(text).then(() => {
            copyText.textContent = "Copied!";
            setTimeout(() => {
                copyText.textContent = "Copy";
            }, 2000);
        });
    }

    function downloadAscii() {
        const text = asciiOutput.textContent;
        if (!text) return;

        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ascii-art.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    init();
});
