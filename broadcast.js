// const puppeteer = require("puppeteer");

// async function startBroadcast(numbers, message) {
//   console.log("Starting WhatsApp Broadcast...");

//   const browser = await puppeteer.launch({
//     headless: false,
//     defaultViewport: null,
//   });

//   const page = await browser.newPage();
//   await page.goto("https://web.whatsapp.com");

//   console.log("Please scan the QR Code in the browser...");
//   await page.waitForSelector("canvas", { timeout: 60000 }).catch(() => {});

//   await page.waitForTimeout(15000); // wait for WhatsApp to fully load

//   for (let num of numbers) {
//     const fullNum = num.toString().replace(/\D/g, "");

//     console.log("Sending message to:", fullNum);

//     await page.goto(`https://web.whatsapp.com/send?phone=${fullNum}`);

//     await page.waitForSelector("[contenteditable='true']", { timeout: 60000 });

//     await page.waitForTimeout(2000);

//     await page.type("[contenteditable='true']", message);

//     await page.keyboard.press("Enter");

//     console.log("Message sent to:", fullNum);

//     await page.waitForTimeout(2000);
//   }

//   console.log("Broadcast Completed!");
//   await browser.close();
// }

// module.exports = startBroadcast;
// // 