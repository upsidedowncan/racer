function createRacetrackIslandMap(scene, shadowGenerator, glowLayer) {
    // Ground and Water with style
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.4);
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 600, height: 600 }, scene);
    ground.material = groundMat;
    ground.receiveShadows = true;
    new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene);

    const waterMat = new BABYLON.StandardMaterial("waterMat", scene);
    waterMat.diffuseColor = new BABYLON.Color3(0.1, 0.3, 0.7);
    waterMat.alpha = 0.7;
    const water = BABYLON.MeshBuilder.CreateGround("water", { width: 1200, height: 1200 }, scene);
    water.position.y = -3;
    water.material = waterMat;

    // Main Epic Racetrack with dramatic features
    const trackPoints = [];
    const radius = 120;
    for (let i = 0; i <= 120; i++) {
        const angle = (i / 120) * Math.PI * 2;
        const x = Math.cos(angle) * radius * (1 + 0.5 * Math.sin(angle * 2));
        const z = Math.sin(angle) * radius * (1 + 0.3 * Math.cos(angle * 3));
        let y = 2;
        
        // Add dramatic elevation changes
        if (i > 25 && i < 35) y = 2 + (i - 25) * 3; // Climb
        else if (i >= 35 && i < 50) y = 32 + Math.sin((i - 35) / 15 * Math.PI * 2) * 5; // Wavy section
        else if (i >= 50 && i < 65) y = 32 - (i - 50) * 2; // Steep descent
        else if (i > 80 && i < 90) y = 2 + Math.sin((i - 80) / 10 * Math.PI) * 20; // Jump section
        
        trackPoints.push(new BABYLON.Vector3(x, y, z));
    }
    trackPoints.push(trackPoints[0]);

    const trackWidth = 25;
    const path3d = new BABYLON.Path3D(trackPoints);
    const binormals = path3d.getBinormals();

    const leftPath = trackPoints.map((p, i) => p.add(binormals[i].scale(-trackWidth / 2)));
    const rightPath = trackPoints.map((p, i) => p.add(binormals[i].scale(trackWidth / 2)));

    const ribbon = BABYLON.MeshBuilder.CreateRibbon("track", { pathArray: [leftPath, rightPath], closeArray: false }, scene);
    const trackMat = new BABYLON.StandardMaterial("trackMat", scene);
    trackMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.25);
    trackMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    ribbon.material = trackMat;
    ribbon.receiveShadows = true;
    new BABYLON.PhysicsAggregate(ribbon, BABYLON.PhysicsShapeType.MESH, { mass: 0, friction: 1.2 }, scene);
    shadowGenerator.addShadowCaster(ribbon);

    // MEGA JUMP RAMPS
    const rampMat = new BABYLON.StandardMaterial("rampMat", scene);
    rampMat.diffuseColor = new BABYLON.Color3(0.9, 0.2, 0.2);
    rampMat.emissiveColor = new BABYLON.Color3(0.3, 0.05, 0.05);
    
    const rampPositions = [
        { pos: new BABYLON.Vector3(-100, 2, -100), rot: 0.6, scale: 1.5 },
        { pos: new BABYLON.Vector3(120, 2, 0), rot: -0.5, scale: 1.2 },
        { pos: new BABYLON.Vector3(0, 2, 130), rot: 0.4, scale: 1.8 },
    ];

    rampPositions.forEach((rp, idx) => {
        const ramp = BABYLON.MeshBuilder.CreateBox(`megaRamp${idx}`, { width: 30, height: 2, depth: 40 }, scene);
        ramp.position = rp.pos;
        ramp.rotation.x = -rp.rot;
        ramp.scaling = new BABYLON.Vector3(rp.scale, 1, rp.scale);
        ramp.material = rampMat;
        new BABYLON.PhysicsAggregate(ramp, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, scene);
        shadowGenerator.addShadowCaster(ramp);
    });

    // HALF-PIPE
    const halfPipe = BABYLON.MeshBuilder.CreateCylinder("halfPipe", { 
        height: 60, 
        diameter: 40, 
        tessellation: 32,
        arc: 0.5 
    }, scene);
    halfPipe.position = new BABYLON.Vector3(-150, 20, 50);
    halfPipe.rotation.z = Math.PI / 2;
    const pipeMat = new BABYLON.StandardMaterial("pipeMat", scene);
    pipeMat.diffuseColor = new BABYLON.Color3(0.3, 0.5, 0.8);
    halfPipe.material = pipeMat;
    new BABYLON.PhysicsAggregate(halfPipe, BABYLON.PhysicsShapeType.MESH, { mass: 0, friction: 0.4 }, scene);
    shadowGenerator.addShadowCaster(halfPipe);

    // LOOP-DE-LOOP
    const loopPoints = [];
    const loopRadius = 25;
    for (let i = 0; i <= 32; i++) {
        const angle = (i / 32) * Math.PI * 2;
        loopPoints.push(new BABYLON.Vector3(
            Math.cos(angle) * loopRadius,
            Math.sin(angle) * loopRadius + loopRadius,
            0
        ));
    }
    
    const loopPath3d = new BABYLON.Path3D(loopPoints);
    const loopBinormals = loopPath3d.getBinormals();
    const loopLeft = loopPoints.map((p, i) => p.add(loopBinormals[i].scale(-10)));
    const loopRight = loopPoints.map((p, i) => p.add(loopBinormals[i].scale(10)));
    
    const loop = BABYLON.MeshBuilder.CreateRibbon("loop", { 
        pathArray: [loopLeft, loopRight], 
        closeArray: true 
    }, scene);
    loop.position = new BABYLON.Vector3(80, 2, -120);
    const loopMat = new BABYLON.StandardMaterial("loopMat", scene);
    loopMat.diffuseColor = new BABYLON.Color3(0.8, 0.6, 0.2);
    loopMat.emissiveColor = new BABYLON.Color3(0.2, 0.15, 0.05);
    loop.material = loopMat;
    new BABYLON.PhysicsAggregate(loop, BABYLON.PhysicsShapeType.MESH, { mass: 0, friction: 1.5 }, scene);
    shadowGenerator.addShadowCaster(loop);

    // Add physics objects
    const crateMat = new BABYLON.StandardMaterial("crateMat", scene);
    crateMat.diffuseTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/crate.png", scene);

    // Track physics interactions for multiplayer sync
    const setupPhysicsSync = (mesh, aggregate) => {
        if (aggregate && aggregate.body) {
            // Mark when object is affected by forces
            aggregate.body.setCollisionCallbackEnabled(true);
            mesh.metadata = mesh.metadata || {};
            mesh.metadata.needsSync = false;
            
            // Flag object for sync when it experiences collision
            aggregate.body.getCollisionObservable().add((collision) => {
                mesh.metadata.needsSync = true;
                mesh.metadata.syncTimer = 0;
            });
        }
    };

    for (let level = 0; level < 8; level++) {
        for (let x = 0; x < 5; x++) {
            for (let z = 0; z < 5; z++) {
                const box = BABYLON.MeshBuilder.CreateBox(`box${level}_${x}_${z}`, { size: 4 }, scene);
                box.material = crateMat;
                box.position = new BABYLON.Vector3(
                    -50 + x * 4.1,
                    3 + level * 4.1,
                    50 + z * 4.1
                );
                shadowGenerator.addShadowCaster(box);
                const agg = new BABYLON.PhysicsAggregate(box, BABYLON.PhysicsShapeType.BOX, { mass: 15 }, scene);
                setupPhysicsSync(box, agg);
                dynamicObjects.push({ mesh: box, aggregate: agg });
            }
        }
    }

    const barrelMat = new BABYLON.StandardMaterial("barrelMat", scene);
    barrelMat.diffuseColor = new BABYLON.Color3(0.9, 0.3, 0.1);
    barrelMat.emissiveColor = new BABYLON.Color3(0.3, 0.1, 0.0);
    
    const barrelSpots = [
        { x: 100, z: 100 }, { x: -120, z: -80 }, { x: 60, z: -100 },
        { x: -80, z: 120 }, { x: 140, z: -60 }, { x: -140, z: 0 },
        { x: 0, z: 150 }, { x: 100, z: -140 }
    ];

    barrelSpots.forEach((spot, i) => {
        for (let j = 0; j < 5; j++) {
            const barrel = BABYLON.MeshBuilder.CreateCylinder(`barrel${i}_${j}`, { 
                height: 6, 
                diameter: 4 
            }, scene);
            barrel.material = barrelMat;
            barrel.position = new BABYLON.Vector3(
                spot.x + (Math.random() - 0.5) * 15,
                3 + j * 6.5,
                spot.z + (Math.random() - 0.5) * 15
            );
            shadowGenerator.addShadowCaster(barrel);
            const agg = new BABYLON.PhysicsAggregate(barrel, BABYLON.PhysicsShapeType.CYLINDER, { mass: 25 }, scene);
            setupPhysicsSync(barrel, agg);
            dynamicObjects.push({ mesh: barrel, aggregate: agg });
        }
    });

    const dominoMat = new BABYLON.StandardMaterial("dominoMat", scene);
    dominoMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    dominoMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    
    for (let i = 0; i < 15; i++) {
        const domino = BABYLON.MeshBuilder.CreateBox(`domino${i}`, { 
            width: 12, 
            height: 20, 
            depth: 2 
        }, scene);
        domino.material = dominoMat;
        domino.position = new BABYLON.Vector3(
            -180 + i * 13,
            10,
            -150
        );
        shadowGenerator.addShadowCaster(domino);
        const agg = new BABYLON.PhysicsAggregate(domino, BABYLON.PhysicsShapeType.BOX, { mass: 100 }, scene);
        setupPhysicsSync(domino, agg);
        dynamicObjects.push({ mesh: domino, aggregate: agg });
    }

    const ballMat = new BABYLON.StandardMaterial("ballMat", scene);
    ballMat.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.7);
    ballMat.metallic = 0.9;
    
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const x = Math.cos(angle) * 180;
        const z = Math.sin(angle) * 180;
        
        const anchor = BABYLON.MeshBuilder.CreateBox(`anchor${i}`, { size: 3 }, scene);
        anchor.position = new BABYLON.Vector3(x, 50, z);
        anchor.visibility = 0.3;
        new BABYLON.PhysicsAggregate(anchor, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, scene);
        
        const ball = BABYLON.MeshBuilder.CreateSphere(`wreckingBall${i}`, { diameter: 12 }, scene);
        ball.material = ballMat;
        ball.position = new BABYLON.Vector3(x, 15, z);
        shadowGenerator.addShadowCaster(ball);
        const ballAgg = new BABYLON.PhysicsAggregate(ball, BABYLON.PhysicsShapeType.SPHERE, { mass: 200 }, scene);
        setupPhysicsSync(ball, ballAgg);
        dynamicObjects.push({ mesh: ball, aggregate: ballAgg });
        
        // Add initial swing
        ballAgg.body.applyImpulse(
            new BABYLON.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).scale(500),
            ball.position
        );
    }

    // BOUNCE PADS
    const bounceMat = new BABYLON.StandardMaterial("bounceMat", scene);
    bounceMat.diffuseColor = new BABYLON.Color3(0.2, 0.9, 0.3);
    bounceMat.emissiveColor = new BABYLON.Color3(0.1, 0.4, 0.1);
    
    const bouncePositions = [
        new BABYLON.Vector3(50, 2, 80),
        new BABYLON.Vector3(-70, 2, -50),
        new BABYLON.Vector3(130, 2, -130)
    ];

    bouncePositions.forEach((pos, i) => {
        const pad = BABYLON.MeshBuilder.CreateCylinder(`bouncePad${i}`, { 
            height: 2, 
            diameter: 20 
        }, scene);
        pad.position = pos;
        pad.material = bounceMat;
        new BABYLON.PhysicsAggregate(pad, BABYLON.PhysicsShapeType.CYLINDER, { 
            mass: 0, 
            restitution: 2.5 
        }, scene);
        shadowGenerator.addShadowCaster(pad);
        
        if (glowLayer) {
            glowLayer.addIncludedOnlyMesh(pad);
        }
    });

    const sphereMat = new BABYLON.StandardMaterial("sphereMat", scene);
    sphereMat.diffuseColor = new BABYLON.Color3(0.7, 0.2, 0.8);
    
    for (let i = 0; i < 8; i++) {
        const sphere = BABYLON.MeshBuilder.CreateSphere(`sphere${i}`, { diameter: 10 }, scene);
        sphere.material = sphereMat;
        sphere.position = new BABYLON.Vector3(
            (Math.random() - 0.5) * 200,
            20,
            (Math.random() - 0.5) * 200
        );
        shadowGenerator.addShadowCaster(sphere);
        const agg = new BABYLON.PhysicsAggregate(sphere, BABYLON.PhysicsShapeType.SPHERE, { 
            mass: 80,
            restitution: 0.9 
        }, scene);
        setupPhysicsSync(sphere, agg);
        dynamicObjects.push({ mesh: sphere, aggregate: agg });
    }

    // PILLARS TO WEAVE THROUGH
    const pillarMat = new BABYLON.StandardMaterial("pillarMat", scene);
    pillarMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.6);
    
    for (let i = 0; i < 12; i++) {
        const pillar = BABYLON.MeshBuilder.CreateCylinder(`pillar${i}`, { 
            height: 40, 
            diameter: 6 
        }, scene);
        pillar.material = pillarMat;
        const angle = (i / 12) * Math.PI * 2;
        pillar.position = new BABYLON.Vector3(
            Math.cos(angle) * 70,
            20,
            Math.sin(angle) * 70
        );
        new BABYLON.PhysicsAggregate(pillar, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0 }, scene);
        shadowGenerator.addShadowCaster(pillar);
    }

    // Return multiple spawn points for multiplayer - spawn on flat ground near track
    const spawnPoints = [];
    for (let i = 0; i < 8; i++) {
        spawnPoints.push(new BABYLON.Vector3(
            (i - 3.5) * 8,
            10,
            -200
        ));
    }
    
    return spawnPoints;
}