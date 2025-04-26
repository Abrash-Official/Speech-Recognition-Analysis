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