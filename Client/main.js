const socket = io({autoConnect: false});

const canvas = document.getElementById('canvas'); //canvas of html page
var rect;
const ctx = canvas.getContext('2d'); //drawing context

// Sound effects
var drawCardSound = new sound("sound-effects/Card-flip-sound-effect.mp3")


//cards
const CARD_WIDTH = 120, CARD_HEIGHT = 180; //must be in the ratio 2:3 to avoid distortion
const TOP_MARGIN = 200, LEFT_MARGIN = 80;

const cardBackSide = new Image(); //image of the backside of an uno card
const unoButton = new Image(); //image of the uno button
const deck = []; //array of images of the cards in the deck

//button position and dimensions
const BUTTON_W = 110;
const BUTTON_H = 77;
const BUTTON_X = LEFT_MARGIN+5*CARD_WIDTH;
const BUTTON_Y = TOP_MARGIN-(CARD_HEIGHT-BUTTON_H)/2-BUTTON_H;

//deck card image position
const DECK_X = LEFT_MARGIN+3.75*CARD_WIDTH;
const DECK_Y = TOP_MARGIN-CARD_HEIGHT;

//colour rectangle position and dimensions
const COLOUR_W = 77; //matching the height of the uno button image
const COLOUR_H = 77;
const COLOUR_X = LEFT_MARGIN + 1.35*CARD_WIDTH + (CARD_WIDTH - COLOUR_W) / 2;
const COLOUR_Y = TOP_MARGIN-(CARD_HEIGHT-COLOUR_H)/2-COLOUR_H;
const colours = {
    0: 'red',
    1: 'yellow',
    2: 'green',
    3: 'blue'
}; //maps constant to colour name, which is then usable by ctx.fillStyle


//top bar
let header = document.getElementById("header");
let countdown = document.getElementById("countdown");
let playerlist = document.getElementById("playerlist");


// https://www.w3schools.com/jsref/prop_style_visibility.asp -> Style Visibility Property for buttons

// Red, Yellow, Green, Blue Buttons for when a player plays a wild card 
// Initially make them invisible -> only visible when a player plays a wild card
// https://stackoverflow.com/questions/53263825/add-css-to-a-javascript-button -> linking buttons added here to main.css through the property 'className'
const redButton = document.createElement('button');
redButton.innerText = 'Red';
redButton.setAttribute('disabled', 'disabled');
redButton.className = "red_button";
redButton.style.visibility = "hidden";
document.body.appendChild(redButton);
redButton.addEventListener("click", function() {
    setColour(0);
});

const yellowButton = document.createElement('button');
yellowButton.innerText = 'Yellow';
yellowButton.setAttribute('disabled', 'disabled');
yellowButton.className = 'yellow_button';
yellowButton.style.visibility = "hidden";
document.body.appendChild(yellowButton);
yellowButton.addEventListener("click", function() {
    setColour(1);
});

const greenButton = document.createElement('button');
greenButton.innerText = 'Green';
greenButton.setAttribute('disabled', 'disabled');
greenButton.className = 'green_button';
greenButton.style.visibility = "hidden";
document.body.appendChild(greenButton);
greenButton.addEventListener("click", function() {
    setColour(2);
});

const blueButton = document.createElement('button');
blueButton.innerText = 'Blue';
blueButton.setAttribute('disabled', 'disabled');
blueButton.className = 'blue_button';
blueButton.style.visibility = "hidden";
document.body.appendChild(blueButton);
blueButton.addEventListener("click", function() {
    setColour(3);
});


let wildCard = 0; // Making a variable to store the number of a wild card if played
let wildCardPlayed = false // Boolean storing if a wild card is played and the change colour buttons are visible
let room; //stores the name of the room the player is in
let hand = []; //stores the hand of the player
let turn = false; // stores whether it is the player's turn
let username; //stores the username of the player
let index; //stores the index of the player in the array of players in the room


//initializing the client side
function init() {
	//font, loading images
	ctx.font = "16px Arial";
	cardBackSide.src = "images/uno.png";
    unoButton.src = "images/unoButton.png";
	for (let i = 0; i <= 13; ++i){
		for (let j = 0; j <= 7; ++j){
			deck[`deck${i*10+j}.png`] = new Image();
			deck[`deck${i*10+j}.png`].src = `images/deck/deck${i*10+j}.png`;
		}
	}

	//add listeners for mouse-click events (refer to https://www.w3schools.com/jsref/dom_obj_event.asp)
	document.addEventListener('click', onMouseClick);

    //check if they already have a username stored in cookie
	checkCookie()
}


