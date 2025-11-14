// ====== Configuration ======
const BCIT_BASE_URL = "https://learn.bcit.ca/d2l/le/content/";
const VALID_PATH_LENGTHS = [3, 4];

// ====== Initialization ======
chrome.runtime.onInstalled.addListener(() => {
    console.log("✅ Service worker initialized");
});

// ====== URL Pattern Matching ======
function matchesBCITPattern(url) {
    if (!url || !url.startsWith(BCIT_BASE_URL)) {
        return false;
    }

    const pathSegments = extractPathSegments(url);
    return VALID_PATH_LENGTHS.includes(pathSegments.length);
}

function extractPathSegments(url) {
    const pathAfterBase = url.substring(BCIT_BASE_URL.length);
    const cleanPath = pathAfterBase.replace(/\/$/, "");
    return cleanPath.split("/").filter((segment) => segment.length > 0);
}

// ====== ID Extraction ======
function extractIdsFromUrl(url) {
    if (!url) return null;

    try {
        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname
            .split("/")
            .filter((segment) => segment.length > 0);

        const courseId = pathSegments[3];
        const resourceId = pathSegments[5];

        if (!isValidId(courseId) || !isValidId(resourceId)) {
            console.warn("Invalid IDs extracted:", { courseId, resourceId });
            return null;
        }

        return { courseId, resourceId };
    } catch (error) {
        console.error("Error parsing URL:", error);
        return null;
    }
}

function isValidId(id) {
    return id && /^\d+$/.test(id);
}

// ====== URL Construction ======
function buildDownloadUrl(courseId, resourceId) {
    return `${BCIT_BASE_URL}/${courseId}/topics/files/download/${resourceId}/DirectFileTopicDownload`;
}

// ====== Script Injection ======
async function injectContentScript(tabId, downloadUrl) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            func: initializeContentScript,
            args: [downloadUrl],
        });
        console.log("Content script injected successfully");
    } catch (error) {
        console.error("Error injecting content script:", error);
        throw error;
    }
}

// ====== Tab Event Handlers ======
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete" || !tab.url) {
        return;
    }

    console.log("🔍 Tab updated:", tab.url);

    if (!matchesBCITPattern(tab.url)) {
        console.log("URL doesn't match pattern, skipping");
        return;
    }

    const ids = extractIdsFromUrl(tab.url);
    if (!ids) {
        console.error("Failed to extract IDs from URL");
        return;
    }

    const downloadUrl = buildDownloadUrl(ids.courseId, ids.resourceId);
    await injectContentScript(tabId, downloadUrl);
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);

        if (tab.url && matchesBCITPattern(tab.url)) {
            console.log("✅ Activated tab matches pattern:", tab.url);
        }
    } catch (error) {
        console.error("❌ Error checking activated tab:", error);
    }
});

// ============================================
// CONTENT SCRIPT (Injected Function)
// ============================================

// FINAL MERGED CONTENT SCRIPT WITH PDF UPLOAD + SPINNERS + REFACTORS
// ================================================================
// This script contains:
//  - Spinner on main button
//  - Spinner on mini-bar
//  - Spinner inside popup
//  - Unified setLoading()
//  - File fetch → PDF detect → Upload → Backend summarize
//  - Full replacement as requested

