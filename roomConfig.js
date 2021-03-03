import getArgs from "./src/cmd.js";

const config = {
    maxPlayers: 18,
    public: true,
    token: getArgs()["--token"],
    noPlayer: false,
    playerName: "SpaceHax Bot",
    geo: {"code": "tr", "lat" : 39.925533, "lon" : 32.866287},
    BASE_URL: getArgs()["--baseUrl"],
    alias: getArgs()["--room"],
    pw: getArgs()["--pw"],
};

export default config;