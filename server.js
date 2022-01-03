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

deck = ['deck0.png', 'deck1.png', 'deck2.png', 'deck3.png'];

// Adding all the other card names to the deck
for (let i = 1; i <= 13; i++) {
    for (let j = 0; j <= 7; j++) {
        deck.push('deck' + (i*10 + j) + '.png');
    }
}


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
                roomPlayerCount = io.sockets.adapter.rooms.get(roomName).size; //if the room exists, get the number of players
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
                    data[roomName]['timer']['id'] = setInterval(function() {countdown(roomName)}, 1000); //start new countdown
                }
                return;
            }
        }
        //none of the rooms were available; inform the client
        io.to(socket.id).emit('responseRoom', 'error');
        console.log('All rooms are full!');
    });


    // Playing a card if it is legal to do so

    socket.on('playingCard', function(info) {

        let curPlayerIndex = data[info[0]]['turn'];

        let cardPath = data[info[0]]['cardOnBoard'];

        console.log(info[0]);
        console.log(info[1]);

        // console.log("Card Path: " + cardPath);

        // Current card that is face-up
        let curCard = parseInt(cardPath.substring(4, cardPath.length - 4));
        let curCardNum = (curCard - (curCard % 10)) / 10;
        let curCardClr = ((curCard % 10) % 4);

        // console.log("curCard: " + curCard);
        // console.log("curCardNum: " + curCardNum);
        // console.log("curCardClr: " + curCardClr);

        // console.log("\n");

        // Extracting the digits in the name of the card
        let card = parseInt(info[1].substring(4, info[1].length - 4));

        // Do case for wild cards later

        let cardNum = (card - (card % 10)) / 10;
        let cardClr = ((card % 10) % 4);

        // console.log("card: " + card);
        // console.log("cardNum: " + cardNum);
        // console.log("cardClr: " + cardClr);

        // If the card numbers are the same or the card colours are the same, the move is valid
        if (curCardNum == cardNum || curCardClr == cardClr) {
            console.log("YES");
            data[info[0]]['cardOnBoard'] = card;
            
            // Remove the card from the players hand
            let cardIndex = data[info[0]]['players'][curPlayerIndex]['hand'].indexOf(info[1]);
            
            data[info[0]]['players'][curPlayerIndex]['hand'].splice(cardIndex, 1);

            

            // Re-draw the deck of the current player
            
            io.to(data[info[0]]['players'][data[info[0]]['turn']]['id']).emit('hand',data[info[0]]['players'][curPlayerIndex]['hand']);

            // Re-draw the current card for all the players
            for (let i = 0; i < data[info[0]]['players'].length; ++i){
                io.to(data[info[0]]['players'][i]['id']).emit('currentCard',data[info[0]]['cardOnBoard']);
            }
        }
    });
}


function countdown(roomName){
    let secondsLeft = data[roomName]['timer']['secondsLeft']--; //decrease secondsLeft
    io.to(roomName).emit('countDown', secondsLeft); //inform the rooms how long until the game starts
    console.log(`${roomName} Game starting in ${secondsLeft}`);
    if (secondsLeft == 0){
        //countdown reached 0
        clearInterval(data[roomName]['timer']['id']); //stop the countdown
        startGame(roomName); //start game
    }
}

// Begins a game if the conditions to begin a game are met
function startGame(roomName) {

    console.log(roomName + ': Requesting game');
    // variable to hold the number of people in the room
    let people;
    // Checking if a room has people
    try {
        people = io.sockets.adapter.rooms.get(roomName).size;
    } 
    // If there are no people, we do not start the game in the room
    catch (e) {
        console.log(roomName + ': No one here');
        return;
    }

    // If there are more than 2 people in the room, we start the game
    if (people >= 2) {
        console.log(roomName + ": Starting game");

        // Storing the playerSockets as a set
        let playerSockets = io.sockets.adapter.rooms.get(roomName);

        let counter = 0;

        // Updating the database with the sockets of each player in the room and their username
        for (let item of playerSockets) {
            data[roomName]['players'][counter]['id'] = item;
            data[roomName]['players'][counter]['username'] = io.sockets.sockets.get(item).username;
            counter += 1;
        }

        // Updating the data base with the number of people in the room
        data[roomName]['roomPlayerCount'] = people;

        // Generating a random deck for the room

        // We create a deep copy of the deck so that whatever changes happen 
        // to the deck of the current room dont happen in 'deck'
        randDeck = [...deck];

        // Shuffling the array using the Fisher-Yates shuffle algorithm
        // https://javascript.info/task/shuffle
        
        for (let i = randDeck.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i
        
            // swap elements array[i] and array[j]
            [randDeck[i], randDeck[j]] = [randDeck[j], randDeck[i]];
          }

        // Dealing 7 cards to each player
        for (let i = 0; i < people; i++) {
            data[roomName]['players'][i]['hand'] = randDeck.slice(7 * i, 7 * (i+1));
        }

        // Making the deck the remaining cards
        randDeck = randDeck.slice(7 * people, randDeck.length);

        // While a wild card or a draw 4 wild card is at the top of the deck, we move it to the bottom of the deck
        while (parseInt(randDeck[0].slice(4, randDeck[0].length - 4)) >= 130) {
            console.log('yes');
            let specialCard = randDeck[0];
            randDeck = randDeck.slice(1, randDeck.length);
            randDeck.push(specialCard);
        }

        // Updating the deck of the current room
        data[roomName]['deck'] = randDeck;

        // update the starting card
        data[roomName]['cardOnBoard'] = randDeck[0];

        // tell the clients what their hands are
        for (let i = 0; i < people; ++i){
            io.to(data[roomName]['players'][i]['id']).emit('hand',data[roomName]['players'][i]['hand']);
            io.to(data[roomName]['players'][i]['id']).emit('currentCard',data[roomName]['cardOnBoard']);
        }
    }
}