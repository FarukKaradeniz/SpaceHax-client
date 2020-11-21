import getArgs from "./src/cmd.js";

const config = {
    roomName: "@@@@@@@ KEKWwww @@@@@@@",
    maxPlayers: 18,
    public: true,
    token: getArgs()["--token"],
    noPlayer: false,
    playerName: "Kappa",
    geo: {"code": "tr", "lat" : 41.0054958, "lon" : 28.8720965},
};

export default config;