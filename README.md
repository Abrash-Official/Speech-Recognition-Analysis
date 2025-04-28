# Introduction:

I’m Abrash student of 4th Semester. Pursuing Computer Science from IAC(Instritute For Arts & Culture). In my 4th semester of BSCS I enrolled in an Artificial Intelligance Course started by NAVTTC and start working on this project after getting knowledge about NLP. This project is only based vibe coding.

My goal is to create a **Speech Recognition Analysis** model with the help of **PYTHON Programming Language**.

---

### Begin:

I start my project by breaking down that into small modules and prompt DeepSeek for modules 1 by 1, test the modules and add it to my project. This step help me alote instead of asking DeepSeek for the entire project at a single time that might create mess. These modules are given below:

## 1. Breaking the **Speech Recognition Analysis:**

1. Speech to text 
2. Word Error Rate(wer) + Words that are impacting the **WER**
3. **Machine Learning** Concept Map with **WER**
4. **NLP**(Natural Language Processing) —>(How Involve?)
5. Shows output in HTML File

# 1. Speech to Text:

There are usually 3 ways to convert speech to text:

1. Audio File to Text
2. Record & Transcribe
3. Live Transcription

<aside>
2️⃣

I use the 2nd one. My model first Record the audio from the device’s microphone first and then start processing and convert that audio into text.

</aside>

My first prompt was to do these steps:

<aside>
✏️

## Prompt:

---

Act as a python programmer

and create a python code for me that can able to convert speech into text.
i will use my own mic.

and i'm working on Windows 11 in vs code

</aside>

And i get this code:

```python
# Import necessary libraries
import speech_recognition as sr

def speech_to_text():
    # Create a recognizer instance
    recognizer = sr.Recognizer()

    # Use the default microphone as the audio source
    with sr.Microphone() as source:
        print("Adjusting for ambient noise...")
        recognizer.adjust_for_ambient_noise(source, duration=1)
        print("Listening... Speak now!")

        try:
            # Listen to the microphone input
            audio = recognizer.listen(source, timeout=5, phrase_time_limit=10)
            print("Processing...")

            # Use Google Web Speech API to recognize the audio
            text = recognizer.recognize_google(audio)
            return text

        except sr.WaitTimeoutError:
            return "No speech detected within the timeout period"
        except sr.UnknownValueError:
            return "Could not understand audio"
        except sr.RequestError as e:
            return f"Could not request results; {e}"

if __name__ == "__main__":
    while True:
        print("\nSay something (or say 'exit' to quit):")
        result = speech_to_text()
        print(f"Recognized: {result}")
        
        if result.lower() == 'exit':
            break
```

---

<aside>
✏️

## Output

---

### **Actual Text:**

kya bat hy yr kya bat hy

---

### **Recognized Text:**

kya baat hai yaar kya

</aside>

### Instruction:

This code able to record from the microphone and convert that speech into text. But before going to run this code we have to install these libraries:

```bash
pip install SpeechRecognition pyaudio
```

---

## **How to use:**

1. Save the code as **`speech_to_text.py`**
2. Run the script
3. Speak when you see "Listening... Speak now!"
4. Say "exit" to stop the program

---

## **Features:**

- Automatic ambient noise adjustment
- 5-second timeout for speech start detection
- 10-second maximum phrase length
- Continuous listening loop
- Error handling for common recognition issues

---

### Notes:

