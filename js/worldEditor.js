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
            
            // If nothing was present, make an obstacle
            if (objects.length === 0) {
                make = 'OBSTACLE';
            }
            else if (objects[0].obj.constructor.name === 'Robot') { // If the robot was clicked on
                w.robot.right(); // rotate it
            }
            else {
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
        
        heightBox.on('input', this.resize);
        widthBox.on('input', this.resize);
        canvas.click(clicked);
        saveButton.click(() => {
            save(w.currentSpec());
            editorModal.modal('hide');
        });
    }
}