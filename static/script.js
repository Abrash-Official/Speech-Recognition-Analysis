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
                await handleAnyFile(file);
            }
        });
        // File input change
        audioFileInput.addEventListener('change', async e => {
            const file = e.target.files[0];
            if (file) {
                await handleAnyFile(file);
            }
        });
    }

    async function handleAnyFile(file) {
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
            showError('Error processing file');
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
        document.getElementById('mlAnalysisBtn').style.display = 'inline-flex';
        document.getElementById('nlpAnalysisBtn').style.display = 'inline-flex';
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
        // After analysis, show ML/NLP buttons
        document.getElementById('mlAnalysisBtn').style.display = 'inline-flex';
        document.getElementById('nlpAnalysisBtn').style.display = 'inline-flex';
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
        document.getElementById('mlAnalysisBtn').style.display = 'inline-flex';
        document.getElementById('nlpAnalysisBtn').style.display = 'inline-flex';
    }

    // Text analysis
    async function analyzeText(hypothesis, reference) {
        try {
            console.log('Analyzing text:', { hypothesis, reference, model: currentModel }); // Debug log
            const response = await fetch('/calculate_wer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hypothesis, reference, model: currentModel })
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
            // Always use backend-provided error lists
            populateErrorList('substitution', data.substitutions);
            populateErrorList('deletion', data.deletions);
            populateErrorList('insertion', data.insertions);
            // Show the Detailed Analysis button
            const detailedBtn = document.getElementById('detailedAnalysisBtn');
            if (detailedBtn) detailedBtn.style.display = 'block';
            // Hide the images section until button is clicked again
            const imagesDiv = document.getElementById('detailedAnalysisImages');
            if (imagesDiv) imagesDiv.style.display = 'none';
            // Show cleaned texts in deep model
            const refInline = document.getElementById('cleanedReferenceInline');
            const hypInline = document.getElementById('cleanedRecognitionInline');
            if (currentModel === 'deep') {
                refInline.innerHTML = data.cleaned_reference ? `<span class='cleaned-label'><i class='fas fa-broom'></i> Cleaned:</span> <span class='cleaned-value'>${data.cleaned_reference}</span>` : '';
                hypInline.innerHTML = data.cleaned_hypothesis ? `<span class='cleaned-label'><i class='fas fa-broom'></i> Cleaned:</span> <span class='cleaned-value'>${data.cleaned_hypothesis}</span>` : '';
                refInline.style.display = data.cleaned_reference ? 'block' : 'none';
                hypInline.style.display = data.cleaned_hypothesis ? 'block' : 'none';
                // Store for model switching
                refInline.setAttribute('data-cleaned', data.cleaned_reference || '');
                hypInline.setAttribute('data-cleaned', data.cleaned_hypothesis || '');
            } else {
                refInline.style.display = 'none';
                hypInline.style.display = 'none';
            }
            // Render text difference using backend merge, using cleaned texts in deep model
            const textDiffDiv = document.getElementById('textDifference');
            if (textDiffDiv) {
                let referenceText, hypothesisText;
                if (currentModel === 'deep' && data.cleaned_reference && data.cleaned_hypothesis) {
                    referenceText = data.cleaned_reference.trim();
                    hypothesisText = data.cleaned_hypothesis.trim();
                } else {
                    referenceText = document.getElementById('referenceText').value.trim();
                    hypothesisText = document.getElementById('manualText').value.trim();
                }
                textDiffDiv.innerHTML = renderTextDiff(referenceText, hypothesisText);
                textDiffDiv.classList.add('custom-diff-box');
            }
            // Show the download button after analysis
            const downloadMLBtn = document.getElementById('downloadReportBtn');
            if (downloadMLBtn) downloadMLBtn.style.display = 'inline-flex';
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
        let reference, hypothesis;
        if (currentModel === 'deep') {
            reference = getCleanedText('cleanedReferenceInline', 'referenceText');
            hypothesis = getCleanedText('cleanedRecognitionInline', 'manualText');
        } else {
            reference = document.getElementById('referenceText').value.trim();
            hypothesis = document.getElementById('manualText').value.trim();
        }
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
    const downloadMLBtn = document.getElementById('downloadReportBtn');
    const downloadNLPBtn = document.getElementById('downloadNLPBtn');
    if (downloadNLPBtn) downloadNLPBtn.style.display = 'none';
    if (downloadMLBtn) downloadMLBtn.style.display = 'none';

    if (downloadMLBtn) {
        downloadMLBtn.addEventListener('click', async function() {
            await downloadReport();
        });
    }

    async function downloadReport() {
        // Always use the ML download button for loader
        let btn = downloadMLBtn;
        btn.disabled = true;
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span>';
        try {
            // Get current reference, hypothesis, images, cm_table, and NLP data
                const reference = document.getElementById('referenceText').value.trim();
                const hypothesis = document.getElementById('manualText').value.trim();
            // Always fetch latest ML data
                const response = await fetch('/detailed_analysis_images', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reference, hypothesis })
                });
            const mlData = await response.json();
            // Always fetch latest NLP data
            const nlpResponse = await fetch('/nlp_analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: hypothesis })
            });
            const nlpData = await nlpResponse.json();
                // Now send to /download_report
                const reportResponse = await fetch('/download_report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reference,
                        hypothesis,
                    images: mlData.images,
                    cm_table: mlData.cm_table,
                    nlp: nlpData
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
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    // --- ML & NLP Analysis Button Logic ---
    const mlBtn = document.getElementById('mlAnalysisBtn');
    const nlpBtn = document.getElementById('nlpAnalysisBtn');
    const mlSection = document.getElementById('detailedAnalysisImages');
    const nlpSection = document.getElementById('nlpAnalysisSection');
    const mlDotLoader = document.getElementById('mlDotLoader');
    const nlpDotLoader = document.getElementById('nlpDotLoader');
    const againMLBtn = document.getElementById('againMLBtn');
    const againNLPBtn = document.getElementById('againNLPBtn');

    // Helper: set active/inactive state for ML/NLP buttons
    function setActiveAnalysisBtn(btn) {
        [mlBtn, nlpBtn].forEach(b => b && b.classList.remove('active'));
        if (btn) btn.classList.add('active');
    }
    // Helper: hide all analysis sections
    function hideAllAnalysisSections() {
        if (mlSection) mlSection.style.display = 'none';
        if (nlpSection) nlpSection.classList.add('hidden');
        if (againMLBtn) againMLBtn.style.display = 'none';
        if (againNLPBtn) againNLPBtn.style.display = 'none';
        if (downloadMLBtn) downloadMLBtn.style.display = 'none';
        if (downloadNLPBtn) downloadNLPBtn.style.display = 'none';
    }

    // --- ML Analysis Button ---
    if (mlBtn) {
        mlBtn.addEventListener('click', async function() {
            if (mlBtn.classList.contains('active')) {
                // If already active, just toggle visibility (do not reload)
                if (mlSection && mlSection.style.display === 'block') {
                    mlSection.style.display = 'none';
                    againMLBtn.style.display = 'none';
                    downloadMLBtn.style.display = 'none';
                } else {
                    mlSection.style.display = 'block';
                    againMLBtn.style.display = 'inline-flex';
                    downloadMLBtn.style.display = 'inline-flex';
                }
                setActiveAnalysisBtn(mlBtn);
                return;
            }
            // Only run analysis if section is empty
            if (!mlSection.innerHTML.trim()) {
            hideAllAnalysisSections();
            setActiveAnalysisBtn(mlBtn);
            // Show loader inside button
            mlBtn.disabled = true;
            const originalHtml = mlBtn.innerHTML;
            mlBtn.innerHTML = '<span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span>';
            if (mlDotLoader) mlDotLoader.style.display = 'none';
            try {
                await runMLAnalysis();
                if (mlSection) mlSection.style.display = 'block';
                if (againMLBtn) againMLBtn.style.display = 'inline-flex';
                if (downloadMLBtn) downloadMLBtn.style.display = 'inline-flex';
            } catch (err) {
                showError('Failed to load ML analysis.');
                console.error('ML Analysis fetch error:', err);
            } finally {
                mlBtn.disabled = false;
                mlBtn.innerHTML = originalHtml;
                }
            } else {
                hideAllAnalysisSections();
                setActiveAnalysisBtn(mlBtn);
                mlSection.style.display = 'block';
                againMLBtn.style.display = 'inline-flex';
                downloadMLBtn.style.display = 'inline-flex';
            }
        });
    }
    // --- Again Analysis Button for ML ---
    if (againMLBtn) {
        againMLBtn.addEventListener('click', async function() {
            const reference = document.getElementById('referenceText').value.trim();
            const hypothesis = document.getElementById('manualText').value.trim();
            if (!reference || !hypothesis) {
                showError('Both reference and recognized text are required for ML analysis');
                return;
            }
            // Show loader inside Again button
            againMLBtn.disabled = true;
            const originalHtml = againMLBtn.innerHTML;
            againMLBtn.innerHTML = '<span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span>';
            try {
                await runMLAnalysis();
                if (mlSection) mlSection.style.display = 'block';
                if (againMLBtn) againMLBtn.style.display = 'inline-flex';
                if (downloadMLBtn) downloadMLBtn.style.display = 'inline-flex';
            } catch (err) {
                showError('Failed to load ML analysis.');
                console.error('ML Analysis fetch error:', err);
            } finally {
                againMLBtn.disabled = false;
                againMLBtn.innerHTML = originalHtml;
            }
        });
    }
    // --- ML Analysis Fetch/Render ---
    async function runMLAnalysis() {
        let reference, hypothesis;
        if (currentModel === 'deep') {
            reference = getCleanedText('cleanedReferenceInline', 'referenceText');
            hypothesis = getCleanedText('cleanedRecognitionInline', 'manualText');
        } else {
            reference = document.getElementById('referenceText').value.trim();
            hypothesis = document.getElementById('manualText').value.trim();
        }
        try {
            const response = await fetch('/detailed_analysis_images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reference, hypothesis })
            });
            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }
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
            html += `<div class=\"graph-card\" style=\"grid-column: span 2; min-width:600px; max-width:1200px; width:100%;\">\n                <div class=\"graph-title\">${graphTitles[4]}</div>\n                <img src=\"data:image/png;base64,${data.images[2]}\" style=\"width:100%;max-width:1200px;margin:0.5rem 0;\"/>\n            </div>`;
            html += '</div>';
            mlSection.innerHTML = html;
        } catch (err) {
            console.error('ML Analysis fetch error:', err);
            throw err;
        }
    }

    // --- NLP Analysis Button ---
    if (nlpBtn) {
        nlpBtn.addEventListener('click', async function() {
            const nlpResultsDiv = document.getElementById('nlpResults');
            if (nlpBtn.classList.contains('active')) {
                // If already active, just toggle visibility (do not reload)
                if (nlpSection && !nlpSection.classList.contains('hidden')) {
                    nlpSection.classList.add('hidden');
                    againNLPBtn.style.display = 'none';
                    downloadMLBtn.style.display = 'none';
                } else {
                    nlpSection.classList.remove('hidden');
                    againNLPBtn.style.display = 'inline-flex';
                    downloadMLBtn.style.display = 'inline-flex';
                }
                setActiveAnalysisBtn(nlpBtn);
                return;
            }
            // Only run analysis if results section is empty
            if (!nlpResultsDiv.innerHTML.trim()) {
            hideAllAnalysisSections();
            setActiveAnalysisBtn(nlpBtn);
            // Show loader inside button
            nlpBtn.disabled = true;
            const originalHtml = nlpBtn.innerHTML;
            nlpBtn.innerHTML = '<span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span>';
            if (nlpDotLoader) nlpDotLoader.style.display = 'none';
            try {
                await runNLPAnalysis();
                if (nlpSection) nlpSection.classList.remove('hidden');
                if (againNLPBtn) againNLPBtn.style.display = 'inline-flex';
                if (downloadMLBtn) downloadMLBtn.style.display = 'inline-flex';
            } catch (err) {
                showError('Failed to load NLP analysis.');
            } finally {
                nlpBtn.disabled = false;
                nlpBtn.innerHTML = originalHtml;
                }
            } else {
                hideAllAnalysisSections();
                setActiveAnalysisBtn(nlpBtn);
                nlpSection.classList.remove('hidden');
                againNLPBtn.style.display = 'inline-flex';
                downloadMLBtn.style.display = 'inline-flex';
            }
        });
    }
    // --- NLP Analysis Fetch/Render ---
    async function runNLPAnalysis(forceReload = false) {
        let hypothesis;
        if (currentModel === 'deep') {
            hypothesis = getCleanedText('cleanedRecognitionInline', 'manualText');
        } else {
            hypothesis = document.getElementById('manualText').value.trim();
        }
        if (!hypothesis) {
            showError('Recognized text is required for NLP analysis');
            return;
        }
        const nlpResultsDiv = document.getElementById('nlpResults');
        if (!forceReload && nlpResultsDiv.innerHTML.trim()) {
            // Don't reload unless forced
            return;
        }
        try {
        const response = await fetch('/nlp_analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: hypothesis })
        });
        const data = await response.json();
            if (data.error) {
                showError('NLP Error: ' + data.error);
                return;
            }
        // Render NLP results in a user-friendly way with explanations and animation
        let html = '';
        html += `<div class='nlp-card nlp-animate'><div class='nlp-label'><i class='fas fa-cut'></i> Tokenization</div><div class='nlp-desc'>Splitting text into individual words or tokens.</div><div class='nlp-value'>${data.tokenization.map(w => `<span class='nlp-token nlp-token-animate'>${w}</span>`).join(' ')}</div></div>`;
        html += `<div class='nlp-card nlp-animate'><div class='nlp-label'><i class='fas fa-font'></i> Normalization</div><div class='nlp-desc'>Converting all words to lowercase and removing punctuation.</div><div class='nlp-value'>${data.normalization.map(w => `<span class='nlp-token nlp-token-animate'>${w}</span>`).join(' ')}</div></div>`;
        html += `<div class='nlp-card nlp-animate'><div class='nlp-label'><i class='fas fa-leaf'></i> Stemming</div><div class='nlp-desc'>Reducing words to their root form (e.g., \"running\" → \"run\").</div><div class='nlp-value'>${data.stemming.map(w => `<span class='nlp-token nlp-token-animate'>${w}</span>`).join(' ')}</div></div>`;
        html += `<div class='nlp-card nlp-animate'><div class='nlp-label'><i class='fas fa-seedling'></i> Lemmatization</div><div class='nlp-desc'>Reducing words to their dictionary base form (e.g., \"better\" → \"good\").</div><div class='nlp-value'>${data.lemmatization.map(w => `<span class='nlp-token nlp-token-animate'>${w}</span>`).join(' ')}</div></div>`;
        html += `<div class='nlp-card nlp-animate'><div class='nlp-label'><i class='fas fa-ban'></i> Stop Words Removed</div><div class='nlp-desc'>Removing common words that add little meaning (e.g., \"the\", \"is\").</div><div class='nlp-value'>${data.stopwords.map(w => `<span class='nlp-token nlp-token-animate'>${w}</span>`).join(' ')}</div></div>`;
        nlpResultsDiv.innerHTML = html;
        // Animate cards in
        setTimeout(() => {
            document.querySelectorAll('.nlp-card').forEach((el, i) => {
                el.style.opacity = 1;
                el.style.transform = 'translateY(0)';
                el.style.transition = `opacity 0.7s ${i * 0.08 + 0.1}s, transform 0.7s ${i * 0.08 + 0.1}s`;
            });
        }, 50);
        } catch (err) {
            showError('Failed to load NLP analysis.');
            console.error('NLP fetch error:', err);
        }
    }

    // --- Again Analysis Button for NLP ---
    if (againNLPBtn) {
        againNLPBtn.addEventListener('click', async function() {
            const hypothesis = document.getElementById('manualText').value.trim();
            if (!hypothesis) {
                showError('Recognized text is required for NLP analysis');
                return;
            }
            againNLPBtn.disabled = true;
            againNLPBtn.classList.add('loading');
            const originalHtml = againNLPBtn.innerHTML;
            againNLPBtn.innerHTML = '<span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span><span class="dot-loader-dot"></span>';
            try {
                const start = Date.now();
                await runNLPAnalysis(true); // always force reload
                const elapsed = Date.now() - start;
                if (elapsed < 400) await new Promise(res => setTimeout(res, 400 - elapsed));
                if (nlpSection) nlpSection.classList.remove('hidden');
                if (againNLPBtn) againNLPBtn.style.display = 'inline-flex';
                if (downloadMLBtn) downloadMLBtn.style.display = 'inline-flex';
                console.log('NLP Again Analysis completed');
        } catch (err) {
                showError('Failed to load NLP analysis.');
                console.error('NLP Again Analysis error:', err);
        } finally {
                againNLPBtn.disabled = false;
                againNLPBtn.classList.remove('loading');
                againNLPBtn.innerHTML = originalHtml;
        }
        });
    }

    // Model selection logic for toggle button group
    let currentModel = 'normal';
    const normalModelBtn = document.getElementById('normalModelBtn');
    const deepModelBtn = document.getElementById('deepModelBtn');
    function setModel(model) {
        currentModel = model;
        const refInline = document.getElementById('cleanedReferenceInline');
        const hypInline = document.getElementById('cleanedRecognitionInline');
        if (model === 'deep') {
            document.body.classList.add('deep-model');
            deepModelBtn.classList.add('active');
            normalModelBtn.classList.remove('active');
            // If cleaned text is present in data attributes, show it
            const refVal = refInline?.getAttribute('data-cleaned') || '';
            const hypVal = hypInline?.getAttribute('data-cleaned') || '';
            if (refVal) {
                refInline.innerHTML = `<span class='cleaned-label'><i class='fas fa-broom'></i> Cleaned:</span> <span class='cleaned-value'>${refVal}</span>`;
                refInline.style.display = 'block';
            }
            if (hypVal) {
                hypInline.innerHTML = `<span class='cleaned-label'><i class='fas fa-broom'></i> Cleaned:</span> <span class='cleaned-value'>${hypVal}</span>`;
                hypInline.style.display = 'block';
            }
        } else {
            document.body.classList.remove('deep-model');
            normalModelBtn.classList.add('active');
            deepModelBtn.classList.remove('active');
            if (refInline) refInline.style.display = 'none';
            if (hypInline) hypInline.style.display = 'none';
        }
    }
    if (normalModelBtn && deepModelBtn) {
        normalModelBtn.addEventListener('click', () => setModel('normal'));
        deepModelBtn.addEventListener('click', () => setModel('deep'));
    }
    setModel('normal'); // Default

    // Helper to get cleaned text in deep mode
    function getCleanedText(id, fallbackId) {
        const elem = document.getElementById(id);
        if (elem && elem.querySelector('.cleaned-value')) {
            return elem.querySelector('.cleaned-value').textContent.trim();
        } else if (fallbackId) {
            const fallbackElem = document.getElementById(fallbackId);
            return fallbackElem ? fallbackElem.value.trim() : '';
        }
        return '';
    }

    // Add this function for word-level diff rendering
    function renderTextDiff(reference, recognition) {
        // Split into words for word-level diff
        const refWords = reference.trim().split(/\s+/);
        const recWords = recognition.trim().split(/\s+/);
        // Join with special separator to avoid accidental merges
        const SEP = '␣';
        const refStr = refWords.join(SEP);
        const recStr = recWords.join(SEP);
        // Use diff-match-patch
        const dmp = new diff_match_patch();
        const diffs = dmp.diff_main(refStr, recStr);
        dmp.diff_cleanupSemantic(diffs);
        // Convert back to word-level and HTML
        let html = '';
        diffs.forEach(([op, data]) => {
            const words = data.split(SEP).filter(Boolean);
            if (op === 0) { // Equal
                html += words.join(' ') + ' ';
            } else if (op === -1) { // Deletion
                html += words.map(w => `<span class="diff-deletion diff-strike">${w}</span>`).join(' ') + ' ';
            } else if (op === 1) { // Insertion
                html += words.map(w => `<span class="diff-insertion">${w}</span>`).join(' ') + ' ';
            }
        });
        return html.trim();
    }
});