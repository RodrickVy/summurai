// =========================
//  app.js
// =========================

require("dotenv").config(); // Load .env variables

const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fileUpload = require("express-fileupload");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth"); // For Word documents (.docx)

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

// Safety check
if (!API_KEY) {
    console.error("❌ ERROR:Missing GEMINI_API_KEY in environment variables!");
    process.exit(1);
}

console.log("✅ Gemini API key loaded.");

// Gemini setup
const genAI = new GoogleGenerativeAI(API_KEY);
const generationConfig = { temperature: 0.9 };

const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig,
});

const app = express();

// ===== Middleware =====
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(
    cors({
        origin: ["https://learn.bcit.ca", "chrome-extension://*"],
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

const SRC_TEXT_PLACEHOLDER = "SRC_TEXT_PLACEHOLDER";

// ===== Prompt =====
const promptTemplate = `
You are an expert academic summarizer. Your task is to analyze the lecture transcript below and produce a clean, simple summary in the exact HTML structure provided.

INPUT

<<<BEGIN_LECTURE_CONTENT>>> ${SRC_TEXT_PLACEHOLDER} <<<END_LECTURE_CONTENT>>>

OUTPUT INSTRUCTIONS

<p><b>TLDR:</b> [1–2 sentence ultra-short summary of the entire lecture]</p>

<h6>Here are the main key points:</h6>
<ol>
  <li>[Key point 1]</li>
  <li>[Key point 2]</li>
  <li>[Key point 3]</li>
  <li>[Up to 10 total key points]</li>
</ol>

<p>[Short paragraph summarizing the main ideas of the lecture]</p>
<p>[Optional second paragraph giving any remaining important explanations]</p>

ADDITIONAL RULES

• Keep HTML extremely simple: only <p>, <b>, <ul>, <li>.  
• Maximum 10 bullet points.  
• Summaries must be factual and based only on the input text.  
• Do NOT invent or add new information.  
• Ignore noise such as stray HTML tags or PDF fragments.  
• Do NOT use headings, divs, classes, or markdown.
`;

// ===== Helpers =====
async function summarizeTextWithAPI(text) {
    if (!text || text.trim() === "") return "";

    const result = await model.generateContent(
        promptTemplate.replaceAll(SRC_TEXT_PLACEHOLDER, text)
    );

    return result.response.text().trim();
}

async function extractTextFromFile(file) {
    const mime = file.mimetype;

    if (mime === "application/pdf") {
        const { text } = await pdfParse(file.data);
        return text;
    }

    if (
        mime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mime === "application/msword"
    ) {
        const { value } = await mammoth.extractRawText({ buffer: file.data });
        return value;
    }

    // Fallback: treat as UTF-8 text
    return file.data.toString("utf-8");
}

// ====== Endpoints ======

// 1️⃣ Upload file → extract → summarize
app.post("/buffer-to-text", async (req, res) => {
    try {
        if (!req.files || !req.files.file) {
            return res.status(400).json({
                error: "File required (multipart/form-data, field name 'file'). Supported: PDF, Word, TXT",
            });
        }

        const file = req.files.file;
        const text = await extractTextFromFile(file);
        const summary = await summarizeTextWithAPI(text);

        res.json({ text, summary });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to parse and summarize file: " + err.message });
    }
});

// 2️⃣ Summarize plain text directly
app.post("/summarize-text", async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || text.trim() === "") {
            return res.status(400).json({ error: "Missing 'text' field in request body." });
        }

        const summary = await summarizeTextWithAPI(text);
        res.json({ summary });
    } catch (err) {
        console.error("❌ Error summarizing text:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

// ===== Start server =====
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
