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

// Defining the starting numbers of the special cards 
const skipCard = 10;
const reverseCard = 11;
const draw2Card = 12;
const wildCard = 13;

deck = [0,1,2,3];

// Adding all the other card names to the deck
for (let i = 1; i <= 13; i++) {
    for (let j = 0; j <= 7; j++) {
        deck.push(i*10 + j);
    }
}


//initialize the "database"
let data = [];
for (let i = 1; i <= roomCount; i++) {
    let room = [];
    room['timer'] = [];
    room['timer']['id'] = 0; //setInterval() returns an id, which can be used to clearInterval()
    room['timer']['secondsLeft'] = 10; //number of seconds

    room['size'] = 0;
    room['deck'] = [];
    // room['reverse'] will always equal 1 or -1 to indicate the direction the moves are going in
    room['reverse'] = 1;
    room['turn'] = 0; //index of the player that is currently playing
    room['colour'] = 0;
    room['cardOnBoard'] = 0; //number representing the card on the board
    room['roomPlayerCount'] = 0;
    room['namesOfPlayers'] = [];

    let players = [];
    for (let j = 0; j < roomLimit; j++) {
        players[j] = [];
        players[j]['id'] = 0;
        players[j]['username'] = "";
        players[j]['hand'] = [];
        players[j]['safe'] = true;
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

        console.log("Player " + curPlayerIndex + " in " + info[0] + " is trying to play " + info[1]);


        // Current card that is face-up
        let curCard = data[info[0]]['cardOnBoard'];
        let curCardNum = (curCard - (curCard % 10)) / 10;
        // let curCardClr = ((curCard % 10) % 4);

        // Extracting the digits in the name of the card
        let card = info[1];

        let cardNum = (card - (card % 10)) / 10;
        let cardClr = ((card % 10) % 4);

        // If the card numbers are the same, the current colour is the same as the card that is tring to be played, or a wild/wild draw four card is played
        // the move is valid
        if (curCardNum == cardNum || data[info[0]]['colour'] == cardClr || cardNum >= 13) {

            data[info[0]]['cardOnBoard'] = card;
            
            // Remove the card from the players hand
            data[info[0]]['currentCard']  = data[info[0]]['players'][curPlayerIndex]['hand'].indexOf(info[1]);
            let cardIndex = data[info[0]]['players'][curPlayerIndex]['hand'].indexOf(info[1]);

            // Updating the current colour of the card on the board in the room
            data[info[0]]['colour'] = cardClr;

            data[info[0]]['players'][curPlayerIndex]['hand'].splice(cardIndex, 1);

            //if the player has 1 card left, other players can call uno
            if (data[info[0]]['players'][curPlayerIndex]['hand'].length == 1){
                data[info[0]]['players'][curPlayerIndex]['safe'] = false;
            }

            console.log("Player " + curPlayerIndex + " in " + info[0] + " has played " + info[1]);


            // Re-draw the deck of the current player (remove the card that the player just played)
            io.to(data[info[0]]['players'][data[info[0]]['turn']]['id']).emit('hand',data[info[0]]['players'][curPlayerIndex]['hand']);

            // Re-draw the current card for all the players
            for (let i = 0; i < data[info[0]]['players'].length; ++i){
                io.to(data[info[0]]['players'][i]['id']).emit('currentCard',data[info[0]]['cardOnBoard']);
            }

            //Move the turn
            // We only want to pass in the first two digits denoting the type of card and not the colour of the card
            moveTurn(info[0], cardNum);

            // The special effects of a skipCard or reverseCard are covered in moveTurn

            // Drawing 2 cards for the next player if a draw2Card is played
            if (cardNum == draw2Card) {
                // Drawing to cards for the next person
                drawCard(2, nextPlayerIndex, info[0]);
            }
            else if (cardNum == wildCard && (card % 10) >= 4) {
                drawCard(4, nextPlayerIndex, info[0]);
            }


            console.log("It is now Player " + data[info[0]]['turn'] + "'s turn");
    
        }

    });

    // Went the current player has to draw a card
    socket.on('drawCard', function(info) {

        let numCards = info[0];
        let username = info[1];
        let roomName = info[2];
        let playerIndex = data[roomName]['namesOfPlayers'].indexOf(username);

        // Calling the function that will draw the card for the player
        drawCard(numCards, playerIndex, roomName);

        // Using a random non card number as a parameter so that it doesn't trigger a special case in the moveTurn function
        moveTurn(roomName, 1111);

        console.log("It is now Player " + data[roomName]['turn'] + "'s turn");
    });

    socket.on('changeColour', function(info) {
        let roomName = info[0]
        let colour = info[1];

        data[roomName]['colour'] = colour;

        console.log("Changed colour to " + colour);
    });

    socket.on('unoPress', function(info){
        let roomName = info[0], username = info[1];
        let tplayerIndex = data[roomName]['namesOfPlayers'].indexOf(username);
        console.log(`${tplayerIndex} pressed the uno button`);

        //makes player safe if they are unsafe
        data[roomName]['players'][tplayerIndex]['safe'] = true;

        //makes unsafe players in the room pick up
        for (let i = 0; i < data[roomName]['size']; ++i){
            if (data[roomName]['players'][i]['safe'] == false){
                //if they catch another player, make them draw 2 and set them to safe again
                console.log(`${username} (index ${tplayerIndex}) said "UNO" before ${data[roomName]['players'][i]['username']} (index ${i}), making them draw 2 cards.`)
                drawCard(2,i,roomName);
            }
        }
    });
}


