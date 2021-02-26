import getArgs from "./src/cmd.js";

const config = {
    maxPlayers: 18,
    public: false,
    token: getArgs()["--token"],
    noPlayer: false,
    playerName: "Kappa",
    geo: {"code": "tr", "lat" : 41.0054958, "lon" : 28.8720965},
    BASE_URL: getArgs()["--baseUrl"],
    alias: getArgs()["--room"],
    pw: getArgs()["--pw"],
};

// TODO roomname limitler falan istek yapılarak alınmalı

export default config;