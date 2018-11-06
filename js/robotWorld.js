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
        
        this.redraw = function(){
            let ctx = canvas.getContext("2d");
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
            
        };
        
        
        setInterval(this.redraw, 300);
    }
    
    
}