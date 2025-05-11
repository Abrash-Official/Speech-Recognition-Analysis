# **SpeechWER Web Application**

[![Python 3.10+](https://img.shields.io/badge/Python-3.10.10-blue)](https://www.python.org/downloads/release/python-31010/)
[![Flask](https://img.shields.io/badge/Flask-3.0-blue)](https://flask.palletsprojects.com/)
[![Ffmpeg](https://img.shields.io/badge/Ffmpeg-4.2-blue)](https://github.com/BtbN/FFmpeg-Builds/releases)
[![ASM Model](https://img.shields.io/badge/ASM_Model-blue)](https://github.com/mozilla/DeepSpeech/releases/download/v0.9.3/deepspeech-0.9.3-models.pbmm)

---

## **Table of Contents**

1.  Project Overview
2.  System Architecture
3.  Installation Guide
4.  Key Features Explanation
5.  API Documentation
6.  Code Structure
7.  Usage Examples
9.  Troubleshooting
10. User Interface(UI)
11. References
12. Contact Information

---

### 1. Project Overview

The SpeechWER Analyzer is a software tool designed to convert speech to text, calculate the Word Error Rate, perform NLP analysis, provide interactive visualizations, and generate PDF reports [EDITOR#0]. It helps understand how Machine Learning, NLP, and Data Visualization are connected to these tasks (Overview: In This Term Project, You Need to Develop Software Which Will Convert Speech into Text Using Python and Whisper, Calculate Word Error Rate (WER), and Understand How Machine Learning, NLP, and Data Visualization Are Connected to These Tasks., n.d.).

<aside>

💻 **Tech Stack:**

```
- Flask
- Vanilla JS
- HTML/CSS
```
</aside>

**Core Features:**

1. Audio file transcription with DeepSpeech/Vosk ASR
2. Word Error Rate calculation
3. NLP analysis (tokenization, normalization, stemming, lemmatization, stop words)
4. Interactive visualization (confusion matrixs, error distributions, frequency distribution)
5. PDF report generation

---

### 2. System Architecture

**File Structure:**

```
SpeechWER/
├── app.py         # Flask backend
├── templates/
│   └── index.html   # Main UI
├── static/
│   ├── style.css    # Styling
│   └── script.js    # Frontend logic
└── requirements.txt # Dependencies
```

---

### 3. Installation Guide

**Requirements:**

- Python 3.9+ ([Python 3.10.10](https://www.python.org/downloads/release/python-31010/) Recommended)
- [FFmpeg](https://github.com/BtbN/FFmpeg-Builds/releases) installed (download ```ffmpeg-master-latest-win64-gpl.zip``` from the link)

**Step-by-Step:**

1. Clone the repository.(https://github.com/Abrash-Official/Speech-Recognition-Analysis)
2. `pip install -r requirements.txt`
3. Download [ASR models](https://github.com/mozilla/DeepSpeech/releases/download/v0.9.3/deepspeech-0.9.3-models.pbmm) (DeepSpeech/Vosk).
4. Configure hardware settings in `app.py`.

---

### 4. Key Features Explanation

**Audio Processing Pipeline:**

- Chunked audio handling (e.g., 60s segments)
- Parallel processing with `ThreadPoolExecutor`
- Real-time progress tracking

**WER Calculation:**

- Kensho-style normalization
- Word-level Levenshtein alignment
- Error classification (Substitutions/Deletions/Insertions)
- WER is calculated using the formula $$WER = \frac{S + D + I}{N}$$, where $S$ is the number of substitutions, $D$ is the number of deletions, $I$ is the number of insertions, and $N$ is the total number of words in the reference text (Overview: In This Term Project, You Need to Develop Software Which Will Convert Speech into Text Using Python and Whisper, Calculate Word Error Rate (WER), and Understand How Machine Learning, NLP, and Data Visualization Are Connected to These Tasks., n.d.). The *werpy* library can be used to calculate WER (Overview: In This Term Project, You Need to Develop Software Which Will Convert Speech into Text Using Python and Whisper, Calculate Word Error Rate (WER), and Understand How Machine Learning, NLP, and Data Visualization Are Connected to These Tasks., n.d.).

**NLP Pipeline Steps:**

- Tokenization
- Stemming
- Lemmatization

---

### 5. API Documentation

**Endpoints:**

- `POST /transcribe` - Audio transcription
- `POST /calculate_wer` - WER calculation
- `POST /nlp_analysis` - NLP processing
- `GET /download_report` - PDF generation

**Example: Transcribing Audio**

To transcribe an audio file, send a `POST` request to the `/transcribe` endpoint with the audio file attached.

```bash
curl -X POST -F "file=@audio.wav" http://localhost:5000/transcribe
```

**API Response Format:**

```json
{
    "wer": 0.15,
    "substitutions": ["word1", "word2"],
    "processing_time": "2.3s",
    "audio_duration": "30s"
}
```

---

### 6. Code Structure

**app.py Highlights:**

- `load_models()`: Initializes ASR engines
- `transcribe()`: Handles chunked audio processing
- `kensho_wer()`: Custom WER implementation
- `generate_analysis()`: Creates visualization assets

---

### 7. Usage Examples

**CLI Transcription:**

```bash
curl -X POST -F "file=@audio.wav" http://localhost:5000/transcribe
```

---

### 8. Optimization Guide

**Hardware Configuration:**

For 8GB RAM systems:

```python
MAX_CONCURRENT_CHUNKS = 4
BUFFER_SIZE = 4096  # NVMe optimized
```

---

### 9. Troubleshooting

**Common Issues:**

- "Model loading failed": Check model paths in `load_models()`
- "Memory overflow": Reduce `MAX_CONCURRENT_CHUNKS`
- "Audio decoding error": Verify FFmpeg installation

---

### 10. User Interface(UI)

Include visual examples of:

1. Progress bar during upload
2. Interactive WER visualization
3. PDF report sample

This documentation provides a solid foundation. Let me know if you'd like me to elaborate on any specific section or provide additional details.

---

### 11. References:

- SpeechRecognition Docs: https://pypi.org/project/SpeechRecognition/
- WER Calculation: [NIST Standards](https://www.nist.gov/system/files/documents/itl/iad/mig/publications/AM_1.0_Handbook_Final.pdf)
- SequenceMatcher: [Python difflib Docs](https://docs.python.org/3/library/difflib.html)

---

<aside>
    
☎️ **Contact Info:**

**Muhammad Abrash**

### Email:
[abrash.official100@gmail.com](mailto:abrash.official100@gmail.com)

### Linked In:
[Abrash-Arshad](https://www.linkedin.com/in/abrash-arshad-205b172a7/)

### LeetCode:
[Abrash-Official](https://leetcode.com/u/Nj5BdCiG0r/)

### GitHub:
[Abrash-Official](https://github.com/Abrash-Official/Speech-Recognition-Analysis)

</aside>