function drawCard(numCards, playerIndex, roomName) {
    console.log(roomName);

    // Creating shallow copies of the game deck and the current players deck so that we can call them easily and adjust them
    let gameDeck = data[roomName]['deck'];
    let playerDeck = data[roomName]['players'][playerIndex]['hand'];

    // Drawing the number of cards specified for the current player
    for (let i = 0; i < numCards; ++i) {
        playerDeck.push(gameDeck[0]);

        console.log("Player " + playerIndex + " drew " + gameDeck[0]);

        // Removing the first element in the deck since the current player has drawn it
        gameDeck.splice(0,1);
    }

    if (data[roomName]['players'][playerIndex]['hand'].length != 1){
        data[roomName]['players'][playerIndex]['safe'] = true;
    }

    // Re-draw the deck of the player who drew the card(s)
    io.to(data[roomName]['players'][playerIndex]['id']).emit('hand',data[roomName]['players'][playerIndex]['hand']);

    showPlayersCardCounts(roomName);
}


// Moves the turn to the next player and changes the boolean 'turn' for each player respectively
function moveTurn(roomName, cardPlayed) {

    let curPlayerIndex = data[roomName]['turn'];

    // Setting the turn of the current player to false
    io.to(data[roomName]['players'][curPlayerIndex]['id']).emit('setTurn', false);

    // Moving turn to the next person

    if (cardPlayed == skipCard) {
        data[roomName]['turn'] = (curPlayerIndex + 2 * data[roomName]['reverse']) % data[roomName]['size'];
    }

    else if (cardPlayed == reverseCard) {
        
        // Changing the direction
        data[roomName]['reverse'] *= -1;
        // Moving the turn
        data[roomName]['turn'] = (curPlayerIndex + 1 * data[roomName]['reverse']) % data[roomName]['size'];
    }

    else {
        data[roomName]['turn'] = (curPlayerIndex + 1 * data[roomName]['reverse']) % data[roomName]['size'];
    }

    // Makes sure data[roomName]['turn'] is non-negative
    fixIndex(roomName);

    let nextPlayerIndex = data[roomName]['turn'];

    console.log("Made next player index as " + nextPlayerIndex);

    // Setting turn true for the next player
    io.to(data[roomName]['players'][nextPlayerIndex]['id']).emit('setTurn', true);

    showTurn(roomName);
    showPlayersCardCounts(roomName);
}


// Fixes the index of the current player if its negative so that we don't get an error when accessing the player array at that index
function fixIndex(roomName) {
    data[roomName]['turn'] = (data[roomName]['turn'] + 10 * data[roomName]['size']) % data[roomName]['size'];
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
    data[roomName]['size'] = people;

    // If there are more than 2 people in the room, we start the game
    if (people < 2) return;
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
    while (randDeck[0] >= 130) {
        let specialCard = randDeck[0];
        randDeck = randDeck.slice(1, randDeck.length);
        randDeck.push(specialCard);
    }

    // Since the first card can be a special card (other than the wildcards) we set current player's index to people-1 in the start so that if the first card
    // is a special card, its 'played' on the first player
    data[roomName]['turn'] = people - 1;
    let currentCard = randDeck[0];
    currentCard = (currentCard - (currentCard % 10)) / 10;

    moveTurn(roomName, currentCard);

    // Updating the deck of the current room
    data[roomName]['deck'] = randDeck;

    // update the starting card
    data[roomName]['cardOnBoard'] = randDeck[0];

    // Setting the current colour on the board in the room
    data[roomName]['colour'] = ((randDeck[0] % 10) % 4);

    // tell the clients what their hands are
    for (let i = 0; i < people; ++i){
        io.to(data[roomName]['players'][i]['id']).emit('hand',data[roomName]['players'][i]['hand']);
        io.to(data[roomName]['players'][i]['id']).emit('currentCard',data[roomName]['cardOnBoard']);
    }

    //make the first player to join the room able to play
    io.to(data[roomName]['players'][0]['id']).emit('setTurn', true);

    initNames(roomName);
    showTurn(roomName);
    showPlayersCardCounts(roomName);
}


//initializes the array containing names of the players in the room (to be displayed in client-side)
function initNames(roomName){
    for (let i = 0; i < data[roomName]['size']; ++i){
        data[roomName]['namesOfPlayers'].push(data[roomName]['players'][i]['username']);
    }
}


//emits to all everyone in the room the index of the 
function showTurn(roomName){
    io.to(roomName).emit('showTurn', data[roomName]['turn']);
}


//emits to everyone in the room the number of cards of each player and their name
function showPlayersCardCounts(roomName){
    const playersCardCounts = [];
    for (let i = 0; i < data[roomName]['size']; ++i){
        playersCardCounts.push(data[roomName]['players'][i]['hand'].length);
    }
    io.to(roomName).emit('showPlayersCardCounts',data[roomName]['namesOfPlayers'],playersCardCounts);
}