import puppeteer from "puppeteer"
import config from "./roomConfig.js";

import { HEADLESS_HOST_URL } from "./src/constants.js";


(async () => {
    const browser = await puppeteer.launch({headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process', '--no-zygote'] });
    const page = await browser.newPage();
    await page.setBypassCSP(true);
    console.log("browser page created");
    await page.goto(HEADLESS_HOST_URL, {waitUntil: 'networkidle2'});
    console.log("page loaded");
    await page.exposeFunction("printRoomLink", (link) => console.log(link))
    const roomConfig = config;
    await page.evaluate((roomConfig) => {
        window.roomConfig = roomConfig
    }, roomConfig);
    await page.addScriptTag({path: './src/room.js'})
    console.log("room created");
})();
