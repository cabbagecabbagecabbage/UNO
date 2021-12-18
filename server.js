const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;

app.use(express.static(__dirname + '/Client'));
io.on('connection', onConnection);
http.listen(port, () => console.log('listening on http://localhost:' + port));

const roomCount = 10; //number of public rooms available
const roomLimit = 10; //maximum number of people in one room (according to UNO rules)


//initialize the "database"
let data = [];
for (let i = 1; i <= roomCount; i++) {
    let room = [];
    room['timer'] = [];
    room['timer']['id'] = 0; //setInterval() returns an id, which can be used to clearInterval()
    room['timer']['secondsLeft'] = 10; //number of seconds

    room['deck'] = [];
    room['reverse'] = 0;
    room['turn'] = 0;
    room['cardOnBoard'] = 0;
    room['roomPlayerCount'] = 0;

    let players = [];
    for (let j = 0; j < roomLimit; j++) {
        players[j] = [];
        players[j]['id'] = 0;
        players[j]['username'] = "";
        players[j]['hand'] = [];
    }
    room['players'] = players;
    data['Room '+i] = room;
}



function onConnection(socket) {
    console.log('a user connected')

    socket.on('requestRoom', function(username){
        socket.username = username;
        //go through each room and try to join
        for (let i = 1; i <= roomCount; i++){
            let roomName = "Room " + i; //name of room
            let roomPlayerCount; //current number of players in this room
            try {
                roomPlayerCount = io.sockets.adapter.rooms[roomName].length; //if the room exists, get the number of players
            } catch (e) {
                roomPlayerCount = 0; //otherwise, the room is empty
            }
            /*
            conditions for being able to join a room:
                - the room has not reached the roomLimit
                - the room is not currently in a game (we check this with a countdown timer)
            */
            if (roomPlayerCount < roomLimit && data[roomName]['timer']['secondsLeft'] > 0){
                socket.join(roomName); //join the room
                console.log(`${socket.username} joined ${roomName} (${roomPlayerCount+1}/${roomLimit})`);
                io.to(socket.id).emit('responseRoom', roomName); //tell the client they were able to join
                if (roomPlayerCount != 0){
                    //now that there are enough people to start the game, [re]start the countdown
                    //refer to https://www.w3schools.com/jsref/met_win_setinterval.asp
                    clearInterval(data[roomName]['timer']['id']); //clear the previous countdown using the id returned from setInterval
                    data[roomName]['timer']['secondsLeft'] = 10; //reset secondsLeft
                    data[roomName]['timer']['id'] = setInterval(countdown(roomName), 1000); //start new countdown
                }
                return;
            }
        }
        //none of the rooms were available; inform the client
        io.to(socket.id).emit('responseRoom', 'error');
        console.log('All rooms are full!');
    });
}

function countdown(roomName){
    let secondsLeft = data[roomName]['timer']['secondsLeft']--; //decrease secondsLeft
    io.to(roomName).emit('countDown', secondsLeft); //inform the rooms how long until the game starts
    console.log(`${roomName} Game starting in ${secondsLeft}`);
    if (secondsLeft == 0){
        //countdown reached 0
        clearInterval(data[roomName]['timer']['id']); //stop the countdown
        startGame(roomName);
    }
}