
//basic stuff firs
const gameBoard = document.getElementById('gameBoard')
const ctx = gameBoard.getContext('2d');
const scoreText = document.getElementById('scoreText');
const resetBtn = document.getElementById('resetBtn');
const gameWidth = gameBoard.width;
const gameHeight = gameBoard.height;

//colors and sizes
const boardBackground = "white";
const snakeColor = "lightgreen";
const snakeBorder = "darkgreen";
const foodColor = "red";
const unitSize = 25;

//other variables
let running = false;
let xVelocity =unitSize;
let yVelocity = 0;
let food;
let foodX, FoodY;
let score = 0;

//snake

let snake = [
    {x:unitSize * 4, y:0},
    {x:unitSize * 3, y:0},
    {x:unitSize * 2, y:0},
    {x:unitSize, y:0},
    {x:0, y:0}
];

window.addEventListener('keydown', changeDirection);
resetBtn.addEventListener('click', resetGame);

gameStart();

//functions
function gameStart(){
    running = true;
    scoreText.textContent = score;
    createFood();
    drawFood();
    nextTick();
};

function nextTick(){
    if(running){
        setTimeout(()=>{
            clearBoard();
            drawFood();
            moveSnake();
            drawSnake();
            checkGameOver();
            nextTick();
        }, 75);
    }else{
        displayGameOver();
    }
};

function clearBoard(){
    ctx.fillStyle = boardBackground;
    ctx.fillRect(0, 0, gameWidth, gameHeight);
};

function createFood(){
    function randomFood(min, max){
       const randNum = Math.round((Math.random() * (max - min) + min)/unitSize) * unitSize;
       return randNum;
    }
    foodX = randomFood(0, gameWidth - unitSize);
    foodY = randomFood(0, gameWidth - unitSize);
};

function drawFood(){
    ctx.fillStyle = foodColor;
    ctx.fillRect(foodX, foodY, unitSize, unitSize);
};

function moveSnake(){
    const head = {x: snake[0].x + xVelocity, y: snake[0].y + yVelocity};
    snake.unshift(head);
    //if food is eaten
    if(snake[0].x === foodX && snake[0].y === foodY){
        score += 10;
        scoreText.textContent = score;
        createFood();
        drawFood();
    }else{
        snake.pop();
    }
};

function drawSnake(){
    ctx.fillStyle = snakeColor;
    ctx.strokeStyle = snakeBorder;
    snake.forEach((snakePart)=>{
        ctx.fillRect(snakePart.x, snakePart.y, unitSize, unitSize);
        ctx.strokeRect(snakePart.x, snakePart.y, unitSize, unitSize);
    });
};

function changeDirection(event){
    const keyPressed = event.keyCode;
    const LEFT = 65;
    const UP = 87;
    const RIGHT = 68;
    const DOWN = 83;

    const goingUP = (yVelocity == -unitSize);
    const goingDOWN = (yVelocity == unitSize);
    const goingLEFT = (xVelocity == -unitSize);
    const goingRIGHT= (xVelocity == unitSize);

    switch(true){
        case keyPressed === LEFT && !goingRIGHT:
            xVelocity = -unitSize;
            yVelocity = 0;
            break;
        case keyPressed === UP && !goingDOWN:
            xVelocity = 0;
            yVelocity = -unitSize;
            break;
        case keyPressed === RIGHT && !goingLEFT:
            xVelocity = unitSize;
            yVelocity = 0;
            break;
        case keyPressed === DOWN && !goingUP:
            xVelocity = 0;
            yVelocity = unitSize;
            break;
    }
};

function checkGameOver(){
    const hitLeftWall = snake[0].x < 0;
    const hitRightWall = snake[0].x >= gameWidth;
    const hitTopWall = snake[0].y < 0;
    const hitBottomWall = snake[0].y >= gameHeight;

    let gameOver = hitLeftWall || hitRightWall || hitTopWall || hitBottomWall;

    for(let i = 4; i < snake.length; i++){
        if(snake[i].x == snake[0].x && snake[i].y == snake[0].y){
            running = false;
            break;
        }
    }

    if(gameOver){
        running = false;
    }
};

function displayGameOver(){
    ctx.font = "50px Arial";
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.fillText("Game Over!", gameWidth/2, gameHeight/2);
    running = false;
};

function resetGame(){
    score = 0;
    xVelocity = unitSize;
    yVelocity = 0;
    snake = [
        {x:unitSize * 4, y:0},
        {x:unitSize * 3, y:0},
        {x:unitSize * 2, y:0},
        {x:unitSize, y:0},
        {x:0, y:0}
    ];
    gameStart();
}