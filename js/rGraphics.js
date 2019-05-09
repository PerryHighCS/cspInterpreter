/* global Promise, tileSize */

import {RobotWorld} from "./robotWorld.js"

let robotSprite = null;
let sprites = null;
let robot = null;
 
export class Robot {    
    constructor (world, initX, initY, initDir) {
        
        // Initialize the robot sprites
        if (sprites === null) {
            sprites = loadSprites(world.getTileSize());
        }
    
        // Initialize the robot's position and direction, with defaults if
        // necessary
        this.x = initX ? initX : 0;
        this.y = initY ? initY : 0;
        this.dir = initDir ? initDir : 0;
        this.crashed = false;
        
        let framenum = 0;
        let self = this;
        
        robot = this;
        
        // Add the robot to the world
        if (world)
            world.setPosition(this, this.x, this.y);
        
        /*******************************
         * Define the robot commands
         *******************************/
        
        /**
         * Move the robot forward
         * 
         * @throws {"CRASH!"} if the robot hits the edge of the world, or an
         *                    obstacle
         */
        this.forward = function () {
            let nextx = this.x;
            let nexty = this.y;
            
            // Determine the next position based on the direction the robot
            // is facing
            switch (this.dir) {
            case 0:
                nextx = this.x + 1;
                break;
            case 1:
                nexty = this.y + 1;
                break;
            case 2:
                nextx = this.x - 1;
                break;
            case 3:
                nexty = this.y - 1;
                break;                    
            }
            
            // Make sure the next position is valid
            if ((nextx < 0 || nextx >= world.getWidth()) ||
                (nexty < 0 || nexty >= world.getHeight())) {
                // If it is not, crash the robot
                    this.crashed = true;
                    world.redraw();
                    throw "CRASH!";
            }
            else {
                // If it is, move to the new position
                this.x = nextx;
                this.y = nexty;

                world.setPosition(self, this.x, this.y);
                
                // If there are other objects there, crash the robot
                let objects = world.objectsAt(this.x, this.y)
                        .filter(obj => !(obj.obj.type === 'GOAL'));
                
                if (objects.length > 1) {
                    this.crashed = true;
                    world.redraw();
                    throw "CRASH!";
                }
            }
            
            // Update the display
            world.redraw();
        };

        /**
         * Turn the robot towards its left
         */
        this.left = function () {
            this.dir = (4 + this.dir - 1) % 4;
            world.redraw();
        };

        /**
         * Turn the robot towards its right
         */
        this.right = function () {
            this.dir = (this.dir + 1) % 4;
            world.redraw();
        };

        /**
         * Determine if the robot can move in a given direction: "forward", 
         * "backward", "left", "right".
         * 
         * @param {String} checkDir the direction to look
         */
        this.canMove = function (checkDir) {
            let look = this.dir;
            
            switch (checkDir.toLowerCase()) {
                case "forward":
                    break;                    
                case "backward":
                    look = (look + 2) % 4;
                    break;
                case "left":
                    look = (4 + look - 1) % 4;
                    break;
                case "right":
                    look = (look + 1) % 4;
                    break;
            }
            
            // convert the direction to look into an x,y coordinate pair
            // for the cell to look in
            let lookx = this.x;
            let looky = this.y;
            
            switch (look) {
            case 0:
                lookx = this.x + 1;
                break;
            case 1:
                looky = this.y + 1;
                break;
            case 2:
                lookx = this.x - 1;
                break;
            case 3:
                looky = this.y - 1;
                break;                    
            }
            
            // If the position is out of bounds
            if ((lookx < 0 || lookx >= world.getWidth()) ||
                (looky < 0 || looky >= world.getHeight())) {
                // The robot can't move there.
                return false;
            }
            else {
                // If it is in bounds, the robot can move there only if it is
                // vacant.
                let objects = world.objectsAt(lookx, looky)
                        .filter(obj => obj.obj.type !== 'GOAL');
                return objects.length === 0;
            }
        };
        
        this.onGoal = function() {
            let objects = world.objectsAt(this.x, this.y)
                       .filter(obj => (obj.obj.type === 'GOAL'));
                
            return objects.length > 0; 
        };
        
        /**
         * Restart the robot at a given position, facing a given direction
         * @param {integer} newx
         * @param {integer} newy
         * @param {integer} newdir (0-3)
         */
        this.reset = function(newx, newy, newdir) {
            this.x = newx ? newx : initX;
            this.y = newy ? newy : initY;
            this.dir = newdir ? newdir : initDir;
            this.crashed = false;
            world.redraw();
        };
        
        /**
         * Get the current sprite for this robot
         * @returns {Image}
         */
        this.getSprite = async function() {
            // If the sprites are not yet loaded, wait for them to load
            if (sprites instanceof Promise) {
                sprites = await sprites;
            }
            
            // Check the robot's condition
            if (this.crashed) {                
                return sprites[4]; // return the crashed sprite
            }
            else {                
                // return the robot facing in the current direction
                return sprites[this.dir];
            }
        };
        
        /**
         * Get the direction this robot is facing
         * @returns {integer} dir 0 = right, 1 = down, 2 = left, 3 = up
         */
        this.getDir = function() {
            return this.dir;
        };
    }
    
