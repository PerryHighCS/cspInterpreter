/* global CodeMirror, URL */

let doZombie = false;

import {CspInterpreter} from "./cspInterpreter.js"
import {Zombie} from "./zGraphics.js"   // Use zombie graphics for robot programming
import {Robot} from "./rGraphics.js"    // Use cspRobot graphics for robot programming
import {RobotWorld} from "./robotWorld.js" 

let plugins = [];
let RobotClass = Robot;

if (doZombie) {
    plugins.push(Zombie.getGraphicsCommands());
    RobotClass = Zombie;
}
else {
    plugins.push(Robot.getGraphicsCommands());
}

let source = document.getElementById("code");
let canvas = document.getElementById("worldDisplay");
let runbutton = document.getElementById("runButton");
let stopbutton = document.getElementById("stopButton");
let stepbutton = document.getElementById("stepButton");
let consoledisp = document.getElementById("consoleDisplay");
let stackdisp = document.getElementById("stackDisplay");
let runspeed = document.getElementById("runSpeed");

// Convert the code display to a CodeMirror editor
let height = $(source).height();
let editor = CodeMirror.fromTextArea(source, {
  lineNumbers: true,
  matchBrackets: true
});
editor.setSize(null,height);

keywordButtons(...plugins);

canvas.addEventListener('click', reinit);

let interp = null;
let zombie = null;

let spec = {
    width: 6,
    height: 6,
    objects: [{type: "Obstacle", x: 2, y: 5},
              {type: "Obstacle", x: 1, y: 1},
              {type: "Goal", x:5, y: 0}],
    robot: {x: 0, y: 5, dir: 0}
};

let world = init(spec);

function init(spec) {
    if (spec === null) {
        $(canvas).hide();
        return null;
    }
    
    let w = new RobotWorld(canvas, spec, RobotClass); // Initialize a robot world
    w.initObjects();
    w.redraw();                                       // Draw the world

    if (spec.script !== undefined)
        editor.setValue(spec.script);
        
    return w;
}

function reinit() {
    if (interp !== null) {
        if (interp.runMode() === "stop" || interp.runMode() === "end") {
            world = init(spec);
        }
        
        if (interp.runMode() === "end") {
            interp.stop();
        }
    }
    
    return false;
}

function run(singleStep) {
    let code = editor.getValue();
    
    if (interp !== null) {
        if (interp.runMode() === 'run' || interp.runMode() === 'end') {
            interp.stop();
        }
        else {
            interp.continue();
            return false;
        }
    }
    
    clearMarks();
    
    $(runbutton).focus();
    
    if (world !== null) {
        world.end();
    }
            
    world = new RobotWorld(canvas, spec, RobotClass);
    world.initObjects();
    world.start();
    world.redraw();
    
    try {
        interp = new CspInterpreter(code, plugins, consoledisp, canvas,
                                    stackdisp, editor);
    }
    catch (e) {
        alert(e);
        $(stopbutton).focus(); 
        world.end();
        return false;
    }
    
    interp.setSpeed(runspeed.value);
    interp.go(singleStep)
            .then(() => {$(stopbutton).focus(); world.end();})
            .catch((e) => {alert(e); $(stopbutton).focus(); world.end();});
    return false;
}

function stop() {
    if (interp !== null) {
        interp.stop();
        world.end();
    }
}

function step() {
    clearMarks();
    
    if (interp === null) {
        run(true);
    }
    else if (interp.runMode() === 'run' || interp.runMode() === 'step') {
        interp.step();
    }
    else {
        run(true);
    }
    
}

function setSpeed() {
    let minslider = 0;
    let maxslider = 100;
    let minspeed = Math.log(1);
    let maxspeed = Math.log(2000);
    
    let scale = (maxspeed-minspeed) / (maxslider-minslider);
    
    if (zombie !== null) {
        interp.setSpeed(Math.exp(runspeed.value * scale + minspeed));
    }
}

runbutton.addEventListener('click', ()=>run(false));
stepbutton.addEventListener('click', step);
stopbutton.addEventListener('click', stop);
runspeed.addEventListener('input', setSpeed);

function clearMarks() {
    let marks = editor.getAllMarks();
    
    marks.forEach(mark => mark.clear());
}

function saveAs(data, filename, filetype) {
    let file = new Blob([data], {type: filetype});
    
    let a = document.createElement("a"),
            url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);  
    }, 0); 
}

$(window).bind('keydown', function(event) {
    if (event.ctrlKey || event.metaKey) {
        switch (String.fromCharCode(event.which).toLowerCase()) {
        case 's':
            event.preventDefault();
            
            let spec = {};
            
            spec.width = world.getWidth();
            spec.height = world.getHeight();
            spec.objects = world.getObjects();
            spec.robot = world.getRobot();
            spec.script = editor.getValue();            
            
            saveAs(JSON.stringify(spec, null, 2), "scenario.csp", "csp");
                    
            break;
            
        case 'o':
            event.preventDefault();            
            $(fileIn).trigger('click');            
            break;
        }
    }
});

let fileIn = $('<input type="file" accept=".csp">')[0];

fileIn.addEventListener('change', loadFile, false);

function loadFile(e) {
    var file = e.target.files[0];
    
    if (!file) {
        return;
    }
    
    let reader = new FileReader();
    reader.onload = (e) => {
        let contents = JSON.parse(e.target.result);
        
        spec = contents;
        
        init(spec);
        
    };
    
    reader.readAsText(file);
    
    e.target.value = null;
}

function keywordButtons(...plugins) {
    let keywords = CspInterpreter.keyWords(plugins);
    let bar = $('.keywords');
    
    
    for (let i in keywords) {
        let btn = $('<button>');
        btn.width('100%');
        
        let word = keywords[i];
        
        if (word instanceof Array) {
            btn.val(word[1]);
            btn.text(word[0]);
        }
        else {
            btn.val(word);
            btn.text(word);
        }
        
        btn.click(() => {
            let doc = editor.getDoc();
            let cursor = doc.getCursor();
            doc.replaceRange(btn.val(), cursor);
            
            $(editor).focus();
        });
        
        bar.append(btn);
    }
}

let editButton = $("#editScenarioButton");
let scenarioEditor = $("#scenarioEditor");

editButton.click(showEditor);

function showEditor() {
    scenarioEditor.modal({backdrop: 'static'});
    
    let canvas = scenarioEditor.find('#worldEditor')[0];
    
    console.log(spec);
    
    let w = new RobotWorld(canvas, spec, RobotClass); // Initialize a robot world
    w.initObjects();
    w.redraw();                                       // Draw the world
    
}