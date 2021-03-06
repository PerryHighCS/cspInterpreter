/* global CodeMirror, URL, History */
import {CspInterpreter} from "./cspInterpreter.js"
import {Zombie} from "./zGraphics.js"   // Add zombie graphics for robot programming
import {Robot} from "./rGraphics.js"    // Add cspRobot graphics for robot programming
import {RobotWorld} from "./robotWorld.js" 
import {WorldEditor} from "./worldEditor.js"

let basePlugins = [];
let plugins = [];
let RobotClass = Robot;

let source = document.getElementById("code");
let canvas = document.getElementById("worldDisplay");
let runbutton = document.getElementById("runButton");
let stopbutton = document.getElementById("stopButton");
let stepbutton = document.getElementById("stepButton");
let resetbutton = document.getElementById("resetButton");
let consoledisp = document.getElementById("consoleDisplay");
let stackdisp = document.getElementById("stackDisplay");
let runspeed = document.getElementById("runSpeed");

runbutton.addEventListener('click', ()=>run(false));
stepbutton.addEventListener('click', step);
stopbutton.addEventListener('click', stop);
runspeed.addEventListener('input', setSpeed);
resetbutton.addEventListener('click', reset);

let editButton = $("#editScenarioButton");
let scenarioEditor = $("#scenarioEditor");

editButton.click(showEditor);

let fileIn = $('<input type="file" accept=".csp">')[0];
fileIn.addEventListener('change', loadFile, false);

$('#menuload').click(load);
$('#menusave').click(save);
$('#menugist').click(gist);

// Convert the code display to a CodeMirror editor
let height = $(source).height();
let editor = CodeMirror.fromTextArea(source, {
  lineNumbers: true,
  matchBrackets: true
});
editor.setSize(null,height);

canvas.addEventListener('click', reinit);

let interp = null;
let zombie = false;

let spec = null;
let world = null;

let worldEditor = null;

// Check get url parameters
var params = new URLSearchParams(window.location.search);

if (params.has('zombie')) {
    zombie = true;
}

// If the url contains a GIST id
if (params.has('gist')) {
    loadGist(decodeURI(params.get('gist')));
}
else {    
    initScenario(spec); // init default scenario
}
function initScenario(worldSpec, usePlugins) {
    
    plugins = basePlugins;
    
    if (usePlugins) {
        plugins.push(...usePlugins);
    }
    
    if (zombie) {
        plugins.push(Zombie.getGraphicsCommands());
        RobotClass = Zombie;
    }
    else {
        plugins.push(Robot.getGraphicsCommands());
        RobotClass = Robot;
    }
    
    keywordButtons(...plugins);

    if (worldSpec) {
        spec = worldSpec;
    }
    else {
        // Create a default world
        spec = new RobotWorld.Spec(
                6, 6, 
                [
                    new RobotWorld.Object("Obstacle", 2, 5),
                    new RobotWorld.Object("Obstacle", 1, 1),
                    new RobotWorld.Object("Goal", 5, 0)
                ],
                0, 5, 0
                );
    } 
    world = init(spec);    
}

$(window).bind('keydown', function(event) {
    if (event.ctrlKey || event.metaKey) {
        switch (String.fromCharCode(event.which).toLowerCase()) {
        case 's':
            // Ctrl-s opens a save dialog to save the current scenario
            event.preventDefault();
            save();
            break;
            
        case 'o':
            // Ctrl-o opens a load file to load a scenario
            event.preventDefault();            
            load();           
            break;
        }
    }
});

function save() {
    let scenario = world.getSpec();
    scenario.script = editor.getValue();            
    saveAs(JSON.stringify(scenario, null, 2), "scenario.csp", "csp");
}

function load() {
    $(fileIn).trigger('click'); 
}

function gist() {
    let gistid = prompt("Enter the Gist ID (a long string like 80ab0a61949a5962f239aec719a61082)");
    
    if (gistid !== null) {
        params.set('gist', gistid);
        loadGist(gistid);
        
        History.pushState(null, document.title, `${location.pathname}?${params}`);

    }
}

function loadGist(gistid) {
    loadFromGist(gistid,
        (files) => {
            if (files && files.length > 0) {
                spec = JSON.parse(files[0].contents);
            }
            initScenario(spec);           
            
        }, 
        (x, txtStatus, error) => {
                alert(txtStatus + " error retrieving github gist " + error);
            });
}

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

function reset() {
    if (interp !== null) {
        interp.stop(true);
        world.end();
                
        world = new RobotWorld(canvas, spec, RobotClass);
        world.initObjects();
        
        world.redraw();
        
        interp = null;
        
        
        clearMarks();
        $(resetbutton).blur();
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
    
    interp.setSpeed(Math.exp(runspeed.value * scale + minspeed));
}

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

function loadFile(e) {
    var file = e.target.files[0];
    
    if (!file) {
        return;
    }
    
    let reader = new FileReader();
    reader.onload = (e) => {
        spec = JSON.parse(e.target.result);
                
        world = init(spec);        
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

function showEditor() {
    worldEditor = new WorldEditor(scenarioEditor, world, RobotClass, updateSpec);    
}

function updateSpec(newSpec) {
    spec = newSpec;
    world = init(spec);
}