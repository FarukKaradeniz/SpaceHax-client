import puppeteer from "puppeteer"
import init from "./src/room.js"
import getArgs from "./src/cmd.js";


(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://html5.haxball.com/headless', {waitUntil: 'networkidle2'});
    await page.exposeFunction("getArgs", getArgs);
    await page.evaluate(init)
})();
