const init = () => {

    window.onHBLoaded = () => {
        console.log(getArgs())
        var room = HBInit({
            roomName: "@@@@@@@ KEKWwww @@@@@@@",
            maxPlayers: 16,
            public: true,
            token: getArgs()["--token"],
            noPlayer: true // Remove host player (recommended!)
        });
        room.setDefaultStadium("Big");
        room.setScoreLimit(5);
        room.setTimeLimit(0);

        // If there are no admins left in the room give admin to one of the remaining players.
        function updateAdmins() {
            // Get all players
            var players = room.getPlayerList();
            if (players.length == 0) return; // No players left, do nothing.
            if (players.find((player) => player.admin) != null) return; // There's an admin left so do nothing.
            room.setPlayerAdmin(players[0].id, true); // Give admin to the first non admin player in the list
        }

        room.onPlayerJoin = function (player) {
            updateAdmins();
        }

        room.onPlayerLeave = function (player) {
            updateAdmins();
        }
    }
    // To make sure room is initialized
    if (typeof window.HBInit === 'function')
        window.onHBLoaded()
}

export default init;