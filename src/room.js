var room = HBInit(window.roomConfig);
room.setCustomStadium(window.roomConfig.map);
room.setScoreLimit(window.roomConfig.scoreLimit);
room.setTimeLimit(window.roomConfig.timeLimit);

let req = axios.create({
    baseURL: window.roomConfig.BASE_URL,
    headers: {
        'Authorization': 'Bearer ' + window.roomConfig.authToken,
    }
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
    },
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
let currentStreak = {
    team: team.RED,
    count: 0,
};
let muteAll = false;
let mapChangeable = false;

let COLOR = {
    BLUE: 0x66E6F5,
    RED: 0xFA5646,
    ORANGE: 0xFFC12F,
    GREEN: 0x7DFA89,
    YELLOW: 0xFFF22A,
    PURPLE: 0xDB83FF,
    PINK: 0xFF9EEA,
    DARK_BLUE: 0x4F72FF,
    GRAY: 0x97A8C4,
};

// If there are no admins left in the room give admin to one of the remaining players.
let updateAdmins = () => {
    // Get all players
    let playerList = room.getPlayerList();
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
    room.sendAnnouncement(`Hoşgeldiniz ${player.name}, lütfen giriş yapınız. Kayıtlı değilseniz !kaydol <şifre> yazıp kaydolunuz. Kayıtlı iseniz !onayla <şifre> yazınız.`,
        player.id, COLOR.YELLOW, "bold", 2);
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

room.onTeamVictory = (scores) => {
    // TODO check player count, if player count isn't equal to the maxPlayer in config don't save the game
    let redWin = scores.red > scores.blue;
    if ((currentStreak.team === team.RED && redWin) || (currentStreak.team === team.BLUE && !redWin)) currentStreak.count++
    else {
        currentStreak.count = 1;
        currentStreak.team = currentStreak.team === team.RED ? team.BLUE : team.RED;
    }
    let played = room.getPlayerList().filter(p => p.team !== team.SPEC).map(p => players.get(p.id));
    let stats = new Map();
    played.forEach(p => {
        let won = 0;
        if ((redWin && p.team === team.RED) || (!redWin && p.team === team.BLUE)) won = 1;
        stats.set(p.playerId, {
            "goalsCount": 0,
            "assistsCount": 0,
            "won": won,
        })
    });
    currentGame.goalsByRed.concat(currentGame.goalsByBlue).forEach(p => {
        stats.get(players.get(p.scoredBy.id).playerId) &&
        stats.set(players.get(p.scoredBy.id).playerId, {
                ...stats.get(players.get(p.scoredBy.id).playerId),
                "goalsCount": stats.get(players.get(p.scoredBy.id).playerId).goalsCount + 1
            });
        if (p.assisted)
            stats.set(players.get(p.assisted.id).playerId, {
                ...stats.get(players.get(p.assisted.id).playerId),
                "assistsCount": stats.get(players.get(p.assisted.id).playerId).assistsCount + 1
            });
    });
    req({
        url: `/game/stats`,
        method: 'post',
        data: {
            played: played.map(p => p.playerId),
            stats: Object.fromEntries(stats),
            room: window.roomConfig.alias,
        },
    })
    // TODO print game stats after game ends
    if (currentStreak.count > window.roomConfig.topStreak) {
        req({
            url: `/admin/configs/${window.roomConfig.alias}`,
            method: 'put',
            data: {
                ...window.roomConfig,
                topStreak: currentStreak.count,
                topPlayers: JSON.stringify(played.filter(p => p.team === currentStreak.team).map(p => p.name)),
            }
        }).then(() => {
            window.roomConfig.topStreak = currentStreak.count;
            window.roomConfig.topPlayers = JSON.stringify(played.filter(p => p.team === currentStreak.team).map(p => p.name));
        })
    }
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

room.onStadiumChange = (newStadiumName, byPlayer) => {
    if (!mapChangeable && byPlayer.id !== 0) {
        room.sendAnnouncement("Map değiştirilemez olarak ayarlandı.", undefined, COLOR.RED, "bold", 2);
        room.setCustomStadium(window.roomConfig.map);
    }
}

room.onPlayerChat = (player, message) => {
    // AUTH
    if (message.startsWith("!onayla")) {
        let [password, error] = extractPassword(message);
        if (error) {
            room.sendAnnouncement(`${player.name}, ${error}`, player.id, COLOR.ORANGE, "bold", 2);
            return false;
        }
        login(player.id, player.name, password);
        return false;
    }
    if (message.startsWith("!kaydol")) {
        let [password, error] = extractPassword(message);
        if (error) {
            room.sendAnnouncement(`${player.name}, ${error}`, player.id, COLOR.ORANGE, "bold", 2);
            return false;
        }
        register(player.id, player.name, password);
        return false;
    }

    if (players.get(player.id).muted) return false; // player is muted
    if (muteAll && message !== "!unmuteall") {
        return players.get(player.id).isAdmin; // if player is admin, they can talk
    }

    // STATS
    if (message.startsWith("!stats")) {
        if (message === "!stats") getStats(player.name)
        else {
            message.substring(7).length > 0 ? getStats(message.substring(7)) : room.sendAnnouncement(`İstatistiği görmek istediğiniz kişinin ismini giriniz.`, player.id, COLOR.GREEN, "normal", 2)
        }
    }
    // STREAK
    if (message === "!seri")    room.sendAnnouncement(`${currentStreak.team === team.RED ? 'RED' : 'BLUE'} takımının ${currentStreak.count} maçlık kazanma serisi var.`, undefined, COLOR.GREEN, "normal", 2)
    if (message === "!rekorSeri") {
        if (window.roomConfig.topStreak > 0) {
            room.sendAnnouncement(`${window.roomConfig.topStreak} maçlık rekor kazanma serisi ( ${window.roomConfig.topPlayers.join(", ")} )`, undefined, COLOR.GREEN, "bold", 2)
        } else {
            room.sendAnnouncement(`Kayıtlı rekor seri bulunmamaktadır.`, undefined, COLOR.ORANGE, "bold", 2);
        }
    }

    // GENERAL
    if (message === "!clearbans" && player.admin) room.clearBans();
    if (message === "!bb") room.kickPlayer(player.id, "Görüşmek üzere...", false);
    if (message === "!bb+") room.kickPlayer(player.id, "Görüşmek üzere...", true);
    if (message === "!komutlar") { // Herkesin kullanabileceği normal komutlar
        room.sendAnnouncement(`(!seri), (!rekorSeri), (!stats <isim>), (!afk), (!noafk), (!afklar) (!clearbans)`, undefined, COLOR.PINK, "bold", 2);
    }
    if (message === "!adminkomutlar") {
        room.sendAnnouncement(`(!muteall) (!unmuteall) (!mute #0) (!unmute #0)`, undefined, COLOR.PINK, "bold", 2);
    }

    // AFK
    if (message === "!afk") {
        players.set(player.id, {...players.get(player.id), afk: true});
        room.sendAnnouncement(`${player.name} artık AFK.`, undefined, COLOR.YELLOW, "normal", 2);
    }
    if (message === "!noafk") {
        players.set(player.id, {...players.get(player.id), afk: false});
        room.sendAnnouncement(`${player.name} artık AFK değil, oynamaya hazır.`, undefined, COLOR.YELLOW, "normal", 2);
    }
    if (message === "!afklar") {
        room.sendAnnouncement(`AFK Oyuncular: ${[...players.values()].filter(p => p.afk).map(p => p.name).join(", ")}`, undefined, COLOR.YELLOW, "normal", 2);
    }

    // MUTES
    if (message === "!muteall" && players.get(player.id).isAdmin) {
        muteAll = true;
        room.sendAnnouncement(`Oda susturuldu. Sadece adminler konuşabilir.`, undefined, COLOR.DARK_BLUE, "bold", 2);
    }
    if (message === "!unmuteall" && players.get(player.id).isAdmin) {
        muteAll = false;
        room.sendAnnouncement(`Odadaki herkes artık konuşabilir.`, undefined, COLOR.DARK_BLUE, "bold", 2);
    }
    if (message !== "!muteall" && message.startsWith("!mute") && players.get(player.id).isAdmin) {
        let [playerId,] = extractPassword(message.trim());
        players.set(parseInt(playerId.substring(1)), {...players.get(parseInt(playerId.substring(1))), muted: true});
        room.sendAnnouncement(`${player.name} artık AFK.`, undefined, COLOR.DARK_BLUE, "bold", 2);
    }
    if (message !== "!unmuteall" && message.startsWith("!unmute") && players.get(player.id).isAdmin) {
        let [playerId,] = extractPassword(message.trim());
        players.set(parseInt(playerId.substring(1)), {...players.get(parseInt(playerId.substring(1))), muted: false});
        room.sendAnnouncement(`${players.get(parseInt(playerId.substring(1))).name} konuşmasına izin verildi.`, undefined, COLOR.DARK_BLUE, "bold", 2);
    }

    // ADMIN
    if (message === "!admin" && players.get(player.id).isAdmin) {
        room.setPlayerAdmin(player.id, true);
    }
    if (message === "!mapchangeable" && players.get(player.id).isSuperAdmin) {
        mapChangeable = !mapChangeable
        room.sendAnnouncement(`Map ${mapChangeable ? 'değiştirilebilir' : 'değiştirilemez'}`, undefined, COLOR.BLUE, "normal", 0);
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
            room.sendAnnouncement(`${playerName} ⟹ Gol: ${response.data.GoalsCount} 🔹 Asist: ${response.data.AssistsCount} 🔹 Maç Sayısı: ${response.data.GamesPlayed} 🔹 Kazanılan: ${response.data.GamesWon} 🔹 Maç Başına Gol: ${(response.data.GoalsCount / response.data.GamesPlayed).toFixed(2)}`, undefined, COLOR.YELLOW, "normal", 0);
        } else {
            room.sendAnnouncement(`${playerName} henüz maç oynamadı.`, undefined, 0x06d6a0, "normal", 0);
        }

    }).catch((e) => {
        if (e.response.status === 409) {
            room.sendAnnouncement(`Kullanıcıya ait istatistik bulunamadı. Kullanıcı adını doğru girdiğinize emin olunuz`, undefined, COLOR.ORANGE, "bold", 0);
        } else {
            room.sendAnnouncement(`Sunucuya erişimde hata oluştur. Kayıt işlemi gerçekleşmedi.`, undefined, COLOR.RED, "bold", 0);
        }
    })
}

let register = (id, username, password) => {
    req({
        url: `/auth/signup`,
        method: 'post',
        data: {name: username, password, room: window.roomConfig.alias, conn: players.get(id).conn},
    }).then((response) => room.sendAnnouncement(`${username}, kaydınız gerçekleşti. "!onayla <şifre>" komutu ile giriş yapmayı unutmayınız.`, undefined, COLOR.ORANGE, "bold", 0))
    .catch((e) => {
        if (e.response.status === 409) {
            room.sendAnnouncement(`${username}, hesabınız zaten bulunmaktadır. Odadan kicklenmemek için giriş yapınız.`, undefined, COLOR.ORANGE, "bold", 0);
        } else {
            room.sendAnnouncement(`Sunucuya erişimde hata oluştur. Kayıt işlemi gerçekleşmedi.`, undefined, COLOR.RED, "bold", 0);
        }
    });
}


let login = (id, username, password) => {
    let player = players.get(id);
    if (player.authenticated) {
        return room.sendAnnouncement(`${username}, daha önce zaten giriş yaptınız.`, id, COLOR.ORANGE, "bold", 0);
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
        room.sendAnnouncement(`${username}, başarıyla giriş yaptınız. Hoşgeldiniz!`, undefined, COLOR.BLUE, "bold", 0);
    }).catch((e) => {
        if (e.response.status === 401) {
            room.sendAnnouncement(`${username}, yanlış şifre girdiniz. Kayıtlı değilseniz önce "!kaydol <şifre>" yaparak kaydolunuz.`, undefined, COLOR.RED, "bold", 0);
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
