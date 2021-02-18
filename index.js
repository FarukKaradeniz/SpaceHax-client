import puppeteer from "puppeteer"
import config from "./roomConfig.js";
import fetch from 'node-fetch';

import { HEADLESS_HOST_URL } from "./src/constants.js";


(async () => {
    let roomConfig = config;
    const response = await fetch(roomConfig.BASE_URL + '/admin/configs/' + roomConfig.alias);
    const body = await response.json();
    roomConfig = {...roomConfig, ...body}
    const browser = await puppeteer.launch({headless: false, // TODO headless will stay false for debugging purposes
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process', '--no-zygote'] });
    const page = await browser.newPage();
    await page.setBypassCSP(true);
    console.log("browser page created");
    await page.goto(HEADLESS_HOST_URL, {waitUntil: 'networkidle2'});
    console.log("page loaded");
    await page.exposeFunction("printRoomLink", (link) => console.log(link))

    await page.evaluate((roomConfig) => {
        window.roomConfig = roomConfig
    }, roomConfig);
    await page.addScriptTag({url: 'https://unpkg.com/axios/dist/axios.min.js'})
    await page.addScriptTag({path: './src/room.js'})
    console.log("room created");
})();
