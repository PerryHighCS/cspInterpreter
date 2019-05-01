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
    
        let framenum = 0;
        
        zombie = this;      
        
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