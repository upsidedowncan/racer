// ============== VEHICLE MODEL CREATION ==============
function createLowQualityCarModel(scene, color, vehicleType) {
    const config = VEHICLE_CONFIGS[vehicleType];
    const size = config.chassisSize;

    const carGroup = new BABYLON.TransformNode("lowQualityCar", scene);

    const bodyMat = new BABYLON.StandardMaterial("lowQualityBodyMat", scene);
    bodyMat.diffuseColor = color && color !== 'rainbow' ? BABYLON.Color3.FromHexString(color) : new BABYLON.Color3(0.8, 0.2, 0.2);
    bodyMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);

    const body = BABYLON.MeshBuilder.CreateBox("lq_body", { width: size.width, height: size.height * 0.5, depth: size.depth }, scene);
    body.material = bodyMat;
    body.position.y = size.height * 0.25;
    body.parent = carGroup;

    const cabin = BABYLON.MeshBuilder.CreateBox("lq_cabin", { width: size.width * 0.8, height: size.height * 0.4, depth: size.depth * 0.5 }, scene);
    cabin.material = bodyMat;
    cabin.position = new BABYLON.Vector3(0, size.height * 0.5 + size.height * 0.2, -size.depth * 0.1);
    cabin.parent = carGroup;

    const wheels = [];
    const wheelMat = new BABYLON.StandardMaterial("lq_wheelMat", scene);
    wheelMat.diffuseColor = BABYLON.Color3.Black();

    const wheelRadius = size.height * 0.3;
    const wheelWidth = size.width * 0.15;

    const wheelPositions = [
        new BABYLON.Vector3(-size.width * 0.5, wheelRadius, size.depth * 0.4),
        new BABYLON.Vector3(size.width * 0.5, wheelRadius, size.depth * 0.4),
        new BABYLON.Vector3(-size.width * 0.5, wheelRadius, -size.depth * 0.4),
        new BABYLON.Vector3(size.width * 0.5, wheelRadius, -size.depth * 0.4)
    ];

    for (let i = 0; i < 4; i++) {
        const wheel = BABYLON.MeshBuilder.CreateCylinder("lq_wheel_" + i, { height: wheelWidth, diameter: wheelRadius * 2 }, scene);
        wheel.material = wheelMat;
        wheel.rotation.z = Math.PI / 2;
        wheel.position = wheelPositions[i];
        wheel.parent = carGroup;

        wheels.push({
            mesh: wheel,
            rim: wheel,
            isFront: i < 2,
            basePosition: wheel.position.clone()
        });
    }

    return { carGroup, wheels, turboFlames: [], bodyMat: bodyMat, deformableParts: {} };
}

function createCarModel(scene, shadowGenerator, color = null, vehicleType = 'sportsCar') {
    const quality = parseFloat(document.getElementById('qualitySlider').value);
    if (quality <= 0.5) {
        return createLowQualityCarModel(scene, color, vehicleType);
    }

    const templateRoot = scene.getMeshByName("__root__");
    templateRoot.setEnabled(true);
    const carGroup = templateRoot.clone("carGroupInstance", null, false);
    templateRoot.setEnabled(false);
    carGroup.isVisible = true;

    carGroup.position = BABYLON.Vector3.Zero();
    carGroup.rotation = BABYLON.Vector3.Zero();
    carGroup.scaling = new BABYLON.Vector3(1, 1, 1);

    let bodyMat = null;
    const deformableParts = {};
    const wheelMeshes = [];

    carGroup.getChildMeshes(false).forEach(clone => {
        clone.isVisible = true;
        if (shadowGenerator) {
            shadowGenerator.addShadowCaster(clone);
        }

        if (clone.material) {
            if (clone.material.name.toLowerCase().includes("body")) {
                clone.makeGeometryUnique();
                clone.isVertexBufferUpdatable(BABYLON.VertexBuffer.PositionKind, true);
                deformableParts.body = clone;

                const newBodyMat = clone.material.clone(clone.material.name + "_clone");
                clone.material = newBodyMat;
                bodyMat = newBodyMat;
                if (color && bodyMat.albedoColor) {
                    bodyMat.albedoColor = BABYLON.Color3.FromHexString(color);
                }
            }
            else if (clone.material.name.toLowerCase().includes("wheel") || clone.name.toLowerCase().includes("wheel")) {
                wheelMeshes.push(clone);
            }
        }
    });

    const wheels = [];
    wheelMeshes.sort((a, b) => b.position.z - a.position.z);

    if (wheelMeshes.length === 8) {
        const frontMeshes = wheelMeshes.slice(0, 4);
        const rearMeshes = wheelMeshes.slice(4);

        frontMeshes.sort((a, b) => a.position.x - b.position.x);
        rearMeshes.sort((a, b) => a.position.x - b.position.x);

        const sortedPairs = [
            frontMeshes.slice(0, 2),
            frontMeshes.slice(2, 4),
            rearMeshes.slice(0, 2),
            rearMeshes.slice(2, 4)
        ];

        sortedPairs.forEach((pair, index) => {
            const [mesh1, mesh2] = pair;
            const radius1 = mesh1.getBoundingInfo().boundingSphere.radius;
            const radius2 = mesh2.getBoundingInfo().boundingSphere.radius;

            const tireMesh = radius1 > radius2 ? mesh1 : mesh2;
            const rimMesh = radius1 > radius2 ? mesh2 : mesh1;

            wheels.push({
                mesh: tireMesh,
                rim: rimMesh,
                isFront: index < 2,
                basePosition: tireMesh.position.clone()
            });
        });
    } else if (wheelMeshes.length >= 4) {
        const frontWheelMeshes = wheelMeshes.slice(0, 2);
        const rearWheelMeshes = wheelMeshes.slice(2, 4);

        frontWheelMeshes.sort((a, b) => a.position.x - b.position.x);
        rearWheelMeshes.sort((a, b) => a.position.x - b.position.x);

        const sortedWheelMeshes = [...frontWheelMeshes, ...rearWheelMeshes];

        for (let i = 0; i < sortedWheelMeshes.length; i++) {
            const wheelMesh = sortedWheelMeshes[i];
            wheels.push({
                mesh: wheelMesh,
                rim: wheelMesh,
                isFront: i < 2,
                basePosition: wheelMesh.position.clone()
            });
        }
    }

    if (wheels.length !== 4) {
        console.error(`Wheel setup failed. Found ${wheelMeshes.length} potential wheel meshes, but configured ${wheels.length} wheels.`);
    }

    return { carGroup, wheels, turboFlames: [], bodyMat: bodyMat, deformableParts };
}

