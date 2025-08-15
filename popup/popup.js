document.getElementById("generate").addEventListener("click", async () => {
    const language = document.getElementById("language").value;
    const framework = document.getElementById("framework").value;
    const outputType = document.getElementById("outputType").value; // NEW
    const priorityOrder = [
        "data-testid", "id", "name", "placeholder",
        "aria-label", "for", "role", "text", "tag", "nth-child"
    ];
    const loader = document.getElementById("loader");
    loader.style.display = "block";
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content/content.js"]
        });
        chrome.tabs.sendMessage(
            tab.id,
            { action: "extractLocators", language, framework, outputType, priorityOrder },
            (response) => {
                loader.style.display = "none";

                if (chrome.runtime.lastError) {
                    document.querySelector("#output code").innerText = "❌ Error: Could not connect to the tab.";
                    Prism.highlightAll();
                    return;
                }

                document.querySelector("#output code").innerText = response?.locators || "No locators found.";
                Prism.highlightAll(); // highlight after inserting text
            }
        );
    } catch (err) {
        loader.style.display = "none";
        document.getElementById("output").value = "❌ Failed to inject script or connect.";
    }
});



// Fix: Correcting the event listener for the copy button to match the ID in the HTML
document.getElementById("copy").addEventListener("click", () => {
    const resultText = document.querySelector("#output code").innerText;
    if (resultText) {
        copyToClipboard(resultText);
        alert("Copied to clipboard!");
    }
});

// Function to copy text to clipboard
function copyToClipboard(text) {
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = text;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand("copy");
    document.body.removeChild(tempTextArea);
}
