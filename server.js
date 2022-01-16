const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;

app.use(express.static(__dirname + '/Client'));
io.on('connection', onConnection);
http.listen(port, () => console.log('listening on http://localhost:' + port));

const ROOM_COUNT = 10; //number of public rooms available
const ROOM_LIMIT = 10; //maximum number of people in one room (according to UNO rules)

// Defining the starting numbers of the special cards 
const SKIP_CARD = 10;
const REVERSE_CARD = 11;
const DRAW_2_CARD = 12;
const WILDCARD = 13;

// Colours
const RED = 0;
const YELLOW = 1;
const GREEN = 2;
const BLUE = 3;

let deck = [0,1,2,3];

// Adding all the other card names to the deck
for (let i = 1; i <= 13; i++) {
    for (let j = 0; j <= 7; j++) {
        deck.push(i*10 + j);
    }
}

//initialize the rooms
let data = [];

function initRoom(roomName){
    let room = [];
    room['timer'] = [];
    room['timer']['id'] = 0; //setInterval() returns an id, which can be used to clearInterval()
    room['timer']['secondsLeft'] = 10; //number of seconds

    room['deck'] = [];
    room['discardPile'] = [];
    // room['reverse'] will always equal 1 or -1 to indicate the direction the moves are going in
    room['reverse'] = 1;
    room['turn'] = 0; //index of the player that is currently playing
    room['colour'] = 0;
    room['cardOnBoard'] = 0; //number representing the card on the board
    room['roomPlayerCount'] = 0;
    room['namesOfPlayers'] = [];

    let players = [];
    for (let j = 0; j < ROOM_LIMIT; j++) {
        players[j] = [];
        players[j]['id'] = 0;
        players[j]['username'] = "";
        players[j]['hand'] = [];
        players[j]['safe'] = true;
    }
    room['players'] = players;
    data[roomName] = room;
}

for (let i = 1; i <= ROOM_COUNT; i++) {
    initRoom('Room '+i);
}


//gets the number of players in a room
function getRoomSize(roomName){
    let size; //current number of players in this room
    try {
        size = io.sockets.adapter.rooms.get(roomName).size; //if the room exists, get the number of players
    } catch (e) {
        size = 0; //otherwise, the room is empty
    }
    return size;
}


