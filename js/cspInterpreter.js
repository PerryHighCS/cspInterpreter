import {cspParser} from './cspParser.js'

const nodeFunction = {
    pass: "_pass",
    assignment: "_doAssignment",
    eval: "_evaluate",
    add: "_doOperation",
    sub: "_doOperation",
    mod: "_doOperation",
    div: "_doOperation",
    mul: "_doOperation",
    negate: "_doNegate",
    relation: "_doRelation",
    identifier: "_getVarVal",
    listelement: "_getListElementVal",
    list: "_getList",
    function_call: "_doFunctionCall",
    block: "_doBlock",
    repeat: "_doRepeat",
    if: "_doIf",
    NOT: "_doNot",
    return: "_doReturn",
    foreach: "_doForEach"
};

const cspBuiltins = [
    ['functions', new Map([
            ['DISPLAY', (params)=>{console.log(...params);}],
            ['INPUT', (params)=>{return window.prompt(...params);}]
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
        this.canvas = canvas;
        
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

        this.program = null;
        let parsed = null;

        // build up the initial stack
        this.stack = [];
        this.stack[0] = this.mergeGlobals(cspBuiltins, graphics.globals);

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
        this.program = parsed.statements;
        this.mapFunctions(parsed.functions);
    }

    mergeGlobals(...maps) {
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
    
    /**
     * Run the parsed program
     */
    go() {        
        if (this.program === null) {
            throw "Fix program code before running.";
        }

        // Execute each top-level statement in the program
        for (let s in this.program) {
            let statement = this.program[s];
            this._doStatement(statement);
        }
    }

    /**
     * Add all functions to the global function table
     * 
     * @param {type} functions
     * @returns {none}
     */
    mapFunctions(functions) {
        // Look at all of the functions in the function list
        for (let f in functions) {
            let fun = functions[f];

            // Get the name, formal parameter list, and code for the function
            let name = this.getIdentifier(fun.args[0]);
            let paramlist = fun.args[1];
            let code = fun.args[2];

            // Extract the parameter names for the formal parameters
            let formal_params = [];
            if (paramlist) {
                for (let p in paramlist) {
                    formal_params.push(this.getIdentifier(paramlist[p]));
                }
            }

            // Add the function to the global table with a curried caller
            this.stack[0].get('functions').set(name,
                    (params, call) => {
                return this._doFunction(params, formal_params, code, call);
            });
        }
    }

    /**
     * Get the name of an identifier
     * 
     * @param {object} node the identifier node to extract the name from
     * @returns {String} the identifier's name
     */
    getIdentifier(node) {
        if (typeof node === 'object' && node.type && node.type === 'identifier')
            return node.args;
        else
            console.error("Not an identifier", node);
        throw 'Not an identifier: ' + node;
    }

    searchStackVar(name, create, proto) {
        // Search for the variable in the stack
        let pos = this.stack.length - 1;
        while (pos >= 0 && !this.stack[pos].get('vars').has(name)) {
            pos--;
        }

        // if the variable hasn't been found
        if (pos === -1) {
            // and creating is allowed
            if (!create) {
                return null;
            }
            // create the variable in the top stack frame
            pos = this.stack.length - 1;
            this.stack[0].get('vars').set(name, proto);
        }

        return this.stack[pos];
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
    findVar(node, create) {
        let name;
        let pos;
        let frame;
        
        switch (node.type) {
            case 'identifier':
                // Get the variable name
                name = this.getIdentifier(node);

                // Find the variable in the stack
                frame = this.searchStackVar(name, create, null);
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
                name = this.getIdentifier(node.args[0]);
                let index = this._evaluate(node.args[1]);
                
                // Find the variable in the stack
                frame = this.searchStackVar(name, create, []);
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
    
    _getVarVal(node) {
        let val = this.findVar(node, false);
        if (typeof val !== 'object' || !val.get) {
            console.error("No variable " + this.getIdentifier(node), node);
            throw "No variable " + this.getIdentifier(node) + " at line " +
                    node.location.start.line + " col: " + 
                    node.location.start.column;
        }
        return val.get();
    }
    
    _getListElementVal(node) {
        let val = this.findVar(node, false);
        if (typeof val !== 'object' || !val.get) {
            console.error("No variable " + this.getIdentifier(node), node);
            throw "No variable " + this.getIdentifier(node) + " at line " +
                    node.location.start.line + " col: " + 
                    node.location.start.column;
        }
        return val.get();
    }
    
    _getList(node) {        
        let lst = [];
        
        for (let i in node.args) {
            lst.push(this._evaluate(node.args[i]));
        }
        
        return lst;
    }
    
    /**
     * Execute a program statement
     * 
     * @param {Object} statement - the parsed statement to execute
     * @returns {undefined}
     */
    _doStatement(statement) {
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
        let handler = nodeFunction[statement.args.type];

        // Run the statement
        if (this[handler]) {
            let rval = this[handler](statement.args);
            
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
    _pass() {
        // Do nothing
    }

    /**
     * Perform an assignment operation
     * 
     * @param {Object} statement
     * @returns {none}
     */
    _doAssignment(statement) {
        let lval = this.findVar(statement.args[0], true);
        
        let rval = this[nodeFunction[statement.args[1].type]](statement.args[1]);

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
    _doFunction(actual_params, formal_params, code, node) {
        if (actual_params.length !== formal_params.length) {
            console.log("actual", actual_params);
            console.log("formal", formal_params);
            console.error("Number of actual and formal parameters differ in function call", node);
            throw "Number of actual and formal parameters differ in function call at line: " +
                    node.location.start.line + " col: " + node.location.start.column;
        }
        
        let vars = new Map();
        let frame = new Map();
        frame.set('vars', vars);
        this.stack.push(frame);
        
        for (let i in actual_params) {
            vars.set(formal_params[i], actual_params[i]);
        }
                
        let rval = this[nodeFunction[code.type]](code);
        
        if (rval instanceof ReturnValue) {
            return rval.val;
        }
        
        this.stack.pop(); // remove the stack frame;
    }

    _doReturn(node) {
        if (node.args === null) {
            return new ReturnValue(undefined);
        }
        
        let rval = this._evaluate(node.args);
        return new ReturnValue(rval);
    }
    
    /**
     * Evaluate a parsed node and any children to calculate and return a value
     * @param {Object} node the parsed node to be evaluated
     * @returns {Number|String|Object|Array}  The evaluated result
     */
    _evaluate(node) {
        if (typeof node !== 'object') {
            return node;
        }
        if (node.type && node.type === 'eval') {
            switch (typeof node.args) {
                case 'number':
                case 'boolean':
                case 'string':
                    return node.args;
                case 'object':
                    if (Array.isArray(node.args)) {
                        console.error("evaluate array?", node.args);
                        return node.args;
                    } 
                    else {
                        if (node.args.type) {
                            try {
                                return this[nodeFunction[node.args.type]](node.args);
                            }
                            catch (e) {
                                console.error(e);
                            }
                        } else if (node.type) {
                            return this[nodeFunction[node.type]](node);
                        }
                    }
                default:
                    console.error("Cannot evaluate", node.args);
                    throw "Cannot evaluate " + node.args;
            }
        }
        else if (node.type) {
            return this[nodeFunction[node.type]](node);
        }
    }

    _doOperation(node) {
        
        let lval = this._evaluate(node.args[0]);
        let rval = this._evaluate(node.args[1]);

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

    _doNegate(node) {
        return -(this._evaluate(node.args));
    }

    _doNot(node) {
        return !(this._evaluate(node.args));
    }
    
    _doRelation(node) {
        let operation = node.args[0];
        let lval = this._evaluate(node.args[1]);
        let rval = this._evaluate(node.args[2]);

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
    _doFunctionCall(node) {
        let name = this.getIdentifier(node.args[0]);
        let args = node.args[1];
        
        let params = [];
        
        for (let i in args) {
            params.push(this._evaluate(args[i]));
        }
        
        let fun = this.stack[0].get('functions').get(name);
        
        if (fun) {
            let rval = fun(params, node);
            
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
    _doBlock(node) {
        // Execute each top-level statement in the program
        for (let s in node.args) {
            let statement = node.args[s];
            let rval = this._doStatement(statement);
            
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
    _doRepeat(node) {
        let header = node.args[0];
        let code = node.args[1];
        
        if (header.type === 'times') {
            let num = this._evaluate(header.args);
            
            if (num < 0) {
                console.error("Invalid repeat limit: " + num , header);
                throw "Invalid repeat limit " + num + " at line: " 
                        + header.location.start.line + " col: " 
                        + header.location.start.column;
            }
            
            
            for (let i = 0; i < num; i++) {
                let rval = this._doBlock(code);
                if (rval instanceof ReturnValue) {
                    return rval;
                }
            }
            return;
        }
        else if (header.type === 'until') {
            let condition = header.args;
            
            while (!this._evaluate(condition)) {
                let rval = this._doBlock(code);
                if (rval instanceof ReturnValue) {
                    return rval;
                }
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
    _doIf(node) {
        for (let i in node.args) {
            let condition = node.args[i][0];
            let code = node.args[i][1];
            
            if (condition === null || this._evaluate(condition)) {
                let rval = this._doBlock(code);
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
    _doForEach(node) {
        let iter = this.findVar(node.args[0], true, null);
        let list = this._evaluate(node.args[1]);
        let code = node.args[2];
        
        for (var i in list) {
            iter.set(list[i]);
            //console.log("Iterator:", iter.get());
            let rval = this._doBlock(code);
            if (rval instanceof ReturnValue) {
                return rval;
            }
        }
    }
}