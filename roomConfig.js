import getArgs from "./src/cmd.js";

const config = {
    maxPlayers: 18,
    public: true,
    token: getArgs()["--token"],
    noPlayer: false,
    playerName: "SpaceHax Bot",
    geo: {"code": "tr", "lat" : 40.9892722, "lon" : 28.9709463},
    BASE_URL: getArgs()["--baseUrl"],
    alias: getArgs()["--room"],
    pw: getArgs()["--pw"],
};

export default config;