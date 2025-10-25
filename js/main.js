const multiplayerManager = new MultiplayerManager();

const createScene = async function () {
    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color3(0.05, 0.05, 0.1);

    // Enable physics
    const havokInstance = await HavokPhysics();
    const havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
    scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), havokPlugin);

    // Initialize Gamepad Manager
    const gamepadManager = new BABYLON.GamepadManager(scene);
    setupGamepad(gamepadManager);

    // Optimized fog for better performance and visuals
    scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
    scene.fogColor = new BABYLON.Color3(0.6, 0.7, 0.85);
    scene.fogStart = 150.0;
    scene.fogEnd = 400.0;

    // ============== OPTIMIZED LIGHTING ==============
    const hemiLight = new BABYLON.HemisphericLight("hemiLight", new BABYLON.Vector3(0.3, 1, 0.3), scene);
    hemiLight.intensity = 0.9;
    hemiLight.diffuse = new BABYLON.Color3(0.9, 0.95, 1);
    hemiLight.groundColor = new BABYLON.Color3(0.3, 0.35, 0.4);
    hemiLight.specular = new BABYLON.Color3(0.1, 0.1, 0.1); // Reduce specular for performance

    const sunLight = new BABYLON.DirectionalLight("sunLight", new BABYLON.Vector3(-0.5, -0.8, -0.5), scene);
    sunLight.position = new BABYLON.Vector3(100, 200, 100);
    sunLight.intensity = 1.2;
    sunLight.diffuse = new BABYLON.Color3(1, 0.9, 0.7);
    sunLight.autoCalcShadowZBounds = true; // Better shadow optimization

    // Shadows
    shadowGenerator = new BABYLON.ShadowGenerator(1, sunLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;
    shadowGenerator.setDarkness(0.3);

    // ============== ENVIRONMENT ==============
    // Skybox
    // Optimized Skybox with procedural sky
    const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 0 }, scene);
    const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skyboxMaterial.emissiveColor = new BABYLON.Color3(0, 0, 1);

    // Create gradient sky effect
    const skyVertexShader = `
    precision highp float;
    attribute vec3 position;
    uniform mat4 worldViewProjection;
    varying vec3 vPosition;
    void main(void) {
        gl_Position = worldViewProjection * vec4(position, 1.0);
        vPosition = position;
    }
`;

    const skyFragmentShader = `
    precision highp float;
    varying vec3 vPosition;
    void main(void) {
        float height = normalize(vPosition).y;
        vec3 skyColor = mix(vec3(0.6, 0.7, 0.9), vec3(0.2, 0.4, 0.8), height);
        gl_FragColor = vec4(skyColor, 1.0);
    }
`;

    const shaderMaterial = new BABYLON.ShaderMaterial("skyShader", scene, {
        vertexSource: skyVertexShader,
        fragmentSource: skyFragmentShader,
    }, {
        attributes: ["position"],
        uniforms: ["worldViewProjection"]
    });

    skybox.material = shaderMaterial;
    skybox.infiniteDistance = true;
    skybox.freezeWorldMatrix();

    // Add glow layer for emissive materials in the map
    const gl = new BABYLON.GlowLayer("glow", scene);
    gl.intensity = 0.8;

    // Create Race Track
    const trackPoints = createRacetrackIslandMap(scene, shadowGenerator, gl);

    let car; // Make car mutable

    function changeVehicle(vehicleType) {
        if (car) {
            car.dispose();
        }
        gameState.vehicleType = vehicleType;
        car = new AdvancedCar(scene, shadowGenerator, trackPoints, vehicleType);

        // Update color on new car model
        car.updateCarColor(gameState.carColor);

        // Update my state for multiplayer broadcast
        multiplayerManager.updateMyState(car.chassis.position, car.chassis.rotationQuaternion, gameState.carColor, gameState.vehicleType);
    }

    // Load car model template before creating the first car
    const result = await BABYLON.SceneLoader.ImportMeshAsync("", "suv-niva/source/", "Niva(done).glb", scene);
    const templateRoot = result.meshes[0]; // The first mesh is usually the root

    if (templateRoot) {
        templateRoot.name = "__root__"; // Give it a known name for the creation function to find
        templateRoot.setEnabled(false); // Disable the template and all its children
    } else {
        console.error("Could not load the car model. Car creation will fail.");
    }

    // Create the initial car
    changeVehicle(gameState.vehicleType);

    // ============== CAMERA SYSTEM ==============
    const cameras = [];

    const chaseCamera = new BABYLON.UniversalCamera("chaseCamera", new BABYLON.Vector3(0, 5, -10), scene);
    cameras.push(chaseCamera);

    const topCamera = new BABYLON.UniversalCamera("topCamera", new BABYLON.Vector3(0, 30, 0), scene);
    cameras.push(topCamera);

    const hoodCamera = new BABYLON.UniversalCamera("hoodCamera", new BABYLON.Vector3(0, 1.5, 1), scene);
    cameras.push(hoodCamera);

    scene.activeCamera = cameras[gameState.cameraMode];

    // ============== INPUT HANDLING ==============
    const inputMap = {};

    scene.actionManager = new BABYLON.ActionManager(scene);
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnKeyDownTrigger,
        (evt) => { inputMap[evt.sourceEvent.key.toLowerCase()] = true; }
    ));
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnKeyUpTrigger,
        (evt) => { inputMap[evt.sourceEvent.key.toLowerCase()] = false; }
    ));

    // Setup UI
    setupUI(inputMap, cameras);

    // Event listeners that depend on the 'car' object or 'changeVehicle' function
    // must be set up within this scope.
    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', (e) => {
            document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
            e.target.classList.add('selected');
            const color = e.target.dataset.color;
            if (car) { // car is the currently active vehicle instance
                car.updateCarColor(color);
            }
        });
    });

    document.querySelectorAll('.vehicle-option').forEach(option => {
        option.addEventListener('click', (e) => {
            document.querySelectorAll('.vehicle-option').forEach(o => o.classList.remove('selected'));
            e.target.classList.add('selected');
            const vehicleType = e.target.dataset.vehicle;
            if (vehicleType !== gameState.vehicleType) {
                changeVehicle(vehicleType);
            }
        });
    });

    // ============== GAME LOOP ==============
    let lastTime = performance.now();

    scene.onBeforeRenderObservable.add(() => {
        const currentTime = performance.now();
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        // Keyboard/Mobile Input
        car.input.forward = inputMap["w"] || inputMap["arrowup"];
        car.input.backward = inputMap["s"] || inputMap["arrowdown"];
        car.input.left = inputMap["a"] || inputMap["arrowleft"];
        car.input.right = inputMap["d"] || inputMap["arrowright"];
        car.input.handbrake = inputMap[" "];
        car.input.turbo = inputMap["control"];

        // Gamepad Input (Polling)
        if (gamepadState.isConnected) {
            // Poll generic gamepad state
            if (gamepadState.gamepad && gamepadState.gamepad.browserGamepad) {
                const gp = gamepadState.gamepad.browserGamepad;

                // Steering (Axis 0)
                gamepadState.steer = Math.abs(gp.axes[0]) > 0.1 ? gp.axes[0] : 0;

                // Acceleration (Axis 5 - R2)
                // Triggers often range from -1 to 1, where -1 is rest and 1 is full press.
                // We convert this to 0 to 1.
                gamepadState.acceleration = gp.axes[5] ? (gp.axes[5] + 1) / 2 : 0;

                // Brake/Reverse (Axis 4 - L2)
                gamepadState.brake = gp.axes[4] ? (gp.axes[4] + 1) / 2 : 0;

                // Handbrake (Button 0 - X)
                gamepadState.handbrake = gp.buttons[0] && gp.buttons[0].pressed;

                // Turbo (Button 5 - R1)
                gamepadState.turbo = gp.buttons[5] && gp.buttons[5].pressed;

                // Reset (Button 9 - Options/Start)
                if (gp.buttons[9] && gp.buttons[9].pressed && !gamepadState._lastResetPress) {
                    gamepadState.reset = true;
                }
                gamepadState._lastResetPress = gp.buttons[9] && gp.buttons[9].pressed;

                // Camera (Button 3 - Triangle)
                if (gp.buttons[3] && gp.buttons[3].pressed && !gamepadState._lastCameraPress) {
                    gamepadState.camera = true;
                }
                gamepadState._lastCameraPress = gp.buttons[3] && gp.buttons[3].pressed;
            }

            if (gamepadState.reset) {
                car.reset();
                gameState.score = Math.max(0, gameState.score - 100);
                gamepadState.reset = false; // Consume the press
            }

            if (gamepadState.camera) {
                gameState.cameraMode = (gameState.cameraMode + 1) % cameras.length;
                scene.activeCamera = cameras[gameState.cameraMode];
                document.getElementById('cameraBtn').textContent = `📷 Camera ${gameState.cameraMode + 1}`;
                gamepadState.camera = false; // Consume the press
            }
        }

        // Keyboard Input (Buttons)
        if (inputMap["r"]) {
            car.reset();
            gameState.score = Math.max(0, gameState.score - 100);
            inputMap["r"] = false; // Consume the press
        }

        if (inputMap["c"]) {
            inputMap["c"] = false;
            gameState.cameraMode = (gameState.cameraMode + 1) % cameras.length;
            scene.activeCamera = cameras[gameState.cameraMode];
            document.getElementById('cameraBtn').textContent = `📷 Camera ${gameState.cameraMode + 1}`;
        }

        // Handle Multiplayer UI Toggle
        if (inputMap["m"]) {
            inputMap["m"] = false;
            toggleMultiplayerPanel();
        }

        car.update(deltaTime);

        const carPos = car.chassis.getAbsolutePosition();
        const carForward = car.chassis.getDirection(BABYLON.Vector3.Forward());

        const idealOffset = carForward.scale(-12).add(new BABYLON.Vector3(0, 6, 0));
        const idealPosition = carPos.add(idealOffset);
        chaseCamera.position = BABYLON.Vector3.Lerp(chaseCamera.position, idealPosition, deltaTime * 5);
        chaseCamera.setTarget(carPos.add(new BABYLON.Vector3(0, 2, 0)));

        topCamera.position = carPos.add(new BABYLON.Vector3(0, 40, -5));
        topCamera.setTarget(carPos);

        const hoodOffset = carForward.scale(1).add(new BABYLON.Vector3(0, 1.5, 0));
        hoodCamera.position = carPos.add(hoodOffset);
        hoodCamera.setTarget(carPos.add(carForward.scale(10)));

        if (gameState.speed > 10) {
            gameState.score += Math.floor(gameState.speed / 20);
        }

        updateHUD();

        // Update multiplayer system
        multiplayerManager.tick(deltaTime);
        multiplayerManager.updateRemotePlayers(deltaTime);
    });

    // Hide loading screen
    document.getElementById('loadingScreen').style.display = 'none';

    return scene;
};

// Create and run the scene
createScene().then((sceneResult) => {
    scene = sceneResult;
    engine.runRenderLoop(() => {
        if (scene) {
            scene.render();
        }
    });
}).catch((error) => {
    console.error("Error creating scene:", error);
    document.getElementById('loadingScreen').innerHTML = '<div style="color: white;">Error loading game. Please refresh.</div>';
});

// Handle window resize
window.addEventListener("resize", () => {
    engine.resize();
});