//connects to server and requests a room
function joinGame(){
    //connect to server
    socket.connect();
    //request for a room
    socket.emit('requestRoom', username); //tell server to request room, passing in the username
    console.log('Room Requested');
}


/*
name: the name of the cookie (what sort of information we are storing)
value: the actual value of the cookie based on the user that has joined
       the server
days: the number of days until the expiration of the cookie
*/
// https://www.w3schools.com/js/js_cookies.asp
function setCookie(name, value, days) {
    let date = new Date();

    // https://www.w3schools.com/jsref/tryit.asp?filename=tryjsref_settime
    // We setTime by passing in how many milliseconds after the current 
    // time we want to set it to
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    let expires = "expires="+ date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}


// takes the cookie and returns the username of the player 
function getCookie(cookieName) {
    let name = cookieName + "=";

    // decoding the cookie string to handle special characters
    // (if there are any)
    let decodedCookie = decodeURIComponent(document.cookie);

    // splitting the cookie into elements in an array based on ;'s
    let ca = decodedCookie.split(';');

	// Looping through the characters in the cookie
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];

        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }

        // If we find the cookie name, we return the value of the cookie
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }

    return "";
}


//generating a random number in a range [min,max)
//https://stackoverflow.com/questions/1527803/generating-random-whole-numbers-in-javascript-in-a-specific-range
function genRand(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}


//checks if they already have a username stored in the cookie
function checkCookie() {
    username = getCookie("username");

    // If the username isn't empty, we welcome the user again by using an alert box
    if (username != "") {
        // alert("Welcome again " + username);
        Swal.fire({
          title: `Welcome back, ${username}.`,
          icon: 'success',
          confirmButtonText: 'Play',
          allowOutsideClick: false,
        }).then((result) => {
            if (result.isConfirmed){
                joinGame();
            }
        });
    }

    // Otherwise we request the username
    else {
        // username = prompt("Please enter your name:", "");
        Swal.fire({
          title: "Enter your name:",
          input: 'text',
          inputValue: 'Player'+genRand(1000,10000),
          inputAttributes: {
            autocapitalize: 'off',
            maxlength: 10,
          },
          confirmButtonText: 'Play',
          allowOutsideClick: false,
        }).then((result) => {
            console.log(result.value, username);
            // If the username entered isn't an empty string or null 
            // we set the cookie with the username entered
            if (result.isConfirmed && result.value){
                username = result.value;
                console.log('username updated:',username);
                setCookie("username", username, 1);
                joinGame();
            }
        });
    }
}

 
//processes mouse clicks (playing and drawing cards, pressing uno button)
function onMouseClick(e) {
    rect = canvas.getBoundingClientRect();
    let pageX = e.pageX - rect.left, pageY = e.pageY - rect.top;
    console.log(pageX,pageY);
    //if it is the player's turn...
    if (turn && ! wildCardPlayed){
        //check for playing a card
        let column = 0, row = 0.5;
        for (let i = 0; i < hand.length; ++i){
            if (column == 7){
                //go to next row
                column = 0;
                ++row;
            }
            let cardX = LEFT_MARGIN+column*CARD_WIDTH;
            let cardY = TOP_MARGIN+row*CARD_HEIGHT;
            //check if the click is within the area of the card
            if (cardX < pageX && pageX < cardX + CARD_WIDTH && cardY < pageY && pageY < cardY + CARD_HEIGHT){
                // if a wild card was played, we un-disable the change colour buttons
                if (hand[i] >= 130) {

                    wildCardPlayed = true;
                    wildCard = hand[i];

                    // Making the buttons visible and clickable
                    redButton.disabled = false;
                    redButton.style.visibility = "visible";
                    yellowButton.disabled = false;
                    yellowButton.style.visibility = "visible";
                    greenButton.disabled = false;
                    greenButton.style.visibility = "visible";
                    blueButton.disabled = false;
                    blueButton.style.visibility = "visible";
                }
                else {
                    //inform the server that we are playing this card
                    console.log(`${hand[i]} played`);
                    socket.emit('playingCard', [room, hand[i]]); 
                    return;
                    // 
                }
            }
            ++column;
        }

        //check for drawing a card
        if (LEFT_MARGIN+4*CARD_WIDTH < pageX &&
            pageX < LEFT_MARGIN+5*CARD_WIDTH &&
            TOP_MARGIN-CARD_HEIGHT < pageY &&
            pageY < TOP_MARGIN){
            console.log(`drawing a card`);
            socket.emit('drawCard', [1,room]);
            return;
        }
    }
    //if the uno button is clicked
    if (BUTTON_X <= pageX && pageX <= BUTTON_X + BUTTON_W && BUTTON_Y <= pageY && pageY <= BUTTON_Y + BUTTON_H){
        console.log('uno button pressed');
        socket.emit('unoPress', [room, index]);
    }
}


