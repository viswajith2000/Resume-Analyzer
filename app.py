from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from groq import Groq
from dotenv import load_dotenv
import pdfplumber
import os
import json
import io

load_dotenv()

app = Flask(__name__)
CORS(app)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        if "resume" not in request.files:
            return jsonify({"error": "No resume file uploaded."}), 400

        resume_file = request.files["resume"]
        job_description = request.form.get("job_description", "").strip()

        if not resume_file.filename:
            return jsonify({"error": "No resume file selected."}), 400

        if not job_description:
            return jsonify({"error": "Job description is required."}), 400

        # Extract text from PDF
        pdf_bytes = resume_file.read()
        resume_text = ""
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    resume_text += text + "\n"

        if not resume_text.strip():
            return jsonify({"error": "Could not extract text from the PDF. Please ensure it is not a scanned image."}), 400

        # Build prompt
        prompt = f"""Resume:
{resume_text}

Job Description:
{job_description}"""

        system_prompt = """You are an expert resume analyzer and career coach. Analyze the resume against the job description and return ONLY a valid JSON object with exactly these fields:
- score: integer 0-100 (how well the resume matches the job)
- matched_skills: array of strings (skills/keywords found in both resume and job description)
- missing_skills: array of strings (important skills in job description missing from resume)
- tips: array of 3-5 specific improvement suggestions as strings
- verdict: single string summary (1-2 sentences, encouraging tone)
Return ONLY the JSON object, no markdown, no explanation."""

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=1024,
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        result = json.loads(raw)
        return jsonify(result)

    except json.JSONDecodeError:
        return jsonify({"error": "Failed to parse AI response. Please try again."}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
