const svg = document.getElementsByTagName("svg")[0]; // defer
const rings = 7;
const padding = 10;

var log_animation_duration = -10;

function updateAnimationDuration(animation_duration_db) {
  const duration = Math.pow(Math.E, -animation_duration_db / 10);
  svg.style["-webkit-animation-duration"] = `${duration}s`;
}

function changeAnimationDuration(dl) {
  log_animation_duration += dl;
  updateAnimationDuration(log_animation_duration);
}

const keydown_handler = {
  ArrowRight: () => changeAnimationDuration(+1),
  ArrowLeft: () => changeAnimationDuration(-1),
  ArrowUp: () => changeAnimationDuration(+1),
  ArrowDown: () => changeAnimationDuration(-1),
};

document.addEventListener("keydown", (e) => {
  const k = e.key;

  if (keydown_handler.hasOwnProperty(k)) {
    keydown_handler[k](k);
  }
});

document.addEventListener(
  "load",
  (_event) => {
    for (let i = rings - 1; i >= 0; i--) {
      for (let j = 0; j < 2 << i; j++) {
        let angle_part = (2 * Math.PI) / (1 << i);
        let angle_offset = -Math.PI / 2 + angle_part * (j + 2);
        arc_fragment_in_center(
          angle_offset,
          angle_offset + angle_part / 2,
          i / rings,
          (i + 1) / rings
        );
      }
    }
  },
  true
);

function arc_fragment_in_center(
  start_angle,
  stop_angle,
  min_radius,
  max_radius
) {
  const arc = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const mean_angle = (start_angle + stop_angle) / 2;
  ar = 5 * max_radius;
  ax1 = 5 + ar * Math.cos(start_angle);
  ay1 = 5 + ar * Math.sin(start_angle);
  ax2 = 5 + ar * Math.cos(mean_angle);
  ay2 = 5 + ar * Math.sin(mean_angle);
  ax3 = 5 + ar * Math.cos(stop_angle);
  ay3 = 5 + ar * Math.sin(stop_angle);
  br = 5 * min_radius;
  bx1 = 5 + br * Math.cos(start_angle);
  by1 = 5 + br * Math.sin(start_angle);
  bx2 = 5 + br * Math.cos(mean_angle);
  by2 = 5 + br * Math.sin(mean_angle);
  bx3 = 5 + br * Math.cos(stop_angle);
  by3 = 5 + br * Math.sin(stop_angle);
  arc.setAttribute(
    "d",
    `M${ax1} ${ay1} A ${ar} ${ar} 0 0 1 ${ax2} ${ay2} A ${ar} ${ar} 0 0 1 ${ax3} ${ay3} L ${bx3} ${by3} A ${br} ${br} 0 0 0 ${bx2} ${by2} A ${br} ${br} 0 0 0 ${bx1} ${by1} L ${ax1} ${ay1}`
  );
  svg.appendChild(arc);
}