// alert the user when the try to play an invalid card
socket.on('playCardFailed', function(){
    Swal.fire({
      title: 'Oops!',
      text: "You can't play that card",
      icon: 'error',
      showConfirmButton: false,
      timer: 1000
    });
});



// alert the user that they cannot draw when they have a playable card in hand
socket.on('playableCard', function(){
    Swal.fire({
      title: 'Oops!',
      text: 'You cannot draw when when you have a playable card.',
      icon: 'error',
      showConfirmButton: false,
      timer: 1000
    });
})


function setColour(colour) {
    // Playing the wildCard now so that the next player can only make a turn after the current player has chosen a colour
    //inform the server that we are playing this card
    console.log(`${wildCard} played`);
    socket.emit('playingCard', [room, wildCard]);

    // Changing the current colour of the room
    socket.emit('changeColour', [room, colour]);

    redButton.disabled = true;
    redButton.style.visibility = "hidden";
    yellowButton.disabled = true;
    yellowButton.style.visibility = "hidden";
    greenButton.disabled = true;
    greenButton.style.visibility = "hidden";
    blueButton.disabled = true;
    blueButton.style.visibility = "hidden";

    wildCardPlayed = false;
}


//process the response of the room request: either you can join a room, or everything is full
socket.on('responseRoom', function(roomName){
    if (roomName != 'error'){
        room = roomName;
        console.log(`${username} successfully joined ${room}`);
        //alert the user
        Swal.fire({
            title: `You joined ${roomName}`,
            text: 'The game will start soon!',
            icon: 'success',
            showConfirmButton: false,
            timer: 3000,
        });
        //clear the canvas
        ctx.clearRect(0,0,canvas.width,canvas.height);
        //display the player's name and room name
        header.innerHTML = `${username} &emsp; &emsp; ${roomName}`;
    }
    else {
        socket.disconnect();
        //alert the user that all rooms are full
        Swal.fire({
          title: 'Oops!',
          text: 'All rooms are full! Try again later',
          icon: 'error',
          showConfirmButton: true,
        });
    }
});


//displays the countdown to the start of the game
socket.on('countDown', function(secondsLeft){
    if (secondsLeft != 0){
        countdown.style.display = "block";
        countdown.innerHTML = `The game will start in ${secondsLeft} seconds`;
    }
    else {
        countdown.style.display = "none"; //stop displaying the countdown
        //the game now starts; draw the static images
        ctx.drawImage(cardBackSide,DECK_X, DECK_Y, CARD_WIDTH, CARD_HEIGHT);//drawing the back of card (representing the deck)
        ctx.drawImage(unoButton,BUTTON_X,BUTTON_Y,BUTTON_W,BUTTON_H); //drawing the uno button
    }
});


//resizes the canvas (inspired by https://stackoverflow.com/questions/5517783/preventing-canvas-clear-when-resizing-window)
function resize(height){
    let curImage = ctx.getImageData(0,0,canvas.width,canvas.height);
    canvas.height = height;
    ctx.putImageData(curImage,0,0);
    ctx.font = "16px Arial";
}


//receives and displays the hand
socket.on('hand', function(playerHand){
    console.log("Displaying the cards...");
    hand = playerHand; //update the hand of the client
    let rows = Math.floor((hand.length-1) / 7); //calculate the number of rows needed
    let requiredHeight = (rows+2.5)*CARD_HEIGHT + TOP_MARGIN; //calculate the required height

    //check if the canvas is tall enough
    if (requiredHeight > canvas.height){
        //resize the canvas
        resize(requiredHeight);
    }

    ctx.clearRect(0,TOP_MARGIN,canvas.width,canvas.height); //clear the canvas space where the previous hand was drawn
    let row = 0.5, column = 0;
    for (let i = 0; i < hand.length; ++i){
        if (column == 7){
            //go to next row
            column = 0;
            ++row;
        }
        //draw the card at the position, offset by the left margin and top margin
        ctx.drawImage(deck[`deck${hand[i]}.png`],
                      LEFT_MARGIN+column*CARD_WIDTH,
                      TOP_MARGIN+row*CARD_HEIGHT,
                      CARD_WIDTH,
                      CARD_HEIGHT);
        ++column;
    }
});


