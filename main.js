const body = document.body;

const [, args] = window.location.href.split("?");
const splittedArgs = (args ?? "7").split("#");

const rings = +splittedArgs[0];
const quantsPerGroup = +(splittedArgs[1] ?? 3);
const quantRate = quantsPerGroup << rings;

/**
 * Change frequency of tuning.
 * @param {number} df
 */
function changeFrequency(df) {
  refFreq = Math.max(refFreq + df, 0);
}

const keydownHandler = {
  ArrowRight: () => changeFrequency(+0.01),
  ArrowLeft: () => changeFrequency(-0.01),
  ArrowUp: () => changeFrequency(+1),
  ArrowDown: () => changeFrequency(-1),
};

document.addEventListener("keydown", (e) => {
  const k = e.key;

  if (keydownHandler.hasOwnProperty(k)) {
    keydownHandler[k](k);
  }
});

const quantHandlers = Array.from(Array(rings), (_v, ring) =>
  Array(quantRate >> ring)
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
  const aqs = Array(quantRate).fill(0);
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
let offset = 0;

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
    previousTimeStamp = start = timeStamp;
  }
  const elapsed = timeStamp - start;
  const frameDelay = timeStamp - previousTimeStamp;

  if (previousTimeStamp !== timeStamp) {
    const fps = Math.floor(1000 / (timeStamp - previousTimeStamp));
    fpsHandle.value = `${Number.isFinite(fps) ? fps : 0}`;
    const playbackPercent = (elapsed / soundLength) * sampleRate;
    playbackHandle.value = `${1e3 - Math.abs((playbackPercent % 2e3) - 1e3)}`;
    const duration = Math.floor((frameDelay / 1000) * sampleRate);
    const slice = soundArray.slice(offset, offset + duration);
    offset += duration;
    if (offset > soundArray.length) offset -= soundArray.length;
    const quantProbabilities = Array(quantRate).fill(0);
    for (const [i, e] of slice.entries()) {
      const t = (previousTimeStamp / 1000) * sampleRate + i;
      const rotationPercent = (t / (sampleRate / refFreq)) % 1;
      const quant = Math.floor(rotationPercent * quantRate);
      quantProbabilities[quant] += Math.log(Math.abs(e) + 0.01) ** 64;
    }
    updateQuants(quantProbabilities);
  }
  previousTimeStamp = timeStamp;
  window.requestAnimationFrame(step);
}

const fpsHandle = /** @type {HTMLInputElement} */ (
  document.getElementById("fps")
);
const playbackHandle = /** @type {HTMLInputElement} */ (
  document.getElementById("playback")
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

let refFreq = 440;
const sampleRate = 48000;
const soundLength = 10 * sampleRate;
const freqRadius = 6;
const startFreq = 2 * refFreq - freqRadius;
const stopFreq = 2 * refFreq + freqRadius;

// @ts-ignore
document.getElementById("start_freq").innerText = `${startFreq} Hz`;
// @ts-ignore
document.getElementById("stop_freq").innerText = `${stopFreq} Hz`;

/**
 * Make the array be the array of cumulative sum.
 * @param {number[]} arr
 */
function makeCumulative(arr) {
  for (let i = 1; i < arr.length; i++) {
    arr[i] = arr[i - 1] + arr[i];
  }
}

/**
 * Generate the linearly changing frequency sine wave.
 * @param {number} start starting frequency
 * @param {number} stop stopping frequenct
 * @param {number} length length of data signal
 * @return {(function(number): number)}
 */
function makeLinearFrequencySine(start, stop, length) {
  // see https://www.mathworks.com/matlabcentral/answers/217746-implementing-a-sine-wave-with-linearly-changing-frequency
  const freqStep = (stop - start) / length;
  const freq = Array.from(new Array(length), (_, i) => start + freqStep * i);
  makeCumulative(freq);
  return (i) => Math.sin((2 * Math.PI * freq[i]) / sampleRate);
}

const freq1 = makeLinearFrequencySine(startFreq, stopFreq, soundLength);
const freq3 = makeLinearFrequencySine(3 * startFreq, 3 * stopFreq, soundLength);

const soundArray = Array.from(
  Array(soundLength),
  (_, i) => 0.7 * freq1(i) + 0.2 * freq3(i) + 0.1 * Math.random()
);
const reverseSoundArray = soundArray.map(
  (_, i) => soundArray[soundArray.length - 1 - i]
);
soundArray.push(...reverseSoundArray);
