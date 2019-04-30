/* global Promise */

import {RobotWorld} from "./robotWorld.js"
import {Robot} from "./rGraphics.js"

let sprites = null;
let zombie = null;
 
export class Zombie extends Robot {    
    constructor (world, initX, initY, initDir) {
        super(world, initX, initY, initDir);
        
        // Initialize the zombie sprites
        if (sprites === null) {
            sprites = loadSprites();
        }
    
//        // Initialize the zombie's position and direction, with defaults if
//        // necessary
//        let x = initX ? initX : 0;
//        let y = initY ? initY : 0;
//        let dir = initDir ? initDir : 0;
        let framenum = 0;
//        let crashed = false;
//        let self = this;
        
        zombie = this;
        
//        // Add the zombie to the world
//        if (world)
//            world.setPosition(this, x, y);
       
//        /*******************************
//         * Define the zombie commands
//         *******************************/
//        
//        /**
//         * Move the zombie forward
//         * 
//         * @throws {"CRASH!"} if the zombie hits the edge of the world, or an
//         *                    obstacle
//         */
//        this.forward = function () {
//            let nextx = x;
//            let nexty = y;
//            
//            // Determine the next position based on the direction the zombie
//            // is facing
//            switch (dir) {
//            case 0:
//                nextx = x + 1;
//                break;
//            case 1:
//                nexty = y + 1;
//                break;
//            case 2:
//                nextx = x - 1;
//                break;
//            case 3:
//                nexty = y - 1;
//                break;                    
//            }
//            
//            // Make sure the next position is valid
//            if ((nextx < 0 || nextx >= world.getWidth()) ||
//                (nexty < 0 || nexty >= world.getHeight())) {
//                // If it is not, crash the zombie
//                    crashed = true;
//                    world.redraw();
//                    throw "CRASH!";
//            }
//            else {
//                // If it is, move to the new position
//                x = nextx;
//                y = nexty;
//
//                world.setPosition(self, x, y);
//                
//                // If there are other objects there, crash the zombie
//                let objects = world.objectsAt(x, y)
//                        .filter(obj => !(obj.obj.type !== 'GOAL'));
//                
//                if (objects.length > 1) {
//                    crashed = true;
//                    world.redraw();
//                    throw "CRASH!";
//                }
//            }
//            
//            // Update the display
//            world.redraw();
//        };
//
//        /**
//         * Turn the zombie towards its left
//         */
//        this.left = function () {
//            dir = (4 + dir - 1) % 4;
//            world.redraw();
//        };
//
//        /**
//         * Turn the zombie towards its right
//         */
//        this.right = function () {
//            dir = (dir + 1) % 4;
//            world.redraw();
//        };
//
//        /**
//         * Determine if the zombie can move in a given direction: "forward", 
//         * "backward", "left", "right".
//         * 
//         * @param {String} checkDir the direction to look
//         */
//        this.canMove = function (checkDir) {
//            let look = dir;
//            
//            switch (checkDir.toLowerCase()) {
//                case "forward":
//                    break;                    
//                case "backward":
//                    look = (look + 2) % 4;
//                    break;
//                case "left":
//                    look = (4 + look - 1) % 4;
//                    break;
//                case "right":
//                    look = (look + 1) % 4;
//                    break;
//            }
//            
//            // convert the direction to look into an x,y coordinate pair
//            // for the cell to look in
//            let lookx = x;
//            let looky = y;
//            
//            switch (look) {
//            case 0:
//                lookx = x + 1;
//                break;
//            case 1:
//                looky = y + 1;
//                break;
//            case 2:
//                lookx = x - 1;
//                break;
//            case 3:
//                looky = y - 1;
//                break;                    
//            }
//            
//            // If the position is out of bounds
//            if ((lookx < 0 || lookx >= world.getWidth()) ||
//                (looky < 0 || looky >= world.getHeight())) {
//                // The zombie can't move there.
//                return false;
//            }
//            else {
//                // If it is in bounds, the zombie can move there only if it is
//                // vacant.
//                let objects = world.objectsAt(lookx, looky)
//                        .filter(obj => obj.obj.type !== 'GOAL');
//                return objects.length === 0;
//            }
//        };
//        
//        this.onGoal = function() {
//            let objects = world.objectsAt(x, y)
//                       .filter(obj => (obj.obj.type === 'GOAL'));
//                
//            return objects.length > 0; 
//        };
//        
//        /**
//         * Restart the zombie at a given position, facing a given direction
//         * @param {integer} newx
//         * @param {integer} newy
//         * @param {integer} newdir (0-3)
//         */
//        this.reset = function(newx, newy, newdir) {
//            x = newx ? newx : initX;
//            y = newy ? newy : initY;
//            dir = newdir ? newdir : initDir;
//            crashed = false;
//            world.redraw();
//        };        
        
        /**
         * Get the current sprite for this zombie
         * @returns {Image}
         */
        this.getSprite = async function() {
            // If the sprites are not yet loaded, wait for them to load
            if (sprites instanceof Promise) {
                sprites = await sprites;
            }
            
            // Check the zombie's condition
            if (this.crashed) {                
                return sprites[4]; // return the crashed sprite
            }
            else {
                // If the zombie is ok, determine which frame should be current
                framenum = (framenum + 1) % 4;
                
                // return the animated zombie facing in the current direction
                return sprites[this.dir][framenum];
            }
        };
        
//        /**
//         * Get the direction this zombie is facing
//         * @returns {integer} dir 0 = right, 1 = down, 2 = left, 3 = up
//         */
//        this.getDir = function() {
//            return dir;
//        };
    }
    
    /**
     * Get the valid CSP commands for controlling the zombie
     * 
     * @returns {Array}
     */
    static getGraphicsCommands() {
        return [
            ['functions', new Map([
                ['MOVE_FORWARD', ()=>zombie.forward()],
                ['ROTATE_LEFT', ()=>zombie.left()],
                ['ROTATE_RIGHT', ()=>zombie.right()],
                ['CAN_MOVE', (params)=>zombie.canMove(params[0])],
                ['GoalReached', ()=>zombie.onGoal()]
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

async function loadSprites() {
    function spriteNames(prefix, suffix, num) {
        let names = [];
        for (let i = 0; i < num; i++) {
            names.push(prefix + i + suffix );
        }
        return names;
    }

    function load(url) {
        return new Promise((resolve) => {
            let img = new Image();
            img.onload = ()=>resolve(img);
            img.onerror = ()=>resolve(img);
            img.src = url;
        });
    }

    async function loadAll(imgs) {
        let loaders = [];

        imgs.forEach((img)=>loaders.push(load(img)));
        return await Promise.all(loaders);
    }

    let right = loadAll(spriteNames("./images/zombie-right-", ".png", 4));
    let down = loadAll(spriteNames("./images/zombie-down-", ".png", 4));
    let left = loadAll(spriteNames("./images/zombie-left-", ".png", 4));
    let up = loadAll(spriteNames("./images/zombie-up-", ".png", 4));
    let crash = load("./images/zombie-dead.png");
    return Promise.all([right, down, left, up, crash]);
};