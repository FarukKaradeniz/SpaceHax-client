import getArgs from "./src/cmd.js";

const config = {
    roomName: "@@@@@@@ KEKWwww @@@@@@@",
    maxPlayers: 18,
    public: false,
    token: getArgs()["--token"],
    noPlayer: false,
    playerName: "Kappa",
    geo: {"code": "tr", "lat" : 41.0054958, "lon" : 28.8720965},
    BASE_URL: 'https://5f54caa828af.ngrok.io', // TODO args'tan al
    // TODO room'u da args'tan al
};

// TODO roomname limitler falan istek yapılarak alınmalı

export default config;