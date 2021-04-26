var app;
var player;
var playerSpeed = 30;
var enemySpeed = 1;
var playerRadius = 35;
var enemyRadius = 30;

var MARKERLIMIT = 5;
var markers = [];
var visibleSplinePoints = [];
var RENDEREDSPLINESTEPS = 30

var enemyexists = false;
var reachedGoal = false;
var gameloopactive = false;
//interpolation vars:
var tau = 1/2;
var arclengthtable = [];
var ARCLENGTHSAMPLESIZE = 1000;

window.onload = function() {
    app = new PIXI.Application({

        width: 1000,
        height: 400,
        backgroundColor: 0xAAAAAA
    });

    document.body.appendChild(app.view);

    app.loader.add("player", "pic/Player1.png");
    app.loader.add("enemy", "pic/enemy.png");
    app.loader.add("background", "pic/Background1.png");
    app.loader.add("title", "pic/Background1.png");
    app.loader.add("start", "pic/Start1.png");
    app.loader.add("startOnClick", "pic/Start2.png");
    app.loader.add("circle", "pic/Circle_new.png")
    app.loader.add("goal", "pic/Goal.png")
    app.loader.onComplete.add(Initialisation);
    app.loader.load();
}

function Initialisation(){
    console.count("finish loading");
    start_title = new PIXI.Sprite(app.loader.resources["title"].texture);

    start_button = createStartButton();
  
    app.stage.addChild(start_title);
    app.stage.addChild(start_button);
    
    document.getElementById('button-play').disabled = true;
    document.getElementById('button-clear').disabled = true;
}

//helperfunction returning a somewhat random result from min to max
function random(min, max)
{
    return Math.random() * (max - min) + min;
}

//Gameloop which is FPS independn you can set the rate at which this is called 
//with app.ticker.speed also we can manually skip gameloop calls aswell for 
//example if some calculation are not done yet or we are waiting for input 
//from the player.
function gameloop(delta){
    if (gameloopactive)
    {        
        player.updatespeed();
        player.move(delta);
    }
    if (enemyexists)
        enemy.move();
}

//loads Player icon on the Scene
function createPlayer(){
    x = random(playerRadius, (app.view.width / 5 - playerRadius));
    y = random(playerRadius, app.view.height - playerRadius);
    player = new Player(x, y, app.loader.resources["player"].texture, false, playerSpeed, playerSpeed);
    app.stage.addChild(player);
}

//loads Player icon on the Scene
function createEnemy(){
    x = random(enemyRadius, app.view.width - enemyRadius);
    y = random(enemyRadius, app.view.height - enemyRadius);
    enemy = new Enemy(x, y, app.loader.resources["enemy"].texture, false, enemySpeed, enemySpeed);
    app.stage.addChild(enemy);
    enemyexists = true;
}

//loads Player icon on the Scene
function createGoal(){
    x = random(app.view.width - (app.view.width / 5 - playerRadius), app.view.width);
    y = random(playerRadius, app.view.height - playerRadius);
    goal = new Goal(x, y, app.loader.resources["goal"].texture, false);
    app.stage.addChild(goal);

}

//sets Marker (ControlPoint) to the Scene 
function setmarker(){
    if (gameloopactive || reachedGoal)
        return;
    if (markers.length >= MARKERLIMIT)
        return;
    x = app.renderer.plugins.interaction.mouse.global.x;
    y = app.renderer.plugins.interaction.mouse.global.y;
    marker = new Marker(x, y, app.loader.resources["circle"].texture);
    app.stage.addChild(marker);
    markers.push(marker);
    document.getElementById('button-play').disabled = false;
    document.getElementById('button-clear').disabled = false;
    addSplinePoints();
}

//add spline points for every curve between control points
function addSplinePoints()
{
    arclengthtable = [];
    for (let i = 0; i <= markers.length; i++)
    {
        //P0
        if (i == 0 || i == 1){
            p0 = [player.start_x, player.start_y];
        } else {
            p0 = [markers[i-2].x, markers[i-2].y];
        }

        //P1
        if (i == 0) {
            p1 = [player.start_x, player.start_y];
        } else {
            p1 = [markers[i-1].x, markers[i-1].y];
        }

        //P2
        if (i == markers.length) {
            p2 = [goal.x, goal.y];
        } else {            
            p2 = [markers[i].x, markers[i].y];
        }

        //P3
        if (i + 1 == markers.length || i == markers.length) {
            p3 = [goal.x, goal.y];
        } else {            
            p3 = [markers[i+1].x, markers[i+1].y];
        }

        addSingleSpline(p0, p1, p2, p3)
    }
    addVisibleSplinePoint(RENDEREDSPLINESTEPS);
}

