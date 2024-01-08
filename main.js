var rings = 7;
var possible_radius;
var padding = 10;

function setup() {
    createCanvas(windowWidth, windowHeight);
    windowResized();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    clear();
    for(let i = rings-1; i >= 0; i--) {
        for(let j = 0; j < (2 << i); j++) {
            let angle_part = Math.PI / (1 << i);
            let angle_offset = angle_part * (j + 2);
            possible_radius = Math.min(windowWidth, windowHeight) / 2 - padding;
            arc_fragment_in_center(angle_offset, angle_offset + angle_part/2, possible_radius*i/rings, possible_radius*(i+1)/rings);
        }
    }
}

function arc_fragment_in_center(start_angle, stop_angle, min_radius, max_radius) {
    fill(0, 0, 0);
    noStroke();
    arc(
        width/2-1,
        height/2-1,
        2*max_radius+4,
        2*max_radius+4,
        start_angle,
        stop_angle,
    );
    fill(255, 255, 255);
    noStroke();
    arc(
        width/2,
        height/2,
        2*min_radius,
        2*min_radius,
        start_angle-1,
        stop_angle+1,
    );
}

function draw() {
}
