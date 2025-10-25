const SoundGenerator = (() => {
    let audioContext = null;

    function getAudioContext() {
        if (!audioContext) {
            // Wait for audio engine to be initialized
            if (BABYLON.Engine.audioEngine) {
                audioContext = BABYLON.Engine.audioEngine.audioContext;
                // The audio context may be suspended by the browser's autoplay policy.
                // Babylon's unlock function will attach one-time listeners to resume it on user interaction.
                BABYLON.Engine.audioEngine.unlock();
                BABYLON.Engine.audioEngine.setGlobalVolume(1);
            }
        }
        return audioContext;
    }

    // Helper to create a WAV ArrayBuffer from raw audio data
    function createWavBuffer(audioData, sampleRate) {
        const numChannels = 1;
        const numSamples = audioData.length;
        const buffer = new ArrayBuffer(44 + numSamples * 2);
        const view = new DataView(buffer);

        // RIFF header
        view.setUint32(0, 0x52494646, false); // "RIFF"
        view.setUint32(4, 36 + numSamples * 2, true);
        view.setUint32(8, 0x57415645, false); // "WAVE"

        // "fmt " sub-chunk
        view.setUint32(12, 0x666d7420, false); // "fmt "
        view.setUint32(16, 16, true); // Sub-chunk size
        view.setUint16(20, 1, true); // Audio format (1 = PCM)
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * 2, true); // Byte rate
        view.setUint16(32, numChannels * 2, true); // Block align
        view.setUint16(34, 16, true); // Bits per sample

        // "data" sub-chunk
        view.setUint32(36, 0x64617461, false); // "data"
        view.setUint32(40, numSamples * 2, true);

        // Write PCM data
        let offset = 44;
        for (let i = 0; i < numSamples; i++, offset += 2) {
            let s = Math.max(-1, Math.min(1, audioData[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return buffer;
    }

    function createEngineSound(scene, onReady) {
        const context = getAudioContext();
        if (!context) return null;
        const sampleRate = context.sampleRate;
        const duration = 2; // seconds
        const numSamples = sampleRate * duration;
        const audioData = new Float32Array(numSamples);
        const baseFreq = 50;

        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            // Base tone + harmonics + noise
            let val = 0;
            val += Math.sin(t * 2 * Math.PI * baseFreq) * 0.4;
            val += Math.sin(t * 2 * Math.PI * baseFreq * 2) * 0.2;
            val += Math.sin(t * 2 * Math.PI * baseFreq * 4) * 0.1;
            val += (Math.random() - 0.5) * 0.1; // Engine rumble
            audioData[i] = val;
        }

        const wavBuffer = createWavBuffer(audioData, sampleRate);
        return new BABYLON.Sound("engineSound", wavBuffer, scene, onReady, { loop: true, autoplay: true, volume: 0.3 });
    }
    
    function createSkidSound(scene) {
        const context = getAudioContext();
        if (!context) return null;
        const sampleRate = context.sampleRate;
        const duration = 1.5;
        const numSamples = sampleRate * duration;
        const audioData = new Float32Array(numSamples);

        let lastOut = 0;
        for (let i = 0; i < numSamples; i++) {
            // Brown noise for a deeper rumble
            let white = Math.random() * 2 - 1;
            audioData[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = audioData[i];
            audioData[i] *= 3.5; // Amplification
        }
        
        const wavBuffer = createWavBuffer(audioData, sampleRate);
        return new BABYLON.Sound("skidSound", wavBuffer, scene, null, { loop: true, volume: 0.8 });
    }

    function createTurboSound(scene) {
        const context = getAudioContext();
        if (!context) return null;
        const sampleRate = context.sampleRate;
        const duration = 1.0;
        const numSamples = sampleRate * duration;
        const audioData = new Float32Array(numSamples);
        
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const freq = 800 + 1200 * Math.sin(t * Math.PI * 2); // Whine
            let val = Math.sin(t * 2 * Math.PI * freq) * 0.2;
            val += (Math.random() - 0.5) * 0.1; // Air hiss
            audioData[i] = val;
        }

        const wavBuffer = createWavBuffer(audioData, sampleRate);
        return new BABYLON.Sound("turboSound", wavBuffer, scene, null, { loop: true, volume: 0.7 });
    }

    function createCrashSound(scene) {
        const context = getAudioContext();
        if (!context) return null;
        const sampleRate = context.sampleRate;
        const duration = 0.8;
        const numSamples = sampleRate * duration;
        const audioData = new Float32Array(numSamples);
        const decay = 5.0;

        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            let val = (Math.random() * 2 - 1) * Math.exp(-t * decay);
            audioData[i] = val;
        }
        
        const wavBuffer = createWavBuffer(audioData, sampleRate);
        return new BABYLON.Sound("crashSound", wavBuffer, scene, null, { loop: false, volume: 1.0 });
    }

    function createLandingSound(scene) {
        const context = getAudioContext();
        if (!context) return null;
        const sampleRate = context.sampleRate;
        const duration = 0.4;
        const numSamples = sampleRate * duration;
        const audioData = new Float32Array(numSamples);
        const decay = 8.0;

        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            let val = Math.sin(t * 2 * Math.PI * 80) * Math.exp(-t * decay * 2); // Thump
            val += (Math.random() * 2 - 1) * Math.exp(-t * decay); // Scrape
            audioData[i] = val * 0.5;
        }
        
        const wavBuffer = createWavBuffer(audioData, sampleRate);
        return new BABYLON.Sound("landingSound", wavBuffer, scene, null, { loop: false, volume: 1.0 });
    }

    return {
        createEngineSound,
        createSkidSound,
        createTurboSound,
        createCrashSound,
        createLandingSound
    };
})();