//add spline points for a curve between 2 control points p1 and p2 
//and helper control points p0 and p3
function addSingleSpline(p0, p1, p2, p3)
{
    for (let i = 1; i < ARCLENGTHSAMPLESIZE; i++)
    {
        t = i / ARCLENGTHSAMPLESIZE;

        x = catmullrom(t, p0[0], p1[0], p2[0], p3[0]);
        y = catmullrom(t, p0[1], p1[1], p2[1], p3[1]);

        addArclengthEntry(x, y);        
    }
}

//calculate value using matrix calculation.
function catmullrom(t, p0, p1, p2, p3)
{
    return tau * (
        (2 * p1) +
        (-p0 + p2) * t + 
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
        (-p0 + 3 *p1 -3 * p2 + p3) * t * t * t 
    );
}

//Add Point to Arclength Table
function addArclengthEntry(x, y)
{
    arclength = 0;
    totalength = 0;
    if (arclengthtable.length != 0)
    {
        prev = arclengthtable[arclengthtable.length - 1];
        dist_x = x - prev.x;
        dist_y = y - prev.y;
        arclength = Math.sqrt(dist_x *dist_x + dist_y *dist_y);
        totalength = prev.totalLengthTillHere;
    }
    entry = new ArclengthtableEntry(x, y, arclength, totalength);
    arclengthtable.push(entry);
}

//Add a spline point 
function addVisibleSplinePoint(sample)
{
    visibleSplinePoints.forEach(c => { app.stage.removeChild(c); });
    visibleSplinePoints = []
    for(let i = 0; i < arclengthtable.length; i += sample)
    {
        let x = arclengthtable[i].x;
        let y = arclengthtable[i].y;

        graphics = new PIXI.Graphics();
        graphics.beginFill(0x45f542);
        graphics.drawCircle(x, y, 3); // drawCircle(x, y, radius)
        graphics.endFill();
        visibleSplinePoints.push(graphics);
        app.stage.addChild(graphics);
    }
}

// returns first value after passing a goallength in the  arclength table
function getPosFromArclengthWithDelta(goal)
{
    for (i = 0; i < arclengthtable.length; i++)
    {
        let e = arclengthtable[i]
        if(e.totalLengthTillHere > goal)
            return e;
    }
    gameloopactive = false;
    reachedGoal = true;
    return arclengthtable[arclengthtable.length-1];
}

//Loads Background texture
function createBackground(resourcename)
{
    bg = new PIXI.Sprite(app.loader.resources[resourcename].texture);
    app.stage.addChild(bg);
}

//Creates the Start Button, including a an listener which starts the game itself.
function createStartButton()
{
    start = app.loader.resources['start'].texture;
    startOnClick = app.loader.resources['startOnClick'].texture;

    let button = new PIXI.Sprite(start);

    button.anchor.set(0.5);
    button.scale.set(0.6);

    button.x = app.renderer.width / 2;
    button.y = app.renderer.height / 2;

    button.interactive = true;
    button.buttonMode = true;

    button.on("pointerover", function() {this.texture = startOnClick;});
    button.on("pointerout", function() {this.texture = start;});
    button.on("click", function() {
        createBackground("background");
        createPlayer();
        //createEnemy();
        createGoal();
        
        addSplinePoints();
        addPlayButtonListener();
        addClearbuttonListener();
       
        app.ticker.add(gameloop);
        app.ticker.speed = 12;
        
    
        app.stage.removeChild(start_title);
        app.stage.removeChild(start_button);
    
        app.renderer.plugins.interaction.on("pointerdown", setmarker);
    });

    return button;
}


// add listener to the Clear Markers button, which clears the markers
function addClearbuttonListener()
{
    document.getElementById('button-clear').addEventListener('click', function() {
        markers.forEach(m => { app.stage.removeChild(m); });        
        markers = [];

        document.getElementById('button-play').disabled = true;
        document.getElementById('button-clear').disabled = true;
        
        addSplinePoints();
    });
}

//add listener to the Play Button, which starts the gameloop
function addPlayButtonListener()
{
    document.getElementById('button-play').addEventListener('click', function() {        
        gameloopactive = true;
        player.setEaseParameters(arclengthtable[arclengthtable.length-1].totalLengthTillHere);

        document.getElementById('button-play').disabled = true;
        document.getElementById('button-clear').disabled = true;
    });
}