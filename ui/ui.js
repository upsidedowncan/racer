function applyQualitySettings(quality) { // quality is 0.5 to 1.0
    if (!engine || !scene) return;

    // 1. Hardware scaling (pixel density)
    engine.setHardwareScalingLevel(quality);

    // 2. Far clip plane (render distance)
    if (scene.activeCamera) {
        scene.activeCamera.maxZ = 1000 + 1000 * ((quality - 0.5) / 0.5);
    }

    // 3. Shadow quality and other effects
    const skybox = scene.getMeshByName("skyBox");
    const gl = scene.getGlowLayerByName("glow");

    if (quality <= 0.5) {
        // Lowest quality: disable expensive features
        scene.fogEnabled = false;
        if (skybox) skybox.isVisible = false;
        if (gl) gl.isEnabled = false;
        if (shadowGenerator) shadowGenerator.setDarkness(1); // Disables shadows visually

    } else {
        // Higher quality: re-enable features
        scene.fogEnabled = true;
        if (skybox) skybox.isVisible = true;

        if (shadowGenerator) {
            shadowGenerator.setDarkness(0.3); // Original darkness
            const mapSize = Math.pow(2, 9 + Math.floor(4 * ((quality - 0.5) / 0.5))); // 512 to 2048
            shadowGenerator.getShadowMap().resize(mapSize);
            shadowGenerator.useBlurExponentialShadowMap = quality > 0.7;
        }

        if (gl) {
            gl.isEnabled = quality > 0.6;
            gl.blurKernelSize = quality > 0.8 ? 32 : 16;
        }
    }

    // 5. Particle systems can be throttled here too if needed in future
}

function setupGamepad(gamepadManager) {
    const statusEl = document.getElementById('gamepadStatus');

    gamepadManager.onGamepadConnectedObservable.add((gamepad, state) => {
        console.log("Gamepad connected:", gamepad.id);
        gamepadState.isConnected = true;
        gamepadState.gamepad = gamepad;
        statusEl.textContent = `Gamepad: Connected (${gamepad.id})`;

        // Note: All gamepad input is handled via polling in the render loop (onBeforeRenderObservable)
        // for greater compatibility across browsers and controllers.
        console.log("Using generic polling for gamepad input.");
    });

    gamepadManager.onGamepadDisconnectedObservable.add((gamepad, state) => {
        console.log("Gamepad disconnected:", gamepad.id);
        gamepadState.isConnected = false;
        gamepadState.gamepad = null;
        statusEl.textContent = "Gamepad: Disconnected";

        // Reset transient button states
        gamepadState._lastResetPress = false;
        gamepadState._lastCameraPress = false;
    });
}

function toggleMultiplayerPanel() {
    const panel = document.getElementById('multiplayerPanel');
    const icon = document.getElementById('toggleIcon');

    gameState.isMultiplayerPanelVisible = !gameState.isMultiplayerPanelVisible;

    if (gameState.isMultiplayerPanelVisible) {
        panel.classList.remove('collapsed');
        icon.textContent = '▼';
    } else {
        panel.classList.add('collapsed');
        icon.textContent = '▲';
    }
}

function setupUI(inputMap, cameras) {
    // Populate Color Picker
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#808080', '#000000', 'rainbow'];
    const colorPicker = document.getElementById('colorPicker');
    if (colorPicker) {
        colors.forEach((color, index) => {
            const option = document.createElement('div');
            option.className = 'color-option';
            option.dataset.color = color;
            if (color === 'rainbow') {
                option.style.background = 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)';
            } else {
                option.style.backgroundColor = color;
            }
            if (index === 0) { // Select first color by default
                option.classList.add('selected');
                gameState.carColor = color;
            }
            colorPicker.appendChild(option);
        });
    }

    // Fullscreen button
    document.getElementById("fullscreenBtn").addEventListener("click", () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    });

    // Camera switch button
    document.getElementById("cameraBtn").addEventListener("click", () => {
        gameState.cameraMode = (gameState.cameraMode + 1) % cameras.length;
        scene.activeCamera = cameras[gameState.cameraMode];
    });

    // Multiplayer controls
    document.getElementById('hostBtn').addEventListener('click', () => {
        multiplayerManager.init(true); // isHosting = true
    });

    document.getElementById('joinBtn').addEventListener('click', () => {
        const roomCode = document.getElementById('joinInput').value.toUpperCase();
        if (roomCode) {
            multiplayerManager.init(false, roomCode); // isHosting = false, with room code
        }
    });

    // Multiplayer Header Toggle
    document.getElementById('multiplayerHeader').addEventListener('click', toggleMultiplayerPanel);

    // Quality slider setup
    const qualitySlider = document.getElementById('qualitySlider');
    qualitySlider.addEventListener('input', (e) => {
        const quality = parseFloat(e.target.value);
        applyQualitySettings(quality);
    });
    // Set initial quality based on slider's default value
    applyQualitySettings(parseFloat(qualitySlider.value));

    // Mobile controls
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.getElementById("mobileControls").style.display = "block";
        document.getElementById("controls").style.display = "none";

        const setupTouch = (element, key) => {
            element.addEventListener("touchstart", (e) => {
                e.preventDefault();
                inputMap[key] = true;
            });
            element.addEventListener("touchend", (e) => {
                e.preventDefault();
                inputMap[key] = false;
            });
            element.addEventListener("pointerdown", (e) => {
                e.preventDefault();
                inputMap[key] = true;
            });
            element.addEventListener("pointerup", (e) => {
                e.preventDefault();
                inputMap[key] = false;
            });
        };

        setupTouch(document.getElementById("forwardBtn"), "w");
        setupTouch(document.getElementById("backwardBtn"), "s");
        setupTouch(document.getElementById("leftBtn"), "a"); // Corrected key mapping for left turn
        setupTouch(document.getElementById("rightBtn"), "d"); // Corrected key mapping for right turn
        setupTouch(document.getElementById("handbrakeBtn"), " ");
        setupTouch(document.getElementById("turboBtn"), "control");
    }
}

function updateHUD() {
    document.querySelector('.speedometer').textContent = `${Math.floor(gameState.speed)} km/h`;
    document.getElementById('gear').textContent = gameState.gear;
    document.getElementById('rpm').textContent = gameState.rpm;
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('health').textContent = `${gameState.health}%`;
}
