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

    // 📂 Click menu to open the tabs
    console.log("Opening menu tabs...");
    
    // Find and click the element that opens the menu with G-Sports
    const menuOpened = await page.evaluate(() => {
      const elements = [...document.querySelectorAll('p, a, div[role="button"]')];
      const gSportsElement = elements.find(el => el.innerText && el.innerText.trim() === 'G-Sports');
      if (gSportsElement) {
        gSportsElement.click?.();
        return true;
      }
      return false;
    });

    if (!menuOpened) {
      throw new Error("Could not find G-Sports element");
    }

    console.log("Clicked to open menu, waiting for G-Sports tab to appear...");
    await new Promise(r => setTimeout(r, 3000));

    // Now G-Sports should be visible as a selectable tab/option
    console.log("Looking for G-Sports tab/button to click...");
    
    // Wait for and click the actual G-Sports option
    await page.waitForFunction(() => {
      const tabs = [...document.querySelectorAll('[role="tab"], .nav-link, button, a, li')];
      return tabs.some(tab => tab.innerText && tab.innerText.includes('G-Sports'));
    }, { timeout: 10000 });

    await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('[role="tab"], .nav-link, button, a, li, p')];
      const gSportsTab = tabs.find(tab => tab.innerText && tab.innerText.trim().includes('G-Sports'));
      if (gSportsTab) {
        gSportsTab.click();
      }
    });

    console.log("Clicked G-Sports tab, waiting for content to load...");
    await new Promise(r => setTimeout(r, 5000));

    // 🏢 FITNESS CENTRE
    console.log("Waiting for Fitness Centre cards...");

    // Debug: Check page content after G-Sports load
    const gsportsPageDebug = await page.evaluate(() => {
      return {
        currentUrl: window.location.href,
        title: document.title,
        liIcoBlocks: document.querySelectorAll('.li_ico_block').length,
        allLis: document.querySelectorAll('li').length,
        allDivs: document.querySelectorAll('div').length,
        pageText: document.body.innerText.substring(0, 300)
      };
    });
    console.log("G-Sports page check:", gsportsPageDebug);

    // Try to find and click fitness centre
    const fitnessFound = await page.evaluate(() => {
      // Look for fitness centre explicitly
      const liElements = document.querySelectorAll('li, div[class*="item"], div[class*="card"]');
      let target = null;
      for (let el of liElements) {
        if (el.innerText && el.innerText.toLowerCase().includes('fitness')) {
          target = el;
          break;
        }
      }
      if (target) {
        target.click?.() || target.parentElement?.click?.();
        return true;
      }
      return false;
    });

    if (fitnessFound) {
      console.log("Clicked Fitness Centre via text search");
    } else {
      console.log("Fitness text not found, trying selector");
      try {
        await page.waitForSelector('.li_ico_block', { timeout: 10000 });
        await page.click('.li_ico_block');
        console.log("Clicked first .li_ico_block");
      } catch (e) {
        console.log("Could not find fitness centre element");
      }
    }

    await new Promise(r => setTimeout(r, 5000));

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
    
    // Debug what's on the page after date selection
    const facilitiesDebug = await page.evaluate(() => {
      const dateSelect = document.querySelector('#res-dates');
      const facilitiesSelect = document.querySelector('#facilities');
      const allSelects = [...document.querySelectorAll('select')];
      
      return {
        dateSelectFound: !!dateSelect,
        facilitiesSelectFound: !!facilitiesSelect,
        facilitiesValue: facilitiesSelect?.value,
        facilitiesOptionsCount: facilitiesSelect?.options?.length || 0,
        facilitiesOptions: facilitiesSelect ? [...facilitiesSelect.options].map((o, i) => ({ index: i, value: o.value, text: o.text })) : [],
        allSelectCount: allSelects.length,
        allSelectIds: allSelects.map(s => s.id)
      };
    });
    console.log("Facilities dropdown status:", JSON.stringify(facilitiesDebug, null, 2));
    
    if (!facilitiesDebug.facilitiesSelectFound) {
      throw new Error("Facilities dropdown not found on page");
    }

    if (facilitiesDebug.facilitiesOptionsCount <= 1) {
      console.log("Facilities not populated yet, waiting more...");
      await new Promise(r => setTimeout(r, 5000));
      
      const facilitiesDebug2 = await page.evaluate(() => {
        const facilitiesSelect = document.querySelector('#facilities');
        return {
          optionsCount: facilitiesSelect?.options?.length || 0,
          options: facilitiesSelect ? [...facilitiesSelect.options].map((o, i) => ({ index: i, value: o.value, text: o.text })) : []
        };
      });
      console.log("Facilities after waiting more:", facilitiesDebug2);
    }

    // 🏋️ FACILITY
    const facilityValue = await page.evaluate(() => {
      const select = document.querySelector('#facilities');
      if (!select || select.options.length <= 1) {
        return select?.options[0]?.value || '';
      }
      return select.options[1].value;
    });

    console.log("Attempting to select facility:", facilityValue);
    
    if (facilityValue) {
      await page.select('#facilities', facilityValue);
      console.log("Facility selected:", facilityValue);
    }

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