const VEHICLE_CONFIGS = {
    sportsCar: {
        chassisSize: { height: 1.8, width: 2.2, depth: 4.5 },
        mass: 1200, maxSpeed: 80, turboMaxSpeed: 120, acceleration: 25,
        turboAcceleration: 40, brakeForce: 25, maxSteerAngle: 0.5, steerSpeed: 2.5,
        modelFunction: createCarModel,
        modelYOffset: -0.9
    },
    truck: {
        chassisSize: { height: 2.5, width: 2.8, depth: 7.0 },
        mass: 4000, maxSpeed: 35, turboMaxSpeed: 50, acceleration: 8,
        turboAcceleration: 15, brakeForce: 40, maxSteerAngle: 0.4, steerSpeed: 1.5,
        modelFunction: createCarModel,
        modelYOffset: -1.25
    },
    skateboard: {
        chassisSize: { height: 0.2, width: 0.5, depth: 1.0 },
        mass: 10, maxSpeed: 30, turboMaxSpeed: 45, acceleration: 20,
        turboAcceleration: 35, brakeForce: 15, maxSteerAngle: 0.8, steerSpeed: 4.0,
        modelFunction: createCarModel,
        modelYOffset: -0.1
    },
    miniCar: {
        chassisSize: { height: 1.0, width: 1.5, depth: 2.5 },
        mass: 500, maxSpeed: 40, turboMaxSpeed: 60, acceleration: 18,
        turboAcceleration: 30, brakeForce: 20, maxSteerAngle: 0.6, steerSpeed: 3.0,
        modelFunction: createCarModel,
        modelYOffset: -0.5
    }
};

