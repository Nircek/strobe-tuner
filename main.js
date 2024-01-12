const [, args] = window.location.href.split("?");
const ringsArgs = Math.min(Math.max(3, +args), 10);
if (Number.isFinite(ringsArgs)) {
  // @ts-ignore
  document.getElementById("rings").value = ringsArgs;
}

let quantRate = 0;
let rings;
let quantHandlers;

let tuneFreq = 220;
const sampleRate = 48000;
const soundLength = 20 * sampleRate;

let animationStart;
let previousAnimationTime;
let animationActive = false;

generateQuantSVG();

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
  (e) => {
    e.preventDefault();
    animationActive = true;
    window.requestAnimationFrame(step);
  },
  true
);
/** @type {HTMLButtonElement} */ (
  document.getElementById("stop")
).addEventListener(
  "click",
  (e) => {
    e.preventDefault();
    animationActive = false;
  },
  true
);
/** @type {HTMLButtonElement} */ (
  document.getElementById("apply")
).addEventListener(
  "click",
  (e) => {
    e.preventDefault();
    generateQuantSVG();
    soundArray = generateUserWave();
  },
  true
);
/** @type {HTMLButtonElement} */ (
  document.getElementById("clear")
).addEventListener(
  "click",
  (e) => {
    e.preventDefault();
    document.getElementsByTagName("form")[0].reset();
    updateRanges();
  },
  true
);

let soundArray = generateUserWave();
const ranges = "rings,fund_f,f_radius,f0,f1,f2,f3,f4,f5,f6,f7"
  .split(",")
  .map((e) => document.getElementById(e));
ranges.forEach((e) =>
  e?.addEventListener("input", (_) => {
    // @ts-ignore
    e.nextElementSibling.innerText = e?.value;
  })
);
const updateRanges = () =>
  ranges.forEach((e) => e?.dispatchEvent(new Event("input")));
updateRanges();

/**
 * Change frequency of tuning.
 * @param {number} df
 */
function changeFrequency(df) {
  tuneFreq = Math.max(tuneFreq + df, 0);
}

const keydownHandler = {
  ArrowRight: () => changeFrequency(+0.01),
  ArrowLeft: () => changeFrequency(-0.01),
  ArrowUp: () => changeFrequency(+1),
  ArrowDown: () => changeFrequency(-1),
};

document.addEventListener("keydown", (e) => {
  const k = e.key;
  // @ts-ignore
  if (e.target?.nodeName == "INPUT") {
    return;
  }

  if (keydownHandler.hasOwnProperty(k)) {
    keydownHandler[k](k);
  }
});

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
  // @ts-ignore
  const nRings = +document.getElementById("rings").value;
  if (rings == nRings) return;
  [...document.getElementsByTagName("svg")].forEach((e) => e.remove());
  rings = nRings;
  const quantsPerGroup = {
    3: 50,
    4: 30,
    5: 15,
    6: 10,
    7: 5,
    8: 3,
    9: 1,
    10: 1,
  }[rings];
  quantRate = quantsPerGroup << rings;
  quantHandlers = Array.from(Array(rings), (_v, ring) =>
    Array(quantRate >> ring)
  );
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (let ring = rings - 1; ring >= 0; ring--) {
    const quantsPerRing = quantRate >> ring;
    for (let quant = 0; quant < quantsPerRing; ++quant) {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const quantElements = 1 << ring;
      for (let i = 0; i < quantElements; i++) {
        const anglePart = (2 * Math.PI) / quantElements;
        const angleOffset = anglePart * (i + quant / quantsPerRing);
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
  document.body.appendChild(svg);
  if (!animationActive) {
    setSingleQuants((3 * quantRate) / 4);
  }
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

/**
 * Animate quant SVG.
 * @param {DOMHighResTimeStamp} timeStamp
 */
function step(timeStamp) {
  if (!animationActive) {
    previousAnimationTime = animationStart = undefined;
    return;
  }
  if (animationStart === undefined) {
    previousAnimationTime = animationStart = timeStamp;
  }

  if (previousAnimationTime !== timeStamp) {
    const fps = Math.floor(1000 / (timeStamp - previousAnimationTime));
    fpsHandle.value = `${Number.isFinite(fps) ? fps : 0}`;

    let startSample = Math.floor(
      ((previousAnimationTime - animationStart) / 1e3) * sampleRate
    );
    startSample %= soundLength;
    let stopSample = Math.floor(
      ((timeStamp - animationStart) / 1e3) * sampleRate
    );
    stopSample %= soundLength;
    const playbackPercent = (stopSample / soundLength) * 2;
    if (stopSample < startSample) stopSample += soundLength; // dirty repeating buffer

    playbackHandle.value = `${1e3 * (1 - Math.abs((playbackPercent % 2) - 1))}`;

    const slice = soundArray.slice(startSample, stopSample);
    const maxInSlice = slice.reduce((a, b) => Math.max(a, Math.abs(b)), 0);
    const quantProbabilities = Array(quantRate).fill(0);
    for (const [i, e] of slice.entries()) {
      const t = (startSample + i) / sampleRate;
      const rotationPercent = (t * tuneFreq) % 1;
      const quant = Math.floor(rotationPercent * quantRate);
      quantProbabilities[quant] += Math.abs(e) / maxInSlice > 0.9999 ? 1 : 0;
    }
    updateQuants(quantProbabilities);
  }
  previousAnimationTime = timeStamp;
  window.requestAnimationFrame(step);
}

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

/**
 * Generate wave using user preferences.
 * @return {number[]}
 */
function generateUserWave() {
  // @ts-ignore
  const fundFreq = +document.getElementById("fund_f").value;
  // @ts-ignore
  const freqRadius = +document.getElementById("f_radius").value;
  const startFreq = fundFreq - freqRadius;
  const stopFreq = fundFreq + freqRadius;

  // @ts-ignore
  document.getElementById("start_freq").innerText = `${startFreq} Hz`;
  // @ts-ignore
  document.getElementById("stop_freq").innerText = `${stopFreq} Hz`;

  const freq = Array.from(Array(7), (_, k) =>
    k == 0
      ? Math.random
      : makeLinearFrequencySine(k * startFreq, k * stopFreq, soundLength / 2)
  );

  let soundArray = Array.from(Array(soundLength / 2), (_, i) =>
    Array.from(
      Array(7),
      (_, k) =>
        +(
          // @ts-ignore
          document.getElementById(`f${k}`).value
        ) * freq[k](i)
    ).reduce((a, b) => a + b, 0)
  );
  const soundPeak = soundArray.reduce((a, b) => Math.max(a, Math.abs(b)), 0);
  soundArray = soundArray.map((e) => e / soundPeak);

  const reverseSoundArray = soundArray.map(
    (_, i) => soundArray[soundArray.length - 1 - i]
  );
  soundArray = soundArray.concat(reverseSoundArray);
  soundArray = soundArray.concat(soundArray);

  const ctx = /** @type {CanvasRenderingContext2D} */ (
    // @ts-ignore
    document.getElementById("signal").getContext("2d")
  );
  ctx.clearRect(0, 0, 400, 200);
  ctx.beginPath();
  const transform = (/** @type {number} */ a) => 100 * (1 - a);
  ctx.moveTo(0, transform(soundArray[0]));
  for (const [i, e] of soundArray.entries()) {
    ctx.lineTo(i, transform(e));
  }
  ctx.stroke();
  return soundArray;
}
