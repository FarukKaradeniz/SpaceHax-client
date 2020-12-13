const USER_DATABASE = "USER_DATABASE";

var room = HBInit(window.roomConfig);
room.setDefaultStadium("Big");
room.setScoreLimit(5);
room.setTimeLimit(0);

let players = new Map();

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
    printRoomLink(link)
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