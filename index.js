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
    console.log("Looking for 'Fitness & Performance Centre' card...");
    
    const fitnessFound = await page.evaluate(() => {
      // Look specifically for Fitness & Performance Centre
      const cards = document.querySelectorAll('.li_ico_block');
      console.log(`Found ${cards.length} cards total`);
      
      let target = null;
      for (let card of cards) {
        const text = card.innerText || card.textContent || '';
        console.log(`Card text: "${text}"`);
        if (text.toLowerCase().includes('fitness') && text.toLowerCase().includes('performance')) {
          target = card;
          console.log("Found Fitness & Performance Centre!");
          break;
        }
      }
      
      if (!target && cards.length > 0) {
        // Fallback: click first card if fitness not found
        target = cards[0];
        console.log("Fitness not found, defaulting to first card");
      }
      
      if (target) {
        target.click?.() || target.parentElement?.click?.();
        return true;
      }
      return false;
    });

    if (!fitnessFound) {
      console.log("Could not find and click fitness centre");
    } else {
      console.log("Clicked Fitness Centre");
    }

    await new Promise(r => setTimeout(r, 4000));

    // 📅 DATE - Wait for NEXT day's date to be available
    console.log("Waiting for date dropdown to populate...");
    await page.waitForSelector('#res-dates', { timeout: 15000 });

    // Wait until we have at least the next day's date available
    console.log("Waiting for next day's date to appear in dropdown...");
    await page.waitForFunction(() => {
      const select = document.querySelector('#res-dates');
      // We need at least 3 options: "Select Date", today, and tomorrow
      return select && select.options.length > 2;
    }, { timeout: 300000 }); // Wait up to 5 minutes for next date

    const dateValue = await page.evaluate(() => {
      const select = document.querySelector('#res-dates');
      
      // Log all available dates
      console.log("Available dates:");
      [...select.options].forEach((opt, i) => {
        console.log(`  [${i}] ${opt.text}`);
      });

      // Get tomorrow's date (index 2 = skip "Select Date" and today)
      if (select.options.length > 2) {
        console.log("Selecting index 2 (next day)");
        return select.options[2].value;
      } else {
        console.log("Next day not available yet, selecting available option");
        return select.options[1].value;
      }
    });

    console.log("Selecting date:", dateValue);
    await page.select('#res-dates', dateValue);
    console.log("Date selected successfully");

    // Trigger change event to make sure facilities are fetched
    await page.evaluate(() => {
      const select = document.querySelector('#res-dates');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    console.log("Change event dispatched");

    // ✅ Wait for facilities dropdown to populate
    console.log("Waiting for facilities to load...");
    await new Promise(r => setTimeout(r, 2000));
    
    // Debug what's on the page after date selection
    const facilitiesDebug = await page.evaluate(() => {
      const dateSelect = document.querySelector('#res-dates');
      const facilitiesSelect = document.querySelector('#facilities');
      const allSelects = [...document.querySelectorAll('select')];
      const courtsSelect = document.querySelector('#courts');
      
      return {
        dateSelectFound: !!dateSelect,
        facilitiesSelectFound: !!facilitiesSelect,
        facilitiesValue: facilitiesSelect?.value,
        facilitiesOptionsCount: facilitiesSelect?.options?.length || 0,
        facilitiesOptions: facilitiesSelect ? [...facilitiesSelect.options].map((o, i) => ({ index: i, value: o.value, text: o.text })) : [],
        courtsOptionsCount: courtsSelect?.options?.length || 0,
        allSelectCount: allSelects.length,
        allSelectIds: allSelects.map(s => s.id)
      };
    });
    console.log("Facilities dropdown status:", JSON.stringify(facilitiesDebug, null, 2));
    
    if (!facilitiesDebug.facilitiesSelectFound) {
      throw new Error("Facilities dropdown not found on page");
    }

    // Some pages may populate via courts instead, or via API call
    if (facilitiesDebug.facilitiesOptionsCount === 1) {
      console.log("Facilities still empty, waiting for API call...");
      
      // Wait for any network activity and facility options to appear
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 1000));
        
        const facilitiesCount = await page.evaluate(() => {
          const select = document.querySelector('#facilities');
          return select?.options?.length || 0;
        });
        
        console.log(`Facilities check ${i + 1}: ${facilitiesCount} options`);
        
        if (facilitiesCount > 1) {
          console.log("Facilities populated!");
          break;
        }
      }
    }

    // 🏋️ FACILITY
    const facilityValue = await page.evaluate(() => {
      const select = document.querySelector('#facilities');
      if (!select || select.options.length <= 1) {
        console.log("No facilities available, trying courts instead");
        const courtsSelect = document.querySelector('#courts');
        if (courtsSelect && courtsSelect.options.length > 1) {
          return courtsSelect.options[1].value;
        }
        return select?.options[0]?.value || '';
      }
      return select.options[1].value;
    });

    console.log("Attempting to select facility:", facilityValue);
    
    if (facilityValue) {
      try {
        await page.select('#facilities', facilityValue);
        console.log("Facility selected:", facilityValue);
      } catch (e) {
        console.log("Could not select facilities, trying courts dropdown");
        try {
          await page.select('#courts', facilityValue);
          console.log("Court selected instead:", facilityValue);
        } catch (e2) {
          console.log("Could not select courts either, continuing anyway");
        }
      }
    }

    await new Promise(r => setTimeout(r, 2000));

    // ⏰ SHIFT 3
    console.log("Waiting for Shift 3...");
    await page.waitForSelector('button[data-text="Shift 3"]', { visible: true, timeout: 15000 });
    await page.click('button[data-text="Shift 3"]');

    console.log("Shift 3 selected");

    await new Promise(r => setTimeout(r, 2000));

    // 🎯 SLOT LOOP - WAIT INDEFINITELY UNTIL BOOKED
    console.log("Waiting for slot to open... (no time limit)");

    let attempts = 0;
    let booked = false;

    while (!booked) {
      const available = await page.evaluate(() => {
        const btn = document.querySelector('button[data-slot="05:00 PM to 06:00 PM"]');
        return btn && !btn.disabled;
      });

      if (available) {
        console.log("✅ Slot is now AVAILABLE! Booking...");
        
        await page.click('button[data-slot="05:00 PM to 06:00 PM"]');
        console.log("Slot selected!");

        try {
          await page.waitForSelector('#proceed_to_pay_button', { visible: true, timeout: 10000 });
          await page.click('#proceed_to_pay_button');

          console.log("✅✅✅ GYM BOOKED SUCCESSFULLY! ✅✅✅");
          booked = true;
          break;
        } catch (e) {
          console.log("Error during booking:", e.message);
        }
      }

      attempts++;
      if (attempts % 10 === 0) {
        // Log every 10 attempts (every ~20 seconds)
        console.log(`Still waiting... (${attempts} checks, ${Math.floor(attempts * 2 / 60)}+ minutes elapsed)`);
      }
      
      await new Promise(r => setTimeout(r, 2000));
    }

    if (booked) {
      console.log("Booking complete! Closing browser...");
    }

    await browser.close();

  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  }
})();