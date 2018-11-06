import {RobotWorld} from "./robotWorld.js"

let sprites = null;

export function initZombie(rw, x, y, dir) {
    
    if (sprites === null) {
        sprites = loadSprites();
    }
    
    let zombie = new Zombie(rw, x, y, dir);
    
    return zombie;
}
 
class Zombie {
    constructor (world, initX, initY, initDir) {
        let x = initX ? initX : 0;
        let y = initY ? initY : 0;
        let dir = initDir ? initDir : 0;
        let framenum = 0;
        let crashed = false;
        let self = this;
        
        world.setPosition(this, x, y);
        
        this.forward = function () {
            let nextx = x;
            let nexty = y;
            
            switch (dir) {
            case 0:
                nextx = x + 1;
                break;
            case 1:
                nexty = y + 1;
                break;
            case 2:
                nextx = x - 1;
                break;
            case 3:
                nexty = y - 1;
                break;                    
            }
            
            if ((nextx < 0 || nextx >= world.getWidth()) ||
                (nexty < 0 || nexty >= world.getHeight())) {
                    crashed = true;
                    world.redraw();
                    throw "CRASH!";
            }
            else {
                x = nextx;
                y = nexty;

                world.setPosition(self, x, y);
            }
            
            world.redraw();
        };

        this.left = function () {
            dir = (4 + dir - 1) % 4;
            world.redraw();
        };

        this.right = function () {
            dir = (dir + 1) % 4;
            world.redraw();
        };

        this.canMove = function (checkDir) {
            let look = dir;
            
            switch (checkDir) {
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
            
            
            
            let lookx = x;
            let looky = y;
            
            switch (look) {
            case 0:
                lookx = x + 1;
                break;
            case 1:
                looky = y + 1;
                break;
            case 2:
                lookx = x - 1;
                break;
            case 3:
                looky = y - 1;
                break;                    
            }
            
            if ((lookx < 0 || lookx >= world.getWidth()) ||
                (looky < 0 || looky >= world.getHeight())) {
                return false;
            }
            else {
                return true;
            }
        };
        
        this.reset = function(newx, newy, newdir) {
            x = newx ? newx : initX;
            y = newy ? newy : initY;
            dir = newdir ? newdir : initDir;
            crashed = false;
            world.redraw();
        };
        
        this.getSprite = async function() {
            if (sprites instanceof Promise) {
                sprites = await sprites;
            }
            
            if (crashed) {
                return sprites[4];
            }
            else {
                framenum = (framenum + 1) % 4;
                return sprites[dir][framenum];
            }
        };
    }
    
    getGraphicsCommands() {
        return [
            ['functions', new Map([
                ['MOVE_FORWARD', this.forward],
                ['ROTATE_LEFT', this.left],
                ['ROTATE_RIGHT', this.right],
                ['CAN_MOVE', this.canMove]
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
            img.onload = resolve(img);
            img.onerror = resolve(img);
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