//this function is called whenever the user is connected
function onConnection(socket) {
    console.log('a user connected')
    socket.on('requestRoom', function(username){
        socket.username = username;
        //go through each room and try to join
        for (let i = 1; i <= ROOM_COUNT; i++){
            let roomName = "Room " + i; //name of room
            let roomPlayerCount = getRoomSize(roomName);
            /*
            conditions for being able to join a room:
                - the room has not reached the ROOM_LIMIT
                - the room is not currently in a game (we check this with a countdown timer)
            */
            if (roomPlayerCount < ROOM_LIMIT && data[roomName]['timer']['secondsLeft'] > 0){
                socket.join(roomName); //join the room
                console.log(`${socket.username} joined ${roomName} (${roomPlayerCount+1}/${ROOM_LIMIT})`);
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


    // Play a card if it is legal to do so
    socket.on('playingCard', function(info) {

        let roomName = info[0];
        let card = info[1];

        let curPlayerIndex = data[roomName]['turn'];
        console.log("Player " + curPlayerIndex + " in " + roomName + " is trying to play " + card);

        // Current card that is face-up
        let curCard = data[roomName]['cardOnBoard'];
        let curCardNum = (curCard - (curCard % 10)) / 10;

        // Calculating the type of card that the user is trying to play and its colour using the digits in its name
        let cardNum = (card - (card % 10)) / 10; // First two digits represent the type of card
        let cardClr = ((card % 10) % 4); // Second two digits represent the colour of the card

        // We play the card if the move is valid
        if (isValidMove(card, roomName)) {
            data[roomName]['discardPile'].push(curCard) // Sending the current card on the board to the discard pile

            console.log("Sent " + curCard + " to the discardPile.");

            data[roomName]['cardOnBoard'] = card; // updating the current card on the board
            
            let cardIndex = data[roomName]['players'][curPlayerIndex]['hand'].indexOf(card); // Getting the index of the card that the player played
            data[roomName]['players'][curPlayerIndex]['hand'].splice(cardIndex, 1); // Remove the card from the players hand

            // Updating the current colour of the card on the board in the room
            data[roomName]['colour'] = cardClr;
            io.to(roomName).emit('showColour',cardClr);

            io.to(roomName).emit('showColour',cardClr);

            console.log("Player " + curPlayerIndex + " in " + roomName + " has played " + card);

            // Re-draw the deck of the current player (remove the card that the player just played)
            io.to(data[roomName]['players'][data[roomName]['turn']]['id']).emit('hand',data[roomName]['players'][curPlayerIndex]['hand']);

            // Re-draw the current card for all the players
            io.to(roomName).emit('currentCard',data[roomName]['cardOnBoard']);


            //if the player has 0 cards left, they win the game
            if (data[roomName]['players'][curPlayerIndex]['hand'].length == 0){
                io.to(roomName).emit('endGame', data[roomName]['players'][curPlayerIndex]['username']);
                initRoom(roomName);
                return;
            }

            //if the player has 1 card left, other players can call uno
            if (data[roomName]['players'][curPlayerIndex]['hand'].length == 1){
                data[roomName]['players'][curPlayerIndex]['safe'] = false;
            }

            //Move the turn
            // We only want to pass in the first two digits denoting the type of card and not the colour of the card
            moveTurn(roomName, cardNum);

            // The special effects of a SKIP_CARD or REVERSE_CARD are covered in moveTurn

            // Drawing 2 cards for the next player if a DRAW_2_CARD is played
            if (cardNum == DRAW_2_CARD) {
                // Drawing to cards for the next person
                drawCard(2, data[roomName]['turn'], roomName);
            }

            // If a wildDraw4Card was played (it can be distinguished from a normal WILDCARD based on its last digit)
            else if (cardNum == WILDCARD && (card % 10) >= 4) {
                drawCard(4, data[roomName]['turn'], roomName);
            }

            console.log("It is now Player " + data[roomName]['turn'] + "'s turn");
        }
        else {
            //otherwise, inform the client that the card was invalid
            io.to(data[roomName]['players'][data[roomName]['turn']]['id']).emit('playCardFailed');
        }
    });

    // When the current player has to draw a card
    socket.on('drawCard', function(info) {
        let numCards = info[0];
        let roomName = info[1];
        console.log(numCards,roomName);
        let playerIndex = data[roomName]['turn'];

        // A player can only draw a card if they dont have a playable card
        if (numCards == 1) {
            for (const card of data[roomName]['players'][playerIndex]['hand']) {

                if (isValidMove(card, roomName)) {
                    io.to(data[roomName]['players'][playerIndex]['id']).emit('playableCard');
                    return;
                }
            }
        }

        io.to(roomName).emit('drawCardSound');

        // Calling the function that will draw the card for the player
        drawCard(numCards, playerIndex, roomName);

        // Using a random non card number as a parameter so that it doesn't trigger a special case in the moveTurn function
        moveTurn(roomName, 1111);

        console.log("It is now Player " + data[roomName]['turn'] + "'s turn");
    });

    //changing the current colour (WILDCARDs)
    socket.on('changeColour', function(info) {
        let roomName = info[0]
        let colour = info[1];

        data[roomName]['colour'] = colour;
        io.emit('showColour',colour);

        if (colour == RED) {
            console.log("Changed colour to red.");
        }
        else if (colour == YELLOW) {
            console.log("Changed colour to yellow.");
        }
        else if (colour == GREEN) {
            console.log("Changed colour to green.");
        }
        else {
            console.log("Changed colour to blue.");
        }
    });

    //when the uno button is pressed by a player
    socket.on('unoPress', function(info){
        let roomName = info[0];
        let playerIndex = info[1];
        console.log(`${playerIndex} pressed the uno button`);

        //makes player safe if they are unsafe
        if (data[roomName]['players'][playerIndex]['safe'] == false){
            data[roomName]['players'][playerIndex]['safe'] = true;
            io.to(roomName).emit('isSafe',data[roomName]['namesOfPlayers'][playerIndex]);
        }

        //makes unsafe players in the room pick up
        for (let i = 0; i < data[roomName]['roomPlayerCount']; ++i){
            if (data[roomName]['players'][i]['safe'] == false){
                //if they catch another player, make them draw 2 and set them to safe again
                console.log(`${data[roomName]['namesOfPlayers'][playerIndex]} (index ${playerIndex}) said "UNO" before ${data[roomName]['players'][i]['username']} (index ${i}), making them draw 2 cards.`)
                drawCard(2,i,roomName);
                io.to(roomName).emit('caughtUnsafe',[data[roomName]['namesOfPlayers'][playerIndex],data[roomName]['players'][i]['username']]);
            }
        }
    });

    //handles user disconnection (removes them from the game)
    socket.on('disconnect', function() {
        //console.log("A user disconnected.");
        console.log("The socket id is: " + socket.id);

        // Looping through the rooms in data
        for (let room in data) {

            // Looping through the players in the room
            for (let player = 0; player < data[room]['roomPlayerCount']; ++player) {

                if (data[room]['players'][player]['id'] == socket.id) {
                    console.log(data[room]['players'][player]['username'] + " has disconnected.");
                    io.to(room).emit("playerDisconnected", data[room]['players'][player]['username']);

                    // If the player who left comes before the current player in the array of players then we subtract one from the turn
                    if (player < data[room]['turn']) {
                        data[room]['turn'] -= 1;
                        fixIndex(room);
                    }

                    // If it was the turn of the player who left, we move the turn to the next person and subtract one from the turn
                    if (data[room]['turn'] == player) {
                        moveTurn(room, 1111); // Passing in a card that will not flag any special cases in moveTurn
                        data[room]['turn'] -= 1;
                        fixIndex(room);
                    }

                    // Deleting the player from the room
                    data[room]['players'].splice(player, 1);

                    // Changing the count of the number of players in the room
                    data[room]['roomPlayerCount'] -= 1;

                    // If there is only one player remaining, that player wins
                    if (data[room]['roomPlayerCount'] == 1) {
                        io.to(room).emit('endGame', data[room]['players'][0]['username']);
                        initRoom(room);
                        return;
                    }

                    // Fixing the indices of the players in main.js
                    for (let i = 0; i < data[room]['roomPlayerCount']; ++i){
                        io.to(data[room]['players'][i]['id']).emit('receiveIndex',i);
                    }

                    initNames(room);
                    showPlayersCardCounts(room);
                    showTurn(room);
                    return;
                }
            }
        }
    })
}


//checks if a card is playable after the current card in the room
function isValidMove(card, roomName) {
    // Current card that is face-up
    let curCard = data[roomName]['cardOnBoard'];
    let curCardNum = (curCard - (curCard % 10)) / 10;

    // Extracting the digits in card number
    let cardNum = (card - (card % 10)) / 10;
    let cardClr = ((card % 10) % 4);

    if (curCardNum == cardNum || data[roomName]['colour'] == cardClr || cardNum >= 13) {
        return true;
    }

    return false;
}


//adds card(s) into the player's hand from the deck
function drawCard(numCards, playerIndex, roomName) {
    // Creating shallow copies of the game deck and the current players deck so that we can call them easily and adjust them
    let gameDeck = data[roomName]['deck'];
    let playerDeck = data[roomName]['players'][playerIndex]['hand'];

    // Drawing the number of cards specified for the current player
    for (let i = 0; i < numCards; ++i) {

        // If the deck is empty, we refill it with the discard pile
        if (data[roomName]['deck'].length == 0) {
            refillDeck(roomName);
        }
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

    // Update the client-side display
    showPlayersCardCounts(roomName);
    showTurn(roomName);
}


// Moves the turn to the next player and changes the boolean 'turn' for each player respectively
function moveTurn(roomName, cardPlayed) {
    // Making sure that the index received is non-negative and mod the number of people in the room (may be unnecessary now but delete later)
    fixIndex(roomName);
    let curPlayerIndex = data[roomName]['turn'];

    // Setting the turn of the current player to false
    io.to(data[roomName]['players'][curPlayerIndex]['id']).emit('setTurn', false);

    // Moving turn to the next person
    if (cardPlayed == SKIP_CARD) {
        io.to(data[roomName]['players'][(curPlayerIndex+data[roomName]['reverse'] + 2 * data[roomName][roomPlayerCount]) % data[roomName]['roomPlayerCount']]['id']).emit('skipped');
        data[roomName]['turn'] = (curPlayerIndex + 2 * data[roomName]['reverse']) % data[roomName]['roomPlayerCount'];
    }
    else if (cardPlayed == REVERSE_CARD) {
        // Changing the direction
        data[roomName]['reverse'] *= -1;
        io.to(roomName).emit('reversed');
        // Moving the turn
        data[roomName]['turn'] = (curPlayerIndex + 1 * data[roomName]['reverse']) % data[roomName]['roomPlayerCount'];
    }
    else {
        // Move the turn normally
        data[roomName]['turn'] = (curPlayerIndex + 1 * data[roomName]['reverse']) % data[roomName]['roomPlayerCount'];
    }

    // Makes sure data[roomName]['turn'] is non-negative
    fixIndex(roomName);

    let nextPlayerIndex = data[roomName]['turn'];

    console.log("Made next player index as " + nextPlayerIndex);

    // Setting turn true for the next player
    io.to(data[roomName]['players'][nextPlayerIndex]['id']).emit('setTurn', true);

    // Update the client-side display
    showPlayersCardCounts(roomName);
    showTurn(roomName);
}


// Fixes the index of the current player if its negative so that we don't get an error when accessing the player array at that index
function fixIndex(roomName) {
    data[roomName]['turn'] = (data[roomName]['turn'] + 10 * data[roomName]['roomPlayerCount']) % data[roomName]['roomPlayerCount'];
}


// Refills the deck form the discard pile
function refillDeck(roomName) {
    // Copying the cards in the discardPile to the deck
    for (let i = 0; i < data[roomName]['discardPile'].length; ++i) {
        data[roomName]['deck'].push(data[roomName]['discardPile'][i]);
    }
    data[roomName]['discardPile'] = []; // Emptying the discardPile
    randomizeDeck(roomName);

    console.log("The deck was refilled with the discard pile.");
}


// Shuffling the deck array using the Fisher-Yates shuffle algorithm
function randomizeDeck(roomName) {
    // https://javascript.info/task/shuffle
    randDeck = data[roomName]['deck'];
    for (let i = randDeck.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i
        // swap elements array[i] and array[j]
        [randDeck[i], randDeck[j]] = [randDeck[j], randDeck[i]];
    }
    data[roomName]['deck'] = randDeck;
}


//handles each second of countdown; when it reaches 0, starts the game
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
    let people = getRoomSize(roomName);
    // Updating the database with the number of people in the room
    data[roomName]['roomPlayerCount'] = people;

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

    // Generating a random deck for the room

    // We create a deep copy of the deck so that whatever changes happen 
    // to the deck of the current room dont happen in 'deck'
    data[roomName]['deck'] = [...deck];

    randomizeDeck(roomName);

    let randDeck = data[roomName]['deck'];

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

    let currentCard = randDeck[0];
    let currentCardNum = (currentCard - (currentCard % 10)) / 10;

    // Since the first card can be a special card (other than the WILDCARDs) we set current player's index to people-1 in the start so that if the first card
    // is a special card, its 'played' on the first player


    // If the starting card is a REVERSE_CARD, then if we moved the index once back in the start, moveTurn would've moved it back another instead of ahead.
    // In this case we simply want to move backwards now starting with the person 'before' the first person. So just doing moveTurn will suffice.
    if (currentCardNum != REVERSE_CARD) {
        data[roomName]['turn'] = people - 1;
    }

    // Updating the deck of the current room
    data[roomName]['deck'] = randDeck;

    // update the starting card
    data[roomName]['cardOnBoard'] = randDeck[0];

    // Setting the current colour on the board in the room
    data[roomName]['colour'] = ((randDeck[0] % 10) % 4);
    io.to(roomName).emit('showColour',data[roomName]['colour']);

    // Moving the turn to the first player (or the second if the first card is a SKIP_CARD)
    moveTurn(roomName, currentCardNum);

    // The only card that is greater than 120 and can be the start card is the DRAW_2_CARD. If so, the first player draws two cards.
    if (currentCard >= 120) {
        drawCard(2, data[roomName]['turn'], roomName);
    }

    // tell the clients what their hands are
    for (let i = 0; i < people; ++i){
        io.to(data[roomName]['players'][i]['id']).emit('hand',data[roomName]['players'][i]['hand']);
        io.to(data[roomName]['players'][i]['id']).emit('currentCard',data[roomName]['cardOnBoard']);
        io.to(data[roomName]['players'][i]['id']).emit('receiveIndex',i);
    }

    initNames(roomName);
    showPlayersCardCounts(roomName);
    showTurn(roomName);
}


//initializes the array containing names of the players in the room (to be displayed in client-side)
function initNames(roomName){
    console.log(roomName);
    data[roomName]['namesOfPlayers'] = []
    for (let i = 0; i < data[roomName]['roomPlayerCount']; ++i){
        data[roomName]['namesOfPlayers'].push(data[roomName]['players'][i]['username']);
    }
}


//emits to all everyone in the room the index of the current player
function showTurn(roomName){
    io.to(roomName).emit('showTurn', data[roomName]['turn']);
}


//emits to everyone in the room the number of cards of each player and their name
function showPlayersCardCounts(roomName){
    const playersCardCounts = [];
    for (let i = 0; i < data[roomName]['roomPlayerCount']; ++i){
        playersCardCounts.push(data[roomName]['players'][i]['hand'].length);
    }
    io.to(roomName).emit('showPlayersCardCounts',data[roomName]['namesOfPlayers'],playersCardCounts);
}