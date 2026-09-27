// Realistic ATM Web Audio API Sound Synthesizer
// Works without any external MP3 dependencies

class ATMAudio {
    constructor() {
        this.ctx = null;
        this.soundEnabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        return this.soundEnabled;
    }

    // Keypad Click / Tactile Button Beep
    playBeep(freq = 1200, type = 'sine', duration = 0.06) {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            // Audio API error safe fallback
        }
    }

    // Card Insertion / Ejection Sound
    playCardSound() {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(now + 0.18);
        } catch (e) {}
    }

    // Cash Counting & Dispenser Mechanical Sound
    playCashCount(duration = 2.0) {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const bufferSize = this.ctx.sampleRate * duration;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);

            // Generate noise + rhythm clicks simulating currency counting roller
            for (let i = 0; i < bufferSize; i++) {
                const t = i / this.ctx.sampleRate;
                const click = (Math.sin(t * 70 * Math.PI) > 0.95) ? 0.6 : 0;
                data[i] = ((Math.random() * 2 - 1) * 0.15 + click) * Math.exp(-t * 0.5);
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            // Bandpass filter for mechanical roller sound
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1800;
            filter.Q.value = 3;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0.01, now + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noise.start(now);
            noise.stop(now + duration);
        } catch (e) {}
    }

    // Success Harmonious Chime
    playSuccess() {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            notes.forEach((freq, index) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const startTime = this.ctx.currentTime + (index * 0.09);

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);

                gain.gain.setValueAtTime(0.18, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(startTime);
                osc.stop(startTime + 0.35);
            });
        } catch (e) {}
    }

    // Error / Warning Buzzer
    playError() {
        if (!this.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.setValueAtTime(160, now + 0.15);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.35);
        } catch (e) {}
    }

    // Voice Speech Synthesizer for ATM Announcements
    speak(text, lang = 'en') {
        if (!this.soundEnabled) return;
        if ('speechSynthesis' in window) {
            try {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                if (lang === 'ta') {
                    utterance.lang = 'ta-IN';
                } else if (lang === 'hi') {
                    utterance.lang = 'hi-IN';
                } else {
                    utterance.lang = 'en-IN';
                }
                utterance.rate = 0.92;
                utterance.pitch = 1.0;
                window.speechSynthesis.speak(utterance);
            } catch (e) {
                console.error('Speech synthesis error:', e);
            }
        }
    }

    // Announce Welcome Message with Customer Name
    speakWelcome(name, lang = 'en') {
        if (!this.soundEnabled || !name) return;
        let message = `Welcome, ${name}`;
        if (lang === 'ta') {
            message = `வணக்கம் ${name}`;
        } else if (lang === 'hi') {
            message = `स्वागत है ${name}`;
        }
        this.speak(message, lang);
    }
}

const atmAudio = new ATMAudio();

