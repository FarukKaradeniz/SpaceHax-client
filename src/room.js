const USER_DATABASE = "USER_DATABASE";

var room = HBInit(window.roomConfig);
room.setDefaultStadium("Big");
room.setScoreLimit(5);
room.setTimeLimit(0);

let players = new Map();

let currentGame = {
    possession: {
        red: 0,
        blue: 0,
    }, // {red, blue}
    goalsByRed: [], // {scoredBy, assisted:nullable, time, isOwnGoal}
    goalsByBlue: [],
    ballTouch: {
        lastTouch: undefined,
        secondToLastTouch: undefined,
    }
};

let team = {
    SPEC: 0,
    RED: 1,
    BLUE: 2,
};

let ballProps;
let playerRadius = 15;
let isPaused = true;

// If there are no admins left in the room give admin to one of the remaining players.
let updateAdmins = () => {
    // Get all players
    var playerList = room.getPlayerList();
    if (playerList.length === 1) return; // No players left, do nothing.
    if (playerList.filter((player) => player.id !== 0).find((player) => player.admin) != null) return; // There's an admin left so do nothing.
    let p = players.get(playerList[1].id);
    room.setPlayerAdmin(p.id, true); // Give admin to the first non admin player in the list
    players.set(p.id, {...p, admin: true});
}

room.onPlayerAdminChange = (changedPlayer, byPlayer) => {
    let p = players.get(changedPlayer.id);
    p.admin = changedPlayer.admin;
    players.set(changedPlayer.id, p);
}

room.onPlayerJoin = (player) =>  {
    players.set(player.id,
        {...player, authenticated: false, superAdmin: false});
    setTimeout(() => {
        let p = players.get(player.id);
        if (p && !p.authenticated) {
            room.kickPlayer(player.id, `Giriş yapmadınız`, false);
        }
    }, 30_000);
    updateAdmins();
    room.sendChat(`Hoşgeldiniz @${player.name}, lütfen giriş yapınız. Kayıtlı değilseniz !kaydol <şifre> yazıp kaydolunuz. Kayıtlı iseniz !onayla <şifre> yazınız.`);
}

room.onPlayerLeave = (player) => {
    players.delete(player.id)
    updateAdmins();
}

room.onRoomLink = (link) => {
    console.log(link)
    room.setTeamsLock(true)
    printRoomLink(link)
}

room.onGameStart = (byPlayer) => {
    ballProps = room.getDiscProperties(0);
    isPaused = false;
}

room.onTeamVictory = () => {
    // save stats
}

room.onGameStop = (byPlayer) => {
    currentGame.possession.blue = 0;
    currentGame.possession.red = 0;
    currentGame.goalsByBlue = [];
    currentGame.goalsByRed = [];
    currentGame.ballTouch.lastTouch = undefined;
    currentGame.ballTouch.secondToLastTouch = undefined;
    ballProps = undefined;
    isPaused = true;
}

room.onPlayerBallKick = (player) => {
    if (currentGame.ballTouch.lastTouch && currentGame.ballTouch.lastTouch.id !== player.id) {
        currentGame.ballTouch.secondToLastTouch = currentGame.ballTouch.lastTouch
    }
    currentGame.ballTouch.lastTouch = players.get(player.id);
    player.team === team.RED ? currentGame.possession.red++ : currentGame.possession.blue++;
}

room.onPlayerTeamChange = (changedPlayer, byPlayer) => {
    if (changedPlayer.id === 0) {
        room.setPlayerTeam(0, team.SPEC);
        return
    }
    let p = players.get(changedPlayer.id);
    p.team = changedPlayer.team;
    players.set(p.id, p);
}

room.onTeamGoal = (teamId) => {
    // {scoredBy, assisted:nullable, time, isOwnGoal}
    let stats = {
        scoredBy: currentGame.ballTouch.lastTouch,
        time: room.getScores().time,
    }
    if (!currentGame.ballTouch.lastTouch) {
        return teamId === team.RED ? currentGame.goalsByRed.push(stats) : currentGame.goalsByBlue.push(stats);
    }
    if (teamId === currentGame.ballTouch.lastTouch.team) {
        if(currentGame.ballTouch.secondToLastTouch !== undefined && currentGame.ballTouch.lastTouch.team === currentGame.ballTouch.secondToLastTouch.team) { // is assist?
            stats.assisted = currentGame.ballTouch.secondToLastTouch;
        }
        stats.isOwnGoal = false;
    }
    else { // Own Goal
        stats.isOwnGoal = true;
    }
    teamId === team.RED ? currentGame.goalsByRed.push(stats) : currentGame.goalsByBlue.push(stats);
}