    /**
     * Get the valid CSP commands for controlling the robot
     * 
     * @returns {Array}
     */
    static getGraphicsCommands() {
        return [
            ['functions', new Map([
                ['MOVE_FORWARD', ()=>robot.forward()],
                ['ROTATE_LEFT', ()=>robot.left()],
                ['ROTATE_RIGHT', ()=>robot.right()],
                ['CAN_MOVE', (params)=>robot.canMove(params[0])],
                ['GoalReached', ()=>robot.onGoal()]
                ])],
            ['vars', new Map([
                ['right', "right"],
                ['left', "left"],
                ['forward', "forward"],
                ['backward', "backward"]
                ])]
        ];
    }
}

async function loadSprites(tileSize) {
    let canvas = document.createElement("canvas");
    canvas.width = canvas.height = tileSize;
    
    let ctx = canvas.getContext("2d");
        
    if (robotSprite === null) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "black";
        
        let halfTile = tileSize / 2;
        let quarterTile = tileSize / 4;
        let eighthTile = tileSize / 8;

        ctx.beginPath();
        ctx.moveTo(eighthTile, quarterTile);
        ctx.lineTo(eighthTile, tileSize - quarterTile);
        ctx.lineTo(tileSize - eighthTile, halfTile);
        ctx.closePath();

        ctx.fill();

        robotSprite = [new Image()];
        robotSprite[0].src = canvas.toDataURL("image/png");
        
        for (let i = 0; i < 3; i++) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            ctx.save();
            
            ctx.translate(halfTile, halfTile);
            ctx.rotate((Math.PI / 2) * (i + 1));
            ctx.drawImage(robotSprite[0], -halfTile, -halfTile);
            
            let spr = new Image();
            spr.src = canvas.toDataURL("image/png");
            
            ctx.restore();
            
            robotSprite.push(spr);
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.beginPath();
        ctx.moveTo(eighthTile, quarterTile);
        ctx.lineTo(eighthTile, tileSize - quarterTile);
        ctx.lineTo(tileSize - eighthTile, halfTile);
        ctx.closePath();
        ctx.fillStyle = "#FF0000";
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(4, 4);
        ctx.lineTo(tileSize - 4, tileSize - 4);
        ctx.moveTo(tileSize - 4, 4);
        ctx.lineTo(4, tileSize - 4);
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#7F0000';
        ctx.stroke();
        
        let robotCrashed = new Image();
        robotCrashed.src = canvas.toDataURL("image/png");        
        robotSprite.push(robotCrashed);
    }
    
    return robotSprite;
};