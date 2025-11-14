Summurai – Chrome Extension + Local Summarization Server
Summurai is a lightweight Chrome extension that lets you summarize PDFs, Word documents, and plain text pages directly inside your browser.
The extension sends the content to a small local Node.js server that extracts the text and summarizes it using Google Gemini.

⭐ Features


Summarize any URL, whether it’s a PDF, DOCX, TXT, or normal webpage


Upload local files for instant summarization


Clean, simple summaries generated in structured HTML


Zero external backend — everything runs locally on your computer



📦 1. Installation
Step 1 — Download the project folder
Download or clone the entire folder:
summurai/
├── extension/
├── server/
├── logo.png
├── README.md

Step 2 — Install server dependencies
cd server
npm install

Step 3 — Add your Gemini API key
Create a .env file:
GEMINI_API_KEY=your_api_key_here
PORT=3000


🚀 2. Start the Local Server
Run:
node app.js

If it works, you’ll see:
🚀 Server running at http://localhost:3000

Keep this terminal window open while using the extension.

🧩 3. Load the Chrome Extension (Developer Mode)


Open Chrome


Go to:
chrome://extensions



Enable Developer Mode (top right switch)


Click Load Unpacked


Select the extension/ folder from the project


The extension will instantly load, and you’ll see the icon (logo.png).

📝 4. How to Use the Extension
Option A — Summarize the current webpage


Open any webpage or online PDF


Click the Summurai extension icon


Press Summarize


The extension detects whether the URL contains:


Plain HTML


PDF


Word (.docx)


Other text formats




The summary appears inside the popup window



Option B — Upload a file
You can also upload:


PDF


DOCX


TXT


The server will extract text and summarize automatically.

🛠 5. Project Structure
summurai/
├── extension/
│    ├── popup.html
│    ├── popup.js
│    ├── index.js
│    ├── manifest.json
│    └── logo.png
│
├── server/
│    ├── app.js
│    ├── package.json
│    └── .env
│
└── README.md


⚡ 6. Troubleshooting
❌ Extension says "Server not available"
Make sure you ran:
node app.js

And the terminal shows:
Server running at http://localhost:3000


❌ Summaries aren’t working
Make sure your .env has a valid Gemini API key:
GEMINI_API_KEY=xxxxx


🎉 Done!
You now have a fully working local summarization engine + Chrome extension.
Anyone can use it simply by downloading the folder and loading the extension in Developer Mode.
If you'd like, I can also:
✅ Create a ZIP distribution
✅ Add screenshots to the README
✅ Add a "first-time setup" wizard in the extension
✅ Add one-click install script
Just tell me!