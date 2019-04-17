import {cspParser} from './cspParser.js'

const cspBuiltins = 
    [['functions', new Map([
                ['DISPLAY', (params)=>{console.log(...params);}],
                ['INPUT', (params)=>{
                        let got = window.prompt(...params);
                        if (got === null) {
                            throw "CANCELED";
                        }
                        else if (!isNaN(Number(got))) {
                            return Number(got);
                        }
                        return got;

                    }],
                ['RANDOM', (params)=>{
                        if (isNaN(params[0]) || isNan(params[1]))
                            throw "RANDOM requires two numbers to specify a range to choose from.";
                        let range = params[1] - params[0] + 1;
                        return Math.floor(Math.random() * range + params[0]);
                    }],
                ['LENGTH', (params)=>{
                        if (!params[0] || !Array.isArray(params[0]))
                            throw "LENGTH requires a list to inspect.";
                        return params[0].length;
                    }],
                ['APPEND', (params)=>{
                        if (!params[0] || !Array.isArray(params[0]))
                            throw "APPEND requires a list to append to.";
                        if (typeof params[1] === 'undefined')
                            throw "Nothing to APPEND.";
                        params[0].push(params[1]);
                    }],
                ['INSERT', (params)=>{
                        if (!params[0] || !Array.isArray(params[0]))
                            throw "INSERT requires a list to insert into.";
                        if (typeof params[1] === 'undefined' || isNaN(params[1]))
                            throw "INSERT requires an index to insert at.";
                        if (params[1] < 1 || params[1] > params[0].length + 1)
                            throw "INSERT requires a valid location to insert at.";
                        if (typeof params[2] === 'undefined')
                            throw "INSERT requires something to insert.";
                        params[0].splice(params[1] - 1, 0, params[2]);
                    }],
                ['REMOVE', (params)=>{
                        if (!params[0] || !Array.isArray(params[0]))
                            throw "REMOVE requires a list to remove from.";
                        if (params[1] < 1 || params[1] > params[0].length + 1)
                            throw "REMOVE requires a valid location to remove from.";
                        if (typeof params[1] === 'undefined' || isNaN(params[1]))
                            throw "REMOVE requires an index to remove.";
                        params[0].splice(params[1] - 1, 1);
                    }]
                ])]
];

class ReturnValue {
    constructor(val) {
        this.val = val;
    }
}

