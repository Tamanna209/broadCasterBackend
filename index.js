const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());
app.use(express.json());

let browser = null;
let page = null;
let isLoggedIn = false;

// Helper function for delays (waitForTimeout replacement)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ------------------------------------------
// INIT WHATSAPP (only once)
// ------------------------------------------
async function initWhatsApp() {
  if (browser && page && isLoggedIn) {
    console.log("Already logged in.");
    return;
  }

  console.log("Launching WhatsApp...");

  browser = await puppeteer.launch({
    headless: false,
    args: ["--start-maximized", "--disable-notifications"],
    defaultViewport: null,
  });

  page = await browser.newPage();
  await page.goto("https://web.whatsapp.com", {
    waitUntil: "networkidle2",
    timeout: 0,
  });

  console.log("Please scan QR code...");

  // wait until QR disappears
  await page.waitForSelector("canvas", { timeout: 0 });
  await page.waitForSelector('div[data-tab="3"]', { timeout: 0 });

  console.log("Logged in successfully!");
  isLoggedIn = true;
}

// ------------------------------------------
// Send Message ONE-BY-ONE
// ------------------------------------------
async function sendToNumber(mobile, message, autoSend = true) {
  console.log("Sending to:", mobile);

  const url = `https://web.whatsapp.com/send?phone=${mobile}`;

  // Open a new page for each number to avoid navigation races and keep session cookies
  const sendPage = await browser.newPage();
  try {
    await sendPage.setDefaultNavigationTimeout(60000);
    await sendPage.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    const inputSelector = 'div[contenteditable="true"]';

    // Wait for either the input to appear or an error/invalid-number notice
    await sendPage.waitForFunction(
      () => {
        return (
          !!document.querySelector('div[contenteditable="true"]') ||
          !!document.querySelector("div[role='alert']")
        );
      },
      { timeout: 30000 }
    );

    // Check if there's an alert (invalid number / cannot chat)
    const alertHandle = await sendPage.$("div[role='alert']");
    if (alertHandle) {
      const alertText = await sendPage.evaluate(
        (el) => el.innerText || el.textContent,
        alertHandle
      );
      console.log(
        "Skipping",
        mobile,
        "- alert shown:",
        alertText && alertText.trim().slice(0, 100)
      );
      await sendPage.close();
      return;
    }

    if (autoSend) {
      // Wait longer for the chat window to fully load
      await delay(3000);

      // The chat input appears only when the chat is fully loaded
      // It's specifically in the footer area, not the search bar
      const inputSelector =
        'div[contenteditable="true"][aria-label*="message" i], div[contenteditable="true"][data-tab="10"]';

      // Try to find the actual chat input (not search box)
      let inputFound = false;
      for (let i = 0; i < 10; i++) {
        const inputs = await sendPage.$$('div[contenteditable="true"]');
        if (inputs && inputs.length > 0) {
          // The message input is usually the last contenteditable div
          const lastInput = inputs[inputs.length - 1];
          const ariaLabel = await sendPage.evaluate(
            (el) => el.getAttribute("aria-label"),
            lastInput
          );

          // Check if this is the message input (has "message" or "type" in aria-label)
          if (
            ariaLabel &&
            (ariaLabel.toLowerCase().includes("message") ||
              ariaLabel.toLowerCase().includes("type"))
          ) {
            inputFound = true;
            break;
          }
        }
        await delay(500);
      }

      if (!inputFound) {
        console.log("Failed for", mobile, "- chat message input not found");
        await sendPage.close();
        return;
      }

      // Click on the message input area (bottom of chat)
      const inputs = await sendPage.$$('div[contenteditable="true"]');
      const messageInput = inputs[inputs.length - 1];
      await sendPage.evaluate((el) => el.click(), messageInput);
      console.log("Chat input focused for:", mobile);
      await delay(500);

      // Type the message into the chat input
      await sendPage.evaluate(
        (el, msg) => {
          el.textContent = "";
          el.focus();
          document.execCommand("insertText", false, msg);
        },
        messageInput,
        message
      );
      console.log(
        "Message typed in chat for:",
        mobile,
        "- Content:",
        message.slice(0, 50)
      );
      await delay(700);

      // Send the message by pressing Enter
      await sendPage.keyboard.press("Enter");
      console.log("Enter pressed for:", mobile);
      await delay(2500);

      console.log("Message sent successfully to:", mobile);
      await sendPage.close();
    } else {
      // Leave the chat open for manual typing/sending by the user
      console.log("Opened chat for manual send:", mobile);
      // intentionally not closing sendPage so user can interact
    }
  } catch (err) {
    console.log("Failed for", mobile, err && err.message);
    try {
      await sendPage.close();
    } catch (e) {}
  }
}

// ------------------------------------------
// API ROUTE
// ------------------------------------------
app.post("/send-messages", async (req, res) => {
  // Accept either `numbersList` (preferred) or `numbers` (from older frontends)
  let numbersList = req.body.numbersList || req.body.numbers || [];
  const message = req.body.message;
  // autoSend: if true the backend will type & press send automatically
  // default true unless explicitly set to false by the client
  const autoSend = req.body.autoSend === undefined ? true : !!req.body.autoSend;

  if (!numbersList || numbersList.length === 0) {
    return res.json({ status: "failed", message: "No numbers" });
  }

  console.log("Received numbers count:", numbersList.length);

  try {
    await initWhatsApp();

    for (let num of numbersList) {
      let mobile = num.toString().replace(/\D/g, "");
      if (!mobile.startsWith("91")) mobile = "91" + mobile;

      await sendToNumber(mobile, message, autoSend);
    }

    res.json({ status: "success", message: "Broadcast Completed!" });
  } catch (err) {
    console.log("Backend error:", err);
    res.json({ status: "failed", message: err.message });
  }
});

// ------------------------------------------
app.listen(5000, () => console.log("Backend running http://localhost:5000"));