//plays audio when a card is drawn
socket.on('drawCardSound', function() {
    drawCardSound.play();
})


// https://www.w3schools.com/graphics/game_sound.asp --> code for adding sound effects
function sound(src) {
    this.sound = document.createElement("audio");
    this.sound.src = src;
    this.sound.setAttribute("preload", "auto");
    this.sound.setAttribute("controls", "none");
    this.sound.style.display = "none";
    document.body.appendChild(this.sound);
    this.play = function(){
      this.sound.play();
    }
    this.stop = function(){
      this.sound.pause();
    }
}


//sets the turn variable to true or false (true if it is the player's turn, false otherwise)
socket.on('setTurn', function(bool) {
    turn = bool;
    //inform the user it is their turn
    if (turn){
        Swal.fire({
            title: "It's your turn!",
            showConfirmButton: false,
            timer: 1000
        })
    }
});


//sends an alert informing the user that the direction of turns has been reversed by a reverse turn card
socket.on('reversed', function(){
    console.log('reversed');
    Swal.fire({
        title: "The direction was reversed!",
        showConfirmButton: false,
        timer: 1000
    });
});


//sends an alert informing the user that their turn was skipped by a skip turn card
socket.on('skipped', function(){
    console.log('skipped');
    Swal.fire({
        title: "Your turn was skipped!",
        showConfirmButton: false,
        timer: 1000
    });
});


//sends an alert informing the players in the room that a player pressed uno so they are safe
socket.on('isSafe',function(username){
    Swal.fire({
        title: 'uno!',
        text: `${username} pressed uno: they have one card left.`,
        showConfirmButton: false,
        timer:1000
    });
});


//sends an alert informing the players in the room that a player pressed uno so they are safe
socket.on('caughtUnsafe',function(username1, username2){
    Swal.fire({
        title: 'uno!',
        text: `${username1} caught ${username2} with 1 card: ${username2} draws 2 cards!`,
        showConfirmButton: false,
        timer:1000
    });
});


//receives and displays the current card, displays the deck and uno button
socket.on('currentCard', function(currentCard){
    ctx.clearRect(LEFT_MARGIN+2.5*CARD_WIDTH,TOP_MARGIN-CARD_HEIGHT,CARD_WIDTH,CARD_HEIGHT); //clearing the space for current card
    ctx.drawImage(deck[`deck${currentCard}.png`],LEFT_MARGIN+2.5*CARD_WIDTH,TOP_MARGIN-CARD_HEIGHT,CARD_WIDTH,CARD_HEIGHT); //drawing the current card
});


//displays an indicator next to the name of whichever player's turn it is
socket.on('showTurn', function(turnIndex){
    let players = playerlist.children;
    players[turnIndex].style.fontWeight = "900"; //make the player's name and cards bold
});


//receives the player index from the server once the game room has been decided
socket.on('receiveIndex', function(playerIndex){
    index = playerIndex;
});


//displays the names and number of cards of each play in the room
socket.on('showPlayersCardCounts', function(namesOfPlayers,playersCardCounts){
    playerlist.innerHTML = '';
    for (let i = 0; i < playersCardCounts.length; ++i){
        let playerText = document.createElement("p");
        playerText.appendChild(document.createTextNode(`${namesOfPlayers[i]}: ${"• ".repeat(playersCardCounts[i])}`));
        playerText.style.whiteSpace = 'nowrap';
        playerText.style.marginTop = 0;
        playerlist.appendChild(playerText);
    }
});


socket.on('showColour', function(curColour){
    ctx.fillStyle = colours[curColour];
    ctx.fillRect(COLOUR_X, COLOUR_Y, COLOUR_W, COLOUR_H);
});


socket.on('endGame', function(winner){
    socket.disconnect();
    playerlist.innerHTML = '';
    Swal.fire({
      title: 'Game Over!',
      text: `${winner} won the game!`,
      showConfirmButton: true,
      confirmButtonText: 'Play Again', 
    }).then((result) => {
        if (result.isConfirmed){
            joinGame();
        }
    });
});


socket.on('playerDisconnected', function(playerName){
    Swal.fire({
        title: 'Someone left...',
        text: `${playerName} has left the game.`,
        icon: 'error',
        timer: 1000
    })
})


init();