export class CspInterpreter {
    /**
     * Create an interpreter to parse and run an APCSP pseudocode program
     * 
     * @param {String} txt the source code in AP CSP text format
     * @param {Array[Map]} plugins global functions and arrays to add 
     * @param {Element} consolearea a pre to display program output in
     * @param {Element} canvas the canvas to draw on
     * @param {Element} stackcontainer a div to contain a stack display
     * @param {CodeMirror} codemirror the codemirror containing the source code
     */
    constructor(txt, plugins, consolearea, canvas, stackcontainer, codemirror) {
        const that = this;
        
        // redirect console.log to display on the consolearea
        if (consolearea && !console._oldlog) {
            console._oldlog = console.log;
            console.log = (text, object)=>{
                if (Array.isArray(text)) {
                    text = "[" + text + "]";
                }
                consolearea.lastDisplay = text;
                consolearea.textContent += (text);
                if (typeof object !== 'undefined') {
                    consolearea.textContent += ' ' + object;
                    console._oldlog(text, object);
                }
                else {
                    console._oldlog(text);
                } 
                consolearea.textContent += ' ';
            };
        }
        
        if (consolearea && !window._oldprompt) {
            window._oldprompt = window.prompt;
            window.prompt = (prompt)=>{
                if (consolearea && consolearea.lastDisplay && !prompt) {
                    prompt = consolearea.lastDisplay;
                }
                
                if (prompt) {
                    return window._oldprompt(prompt);
                }
                else {
                    return window._oldprompt();
                }
            };
        }
        
        // prepare the initial stack
        let stack = [];
        let stackList = $("<ul>");
        stackList.addClass("programStack");
        
        let caption = $("<h4>");
        caption.text("Call Stack:");
        
        $(stackcontainer).empty();
        $(stackcontainer).append(caption);
        $(stackcontainer).append(stackList);
        
        // Parse the source code provided
        let parsed = null;
        try {
            parsed = cspParser.parse(txt);
        } catch (e) {
            // Report any parser error and quit
            if (typeof e === 'object') {
                console.error(e);
                throw e.message + " line: " + e.location.start.line +
                        " column: " + e.location.start.column;
            } else {
                throw e;
            }
        }

        // Extract the parsed statement list and functions for execution
        const program = parsed.statements;

        // A map linking parsenode types with handler functions
        const nodeFunction = {
            pass: pass,
            assignment: doAssignment,
            eval: evaluate,
            add: doOperation,
            sub: doOperation,
            mod: doOperation,
            div: doOperation,
            mul: doOperation,
            AND: doOperation,
            OR: doOperation,
            negate: doNegate,
            relation: doRelation,
            identifier: getVarVal,
            listelement: getListElementVal,
            list: getList,
            function_call: doFunctionCall,
            block: doBlock,
            repeat: doRepeat,
            if: doIf,
            NOT: doNot,
            return: doReturn,
            foreach: doForEach
        };
        
        let hasStarted = false;
        let isRunning = false;
        let doStop = false;
        let stopped = true;
        let isStepping = false;
        let step = false;
        
        let hilightedCode;

        let delayCount = -1;
        
        /**
         * Run the parsed program
         * 
         * @param {boolean} singleStep set up for single stepping, not
         *                           continuous running
         */
        this.go = async function(singleStep) {
            if (program === null) {
                throw "Fix program code before running.";
            }
            
            $(".pauseLine").removeClass("pauseLine");
            
            // Build up the initial stack
            stack = [];
            stack[0] = CspInterpreter.mergeGlobals(cspBuiltins, ...plugins);
            mapFunctions(parsed.functions);
            stack[0].set('function', ['Global']);
            
            // Prepare the stack display
            stackList.empty();
            updateStack();

            if (isRunning === true) {
                await stop();
            }
            isStepping = singleStep;
            step = false;
            isRunning = true;
            stopped = false;
            doStop = false;
            hasStarted = true;
            
            consolearea.lastDisplay = null;
            consolearea.textContent = "";
            
            // Execute each top-level statement in the program
            for (let s in program) {
                const statement = program[s];
                try {
                    await delay(statement);
                    await doStatement(statement);
                }
                catch(e) {
                    await delay(statement);
                    updateStack();  // update the display
                    stopped = true;
                    isRunning = false;
                    throw e;
                };
            }
            
            updateStack();  // update the display
            isRunning = false;
        };
        
        /**
         * Determine the current run state of this interpreter
         * @returns {String} "error" - code error, "step" - single stepping, 
         *                   "run" - continuous running, "stop" - execution not started
         *                   "end" - execution completed
         */
        this.runMode = function() {
            if (!parsed) {
                return "error";
            }
            
            if (isRunning) {
                if (isStepping) {
                    return "step";
                }
                return "run";                
            }
            
            if (hasStarted) {
                return "end";
            }
            
            return "stop";
        };
        
        /**
         * Set the execution speed.
         * 
         * @param {integer} count
         */
        this.setSpeed = function(count) {
            delayCount = (count >= 1) ? (count < 2000) ? count : 2000 : 1;
        };
        
        /**
         * Pause execution of the program, allowing for watching execution,
         * single stepping, and updating the UI
         * 
         * @param {ParseNode} node the node currently executing
         * @returns {Promise} A promise that will be resolved after the delay
         *                    or rejected if a program stop has been requested
         */
        async function delay(node) {
            // Hilight the code contained in the node
            if (codemirror && node.location) {
                // clear the last hilight
                if (hilightedCode) {
                    hilightedCode.clear();
                }
                const start = {line: node.location.start.line - 1,
                                     ch: node.location.start.column - 1};
                const end = {line: node.location.end.line - 1, 
                                     ch: node.location.end.column - 1};
                                 
                                 
                codemirror.scrollIntoView({from: start, to: end});
                hilightedCode = codemirror.markText(
                                start, end,
                                 {className: "pauseLine"});
            }
            
            // If there is no reason to delay, then don't delay
            if (doStop || isStepping || delayCount > 0) {
                await (()=>{
                    return new Promise((resolve, reject) => {
                        updateStack();  // update the display
                        
                        // pause for delayCount intervals, quitting as needed
                        let count = 0;
                        let si = setInterval(()=>{
                            // Abandon the delay if execution is ordered to stop
                            if (doStop) {
                                clearInterval(si);
                                reject("STOPPED");
                            }
                            // If single stepping and a step is received, continue
                            else if (isStepping && step) {
                                step = false;
                                clearInterval(si);
                                resolve();
                            }
                            // If the delay period is over, continue
                            else if (!isStepping && count >= delayCount) {
                                if (hilightedCode) {
                                    hilightedCode.clear();
                                }
                                clearInterval(si);
                                resolve();
                            }
                            // Otherwise, wait
                            count ++;
                        }, 1); // 50ms intervals
                    });
                })();
            }
        }
        
        /**
         * Force program execution to come to a stop
         * 
         * @returns {Promise} A promise that will be resolved when execution is
         *                    stopped
         */
        this.stop = async function() {
            if (isRunning) {
                doStop = true;

                await (()=>{
                    return new Promise((resolve) => {
                        const si = setInterval(()=>{
                            if(stopped) {
                                isStepping = false;
                                isRunning = false;
                                clearInterval(si);
                                resolve();
                            }
                        }, 100);

                    });
                })();
            }
        };
        
        this.step = async function() {
            if (isRunning) {
                isStepping = true;
                step = true;
            }
            else {
                throw "Not Running";
            }
        };
        
        this.continue = async function() {
            if (isRunning) {
                isStepping = false;
                step = true;
            }
            else {
                throw "Not Running";
            }
        };
        
        /**
         * Add all functions to the global function table
         * 
         * @param {type} functions
         * @returns {none}
         */
        function mapFunctions(functions) {
            // Look at all of the functions in the function list
            for (let f in functions) {
                const fun = functions[f];

                // Get the name, formal parameter list, and code for the function
                const name = getIdentifier(fun.args[0]);
                const paramlist = fun.args[1];
                const code = fun.args[2];

                // Extract the parameter names for the formal parameters
                const formal_params = [];
                if (paramlist) {
                    for (let p in paramlist) {
                        formal_params.push(getIdentifier(paramlist[p]));
                    }
                }

                // Add the function to the global table with a curried caller
                stack[0].get('functions').set(name,
                        (params, call) => {
                    return doFunction(params, formal_params, code, call);
                });
            }
        }

        /**
         * Get the name of an identifier
         * 
         * @param {object} node the identifier node to extract the name from
         * @returns {String} the identifier's name
         */
        function getIdentifier(node) {
            if (typeof node === 'object' && node.type && node.type === 'identifier')
                return node.args;
            else
                console.error("Not an identifier", node);
            throw 'Not an identifier: ' + node;
        }

        /**
         * Search the stack for a variable
         * 
         * @param {String} name the name of the variable to find
         * @param {boolean} create should the variable be created if not found?
         * @param {value|object} proto the value to give a variable if created
         * @returns {unresolved|Map} the stack frame if the variable was found
         *                           or created, null if creation wasn't allowed
         */
        function searchStackVar(name, create, proto) {
            // Search for the variable in the stack
            let pos = stack.length - 1;
            
            // Check the current stack frame
            if(!stack[pos].get('vars').has(name)) {
                // If it is not present, check the global frame
                pos = 0;
                if(!stack[pos].get('vars').has(name)) {
                    // If it isn't present there, flag for creation
                    pos = -1;
                }
            }

            // if the variable hasn't been found
            if (pos === -1) {
                // and creating is allowed
                if (!create) {
                    return null;
                }
                // create the variable in the top stack frame
                pos = stack.length - 1;
                stack[pos].get('vars').set(name, proto);
            }

            return stack[pos];
        }

        /**
         * Return an accessor to the variable identified in a node
         * 
         * @param {object} node the node to parse for a name
         * @param {boolean} create true to create a variable in the top level of the 
         *                          stack if not found
         * @returns {Accessor} an accessor connected to the symbol, null if not
         *                     found and the symbol cannot be created, or create
         *                     is false
         */
        async function findVar(node, create) {
            let name;
            let frame;

            switch (node.type) {
                case 'identifier':
                    // Get the variable name
                    name = getIdentifier(node);

                    // Find the variable in the stack
                    frame = searchStackVar(name, create, null);
                    if (frame === null) {
                        return null;
                    }

                    // Construct and return an accessor for the variable
                    return {
                        get: function () {
                            return frame.get('vars').get(name);
                        },
                        set: function (val) {
                            frame.get('vars').set(name, val);
                        }
                    };

                    break;

                case 'listelement':
                    // Get the list name and element index
                    name = getIdentifier(node.args[0]);
                    const index = await evaluate(node.args[1]) - 1; // CSP lists are 1 based indexed

                    // Find the list in the stack
                    frame = searchStackVar(name, create, []);
                    if (frame === null) {
                        return null;
                    }

                    // Construct and return an accessor for the list element
                    return {
                        get: function () {
                            return frame.get('vars').get(name)[index];
                        },
                        set: function (val) {
                            frame.get('vars').get(name)[index] = val;
                        }
                    };

                    break;

                default:
                    console.error("Unknown symbol type in findSymbol ", node);
                    throw "Unknown symbol type in findSymbol " + node;
            }
        }

        /**
         * Get the value stored in a program variable
         * 
         * @param {ParseNode} node the root node identifing the variable to
         *                          access
         * @returns {value} the value stored in the variable
         */
        async function getVarVal(node) {
            const val = await findVar(node, false);
            if (!val || typeof val !== 'object' || !val.get) {
                console.error("No such variable " + getIdentifier(node), node);
                throw "No such variable " + getIdentifier(node) + " at line " +
                        node.location.start.line + " col: " + 
                        node.location.start.column;
            }
            return val.get();
        }

        /**
         * Get the value contained in a list element
         * 
         * @param {ParseNode} node the root node describing the list element
         * @returns {value} the contents of the list element
         */
        async function getListElementVal(node) {
            const val = await findVar(node, false); // get an accessor for the element
            
            if (!val || typeof val !== 'object' || !val.get) {
                console.error("No such list " + getIdentifier(node.args[0]), node);
                throw "No such list " + getIdentifier(node.args[0]) + " at line " +
                        node.location.start.line + " col: " + 
                        node.location.start.column;
            }
            return val.get(); // Return the element's value
        }

        /**
         * Get a list of values
         * 
         * @param {ParseNode} node the root node of the value list
         * @returns {Promise} A promise that will be fulfilled with an array
         *                    containing the list of evaluated values
         */
        async function getList(node) {        
            const lst = [];

            for (let i in node.args) {
                lst.push(await evaluate(node.args[i]));
            }

            return lst;
        }

        /**
         * Execute a program statement
         * 
         * @param {Object} statement - the parsed statement to execute
         * @returns {undefined}
         */
        async function doStatement(statement) {
            if (typeof statement !== 'object') {
                console.error("Not a statement", statement);
                throw statement + " is not a statement";
            } else if (statement.type !== 'statement') {
                console.error("Not a statement", statement);
                throw "Expected a statement at line: " +
                        statement.location.start.line +
                        " col: " + statement.location.start.column;
            }

            // Find the function that will handle this type of statement
            const handler = nodeFunction[statement.args.type];

            // Run the statement
            if (handler) {
                const rval = await handler(statement.args);

                if (rval instanceof ReturnValue) {
                    return rval;
                }
            } else {
                console.error("NO HANDLER:", statement.args);
                throw "NO HANDLER: " + statement.args.type;
            }
        }

        /**
         * Do nothing
         * 
         * @returns {none}
         */
        function pass() {
            // Do nothing
        }

        /**
         * Perform an assignment operation
         * 
         * @param {Object} statement
         * @returns {none}
         */
        async function doAssignment(statement) {
            const lval = await findVar(statement.args[0], true);

            const rval = await nodeFunction[statement.args[1].type](statement.args[1]);

            lval.set(rval);
        }

        /**
         * Handle an interpreted function call to a function
         * 
         * @param {Array} actual_params the arguments used in the function call
         * @param {Array[string]} formal_params the names to be assigned to the
         *                        actual parameters
         * @param {Array[object]} code the parsed code for the function
         * @param {ParseNode} node the function call parse node
         * @returns {Value|undefined} If the user function returns a value, it will
         *                            be returned, or nothing will be
         * 
         */
        async function doFunction(actual_params, formal_params, code, node) {
            if (actual_params.length !== formal_params.length) {
                console.error("Number of actual and formal parameters differ in function call", node);
                throw "Number of actual and formal parameters differ in function call at line: " +
                        node.location.start.line + " col: " + node.location.start.column;
            }

            const vars = new Map();
            const frame = new Map();
            frame.set('vars', vars);
            frame.set('function', getIdentifier(node.args[0]) + "()");
            
            stack.push(frame);

            for (let i in actual_params) {
                vars.set(formal_params[i], actual_params[i]);
            }

            const rval = await nodeFunction[code.type](code);

            stack.pop(); // remove the stack frame;
            
            if (rval instanceof ReturnValue) {
                return rval.val;
            }
        }

        async function doReturn(node) {
            if (node.args === null) {
                return new ReturnValue(undefined);
            }

            const rval = await evaluate(node.args);
            return new ReturnValue(rval);
        }

        /**
         * Evaluate a parsed node and any children to calculate and return a value
         * @param {Object} node the parsed node to be evaluated
         * @returns {Number|String|Object|Array}  The evaluated result
         */
        async function evaluate(node) {
            if (typeof node !== 'object') {
                return node;
            }
            if (node.type && node.type === 'eval') {
                switch (typeof node.args) {
                    case 'number':
                    case 'boolean':
                    case 'string':
                        return await node.args;
                    case 'object':
                        if (Array.isArray(node.args)) {
                            console.error("evaluate array?", node.args);
                            return node.args;
                        } 
                        else {
                            if (node.args.type) {
                                return await nodeFunction[node.args.type](node.args);
                            } else if (node.type) {
                                return await nodeFunction[node.type](node);
                            }
                        }
                    default:
                        console.error("Cannot evaluate", node.args);
                        throw "Cannot evaluate " + node.args;
                }
            }
            else if (node.type) {
                return await nodeFunction[node.type](node);
            }
        }

        async function doOperation(node) {
            const lval = await evaluate(node.args[0]);
            const rval = await evaluate(node.args[1]);

            switch (node.type) {
                case 'add':
                    return lval + rval;
                case 'sub':
                    return lval - rval;
                case 'mod':
                    return lval % rval;
                case 'mul':
                    return lval * rval;
                case 'div':
                    return lval / rval;                    
                case 'AND':
                    return lval && rval;
                case 'OR':
                    return lval || rval;
            }
        }
        
        async function doNegate(node) {
            return await -(evaluate(node.args));
        }

        async function doNot(node) {
            return ! await (evaluate(node.args));
        }

        async function doRelation(node) {
            const operation = node.args[0];
            const lval = await evaluate(node.args[1]);
            const rval = await evaluate(node.args[2]);

            switch (operation) {
                case '==':
                    return lval == rval;
                case '!=':
                    return lval != rval;
                case '>':
                    return lval > rval;
                case '<':
                    return lval < rval;
                case '<=':
                    return lval <= rval;
                case '>=':
                    return lval >= rval;
            }
        }

        /**
         * Call a function in the program
         * 
         * @param {ParseNode} node the root node fo the function call statement
         * @returns {undefined | value} if the function returns a value, that
         *                              value will be returned
         */
        async function doFunctionCall(node) {
            const name = getIdentifier(node.args[0]);
            const args = node.args[1];

            const params = [];

            for (let i in args) {
                params.push(await evaluate(args[i]));
            }

            const fun = stack[0].get('functions').get(name);

            if (fun) {
                const rval = await fun(params, node);

                return rval;
            }
        }

        /**
         * Run the code contained in a block
         * 
         * @param {ParsedNod} node the Block node
         * @returns {undefined | value} if the code in the block returns a value,
         *              that value will be returned
         */
        async function doBlock(node) {
            // Execute each top-level statement in the program
            for (let s in node.args) {
                const statement = node.args[s];
                await delay(statement);
                const rval = await doStatement(statement);
                
                if (rval instanceof ReturnValue) {
                    return rval;
                }
                
            }
        }

        /**
         * Execute a repeat instruction
         * 
         * @param {ParseNode} node the node containing the repeat instruction
         * @returns {undefined | value} If the repeat block contains a return 
         *                              instruction, its value will be returned
         */
        async function doRepeat(node) {
            const header = node.args[0];
            const code = node.args[1];

            if (header.type === 'times') {
                const num = await evaluate(header.args);

                if (num < 0) {
                    console.error("Invalid repeat limit: " + num , header);
                    throw "Invalid repeat limit " + num + " at line: " 
                            + header.location.start.line + " col: " 
                            + header.location.start.column;
                }


                for (let i = 0; i < num; i++) {
                    const rval = await doBlock(code);
                    if (rval instanceof ReturnValue) {
                        return rval;
                    }
                }
                return;
            }
            else if (header.type === 'until') {
                const condition = header.args;

                let done = await evaluate(condition);
                while (!done) {
                    const rval = await doBlock(code);
                    if (rval instanceof ReturnValue) {
                        return rval;
                    }
                    done = await evaluate(condition);
                }
                return;
            }

            console.error("Unknown repeat type:", node);
            throw "Unknown repeat type at line: " + node.location.start.line +
                    " col: " + node.location.start.column;
        }

        /**
         * Execute an if statement or any of its else/elseifs
         * 
         * @param {ParseNode} node the root node of the if statement
         * @returns {undefined | value} If the if executes a block that contains a
         *         return, the value of that return will be returned
         */
        async function doIf(node) {
            for (let i in node.args) {
                const condition = node.args[i][0];
                const code = node.args[i][1];

                if (condition === null || await evaluate(condition)) {
                    const rval = await doBlock(code);
                    if (rval instanceof ReturnValue) {
                        return rval;
                    }
                    return;
                }
            }
        }

        /**
         * Execute a for each block
         * 
         * @param {ParseNode} node the root node of the for each block
         * @returns {undefined | value} If the for each block that contains a
         *         return, the value of that return will be returned
         */
        async function doForEach(node) {
            const iter = await findVar(node.args[0], true, null);
            const list = await evaluate(node.args[1]);
            const code = node.args[2];

            for (var i in list) {
                iter.set(list[i]);
                //console.log("Iterator:", iter.get());
                const rval = await doBlock(code);
                if (rval instanceof ReturnValue) {
                    return rval;
                }
            }
        }
        
        function updateStack() {
            for (let i in stack) {
                let frame = stack[i];
                let frameEl = frame.get('frameElement');
                
                if (typeof frameEl === 'undefined') {                    
                    frameEl = $("<li>");
                    frame.set('frameElement', frameEl);
                    stackList.prepend(frameEl);
                    
                    caption = $("<h3>");
                    caption.text(stack[i].get('function'));
                    frameEl.append(caption);
                    
                    let varList = $("<dl>");
                    varList.addClass("variables");
                    varList.addClass("dl-horizontal");
                    frame.set('variableContainer', varList);
                    frame.set('variableElements', new Map());
                    frameEl.append(varList);
                }
                
                let varElements = frame.get('variableElements');
                let varContainer = frame.get('variableContainer');
                
                frame.get('vars').forEach((value, key) => {
                    let varDisp = varElements.get(key);
                    
                    if (!varDisp) {
                        let varName = $("<dt>");
                        let varVal = $("<dd>");
                        varName.text(key);
                        varDisp = [varName, varVal];
                        varElements.set(key, varDisp);
                        varContainer.prepend(varVal).prepend(varName);
                    }
                    
                    switch (typeof value) {
                    case 'number':
                    case 'boolean':
                        varDisp[1].text(value);
                        break;
                    case 'string':
                        varDisp[1].text('"' + value + '"');
                        break;
                    case 'object':
                        if (Array.isArray(value)) {
                            varDisp[1].text('[' + value + ']');
                        }
                        else {
                            varDisp[1].text(value);
                        }
                        break;
                    default:
                            varDisp[1].text(value);
                    }
                });
            }
            
            let children = stackList.children();
            
            children.each((index, el) => {
                el = $(el);
                let found = false;
                for (let j in stack) {
                    if (stack[j].get('frameElement').is(el)) {
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    el.remove();
                }
                else if (index === 0 || index === children.length - 1) {
                    el.removeClass("inaccessable");
                }
            });
        }
    }
    
    /**
     * Add global function and variables to the bottom stack frame
     * 
     * @param {type} maps
     * @returns {Map}
     */
    static mergeGlobals(...maps) {
        const theMap = new Map();

        for (const map of maps) {
            for (const [k, v] of map) {
                let m;
                if (theMap.has(k)) {
                    m = theMap.get(k);
                } else {
                    m = new Map(); 
                    theMap.set(k, m);
                }
                for (const [k2, v2] of v) {
                    m.set(k2, v2);
                }
            }
        }
        
        return theMap;
    }
    
    static keyWords(plugins) {        
        const theMap = CspInterpreter.mergeGlobals(cspBuiltins, ...plugins);

        const keyWords = ["<-", 
            ["IF", "IF ( )\n{\n\n}"], ["ELSE", "ELSE\n{\n\n}"],
            "NOT", "AND", "OR", 
            ["REPEAT TIMES", "REPEAT _ TIMES\n{\n\n}"], 
            ["REPEAT UNTIL", "REPEAT UNTIL ( )\n{\n\n}"],
            ["FOR EACH", "FOR EACH item IN list\n{\n\n}"],
            ["PROCEDURE", "PROCEDURE name ( )\n{\n\n}"]];

        theMap.forEach((mapping, type)=>{
            mapping.forEach((v, name)=> {
                if (type === 'vars')
                    keyWords.push(name);
                else
                    keyWords.push(name + "()");
            });
        });
        
        return keyWords;
    }        
}
