const puppeteer = require('puppeteer-core');

(async () => {
  try {
    // 🔐 SECURITY CHECK
    if (!process.env.USERNAME || !process.env.PASSWORD) {
      throw new Error("❌ Missing credentials! Set USERNAME and PASSWORD.");
    }

    const browser = await puppeteer.launch({
      headless: "new",
      executablePath: '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
      ]
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto('https://gstudent.gitam.edu', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    console.log("Page loaded");

    // 🔐 LOGIN
    await page.waitForSelector('#txtusername', { timeout: 15000 });
    await page.type('#txtusername', process.env.USERNAME, { delay: 50 });
    await page.type('#password', process.env.PASSWORD, { delay: 50 });

    console.log("Filled credentials");

    // 🔢 CAPTCHA
    await page.waitForSelector('.preview span', { timeout: 10000 });

    const captchaDebug = await page.evaluate(() => {
      const previewDiv = document.querySelector('.preview');
      const fullHTML = previewDiv ? previewDiv.innerHTML : "Not found";
      const spans = [...document.querySelectorAll('.preview span')];
      const textContent = previewDiv ? previewDiv.innerText : "Not found";
      return { 
        fullHTML, 
        textContent,
        spanCount: spans.length,
        spanTexts: spans.map(el => el.innerText.trim())
      };
    });
    console.log("Captcha debug:", JSON.stringify(captchaDebug, null, 2));

    const captcha = await page.evaluate(() => {
      // Get all text from preview including all children
      const previewDiv = document.querySelector('.preview');
      if (!previewDiv) return "";
      
      // Get all text nodes and element text
      let fullText = previewDiv.innerText.replace(/\s+/g, '');
      
      // If it looks like a math expression, try to evaluate
      const expr = fullText.replace(/[^0-9+\-*/().\s]/g, '').trim();
      console.log("Expression to eval:", expr);
      
      try {
        const result = eval(expr);
        return String(Math.round(result));
      } catch (e) {
        // Fallback: just return the digits
        console.log("Eval failed, using digits only");
        return fullText.replace(/\D/g, '');
      }
    });

    console.log("Captcha answer:", captcha);

    await page.type('#captcha_form', captcha);

    // 🚀 LOGIN SUBMIT
    const submitBtn = await page.$('#Submit');
    if (!submitBtn) {
      throw new Error("Submit button not found!");
    }
    
    await page.click('#Submit');
    
    // Wait for navigation or menu to appear
    try {
      await page.waitForSelector('#menu', { timeout: 10000 });
    } catch (e) {
      // Check if we got an error message
      const errorMsg = await page.evaluate(() => {
        const errorElement = document.querySelector('[class*="error"], [class*="alert"]');
        return errorElement ? errorElement.innerText : "No error message found";
      });
      console.log("Login failed. Error on page:", errorMsg);
      throw new Error(`Login failed after captcha. Details: ${errorMsg}`);
    }

    console.log("Logged in!");

    // 🏋️ G-Sports
    console.log("Waiting for G-Sports button...");

    await page.waitForFunction(() => {
      return [...document.querySelectorAll('p')]
        .some(el => el.innerText.includes('G-Sports'));
    }, { timeout: 15000 });

    await page.evaluate(() => {
      const el = [...document.querySelectorAll('p')]
        .find(e => e.innerText.includes('G-Sports'));
      if (el) el.closest('a').click();
    });

    console.log("Clicked G-Sports");

    await new Promise(r => setTimeout(r, 10000));

    // 🏢 FITNESS CENTRE
    console.log("Waiting for Fitness Centre cards...");

    // Debug: Check what elements are on the page
    const pageElements = await page.evaluate(() => {
      return {
        liIcoBlocks: document.querySelectorAll('.li_ico_block').length,
        allDivs: document.querySelectorAll('div[class*="ico"]').length,
        allCards: document.querySelectorAll('[class*="card"]').length,
        pageTitle: document.title,
        bodyHTML: document.body.innerText.substring(0, 200)
      };
    });
    console.log("Page elements found:", pageElements);

    // Try multiple selectors
    try {
      await page.waitForSelector('.li_ico_block', { timeout: 15000 });
    } catch (e) {
      console.log("`.li_ico_block` not found, trying alternatives...");
      // Try alternative selectors
      await page.waitForSelector('[class*="ico_block"], [class*="facility"], div[role="button"]', { timeout: 15000 });
    }

    await new Promise(r => setTimeout(r, 3000));

    await page.evaluate(() => {
      // Try multiple selector strategies
      let cards = document.querySelectorAll('.li_ico_block');
      if (cards.length === 0) {
        cards = document.querySelectorAll('[class*="ico_block"]');
      }
      if (cards.length === 0) {
        cards = document.querySelectorAll('div[role="button"]');
      }
      if (cards.length > 0) {
        console.log("Found", cards.length, "cards");
        cards[0].click();
      }
    });

    console.log("Clicked Fitness Centre");

    await new Promise(r => setTimeout(r, 4000));

    // 📅 DATE
    await page.waitForSelector('#res-dates', { timeout: 15000 });

    const dateValue = await page.evaluate(() => {
      const select = document.querySelector('#res-dates');
      if (select.options.length > 2) {
        return select.options[2].value;
      } else {
        return select.options[1].value;
      }
    });

    await page.select('#res-dates', dateValue);
    console.log("Date selected:", dateValue);

    // ✅ FIX: Wait for facilities dropdown to actually populate after date selection
    console.log("Waiting for facilities to load...");
    await new Promise(r => setTimeout(r, 3000));
    
    await page.waitForFunction(() => {
      const select = document.querySelector('#facilities');
      return select && select.options.length > 1;
    }, { timeout: 30000 });

    await new Promise(r => setTimeout(r, 1000));

    // 🏋️ FACILITY
    const facilityValue = await page.evaluate(() => {
      const select = document.querySelector('#facilities');
      console.log("Facilities count:", select.options.length);
      return select.options[1].value;
    });

    await page.select('#facilities', facilityValue);
    console.log("Facility selected:", facilityValue);

    await new Promise(r => setTimeout(r, 2000));

    // ⏰ SHIFT 3
    console.log("Waiting for Shift 3...");
    await page.waitForSelector('button[data-text="Shift 3"]', { visible: true, timeout: 15000 });
    await page.click('button[data-text="Shift 3"]');

    console.log("Shift 3 selected");

    await new Promise(r => setTimeout(r, 2000));

    // 🎯 SLOT LOOP
    console.log("Waiting for slot to open...");

    const MAX_RETRIES = 30;
    let attempts = 0;

    while (attempts < MAX_RETRIES) {
      const available = await page.evaluate(() => {
        const btn = document.querySelector('button[data-slot="05:00 PM to 06:00 PM"]');
        return btn && !btn.disabled;
      });

      if (available) {
        await page.click('button[data-slot="05:00 PM to 06:00 PM"]');
        console.log("Slot selected!");

        await page.waitForSelector('#proceed_to_pay_button', { visible: true, timeout: 10000 });
        await page.click('#proceed_to_pay_button');

        console.log("✅ Gym booked successfully!");
        break;
      }

      attempts++;
      console.log(`Still waiting... (${attempts}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, 2000));
    }

    if (attempts >= MAX_RETRIES) {
      console.log("⚠️ Slot did not open within the wait window. Exiting.");
    }

    await browser.close();

  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  }
})();