function initializeContentScript(downloadUrl) {
    if (window.hubSummerizerInjected) return;
    window.hubSummerizerInjected = true;

    const state = {
        popup: {
            isMinimized: false,
            isExpanded: false,
            hasSummarized: false,
            summaryText: "",
            isLoading: false,
        },
        position: {
            button: { bottom: "20px", right: "20px" },
            popup: { side: "right" },
        },
    };

    // ==========================
    // FETCH + PDF PARSE LOGIC
    // ==========================
    async function fetchContent(url) {
        try {
            setLoading(true);
            state.popup.hasSummarized = true;

            const response = await fetch(url);
            const contentType = response.headers.get("content-type") || "";

            let text = "";
            let summary = "";

            if (contentType.startsWith("text/")) {
                // It's a plain text file → send to /summarize-text
                text = await response.text();
                const apiResponse = await fetch("http://localhost:3000/summarize-text", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text }),
                });
                const result = await apiResponse.json();
                summary = result.summary || "No summary returned.";
            } else {
                // Binary file (PDF, DOC, DOCX, etc.) → send to /buffer-to-text
                const blob = await response.blob();
                text = await blob.text().catch(() => ""); // fallback if can't read text
                const file = new File([blob], "document", { type: blob.type || "application/octet-stream" });
                const formData = new FormData();
                formData.append("file", file);

                const apiResponse = await fetch("http://localhost:3000/buffer-to-text", {
                    method: "POST",
                    body: formData,
                });
                const result = await apiResponse.json();
                summary = result.summary || "No summary returned.";
                text = result.text || text;
            }

            updateSummary(summary);
            setLoading(false);
            return { text, summary };
        } catch (err) {
            console.error("❌ Fetch error:", err);
            setLoading(false);
            return { text: "", summary: "" };
        }
    }

    function updateSummary(text) {
        const el = document.getElementById("summaryText");
        if (el) el.innerHTML = text;
        state.popup.summaryText = text;
    }

    // ==========================
    // SPINNER CONTROL
    // ==========================
    function setLoading(isLoading) {
        state.popup.isLoading = isLoading;

        // Main big button
        const mainBtn = document.getElementById("summarizeBtn");
        if (mainBtn) {
            mainBtn.disabled = isLoading;
            const spin = document.getElementById("summarizeBtnSpinner");
            const label = document.getElementById("summarizeBtnLabel");
            if (spin) spin.style.display = isLoading ? "inline-block" : "none";
            if (label) label.style.opacity = isLoading ? "0.6" : "1";
        }

        // Mini bar
        const miniBar = document.getElementById("miniBar");
        if (miniBar) {
            const miniBtn = [...miniBar.querySelectorAll("button")].find(b => b.textContent.includes("Summarize"));
            if (miniBtn) {
                miniBtn.disabled = isLoading;
                const miniSpin = miniBtn.querySelector(".miniSummarizeSpinner");
                const miniLabel = miniBtn.querySelector(".miniSummarizeLabel");
                if (miniSpin) miniSpin.style.display = isLoading ? "inline-block" : "none";
                if (miniLabel) miniLabel.style.opacity = isLoading ? "0.5" : "1";
            }
        }

        // Popup spinner
        const popupSpin = document.getElementById("popupSpinner");
        if (popupSpin) popupSpin.style.display = isLoading ? "block" : "none";
    }

    // ==========================
    // UI LOADERS
    // ==========================
    function loadExternalResources() {
        loadStylesheet("bootstrap-css", "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css");
        loadStylesheet("bootstrap-icons", "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css");
    }

    function loadStylesheet(id, href) {
        if (!document.getElementById(id)) {
            const link = document.createElement("link");
            link.id = id;
            link.rel = "stylesheet";
            link.href = href;
            document.head.appendChild(link);
        }
    }

    // ==========================
    // MAIN SUMMARIZE BUTTON
    // ==========================
    function createSummarizeButton() {
        loadExternalResources();

        const btn = document.createElement("button");
        btn.id = "summarizeBtn";
        btn.className = "btn btn-primary d-flex align-items-center gap-2";
        btn.innerHTML = `
            <span id="summarizeBtnSpinner" class="spinner-border spinner-border-sm" style="display:none;"></span>
            <i class="bi bi-lightning-charge-fill"></i>
            <span id="summarizeBtnLabel">Summarize</span>
        `;

        Object.assign(btn.style, {
            position: "fixed",
            bottom: state.position.button.bottom,
            right: state.position.button.right,
            zIndex: "1000",
        });

        btn.addEventListener("click", () => {
            openSummaryPopup();
            removeSummarizeButton();
        });

        document.body.appendChild(btn);
    }

    function removeSummarizeButton() {
        const btn = document.getElementById("summarizeBtn");
        if (btn) btn.remove();
    }

    function openSummaryPopup() {
        if (document.getElementById("summaryPopup")) return;

        const popup = document.createElement("div");
        popup.id = "summaryPopup";
        popup.className = "shadow-lg bg-white border rounded";

        Object.assign(popup.style, {
            position: "fixed",
            zIndex: "2000",
            top: "10px",
            height: "calc(100vh - 60px)",
            width: "33vw",
            right: "10px",
        });

        popup.innerHTML = getPopupHTML();
        document.body.appendChild(popup);

        attachPopupEventListeners();

        if (state.popup.isLoading) {
            const popupSpin = document.getElementById("popupSpinner");
            if (popupSpin) popupSpin.style.display = "block";
        }
    }

    function getPopupHTML() {
        return `
            <div class="d-flex justify-content-between align-items-center border-bottom p-2 bg-light">
                <strong>Summary</strong>
                <div class="d-flex gap-2">
                    <button id="reloadBtn" class="btn btn-sm btn-outline-secondary"><i class="bi bi-arrow-clockwise"></i></button>
                    <button id="minimizeBtn" class="btn btn-sm btn-outline-secondary"><i class="bi bi-dash"></i></button>
                </div>
            </div>
            <div id="popupContent" class="p-3" style="height: calc(100% - 90px); overflow-y: auto;">
                <p id="summaryText">${state.popup.summaryText}</p>
            </div>
            <div class="border-top p-2 text-end" style="position:absolute;bottom:0;width:100%;">
                <button id="downloadBtn" class="btn btn-success"><i class="bi bi-download"></i> Download</button>
            </div>
        `;
    }

    function attachPopupEventListeners() {
        document.getElementById("minimizeBtn")?.addEventListener("click", minimizePopup);
        document.getElementById("reloadBtn")?.addEventListener("click", () => fetchContent(downloadUrl));
        document.getElementById("downloadBtn")?.addEventListener("click", downloadSummary);
    }

    function minimizePopup() {
        closePopup();
        state.popup.isMinimized = true;
        createMiniBar();
    }

    function closePopup() {
        const popup = document.getElementById("summaryPopup");
        if (popup) popup.remove();
    }

    function createMiniBar() {
        removeMiniBar();

        const bar = document.createElement("div");
        bar.id = "miniBar";
        bar.className = "btn-group shadow";

        Object.assign(bar.style, {
            position: "fixed",
            bottom: state.position.button.bottom,
            right: state.position.button.right,
            zIndex: "1500",
        });

        bar.appendChild(createMiniBtn());
        bar.appendChild(createExpandBtn());

        document.body.appendChild(bar);
    }

    function createMiniBtn() {
        const btn = document.createElement("button");
        btn.className = "btn btn-primary";
        btn.innerHTML = `
            <span class="miniSummarizeSpinner spinner-border spinner-border-sm" style="display:none;"></span>
            <span class="miniSummarizeLabel">Summarize</span>
        `;
        btn.onclick = () => {
            expandPopup();
            fetchContent(downloadUrl);
        };
        return btn;
    }

    function createExpandBtn() {
        const btn = document.createElement("button");
        btn.className = "btn btn-outline-primary";
        btn.innerHTML = '<i class="bi bi-arrows-angle-expand"></i>';
        btn.onclick = expandPopup;
        return btn;
    }

    function removeMiniBar() {
        const bar = document.getElementById("miniBar");
        if (bar) bar.remove();
    }

    function expandPopup() {
        removeMiniBar();
        openSummaryPopup();
        state.popup.isMinimized = false;
    }

    function downloadSummary() {
        const blob = new Blob([state.popup.summaryText], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "summary.txt";
        link.click();
    }

    // INITIALIZE
    createSummarizeButton();
    fetchContent(downloadUrl);
}
