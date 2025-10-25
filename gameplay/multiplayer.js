// Multiplayer System
class MultiplayerManager {
    constructor() {
        this.peer = null;
        this.hostId = null;
        this.myId = null;
        this.isHost = false;
        this.syncTimer = 0;

        // Connections, separated by type for different communication patterns
        this.reliableConnections = new Map();
        this.unreliableConnections = new Map();

        this.remotePlayers = new Map(); // Visual representation of other players

        // Host-specific state management
        this.playerStates = new Map(); // Authoritative list of all player states on the host

        // My own state, to be sent to the host
        this.myState = {
            p: { x: 0, y: 0, z: 0 }, // position
            r: { x: 0, y: 0, z: 0, w: 1 }, // rotation
            name: gameState.playerName,
            color: gameState.carColor,
            vehicle: gameState.vehicleType
        };
    }

    generateRoomCode() {
        return Math.random().toString(36).substring(2, 6).toUpperCase();
    }

    init(isHosting, roomCode = null) {
        this.isHost = isHosting;
        gameState.isHost = isHosting;
        const peerId = isHosting ? this.generateRoomCode() : undefined;

        if (this.peer) this.peer.destroy();

        this.peer = new Peer(peerId, {
            host: '0.peerjs.com', port: 443, path: '/', secure: true, debug: 2,
            config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }] }
        });

        this.peer.on('open', (id) => {
            console.log(`PeerJS open. My ID: ${id}. Is host: ${this.isHost}`);
            this.myId = id;
            this.myState.name = gameState.playerName; // Ensure name is up-to-date

            if (this.isHost) {
                document.getElementById('roomCode').textContent = id;
                document.getElementById('roomCode').style.display = 'block';
                this.updateConnectionStatus(`Hosting: ${id}`, 'connected');
                this.playerStates.set(this.myId, this.myState); // Host adds itself to the state
            } else {
                this.hostId = roomCode;
                // Establish two connections: one for reliable events, one for unreliable state
                const reliableConn = this.peer.connect(this.hostId, { reliable: true, label: 'reliable' });
                const unreliableConn = this.peer.connect(this.hostId, { reliable: false, label: 'unreliable' });
                this._setupConnectionHandlers(reliableConn);
                this._setupConnectionHandlers(unreliableConn);
                this.updateConnectionStatus('Connecting...', 'connecting');
            }
            this.updatePlayersList();
        });

        this.peer.on('connection', (conn) => {
            console.log(`Incoming connection from ${conn.peer} with label ${conn.label}`);
            if (this.isHost) {
                this._setupConnectionHandlers(conn);
            }
        });

        this.peer.on('error', (err) => {
            console.error(`PeerJS error: ${err.type}`, err);
            this.updateConnectionStatus(`Error: ${err.type}`, 'disconnected');
        });
    }

    _setupConnectionHandlers(conn) {
        conn.on('open', () => {
            console.log(`Connection [${conn.label}] opened with ${conn.peer}`);
            const connMap = conn.reliable ? this.reliableConnections : this.unreliableConnections;
            connMap.set(conn.peer, conn);

            // Client initiates the join sequence once the reliable channel is open
            if (!this.isHost && conn.reliable) {
                this._sendMessage(conn, 'C_JOIN', this.myState);
                this.updateConnectionStatus('Connected', 'connected');
            }
        });

        conn.on('data', (data) => {
            // Route data to different handlers based on reliability
            if (conn.reliable) {
                this._handleReliableData(conn.peer, data.type, data.payload);
            } else {
                this._handleUnreliableData(conn.peer, data.type, data.payload);
            }
        });

        conn.on('close', () => {
            console.log(`Connection [${conn.label}] closed with ${conn.peer}`);
            this.reliableConnections.delete(conn.peer);
            this.unreliableConnections.delete(conn.peer);

            if (this.isHost) {
                this.playerStates.delete(conn.peer);
                this.broadcastReliable('S_PLAYER_LEFT', { id: conn.peer });
            }

            this.removeRemotePlayer(conn.peer);
            this.updatePlayersList();

            if (!this.isHost && conn.peer === this.hostId) {
                this.updateConnectionStatus('Disconnected from host', 'disconnected');
                // Clear all remote players on disconnect from host
                this.remotePlayers.forEach((player, id) => this.removeRemotePlayer(id));
            }
        });
    }

    _handleReliableData(peerId, type, payload) {
        if (this.isHost) {
            switch (type) {
                case 'C_JOIN':
                    console.log(`[HOST] ${payload.name} (${peerId}) joining.`);
                    this.playerStates.set(peerId, payload);
                    // Welcome the new player with the current game state
                    this._sendMessage(this.reliableConnections.get(peerId), 'S_WELCOME', { players: Object.fromEntries(this.playerStates) });
                    // Inform other players of the new arrival
                    this.broadcastReliable('S_PLAYER_JOINED', { id: peerId, state: payload }, peerId);
                    this.createRemotePlayer(peerId, payload);
                    this.updatePlayersList();
                    break;
                case 'C_EVENT': // e.g., vehicle or color change
                    const playerState = this.playerStates.get(peerId);
                    if (playerState) {
                        Object.assign(playerState, payload);
                        this.broadcastReliable('S_PLAYER_EVENT', { id: peerId, event: payload });
                        if (payload.vehicle) this.updateRemotePlayerVehicle(peerId, playerState);
                        if (payload.color) this.updateRemotePlayerColor(peerId, payload.color);
                    }
                    break;
            }
        } else { // Client
            switch (type) {
                case 'S_WELCOME':
                    console.log('[CLIENT] Welcome from host. Initializing players.');
                    this.updateFullPlayerState(payload.players);
                    break;
                case 'S_PLAYER_JOINED':
                    console.log(`[CLIENT] Player ${payload.state.name} joined.`);
                    if (!this.remotePlayers.has(payload.id) && payload.id !== this.myId) {
                        this.createRemotePlayer(payload.id, payload.state);
                    }
                    break;
                case 'S_PLAYER_LEFT':
                    console.log(`[CLIENT] Player ${payload.id} left.`);
                    this.removeRemotePlayer(payload.id);
                    break;
                case 'S_PLAYER_EVENT':
                    const player = this.remotePlayers.get(payload.id);
                    if (player) {
                        if (payload.event.vehicle !== undefined) {
                            const currentPos = player.mesh.getAbsolutePosition();
                            const currentRot = player.mesh.rotationQuaternion;
                            const newState = {
                                p: { x: currentPos.x, y: currentPos.y, z: currentPos.z },
                                r: { x: currentRot.x, y: currentRot.y, z: currentRot.z, w: currentRot.w },
                                name: player.name,
                                color: payload.event.color || player.color,
                                vehicle: payload.event.vehicle,
                            };
                            this.updateRemotePlayerVehicle(payload.id, newState);
                        } else if (payload.event.color !== undefined) {
                            this.updateRemotePlayerColor(payload.id, payload.event.color);
                        }
                    }
                    break;
            }
            this.updatePlayersList();
        }
    }

    _handleUnreliableData(peerId, type, payload) {
        if (this.isHost) {
            if (type === 'C_MY_STATE') {
                const playerState = this.playerStates.get(peerId);
                if (playerState) {
                    playerState.p = payload.p;
                    playerState.r = payload.r;
                    // Visually update the remote player on the host's screen
                    this.updateRemotePlayer(peerId, payload);
                }
            }
        } else { // Client
            if (type === 'S_GAME_STATE') {
                this.updateGameState(payload);
            }
        }
    }

    tick(deltaTime) {
        this.syncTimer += deltaTime * 1000;
        if (this.syncTimer >= SYNC_INTERVAL) {
            this.syncTimer = 0;
            if (this.isHost) {
                this.playerStates.set(this.myId, this.myState); // Update host's own state
                this.broadcastUnreliable('S_GAME_STATE', {
                    players: Object.fromEntries(this.playerStates),
                    dynamic: dynamicObjects.map(obj => ({
                        id: obj.mesh.name,
                        p: [obj.mesh.position.x, obj.mesh.position.y, obj.mesh.position.z],
                        r: [obj.mesh.rotationQuaternion.x, obj.mesh.rotationQuaternion.y, obj.mesh.rotationQuaternion.z, obj.mesh.rotationQuaternion.w]
                    }))
                });
            } else if (this.unreliableConnections.has(this.hostId)) {
                this._sendMessage(this.unreliableConnections.get(this.hostId), 'C_MY_STATE', this.myState);
            }
        }
    }

    updateRemotePlayers(deltaTime) {
        const lerpSpeed = 15; // A higher value for quicker catch-up
        this.remotePlayers.forEach(player => {
            if (player.targetPosition && player.mesh && player.mesh.position) {
                // Interpolate mesh transform
                player.mesh.position = BABYLON.Vector3.Lerp(player.mesh.position, player.targetPosition, deltaTime * lerpSpeed);
                player.mesh.rotationQuaternion = BABYLON.Quaternion.Slerp(player.mesh.rotationQuaternion, player.targetRotation, deltaTime * lerpSpeed);

                // Update kinematic physics body
                if (player.aggregate && player.aggregate.body) {
                    player.aggregate.body.setTargetTransform(player.mesh.position, player.mesh.rotationQuaternion);
                }
            }
        });
    }

    updateGameState(state) {
        // Update players from the state
        for (const id in state.players) {
            if (id === this.myId) continue; // NEVER update my own car from the server state

            const data = state.players[id];
            const player = this.remotePlayers.get(id);

            if (player) {
                this.updateRemotePlayer(id, data);
            }
        }
        this.updateDynamicObjects(state.dynamic);
    }

    updateFullPlayerState(players) {
        const allPlayerIds = Object.keys(players);

        // Remove stale players
        this.remotePlayers.forEach((player, id) => {
            if (!allPlayerIds.includes(id)) {
                this.removeRemotePlayer(id);
            }
        });

        // Add or update players
        for (const id in players) {
            if (id === this.myId) continue;
            if (!this.remotePlayers.has(id)) {
                this.createRemotePlayer(id, players[id]);
            }
        }
    }

    updateMyState(position, rotation, color, vehicle) {
        let eventPayload = {};
        if (this.myState.color !== color) {
            this.myState.color = color;
            eventPayload.color = color;
        }
        if (this.myState.vehicle !== vehicle) {
            this.myState.vehicle = vehicle;
            eventPayload.vehicle = vehicle;
        }

        if (Object.keys(eventPayload).length > 0 && !this.isHost && this.reliableConnections.has(this.hostId)) {
            this._sendMessage(this.reliableConnections.get(this.hostId), 'C_EVENT', eventPayload);
        } else if (Object.keys(eventPayload).length > 0 && this.isHost) {
            // Host updates its state and broadcasts the change
            const myState = this.playerStates.get(this.myId);
            if (myState) Object.assign(myState, eventPayload);
            this.broadcastReliable('S_PLAYER_EVENT', { id: this.myId, event: eventPayload });
        }

        this.myState.p = { x: position.x, y: position.y, z: position.z };
        this.myState.r = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
    }

    createRemotePlayer(id, data) {
        if (!scene || this.remotePlayers.has(id)) return;
        console.log(`[MP] Creating remote player ${data.name} (${id}) with vehicle ${data.vehicle}`);
        const config = VEHICLE_CONFIGS[data.vehicle];
        const chassis = BABYLON.MeshBuilder.CreateBox(`${id}_chassis`, config.chassisSize, scene);
        chassis.position = new BABYLON.Vector3(data.p.x, data.p.y, data.p.z);
        chassis.rotationQuaternion = new BABYLON.Quaternion(data.r.x, data.r.y, data.r.z, data.r.w);
        chassis.isVisible = false;

        const aggregate = new BABYLON.PhysicsAggregate(chassis, BABYLON.PhysicsShapeType.BOX, { mass: config.mass, motionType: BABYLON.PhysicsMotionType.KINEMATIC }, scene);

        const modelData = createCarModel(scene, null, data.color, data.vehicle);
        modelData.carGroup.parent = chassis;
        modelData.carGroup.position.y = config.modelYOffset;

        this.remotePlayers.set(id, { id, mesh: chassis, name: data.name, vehicle: data.vehicle, color: data.color, model: modelData, aggregate: aggregate });
    }

    updateRemotePlayer(id, data) {
        const player = this.remotePlayers.get(id);
        if (player && player.mesh) {
            // If this is the first network update for this player, snap to position.
            if (!player.targetPosition) {
                player.mesh.position.set(data.p.x, data.p.y, data.p.z);
                if (player.mesh.rotationQuaternion) {
                    player.mesh.rotationQuaternion.set(data.r.x, data.r.y, data.r.z, data.r.w);
                }
            }
            // Set target for interpolation in the render loop.
            player.targetPosition = new BABYLON.Vector3(data.p.x, data.p.y, data.p.z);
            player.targetRotation = new BABYLON.Quaternion(data.r.x, data.r.y, data.r.z, data.r.w);
        }
    }

    updateRemotePlayerVehicle(id, data) {
        this.removeRemotePlayer(id);
        this.createRemotePlayer(id, data);
    }

    updateRemotePlayerColor(id, color) {
        const player = this.remotePlayers.get(id);
        if (!player || !player.model || !player.model.bodyMat) return;

        player.color = color;
        if (player.model.bodyMat.albedoColor) {
            player.model.bodyMat.albedoColor = BABYLON.Color3.FromHexString(color);
        }
    }

    removeRemotePlayer(id) {
        const player = this.remotePlayers.get(id);
        if (player) {
            if (player.aggregate) {
                player.aggregate.dispose(); // This disposes the mesh too
            } else if (player.mesh) {
                player.mesh.dispose();
            }
        }
        this.remotePlayers.delete(id);
    }

    _sendMessage(conn, type, payload) {
        if (conn && conn.open) conn.send({ type, payload });
    }

    broadcastReliable(type, payload, excludeId = null) {
        this.reliableConnections.forEach((conn, id) => {
            if (id !== excludeId) this._sendMessage(conn, type, payload);
        });
    }

    broadcastUnreliable(type, payload) {
        this.unreliableConnections.forEach(conn => this._sendMessage(conn, type, payload));
    }

    updatePlayersList() {
        const listEl = document.getElementById('playersList');
        let html = '<div style="margin-top:5px;font-size:12px;">';
        const playersToDisplay = new Map();

        // Build display list based on role
        if (this.isHost) {
            // The host's state is the source of truth
            this.playerStates.forEach((state, id) => playersToDisplay.set(id, state));
        } else {
            // Clients see themselves + remote players
            playersToDisplay.set(this.myId, { name: this.myState.name });
            this.remotePlayers.forEach((player, id) => playersToDisplay.set(id, player));
        }

        html += `<h4>Players (${playersToDisplay.size})</h4>`;
        playersToDisplay.forEach((player, id) => {
            let suffix = '';
            if (id === this.myId) suffix = ' (You)';
            if (this.isHost && id === this.myId) suffix += ' (Host)';
            else if (!this.isHost && id === this.hostId) suffix = ' (Host)';

            html += `<div>👤 ${player.name}${suffix}</div>`;
        });

        listEl.innerHTML = html;
    }

    updateConnectionStatus(message, status) {
        document.getElementById('connectionStatus').textContent = message;
        document.getElementById('connectionStatus').className = 'status-' + status;
    }

    updateDynamicObjects(states) {
        if (!states) return;
        states.forEach(state => {
            const mesh = scene.getMeshByName(state.id);
            if (mesh) {
                const targetPos = new BABYLON.Vector3(state.p[0], state.p[1], state.p[2]);
                const targetRot = new BABYLON.Quaternion(state.r[0], state.r[1], state.r[2], state.r[3]);
                mesh.position = BABYLON.Vector3.Lerp(mesh.position, targetPos, 0.5);
                mesh.rotationQuaternion = BABYLON.Quaternion.Slerp(mesh.rotationQuaternion, targetRot, 0.5);
            }
        });
    }
}
