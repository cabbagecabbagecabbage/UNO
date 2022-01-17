# UNO
A card game based on the original UNO. 

Created by Amanbir Behniwal and Rayton Chen for the ICS4U FSE using 
-HTML
-CSS
-JavaScript (Node.js)
-Express
-Socket.io
-SWAL2

We do not own the images used in this project.

To visit the github repository, go to https://github.com/ABehniwal/UNO

To play the game, go to https://uno-fse.herokuapp.com/

## Rules
- You need a minimum of 2 players to play and can play with a maximum of 10 players.
- To play a valid card, it must be the same colour or number as the current card on the board. You can also play a wildCard and draw4WildCard whenever you want.
- If you have only 1 card and someone clicks the UNO button before you, two cards from the deck will be drawn for you.
- If you have a playable card, you must play it. Similarly, if you draw a playable card, you must play it.
- Every card that is played by the players is put in the discard pile. Once the deck is empty, the discard pile is shuffled and put into the deck.
- The first player to get rid of all their cards wins.
- If a player leaves and it was their turn, their turn will get skipped and the same current card will be shown to the player who's turn was after the player who left. If it was not the turn of the player who left, then the game will simply continue as is without that player. 
- If there is only 1 player left in a room, that player wins.


## How to play
- The app will prompt you to enter your name/nickname at the start, which will be seen by all other players. The app will retain this name for 24 hours before it asks you to enter it again.
- Once there are at least 2 players in the game, a 10 second timer will start before the game starts. If another player joins within these 10 seconds, the timer will restart.
- You must click on the card you wish to play.
- Click on the backside of the UNO card to draw a card.
- Click the UNO button when you see someone is down to 1 card.
- If you have only 1 card left, try to click the UNO button before anyone else can. If you manage to do this, you will be 'safe' and can't get UNO called on you unless your hand has more than 1 card at any other point in the game.
- Once you click a wild card you must play it. You will have the option to choose any colour you want to change the current colour of the board to. You are also aloud to keep the same colour as is currently on the board.
- If you play the skipTurn card, the next players turn will be skipped.
- If you play the reverseTurn card, the order of the players will be switched and will go in the opposite direction. (It will now be the turn of the player before you rather than the player after you.)
- A player list on the right shows you the player usernames and the arrow indicates who's turn it is and in which direction the game is going. 
- Once a game in a room has started, anyone else who wants to play will be moved to the next available room and will wait until there are at least 2 people in the room.
- There are a maximum of 10 rooms available. If all the rooms are unavailable, you must wait until the game ends in a room before you can play.
