const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true, { stencil: true });
engine.setHardwareScalingLevel(1);

// Global references for dynamic objects
let dynamicObjects = [];
const SYNC_INTERVAL = 100; // ms (10 updates per second)
let lastSyncTime = 0;

// Game State
const gameState = {
    score: 0,
    speed: 0,
    rpm: 0,
    gear: 'N',
    cameraMode: 0,
    turboCharge: 100,
    turboActive: false,
    turboCooldown: false,
    carColor: null,
    vehicleType: 'sportsCar',
    health: 100,
    playerName: 'Player' + Math.floor(Math.random() * 1000),
    isHost: false,
    roomCode: null,
    isMultiplayerPanelVisible: true // New state variable
};

// Gamepad State
const gamepadState = {
    gamepad: null,
    isConnected: false,
    acceleration: 0, // 0 to 1 (R2)
    brake: 0,        // 0 to 1 (L2)
    steer: 0,        // -1 (Left) to 1 (Right) (Left Stick X)
    handbrake: false, // X button
    turbo: false,     // R1 button
    reset: false,     // Options button
    camera: false     // Triangle button
};

let scene;
let shadowGenerator; // Make global for quality settings
