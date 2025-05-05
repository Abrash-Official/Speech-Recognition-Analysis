import matplotlib
matplotlib.use('Agg')

from flask import Flask, render_template, request, jsonify, send_file
import speech_recognition as sr
from difflib import SequenceMatcher
from pydub import AudioSegment
import tempfile
import os
from collections import defaultdict
import numpy as np
from sklearn.metrics import precision_recall_fscore_support, confusion_matrix
import io
import base64
import matplotlib.pyplot as plt
from sklearn.metrics import ConfusionMatrixDisplay
from fpdf import FPDF
import plotly.express as px
import plotly.graph_objects as go
import pytesseract
from PIL import Image
# --- NLP imports ---
import nltk
from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer, WordNetLemmatizer
from nltk.corpus import stopwords
import string
# Ensure NLTK resources are downloaded
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')
try:
    nltk.data.find('corpora/wordnet')
except LookupError:
    nltk.download('wordnet')
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')
from PyPDF2 import PdfReader

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = tempfile.mkdtemp()
app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # Allow uploads up to 200MB

def convert_to_wav(audio_path):
    """Convert any audio file to WAV format"""
    audio = AudioSegment.from_file(audio_path)
    wav_path = os.path.splitext(audio_path)[0] + ".wav"
    audio.export(wav_path, format="wav")
    return wav_path

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/transcribe', methods=['POST'])
def transcribe():
    try:
        mode = request.form.get('mode')
        reference = request.form.get('reference', '')
        
        if mode == 'microphone':
            audio_file = request.files.get('audio')
            temp_path = os.path.join(app.config['UPLOAD_FOLDER'], 'audio.webm')
            audio_file.save(temp_path)
            wav_path = convert_to_wav(temp_path)
            filetype = 'audio'
        elif mode == 'file_upload':
            uploaded_file = request.files.get('file')
            filename = uploaded_file.filename.lower()
            temp_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            uploaded_file.save(temp_path)
            ext = os.path.splitext(filename)[1]
            # Determine file type
            if ext in ['.wav', '.mp3', '.mp4', '.m4a', '.flac', '.ogg', '.aac', '.webm']:
                wav_path = convert_to_wav(temp_path)
                filetype = 'audio'
            elif ext in ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.gif']:
                filetype = 'image'
            elif ext == '.pdf':
                filetype = 'pdf'
            elif ext == '.txt':
                filetype = 'text'
            else:
                return jsonify({'error': 'Unsupported file type'}), 400
        else:
            return jsonify({'error': 'Invalid mode'}), 400

        # Process file based on type
        if mode == 'microphone' or (mode == 'file_upload' and filetype == 'audio'):
            recognizer = sr.Recognizer()
            with sr.AudioFile(wav_path) as source:
                audio = recognizer.record(source)
                hypothesis = recognizer.recognize_google(audio)
            os.unlink(temp_path)
            os.unlink(wav_path)
        elif mode == 'file_upload' and filetype == 'image':
            img = Image.open(temp_path)
            hypothesis = pytesseract.image_to_string(img).strip()
            os.unlink(temp_path)
        elif mode == 'file_upload' and filetype == 'pdf':
            with open(temp_path, 'rb') as f:
                reader = PdfReader(f)
                text = ''
                for page in reader.pages:
                    text += page.extract_text() or ''
            hypothesis = text.strip()
            os.unlink(temp_path)
        elif mode == 'file_upload' and filetype == 'text':
            with open(temp_path, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
            hypothesis = text.strip()
            os.unlink(temp_path)
        else:
            return jsonify({'error': 'Unsupported or missing file type'}), 400
        
        return jsonify({'hypothesis': hypothesis, 'reference': reference})
    except Exception as e:
        import traceback
        print("TRANSCRIBE ERROR:", e)
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/calculate_wer', methods=['POST'])
def calculate_wer():
    data = request.get_json()
    try:
        ref_words = data['reference'].lower().split()
        hyp_words = data['hypothesis'].lower().split()
        
        matcher = SequenceMatcher(None, ref_words, hyp_words)
        substitutions = []
        deletions = []
        insertions = []
        
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'replace':
                subs = list(zip(ref_words[i1:i2], hyp_words[j1:j2]))
                substitutions.extend([f"{r} → {h}" for r, h in subs])
            elif tag == 'delete':
                deletions.extend(ref_words[i1:i2])
            elif tag == 'insert':
                insertions.extend(hyp_words[j1:j2])
        
        total_errors = len(substitutions) + len(deletions) + len(insertions)
        wer = total_errors / len(ref_words) if ref_words else 1.0
        
        return jsonify({
            'wer': wer,
            'substitutions': substitutions,
            'deletions': deletions,
            'insertions': insertions,
            'hypothesis': data['hypothesis']
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/detailed_analysis', methods=['POST'])
def detailed_analysis():
    try:
        data = request.get_json()
        if not data or 'reference' not in data or 'hypothesis' not in data:
            return jsonify({'error': 'Missing required data'}), 400

        ref_words = data['reference'].lower().split()
        hyp_words = data['hypothesis'].lower().split()
        
        if not ref_words or not hyp_words:
            return jsonify({'error': 'Empty text provided'}), 400

        # Create confusion matrix
        confusion_matrix_dict = defaultdict(lambda: defaultdict(int))
        matcher = SequenceMatcher(None, ref_words, hyp_words)
        
        # Track correct and incorrect predictions for metrics
        true_positives = 0
        false_positives = 0
        false_negatives = 0

        substitutions = []
        deletions = []
        insertions = []
        
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal':
                # Words match - true positives
                for ref in ref_words[i1:i2]:
                    confusion_matrix_dict[ref][ref] += 1
                    true_positives += 1
            elif tag == 'replace':
                # Substitutions - both false positive and false negative
                for ref, hyp in zip(ref_words[i1:i2], hyp_words[j1:j2]):
                    confusion_matrix_dict[ref][hyp] += 1
                    false_positives += 1
                    false_negatives += 1
                    substitutions.append(f"{ref} → {hyp}")
            elif tag == 'delete':
                # Deletions - false negatives
                for ref in ref_words[i1:i2]:
                    confusion_matrix_dict[ref]['<DEL>'] += 1
                    false_negatives += 1
                    deletions.append(ref)
            elif tag == 'insert':
                # Insertions - false positives
                for hyp in hyp_words[j1:j2]:
                    confusion_matrix_dict['<INS>'][hyp] += 1
                    false_positives += 1
                    insertions.append(hyp)

        # Calculate metrics
        total_words = len(ref_words)
        precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0
        recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        accuracy = true_positives / total_words if total_words > 0 else 0

        # Calculate error distribution
        error_distribution = {
            'substitutions': len(substitutions),
            'deletions': len(deletions),
            'insertions': len(insertions)
        }

        # Get unique labels and ensure they exist in the matrix
        labels = sorted(set(ref_words + hyp_words + ['<DEL>', '<INS>']))
        matrix_data = {label: {inner_label: confusion_matrix_dict[label][inner_label] 
                              for inner_label in labels} 
                      for label in labels}

        # Word frequency analysis
        ref_freq = defaultdict(int)
        hyp_freq = defaultdict(int)
        for word in ref_words:
            ref_freq[word] += 1
        for word in hyp_words:
            hyp_freq[word] += 1

        return jsonify({
            'confusionMatrix': {
                'labels': labels,
                'matrix': matrix_data
            },
            'metrics': {
                'precision': precision,
                'recall': recall,
                'f1_score': f1_score,
                'accuracy': accuracy
            },
            'errorDistribution': error_distribution,
            'substitutions': substitutions,
            'deletions': deletions,
            'insertions': insertions,
            'wordFrequency': {
                'reference': dict(ref_freq),
                'hypothesis': dict(hyp_freq)
            },
            'totalWords': total_words
        })
    except Exception as e:
        print(f"Error in detailed_analysis: {str(e)}")  # Server-side logging
        return jsonify({'error': str(e)}), 500

@app.route('/detailed_analysis_images', methods=['POST'])
def detailed_analysis_images():
    import pandas as pd
    from collections import Counter
    from difflib import SequenceMatcher
    try:
        data = request.get_json()
        reference = data.get('reference', '').lower().split()
        hypothesis = data.get('hypothesis', '').lower().split()
        images = []
        # Handle empty input gracefully
        if not reference or not hypothesis:
            empty_img = ''
            images = [empty_img] * 5
            cm_table = '<p>No data for confusion matrix.</p>'
            print('RETURNING:', {'images': images, 'cm_table': cm_table})
            return jsonify({'images': images, 'cm_table': cm_table})
        # --- 1. Binary Confusion Matrix (Present/Absent) ---
        matcher = SequenceMatcher(None, reference, hypothesis)
        tp = fp = fn = tn = 0
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal':
                tp += (i2 - i1)
            elif tag == 'replace':
                fp += (j2 - j1)
                fn += (i2 - i1)
            elif tag == 'delete':
                fn += (i2 - i1)
            elif tag == 'insert':
                fp += (j2 - j1)
        # TN is not meaningful for word-level, but show as 0
        matrix = np.array([[tp, fp], [fn, tn]])
        fig, ax = plt.subplots(figsize=(4, 4))
        cmap = plt.get_cmap('Blues')
        cax = ax.matshow(matrix, cmap=cmap, vmin=0)
        normed = (matrix - matrix.min()) / (matrix.max() - matrix.min() + 1e-6)
        for (i, j), val in np.ndenumerate(matrix):
            bg_color = cmap(normed[i, j])
            brightness = 0.299 * bg_color[0] + 0.587 * bg_color[1] + 0.114 * bg_color[2]
            text_color = 'white' if brightness < 0.5 else '#2a2a72'
            ax.text(j, i, int(val), ha='center', va='center', color=text_color, fontsize=22, fontweight='bold')
        ax.set_xticks([0, 1])
        ax.set_yticks([0, 1])
        ax.set_xticklabels(['Present', 'Absent'], fontsize=15, color='#2a2a72', fontweight='bold')
        ax.set_yticklabels(['Present', 'Absent'], fontsize=15, color='#2a2a72', fontweight='bold')
        ax.set_xlabel('Predicted', fontsize=18, color='#2a2a72', fontweight='bold', labelpad=10)
        ax.set_ylabel('Actual', fontsize=18, color='#2a2a72', fontweight='bold', labelpad=10)
        plt.title('Word Presence Confusion Matrix', fontsize=20, color='#2a2a72', pad=16)
        fig.colorbar(cax, fraction=0.046, pad=0.04)
        # Draw thick grid lines between cells
        for i in range(1, 2):
            ax.axhline(i - 0.5, color='black', linewidth=2)
            ax.axvline(i - 0.5, color='black', linewidth=2)
        plt.tight_layout()
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight')
        plt.close(fig)
        buf.seek(0)
        images = [base64.b64encode(buf.read()).decode('utf-8')]
        # --- 2. Pie Chart (Error Distribution) ---
        substitutions = sum(1 for a, b in zip(reference, hypothesis) if a != b)
        deletions = max(0, len(reference) - len(hypothesis))
        insertions = max(0, len(hypothesis) - len(reference))
        values = [substitutions, deletions, insertions]
        labels_pie = ['Substitutions', 'Deletions', 'Insertions']
        if sum(values) > 0:
            fig = px.pie(
                names=labels_pie,
                values=values,
                color=labels_pie,
                color_discrete_map={
                    'Substitutions': '#FF9F43',
                    'Deletions': '#FF6B6B',
                    'Insertions': '#4CAF50'
                },
                title='Error Distribution',
                hole=0.3
            )
            fig.update_traces(textinfo='percent+label', pull=[0.05, 0.05, 0.05])
            fig.update_layout(
                legend_title_text='Errors',
                font=dict(family='Segoe UI', size=16, color='#2a2a72'),
                margin=dict(l=20, r=20, t=60, b=20),
                width=500, height=400
            )
        else:
            fig = go.Figure()
            fig.add_annotation(text='No Errors', x=0.5, y=0.5, showarrow=False, font=dict(size=20))
            fig.update_layout(title='Error Distribution', width=500, height=400)
        buf = io.BytesIO()
        fig.write_image(buf, format='png', engine='kaleido')
        buf.seek(0)
        images.append(base64.b64encode(buf.read()).decode('utf-8'))
        # --- 3. Merged Frequency Bar Chart (Top 10 Words in Reference & Hypothesis) ---
        ref_counts = Counter(reference)
        hyp_counts = Counter(hypothesis)
        top_ref = ref_counts.most_common(10)
        top_hyp = hyp_counts.most_common(10)
        top_words = list({w for w, _ in top_ref} | {w for w, _ in top_hyp})
        seen = set()
        ordered_words = []
        for w, _ in top_ref + top_hyp:
            if w not in seen:
                ordered_words.append(w)
                seen.add(w)
        if not ordered_words:
            images.append('')
        else:
            ref_vals = [ref_counts.get(w, 0) for w in ordered_words]
            hyp_vals = [hyp_counts.get(w, 0) for w in ordered_words]
            freq_df = pd.DataFrame({
                'Word': ordered_words * 2,
                'Count': ref_vals + hyp_vals,
                'Type': ['Reference'] * len(ordered_words) + ['Hypothesis'] * len(ordered_words)
            })
            fig = px.bar(
                freq_df,
                x='Word',
                y='Count',
                color='Type',
                barmode='group',
                color_discrete_map={'Reference': 'skyblue', 'Hypothesis': 'salmon'},
                title='Top 10 Word Frequency: Reference vs Hypothesis',
                width=1000, height=500
            )
            fig.update_layout(
                font=dict(family='Segoe UI', size=16, color='#2a2a72'),
                margin=dict(l=40, r=40, t=60, b=40),
                xaxis_tickangle=-45
            )
            buf = io.BytesIO()
            fig.write_image(buf, format='png', engine='kaleido')
            buf.seek(0)
            images.append(base64.b64encode(buf.read()).decode('utf-8'))
        # --- 4. Linear Regression Plot (Reference vs Hypothesis Word Positions) ---
        ref_positions = []
        hyp_positions = []
        ref_word_to_indices = {}
        for idx, word in enumerate(reference):
            ref_word_to_indices.setdefault(word, []).append(idx)
        used_hyp_indices = set()
        for hyp_idx, word in enumerate(hypothesis):
            if word in ref_word_to_indices and ref_word_to_indices[word]:
                ref_idx = ref_word_to_indices[word].pop(0)
                ref_positions.append(ref_idx)
                hyp_positions.append(hyp_idx)
                used_hyp_indices.add(hyp_idx)
        if ref_positions and hyp_positions:
            df = pd.DataFrame({'Reference Position': ref_positions, 'Hypothesis Position': hyp_positions})
            fig = px.scatter(
                df,
                x='Reference Position',
                y='Hypothesis Position',
                trendline='ols',
                color_discrete_sequence=['purple'],
                title='Linear Regression: Reference vs Hypothesis Word Positions',
                width=700, height=500
            )
            fig.update_traces(marker=dict(size=12))
            fig.update_layout(
                font=dict(family='Segoe UI', size=16, color='#2a2a72'),
                margin=dict(l=40, r=40, t=60, b=40)
            )
        else:
            fig = go.Figure()
            fig.add_annotation(text='Not enough matching words for regression',
                               x=0.5, y=0.5, showarrow=False, font=dict(size=20))
            fig.update_layout(title='Linear Regression: Reference vs Hypothesis Word Positions', width=700, height=500)
        buf = io.BytesIO()
        fig.write_image(buf, format='png', engine='kaleido')
        buf.seek(0)
        images.append(base64.b64encode(buf.read()).decode('utf-8'))
        # --- TP/TN/FP/FN Table with metrics ---
        matcher = SequenceMatcher(None, reference, hypothesis)
        tp_words = []
        tn_words = []
        fp_words = []
        fn_words = []
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal':
                tp_words.extend(reference[i1:i2])
            elif tag == 'replace':
                fp_words.extend(hypothesis[j1:j2])
                fn_words.extend(reference[i1:i2])
            elif tag == 'delete':
                fn_words.extend(reference[i1:i2])
            elif tag == 'insert':
                fp_words.extend(hypothesis[j1:j2])
        # Calculate metrics
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        cm_table = f'''
        <table style="width:100%;border-collapse:collapse;font-size:1.08rem;">
            <thead><tr><th>Type</th><th>Words / Value</th></tr></thead>
            <tbody>
                <tr><td>TP</td><td class="scrollable-cell">{', '.join(tp_words) if tp_words else '-'}</td></tr>
                <tr><td>FP</td><td class="scrollable-cell">{', '.join(fp_words) if fp_words else '-'}</td></tr>
                <tr><td>FN</td><td class="scrollable-cell">{', '.join(fn_words) if fn_words else '-'}</td></tr>
                <tr><td>Precision</td><td>{precision:.2f}</td></tr>
                <tr><td>Recall</td><td>{recall:.2f}</td></tr>
                <tr><td>F1 Score</td><td>{f1_score:.2f}</td></tr>
            </tbody>
        </table>
        '''
        print('RETURNING:', {'images': images, 'cm_table': cm_table})
        return jsonify({'images': images, 'cm_table': cm_table})
    except Exception as e:
        print(f"Error in detailed_analysis_images: {str(e)}")  # Server-side logging
        return jsonify({'images': ['']*5, 'cm_table': '<p>Error generating analysis.</p>', 'error': str(e)}), 500

@app.route('/nlp_analysis', methods=['POST'])
def nlp_analysis():
    try:
        data = request.get_json()
        text = data.get('text', '')
        # Tokenization
        tokens = word_tokenize(text)
        # Normalization: lowercase, remove punctuation
        table = str.maketrans('', '', string.punctuation)
        normalized = [w.lower().translate(table) for w in tokens if w.strip()]
        normalized = [w for w in normalized if w]
        # Stemming
        stemmer = PorterStemmer()
        stemmed = [stemmer.stem(w) for w in normalized]
        # Lemmatization
        lemmatizer = WordNetLemmatizer()
        lemmatized = [lemmatizer.lemmatize(w) for w in normalized]
        # Stopwords
        stop_words = set(stopwords.words('english'))
        no_stopwords = [w for w in normalized if w not in stop_words]
        return jsonify({
            'tokenization': tokens,
            'normalization': normalized,
            'stemming': stemmed,
            'lemmatization': lemmatized,
            'stopwords': no_stopwords
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download_report', methods=['POST'])
def download_report():
    try:
        data = request.get_json()
        reference = data.get('reference', '')
        hypothesis = data.get('hypothesis', '')
        images = data.get('images', [])  # List of base64 images
        cm_table = data.get('cm_table', '')
        nlp = data.get('nlp', None)

        pdf = FPDF()
        pdf.add_page()
        pdf.set_font('Arial', 'B', 16)
        pdf.cell(0, 10, 'SpeechWER Detailed Analysis Report', ln=True, align='C')
        pdf.ln(8)
        pdf.set_font('Arial', '', 12)
        pdf.multi_cell(0, 8, f'Reference Text:\n{reference}')
        pdf.ln(2)
        pdf.multi_cell(0, 8, f'Recognized Text:\n{hypothesis}')
        pdf.ln(4)
        pdf.set_font('Arial', 'B', 13)
        pdf.cell(0, 10, 'Analysis Graphs:', ln=True)
        pdf.set_font('Arial', '', 12)
        for idx, img_b64 in enumerate(images):
            if img_b64:
                img_data = base64.b64decode(img_b64)
                with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as tmp_img:
                    tmp_img.write(img_data)
                    tmp_img.flush()
                    pdf.image(tmp_img.name, w=170)
                os.unlink(tmp_img.name)
                pdf.ln(2)
        pdf.ln(2)
        pdf.set_font('Arial', 'B', 13)
        pdf.cell(0, 10, 'Confusion Matrix Table:', ln=True)
        pdf.set_font('Arial', '', 10)
        # Strip HTML tags for a simple text table (for now)
        import re
        table_text = re.sub('<[^<]+?>', '', cm_table)
        pdf.multi_cell(0, 6, table_text)
        # --- NLP Section ---
        if nlp:
            try:
                import matplotlib.pyplot as plt
                import matplotlib.patches as patches
                # Prepare NLP data as a list of (label, desc, items)
                nlp_blocks = [
                    ("Tokenization", "Splitting text into individual words or tokens.", nlp.get('tokenization', [])),
                    ("Normalization", "Converting all words to lowercase and removing punctuation.", nlp.get('normalization', [])),
                    ("Stemming", "Reducing words to their root form (e.g., 'running' → 'run').", nlp.get('stemming', [])),
                    ("Lemmatization", "Reducing words to their dictionary base form (e.g., 'better' → 'good').", nlp.get('lemmatization', [])),
                    ("Stop Words Removed", "Removing common words that add little meaning (e.g., 'the', 'is').", nlp.get('stopwords', [])),
                ]
                fig, ax = plt.subplots(figsize=(8.5, 5))
                ax.axis('off')
                y = 1.0
                for label, desc, items in nlp_blocks:
                    ax.text(0.01, y, label, fontsize=14, fontweight='bold', color='#2a2a72', va='top')
                    y -= 0.06
                    ax.text(0.02, y, desc, fontsize=10, color='#009ffd', va='top', style='italic')
                    y -= 0.05
                    # Show up to 10 tokens per line
                    tokens = [str(w) for w in items]
                    for i in range(0, len(tokens), 10):
                        ax.text(0.03, y, ' '.join(tokens[i:i+10]), fontsize=11, color='#222', va='top')
                        y -= 0.045
                    y -= 0.02
                plt.tight_layout()
                with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as nlp_img:
                    fig.savefig(nlp_img.name, bbox_inches='tight', dpi=180)
                    plt.close(fig)
                    pdf.add_page()
                    pdf.set_font('Arial', 'B', 13)
                    pdf.cell(0, 10, 'NLP Analysis:', ln=True)
                    pdf.image(nlp_img.name, w=180)
                os.unlink(nlp_img.name)
            except Exception as e:
                # Fallback to text if image fails
                pdf.ln(4)
                pdf.set_font('Arial', 'B', 13)
                pdf.cell(0, 10, 'NLP Analysis:', ln=True)
                pdf.set_font('Arial', '', 11)
                def nlp_list(label, desc, items):
                    pdf.set_font('Arial', 'B', 11)
                    pdf.cell(0, 8, label, ln=True)
                    pdf.set_font('Arial', 'I', 10)
                    pdf.cell(0, 7, desc, ln=True)
                    pdf.set_font('Arial', '', 10)
                    pdf.multi_cell(0, 6, ' '.join(items) if items else '-')
                    pdf.ln(1)
                nlp_list('Tokenization', 'Splitting text into individual words or tokens.', nlp.get('tokenization', []))
                nlp_list('Normalization', 'Converting all words to lowercase and removing punctuation.', nlp.get('normalization', []))
                nlp_list('Stemming', 'Reducing words to their root form (e.g., "running" → "run").', nlp.get('stemming', []))
                nlp_list('Lemmatization', 'Reducing words to their dictionary base form (e.g., "better" → "good").', nlp.get('lemmatization', []))
                nlp_list('Stop Words Removed', 'Removing common words that add little meaning (e.g., "the", "is").', nlp.get('stopwords', []))
        # Save PDF to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_pdf:
            pdf.output(tmp_pdf.name)
            tmp_pdf.flush()
            tmp_pdf_path = tmp_pdf.name
        return send_file(tmp_pdf_path, as_attachment=True, download_name='SpeechWER_Report.pdf')
    except Exception as e:
        import traceback
        print("DOWNLOAD REPORT ERROR:", e)
        traceback.print_exc()  # Print the full error to the terminal
        return {'error': str(e)}, 500

@app.route('/merge_texts', methods=['POST'])
def merge_texts():
    data = request.get_json()
    ref = data.get('reference', '')
    hyp = data.get('hypothesis', '')
    print('REFERENCE:', ref)
    print('RECOGNITION:', hyp)
    ref_words = ref.strip().split()
    hyp_words = hyp.strip().split()
    i, j = 0, 0
    merged = []
    while i < len(ref_words) and j < len(hyp_words):
        if ref_words[i] == hyp_words[j]:
            merged.append(ref_words[i])
            i += 1
            j += 1
        else:
            merged.append(ref_words[i])
            merged.append(hyp_words[j])
            i += 1
            j += 1
    while i < len(ref_words):
        merged.append(ref_words[i])
        i += 1
    while j < len(hyp_words):
        merged.append(hyp_words[j])
        j += 1
    merged_str = ' '.join(merged)
    print('MERGED:', merged_str)
    return jsonify({'merged': merged_str})

if __name__ == '__main__':
    app.run(debug=True)