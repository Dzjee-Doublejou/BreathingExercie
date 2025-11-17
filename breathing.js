// ---- Elements
const circle = document.getElementById('circle');
const halo = document.getElementById('halo');
const cue = document.getElementById('cue');
const subcue = document.getElementById('subcue');
const progressEl = document.getElementById('progress');
const patternEl = document.getElementById('pattern');
const minutesEl = document.getElementById('minutes');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const langEl = document.getElementById('lang');
const soundSelect = document.getElementById('sound');
const volumeRange = document.getElementById('volume');
const voiceToggle = document.getElementById('voiceToggle');
const voiceVolumeRange = document.getElementById('voiceVolume');
const customUrlRow = document.getElementById('customUrlRow');
const customUrl = document.getElementById('customUrl');
const audioStatus = document.getElementById('audioStatus');

// ---- i18n dictionary (extendable)
const I18N = {
en: {
    ui: {
    ready: "Ready",
    pick: "Pick a pattern, choose a sound, and press Start",
    pattern: "Pattern",
    minutes: "Session length (min)",
    ambient: "Ambient sound",
    customUrl: "Custom audio URL",
    ambientVol: "Ambient volume",
    voiceVol: "Voice cue volume",
    voiceCues: "Voice cues (inhale/hold/exhale)",
    start: "Start",
    pause: "Pause",
    resume: "Resume",
    reset: "Reset",
    paused: "Paused",
    pressSpace: "Press Space to continue",
    done: "Done ✨",
    noticeFeel: "Notice how you feel.",
    statusOff: "Ambient sound off.",
    statusOn: "Ambient sound playing.",
    statusStop: "Ambient sound stopped.",
    statusNoSrc: "No audio source found.",
    statusBlocked: "Play blocked: user gesture required",
    statusEnable: "Audio will start when you press Start.",
    statusCors: "Could not load audio. Check URL or CORS."
    },
    phaseSub: { Inhale:"Breathe in…", Exhale:"Breathe out…", Hold:"Hold gently…" },
    speak:   { Inhale:"Inhale", Exhale:"Exhale", Hold:"Hold" },
    langMatch: /^en\b/i
},
nl: {
    ui: {
    ready: "Klaar",
    pick: "Kies een patroon, selecteer een geluid en druk op Start",
    pattern: "Patroon",
    minutes: "Sessie duur (min)",
    ambient: "Achtergrondgeluid",
    customUrl: "Aangepaste audio-URL",
    ambientVol: "Achtergrondvolume",
    voiceVol: "Spraakaanduiding volume",
    voiceCues: "Spraakaanwijzingen (inademen/vasthouden/uitademen)",
    start: "Start",
    pause: "Pauze",
    resume: "Hervatten",
    reset: "Reset",
    paused: "Gepauzeerd",
    pressSpace: "Druk op Spatie om door te gaan",
    done: "Klaar ✨",
    noticeFeel: "Merk op hoe je je voelt.",
    statusOff: "Achtergrondgeluid uit.",
    statusOn: "Achtergrondgeluid speelt.",
    statusStop: "Achtergrondgeluid gestopt.",
    statusNoSrc: "Geen audiobron gevonden.",
    statusBlocked: "Afspelen geblokkeerd: gebruikersactie vereist",
    statusEnable: "Audio start wanneer je op Start drukt.",
    statusCors: "Kon audio niet laden. Controleer URL of CORS."
    },
    phaseSub: { Inhale:"Adem in…", Exhale:"Adem uit…", Hold:"Vasthouden…" },
    speak:   { Inhale:"Inademen", Exhale:"Uitademen", Hold:"Vasthouden" },
    langMatch: /^nl\b/i
}
};

let LANG = 'en';
function t(path) {
const parts = path.split('.');
let cur = I18N[LANG];
for (const p of parts) cur = cur?.[p];
return cur ?? path;
}

// Apply UI language to static labels/text
function applyLanguageToUI(){
// Header prompts (main stage)
cue.textContent = t('ui.ready');
subcue.textContent = t('ui.pick');

// Labels in the side panel (only change innerText; options keep as-is)
document.querySelector('label[for="pattern"]').innerText = t('ui.pattern');
document.querySelector('label[for="minutes"]').innerText = t('ui.minutes');
document.querySelector('label[for="sound"]').innerText   = t('ui.ambient');
const customLabel = document.querySelector('label[for="customUrl"]'); if (customLabel) customLabel.innerText = t('ui.customUrl');
document.querySelector('label[for="volume"]').innerText  = t('ui.ambientVol');
const voiceVolLabel = document.querySelector('label[for="voiceVolume"]'); if (voiceVolLabel) voiceVolLabel.innerText = t('ui.voiceVol');

// Chip label
const chipSpan = document.querySelector('.chip span'); if (chipSpan) chipSpan.innerText = t('ui.voiceCues');

// Buttons
startBtn.innerText = running ? (paused ? t('ui.resume') : t('ui.pause')) : t('ui.start');
resetBtn.innerText = t('ui.reset');
}