- Requires an internet connection (uses Google's web API)
- Make sure your microphone is enabled in Windows settings
- First run might take longer while initializing components
- You can adjust the timeout and phrase_time_limit parameters for different listening duration

---

### **Troubleshooting:**

1. If you get microphone errors:
    - Check microphone privacy settings in Windows
    - Ensure microphone is properly connected
2. If you get recognition errors:
    - Speak clearly and louder
    - Reduce background noise
    - Check your internet connection

---

# 2. Word Error Rate(wer) + Words that are impacting the **WER**

## Definition:

**Word Error Rate (WER)** is a metric used to measure how **accurate** a generated text (e.g., from a speech-to-text system) is compared to a reference (correct) text. It **calculates the percentage** of words that are **incorrect** due to **substitutions, deletions, or insertions**. For example, if a transcription system mishears "cat" as "hat," skips a word, or adds extra words, WER quantifies these errors.

## **Formula for WER:**

![WER.png](attachment:93887b9a-6df4-491e-96e1-2ff54eade1e2:WER.png)

- **Substitutions**: Correct word replaced with a wrong word.
- **Deletions**: A word from the reference is missing.
- **Insertions**: Extra word added that’s not in the reference.

<aside>
✏️

**Note**: WER can exceed 100% if there are many insertions!

</aside>

## Example:

<aside>
✏️

### **Reference Text:**

kya bat hy yr kya bat hy

### **Recognized Text:**

kya baat hai yaar kya

### Substitutions(S):

🔁 bat → baat

🔁 hy → hai

🔁 yr → yaar

**`Length = 3`**

### Deletion(D):

❌ Deleted: bat

❌ Deleted: hy

**`Length = 2`** 

### Insertion(I):

**`Length = 0`** 

---

### Manually **Apply the Formula**:

**WER = (3 + 2 + 0 / 7) X 100% ⇒ 0.7142857 X 100% ⇒ 71.4285…%**

### Predicted WER ⇒ 71.43%

</aside>

<aside>
✏️

## 2nd Prompt:

---

Now i want you add the word error rate in this code as well.

</aside>

## Code:

```python
import speech_recognition as sr
import jiwer

def calculate_wer(reference, hypothesis):
    """Calculate WER and return errors with original casing"""
    # Normalize texts while preserving original words for display
    ref = jiwer.ToLowerCase()(reference.strip())
    hyp = jiwer.ToLowerCase()(hypothesis.strip())
    
    ref_words = reference.strip().split()
    hyp_words = hypothesis.strip().split()
    ref_normalized = ref.split()
    hyp_normalized = hyp.split()

    if not ref_normalized:
        print("Warning: Reference text is empty")
        return 0.0, [], [], []

    try:
        details = jiwer.wer_details(ref_normalized, hyp_normalized)
    except Exception as e:
        print(f"Alignment error: {str(e)}")
        return 1.0, [], [], []

    substitutions = []
    deletions = []
    insertions = []

    for op in details.operations:
        if op.type == 'substitute':
            orig_ref = ref_words[op.ref_start_idx] if op.ref_start_idx < len(ref_words) else ""
            orig_hyp = hyp_words[op.hyp_start_idx] if op.hyp_start_idx < len(hyp_words) else ""
            substitutions.append(f"{orig_ref} → {orig_hyp}")
        elif op.type == 'delete':
            deletions.append(ref_words[op.ref_start_idx])
        elif op.type == 'insert':
            insertions.append(hyp_words[op.hyp_start_idx])

    total_errors = details.substitutions + details.deletions + details.insertions
    wer_score = total_errors / len(ref_normalized)
    
    return wer_score, substitutions, deletions, insertions  # Now returns 4 values consistently

# Rest of the code remains the same as previous version
```

### Instruction:

This code able to calculate the WER of our provided data. But before going to run this code we have to install this librarie:

```bash
pip install jiwer
```

---

<aside>
🖥️

## Output:

## Speech-to-Text with WER Calculator

---

```
Enter reference text (or 'exit' to quit): kya bat hy yr kya bat hy

Speak the reference sentence now:
Adjusting for ambient noise...
Listening... Speak now!
Processing...

Recognized Text: kya baat hai yaar kya

Substitutions: bat → baat, hy → hai, yr → yaar
Deletions: bat, hy
Insertion: 
```

### Word Error Rate: 71.43%

</aside>

---

# **3. Machine Learning** Concept Map with **WER:**

**Only one concept** **of Machine Learning** directly applies in my code.Which is **Confusion Matrix.** And detailed explain below:

## **Error Analysis (Similar to Confusion Matrix):**

### Define:

A **Confusion Matrix** is a table that helps us understand mistakes made by a computer program. It categorizes errors into types like "wrong answers" (substitutions), "missed answers" (deletions), and "extra guesses" (insertions).

---

## **How It’s Used in My Code:**

<aside>
🖥️

My code performs **error analysis** similar to a confusion matrix but for speech recognition:

---

### **1. Substitutions**

- **What**: The computer replaced a correct word with a wrong one.
- **Example**:
    - Reference: "bat"
    - Recognized: "baat"
    - **Formula**: Counted as 1 substitution error.

### **2. Deletions**

- **What**: The computer missed a word entirely.
- **Example**:
    - Reference: "hy"
    - Recognized: (nothing)
    - **Formula**: Counted as 1 deletion error.

### **3. Insertions**

- **What**: The computer added an extra word that wasn’t there.
- **Example**:
    - Reference: (nothing)
    - Recognized: "hai"
    - **Formula**: Counted as 1 insertion error.
</aside>

---

# **Comparison to Confusion Matrix**

| **Your Code’s Error Types** | **Confusion Matrix Equivalent** |
| --- | --- |
| Substitutions | False Positives/Negatives |
| Deletions | False Negatives |
| Insertions | False Positives |

---

# **Other Concepts**

Most concepts (e.g., Decision Trees, K-means, Logistic Regression) are **not used** in my code. My code focuses on **evaluating performance** (like grading a test) rather than **training models** (like teaching a student).

---

# **4. NLP**(Natural Language Processing) —>(How Involve?):

---

These are following few terms of NLP that are used in my code: 

### **1. Natural Language Processing (NLP)**

**What it is**: Teaching computers to work with human language.

**Used in your code**: Your entire code is an NLP application! It converts speech to text and analyzes errors.

**Example**:

- **`speech_to_text()`** uses NLP to turn spoken words into written text.

### **2. Tokenization**

**What it is**: Splitting text into words.

**Used in your code**:

```python
# Splits reference/hypothesis into word tokens
reference.split() → ["kya", "bat", "hy", "yr", ...]
hypothesis.split() → ["kya", "baat", "hai", ...]
```

### **3. Normalization**

**What it is**: Making text uniform (e.g., lowercase).

**Used in your code**:

```python
# Lowercase conversion for case-insensitive comparison
ref = reference.strip().lower()
hyp = hypothesis.strip().lower()
```

### **4. Speech Recognition**

**What it is**: Converting spoken words to text.

**Used in your code**:

```python
recognizer.recognize_google(audio)  # Uses Google's speech recognition API
```

---

# 5. Shows output in HTML File:

---

Now after getting all the knowledge, my last point was to show all the output in an html file. So, I prompt DeepSeek this:

<aside>
✏️

## Prompt:

---

now i want you to re write all the code again but this time i want to see the output in a html file. You have to create an html file and show all the output in that file. if the same name file already exist in the diractory han replae the new html file with the previous one.

and i would like if you will add a bit stype in that html file with the use of css.

</aside>

## Code:

```python
import speech_recognition as sr
from difflib import SequenceMatcher
from datetime import datetime
import os

HTML_FILENAME = "speech_report.html"

def create_html_report(reference, hypothesis, wer_score, subs, dels, inss):
    """Create styled HTML report with results"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Speech Recognition Report</title>
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                max-width: 800px;
                margin: 20px auto;
                padding: 20px;
                background-color: #f0f2f5;
            }}
            .report-container {{
                background: white;
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                padding: 25px;
            }}
            h1 {{
                color: #1a73e8;
                border-bottom: 2px solid #1a73e8;
                padding-bottom: 10px;
            }}
            .section {{
                margin: 20px 0;
                padding: 15px;
                border-radius: 8px;
            }}
            .reference {{ background-color: #e8f0fe; }}
            .result {{ background-color: #f6f9fe; }}
            .wer {{
                font-size: 1.2em;
                color: { "#4CAF50" if wer_score < 0.5 else "#ff6b6b" };
                font-weight: bold;
                margin: 15px 0;
            }}
            .errors div {{
                margin: 8px 0;
                padding: 8px;
                border-left: 4px solid;
            }}
            .substitution {{ border-color: #ffa726; background-color: #fff3e0; }}
            .deletion {{ border-color: #ef5350; background-color: #ffebee; }}
            .insertion {{ border-color: #66bb6a; background-color: #e8f5e9; }}
            .timestamp {{ 
                color: #666;
                font-size: 0.9em;
                text-align: right;
                margin-top: 20px;
            }}
        </style>
    </head>
    <body>
        <div class="report-container">
            <h1>Speech Recognition Analysis</h1>
            
            <div class="section reference">
                <h2>Reference Text</h2>
                <p>{reference}</p>
            </div>
            
            <div class="section result">
                <h2>Recognized Text</h2>
                <p>{hypothesis}</p>
            </div>
            
            <div class="wer">
                Word Error Rate: {wer_score:.2%}
            </div>
            
            <div class="errors">
                {"".join(f'<div class="substitution">🔁 {s}</div>' for s in subs)}
                {"".join(f'<div class="deletion">❌ Deleted: {d}</div>' for d in dels)}
                {"".join(f'<div class="insertion">➕ Added: {i}</div>' for i in inss)}
            </div>
            
            <div class="timestamp">
                Report generated: {timestamp}
            </div>
        </div>
    </body>
    </html>
    """
    
    with open(HTML_FILENAME, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"\nReport saved to {HTML_FILENAME}")

def calculate_wer(reference, hypothesis):
    """Calculate WER with custom alignment using difflib"""
    ref = reference.strip().lower().split()
    hyp = hypothesis.strip().lower().split()
    
    matcher = SequenceMatcher(None, ref, hyp)
    substitutions = []
    deletions = []
    insertions = []
    
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'replace':
            subs = list(zip(ref[i1:i2], hyp[j1:j2]))
            substitutions.extend([f"{r} → {h}" for r, h in subs])
        elif tag == 'delete':
            deletions.extend(ref[i1:i2])
        elif tag == 'insert':
            insertions.extend(hyp[j1:j2])
    
    total_errors = len(substitutions) + len(deletions) + len(insertions)
    wer_score = total_errors / len(ref) if ref else 1.0
    
    return wer_score, substitutions, deletions, insertions

def speech_to_text():
    recognizer = sr.Recognizer()
    with sr.Microphone() as source:
        print("Adjusting for ambient noise...")
        recognizer.adjust_for_ambient_noise(source, duration=1)
        print("Listening... Speak now!")
        
        try:
            audio = recognizer.listen(source, timeout=5, phrase_time_limit=10)
            print("Processing...")
            return recognizer.recognize_google(audio)
        except sr.WaitTimeoutError:
            print("No speech detected")
            return None
        except sr.UnknownValueError:
            print("Audio unclear")
            return None
        except sr.RequestError as e:
            print(f"API error: {e}")
            return None

if __name__ == "__main__":
    print("Speech-to-Text with HTML Reporting")
    print("-----------------------------------\n")
    
    while True:
        reference = input("Enter reference text (or 'exit'): ").strip()
        if reference.lower() == 'exit':
            break
            
        print("\nSpeak the text now:")
        hypothesis = speech_to_text()
        
        if not hypothesis:
            print("Skipping due to recognition error\n")
            continue
            
        wer_score, subs, dels, inss = calculate_wer(reference, hypothesis)
        
        # Generate HTML report
        create_html_report(
            reference=reference,
            hypothesis=hypothesis,
            wer_score=wer_score,
            subs=subs,
            dels=dels,
            inss=inss
        )
        
        print("\n" + "="*50 + "\n")
```

## Output:

![NLP Project Output](https://github.com/user-attachments/assets/889dac66-e17d-437c-8a75-a7bc64fca739)

---

# End:

Thats the main goal of my project that I have to show my output in an HTML file. With **Reference Text, Recognition Text, Word Error Rate**.

---

# References:

### DeepSeek Chat Link:

<aside>
🔗

https://chat.deepseek.com/a/chat/s/93c4c7fd-f301-4df1-bcf1-9ce5eecd6b65

</aside>

### NLP Terms:

[NLP Glossary Table (Beginner Level).pdf](attachment:ff9debae-dede-4954-9ee7-b36b1b1c83a4:NLP_Glossary_Table_(Beginner_Level).pdf)

---

<aside>
☎️

## Contact Info:

### Email:

abrasharshad440@gmail.com

### Linked In:

https://www.linkedin.com/in/abrash-arshad-205b172a7/

### LeetCode:

https://leetcode.com/u/Nj5BdCiG0r/

### GitHub:

https://github.com/Abrash-Official/Speech-Recognition-Analysis

### Notion Notes:

https://www.notion.so/speech-recognition-analysis-by-abrash/Speech-Recognition-Analysis-1cf99097dbf380fbab6bede08a836142

</aside>
