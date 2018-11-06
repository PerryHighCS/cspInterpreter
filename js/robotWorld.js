export class RobotWorld {
    constructor(canvas) {
        const tileSize = 64;
        
        let cWidth = canvas.width;
        let cHeight = canvas.height;
                
        let tilesW = Math.floor(cWidth / tileSize);
        let tilesH = Math.floor(cHeight / tileSize);
        
        let worldHeight = tilesH * tileSize;
        let worldWidth = tilesW * tileSize;
        
        let offsetX = (cWidth - worldWidth) / 2;
        let offsetY = (cHeight - worldHeight) / 2;
        
        let objects = new Map();
        
        let sprites = [];
                
        this.redraw = function(){
            let ctx = canvas.getContext("2d");
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 1;
            
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
            
            objects.forEach((obj)=>{
                let x = obj.x * tileSize + offsetX;
                let y = obj.y * tileSize + offsetY;
                
                obj.obj.getSprite().then((sprite) => {
                    ctx.drawImage(sprite, x, y);
                });
            });
        };
        
        this.getWidth = function() {
            return tilesW;
        };
        
        this.getHeight = function() {
            return tilesH;
        };
                
        this.removeObject = function(obj) {
            objects.delete(obj);
        };
        
        this.setPosition = function(obj, x, y) {
            objects.set(obj, {obj: obj, x: x, y: y});
        };
        
        this.end = function() {
            clearInterval(timer);
        };
        
        let timer = setInterval(this.redraw, 200);
    }
}