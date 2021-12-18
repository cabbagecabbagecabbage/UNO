const socket = io({autoConnect: false});

const canvas = document.getElementById('canvas'); //canvas of html page
const ctx = canvas.getContext('2d'); //drawing context


//cards
const cardWidth = 240, cardHeight = 360; //must be in the ratio 2/3 to look not weird
const cardBackSide = new Image(); //image of the backside of an uno card
const deck = [];

let room;
let hand = [];
let turn;
let playerName;


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

	// //get the player's name, and store it in a cookie
	// playerName = getCookie('playerName');
	// if (playerName == null){
	// 	//player's cookie expired; ask for name
	// 	playerName = prompt("Enter your nickname: ", "Anonymous Player");
	// 	if (playerName == null || playerName === ""){
	// 		playerName = "Anonymous Player";
	// 	}
	// 	else {
	// 		setCookie('playerName', playerName, 600);
	// 	}
	// }

	//connect to server
	socket.connect();
}

function onMouseClick() {

}


init();