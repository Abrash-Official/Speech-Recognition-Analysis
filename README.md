# SpeechWER – Speech Recognition Error Analysis Tool  
**By Muhammad Abrash**

---

## **Table of Contents**

1. Introduction  
2. Features  
3. Technologies Used  
4. Installation & Setup  
5. Project Structure  
6. Technical Components  
7. API Endpoints  
8. Usage Guide  
9. Troubleshooting  
10. References  
11. Contact Information  

---

## **Introduction**

**SpeechWER** is a web-based speech recognition analysis tool that calculates Word Error Rate (WER) and provides detailed error analysis. Built as a Flask application, it supports:

- Audio recording via microphone  
- File uploads (audio/images)  
- Optical Character Recognition (OCR) for images  
- Interactive visualizations  
- PDF report generation  

---

## **Features**

### 1. **Multi-Mode Input**
- Microphone recording (WebM format)  
- Audio file upload (WAV/MP3)  
- Image upload for text extraction  
- Manual text input  

### 2. **Core Analysis**
- Word Error Rate (WER) calculation  
- Error classification: Substitutions / Deletions / Insertions  
- Text diff visualization  

### 3. **Advanced Analytics**
- Confusion matrix  
- Error distribution pie chart  
- Word frequency comparison  
- Positional regression analysis  

### 4. **Export**
- PDF reports with visualizations  
- Interactive HTML output  

---

## **Technologies Used**

### **Backend**
- Flask (Web framework)  
- SpeechRecognition (Audio processing)  
- PyDub (Audio conversion)  
- PyTesseract (Image OCR)  
- scikit-learn (Metrics calculation)  
- FPDF (PDF generation)  

### **Frontend**
- Plotly (Visualizations)  
- Vanilla JavaScript (UI interactions)  
- CSS Animations (Modern styling)  

### **Dependencies**
```bash
Flask==3.0.0  
SpeechRecognition==3.10.0  
pydub==0.25.1  
pytesseract==0.3.10  
plotly==5.18.0  
fpdf2==2.7.7  
```

---

## **Installation & Setup**

### **Prerequisites**
```bash
# Ubuntu/Debian
sudo apt install ffmpeg tesseract-ocr
```

### **Python Environment**
```bash
python -m venv venv  
source venv/bin/activate  
pip install -r requirements.txt
```

### **Configuration**
Set Tesseract path in **`app.py`** if needed:
```python
pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'
```

### **Run Application**
```bash
python app.py
```

Access at: **http://localhost:5000**

---

## **Project Structure**

```
speechwer/
├── app.py              # Flask backend
├── templates/          # HTML files
│   └── index.html
├── static/
│   ├── script.js       # Frontend logic
│   └── style.css       # Styling
├── requirements.txt    # Dependencies
└── tmp/                # Temporary uploads (auto-created)
```

---

## **Technical Components**

### 1. **Audio Processing Pipeline**
```python
@app.route('/transcribe', methods=['POST'])
def transcribe():
    # Converts uploaded audio to WAV format
    audio = AudioSegment.from_file(temp_path)
    wav_path = convert_to_wav(temp_path)

    # Speech-to-text using Google's API
    hypothesis = recognizer.recognize_google(audio)
```

### 2. **WER Calculation Logic**
```python
def calculate_wer():
    matcher = SequenceMatcher(None, ref_words, hyp_words)
    # Identifies error types using sequence matching
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'replace': # Substitutions
        elif tag == 'delete': # Deletions
        elif tag == 'insert': # Insertions
```

### 3. **Visualization Engine**
```python
@app.route('/detailed_analysis_images')
def detailed_analysis_images():
    # Generates 5 visualizations using Plotly/Matplotlib:
    # 1. Confusion Matrix
    # 2. Error Distribution Pie Chart
    # 3. Word Frequency Comparison
    # 4. Positional Regression Plot
    # 5. TP/FP/FN Table
```

---

## **API Endpoints**

| Endpoint              | Method | Description                        |
|----------------------|--------|------------------------------------|
| `/transcribe`        | POST   | Processes audio input to text      |
| `/calculate_wer`     | POST   | Computes WER and error lists       |
| `/detailed_analysis` | POST   | Returns JSON with metrics          |
| `/download_report`   | POST   | Generates PDF report               |
| `/image_to_text`     | POST   | Extracts text from images          |

---

## **Usage Guide**

### **Step 1: Input Methods**
- **Record Audio**: Click microphone icon and speak  
- **Upload File**: Drag-and-drop audio/image files  
- **Manual Input**: Type directly into text areas  

### **Step 2: Analysis**
```js
// script.js
analyzeText(hypothesis, reference)
// Triggers WER calculation and visual updates
```

### **Step 3: Export Results**
- **Interactive View**: Toggle detailed visualizations  
- **PDF Export**: One-click report generation  

---

## **Troubleshooting**

| Issue                    | Solution                         |
|--------------------------|----------------------------------|
| Microphone not working   | Check browser permissions        |
| OCR failures             | Install Tesseract v5+            |
| Audio conversion errors  | Verify FFmpeg installation       |
| High WER scores          | Reduce background noise          |

---

## **References**

- SpeechRecognition Docs: https://pypi.org/project/SpeechRecognition/  
- WER Calculation: [NIST Handbook](https://www.nist.gov/system/files/documents/itl/iad/mig/publications/AM_1.0_Handbook_Final.pdf)  
- SequenceMatcher: [Python difflib Docs](https://docs.python.org/3/library/difflib.html)  

---

## **Contact Information**

**Muhammad Abrash**  

📧 Email: [abrasharshad440@gmail.com](mailto:abrasharshad440@gmail.com)  
🔗 LinkedIn: [Abrash-Arshad](https://www.linkedin.com/in/abrash-arshad-205b172a7/)  
💻 GitHub: [Abrash-Official](https://github.com/Abrash-Official/Speech-Recognition-Analysis)  
🧠 LeetCode: [Nj5BdCiG0r](https://leetcode.com/u/Nj5BdCiG0r/)
