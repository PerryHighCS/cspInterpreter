export const zombieGraphics = [
        ['functions', new Map([
            ['MOVE_FORWARD', zForward],
            ['ROTATE_LEFT', zLeft],
            ['ROTATE_RIGHT', zRight],
            ['CAN_MOVE', zCanMove]
            ])],
        ['vars', new Map([
            ['right', "right"],
            ['left', "left"],
            ['forward', "forward"],
            ['backward', "backward"]
            ])]
    ];

function zForward(params) {
    console.log("f", params);
}

function zLeft(params) {
    console.log("l", params);
}

function zRight(params) {
    console.log("r", params);
}

function zCanMove(params) {
    console.log("cm", params);
}