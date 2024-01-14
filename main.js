const [, args] = window.location.href.split("?");
const ringsArgs = Math.min(Math.max(3, +args), 10);
if (Number.isFinite(ringsArgs)) {
  // @ts-ignore
  document.getElementById("rings").value = ringsArgs;
}

let quantRate = 0;
let rings;
let quantHandlers;

let a4BaseFreq = 440;
a4BaseFreq += 0;
const noteScale = "C,C♯,D,D♯,E,F,F♯,G,G♯,A,A♯,B".split(",");
let tuneFreq;

updateTuneFreq(a4BaseFreq);

let sampleRate = 48000;
const soundLength = 20 * sampleRate;
const soundArray = new Float32Array((3 * soundLength) / 2); // dirty repeating buffer
let micSoundArray = new Float32Array();

generateUserWave();

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
const ctx = /** @type {CanvasRenderingContext2D} */ (
  // @ts-ignore
  document.getElementById("signal").getContext("2d")
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
    if (audioCtx === null) generateUserWave();
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
/** @type {HTMLButtonElement} */ (
  document.getElementById("mic")
).addEventListener(
  "click",
  (e) => {
    e.preventDefault();
    if (audioCtx === null) startRecording();
    else stopRecording();
  },
  true
);

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
  // @ts-ignore
  document.getElementById("svg").appendChild(svg);
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

    let slice;

    let startSample;
    if (audioCtx === null) {
      startSample = Math.floor(
        ((previousAnimationTime - animationStart) / 1e3) * sampleRate
      );
      startSample %= soundLength;
      let stopSample = Math.floor(
        ((timeStamp - animationStart) / 1e3) * sampleRate
      );
      stopSample %= soundLength;
      const playbackPercent = (stopSample / soundLength) * 2;
      if (stopSample < startSample) stopSample += soundLength; // dirty repeating buffer

      playbackHandle.value = `${
        1e3 * (1 - Math.abs((playbackPercent % 2) - 1))
      }`;

      slice = soundArray.slice(startSample, stopSample);
    } else {
      audioAnalyser.getFloatTimeDomainData(micSoundArray);
      startSample = (audioCtx.currentTime % 1) * 48e3;
      slice = micSoundArray;
    }

    for (let subslice = 0; subslice + 512 - 1 < slice.length; subslice += 512) {
      let m = 0;
      for (let i = 0; i < 512; i++) {
        if (m < slice[subslice + i]) m = Math.abs(slice[subslice + i]);
      }
      for (let i = 0; i < 512; i++) {
        slice[subslice + i] = slice[subslice + i] / m;
      }
    }

    ctx.clearRect(0, 0, 400, 200);
    ctx.lineWidth = 3;
    ctx.beginPath();
    let x = 0;
    let xOffset = 0;
    for (xOffset = 0; slice[xOffset] < 0.99; xOffset++);
    for (const d of slice.slice(xOffset, xOffset + 400)) {
      const y = 100 - d * 90;
      x ? ctx.lineTo(x++, y) : ctx.moveTo(x++, y);
    }
    ctx.stroke();

    const quantProbabilities = Array(quantRate).fill(0);
    for (const [i, e] of slice.entries()) {
      const t = (startSample + i) / sampleRate;
      const rotationPercent = (t * tuneFreq * 2) % 1;
      const quant = Math.floor(rotationPercent * quantRate);
      quantProbabilities[quant] += Math.abs(e) > 0.9999 ? 1 : 0;
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

  const harmonic = Array.from(Array(7), (_, k) =>
    k == 0
      ? Math.random
      : makeLinearFrequencySine(k * startFreq, k * stopFreq, soundLength / 2)
  );
  const as = Array.from(
    Array(7),
    (_, k) =>
      +(
        // @ts-ignore
        document.getElementById(`f${k}`).value
      )
  );
  for (let i = 0; i < soundLength / 2; i++) {
    soundArray[i] = as
      .map((a, k) => a * harmonic[k](i))
      .reduce((a, b) => a + b, 0);
  }
  for (let i = 0; i < soundLength / 2; i++) {
    soundArray[soundLength - 1 - i] = soundArray[i];
    soundArray[soundLength + i] = soundArray[i]; // dirty repeating buffer
  }
}

/**
 * Try to get permissions from user to record audio.
 */
function startRecording() {
  navigator.mediaDevices
    .getUserMedia({
      audio: { noiseSuppression: false, echoCancellation: false },
    })
    .then(startedRecording)
    .catch(console.log);
}

let audioCtx = null;
let audioAnalyser;
let audioStream;

/**
 * The function that gets called when user accepts recording.
 * @param {MediaStream} stream
 */
function startedRecording(stream) {
  document.styleSheets[0].insertRule(
    ".synthesis{display:none;}",
    document.styleSheets[0].cssRules.length
  );
  audioStream = stream;
  audioCtx = new AudioContext();
  audioAnalyser = audioCtx.createAnalyser();
  micSoundArray = new Float32Array(audioAnalyser.fftSize);
  audioCtx.createMediaStreamSource(stream).connect(audioAnalyser);
  sampleRate = audioCtx.sampleRate;
}

/**
 * Disable all audio recording.
 */
function stopRecording() {
  document.styleSheets[0].deleteRule(
    document.styleSheets[0].cssRules.length - 1
  );
  for (const t of audioStream.getAudioTracks()) t.stop();
  audioCtx.close();
  audioCtx = null;
  sampleRate = 48000;
}

/**
 * Change note frequency to musical perception.
 * @param {number} freq [Hz]
 * @return {[number, number, number]} octave, noteNr, cents
 */
function recognizeNote(freq) {
  const baseFreq = a4BaseFreq * 2 ** (-5 + 1 / 4); // C0
  const logFreq = Math.log2(freq / baseFreq);
  const octave = Math.floor(logFreq + 0.5 / 12);
  const noteNr = Math.floor(((((logFreq + 0.5 / 12) % 1) + 1) % 1) * 12);
  const cents = ((((logFreq * 12 + 0.5) % 1) + 1) % 1) * 100 - 50;
  return [octave, noteNr, cents];
}

/**
 * Transform musical perception to frequency.
 * @param {number} octave
 * @param {number} noteNr
 * @param {number} cents
 * @return {number} [Hz]
 */
function getNoteFreq(octave, noteNr, cents) {
  const baseFreq = a4BaseFreq * 2 ** (-5 + 1 / 4); // C0
  return baseFreq * 2 ** (octave + (noteNr + cents / 100) / 12);
}

/**
 * Snap frequency to the neareast round.
 * @param {number} freq
 * @return {number}
 */
function snapFreqToHertz(freq) {
  return +freq.toFixed(0);
}
/**
 * Snap frequency to the neareast note.
 * @param {number} freq [Hz]
 * @param {[number, number, (number|null)]} delta
 * @return {number}
 */
function snapFreqToNote(freq, delta = [0, 0, null]) {
  const [octave, noteNr, cents] = recognizeNote(freq);
  return getNoteFreq(
    octave + delta[0],
    noteNr + delta[1],
    delta[2] === null ? 0 : cents + delta[2]
  );
}

/**
 * Change note frequency to musical notation.
 * @param {number} freq [Hz]
 * @return {string}
 */
function recognizeNoteStr(freq) {
  let [octave, noteNr, cents] = recognizeNote(freq);
  const note = noteScale[noteNr];
  cents = +cents.toFixed(1);
  return (
    `${note}${octave}` +
    (cents == 0 ? "" : `<sup>${+cents < 0 ? "" : "+"}${cents}c</sup>`)
  );
}

/**
 * Update tune frequency.
 * @param {number} freq [Hz]
 */
function updateTuneFreq(freq) {
  tuneFreq = freq = Math.min(Math.max(1, freq), 440 * 2 ** (62 / 12));

  // @ts-ignore
  document.getElementById("fHz").innerText = `${freq.toFixed(2)} Hz`;
  // @ts-ignore
  document.getElementById("fNote").innerHTML = recognizeNoteStr(freq);
}

const freqModifiers = [
  ["mHz", () => updateTuneFreq(snapFreqToHertz(tuneFreq - 1))],
  ["pHz", () => updateTuneFreq(snapFreqToHertz(tuneFreq + 1))],
  ["mcHz", () => updateTuneFreq(tuneFreq - 0.01)],
  ["pcHz", () => updateTuneFreq(tuneFreq + 0.01)],
  ["mO", () => updateTuneFreq(snapFreqToNote(tuneFreq, [-1, 0, 0]))],
  ["pO", () => updateTuneFreq(snapFreqToNote(tuneFreq, [1, 0, 0]))],
  ["mSt", () => updateTuneFreq(snapFreqToNote(tuneFreq, [0, -1, null]))],
  ["pSt", () => updateTuneFreq(snapFreqToNote(tuneFreq, [0, 1, null]))],
  ["mC", () => updateTuneFreq(snapFreqToNote(tuneFreq, [0, 0, -1]))],
  ["pC", () => updateTuneFreq(snapFreqToNote(tuneFreq, [0, 0, 1]))],
];

for (const [id, cb] of /** @type {[string, function():void][]} */ (
  freqModifiers
)) {
  /** @type {HTMLButtonElement} */ (
    document.getElementById(id)
  ).addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      cb();
    },
    true
  );
}
