const body = document.body;

const [, args] = window.location.href.split("?");
const splittedArgs = (args ?? "7").split("#");

const rings = +splittedArgs[0];
const quantsPerGroup = +(splittedArgs[1] ?? 3);
const quantRate = quantsPerGroup << rings;

/**
 * TODO: Change frequency of tuning.
 * @param {number} df
 */
function changeFrequency(df) {}

const keydownHandler = {
  ArrowRight: () => changeFrequency(+1),
  ArrowLeft: () => changeFrequency(-1),
  ArrowUp: () => changeFrequency(+1),
  ArrowDown: () => changeFrequency(-1),
};

document.addEventListener("keydown", (e) => {
  const k = e.key;

  if (keydownHandler.hasOwnProperty(k)) {
    keydownHandler[k](k);
  }
});

const quantHandlers = Array.from(
  Array(rings),
  (_v, ring) => new Array(quantRate >> ring)
);

/**
 * Divide array into halves and sum element-wise.
 * @param {number[]} arr an array
 * @return {number[]}
 */
function divideAndSum(arr) {
  const b = arr.splice(arr.length / 2, arr.length);
  return arr.map((e, i) => e + b[i]);
}

/**
 * Use `quantsValues` to update SVG.
 * @param {number[]} quantsValues
 */
function updateQuants(quantsValues) {
  console.assert(quantsValues.length == quantRate);
  const valuesSum = quantsValues.reduce((a, b) => a + b, 0);
  quantsValues = quantsValues.map((e) => e / valuesSum);
  for (let ring = 0; ring < rings; ring++) {
    for (let quant = 0; quant < quantsValues.length; quant++) {
      quantHandlers[ring][quant].setAttribute("opacity", quantsValues[quant]);
    }
    quantsValues = divideAndSum(quantsValues);
  }
}

/**
 * Make only specified quants visible.
 * @param  {...number} quants
 */
function setSingleQuants(...quants) {
  const aqs = Array.from(new Array(quantRate), () => 0);
  for (const q of quants) {
    aqs[q % quantRate] += 1;
  }
  updateQuants(aqs);
}

/**
 * Generate SVG with quants.
 */
function generateQuantSVG() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (let ring = rings - 1; ring >= 0; ring--) {
    const quantsPerRing = quantRate >> ring;
    for (let quant = 0; quant < quantsPerRing; ++quant) {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const quantElements = 1 << ring;
      for (let i = 0; i < quantElements; i++) {
        const anglePart = (2 * Math.PI) / quantElements;
        const angleOffset =
          -Math.PI / 2 + anglePart * (i + quant / quantsPerRing);
        const arc = arcFragmentInCenter(
          angleOffset,
          angleOffset + anglePart / 2,
          ring / rings,
          (ring + 1) / rings
        );
        group.appendChild(arc);
      }
      svg.appendChild(group);
      quantHandlers[ring][quant] = group;
    }
  }
  svg.setAttribute("viewBox", "0 0 10 10");
  body.appendChild(svg);
}

/**
 * Generate Path with one arc
 * @param {number} startAngle
 * @param {number} stopAngle
 * @param {number} minRadius
 * @param {number} maxRadius
 * @return {SVGPathElement}
 */
function arcFragmentInCenter(startAngle, stopAngle, minRadius, maxRadius) {
  const arc = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const meanAngle = (startAngle + stopAngle) / 2;
  const ar = 5 * maxRadius;
  const ax1 = 5 + ar * Math.cos(startAngle);
  const ay1 = 5 + ar * Math.sin(startAngle);
  const ax2 = 5 + ar * Math.cos(meanAngle);
  const ay2 = 5 + ar * Math.sin(meanAngle);
  const ax3 = 5 + ar * Math.cos(stopAngle);
  const ay3 = 5 + ar * Math.sin(stopAngle);
  const br = 5 * minRadius;
  const bx1 = 5 + br * Math.cos(startAngle);
  const by1 = 5 + br * Math.sin(startAngle);
  const bx2 = 5 + br * Math.cos(meanAngle);
  const by2 = 5 + br * Math.sin(meanAngle);
  const bx3 = 5 + br * Math.cos(stopAngle);
  const by3 = 5 + br * Math.sin(stopAngle);
  arc.setAttribute(
    "d",
    `M${ax1} ${ay1} A ${ar} ${ar} 0 0 1 ${ax2} ${ay2} A ${ar} ${ar} 0 0 1 ${ax3} ${ay3} L ${bx3} ${by3} A ${br} ${br} 0 0 0 ${bx2} ${by2} A ${br} ${br} 0 0 0 ${bx1} ${by1} L ${ax1} ${ay1}`
  );
  return arc;
}

let start;
let previousTimeStamp;
let animationActive = false;

/**
 * Animate quant SVG.
 * @param {DOMHighResTimeStamp} timeStamp
 */
function step(timeStamp) {
  if (!animationActive) {
    previousTimeStamp = start = undefined;
    return;
  }
  if (start === undefined) {
    start = timeStamp;
  }
  const elapsed = timeStamp - start;

  if (previousTimeStamp !== timeStamp) {
    const fps = Math.floor(1000 / (timeStamp - previousTimeStamp));
    fpsHandle.value = `${Number.isFinite(fps) ? fps : 0}`;
    if ((elapsed / 6000) % 2 < 1) {
      updateQuants(Array.from(new Array(quantRate), Math.random));
    } else {
      const offset = Math.floor(quantRate * ((elapsed % 6000) / 1000) ** 2);
      const arr = Array.from(
        new Array(Math.floor((quantRate * (elapsed % 6000)) / 1e5 + 1)),
        (_, i) => i + offset
      );
      setSingleQuants(...arr);
    }
  }
  previousTimeStamp = timeStamp;
  window.requestAnimationFrame(step);
}

const fpsHandle = /** @type {HTMLInputElement} */ (
  document.getElementById("fps")
);

/** @type {HTMLButtonElement} */ (
  document.getElementById("start")
).addEventListener(
  "click",
  () => {
    animationActive = true;
    window.requestAnimationFrame(step);
  },
  true
);
/** @type {HTMLButtonElement} */ (
  document.getElementById("stop")
).addEventListener(
  "click",
  () => {
    animationActive = false;
  },
  true
);

generateQuantSVG();

setSingleQuants(0);