// ---- State (timing)
let running = false, paused = false, loopAbort = false;
let sessionMs = 0;
let sessionElapsed = 0; // advances only when not paused
let phaseIndex = 0;
let phaseElapsed = 0;   // advances only when not paused
let currentPattern = null;
let lastTick = 0;

// ---- Audio state
let audio = null, targetVolume = parseFloat(volumeRange.value);
let unlocked = false;

const sounds = {
forest: 'assets/sounds/forest.mp3',
wind:   'assets/sounds/wind.mp3',
thunder:'assets/sounds/thunder.mp3',
water:  'assets/sounds/water.mp3'
};

// ---- Ambient audio
function playAmbient(){
const choice = soundSelect.value;
if (choice === 'none') { stopAmbient(); setStatus(t('ui.statusOff')); return; }
let src = (choice === 'custom') ? (customUrl.value||'').trim() : sounds[choice];
if (!src){ setStatus(t('ui.statusNoSrc')); return; }
if (!unlocked){ setStatus(t('ui.statusEnable')); return; }

if (audio && audio.dataset.src === src){ fadeTo(audio, targetVolume, 600); setStatus(t('ui.statusOn')); return; }

const prev = audio;
audio = new Audio();
audio.src = src;
audio.dataset.src = src;
audio.crossOrigin = 'anonymous';
audio.preload = 'auto';
audio.loop = true;
audio.volume = 0;
audio.playsInline = true;

audio.addEventListener('error', ()=> setStatus(t('ui.statusCors'), true), { once:true });

audio.play().then(()=>{ fadeTo(audio, targetVolume, 800); setStatus(t('ui.statusOn')); })
.catch(()=> setStatus(t('ui.statusBlocked'), true));

if (prev){ fadeTo(prev, 0, 600, ()=>{ prev.pause(); prev.src=''; }); }
}

function stopAmbient(){
if (!audio) return;
const a = audio; audio = null;
fadeTo(a, 0, 500, ()=>{ a.pause(); a.src=''; setStatus(t('ui.statusStop')); });
}

function pauseAmbient(){ if (audio){ fadeTo(audio, 0, 250, ()=>{ try{ audio.pause(); }catch(e){} }); } }
function resumeAmbient(){
if (soundSelect.value === 'none') return;
if (audio){ audio.play?.().catch(()=>{}); fadeTo(audio, targetVolume, 300); }
else { playAmbient(); }
}

function fadeTo(a, to, ms=800, onDone){
const stepMs = 40, from = a.volume, steps = Math.max(1, Math.round(ms/stepMs));
let i=0; const id = setInterval(()=>{ i++; const tt=i/steps; a.volume = from + (to-from)*tt;
    if (i>=steps){ clearInterval(id); a.volume = to; onDone && onDone(); }
}, stepMs);
}

// UI listeners
langEl.addEventListener('change', ()=>{
LANG = langEl.value;
applyLanguageToUI();
});

function updateAmbientDuringSession(){
    if (!running) return;
    const wasPaused = paused;
    playAmbient();
    if (wasPaused) pauseAmbient();
}

soundSelect.addEventListener('change', ()=>{
    customUrlRow.style.display = (soundSelect.value==='custom') ? 'block' : 'none';
    updateAmbientDuringSession();
});

customUrl.addEventListener('change', ()=>{
    if (soundSelect.value === 'custom') updateAmbientDuringSession();
});

volumeRange.addEventListener('input', ()=>{
targetVolume = parseFloat(volumeRange.value);
if (audio) fadeTo(audio, targetVolume, 200);
});

function setStatus(msg, isError=false){
    audioStatus.textContent = msg;
    audioStatus.style.color = isError ? '#ff9aa2' : '#a9b0c7';
}

let voiceVolume = parseFloat(voiceVolumeRange?.value || '0.9');
voiceVolumeRange?.addEventListener('input', ()=>{
    voiceVolume = parseFloat(voiceVolumeRange.value || '0.9');
});

voiceToggle.addEventListener('change', ()=>{
    if (voiceVolumeRange){
    voiceVolumeRange.disabled = !voiceToggle.checked;
    }
});
if (voiceVolumeRange){ voiceVolumeRange.disabled = !voiceToggle.checked; }

// ---- Voice cues (choose a voice that matches LANG)
function pickVoiceForLang(){
const voices = speechSynthesis.getVoices();
const langRe = I18N[LANG]?.langMatch || /^en\b/i;
return voices.find(v => langRe.test(v.lang)) || voices.find(v => /^en\b/i.test(v.lang)) || voices[0];
}

function speak(phaseKey){
if (!voiceToggle.checked || !('speechSynthesis' in window)) return;
const phrase = I18N[LANG]?.speak?.[phaseKey] || phaseKey;
const u = new SpeechSynthesisUtterance(phrase);
const v = pickVoiceForLang();
    if (v) u.voice = v;
    u.rate = 0.95; u.pitch = 1.05; u.volume = voiceVolume;
window.speechSynthesis.cancel();
window.speechSynthesis.speak(u);
}
window.speechSynthesis?.addEventListener('voiceschanged', ()=>{ /* pickVoiceForLang() will run on next cue */ });

