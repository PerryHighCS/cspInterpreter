let obstacleSprite = null;
let goalSprite = null;

export class RobotWorld {
    /**
     * Create a world for the zombie to exist in
     * 
     * @param {Canvas} canvas the canvas to use for displaying the world
     * @param {Map} spec the definition of the world
     * @param {class} robotType a class defining the Robot to use in the world
     */
    constructor(canvas, spec, robotType) {
        const tileSize = 64;
        
        // If the width/height haven't been set, calculate the maximum unscaled
        // tiles that can fit on the canvas
        let cWidth = canvas.width;
        let cHeight = canvas.height;
        
        let tilesW, tilesH;
        
        if (spec.width === undefined) {
            tilesW = Math.floor(cWidth / tileSize);
        }
        else {
            tilesW = spec.width;
        }
        
        if (spec.height === undefined) {
            tilesH = Math.floor(cHeight / tileSize);
        }
        else {
            tilesH = spec.height;
        }        
        
        // Calculate the logical pixel size of the world
        let worldHeight = tilesH * tileSize;
        let worldWidth = tilesW * tileSize;
        
        canvas.width = Math.max(worldWidth, worldHeight);
        canvas.height = Math.max(worldWidth, worldHeight);
        
        // Determine the offset to center the world on the canvas
        let offsetX = (canvas.width - worldWidth) / 2;
        let offsetY = (canvas.height - worldHeight) / 2;
        
        // Create a map to store all of the objects in the world
        let objects = new Map();
                
        // Create a list to hold all the world's sprites
        let sprites = [];
                        
        /**
         * Update the display of the world
         */
        this.redraw = function(){
            let ctx = canvas.getContext("2d");
            
            // Clear the canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 1;
            
            // Draw the tile borders
            for (let i = 0; i <= tilesW; i ++) {
                ctx.moveTo(i * tileSize + offsetX, offsetY);
                ctx.lineTo(i * tileSize + offsetX, offsetY + worldHeight);
                ctx.stroke();
            }
            for (let j = 0; j <= tilesH; j ++) {
                ctx.moveTo(offsetX, j * tileSize + offsetY);
                ctx.lineTo(offsetX + worldWidth, j * tileSize + offsetY);
                ctx.stroke();
            }
            
            let draw = function(obj) {
                // Determine it's pixel position
                let x = obj.x * tileSize + offsetX;
                let y = obj.y * tileSize + offsetY;
                
                // Display the object's sprite
                obj.obj.getSprite().then((sprite) => {
                    ctx.drawImage(sprite, x, y);
                });
            };
            
            // Draw every object in the world except the robot
            objects.forEach((obj) => {
                if (obj.obj !== this.robot) {
                    draw(obj);
                }
            });
            
            // Draw the robot
            draw({obj: this.robot, x: this.robot.x, y: this.robot.y});
        };
        
        /**
         * Determine the width of the world (in tiles)
         * @returns {integer}
         */
        this.getWidth = function() {
            return tilesW;
        };
        
        /**
         * Determine the height of the world (in tiles)
         * @returns {integer}
         */
        this.getHeight = function() {
            return tilesH;
        };
        
        this.getTileSize = function() {
            return tileSize;
        };
        
        /**
         * Remove an object from the world
         * @param {Object} obj
         */
        this.removeObject = function(obj) {
            objects.delete(obj);
        };
        
        /**
         * Set the position of an object in the world
         * @param {Object} obj the object to move
         * @param {integer} x
         * @param {integer} y
         */
        this.setPosition = function(obj, x, y) {
            objects.set(obj, {obj: obj, x: x, y: y});
        };
        
        /**
         * Stop running the world
         */
        this.end = function() {
            
        };
        
        /**
         * Start running the world
         */
        this.start = function() {
            
        };
        
        /**
         * Get a list of all objects in a location
         * 
         * @param {integer} x
         * @param {integer} y
         * @returns {Array[Objects]}
         */        
        this.objectsAt = function(x, y) {
            let objs = [];
            
            objects.forEach((obj)=>{
                if (obj.x === x && obj.y === y) {
                    objs.push(obj);
                }
            });
            
            return objs;
        };
        
        this.pixelToTilePos = function(x, y) {            
            x = x * (Math.max(worldWidth, worldHeight) / canvas.clientWidth);
            y = y * (Math.max(worldWidth, worldHeight) / canvas.clientHeight);
                        
            x = x - offsetX;
            y = y - offsetY;
            
            x = Math.floor(x / tileSize);
            y = Math.floor(y / tileSize);
            
            
            if (x >= 0 && y >= 0 && x < tilesW && y < tilesH) {
                return {x: x, y: y};            
            }
            else {
                return null;
            }
        };
        
        /**
         * Empty out the world and initialize all spec'ed objects
         */
        this.initObjects = function() {
            this.robot = null;
            
            objects = new Map();
            
            if (spec.robot !== undefined) {
                let x = spec.robot.x ? spec.robot.x : 0;
                let y = spec.robot.y ? spec.robot.y : 0;
                let dir = spec.robot.dir ? spec.robot.dir : 0;
                
                x = Math.min(x, spec.width - 1);
                y = Math.min(y, spec.height - 1);
                
                this.robot = new robotType(this, x, y, dir);
            }
            
            if (spec.objects !== undefined) {
                spec.objects.forEach((obj) => buildSpecObject(obj, this));
            }            
        };
        
        this.getObjects = function() {
            let objSpec = [];
            
            objects.forEach((obj) => {
                if (obj.obj !== this.robot) {
                    let o = {};

                    o.type = obj.obj.constructor.name;
                    o.x = obj.x;
                    o.y = obj.y;
                    o.dir = obj.dir;

                    objSpec.push(o);
                }
            }, this);
            
            return objSpec;
        };
        
        this.getRobot = function() {
            if (this.robot === undefined) {
                return undefined;
            }
            
            let robotSpec = {};
            
            let robot = objects.get(this.robot);
            
            robotSpec.x = robot.x;
            robotSpec.y = robot.y;
            robotSpec.dir = robot.obj.getDir();
            
            return robotSpec;
        };
        
        this.currentSpec = function() {
            let newSpec = {};
            
            newSpec.width = this.getWidth();
            newSpec.height = this.getHeight();
            
            let robot = objects.get(this.robot);
            newSpec.robot = {x: robot.x, y: robot.y, dir: robot.obj.getDir()};
            
            newSpec.objects = this.getObjects();
            
            return newSpec;
        };
        
        this.getSpec = function() {
            return spec;
        };
                
        let buildSpecObject = function(objSpec, world) {
            let object = null;
            
            let x = Math.min(objSpec.x, world.getWidth() - 1);
            let y = Math.min(objSpec.y, world.getHeight() - 1);
            
            if (world.objectsAt(x,y).length === 0) {
                switch (objSpec.type.toLowerCase()) {
                case 'obstacle':
                    object = new Obstacle();
                    world.setPosition(object, x, y);                
                    break;

                case 'goal':
                    object = new Goal();
                    world.setPosition(object, x, y);
                    break;
                }
            }
        };
        
        this.makeObject = function(objectSpec) {
            buildSpecObject(objectSpec, this);
        };
        
        let Obstacle = class {
            type = 'OBSTACLE';
            
            async getSprite() {
                if (obstacleSprite === null) {
                    let canvas = document.createElement("canvas");
                    canvas.width = canvas.height = tileSize;

                    let ctx = canvas.getContext("2d");

                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    ctx.fillStyle = "black";
                    ctx.fillRect(2, 2, canvas.width - 4, canvas.height - 4);

                    obstacleSprite = new Image();
                    obstacleSprite.src = canvas.toDataURL("image/png");
                }

                return obstacleSprite;
            }
        };
        
        let Goal = class {
            type = 'GOAL';
            
            async getSprite() {
                if (goalSprite === null) {
                    let canvas = document.createElement("canvas");
                    canvas.width = canvas.height = tileSize;

                    let ctx = canvas.getContext("2d");

                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    ctx.fillStyle = "#7F7F7F";
                    ctx.fillRect(2, 2, canvas.width - 4, canvas.height - 4);

                    goalSprite = new Image();
                    goalSprite.src = canvas.toDataURL("image/png");
                }

                return goalSprite;
            }
        };
    }      
}

RobotWorld.Object = class {    
    constructor(type, xpos, ypos) {
        this.type = type;
        this.x = xpos;
        this.y = ypos;
    }
};

RobotWorld.Spec = class {
    constructor(width, height, objects, robotx, roboty, robotdir) {
        this.width = width;
        this.height = height;
        this.objects = objects;
        this.robot = {
            x: robotx,
            y: roboty,
            dir: robotdir
        };
    }
};