class AdvancedCar {
    constructor(scene, shadowGenerator, trackPoints = [], vehicleType = 'sportsCar') {
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        this.trackPoints = trackPoints;
        this.startPoint = this.trackPoints.length > 0 ? this.trackPoints[0] : new BABYLON.Vector3(0, 5, 0);
        this.vehicleType = vehicleType;

        const config = VEHICLE_CONFIGS[this.vehicleType];
        this.mass = (this.vehicleType === 'skateboard') ? 80 : config.mass;
        this.maxSpeed = config.maxSpeed;
        this.turboMaxSpeed = config.turboMaxSpeed;
        this.acceleration = config.acceleration;
        this.turboAcceleration = config.turboAcceleration;
        this.brakeForce = config.brakeForce;
        this.steerAngle = 0;
        this.maxSteerAngle = config.maxSteerAngle;
        this.steerSpeed = config.steerSpeed;
        this.currentSpeed = 0;
        this.isReversing = false;
        this.isGrounded = true;
        this.groundCheckDistance = 1.5;
        this.health = 100;
        this.smokeParticleSystem = null;
        this.deformableParts = {};
        this.initialPartStates = {};
        this.initialVertexData = {};
        this.modelYOffset = config.modelYOffset;

        this.wheelFriction = 0.85;
        this.lateralGripStrength = 1200;
        this.driftThreshold = 0.7;
        this.isDrifting = false;
        this.airControlFactor = 0.05;
        this.suspensionStiffness = 800;
        this.suspensionDamping = 100;
        this.wheelSuspensionTravel = 0.3;
        
        this.targetSteerAngle = 0;
        this.steeringSmoothness = 12;
        this.counterSteerStrength = 0.8;
        this.speedSteeringFactor = 0.015;
        this.minSteerSpeed = 3;
        
        this.lastUpdateTime = performance.now();
        this.physicsAccumulator = 0;
        this.fixedTimeStep = 1/60;
        
        this.flipTimer = 0;
        this.flipThreshold = 2.0;

        this.turboCharge = 100;
        this.turboActive = false;
        this.turboCooldown = false;
        this.turboRechargeRate = 10;
        this.turboDrainRate = 30;

        this.createCar();
        this.initSounds();

        this.input = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            handbrake: false,
            turbo: false
        };
    }

    createCar() {
        const config = VEHICLE_CONFIGS[this.vehicleType];

        this.chassis = BABYLON.MeshBuilder.CreateBox("chassis", config.chassisSize, this.scene);
        this.chassis.position = this.startPoint.add(new BABYLON.Vector3(0, config.chassisSize.height / 2 + 0.5, 0));
        if (this.trackPoints.length > 1) {
            const direction = this.trackPoints[1].subtract(this.startPoint);
            this.chassis.rotationQuaternion = BABYLON.Quaternion.FromLookDirectionLH(direction.normalize(), BABYLON.Vector3.Up());
        }
        this.chassis.isVisible = false;

        this.chassisAggregate = new BABYLON.PhysicsAggregate(
            this.chassis,
            BABYLON.PhysicsShapeType.BOX,
            { mass: this.mass, friction: 0.5, restitution: 0.2 },
            this.scene
        );

        this.chassisAggregate.body.setLinearDamping(0.6);
        this.chassisAggregate.body.setAngularDamping(2);
        this.chassis.rotationQuaternion = BABYLON.Quaternion.Identity();
        this.chassisAggregate.body.setCollisionCallbackEnabled(true);

        this.chassisAggregate.body.getCollisionObservable().add((event) => {
            if (gameState.speed < 10) return;
            const impulse = event.impulse;
            const damage = Math.min(Math.floor(impulse / 3000), 30);
            if (damage > 1) {
                this.takeDamage(damage, event.point);
                if (this.sounds && this.sounds.crash && this.sounds.crash.isReady()) {
                    const volume = Math.min(1, impulse / 20000);
                    this.sounds.crash.setVolume(volume);
                    this.sounds.crash.play();
                }
            }
        });

        const carModel = config.modelFunction(this.scene, this.shadowGenerator, gameState.carColor, this.vehicleType);
        this.carModel = carModel.carGroup;
        this.wheels = carModel.wheels;
        this.turboFlames = carModel.turboFlames;
        this.bodyMat = carModel.bodyMat;
        this.deformableParts = carModel.deformableParts;

        for (const partName in this.deformableParts) {
            const part = this.deformableParts[partName];
            this.initialPartStates[partName] = {
                parent: part.parent,
                position: part.position.clone(),
                rotationQuaternion: part.rotationQuaternion ? part.rotationQuaternion.clone() : BABYLON.Quaternion.FromEulerVector(part.rotation),
                scaling: part.scaling.clone()
            };
            this.initialVertexData[partName] = part.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        }

        this.carModel.parent = this.chassis;
        this.carModel.position.y = this.modelYOffset;
    }

    initSounds() {
        this.sounds = {};
        
        // Generate sounds using the new SoundGenerator
        this.sounds.engine = SoundGenerator.createEngineSound(this.scene, () => {
            if (this.sounds.engine && !this.sounds.engine.isPlaying) {
                this.sounds.engine.play();
            }
        });
        this.sounds.skid = SoundGenerator.createSkidSound(this.scene);
        this.sounds.turbo = SoundGenerator.createTurboSound(this.scene);
        this.sounds.crash = SoundGenerator.createCrashSound(this.scene);
        this.sounds.landing = SoundGenerator.createLandingSound(this.scene);
        
        // Attach sounds to the chassis for 3D audio
        for (const key in this.sounds) {
            if (this.sounds[key]) {
                this.sounds[key].attachToMesh(this.chassis);
            }
        }
    }

    updateSounds(localVelocity) {
        if (!this.sounds) return;
    
        // Engine sound pitch based on RPM
        if (this.sounds.engine && this.sounds.engine.isReady()) {
            const rpmRatio = (gameState.rpm - 800) / (8000 - 800); // Normalize RPM
            const pitch = 0.6 + rpmRatio * 1.4; // Map to a good pitch range
            this.sounds.engine.setPlaybackRate(Math.max(0.5, pitch));
        }
    
        // Skid sound
        if (this.sounds.skid && this.sounds.skid.isReady()) {
            const lateralSpeed = Math.abs(localVelocity.x);
            // Play when drifting and moving sideways
            if (this.isDrifting && lateralSpeed > 5 && this.isGrounded) {
                if (!this.sounds.skid.isPlaying) {
                    this.sounds.skid.play();
                }
                // Modulate volume by how much we're slipping
                this.sounds.skid.setVolume(Math.min(1, (lateralSpeed - 5) / 15));
            } else {
                if (this.sounds.skid.isPlaying) {
                    this.sounds.skid.stop();
                }
            }
        }
    }

    updateCarColor(color) {
        gameState.carColor = color;
        if (!color) return;

        const colorObj = color === 'rainbow' ?
            new BABYLON.Color3(Math.random(), Math.random(), Math.random()) :
            BABYLON.Color3.FromHexString(color);

        if (this.bodyMat && this.bodyMat.albedoColor) {
            this.bodyMat.albedoColor = colorObj;
        }

        multiplayerManager.updateMyState(this.chassis.position, this.chassis.rotationQuaternion, gameState.carColor, gameState.vehicleType);
    }

    takeDamage(amount, contactPoint) {
        if (this.health <= 0) return;
        this.health = Math.max(0, this.health - amount);
        gameState.health = this.health;

        this.applySoftBodyDeformation(amount, contactPoint);

        if (this.health < 70 && !this.smokeParticleSystem) {
            this.createSmokeEffect();
        } else if (this.smokeParticleSystem) {
            const healthRatio = this.health / 70;
            this.smokeParticleSystem.emitRate = 200 * (1 - healthRatio);
            this.smokeParticleSystem.minLifeTime = 1.5 * healthRatio;
            this.smokeParticleSystem.maxLifeTime = 2.5 * healthRatio;
        }

        if (this.health <= 0 && this.smokeParticleSystem) {
            this.smokeParticleSystem.emitRate = 1000;
            setTimeout(() => this.smokeParticleSystem.stop(), 500);
        }
    }

    createSmokeEffect() {
        if (parseFloat(document.getElementById('qualitySlider').value) <= 0.5) return;

        this.smokeParticleSystem = new BABYLON.ParticleSystem("smoke", 1000, this.scene);
        this.smokeParticleSystem.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", this.scene);
        this.smokeParticleSystem.emitter = this.chassis;
        this.smokeParticleSystem.minEmitBox = new BABYLON.Vector3(-0.5, 0.2, 0);
        this.smokeParticleSystem.maxEmitBox = new BABYLON.Vector3(0.5, 0.5, 1);
        this.smokeParticleSystem.color1 = new BABYLON.Color4(0.1, 0.1, 0.1, 0.8);
        this.smokeParticleSystem.color2 = new BABYLON.Color4(0.2, 0.2, 0.2, 0.6);
        this.smokeParticleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
        this.smokeParticleSystem.minSize = 0.5;
        this.smokeParticleSystem.maxSize = 1.2;
        this.smokeParticleSystem.minLifeTime = 0.3;
        this.smokeParticleSystem.maxLifeTime = 1.5;
        this.smokeParticleSystem.emitRate = 80;
        this.smokeParticleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        this.smokeParticleSystem.gravity = new BABYLON.Vector3(0, 0.5, 0);
        this.smokeParticleSystem.direction1 = new BABYLON.Vector3(-0.5, 1, -0.5);
        this.smokeParticleSystem.direction2 = new BABYLON.Vector3(0.5, 2, 0.5);
        this.smokeParticleSystem.minAngularSpeed = 0;
        this.smokeParticleSystem.maxAngularSpeed = Math.PI;
        this.smokeParticleSystem.minEmitPower = 0.5;
        this.smokeParticleSystem.maxEmitPower = 1.2;
        this.smokeParticleSystem.updateSpeed = 0.015;
        this.smokeParticleSystem.start();
    }

    applySoftBodyDeformation(damage, contactPoint) {
        const impactRadius = 1.5 + (damage / 40);
        const maxDeformation = 0.02 * damage;
        const impactNormal = this.chassis.getAbsolutePosition().subtract(contactPoint).normalize();

        for (const partName in this.deformableParts) {
            const part = this.deformableParts[partName];
            if (!part || !part.isVerticesDataPresent(BABYLON.VertexBuffer.PositionKind)) continue;

            const positions = part.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            const worldMatrix = part.getWorldMatrix();
            const worldMatrixInverted = worldMatrix.invert();
            let verticesChanged = false;
            const localImpactNormal = BABYLON.Vector3.TransformNormal(impactNormal, worldMatrixInverted);

            for (let i = 0; i < positions.length; i += 3) {
                const localVertex = new BABYLON.Vector3(positions[i], positions[i + 1], positions[i + 2]);
                const worldVertex = BABYLON.Vector3.TransformCoordinates(localVertex, worldMatrix);
                const distance = BABYLON.Vector3.Distance(worldVertex, contactPoint);

                if (distance < impactRadius) {
                    verticesChanged = true;
                    const falloff = Math.cos((distance / impactRadius) * (Math.PI / 2));
                    const deformationAmount = maxDeformation * falloff;

                    positions[i] += localImpactNormal.x * deformationAmount;
                    positions[i + 1] += localImpactNormal.y * deformationAmount;
                    positions[i + 2] += localImpactNormal.z * deformationAmount;
                }
            }

            if (verticesChanged) {
                part.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions, false, false);
                const normals = [];
                BABYLON.VertexData.ComputeNormals(positions, part.getIndices(), normals);
                part.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals, false, false);
            }
        }
    }

    checkGroundContact() {
        const origin = this.chassis.getAbsolutePosition();
        const rayLength = this.groundCheckDistance + this.wheelSuspensionTravel;
        const ray = new BABYLON.Ray(origin, new BABYLON.Vector3(0, -1, 0), rayLength);
        const hit = this.scene.pickWithRay(ray, (mesh) => mesh !== this.chassis && !mesh.name.includes("wheel"));
        
        const wasGrounded = this.isGrounded;
        this.isGrounded = hit && hit.hit && hit.distance < rayLength;

        if (this.isGrounded && hit) {
            const compressionRatio = Math.max(0, 1 - (hit.distance / rayLength));
            const suspensionForce = compressionRatio * this.suspensionStiffness;
            const body = this.chassisAggregate.body;
            const velocity = body.getLinearVelocity();
            const damping = -velocity.y * this.suspensionDamping * compressionRatio;
            const totalUpwardForce = (suspensionForce + damping) * 0.016;
            body.applyImpulse(new BABYLON.Vector3(0, totalUpwardForce, 0), this.chassis.getAbsolutePosition());
        }

        if (!wasGrounded && this.isGrounded) {
            const velocity = this.chassisAggregate.body.getLinearVelocity();
            const impactSpeed = Math.abs(velocity.y);
            if (this.sounds && this.sounds.landing && this.sounds.landing.isReady() && impactSpeed > 2) {
                const volume = Math.min(1, impactSpeed / 20);
                this.sounds.landing.setVolume(volume);
                this.sounds.landing.play();
            }
            if (impactSpeed > 5) {
                const landingDamage = Math.floor((impactSpeed - 5) * 3);
                this.takeDamage(landingDamage, this.chassis.getAbsolutePosition());
            }
        }

        const up = this.chassis.up;
        const angleFromUp = Math.acos(BABYLON.Vector3.Dot(up, BABYLON.Vector3.Up()));
        if (angleFromUp > Math.PI / 3) {
            this.isGrounded = false;
        }
    }

    update(deltaTime) {
        // Clamp deltaTime to prevent physics explosions during lag spikes
        deltaTime = Math.min(deltaTime, 0.1);
        
        const body = this.chassisAggregate.body;
        const velocity = body.getLinearVelocity();
        const localVelocity = BABYLON.Vector3.TransformNormal(velocity, BABYLON.Matrix.Invert(this.chassis.getWorldMatrix()));

        this.currentSpeed = localVelocity.z;
        gameState.speed = Math.abs(this.currentSpeed * 3.6);

        this.updateSounds(localVelocity);
        this.checkGroundContact();
        this.updateTurbo(deltaTime);
        
        // Check if car is stuck upside down or on its side
        const up = this.chassis.up;
        const uprightDot = BABYLON.Vector3.Dot(up, BABYLON.Vector3.Up());
        
        if (uprightDot < 0.3) {
            this.flipTimer += deltaTime;
            if (this.flipTimer > this.flipThreshold) {
                // Auto-flip the car if stuck for too long
                const targetQuat = BABYLON.Quaternion.Identity();
                this.chassis.rotationQuaternion = BABYLON.Quaternion.Slerp(
                    this.chassis.rotationQuaternion,
                    targetQuat,
                    0.1
                );
                this.flipTimer = 0;
            }
        } else {
            this.flipTimer = 0;
        }

        const healthModifier = Math.max(0, this.health / 100);
        const effectiveMaxSpeed = this.maxSpeed * (0.4 + 0.6 * healthModifier);
        const effectiveAcceleration = this.acceleration * (0.4 + 0.6 * healthModifier);

        if (this.health <= 0) {
            this.input = { forward: false, backward: false, left: false, right: false, handbrake: false, turbo: false };
        }

        if (this.isGrounded) {
            const ray = new BABYLON.Ray(this.chassis.position, new BABYLON.Vector3(0, -1, 0), 3);
            const hit = this.scene.pickWithRay(ray);
            if (hit && hit.pickedMesh && hit.pickedMesh.metadata && hit.pickedMesh.metadata.isBoostPad) {
                const forward = this.chassis.getDirection(BABYLON.Vector3.Forward());
                const boostImpulse = forward.scale(50000 * deltaTime);
                body.applyImpulse(boostImpulse, this.chassis.getAbsolutePosition());

                if (!this.lastBoostTime || Date.now() - this.lastBoostTime > 500) {
                    this.lastBoostTime = Date.now();
                    if (this.bodyMat && this.bodyMat.emissiveColor) {
                        const originalEmissive = this.bodyMat.emissiveColor.clone();
                        this.bodyMat.emissiveColor = new BABYLON.Color3(0, 1, 0);
                        setTimeout(() => { this.bodyMat.emissiveColor = originalEmissive; }, 200);
                    }
                }
            }
        }

        const maxRPM = this.turboActive ? 8000 : 6000;
        const currentMaxSpeed = this.turboActive ? this.turboMaxSpeed : effectiveMaxSpeed;
        const speedRatio = Math.abs(this.currentSpeed) / currentMaxSpeed;
        gameState.rpm = Math.floor(800 + speedRatio * (maxRPM - 800));

        const absSpeed = Math.abs(gameState.speed);
        if (this.isReversing) {
            gameState.gear = 'R';
        } else if (absSpeed < 1) {
            gameState.gear = 'N';
        } else if (absSpeed < 30) {
            gameState.gear = '1';
        } else if (absSpeed < 60) {
            gameState.gear = '2';
        } else if (absSpeed < 90) {
            gameState.gear = '3';
        } else if (absSpeed < 120) {
            gameState.gear = '4';
        } else {
            gameState.gear = '5';
        }

        const forwardInput = this.input.forward || (gamepadState.isConnected && gamepadState.acceleration > 0.1);
        const backwardInput = this.input.backward || (gamepadState.isConnected && gamepadState.brake > 0.1);
        const rawSteerInput = (this.input.left ? -1 : 0) + (this.input.right ? 1 : 0) + (gamepadState.isConnected ? gamepadState.steer : 0);
        const handbrakeInput = this.input.handbrake || (gamepadState.isConnected && gamepadState.handbrake);
        const turboInput = this.input.turbo || (gamepadState.isConnected && gamepadState.turbo);

        // Improved steering with minimum speed threshold and better speed scaling
        const currentSpeedAbs = Math.abs(this.currentSpeed);
        
        // No steering below minimum speed (prevents weird stationary turning)
        if (currentSpeedAbs < this.minSteerSpeed) {
            this.targetSteerAngle = 0;
        } else {
            // Gradual speed-based reduction with smoother curve
            const speedFactor = Math.max(0.4, 1 - Math.pow(currentSpeedAbs / this.maxSpeed, 0.7) * 0.6);
            this.targetSteerAngle = rawSteerInput * this.maxSteerAngle * speedFactor;
        }
        
        // Much smoother steering interpolation
        const steerLerpFactor = Math.min(1, deltaTime * this.steeringSmoothness);
        this.steerAngle = BABYLON.Scalar.Lerp(this.steerAngle, this.targetSteerAngle, steerLerpFactor);

        // Gentler counter-steering that only activates during significant drifts
        if (this.isDrifting && Math.abs(localVelocity.x) > 5) {
            const counterSteerAmount = -Math.sign(localVelocity.x) * 0.15 * this.counterSteerStrength;
            this.steerAngle = BABYLON.Scalar.Lerp(this.steerAngle, this.steerAngle + counterSteerAmount, deltaTime * 2);
        }

        this.wheels.forEach(wheel => {
            if (wheel.isFront) {
                wheel.mesh.rotation.y = this.steerAngle;
                wheel.rim.rotation.y = this.steerAngle;
            }
            wheel.mesh.rotation.x += this.currentSpeed * deltaTime * 2;
            wheel.rim.rotation.x += this.currentSpeed * deltaTime * 2;
        });

        if (this.isGrounded) {
            const forward = this.chassis.getDirection(BABYLON.Vector3.Forward());
            const right = this.chassis.getDirection(BABYLON.Vector3.Right());
            const currentAcceleration = this.turboActive ? this.turboAcceleration : effectiveAcceleration;

            // Check car orientation - only allow acceleration if reasonably upright
            const up = this.chassis.up;
            const uprightDot = BABYLON.Vector3.Dot(up, BABYLON.Vector3.Up());
            const isUpright = uprightDot > 0.5; // Car must be at least 60 degrees from upside down

            if (forwardInput && !handbrakeInput && isUpright) {
                const throttle = gamepadState.isConnected ? gamepadState.acceleration : 1;
                if (this.currentSpeed < currentMaxSpeed) {
                    // Scale acceleration based on how upright the car is
                    const orientationMultiplier = Math.max(0.1, uprightDot);
                    const impulse = forward.scale(currentAcceleration * 1000 * deltaTime * throttle * orientationMultiplier);
                    body.applyImpulse(impulse, this.chassis.getAbsolutePosition());
                }
                this.isReversing = false;
            }

            if (backwardInput && isUpright) {
                const brake = gamepadState.isConnected ? gamepadState.brake : 1;
                if (this.currentSpeed > 1) {
                    const impulse = forward.scale(-this.brakeForce * 1000 * deltaTime * brake);
                    body.applyImpulse(impulse, this.chassis.getAbsolutePosition());
                    this.isReversing = false;
                } else if (this.currentSpeed > -this.maxSpeed * 0.3) {
                    const orientationMultiplier = Math.max(0.1, uprightDot);
                    const impulse = forward.scale(-this.acceleration * 500 * deltaTime * brake * orientationMultiplier);
                    body.applyImpulse(impulse, this.chassis.getAbsolutePosition());
                    this.isReversing = true;
                }
            }

            if (Math.abs(this.steerAngle) > 0.01 && Math.abs(this.currentSpeed) > 0.5) {
                const lateralVelocity = localVelocity.x;
                const forwardVelocity = Math.abs(localVelocity.z);
                const slipAngle = forwardVelocity > 1 ? Math.abs(lateralVelocity / forwardVelocity) : 0;
                
                this.isDrifting = handbrakeInput || (slipAngle > this.driftThreshold && Math.abs(this.currentSpeed) > 15);

                // Smoother torque application with better speed scaling
                const speedMultiplier = Math.min(Math.abs(this.currentSpeed), 30);
                const baseTorque = this.steerAngle * speedMultiplier * 6000;
                const driftMultiplier = this.isDrifting ? 0.7 : 1.0;
                const steerTorque = baseTorque * driftMultiplier;
                
                // Apply torque more gradually
                const torqueApplication = Math.min(1, deltaTime * 30);
                body.applyAngularImpulse(new BABYLON.Vector3(0, steerTorque * deltaTime * torqueApplication, 0));

                const gripStrength = handbrakeInput ? 
                    this.lateralGripStrength * 0.3 : 
                    this.lateralGripStrength * this.wheelFriction;
                
                const gripFactor = handbrakeInput ? 1 : Math.pow(1 - Math.min(slipAngle, 1), 2);
                const lateralImpulse = right.scale(-lateralVelocity * gripStrength * gripFactor * deltaTime);
                body.applyImpulse(lateralImpulse, this.chassis.getAbsolutePosition());
                
                if (this.isDrifting) {
                    const driftDrag = forward.scale(-Math.sign(localVelocity.z) * Math.abs(lateralVelocity) * 200 * deltaTime);
                    body.applyImpulse(driftDrag, this.chassis.getAbsolutePosition());
                }
            } else {
                this.isDrifting = false;
                const lateralVelocity = localVelocity.x;
                const stabilizationForce = right.scale(-lateralVelocity * this.lateralGripStrength * 1.5 * deltaTime);
                body.applyImpulse(stabilizationForce, this.chassis.getAbsolutePosition());
            }
        } else {
            // Significantly reduced air control to prevent spinning
            const angularVelocity = body.getAngularVelocity();
            
            // Only allow minimal steering if not already spinning
            if (Math.abs(this.steerAngle) > 0.01 && Math.abs(angularVelocity.y) < 1) {
                const airTorque = this.steerAngle * 500 * this.airControlFactor;
                body.applyAngularImpulse(new BABYLON.Vector3(0, airTorque * deltaTime, 0));
            }
            
            // Air stabilization - actively counter unwanted rotation
            const stabilizationTorque = angularVelocity.scale(-50 * deltaTime);
            body.applyAngularImpulse(stabilizationTorque);
            
            // Pitch control only when moving forward/backward
            if ((forwardInput || backwardInput) && Math.abs(angularVelocity.x) < 2) {
                const pitchDirection = forwardInput ? -1 : 1;
                body.applyAngularImpulse(new BABYLON.Vector3(pitchDirection * 500 * deltaTime, 0, 0));
            }
        }

        if (handbrakeInput) {
            body.setLinearDamping(3.5);
            body.setAngularDamping(3.5);
            this.isDrifting = true;
        } else {
            const speedDamping = this.isGrounded ? 
                0.5 + (Math.abs(this.currentSpeed) / this.maxSpeed) * 0.2 : 
                0.3;
            body.setLinearDamping(speedDamping);
            // Higher angular damping to reduce unwanted rotation
            body.setAngularDamping(this.isGrounded ? 3.0 : 1.5);
        }

        if (Math.abs(this.currentSpeed) > 15 && this.isGrounded) {
            const downforceStrength = Math.pow(Math.abs(this.currentSpeed) / this.maxSpeed, 1.5);
            const downforceImpulse = new BABYLON.Vector3(0, -downforceStrength * 800 * deltaTime, 0);
            body.applyImpulse(downforceImpulse, this.chassis.getAbsolutePosition());
        }

        if (!this.isGrounded) {
            const gravityMultiplier = velocity.y < 0 ? 1.5 : 1.0;
            const extraGravityImpulse = new BABYLON.Vector3(0, -800 * gravityMultiplier * deltaTime, 0);
            body.applyImpulse(extraGravityImpulse, this.chassis.getAbsolutePosition());
            
            const airDrag = velocity.scale(-0.8 * deltaTime);
            body.applyImpulse(airDrag, this.chassis.getAbsolutePosition());
        }

        if (this.isGrounded && forwardInput && Math.abs(this.currentSpeed) < 5) {
            const traction = velocity.scale(-0.3 * deltaTime);
            body.applyImpulse(traction, this.chassis.getAbsolutePosition());
        }

        this.input.turbo = turboInput;
        multiplayerManager.updateMyState(this.chassis.position, this.chassis.rotationQuaternion, gameState.carColor, gameState.vehicleType);
    }

    updateTurbo(deltaTime) {
        const turboIndicator = document.getElementById('turboIndicator');
        
        // Check car orientation - turbo only works when upright
        const up = this.chassis.up;
        const uprightDot = BABYLON.Vector3.Dot(up, BABYLON.Vector3.Up());
        const isUpright = uprightDot > 0.5;

        if (this.input.turbo && this.turboCharge > 0 && !this.turboCooldown && this.isGrounded && isUpright) {
            if (!this.turboActive && this.sounds && this.sounds.turbo && this.sounds.turbo.isReady()) {
                this.sounds.turbo.play();
            }
            this.turboActive = true;
            this.turboCharge = Math.max(0, this.turboCharge - this.turboDrainRate * deltaTime);

            this.turboFlames.forEach(flame => flame.isVisible = true);

            turboIndicator.textContent = `TURBO ${Math.floor(this.turboCharge)}%`;
            turboIndicator.className = 'turbo-indicator turbo-active';

            gameState.score += Math.floor(gameState.speed / 10);

            if (this.turboCharge <= 0) {
                this.turboCooldown = true;
                this.turboActive = false;
            }
        } else {
            if (this.turboActive && this.sounds && this.sounds.turbo && this.sounds.turbo.isPlaying) {
                this.sounds.turbo.stop();
            }
            this.turboActive = false;
            this.turboFlames.forEach(flame => flame.isVisible = false);

            if (this.turboCharge < 100) {
                this.turboCharge = Math.min(100, this.turboCharge + this.turboRechargeRate * deltaTime);
            }

            if (this.turboCooldown) {
                if (this.turboCharge >= 30) {
                    this.turboCooldown = false;
                }
                turboIndicator.textContent = `COOLING ${Math.floor(this.turboCharge)}%`;
                turboIndicator.className = 'turbo-indicator turbo-cooldown';
            } else {
                turboIndicator.textContent = `TURBO ${Math.floor(this.turboCharge)}%`;
                turboIndicator.className = 'turbo-indicator turbo-ready';
            }
        }

        gameState.turboCharge = this.turboCharge;
        gameState.turboActive = this.turboActive;
        gameState.turboCooldown = this.turboCooldown;
    }

    reset() {
        const config = VEHICLE_CONFIGS[this.vehicleType];
        this.chassis.position = this.startPoint.add(new BABYLON.Vector3(0, config.chassisSize.height / 2 + 0.5, 0));
        if (this.trackPoints.length > 1) {
            const direction = this.trackPoints[1].subtract(this.startPoint);
            this.chassis.rotationQuaternion = BABYLON.Quaternion.FromLookDirectionLH(direction.normalize(), BABYLON.Vector3.Up());
        } else {
            this.chassis.rotationQuaternion = BABYLON.Quaternion.Identity();
        }
        this.chassisAggregate.body.setLinearVelocity(BABYLON.Vector3.Zero());
        this.chassisAggregate.body.setAngularVelocity(BABYLON.Vector3.Zero());
        this.currentSpeed = 0;
        this.steerAngle = 0;
        this.turboCharge = 100;
        this.turboActive = false;
        this.turboCooldown = false;
        this.health = 100;
        gameState.health = 100;

        if (this.sounds) {
            if (this.sounds.skid && this.sounds.skid.isPlaying) this.sounds.skid.stop();
            if (this.sounds.turbo && this.sounds.turbo.isPlaying) this.sounds.turbo.stop();
        }

        if (this.smokeParticleSystem) {
            this.smokeParticleSystem.stop();
            this.smokeParticleSystem.dispose();
            this.smokeParticleSystem = null;
        }

        for (const partName in this.deformableParts) {
            const part = this.deformableParts[partName];
            const initialState = this.initialPartStates[partName];
            const initialVertices = this.initialVertexData[partName];

            if (initialVertices) {
                part.updateVerticesData(BABYLON.VertexBuffer.PositionKind, initialVertices, false, false);
            }

            if (initialState) {
                part.position.copyFrom(initialState.position);
                part.rotationQuaternion.copyFrom(initialState.rotationQuaternion);
                part.scaling.copyFrom(initialState.scaling);
            }
        }
    }

    dispose() {
        if (this.sounds) {
            for (const key in this.sounds) {
                if (this.sounds[key]) {
                    this.sounds[key].dispose();
                }
            }
            this.sounds = null;
        }

        if (this.smokeParticleSystem) {
            this.smokeParticleSystem.stop();
            this.smokeParticleSystem.dispose();
        }

        if (this.chassisAggregate) {
            this.chassisAggregate.dispose();
        }
    }
}
