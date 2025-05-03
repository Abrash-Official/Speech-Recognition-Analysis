document.addEventListener('DOMContentLoaded', () => {
    const modeBtns = document.querySelectorAll('.mode-btn');
    const fileSection = document.querySelector('.file-upload-section');
    const recordSection = document.querySelector('.recording-section');
    const manualText = document.getElementById('manualText');
    let mediaRecorder;
    let audioChunks = [];

    // Mode selection
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const mode = btn.dataset.mode;
            fileSection.classList.add('hidden');
            recordSection.classList.add('hidden');
            manualText.readOnly = true;
            // Hide image upload section by default
            const imageSection = document.querySelector('.image-upload-section');
            if (imageSection) imageSection.classList.add('hidden');

            switch(mode) {
                case 'microphone':
                    recordSection.classList.remove('hidden');
                    setupMicrophone();
                    break;
                case 'file_upload':
                    fileSection.classList.remove('hidden');
                    break;
                case 'image_upload':
                    if (imageSection) imageSection.classList.remove('hidden');
                    break;
                case 'manual_text':
                    manualText.readOnly = false;
                    manualText.placeholder = 'Start typing recognized text...';
                    break;
            }
        });
    });

    // Microphone setup
    async function setupMicrophone() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            let isRecording = false;
            let recordBtn = document.getElementById('recordButton');
            const micDotLoader = document.getElementById('micDotLoader');

            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

            // Remove previous event listeners if any
            const newRecordBtn = recordBtn.cloneNode(true);
            recordBtn.parentNode.replaceChild(newRecordBtn, recordBtn);
            recordBtn = newRecordBtn; // Update reference to the new button

            mediaRecorder.onstop = async () => {
                // Show loader, disable button
                if (micDotLoader) {
                    micDotLoader.innerHTML = '<span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span>';
                    micDotLoader.style.display = 'flex';
                }
                recordBtn.disabled = true;
                // Always remove 'recording' class and reset icon (default color)
                recordBtn.classList.remove('recording');
                recordBtn.innerHTML = '<i class="fas fa-microphone mic-big-icon"></i>';
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                await processAudio(audioBlob);
                audioChunks = [];
                // Hide loader, enable button
                if (micDotLoader) micDotLoader.style.display = 'none';
                recordBtn.disabled = false;
                isRecording = false;
            };

            recordBtn.addEventListener('click', () => {
                if (!isRecording) {
                    mediaRecorder.start();
                    recordBtn.innerHTML = '<i class="fas fa-microphone mic-big-icon"></i>';
                    recordBtn.classList.add('recording');
                    isRecording = true;
                } else {
                    mediaRecorder.stop();
                    // Loader and disabling handled in onstop
                }
            });
        } catch(err) {
            showError('Microphone access required for recording');
        }
    }

    // File upload handler
    const dragDropArea = document.getElementById('dragDropArea');
    const audioFileInput = document.getElementById('audioFile');
    if (dragDropArea && audioFileInput) {
        // Click opens file dialog
        dragDropArea.addEventListener('click', () => audioFileInput.click());

        // Drag over highlight
        dragDropArea.addEventListener('dragover', e => {
            e.preventDefault();
            dragDropArea.classList.add('dragover');
        });
        dragDropArea.addEventListener('dragleave', e => {
            e.preventDefault();
            dragDropArea.classList.remove('dragover');
        });
        dragDropArea.addEventListener('drop', async e => {
            e.preventDefault();
            dragDropArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) {
                await handleAudioFile(file);
            }
        });
        // File input change
        audioFileInput.addEventListener('change', async e => {
            const file = e.target.files[0];
            if (file) {
                await handleAudioFile(file);
            }
        });
    }

    async function handleAudioFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('mode', 'file_upload');
        formData.append('reference', document.getElementById('referenceText').value);

        // Show dot loader
        const uploadDotLoader = document.getElementById('uploadDotLoader');
        if (uploadDotLoader) {
            uploadDotLoader.innerHTML = '<span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span>';
            uploadDotLoader.style.display = 'flex';
        }
        // Hide drag-drop icon/text while loading
        const dragDropIcon = document.querySelector('#dragDropArea .drag-drop-icon');
        const dragDropText = document.querySelector('#dragDropArea .drag-drop-text');
        if (dragDropIcon) dragDropIcon.style.display = 'none';
        if (dragDropText) dragDropText.style.display = 'none';

        try {
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/transcribe', true);
                xhr.onload = function () {
                    if (xhr.status === 200) {
                        resolve(xhr.responseText);
                    } else {
                        reject(new Error('Upload failed'));
                    }
                };
                xhr.onerror = function () {
                    reject(new Error('Upload error'));
                };
                xhr.send(formData);
            }).then(responseText => {
                handleResponseWithProgress(JSON.parse(responseText), null);
            });
        } catch (err) {
            showError('Error processing audio file');
        } finally {
            // Hide loader, restore drag-drop UI
            if (uploadDotLoader) uploadDotLoader.style.display = 'none';
            if (dragDropIcon) dragDropIcon.style.display = '';
            if (dragDropText) dragDropText.style.display = '';
        }
    }

    // Helper to finish progress bar after recognized text is shown
    function handleResponseWithProgress(data, finishProgressBar) {
        if (data.error) {
            showError(data.error);
            if (finishProgressBar) finishProgressBar();
            return;
        }
        manualText.value = data.hypothesis;
        analyzeText(data.hypothesis, data.reference);
        if (finishProgressBar) finishProgressBar();
    }

    // Analyze button handler
    const calculateBtn = document.getElementById('calculateBtn');
    let hasAnalyzedOnce = false;
    calculateBtn.addEventListener('click', async () => {
        const hypothesis = manualText.value;
        const reference = document.getElementById('referenceText').value;
        if (!hypothesis || !reference) {
            showError('Both reference and recognized text are required');
            return;
        }
        // Show loader and disable button
        calculateBtn.disabled = true;
        const originalText = hasAnalyzedOnce ? '<i class="fas fa-redo"></i> Again Analysis' : '<i class="fas fa-chart-bar"></i> Analyze Now';
        calculateBtn.innerHTML = '<span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span>';
        calculateBtn.style.justifyContent = 'center';
        await analyzeText(hypothesis, reference);
        // After analysis, change button text and re-enable
        hasAnalyzedOnce = true;
        calculateBtn.innerHTML = '<i class="fas fa-redo"></i> Again Analysis';
        calculateBtn.disabled = false;
        calculateBtn.style.justifyContent = '';
    });

    // Audio processing
    async function processAudio(audioBlob) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.wav');
        formData.append('mode', 'microphone');
        formData.append('reference', document.getElementById('referenceText').value);

        try {
            const response = await fetch('/transcribe', { method: 'POST', body: formData });
            handleResponse(await response.json());
        } catch(err) {
            showError('Error processing recording');
        }
    }

    // Handle server response
    function handleResponse(data) {
        if (data.error) {
            showError(data.error);
            return;
        }
        manualText.value = data.hypothesis;
        analyzeText(data.hypothesis, data.reference);
    }

    // Text analysis
    async function analyzeText(hypothesis, reference) {
        try {
            console.log('Analyzing text:', { hypothesis, reference }); // Debug log
            const response = await fetch('/calculate_wer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hypothesis, reference })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const results = await response.json();
            console.log('Analysis results:', results); // Debug log
            
            if (results.error) {
                throw new Error(results.error);
            }
            
            displayResults(results);
        } catch(err) {
            console.error('Analysis error:', err); // Debug log
            showError('Analysis failed. Please try again.');
        }
    }

    // Display results
    function displayResults(data) {
        try {
            const resultsDiv = document.getElementById('results');
            resultsDiv.classList.remove('hidden');
            document.querySelector('.wer-value').textContent = `${(data.wer * 100).toFixed(2)}%`;
            console.log('Substitutions:', data.substitutions);
            console.log('Deletions:', data.deletions);
            console.log('Insertions:', data.insertions);
            populateErrorList('substitution', data.substitutions);
            populateErrorList('deletion', data.deletions);
            populateErrorList('insertion', data.insertions);
            // Show the Detailed Analysis button
            const detailedBtn = document.getElementById('detailedAnalysisBtn');
            if (detailedBtn) detailedBtn.style.display = 'block';
            // Hide the images section until button is clicked again
            const imagesDiv = document.getElementById('detailedAnalysisImages');
            if (imagesDiv) imagesDiv.style.display = 'none';
            // Render text difference using backend merge, always using current textarea values
            const textDiffDiv = document.getElementById('textDifference');
            if (textDiffDiv) {
                const referenceText = document.getElementById('referenceText').value.trim();
                const hypothesisText = document.getElementById('manualText').value.trim();
                fetch('/merge_texts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reference: referenceText,
                        hypothesis: hypothesisText
                    })
                })
                .then(res => res.json())
                .then(result => {
                    const refWords = referenceText.split(/\s+/);
                    const hypWords = hypothesisText.split(/\s+/);
                    let i = 0, j = 0;
                    let html = '';
                    while (i < refWords.length || j < hypWords.length) {
                        if (i < refWords.length && j < hypWords.length && refWords[i] === hypWords[j]) {
                            html += refWords[i] + ' ';
                            i++; j++;
                        } else if (i < refWords.length && j < hypWords.length && refWords[i] !== hypWords[j]) {
                            // Substitution: show ref as yellow+strike, hyp as yellow
                            html += `<span class=\"diff-substitution diff-strike\">${refWords[i]}</span> <span class=\"diff-substitution\">${hypWords[j]}</span> `;
                            i++; j++;
                        } else if (i < refWords.length) {
                            // Deletion: show ref as red
                            html += `<span class=\"diff-deletion\">${refWords[i]}</span> `;
                            i++;
                        } else if (j < hypWords.length) {
                            // Insertion: show hyp as green highlight + line-through
                            html += `<span class=\"diff-insertion diff-strike\">${hypWords[j]}</span> `;
                            j++;
                        }
                    }
                    textDiffDiv.innerHTML = html.trim();
                });
            }
        } catch(err) {
            console.error('Display results error:', err); // Debug log
            showError('Error displaying results');
        }
    }

    // Populate error cards
    function populateErrorList(type, items) {
        const list = document.querySelector(`.${type}-card .error-list`);
        list.innerHTML = items.length ? 
            items.map(item => `<li>${item}</li>`).join('') : 
            '<li class="no-errors">No errors found</li>';
    }

    // Error notification
    function showError(message) {
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        setTimeout(() => errorDiv.classList.add('hidden'), 5000);
    }

    // Detailed Analysis Button Handler
    const detailedBtn = document.getElementById('detailedAnalysisBtn');
    const againBtn = document.getElementById('againAnalysisBtn');
    const detailedDotLoader = document.getElementById('detailedDotLoader');
    if (detailedBtn) {
        detailedBtn.addEventListener('click', async function() {
            const container = document.getElementById('detailedAnalysisImages');
            const downloadBtn = document.getElementById('downloadReportBtn');
            // Toggle visibility
            if (container.style.display === 'block') {
                container.style.display = 'none';
                if (downloadBtn) downloadBtn.style.display = 'none';
                if (againBtn) againBtn.style.display = 'none';
                detailedBtn.innerHTML = '<i class="fas fa-chart-bar"></i> Detailed Analysis';
                return;
            }
            // If not loaded yet, fetch and show
            if (!container.innerHTML.trim()) {
                const reference = document.getElementById('referenceText').value.trim();
                const hypothesis = document.getElementById('manualText').value.trim();
                if (!reference || !hypothesis) {
                    showError('Both reference and recognized text are required for detailed analysis');
                    return;
                }
                // Show dot loader, hide button
                if (detailedBtn) detailedBtn.style.display = 'none';
                if (detailedDotLoader) {
                    detailedDotLoader.innerHTML = '<span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span>';
                    detailedDotLoader.style.display = 'flex';
                }
                try {
                    await runDetailedAnalysis();
                } catch (err) {
                    showError('Failed to load detailed analysis.');
                    return;
                } finally {
                    if (detailedDotLoader) detailedDotLoader.style.display = 'none';
                    if (detailedBtn) detailedBtn.style.display = 'flex';
                    if (againBtn) againBtn.style.display = 'flex';
                }
            }
            container.style.display = 'block';
            if (downloadBtn) downloadBtn.style.display = 'block';
            if (againBtn) againBtn.style.display = 'flex';
            container.scrollIntoView({ behavior: 'smooth' });
            detailedBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Detailed Analysis';
        });
    }
    // Again Analysis button handler
    if (againBtn) {
        againBtn.addEventListener('click', async function() {
            const container = document.getElementById('detailedAnalysisImages');
            const downloadBtn = document.getElementById('downloadReportBtn');
            const reference = document.getElementById('referenceText').value.trim();
            const hypothesis = document.getElementById('manualText').value.trim();
            if (!reference || !hypothesis) {
                showError('Both reference and recognized text are required for detailed analysis');
                return;
            }
            // Show dot loader
            if (detailedDotLoader) {
                detailedDotLoader.innerHTML = '<span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span>';
                detailedDotLoader.style.display = 'flex';
            }
            try {
                await runDetailedAnalysis();
            } catch (err) {
                showError('Failed to load detailed analysis.');
                return;
            } finally {
                if (detailedDotLoader) detailedDotLoader.style.display = 'none';
                if (againBtn) againBtn.style.display = 'flex';
            }
            container.style.display = 'block';
            if (downloadBtn) downloadBtn.style.display = 'block';
            container.scrollIntoView({ behavior: 'smooth' });
        });
    }
    // Helper to run detailed analysis fetch and update graphs
    async function runDetailedAnalysis() {
        const container = document.getElementById('detailedAnalysisImages');
        const reference = document.getElementById('referenceText').value.trim();
        const hypothesis = document.getElementById('manualText').value.trim();
        const response = await fetch('/detailed_analysis_images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference, hypothesis })
        });
        const data = await response.json();
        // Modern grid layout: all graphs in a responsive grid, two per row
        const graphTitles = [
            '<i class="fas fa-th"></i> Confusion Matrix',
            '<i class="fas fa-table"></i> Confusion Matrix Table',
            '<i class="fas fa-chart-pie"></i> Error Distribution',
            '<i class="fas fa-chart-line"></i> Linear Regression: Reference vs Hypothesis Word Positions',
            '<i class="fas fa-chart-bar"></i> Top 10 Word Frequency: Reference vs Hypothesis'
        ];
        let html = '<div class="analysis-graphs-grid-fixed">';
        // 1st row: Confusion Matrix + Table
        html += `<div class="graph-card">
            <div class="graph-title">${graphTitles[0]}</div>
            <img src="data:image/png;base64,${data.images[0]}" style="max-width:100%;margin:0.5rem 0;"/>
        </div>`;
        let tableHtml = data.cm_table
            .replace(/<td>TP<\/td>/g, '<td class="tp-cell">TP</td>')
            .replace(/<td>FP<\/td>/g, '<td class="fp-cell">FP</td>')
            .replace(/<td>FN<\/td>/g, '<td class="fn-cell">FN</td>');
        html += `<div class="graph-card matrix-table-flex-card">
            <div class="graph-title">${graphTitles[1]}</div>
            <div class="matrix-table-flex-container">
                ${tableHtml}
            </div>
        </div>`;
        // 2nd row: Error Distribution + Linear Regression
        html += `<div class="graph-card">
            <div class="graph-title">${graphTitles[2]}</div>
            <img src="data:image/png;base64,${data.images[1]}" style="max-width:100%;margin:0.5rem 0;"/>
        </div>`;
        html += `<div class="graph-card">
            <div class="graph-title">${graphTitles[3]}</div>
            <img src="data:image/png;base64,${data.images[3]}" style="max-width:100%;margin:0.5rem 0;"/>
        </div>`;
        // 3rd row: Merged Frequency Graph (full width)
        html += `<div class=\"graph-card\" style=\"grid-column: span 2; min-width:600px; max-width:1200px; width:100%;\">
            <div class=\"graph-title\">${graphTitles[4]}</div>
            <img src=\"data:image/png;base64,${data.images[2]}\" style=\"width:100%;max-width:1200px;margin:0.5rem 0;\"/>
        </div>`;
        html += '</div>';
        container.innerHTML = html;
    }

    // --- Download Report Button Handler ---
    const downloadBtn = document.getElementById('downloadReportBtn');
    // Add a loader for download
    let downloadLoader = document.createElement('div');
    downloadLoader.className = 'dot-loader';
    downloadLoader.id = 'downloadDotLoader';
    downloadLoader.style.display = 'none';
    downloadLoader.style.marginLeft = '1rem';
    if (downloadBtn && !downloadBtn.nextSibling) {
        downloadBtn.parentNode.appendChild(downloadLoader);
    } else if (downloadBtn && downloadBtn.nextSibling && downloadBtn.nextSibling.id !== 'downloadDotLoader') {
        downloadBtn.parentNode.insertBefore(downloadLoader, downloadBtn.nextSibling);
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', async function() {
            // Show loader, disable button
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '<span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span>';
            downloadBtn.style.justifyContent = 'center';
            downloadLoader.innerHTML = '<span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span>';
            downloadLoader.style.display = 'flex';

            try {
                // Get current reference, hypothesis, images, cm_table
                const reference = document.getElementById('referenceText').value.trim();
                const hypothesis = document.getElementById('manualText').value.trim();
                // Get images and cm_table from last detailed analysis fetch
                // We'll fetch them again to ensure up-to-date
                const response = await fetch('/detailed_analysis_images', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reference, hypothesis })
                });
                const data = await response.json();
                // Now send to /download_report
                const reportResponse = await fetch('/download_report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reference,
                        hypothesis,
                        images: data.images,
                        cm_table: data.cm_table
                    })
                });
                if (!reportResponse.ok) throw new Error('Failed to generate report');
                // Download the PDF
                const blob = await reportResponse.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'SpeechWER_Report.pdf';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                }, 100);
            } catch (err) {
                showError('Failed to download report.');
            } finally {
                // Hide loader, restore button
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = '<i class="fas fa-file-download"></i> Download Report';
                downloadBtn.style.justifyContent = '';
                downloadLoader.style.display = 'none';
            }
        });
    }

    // Image upload handler
    const imageDragDropArea = document.getElementById('imageDragDropArea');
    const imageFileInput = document.getElementById('imageFile');
    if (imageDragDropArea && imageFileInput) {
        // Click opens file dialog
        imageDragDropArea.addEventListener('click', () => imageFileInput.click());

        // Drag over highlight
        imageDragDropArea.addEventListener('dragover', e => {
            e.preventDefault();
            imageDragDropArea.classList.add('dragover');
        });
        imageDragDropArea.addEventListener('dragleave', e => {
            e.preventDefault();
            imageDragDropArea.classList.remove('dragover');
        });
        imageDragDropArea.addEventListener('drop', async e => {
            e.preventDefault();
            imageDragDropArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) {
                await handleImageFile(file);
            }
        });
        // File input change
        imageFileInput.addEventListener('change', async e => {
            const file = e.target.files[0];
            if (file) {
                await handleImageFile(file);
            }
        });
    }

    async function handleImageFile(file) {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('mode', 'image_upload');
        formData.append('reference', document.getElementById('referenceText').value);

        // Show dot loader
        const imageUploadDotLoader = document.getElementById('imageUploadDotLoader');
        if (imageUploadDotLoader) {
            imageUploadDotLoader.innerHTML = '<span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span>';
            imageUploadDotLoader.style.display = 'flex';
        }
        // Hide drag-drop icon/text while loading
        const dragDropIcon = document.querySelector('#imageDragDropArea .drag-drop-icon');
        const dragDropText = document.querySelector('#imageDragDropArea .drag-drop-text');
        if (dragDropIcon) dragDropIcon.style.display = 'none';
        if (dragDropText) dragDropText.style.display = 'none';

        try {
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/image_to_text', true);
                xhr.onload = function () {
                    if (xhr.status === 200) {
                        resolve(xhr.responseText);
                    } else {
                        reject(new Error('Upload failed'));
                    }
                };
                xhr.onerror = function () {
                    reject(new Error('Upload error'));
                };
                xhr.send(formData);
            }).then(responseText => {
                const data = JSON.parse(responseText);
                if (data.error) {
                    showError(data.error);
                } else {
                    manualText.value = data.hypothesis;
                    analyzeText(data.hypothesis, data.reference);
                }
            });
        } catch (err) {
            showError('Error processing image file');
        } finally {
            // Hide loader, restore drag-drop UI
            if (imageUploadDotLoader) imageUploadDotLoader.style.display = 'none';
            if (dragDropIcon) dragDropIcon.style.display = '';
            if (dragDropText) dragDropText.style.display = '';
        }
    }
});