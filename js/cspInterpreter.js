import {cspParser} from './cspParser.js'

const cspBuiltins = [
    ['functions', new Map([
            ['DISPLAY', (params)=>{console.log(...params);}],
            ['INPUT', (params)=>{return window.prompt(...params);}],
            ['RANDOM', (params)=>{let range = params[1] - params[0] + 1;
                                  return Math.floor(Math.random() * range + params[0]);}]
        ])]
];

class ReturnValue {
    constructor(val) {
        this.val = val;
    }
}

export class cspInterpreter {
    /**
     * Create an interpreter to parse and run an APCSP pseudocode program
     * 
     * @param {String} txt the source code in AP CSP text format
     * @param {Element} canvas the canvas to draw on
     * @param {GraphicsImplementation} graphics the graphics implementation to
     *                                 use for robot commands
     * @param {Element} consolearea a pre to display program output in
     * 
     */
    constructor(txt, canvas, graphics, consolearea) {
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

        let parsed = null;

        // prepare the initial stack
        let stack = [];

        // Parse the source code provided
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

        const nodeFunction = {
            pass: pass,
            assignment: doAssignment,
            eval: evaluate,
            add: doOperation,
            sub: doOperation,
            mod: doOperation,
            div: doOperation,
            mul: doOperation,
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
        
        let isRunning = false;
        let doStop = false;
        let stopped = true;
        
        /**
         * Run the parsed program
         */
        this.go = async function() {
            if (program === null) {
                throw "Fix program code before running.";
            }
            
            // Build up the initial stack
            stack = [];
            stack[0] = mergeGlobals(cspBuiltins, graphics.globals);
            mapFunctions(parsed.functions);
        

            if (isRunning === true) {
                await stop();
            }
            isRunning = true;
            stopped = false;
            doStop = false;
            
            consolearea.lastDisplay = null;
            consolearea.textContent = "";
            
            // Execute each top-level statement in the program
            for (let s in program) {
                const statement = program[s];
                try {
                    await doStatement(statement);
                    await delay();
                }
                catch(e) {
                    if (e === 'STOPPED') {
                        stopped = true;
                        return;
                    }
                    throw e;
                };
            }
        };
        
        
        /**
         * Add global function and variables to the bottom stack frame
         * 
         * @param {type} maps
         * @returns {Function.mergeGlobals.theMap}
         */
        function mergeGlobals(...maps) {
            const theMap = new Map();

            for (const map of maps) {
                for (const [k, v] of map) {
                    if (theMap.has(k)) {
                        const m = theMap.get(k);
                        for (const [k2, v2] of v) {
                            m.set(k2, v2);
                        }
                    } else {
                        theMap.set(k, v);
                    }
                }
            }

            return theMap;
        }

        async function delay() {
            await (()=>{
                return new Promise((resolve, reject) => {
                    setTimeout(()=>{
                        if (doStop) {
                            reject("STOPPED");
                        }
                        else {
                            resolve();
                        }
                    }, 100);
                });
            })();
        }
        
        this.stop = async function() {
            if (isRunning) {
                doStop = true;

                await (()=>{
                    return new Promise((resolve) => {
                        const si = setInterval(()=>{
                            if(stopped) {
                                isRunning = false;
                                clearInterval(si);
                                resolve();
                            }
                        }, 100);

                    });
                })();
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

        function searchStackVar(name, create, proto) {
            // Search for the variable in the stack
            let pos = stack.length - 1;
            while (pos >= 0 && !stack[pos].get('vars').has(name)) {
                pos--;
            }

            // if the variable hasn't been found
            if (pos === -1) {
                // and creating is allowed
                if (!create) {
                    return null;
                }
                // create the variable in the top stack frame
                pos = stack.length - 1;
                stack[0].get('vars').set(name, proto);
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
                    // Get the variable name
                    name = getIdentifier(node.args[0]);
                    const index = await evaluate(node.args[1]);

                    // Find the variable in the stack
                    frame = searchStackVar(name, create, []);
                    if (frame === null) {
                        return null;
                    }

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

        async function getVarVal(node) {
            const val = await findVar(node, false);
            if (typeof val !== 'object' || !val.get) {
                console.error("No variable " + getIdentifier(node), node);
                throw "No variable " + getIdentifier(node) + " at line " +
                        node.location.start.line + " col: " + 
                        node.location.start.column;
            }
            return val.get();
        }

        async function getListElementVal(node) {
            const val = await findVar(node, false);
            if (typeof val !== 'object' || !val.get) {
                console.error("No variable " + getIdentifier(node), node);
                throw "No variable " + getIdentifier(node) + " at line " +
                        node.location.start.line + " col: " + 
                        node.location.start.column;
            }
            return val.get();
        }

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
            stack.push(frame);

            for (let i in actual_params) {
                vars.set(formal_params[i], actual_params[i]);
            }

            const rval = await nodeFunction[code.type](code);

            if (rval instanceof ReturnValue) {
                return rval.val;
            }

            stack.pop(); // remove the stack frame;
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
            }
        }

        async function doNegate(node) {
            return await -(evaluate(node.args));
        }

        async function doNot(node) {
            return await !(evaluate(node.args));
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
                const rval = await doStatement(statement);
                await delay();
                
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
    }
}