room.onPositionsReset = () => {
    currentGame.ballTouch.lastTouch = undefined;
    currentGame.ballTouch.secondToLastTouch = undefined;
}

room.onGameTick = () => {
    if (isPaused || room.getScores().time === 0) {
        return
    }
    setLastTouch();
}

room.onGamePause = (byPlayer) => {
    isPaused = true;
}

room.onGameUnpause = (byPlayer) => {
    isPaused = false;
}

room.onPlayerChat = (player, message) => {
    if (message.startsWith("!onayla")) {
        let [password, error] = extractPassword(message);
        if (error) {
            room.sendChat(`@${player.name}, ${error}`);
            return false;
        }
        login(player.id, player.name, password);
        return false;
    }
    if (message.startsWith("!kaydol")) {
        let [password, error] = extractPassword(message);
        if (error) {
            room.sendChat(`@${player.name}, ${error}`);
            return false;
        }
        register(player.name, password);
        return false;
    }

}

let extractPassword = (message) => {
    let split = message.split(" ");
    if (split.length !== 2) {
        return [undefined, "hatalı şifre denemesi"];
    }
    return [split[1], undefined];
}

let mapToJson = (map) => {
    return JSON.stringify([...map]);
}

let jsonToMap = (jsonStr) => {
    return new Map(JSON.parse(jsonStr));
}

let register = (username, password) => {
    let db = jsonToMap(localStorage.getItem(USER_DATABASE));
    if (db.get(username)) {
        return room.sendChat(`@${username}, hesabınız zaten bulunmaktadır.`);
    }

    let map = db.set(username, password);
    localStorage.setItem(USER_DATABASE, mapToJson(map))
    return room.sendChat(`@${username}, kaydınız gerçekleşti. "!onayla <şifre>" komutu ile giriş yapmayı unutmayınız.`);
}

let login = (id, username, password) => {
    let player = players.get(id);
    if (player.authenticated) {
        return room.sendChat(`@${username}, daha önce zaten giriş yaptınız.`);
    }

    let db = jsonToMap(localStorage.getItem(USER_DATABASE));
    if (!db.get(username)) {
        return room.sendChat(`@${username}, hesabınız bulunmamaktadır. Kaydolmak için "!kaydol <şifre>" komutunu kullanınız.`);
    }
    if (db.get(username) !== password) {
        return room.sendChat(`@${username}, yanlış şifre girdiniz.`);
    }
    else {
        // TODO db'den getir götür yapılacak bu değerler
        player.authenticated = true;
        players.set(id, player);
        return room.sendChat(`@${username}, başarıyla giriş yaptınız. Hoşgeldiniz!`);
    }
}

let getDistanceBetweenTwoPoints = (p1, p2) => {
    let distance1 = p1.x - p2.x;
    let distance2 = p1.y - p2.y;
    return Math.sqrt(distance1 * distance1 + distance2 * distance2);
}

let setLastTouch = () => {
    let ballPosition = room.getBallPosition();
    let threshold = ballProps.radius + playerRadius + 0.01;
    let inGamePlayers = room.getPlayerList().filter(p => p.team !== team.SPEC);
    for (let i=0; i<inGamePlayers.length; i++) {
        let distanceBetweenBall = getDistanceBetweenTwoPoints(ballPosition, inGamePlayers[i].position);
        if (distanceBetweenBall < threshold) {
            if (currentGame.ballTouch.lastTouch && currentGame.ballTouch.lastTouch.id !== inGamePlayers[i].id) {
                currentGame.ballTouch.secondToLastTouch = currentGame.ballTouch.lastTouch;
            }
            currentGame.ballTouch.lastTouch = players.get(inGamePlayers[i].id);
        }
    }
}
