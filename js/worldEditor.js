import {RobotWorld} from "./robotWorld.js"

export class WorldEditor {
    constructor (editorModal, world, RobotClass, save) {        
        editorModal.modal({backdrop: 'static'});

        let canvas = editorModal.find('#editorCanvas');
        let heightBox = editorModal.find('#worldHeight');
        let widthBox = editorModal.find('#worldWidth');
        let saveButton = editorModal.find('#saveWorldButton');
        
        let height = world.getHeight();
        let width = world.getWidth();
        
        let draggingRobot = false;
        let dontClick = false;
        let dragStartPos = null;
        
        heightBox.val(height);        
        widthBox.val(width);
                
        let w = new RobotWorld(canvas[0], world.currentSpec(), RobotClass); // Display the current world        
        w.initObjects();
        w.redraw();                                       // Draw the world
        
        this.resize = function() {
            width = Math.max(1, widthBox.val());
            height = Math.max(1, heightBox.val());
            
            let spec = w.currentSpec();
            
            spec.height = height;
            spec.width = width;
            
            w = new RobotWorld(canvas[0], spec, RobotClass);
            w.initObjects();
            w.redraw();
            
            spec = w.currentSpec();
        };
        
        let clicked = function(e) {            
            let pos = w.pixelToTilePos(e.offsetX, e.offsetY);
            
            if (pos === null) {
                return;
            }
            
            // Get all objects at the clicked position
            let objects = w.objectsAt(pos.x, pos.y);
            
            let make = null;
            
            
            if (dontClick) {        // If a previous event requested click suppression
                dontClick = false;  // ignore the click and clear the flag
            }
            else if (objects.length === 0) { // If nothing was present, make an obstacle
                make = 'OBSTACLE';
            }
            else if (objects[0].obj && objects[0].obj.type) {
                // if an obstacle was present, turn it into a goal
                let type = objects[0].obj.type.toLowerCase();                
                if (type === 'obstacle') {
                    make = 'GOAL';
                }
                
                // delete all objects at the location
                // if a goal is present, it will become an empty space
                for (let i = 0; i < objects.length; i++) {
                    w.removeObject(objects[i].obj);
                }
            }
            
            if (make !== null) {
                w.makeObject(new RobotWorld.Object(make, pos.x, pos.y));
            }
            
            w.redraw();            
            e.preventDefault();
        };
        
        let mouseDown = function(e) {
            let pos = w.pixelToTilePos(e.offsetX, e.offsetY);
            let bot = w.robot;
                        
            if ((e.which === 1) && (pos.x === bot.x && pos.y === bot.y)) {
                draggingRobot = bot;
                dragStartPos = pos;
            }
            return false;
        };
        
        let mouseMove = function(e) { 
            if (draggingRobot) {   
                let pos = w.pixelToTilePos(e.offsetX, e.offsetY);
                
                if (pos && w.objectsAt(pos.x, pos.y).length === 0) {
                    w.setPosition(draggingRobot, pos.x, pos.y);
                    draggingRobot.x = pos.x;
                    draggingRobot.y = pos.y;
                }
                
                w.redraw();
            }
            
            return false;
        };
        
        let mouseUp = function(e) {
            if (draggingRobot) {              
                let pos = w.pixelToTilePos(e.offsetX, e.offsetY);
                
                if (pos && w.objectsAt(pos.x, pos.y).length === 0) {
                    w.setPosition(draggingRobot, pos.x, pos.y);
                    draggingRobot.x = pos.x;
                    draggingRobot.y = pos.y;
                }
                draggingRobot = false;
                
                if (dragStartPos.x !== pos.x && dragStartPos.y !== pos.y) {
                    dontClick = true;
                }
                
                w.redraw();
            }     
            return false;       
        };
        
        let doubleClick = function(e) {
            let pos = w.pixelToTilePos(e.offsetX, e.offsetY);
            let bot = w.robot;
            
            if (pos.x === bot.x && pos.y === bot.y) { // If the robot was clicked on
                w.robot.right(); // rotate it                 
            }
            e.preventDefault();
            return false;
        };
        
        heightBox.on('input', this.resize);
        widthBox.on('input', this.resize);
        canvas.on('click', clicked);
        canvas.on('mousedown', mouseDown);
        canvas.on('mouseup', mouseUp);
        canvas.on('mousemove', mouseMove);
        canvas.on('dblclick', doubleClick);
        saveButton.click(() => {
            save(w.currentSpec());
            editorModal.modal('hide');
        });
    }
}