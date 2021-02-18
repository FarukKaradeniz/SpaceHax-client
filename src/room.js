var room = HBInit(window.roomConfig);
room.setDefaultStadium(window.roomConfig.map);
room.setScoreLimit(window.roomConfig.scoreLimit);
room.setTimeLimit(window.roomConfig.timeLimit);

const req = axios.create({
    baseURL: window.roomConfig.BASE_URL,
});

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
let firstTouch = false;

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
        {...player, authenticated: false, isSuperAdmin: false, isAdmin: false});
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
    firstTouch = false;
}

room.onPlayerBallKick = (player) => {
    if (currentGame.ballTouch.lastTouch && currentGame.ballTouch.lastTouch.id !== player.id) {
        currentGame.ballTouch.secondToLastTouch = currentGame.ballTouch.lastTouch
    }
    currentGame.ballTouch.lastTouch = {id: player.id, team: player.team};
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
    if (room.getScores().time === 0) return
    setLastTouch();
}

room.onGamePause = (byPlayer) => {
    isPaused = true;
}

room.onGameUnpause = (byPlayer) => {
    isPaused = false;
}

room.onPlayerChat = (player, message) => {
    // AUTH
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
        register(player.id, player.name, password);
        return false;
    }

    if (message.startsWith("!stats")) {
        if (message === "!stats") getStats(player.name)
        else {
            message.substring(7).length > 0 ? getStats(message.substring(7)) : room.sendChat("İstatistiği görmek istediğiniz kişinin ismini giriniz.")
        }
    }
}

let extractPassword = (message) => {
    let split = message.split(" ");
    if (split.length !== 2) {
        return [undefined, "hatalı şifre denemesi"];
    }
    return [split[1], undefined];
}

let getStats = (playerName) => {
    req({
        url: `/game/stats/${playerName}`,
        params: {
            room: window.roomConfig.alias,
        }
    }).then((response) => {
        if (response.data.GamesPlayed > 0) {
            room.sendChat(`${playerName} Gol: ${response.data.GoalsCount} Asist: ${response.data.AssistsCount} Maç Sayısı: ${response.data.GamesPlayed}
                Kazanılan: ${response.data.GamesWon} Maç Başına Gol: ${(response.data.GoalsCount / response.data.GamesPlayed).toFixed(2)}`)
        } else {
            room.sendChat(`${playerName} henüz maç oynamadı.`)
        }

    }).catch((e) => {
        if (e.response.status === 409) {
            room.sendChat(`Kullanıcıya ait istatistik bulunamadı. Kullanıcı adını doğru girdiğinize emin olunuz`);
        } else {
            room.sendChat(`Sunucuya erişimde hata oluştur. Kayıt işlemi gerçekleşmedi.`);
        }
    })
}

let register = (id, username, password) => {
    req({
        url: `/auth/signup`,
        method: 'post',
        data: {name: username, password, room: window.roomConfig.alias, conn: players.get(id).conn},
    }).then((response) => room.sendChat(`@${username}, kaydınız gerçekleşti. "!onayla <şifre>" komutu ile giriş yapmayı unutmayınız.`))
    .catch((e) => {
        if (e.response.status === 409) {
            room.sendChat(`@${username}, hesabınız zaten bulunmaktadır. Odadan kicklenmemek için giriş yapınız.`);
        } else {
            room.sendChat(`Sunucuya erişimde hata oluştur. Kayıt işlemi gerçekleşmedi.`);
        }
    });
}

let login = (id, username, password) => {
    let player = players.get(id);
    if (player.authenticated) {
        return room.sendChat(`@${username}, daha önce zaten giriş yaptınız.`);
    }

    req({
        url: `/auth/login`,
        method: 'post',
        data: {name: username, password, room: window.roomConfig.alias},
    }).then((response) => {
        player.isAdmin = response.data.isAdmin;
        player.isSuperAdmin = response.data.isSuperAdmin;
        player.playerId = response.data.playerId; // this is is from db. might remove later
        player.authenticated = true;
        players.set(id, player);
        room.sendChat(`@${username}, başarıyla giriş yaptınız. Hoşgeldiniz!`);
    }).catch((e) => {
        if (e.response.status === 401) {
            room.sendChat(`@${username}, yanlış şifre girdiniz. Kayıtlı değilseniz önce "!kaydol <şifre>" yaparak kaydolunuz.`);
        }
    });
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
        if (!firstTouch && distanceBetweenBall < threshold+1) {
            currentGame.ballTouch.lastTouch = {id: inGamePlayers[i].id, team: inGamePlayers[i].team};
            firstTouch = true;
        }
        if (distanceBetweenBall < threshold) {
            if (currentGame.ballTouch.lastTouch && currentGame.ballTouch.lastTouch.id !== inGamePlayers[i].id) {
                currentGame.ballTouch.secondToLastTouch = currentGame.ballTouch.lastTouch;
            }
            currentGame.ballTouch.lastTouch = {id: inGamePlayers[i].id, team: inGamePlayers[i].team};
        }
    }
}
