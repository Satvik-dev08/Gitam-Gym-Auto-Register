const puppeteer = require('puppeteer');

(async () => {
  try {
    // 🔐 SECURITY CHECK
    if (!process.env.USERNAME || !process.env.PASSWORD) {
      throw new Error("❌ Missing credentials! Set USERNAME and PASSWORD.");
    }

    const browser = await puppeteer.launch({
      headless: "new",
      executablePath: '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    await page.goto('https://gstudent.gitam.edu', {
      waitUntil: 'networkidle2'
    });

    console.log("Page loaded");

    // 🔐 LOGIN
    await page.waitForSelector('#txtusername');
    await page.type('#txtusername', process.env.USERNAME, { delay: 50 });
    await page.type('#password', process.env.PASSWORD, { delay: 50 });

    console.log("Filled credentials");

    // 🔢 CAPTCHA
    await page.waitForSelector('.preview span');

    const captcha = await page.evaluate(() => {
      return [...document.querySelectorAll('.preview span')]
        .map(el => el.innerText)
        .join('')
        .replace(/\D/g, '');
    });

    console.log("Captcha:", captcha);

    await page.type('#captcha_form', captcha);

    // 🚀 LOGIN
    await page.click('#Submit');
    await page.waitForSelector('#menu', { timeout: 15000 });

    console.log("Logged in!");

    // 📂 MENU
    await page.click('#menu');
    await new Promise(r => setTimeout(r, 2000));

    // 🏋️ G-Sports
    console.log("Waiting for G-Sports button...");

    await page.waitForFunction(() => {
      return [...document.querySelectorAll('p')]
        .some(el => el.innerText.includes('G-Sports'));
    });

    await page.evaluate(() => {
      const el = [...document.querySelectorAll('p')]
        .find(e => e.innerText.includes('G-Sports'));
      if (el) el.closest('a').click();
    });

    console.log("Clicked G-Sports");

    // 🔥 WAIT FOR IFRAME
    console.log("Waiting for iframe...");
    await page.waitForSelector('iframe', { timeout: 20000 });

    const frameHandle = await page.$('iframe');
    const frame = await frameHandle.contentFrame();

    if (!frame) throw new Error("❌ Could not access iframe");

    console.log("Switched to iframe");

    await new Promise(r => setTimeout(r, 5000));

    // 🏢 FITNESS CENTRE
    console.log("Waiting for Fitness Centre...");

    let clicked = false;

    for (let i = 0; i < 15; i++) {
      try {
        const found = await frame.evaluate(() => {
          const el = [...document.querySelectorAll('h4')]
            .find(e => e.innerText.includes('Fitness & Performance Centre'));
          if (el) {
            el.closest('.li_ico_block').click();
            return true;
          }
          return false;
        });

        if (found) {
          console.log("Clicked Fitness Centre");
          clicked = true;
          break;
        }

      } catch (e) {}

      console.log("Retrying Fitness Centre...");
      await new Promise(r => setTimeout(r, 2000));
    }

    if (!clicked) {
      throw new Error("❌ Could not find Fitness Centre");
    }

    await new Promise(r => setTimeout(r, 3000));

    // 📅 DATE
    await frame.waitForSelector('#res-dates');

    const dateValue = await frame.evaluate(() => {
      const select = document.querySelector('#res-dates');
      if (select.options.length > 2) {
        return select.options[2].value;
      } else {
        return select.options[1].value;
      }
    });

    await frame.select('#res-dates', dateValue);
    console.log("Date selected:", dateValue);

    await new Promise(r => setTimeout(r, 2000));

    // 🏋️ FACILITY
    await frame.waitForSelector('#facilities');

    const facilityValue = await frame.evaluate(() => {
      const select = document.querySelector('#facilities');
      return select.options[1].value;
    });

    await frame.select('#facilities', facilityValue);
    console.log("Facility selected");

    await new Promise(r => setTimeout(r, 2000));

    // ⏰ SHIFT 3
    console.log("Waiting for Shift 3...");
    await frame.waitForSelector('button[data-text="Shift 3"]', { visible: true });
    await frame.click('button[data-text="Shift 3"]');

    console.log("Shift 3 selected");

    await new Promise(r => setTimeout(r, 2000));

    // 🎯 SLOT LOOP
    console.log("Waiting for slot to open...");

    while (true) {
      const available = await frame.evaluate(() => {
        const btn = document.querySelector('button[data-slot="05:00 PM to 06:00 PM"]');
        return btn && !btn.disabled;
      });

      if (available) {
        await frame.click('button[data-slot="05:00 PM to 06:00 PM"]');
        console.log("Slot selected!");

        await frame.waitForSelector('#proceed_to_pay_button', { visible: true });
        await frame.click('#proceed_to_pay_button');

        console.log("✅ Gym booked successfully!");
        break;
      }

      console.log("Still waiting...");
      await new Promise(r => setTimeout(r, 2000));
    }

    await browser.close();

  } catch (err) {
    console.error("ERROR:", err);
  }
})();