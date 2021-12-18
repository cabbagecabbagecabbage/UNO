const socket = io({autoConnect: false});

const canvas = document.getElementById('canvas'); //canvas of html page
const ctx = canvas.getContext('2d'); //drawing context


//cards
const cardWidth = 240, cardHeight = 360; //must be in the ratio 2/3 to avoid distortion
const cardBackSide = new Image(); //image of the backside of an uno card
const deck = []; //array of images of the cards in the deck

let room;
let hand = [];
let turn;
let username;


function init() {
	//initializing the client side

	//background, font, loading images
	canvas.style.backgroundColor = "#03fce8";
	ctx.font = "12px : Arial";
	cardBackSide.src = "images/uno.png";
	for (let i = 0; i <= 13; ++i){
		for (let j = 0; j <= 7; ++j){
			deck[i*10+j] = new Image();
			deck[i*10+j].src = `images/deck/deck${i*10+j}.png`;
		}
	}

	//add listeners for mouse-click events (refer to https://www.w3schools.com/jsref/dom_obj_event.asp)
	document.addEventListener('click', onMouseClick);

	checkCookie()

	//connect to server
	socket.connect();
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

// taking the cookie's name as the parameter

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

function checkCookie() {
    username = getCookie("username");

    // If the username isn't empty, we welcome the user again by using an alert box
    if (username != "") {
        alert("Welcome again " + username);
    }

    // Otherwise we request the username
    else {
        username = prompt("Please enter your name:", "");
        // If the username entered isn't an empty string or null 
        // we set the cookie with the username entered
        if (username != "" && username != null) {
            setCookie("username", username, 1);
        }
    }
}

function onMouseClick() {

}


init();