// ---- Patterns
function getPattern(){
switch (patternEl.value){
    case 'box': return { phases:[['Inhale',4,'expand'],['Hold',4,''],['Exhale',4,'shrink'],['Hold',4,'']], cycle:16 };
    case '478': return { phases:[['Inhale',4,'expand'],['Hold',7,''],['Exhale',8,'shrink']], cycle:19 };
    case 'coherent': return { phases:[['Inhale',5,'expand'],['Exhale',5,'shrink']], cycle:10 };
    case 'triangle': default: return { phases:[['Inhale',4,'expand'],['Hold',4,''],['Exhale',4,'shrink']], cycle:12 };
}
}

function setPrompt(mainKey, subText){
// mainKey is a phase key like 'Inhale' 'Exhale' 'Hold' OR literal text
const main = I18N[LANG]?.speak?.[mainKey] || mainKey;
cue.textContent = main;
subcue.textContent = subText;
}
function setCircle(mode, ms){
circle.style.setProperty('--phase-ms', ms+'ms');
circle.classList.remove('expand','shrink');
if (mode) circle.classList.add(mode);
halo.style.opacity = (mode==='expand') ? 1 : .65;
}
function setProgress(p){ progressEl.style.width = (p*100).toFixed(2)+'%'; }

startBtn.addEventListener('click', toggleStart);
resetBtn.addEventListener('click', reset);
document.addEventListener('keydown', (e)=>{
if (e.code==='Space'){ e.preventDefault(); toggleStart(); }
if (e.key==='f'||e.key==='F'){ const el=document.documentElement; if(!document.fullscreenElement) el.requestFullscreen?.(); else document.exitFullscreen?.(); }
});

function toggleStart(){ if (!running) start(); else pauseResume(); }

// ---- Pausable timing engine
let labelSub = () => I18N[LANG].phaseSub;

function start(){
running = true; paused = false; loopAbort = false; setProgress(0);
sessionMs = Math.max(1, Math.min(60, parseInt(minutesEl.value||'5')))*60*1000;
sessionElapsed = 0;
currentPattern = getPattern();
phaseIndex = 0;
phaseElapsed = 0;

const [label, seconds, mode] = currentPattern.phases[phaseIndex];
setCircle(mode, seconds*1000);
setPrompt(label, labelSub()[label] || '');
speak(label);

startBtn.textContent = t('ui.pause'); startBtn.classList.remove('primary'); resetBtn.disabled = false;

unlocked = true;     // user gesture via Start
resumeAmbient();     // ambience only while active

lastTick = performance.now();
loop();
}

function pauseResume(){
if (!running) return;
paused = !paused;
startBtn.textContent = paused ? t('ui.resume') : t('ui.pause');
setPrompt(paused ? t('ui.paused') : I18N[LANG].speak[currentPattern.phases[phaseIndex][0]],
            paused ? t('ui.pressSpace') : (labelSub()[currentPattern.phases[phaseIndex][0]] || ''));
if (paused) { pauseAmbient(); } else { resumeAmbient(); lastTick = performance.now(); }
}

function reset(){
loopAbort = true; running = false; paused = false; setProgress(0);
cue.textContent = t('ui.ready');
subcue.textContent = t('ui.pick');
circle.classList.remove('expand','shrink');
startBtn.textContent = t('ui.start'); startBtn.classList.add('primary'); resetBtn.disabled = false;
stopAmbient();
}

async function loop(){
while(!loopAbort){
    const now = performance.now();

    if (!paused){
    const dt = Math.min(80, Math.max(0, now - lastTick)); // clamp
    sessionElapsed += dt;
    phaseElapsed += dt;

    const [label, seconds, mode] = currentPattern.phases[phaseIndex];
    const phaseMs = seconds*1000;

    if (phaseElapsed >= phaseMs){
        phaseElapsed -= phaseMs;
        phaseIndex = (phaseIndex + 1) % currentPattern.phases.length;
        const [nLabel, nSeconds, nMode] = currentPattern.phases[phaseIndex];
        setCircle(nMode, nSeconds*1000);
        setPrompt(nLabel, labelSub()[nLabel] || '');
        speak(nLabel);
    }

    setProgress(Math.min(1, sessionElapsed / sessionMs));
    if (sessionElapsed >= sessionMs){ finish(); return; }
    }

    lastTick = now;
    await sleep(50);
}
}

function finish(){
running = false; paused = false; loopAbort = true; setProgress(1);
cue.textContent = t('ui.done');
subcue.textContent = t('ui.noticeFeel');
circle.classList.remove('expand','shrink');
startBtn.textContent = t('ui.start'); startBtn.classList.add('primary');
stopAmbient();
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

// first interaction for audio on iOS/Chrome
window.addEventListener('pointerdown', ()=>{ unlocked = true; }, { once:true });

// Initialize language from selector and apply UI
LANG = (langEl?.value || 'en');
applyLanguageToUI();