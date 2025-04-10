//board

let board;
let boardwidth = 360;
let boardheight = 640;
let context;


//bird
let birdWidth = 34;
let birdHeight = 24;
let birdX = boardwidth/8;
let birdY = boardheight/2;
let birdImage;

let bird = {
    x: birdX,
    y: birdY,
    width: birdWidth,
    height: birdHeight
}

//pipes
let pipeArray= [];
let pipeWidth = 64;
let pipeHeight = 512;
let pipeX = boardwidth;
let pipeY = 0;
let topPipeImage;
let bottomPipeImage;

//physics
let velocityX = -2; //go left
let velocityY = 0; //no jumping bird
let gravity = 0.1; //gravity

//game over
let gameOver = false;
let score = 0;

window.onload = function(){
    board = document.getElementById("board");
    board.width = boardwidth;
    board.height = boardheight;
    context = board.getContext("2d"); //used for drawing on the board.

    //draw bird
    birdImage = new Image();
    birdImage.src = "assets/flappybird.png";
    birdImage.onload = function(){
        context.drawImage(birdImage, bird.x, bird.y, bird.width, bird.height);
    }

    //draw pipes
    topPipeImage = new Image();
    topPipeImage.src = "assets/toppipe.png";

    bottomPipeImage = new Image();
    bottomPipeImage.src = "assets/bottompipe.png";


    requestAnimationFrame(update);
    setInterval(placePipes, 1500); //1.5 sec
    document.addEventListener("keydown", moveBird);
}

//update
function update(){
    requestAnimationFrame(update);
    if(gameOver){
        return;
    }
    context.clearRect(0, 0, boardwidth, boardheight);
    //bird
    velocityY += gravity;
    bird.y = Math.max(bird.y + velocityY, 0); // apply gravity
    context.drawImage(birdImage, bird.x, bird.y, bird.width, bird.height);
    //gameover check
    if(bird.y >= boardheight){
        gameOver = true;
    }
    //pipes
    for(let i = 0; i < pipeArray.length; i++){
        let pipe = pipeArray[i];
        pipe.x += velocityX;
        context.drawImage(pipe.img, pipe.x, pipe.y, pipe.width, pipe.height);
        if(!pipe.passed && bird.x > pipe.x + pipe.width){
            score += 0.5; //bcz bird passes 2 pipes at the same timeee
            pipe.passed = true;
        }
        //collision detection
        if(collisionDetection(bird, pipe)){
            gameOver = true;
        }
    }
    //clear pipes
    while(pipeArray.length > 0 && pipeArray[0].x < -pipeWidth){
        pipeArray.shift();
    }

    //score
    context.fillStyle = "white";
    context.font = "45px sans-serif";
    context.fillText(score, boardwidth/2-10, 50);
    if(gameOver){
        context.fillText("Game Over", boardwidth/2-100, boardheight/2);
    }
}

//place pipes
function placePipes(){
    if(gameOver){
        return;
    }
    let randomPipeY = pipeY - pipeHeight / 4 - Math.random() * pipeHeight / 2;
    openingSpace = board.height / 4;
    let topPipe = {
        img : topPipeImage,
        x : pipeX,
        y : randomPipeY,
        width : pipeWidth,
        height : pipeHeight,
        passed : false
    }
    pipeArray.push(topPipe);

    let bottomPipe = {
        img : bottomPipeImage,
        x : pipeX,
        y : randomPipeY + pipeHeight + openingSpace,
        width : pipeWidth,
        height : pipeHeight,
        passed : false
    }
    pipeArray.push(bottomPipe);

}

//move bird

function moveBird(e){
    if( e.code == "Space" || e.code == "KeyW"){
        //jump
        velocityY = -3;
        if(gameOver){
            bird.y = birdY;
            score = 0;
            pipeArray = [];
            gameOver = false;
        }
    }
}

//collision detection
function collisionDetection(a, b){
    return a.x < b.x + b.width &&
     a.x + a.width > b.x && 
     a.y < b.y + b.height && 
     a.y + a.height > b.y;
}