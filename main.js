const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 8;

const cameraOffset = new THREE.Vector3(0, 5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setClearColor(0x87ceeb);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// Slightly lower exposure so bloom doesn't wash out colors
renderer.toneMappingExposure = 1.0;
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// ============ POST-PROCESSING SETUP ============
const composer = new THREE.EffectComposer(renderer);
const renderPass = new THREE.RenderPass(scene, camera);
composer.addPass(renderPass);

// Bloom effect for glowing objects (lava, collectibles, etc.)
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.55,  // bloom strength (lower so colors stay punchy)
    0.35,  // radius
    0.88   // threshold (slightly higher: glow only on brightest parts)
);
composer.addPass(bloomPass);

// ============ FOG SETUP ============
scene.fog = new THREE.FogExp2(0x87ceeb, 0.008); // Exponential fog for depth

// ============ VFX SYSTEM ============
const VFX = {
    particles: [],
    ambientParticles: null,
    waterCaustics: [],
    
    // Camera shake parameters
    cameraShake: {
        intensity: 0,
        duration: 0,
        elapsed: 0,
        originalPosition: new THREE.Vector3()
    },
    
    // Speed lines container
    speedLines: null,
    speedLinesVisible: false,
    
    // Initialize ambient floating particles
    initAmbientParticles: function() {
        const particleCount = 200;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 1] = Math.random() * 50;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
            velocities.push({
                x: (Math.random() - 0.5) * 0.02,
                y: (Math.random() - 0.5) * 0.01,
                z: (Math.random() - 0.5) * 0.02
            });
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.15,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        
        this.ambientParticles = new THREE.Points(geometry, material);
        this.ambientParticles.userData.velocities = velocities;
        scene.add(this.ambientParticles);
    },
    
    // Create dust burst on landing
    createLandingDust: function(position, intensity = 1) {
        const particleCount = 15 * intensity;
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 0.1 + Math.random() * 0.15;
            this.particles.push({
                mesh: this.createParticleMesh(0xccaa88, 0.1 + Math.random() * 0.1),
                position: position.clone().add(new THREE.Vector3(0, 0.1, 0)),
                velocity: new THREE.Vector3(
                    Math.cos(angle) * speed,
                    0.05 + Math.random() * 0.1,
                    Math.sin(angle) * speed
                ),
                life: 1.0,
                decay: 0.02 + Math.random() * 0.02,
                gravity: -0.005
            });
        }
    },
    
    // Create water splash
    createWaterSplash: function(position) {
        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            this.particles.push({
                mesh: this.createParticleMesh(0x4488ff, 0.15),
                position: position.clone(),
                velocity: new THREE.Vector3(
                    Math.cos(angle) * (0.1 + Math.random() * 0.1),
                    0.2 + Math.random() * 0.3,
                    Math.sin(angle) * (0.1 + Math.random() * 0.1)
                ),
                life: 1.0,
                decay: 0.025,
                gravity: -0.015
            });
        }
    },
    
    // Create lava ember particles
    createLavaEmbers: function(position) {
        const particleCount = 25;
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                mesh: this.createParticleMesh(0xff4400, 0.1, true),
                position: position.clone(),
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.3,
                    0.3 + Math.random() * 0.4,
                    (Math.random() - 0.5) * 0.3
                ),
                life: 1.0,
                decay: 0.015,
                gravity: -0.008
            });
        }
    },
    
    // Create collection sparkle
    createCollectionSparkle: function(position) {
        const particleCount = 30;
        for (let i = 0; i < particleCount; i++) {
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.random() * Math.PI;
            const speed = 0.15 + Math.random() * 0.2;
            this.particles.push({
                mesh: this.createParticleMesh(0xffd700, 0.12, true),
                position: position.clone(),
                velocity: new THREE.Vector3(
                    Math.sin(theta) * Math.cos(phi) * speed,
                    Math.sin(theta) * Math.sin(phi) * speed,
                    Math.cos(theta) * speed
                ),
                life: 1.0,
                decay: 0.02,
                gravity: -0.002
            });
        }
    },
    
    // Create damage flash particles
    createDamageParticles: function(position) {
        const particleCount = 15;
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                mesh: this.createParticleMesh(0xff0000, 0.15, true),
                position: position.clone(),
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.4,
                    (Math.random() - 0.5) * 0.4,
                    (Math.random() - 0.5) * 0.4
                ),
                life: 1.0,
                decay: 0.04,
                gravity: 0
            });
        }
    },
    
    // Helper to create particle mesh
    createParticleMesh: function(color, size, emissive = false) {
        const geometry = new THREE.SphereGeometry(size, 6, 6);
        let material;
        if (emissive) {
            // Use MeshStandardMaterial for emissive particles
            material = new THREE.MeshStandardMaterial({
                color: color,
                transparent: true,
                opacity: 1,
                emissive: new THREE.Color(color),
                emissiveIntensity: 1
            });
        } else {
            material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 1
            });
        }
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        return mesh;
    },
    
    // Trigger camera shake
    shakeCamera: function(intensity, duration) {
        this.cameraShake.intensity = intensity;
        this.cameraShake.duration = duration;
        this.cameraShake.elapsed = 0;
        this.cameraShake.originalPosition.copy(camera.position);
    },
    
    // Update all particles and effects
    update: function(delta) {
        // Update ambient particles
        if (this.ambientParticles && player) {
            const positions = this.ambientParticles.geometry.attributes.position.array;
            const velocities = this.ambientParticles.userData.velocities;
            
            for (let i = 0; i < positions.length / 3; i++) {
                positions[i * 3] += velocities[i].x;
                positions[i * 3 + 1] += velocities[i].y;
                positions[i * 3 + 2] += velocities[i].z;
                
                // Keep particles near player
                const dx = positions[i * 3] - player.position.x;
                const dz = positions[i * 3 + 2] - player.position.z;
                if (Math.abs(dx) > 50) positions[i * 3] = player.position.x + (Math.random() - 0.5) * 100;
                if (Math.abs(dz) > 50) positions[i * 3 + 2] = player.position.z + (Math.random() - 0.5) * 100;
                if (positions[i * 3 + 1] > 50 || positions[i * 3 + 1] < 0) {
                    positions[i * 3 + 1] = Math.random() * 50;
                }
            }
            this.ambientParticles.geometry.attributes.position.needsUpdate = true;
        }
        
        // Update burst particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.velocity.y += p.gravity;
            p.position.add(p.velocity);
            p.life -= p.decay;
            
            p.mesh.position.copy(p.position);
            p.mesh.material.opacity = p.life;
            p.mesh.scale.setScalar(p.life);
            
            if (p.life <= 0) {
                scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.particles.splice(i, 1);
            }
        }
        
        // Update camera shake
        if (this.cameraShake.duration > 0) {
            this.cameraShake.elapsed += delta;
            if (this.cameraShake.elapsed < this.cameraShake.duration) {
                const progress = this.cameraShake.elapsed / this.cameraShake.duration;
                const diminish = 1 - progress;
                const shakeX = (Math.random() - 0.5) * this.cameraShake.intensity * diminish;
                const shakeY = (Math.random() - 0.5) * this.cameraShake.intensity * diminish;
                camera.position.x += shakeX;
                camera.position.y += shakeY;
            } else {
                this.cameraShake.duration = 0;
            }
        }
    },
    
    // Clean up all particles
    cleanup: function() {
        for (const p of this.particles) {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
        }
        this.particles = [];
    }
};

// Player point light for better local illumination
let playerLight = null;

// Water reflection system
const waterReflectionCameras = [];

const gravity = new THREE.Vector3(0, -35, 0); // Example gravity vector
const velocity = new THREE.Vector3(0, 5, 0);

const clock = new THREE.Clock();

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5); // Sky color, ground color, intensity
scene.add(hemiLight);

const light_1 = new THREE.DirectionalLight(0xffffff, 1);
light_1.castShadow = true;

light_1.shadow.mapSize.width = 2048; // Increase for better quality
light_1.shadow.mapSize.height = 2048;
light_1.position.set(50, 50, 0);
light_1.target = new THREE.Object3D();
scene.add(light_1.target);
scene.add(light_1);

// Rim light for player silhouette
const rimLight = new THREE.DirectionalLight(0x8888ff, 0.3);
rimLight.position.set(-20, 30, -20);
scene.add(rimLight);

const mic = new THREE.AudioListener();
camera.add(mic);

// Audio mute state (persisted to localStorage)
let musicMuted = false;
let soundMuted = false;
let musicWasPlaying = false; // used to remember if music was playing when muting

function saveAudioSettings() {
    try {
        localStorage.setItem('musicMuted', musicMuted ? '1' : '0');
        localStorage.setItem('soundMuted', soundMuted ? '1' : '0');
    } catch (e) {
        console.warn('Could not save audio settings', e);
    }
}

function loadAudioSettings() {
    try {
        const m = localStorage.getItem('musicMuted');
        const s = localStorage.getItem('soundMuted');
        musicMuted = (m === '1');
        soundMuted = (s === '1');
    } catch (e) {
        console.warn('Could not load audio settings', e);
    }

    // Apply loaded settings
    applyMusicMuted(musicMuted);
    applySoundMuted(soundMuted);
}

function applyMusicMuted(muted) {
    musicMuted = !!muted;
    // If muting, pause any currently playing track and remember it
    if (musicMuted) {
        if (currentSong && music[currentSong] && !music[currentSong].paused) {
            musicWasPlaying = true;
            music[currentSong].pause();
        }
    } else {
        // If unmuting, resume previously playing song
        if (musicWasPlaying && currentSong && music[currentSong]) {
            music[currentSong].play();
        }
        musicWasPlaying = false;
    }
    // Also set muted flag on the audio elements so any playback is silent
    for (const k in music) {
        try { music[k].muted = musicMuted; } catch(e){}
    }
    saveAudioSettings();
    updateAudioButtons();
}

function applySoundMuted(muted) {
    soundMuted = !!muted;
    // Walk all created positional/three audio objects and set their volume to 0 or restore
    function handleItem(item) {
        if (!item) return;
        if (Array.isArray(item)) {
            item.forEach(handleItem);
            return;
        }
        if (item.sound && typeof item.sound.setVolume === 'function') {
            // If the audioData stored a defaultVolume value, use it when unmuting
            const defaultVol = item.defaultVolume != null ? item.defaultVolume : 0.5;
            try { item.sound.setVolume(soundMuted ? 0 : defaultVol); } catch (e) {}
            return;
        }
        // Otherwise iterate object properties
        for (const k in item) {
            if (Object.prototype.hasOwnProperty.call(item, k)) {
                handleItem(item[k]);
            }
        }
    }

    for (const p of World.players) {
        if (p && p.audio) handleItem(p.audio);
    }

    saveAudioSettings();
    updateAudioButtons();
}

function toggleMusicMuted() { applyMusicMuted(!musicMuted); }
function toggleSoundMuted() { applySoundMuted(!soundMuted); }

// Create simple audio toggle buttons in the DOM
function addAudioToggleButtons() {
    // container
    const container = document.createElement('div');
    container.className = 'audio-controls';
    container.style.position = 'fixed';
    container.style.top = '10px';
    container.style.right = '10px';
    container.style.zIndex = '200';
    container.style.display = 'flex';
    container.style.gap = '8px';

    const musicBtn = document.createElement('button');
    musicBtn.id = 'music-toggle';
    musicBtn.className = 'audio-toggle';
    musicBtn.type = 'button';
    musicBtn.addEventListener('click', () => { toggleMusicMuted(); });

    const soundBtn = document.createElement('button');
    soundBtn.id = 'sound-toggle';
    soundBtn.className = 'audio-toggle';
    soundBtn.type = 'button';
    soundBtn.addEventListener('click', () => { toggleSoundMuted(); });

    container.appendChild(musicBtn);
    container.appendChild(soundBtn);
    document.body.appendChild(container);

    updateAudioButtons();
}

function updateAudioButtons() {
    const musicBtn = document.getElementById('music-toggle');
    const soundBtn = document.getElementById('sound-toggle');
    if (musicBtn) {
        musicBtn.textContent = musicMuted ? 'Music: Off' : 'Music: On';
        if (musicMuted) musicBtn.classList.add('muted'); else musicBtn.classList.remove('muted');
        musicBtn.title = musicMuted ? 'Unmute music' : 'Mute music';
    }
    if (soundBtn) {
        soundBtn.textContent = soundMuted ? 'Sound: Off' : 'Sound: On';
        if (soundMuted) soundBtn.classList.add('muted'); else soundBtn.classList.remove('muted');
        soundBtn.title = soundMuted ? 'Unmute sound effects' : 'Mute sound effects';
    }
}


let player;
let playerBox;

let keyState = {};
let isGrounded = false;
let paused = true;
let victory = false;

// Debug mode
let debugMode = false;
let debugWireframes = []; // Store debug wireframe objects

const World = {
    players: [],
    obstacles: [],
    water: [],
    lava: [],
    collectibles: [],

    addCollectible: function (x, y, z, isGoal = false) {
        let collectible = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ 
                color: isGoal ? 0x00ff88 : 0xFFD700,
                metalness: 1,
                roughness: 0.1,
                emissive: isGoal ? 0x00ff88 : 0xFFD700,
                emissiveIntensity: isGoal ? 0.8 : 0.4
            })
        );
        collectible.position.set(x, y, z);
        collectible.rotation.y = 0;
        collectible.castShadow = true;
        collectible.receiveShadow = true;

        collectible.isGoal = isGoal;
        
        // Add point light for glow effect
        const glowLight = new THREE.PointLight(isGoal ? 0x00ff88 : 0xffd700, 0.5, 5);
        glowLight.position.set(0, 0, 0);
        collectible.add(glowLight);
        
        // Store size for debug wireframes
        collectible.userData.size = { width: 1, height: 1, depth: 1 };
        
        // Add floating animation
        collectible.baseY = y;
        collectible.animationTime = Math.random() * Math.PI * 2; // Random start phase

        this.collectibles.push(collectible);
        scene.add(collectible);
    },

    addPlayer: function (color, x, y, z, rotation) {
        // Slightly more saturated/brighter player base color
        const playerColor = new THREE.Color(color).convertSRGBToLinear().multiplyScalar(1.15).convertLinearToSRGB();

        let player = new THREE.Mesh(
            new THREE.BoxGeometry(1.3, 1.3, 1.3),
            new THREE.MeshStandardMaterial({ 
                color: playerColor,
                transparent: true,
                opacity: 0,
                depthWrite: false
            })
        );
        player.position.set(x, y, z);
        player.rotation.y = rotation;
        // player.castShadow = true;
        // player.receiveShadow = true;

        // Assemble the player's body.
        let torso = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.8, 0.5),
            new THREE.MeshStandardMaterial({ color: playerColor })
        )
        torso.position.set(0, .5, 0);
        torso.castShadow = true;
        torso.receiveShadow = true;
        player.add(torso);

        let neck = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.2, 0.2),
            new THREE.MeshStandardMaterial({ color: 0xffd875 })
        )
        neck.position.set(0, 0.4, 0);
        neck.castShadow = true;
        neck.receiveShadow = true;
        torso.add(neck);

        let head = new THREE.Mesh(
            new THREE.BoxGeometry(1, 0.8, 0.8),
            new THREE.MeshStandardMaterial({ color: 0xffd875 })
        )
        head.position.set(0, 0.5, 0);
        head.castShadow = true;
        head.receiveShadow = true;
        neck.add(head);

        let leftArm = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.1, 0.1),
            new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
        )
        leftArm.position.set(-0.4, 0.4, 0);
        torso.add(leftArm);

        let rightArm = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.1, 0.1),
            new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
        )
        rightArm.position.set(0.4, 0.4, 0);
        torso.add(rightArm);

        let leftLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.1, 0.1),
            new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
        )
        leftLeg.position.set(-0.1, -0.4, 0);
        torso.add(leftLeg);

        let rightLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.1, 0.1),
            new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
        )
        rightLeg.position.set(0.1, -0.4, 0);
        torso.add(rightLeg);



        player.BlockBody = {
            torso: torso,
            neck: neck,
            head: head,
            leftArm: leftArm,
            rightArm: rightArm,
            leftLeg: leftLeg,
            rightLeg: rightLeg
        }



        let rightSleve = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.7, 0.2),
            new THREE.MeshStandardMaterial({ color: playerColor })
        )
        rightSleve.position.set(0, -0.3, 0);
        rightSleve.castShadow = true;
        rightSleve.receiveShadow = true;
        rightArm.add(rightSleve);

        let leftSleve = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.7, 0.2),
            new THREE.MeshStandardMaterial({ color: playerColor })
        )
        leftSleve.position.set(0, -0.3, 0);
        leftSleve.castShadow = true;
        leftSleve.receiveShadow = true;
        leftArm.add(leftSleve);

        let rightBoot = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.7, 0.3),
            new THREE.MeshStandardMaterial({ color: playerColor })
        )
        rightBoot.position.set(0, -0.3, 0);
        rightBoot.castShadow = true;
        rightBoot.receiveShadow = true;
        rightLeg.add(rightBoot);

        let leftBoot = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.7, 0.3),
            new THREE.MeshStandardMaterial({ color: playerColor })
        )
        leftBoot.position.set(0, -0.3, 0);
        leftBoot.castShadow = true;
        leftBoot.receiveShadow = true;
        leftLeg.add(leftBoot);

        // Animation
        player.animation = {};
        player.animation.current = "walk";
        player.animation.currentFrame = 0;
        player.animation.frameDuration = 0;
        player.damageAnimation = null;

        // Player state
        player.inWater = false;        // Player properties
        player.alive = true;
        player.health = 100;
        player.damageCooldown = 0;
        player.backFlipping = false;
        player.victoryDance = false;
        player.victoryStartTime = 0;
        player.victoryPhase = 0;
        player.lives = 3;

        // Player Audio
        player.audio = {
            "Mario": {
                "fall": [newAudio("Audio/Character/Mario/Fall.mp3", player), newAudio("Audio/Character/Mario/Fall2.mp3", player), newAudio("Audio/Character/Mario/Fall3.mp3", player), newAudio("Audio/Character/Mario/Fall4.mp3", player)],
                "burn": newAudio("Audio/Character/Mario/Burn.mp3", player),
                "backflip": [newAudio("Audio/Character/Mario/Backflip.mp3", player), newAudio("Audio/Character/Mario/Backflip2.mp3", player), newAudio("Audio/Character/Mario/Backflip3.mp3", player)],
            },
            "SFX": {
                "jump": newAudio("Audio/SFX/Jump.mp3", player),
                "superJump": newAudio("Audio/SFX/SuperJump.mp3", player),
                "fire": newAudio("Audio/SFX/Fire.mp3", player),
            }
        };


        // Store size and offset for OBB collision
        player.userData.size = { width: 0.8, height: 2.2, depth: 0.8 };
        player.userData.offset = { x: 0, y: 0.6, z: 0 };

        this.players.push(player);
        scene.add(player);
    },

    addObstacle: function (color, x, y, z, width, height, depth, rotation) {
        // Boost saturation/brightness so blocks stay colorful under bloom/fog
        const baseColor = new THREE.Color(color).convertSRGBToLinear().multiplyScalar(1.2).convertLinearToSRGB();

        let obstacle = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            new THREE.MeshStandardMaterial({ 
                color: baseColor,
                metalness: 0.2,
                roughness: 0.4
            })
        );
        obstacle.position.set(x, y, z);
        obstacle.rotation.y = rotation;
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;

        // Store size for OBB collision
        obstacle.userData.size = { width: width, height: height, depth: depth };

        this.obstacles.push(obstacle);
        scene.add(obstacle);
    },

    addWater: function (color, x, y, z, width, height, depth) {
        // Richer water tint to stand out
        const waterColor = new THREE.Color(color).convertSRGBToLinear().multiplyScalar(1.25).convertLinearToSRGB();
        // Create a group to hold reflective surface and transparent volume
        const waterGroup = new THREE.Group();
        waterGroup.position.set(x, y, z);
        
        // ============ BLOCKY RIPPLE SURFACE ============
        // Create a subdivided plane for blocky ripples (low segment count = blocky look)
        const rippleSegmentsX = Math.max(2, Math.floor(width / 1.5));  // ~1.5 units per segment for blocky look
        const rippleSegmentsZ = Math.max(2, Math.floor(depth / 1.5));
        const rippleGeometry = new THREE.PlaneGeometry(width, depth, rippleSegmentsX, rippleSegmentsZ);
        
        // Store original Y positions for animation
        const positions = rippleGeometry.attributes.position.array;
        const originalY = new Float32Array(positions.length / 3);
        for (let i = 0; i < positions.length / 3; i++) {
            originalY[i] = positions[i * 3 + 2]; // Z is "up" before rotation
        }
        rippleGeometry.userData.originalY = originalY;
        
        // Create a slightly transparent ripple surface material
        const rippleMaterial = new THREE.MeshStandardMaterial({
            color: waterColor,
            transparent: true,
            opacity: 0.35,
            // metalness: 0.6,
            // roughness: 0.15,
            side: THREE.DoubleSide,
            flatShading: true  // Flat shading for blocky look
        });
        
        const rippleSurface = new THREE.Mesh(rippleGeometry, rippleMaterial);
        rippleSurface.rotation.x = -Math.PI / 2;
        rippleSurface.position.y = height / 2 + 0.02;
        rippleSurface.receiveShadow = true;
        rippleSurface.renderOrder = 3;
        waterGroup.add(rippleSurface);
        
        // ============ REFLECTOR WITH DISTORTION ============
        // Use similar subdivided geometry for reflector to bend reflections
        const reflectorGeometry = new THREE.PlaneGeometry(width, depth, rippleSegmentsX, rippleSegmentsZ);
        // Store original positions for reflector too
        const refPositions = reflectorGeometry.attributes.position.array;
        const refOriginalY = new Float32Array(refPositions.length / 3);
        for (let i = 0; i < refPositions.length / 3; i++) {
            refOriginalY[i] = refPositions[i * 3 + 2];
        }
        reflectorGeometry.userData.originalY = refOriginalY;
        
        const topReflector = new THREE.Reflector(reflectorGeometry, {
            clipBias: 0.003,
            textureWidth: 256,
            textureHeight: 256,
            color: waterColor
        });
        topReflector.rotation.x = -Math.PI / 2;
        topReflector.position.y = height / 2 + 0.001;

        // Make the reflector semi-transparent by modifying its shader
        topReflector.material.transparent = true;
        topReflector.material.depthWrite = false;
        topReflector.renderOrder = 2;
        
        // Patch the reflector shader to support opacity
        const reflectorOpacity = 0.35; // Adjust this value (0.0 = invisible, 1.0 = fully opaque)
        topReflector.material.onBeforeCompile = (shader) => {
            // Add opacity uniform
            shader.uniforms.reflectorOpacity = { value: reflectorOpacity };
            
            // Inject uniform declaration at the top of fragment shader
            shader.fragmentShader = 'uniform float reflectorOpacity;\n' + shader.fragmentShader;
            
            // Replace the final output to use our opacity
            shader.fragmentShader = shader.fragmentShader.replace(
                /gl_FragColor\s*=\s*vec4\s*\(\s*blendOverlay\s*\(\s*base\.rgb\s*,\s*color\s*\)\s*,\s*1\.0\s*\)\s*;/,
                'gl_FragColor = vec4( blendOverlay( base.rgb, color ), reflectorOpacity );'
            );
        };
        // Force material to recompile with new shader
        topReflector.material.needsUpdate = true;

        // Force the reflector's render target to be pixelated (nearest) and disable mipmaps
        try {
            const rt = (typeof topReflector.getRenderTarget === 'function') ? topReflector.getRenderTarget() : topReflector.renderTarget;
            if (rt && rt.texture) {
                const tex = rt.texture;
                tex.minFilter = THREE.NearestFilter;
                tex.magFilter = THREE.NearestFilter;
                tex.generateMipmaps = false;
                tex.encoding = THREE.sRGBEncoding;
            }
        } catch (e) {
            // ignore if the reflector implementation differs
        }

        waterGroup.add(topReflector);
        
        // Create very transparent volume for the water body
        const volumeMaterial = new THREE.MeshBasicMaterial({
            color: waterColor,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const volumeGeometry = new THREE.BoxGeometry(width, height, depth);
        const volume = new THREE.Mesh(volumeGeometry, volumeMaterial);
        volume.renderOrder = 1;
        waterGroup.add(volume);
        
        // Store references for animation
        waterGroup.userData.reflectors = [topReflector];
        waterGroup.userData.rippleSurface = rippleSurface;
        waterGroup.userData.volume = volume;
        waterGroup.userData.size = { width: width, height: height, depth: depth };
        waterGroup.userData.originalY = y;
        waterGroup.userData.animTime = Math.random() * Math.PI * 2; // Random phase offset
        
        // Add to reflection cameras array for potential updates
        waterReflectionCameras.push({ water: waterGroup, reflectors: waterGroup.userData.reflectors });

        this.water.push(waterGroup);
        scene.add(waterGroup);
    },

    addLava: function (color, x, y, z, width, height, depth) {
        // Punchier lava color/emission
        const lavaColor = new THREE.Color(color).convertSRGBToLinear().multiplyScalar(1.25).convertLinearToSRGB();

        let lava = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            new THREE.MeshStandardMaterial({ 
                color: lavaColor, 
                emissive: lavaColor, 
                emissiveIntensity: 2.4
            })
        );
        lava.position.set(x, y, z);
        
        // Store size for OBB collision/debug
        lava.userData.size = { width: width, height: height, depth: depth };
        
        // Lava point light for glow effect
        const lavaLight = new THREE.PointLight(lavaColor, 0.9, Math.max(width, depth) * 2);
        lavaLight.position.set(0, height / 2 + 0.5, 0);
        lava.add(lavaLight);
        
        // Animated lava surface
        lava.userData.animTime = Math.random() * Math.PI * 2;
        
        this.lava.push(lava);
        scene.add(lava);
    },

}

const music = {
    "blockCity": new Audio("Audio/Music/BlockWorld.mp3"),
    "enemyTowers": new Audio("Audio/Music/EnemyTowers.mp3"),
    "die": new Audio("Audio/Music/die.mp3"),
    "goal": new Audio("Audio/Music/Goal.mp3"),
    "gameOver": new Audio("Audio/Music/GameOver.mp3"),
}

var currentSong = null;

function applyGravity(deltaTime) {
    // Cap the maximum delta time to prevent huge jumps
    const maxDelta = 1/30; // maximum of 1/30th of a second
    deltaTime = Math.min(deltaTime, maxDelta);
    
    if (!isGrounded) {
        velocity.add(gravity.clone().multiplyScalar(deltaTime));
        
        // Cap the maximum fall speed
        const maxFallSpeed = -30;
        if (velocity.y < maxFallSpeed) {
            velocity.y = maxFallSpeed;
        }
    }
    
    player.position.add(velocity.clone().multiplyScalar(deltaTime));
    updateBoundingBox();
}

function calculateCameraRelativeMovement() {
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    right.crossVectors(forward, camera.up).normalize();

    // Update directional light position to follow player
    light_1.position.copy(player.position).add(new THREE.Vector3(50, 50, 0));
    light_1.target.position.copy(player.position);

    const cameraViewSize = 50; // Increased view size to cover more area
    light_1.shadow.camera.left = -cameraViewSize;
    light_1.shadow.camera.right = cameraViewSize;
    light_1.shadow.camera.top = cameraViewSize;
    light_1.shadow.camera.bottom = -cameraViewSize;
    light_1.shadow.camera.near = 1;
    light_1.shadow.camera.far = 200;
    light_1.shadow.camera.updateProjectionMatrix();
  

    const movement = new THREE.Vector3();

    if (keyState['w'] || keyState['ArrowUp']) movement.add(forward);
    if (keyState['s'] || keyState['ArrowDown']) movement.sub(forward);
    if (keyState['a'] || keyState['ArrowLeft']) movement.sub(right);
    if (keyState['d'] || keyState['ArrowRight']) movement.add(right);

    return movement.normalize();
}

function newAudio(src, parent, data = { distance: 12, loop: false, volume: 0.5, autoplay: false, playbackRate: 1, currentTime: 0 }) {
    const sound = new THREE.PositionalAudio(mic);
    const audioLoader = new THREE.AudioLoader();
    
    audioLoader.load(src, function(buffer) {
        sound.setBuffer(buffer);
        sound.setRefDistance(data.distance);
        sound.setVolume(data.volume);
        sound.setLoop(data.loop);
        sound.setPlaybackRate(data.playbackRate);

        parent.add(sound); // Attach sound to an object
        
        if (data.autoplay) {
            sound.play(data.currentTime); // Pass start time to play method
        }
    });

    const audioData = {
        sound: sound,
        defaultVolume: data.volume,
        play: function() {
            if (sound.isPlaying) {
                sound.stop();
            }
            // Respect global soundMuted
            if (!soundMuted) sound.play(data.currentTime);
        },
        pause: function() {
            sound.pause();
        }
    }

    // If the global soundMuted is already set, ensure newly-loaded audio starts muted
    if (soundMuted && typeof sound.setVolume === 'function') {
        try { sound.setVolume(0); } catch(e){}
    }

    return audioData;
}

function playMusic(song) {
    if (currentSong != null && music[currentSong].isPlaying) {
        music[currentSong].stop();
    }
    // Reset the current time to 0 before playing to ensure it starts from the beginning
    music[song].currentTime = 0;

    currentSong = song;
    music[song].play();
}

function stopMusic() {
    music[currentSong].pause();
}

function setPlayerPosition(x, y, z, rotation = 0) {
    player.position.set(x, y, z);
    player.rotation.y = rotation;
}

function setSkyColor(color) {
    scene.background = new THREE.Color(color);
    // Update fog color to match sky for seamless blending
    if (scene.fog) {
        scene.fog.color = new THREE.Color(color);
    }
    // Update renderer clear color
    renderer.setClearColor(color);
}

let currentLevel = "AI City 1";

function startGame() {
    if (!player) {
        // Create player only if it doesn't exist
        World.addPlayer(0x00ff00, 0, 5, 0, 0);
        player = World.players[0];
        playerBox = new THREE.Box3().setFromObject(player);
        
        // Create player point light for local illumination
        playerLight = new THREE.PointLight(0xffffcc, 0.3, 8);
        playerLight.position.set(0, 2, 0);
        player.add(playerLight);
    }
    
    // Initialize VFX system
    VFX.initAmbientParticles();
    
    // Then load the level which will set player position
    courses[currentLevel]();
    updateLifeCounter();
    animate();
}

const speed = 0.1;
const rotationSpeed = 0.5;

function updateBoundingBox() {
    playerBox.setFromObject(player);
}

function takeDamage(damage) {
    if(!player.alive || player.damageCooldown > 0) return;

    player.health -= damage;
    player.damageCooldown = 3; // Set cooldown to 1 second
    
    // VFX: Camera shake and damage particles
    VFX.shakeCamera(0.5, 0.3);
    VFX.createDamageParticles(player.position.clone().add(new THREE.Vector3(0, 1, 0)));
    
    if (player.health <= 0) {        player.alive = false;
        stopMusic();
        player.audio["Mario"].burn.pause();
        let index = Math.floor(Math.random() * player.audio["Mario"].fall.length);
        player.audio["Mario"].fall[index].play();
        setAnimation("abyss");
        
        // Bigger camera shake on death
        VFX.shakeCamera(1.0, 0.5);

        // Play death music after character sound
        setTimeout(() => {
            playMusic("die");
            handlePlayerDeath();
        }, 1000);
    }
}

// --- OBB (Oriented Bounding Box) Collision Helpers ---

// Build an OBB from a mesh with userData.size
function buildOBB(mesh) {
    mesh.updateMatrixWorld(true);
    
    const center = new THREE.Vector3();
    mesh.getWorldPosition(center);
    
    const q = new THREE.Quaternion();
    mesh.getWorldQuaternion(q);
    
    // If the mesh provides a local-space offset, rotate it into world space and apply
    if (mesh.userData && mesh.userData.offset) {
        const off = new THREE.Vector3(
            mesh.userData.offset.x || 0,
            mesh.userData.offset.y || 0,
            mesh.userData.offset.z || 0
        );
        off.applyQuaternion(q);
        center.add(off);
    }

    // Local axes transformed to world space
    const axes = [
        new THREE.Vector3(1, 0, 0).applyQuaternion(q).normalize(),
        new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize(),
        new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize()
    ];
    
    // Half-extents from stored size or fallback to geometry
    let half;
    if (mesh.userData && mesh.userData.size) {
        half = new THREE.Vector3(
            mesh.userData.size.width / 2,
            mesh.userData.size.height / 2,
            mesh.userData.size.depth / 2
        );
    } else {
        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        half = size.multiplyScalar(0.5);
    }
    
    return { center, axes, half };
}

// Create a wireframe box to visualize an OBB
function createOBBWireframe(obb, color = 0x00ff00) {
    const geometry = new THREE.BoxGeometry(obb.half.x * 2, obb.half.y * 2, obb.half.z * 2);
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, material);
    
    wireframe.position.copy(obb.center);
    
    // Apply rotation from OBB axes
    const rotMatrix = new THREE.Matrix4();
    rotMatrix.makeBasis(obb.axes[0], obb.axes[1], obb.axes[2]);
    wireframe.setRotationFromMatrix(rotMatrix);
    
    return wireframe;
}

// Clear all debug wireframes from the scene
function clearDebugWireframes() {
    for (const wireframe of debugWireframes) {
        scene.remove(wireframe);
        if (wireframe.geometry) wireframe.geometry.dispose();
        if (wireframe.material) wireframe.material.dispose();
    }
    debugWireframes = [];
}

// Update debug wireframes for all collidable objects
function updateDebugWireframes() {
    clearDebugWireframes();
    
    // Player wireframe (green)
    if (player) {
        const playerOBB = buildOBB(player);
        const playerWireframe = createOBBWireframe(playerOBB, 0x00ff00);
        scene.add(playerWireframe);
        debugWireframes.push(playerWireframe);
    }
    
    // Obstacle wireframes (white)
    for (const obstacle of World.obstacles) {
        const obb = buildOBB(obstacle);
        const wireframe = createOBBWireframe(obb, 0xffffff);
        scene.add(wireframe);
        debugWireframes.push(wireframe);
    }
    
    // Water wireframes (blue)
    for (const water of World.water) {
        const obb = buildOBB(water);
        const wireframe = createOBBWireframe(obb, 0x0088ff);
        scene.add(wireframe);
        debugWireframes.push(wireframe);
    }
    
    // Lava wireframes (orange/red)
    for (const lava of World.lava) {
        const obb = buildOBB(lava);
        const wireframe = createOBBWireframe(obb, 0xff4400);
        scene.add(wireframe);
        debugWireframes.push(wireframe);
    }
    
    // Collectible wireframes (gold)
    for (const collectible of World.collectibles) {
        const obb = buildOBB(collectible);
        const wireframe = createOBBWireframe(obb, 0xffd700);
        scene.add(wireframe);
        debugWireframes.push(wireframe);
    }
}

// SAT (Separating Axis Theorem) test for two OBBs
// Returns { intersect: bool, axis: Vector3, overlap: number }
function obbIntersect(a, b) {
    const EPSILON = 1e-6;
    
    // Rotation matrix expressing b in a's coordinate frame
    const R = [[0,0,0], [0,0,0], [0,0,0]];
    const AbsR = [[0,0,0], [0,0,0], [0,0,0]];
    
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            R[i][j] = a.axes[i].dot(b.axes[j]);
            AbsR[i][j] = Math.abs(R[i][j]) + EPSILON;
        }
    }
    
    // Translation vector from a to b in world coords, then in a's frame
    const tWorld = b.center.clone().sub(a.center);
    const t = [
        tWorld.dot(a.axes[0]),
        tWorld.dot(a.axes[1]),
        tWorld.dot(a.axes[2])
    ];
    
    let minOverlap = Infinity;
    let minAxis = new THREE.Vector3();
    
    // Test axes from A
    for (let i = 0; i < 3; i++) {
        const ra = a.half.getComponent(i);
        const rb = b.half.x * AbsR[i][0] + b.half.y * AbsR[i][1] + b.half.z * AbsR[i][2];
        const dist = Math.abs(t[i]);
        const overlap = (ra + rb) - dist;
        if (overlap < 0) return { intersect: false };
        if (overlap < minOverlap) {
            minOverlap = overlap;
            minAxis.copy(a.axes[i]).multiplyScalar(t[i] < 0 ? -1 : 1);
        }
    }
    
    // Test axes from B
    for (let j = 0; j < 3; j++) {
        const ra = a.half.x * AbsR[0][j] + a.half.y * AbsR[1][j] + a.half.z * AbsR[2][j];
        const rb = b.half.getComponent(j);
        const tProj = t[0] * R[0][j] + t[1] * R[1][j] + t[2] * R[2][j];
        const dist = Math.abs(tProj);
        const overlap = (ra + rb) - dist;
        if (overlap < 0) return { intersect: false };
        if (overlap < minOverlap) {
            minOverlap = overlap;
            minAxis.copy(b.axes[j]).multiplyScalar(tProj < 0 ? -1 : 1);
        }
    }
    
    // Test 9 cross-product axes
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            const axis = a.axes[i].clone().cross(b.axes[j]);
            const len = axis.length();
            if (len < EPSILON) continue; // Parallel axes, skip
            axis.normalize();
            
            // Project half-extents onto axis
            const ra = Math.abs(a.half.x * a.axes[0].dot(axis)) +
                       Math.abs(a.half.y * a.axes[1].dot(axis)) +
                       Math.abs(a.half.z * a.axes[2].dot(axis));
            const rb = Math.abs(b.half.x * b.axes[0].dot(axis)) +
                       Math.abs(b.half.y * b.axes[1].dot(axis)) +
                       Math.abs(b.half.z * b.axes[2].dot(axis));
            const tProj = Math.abs(tWorld.dot(axis));
            const overlap = (ra + rb) - tProj;
            if (overlap < 0) return { intersect: false };
            if (overlap < minOverlap) {
                minOverlap = overlap;
                // Direction: push player away from obstacle
                minAxis.copy(axis).multiplyScalar(tWorld.dot(axis) < 0 ? -1 : 1);
            }
        }
    }
    
    return { intersect: true, axis: minAxis, overlap: minOverlap };
}

function checkCollisions(lastPosition) {   
    let onGround = false;
    let inWater = false;
    
    // Use iterative collision resolution to prevent clipping
    const maxIterations = 8;
    
    for (let iter = 0; iter < maxIterations; iter++) {
        let collisionFound = false;
        
        for (const obstacle of World.obstacles) {
            const obbPlayer = buildOBB(player);
            const obbObstacle = buildOBB(obstacle);
            
            const result = obbIntersect(obbPlayer, obbObstacle);
            
            if (result.intersect) {
                collisionFound = true;
                
                // Calculate push direction (from obstacle to player)
                const pushDir = player.position.clone().sub(obstacle.position);
                
                // Ensure we push in the correct direction
                let push = result.axis.clone().multiplyScalar(result.overlap + 0.01);
                if (pushDir.dot(push) < 0) {
                    push.negate();
                }
                
                // Apply push to resolve collision
                player.position.add(push);
                
                // Check if this is a ground collision (strong Y component and player was above)
                const pushNorm = push.clone().normalize();
                if (Math.abs(pushNorm.y) > 0.5) {
                    if (lastPosition.y > obstacle.position.y) {
                        // Landing on top
                        onGround = true;
                        if (velocity.y < 0) velocity.y = 0;
                    } else {
                        // Hit from below
                        if (velocity.y > 0) velocity.y = 0;
                    }
                } else {
                    // Side collision - stop horizontal velocity in push direction
                    const hPush = new THREE.Vector3(push.x, 0, push.z).normalize();
                    const velH = new THREE.Vector3(velocity.x, 0, velocity.z);
                    const dot = velH.dot(hPush);
                    if (dot < 0) {
                        velocity.x -= hPush.x * dot;
                        velocity.z -= hPush.z * dot;
                    }
                }
                
                updateBoundingBox();
            }
        }
        
        // If no collision this iteration, we're done
        if (!collisionFound) break;
    }
    
    // Ground probe: check if player is very close to standing on something
    // This prevents the "jittering" when resting on a surface
    if (!onGround && velocity.y <= 0) {
        const probeDistance = 0.05; // Small distance to check below player
        const probedPlayerPos = player.position.clone();
        probedPlayerPos.y -= probeDistance;
        
        // Temporarily move player down to probe
        const originalY = player.position.y;
        player.position.y = probedPlayerPos.y;
        
        for (const obstacle of World.obstacles) {
            const obbPlayer = buildOBB(player);
            const obbObstacle = buildOBB(obstacle);
            const result = obbIntersect(obbPlayer, obbObstacle);
            
            if (result.intersect) {
                // Check if this would be a ground collision
                const pushNorm = result.axis.clone().normalize();
                if (Math.abs(pushNorm.y) > 0.5 && lastPosition.y > obstacle.position.y) {
                    onGround = true;
                    velocity.y = 0;
                    break;
                }
            }
        }
        
        // Restore player position
        player.position.y = originalY;
    }
    
    for (const water of World.water) {    
        const waterBox = new THREE.Box3().setFromObject(water);
        if (playerBox.intersectsBox(waterBox)) {
            inWater = true;
            break;
        }
    }
    for (const lava of World.lava) {
        const lavaBox = new THREE.Box3().setFromObject(lava);
        if (playerBox.intersectsBox(lavaBox)) {

            player.position.y += 0.5;
            velocity.y = 20;
            if(player.alive){
                player.damageAnimation = "burn";
                player.audio["Mario"].burn.play();
            }
            player.audio.SFX.fire.play();
            
            // VFX: Lava ember particles
            VFX.createLavaEmbers(player.position.clone());

            takeDamage(20);
            
            break;
        }
    }
    isGrounded = onGround;
    player.inWater = inWater;
}

function setAnimation(animationName) {
    if (player.animation.current != animationName) {
        console.log(animationName);

        player.animation.current = animationName;
        player.animation.currentFrame = 0;
        player.animation.frameDuration = 0;
    }
}

// Animation methods
function applyFrameRotation(part, rotationData) {
    part.rotation.set(rotationData.x, rotationData.y, rotationData.z);
}
function applyFrameTranslation(part, translationData) {
    part.position.set(translationData.x, translationData.y, translationData.z);
}

function animate() {    if(player.position.y < -10 && player.alive){
        player.alive = false;
        stopMusic();
        let index = Math.floor(Math.random() * player.audio["Mario"].fall.length);
        player.audio["Mario"].fall[index].play();
        setAnimation("abyss");
        
        // Play death music after character sound
        setTimeout(() => {
            playMusic("die");
            handlePlayerDeath();
        }, 1000);
    }
    
    // Track previous grounded state for landing detection
    const wasGrounded = isGrounded;
    const wasInWater = player ? player.inWater : false;
    
    if (!paused && player.alive && !victory) {
        let delta = clock.getDelta();
        
        // Planar reflections are updated automatically by the Reflector
        
        // Animate lava surfaces (pulsing glow)
        for (const lava of World.lava) {
            if (lava.userData.animTime !== undefined) {
                lava.userData.animTime += delta;
                lava.material.emissiveIntensity = 1.5 + Math.sin(lava.userData.animTime * 3) * 0.5;
            }
        }
        
        // ============ ANIMATE WATER RIPPLES ============
        for (const water of World.water) {
            if (water.userData.animTime !== undefined) {
                water.userData.animTime += delta;
                const time = water.userData.animTime;
                
                // Animate ripple surface
                const rippleSurface = water.userData.rippleSurface;
                if (rippleSurface && rippleSurface.geometry) {
                    const positions = rippleSurface.geometry.attributes.position.array;
                    const originalY = rippleSurface.geometry.userData.originalY;
                    const segX = rippleSurface.geometry.parameters.widthSegments + 1;
                    const segZ = rippleSurface.geometry.parameters.heightSegments + 1;
                    
                    for (let i = 0; i < positions.length / 3; i++) {
                        const ix = i % segX;
                        const iz = Math.floor(i / segX);
                        const px = positions[i * 3];
                        const pz = positions[i * 3 + 1];
                        
                        // Create blocky stepped ripples using floor/quantization
                        const wave1 = Math.sin(px * 0.8 + time * 2.0) * Math.cos(pz * 0.6 + time * 1.5);
                        const wave2 = Math.sin(px * 1.2 - time * 1.8 + pz * 0.4) * 0.5;
                        const combinedWave = wave1 + wave2;
                        
                        // Quantize to create stepped/blocky appearance
                        const stepSize = 0.15;
                        const quantizedHeight = Math.floor(combinedWave / stepSize) * stepSize;
                        
                        positions[i * 3 + 2] = originalY[i] + quantizedHeight * 0.25;
                    }
                    rippleSurface.geometry.attributes.position.needsUpdate = true;
                    rippleSurface.geometry.computeVertexNormals();
                }
                
                // Animate reflector geometry to bend reflections
                const reflector = water.userData.reflectors[0];
                if (reflector && reflector.geometry) {
                    const refPositions = reflector.geometry.attributes.position.array;
                    const refOriginalY = reflector.geometry.userData.originalY;
                    
                    if (refOriginalY) {
                        const segX = reflector.geometry.parameters.widthSegments + 1;
                        
                        for (let i = 0; i < refPositions.length / 3; i++) {
                            const px = refPositions[i * 3];
                            const pz = refPositions[i * 3 + 1];
                            
                            // Similar wave pattern but offset for interesting reflection distortion
                            const wave1 = Math.sin(px * 0.8 + time * 2.0 + 0.5) * Math.cos(pz * 0.6 + time * 1.5);
                            const wave2 = Math.sin(px * 1.2 - time * 1.8 + pz * 0.4 + 0.3) * 0.5;
                            const combinedWave = wave1 + wave2;
                            
                            // Quantize for blocky look
                            const stepSize = 0.15;
                            const quantizedHeight = Math.floor(combinedWave / stepSize) * stepSize;
                            
                            refPositions[i * 3 + 2] = refOriginalY[i] + quantizedHeight * 0.18;
                        }
                        reflector.geometry.attributes.position.needsUpdate = true;
                        reflector.geometry.computeVertexNormals();
                    }
                }
            }
        }

        // Animate and check collectibles
        for (let i = World.collectibles.length - 1; i >= 0; i--) {
            const collectible = World.collectibles[i];
            
            // Floating and spinning animation
            collectible.animationTime += delta;
            collectible.position.y = collectible.baseY + Math.sin(collectible.animationTime * 2) * 0.3;
            collectible.rotation.y += delta * 2;

            // Check for collection
            const collectibleBox = new THREE.Box3().setFromObject(collectible);
            if (playerBox.intersectsBox(collectibleBox)) {
                // VFX: Collection sparkle
                VFX.createCollectionSparkle(collectible.position.clone());
                
                if (collectible.isGoal) {
                    // Set victory state
                    player.victoryDance = true;
                    player.victoryStartTime = Date.now();
                    player.victoryPhase = 0;
                    
                    // Initial victory jump
                    setInterval(() => {
                        //Backflip
                        if(player.victoryPhase == 0 && isGrounded){
                            velocity.y = 25; // Higher jump
                            isGrounded = false;
                            player.backFlipping = true;
                            player.victoryPhase = 1;
                        }
                        else if (isGrounded) {
                            velocity.y = 15; // Slightly reduced
                            isGrounded = false;
                            player.victoryPhase = 0;
                        }
                    }, 1000);
                    
                    // Change music
                    stopMusic();
                    playMusic("goal");

                    camera.position.set(collectible.position.x, collectible.position.y + 5, collectible.position.z + 10);
                    player.lookAt(camera.position);
                    player.rotation.x = 0;
                    player.rotation.z = 0;
                    victory = true;

                    // Reset movement
                    velocity.x = 0;
                    velocity.z = 0;
                }

                // Remove the collectible
                scene.remove(collectible);
                World.collectibles.splice(i, 1);
            }
        }

        // if(paused == "resuming"){
        //     paused = false;
        //     delta = clock.getDelta();
        //     delta = 0.00000000001;
        // }

        if (player.damageCooldown > 0) {
            player.damageCooldown -= 0.1;
        }        // Controls - only if not in victory dance
        const movement = player.victoryDance ? new THREE.Vector3() : calculateCameraRelativeMovement();
        
        if (player.victoryDance) {
            // Victory dance sequence
            const timeSinceVictory = (Date.now() - player.victoryStartTime) / 1000; // Convert to seconds
            
            if (timeSinceVictory < 1) {
                // Initial backflip
                player.backFlipping = true;
            } else {
                // Spin the player
                const spinSpeed = 5;
                player.rotation.y += spinSpeed * delta;
            }
        }
        
        else if (keyState[' '] && player.inWater) {
            if(isGrounded){
                velocity.y = 15;
                isGrounded = false;
            }

            if(velocity.y < 15 && velocity.y > 0){
                velocity.y += 30 * delta; // Scale water boost with delta time
            }
            else if(velocity.y < 0){
                velocity.y += 50 * delta; // Scale water boost with delta time
            }
        }
        else if (keyState[' '] && isGrounded) {
            if(keyState['Shift']){
                velocity.y = 25; // Higher jump when crouching
                player.audio["SFX"].superJump.play();
                // let index = Math.floor(Math.random() * player.audio["Mario"].backflip.length);
                // player.audio["Mario"].backflip[index].play();
                isGrounded = false;
                player.backFlipping = true;
            }
            else {
                velocity.y = 15; // Slightly reduced jump height for better control
                player.audio["SFX"].jump.play();
                isGrounded = false;
            }
        }

        // Save the player's current position BEFORE any physics
        let lastPosition = player.position.clone();

        // Apply gravity if player is not on the ground
        if(!isGrounded && player.inWater) applyGravity(delta*0.5);
        else if(!isGrounded) applyGravity(delta);

        // Set animation based on key states and player state
        if(player.inWater){
            setAnimation("swim");
        }
        else if(player.damageAnimation != null){
            setAnimation("abyss");
        }
        else if (keyState['Shift'] && isGrounded) {
            setAnimation("crouch");
        }
        else if (!isGrounded) {
            if (velocity.y > 0) {
                if(player.backFlipping){
                    setAnimation("backflip");
                }
                else {
                    setAnimation("jump");
                }
            }   
            else {
                setAnimation("fall");
                player.backFlipping = false;
            }
        }
        else if (movement.length() > 0) {
            setAnimation("walk");
        }
        else{
            setAnimation("idle");
        }


        if (isGrounded) {
            player.damageAnimation = null;
        }

        // Move the player
        if( movement.length() > 0){
            // Rotate the player towards the movement direction
            const targetAngle = Math.atan2(movement.x, movement.z);
            const targetQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
            player.quaternion.slerp(targetQuaternion, rotationSpeed);
            
            // Move the player in the direction of the movement vector
            player.position.addScaledVector(movement, speed);
            updateBoundingBox();
        }

        // Check for collisions
        checkCollisions(lastPosition);
        
        // VFX: Landing dust when player lands
        if (isGrounded && !wasGrounded && velocity.y <= 0) {
            const landingIntensity = Math.min(Math.abs(velocity.y) / 15, 2);
            VFX.createLandingDust(player.position.clone(), landingIntensity);
            // Small camera shake on hard landing
            if (landingIntensity > 1) {
                VFX.shakeCamera(0.15 * landingIntensity, 0.15);
            }
        }
        
        // VFX: Water splash when entering/exiting water
        if (player.inWater && !wasInWater) {
            VFX.createWaterSplash(player.position.clone());
        }

        // Update player animation
        const action = player.animation.current;
        const frame = player.animation.currentFrame;

        if (animation.player[action].type == "rotation") {

            applyFrameRotation(player.BlockBody.torso, animation.player[action].frame[frame].torso);
            applyFrameRotation(player.BlockBody.neck, animation.player[action].frame[frame].neck);
            applyFrameRotation(player.BlockBody.leftArm, animation.player[action].frame[frame].leftArm);
            applyFrameRotation(player.BlockBody.rightArm, animation.player[action].frame[frame].rightArm);
            applyFrameRotation(player.BlockBody.leftLeg, animation.player[action].frame[frame].leftLeg);
            applyFrameRotation(player.BlockBody.rightLeg, animation.player[action].frame[frame].rightLeg);

            if(player.animation.frameDuration >= animation.player[action].speed / 10){
                player.animation.currentFrame = (player.animation.currentFrame + 1) % animation.player[action].frame.length;
                player.animation.frameDuration = 0;
            }

            if (player.animation.currentFrame == animation.player[action].frame.length - 1){
                if (player.animation.current == "backflip") {
                    player.backFlipping = false;
                }
            }

            //Restart the body position
            applyFrameTranslation(player.BlockBody.torso, { x: 0, y: .5, z: 0 });
            applyFrameTranslation(player.BlockBody.neck, { x: 0, y: 0.4, z: 0 });
            applyFrameTranslation(player.BlockBody.leftArm, { x: -0.4, y: 0.4, z: 0 });
            applyFrameTranslation(player.BlockBody.rightArm, { x: 0.4, y: 0.4, z: 0 });
            applyFrameTranslation(player.BlockBody.leftLeg, { x: -0.1, y: -0.4, z: 0 });
            applyFrameTranslation(player.BlockBody.rightLeg, { x: 0.1, y: -0.4, z: 0 });

            /*
            torso.position.set(0, .5, 0);
            neck.position.set(0, 0.4, 0);
            leftArm.position.set(-0.4, 0.4, 0);
            rightArm.position.set(0.4, 0.4, 0);
            leftLeg.position.set(-0.1, -0.4, 0);
            rightLeg.position.set(0.1, -0.4, 0);
            */
        }

        else if (animation.player[action].type == "translation") {
            console.log("movement!");
            applyFrameRotation(player.BlockBody.torso, animation.player[action].rotationFrame[frame].torso);
            applyFrameRotation(player.BlockBody.neck, animation.player[action].rotationFrame[frame].neck);
            applyFrameRotation(player.BlockBody.leftArm, animation.player[action].rotationFrame[frame].leftArm);
            applyFrameRotation(player.BlockBody.rightArm, animation.player[action].rotationFrame[frame].rightArm);
            applyFrameRotation(player.BlockBody.leftLeg, animation.player[action].rotationFrame[frame].leftLeg);
            applyFrameRotation(player.BlockBody.rightLeg, animation.player[action].rotationFrame[frame].rightLeg);

            applyFrameTranslation(player.BlockBody.torso, animation.player[action].movementFrame[frame].torso);
            applyFrameTranslation(player.BlockBody.neck, animation.player[action].movementFrame[frame].neck);
            applyFrameTranslation(player.BlockBody.leftArm, animation.player[action].movementFrame[frame].leftArm);
            applyFrameTranslation(player.BlockBody.rightArm, animation.player[action].movementFrame[frame].rightArm);
            applyFrameTranslation(player.BlockBody.leftLeg, animation.player[action].movementFrame[frame].leftLeg);
            applyFrameTranslation(player.BlockBody.rightLeg, animation.player[action].movementFrame[frame].rightLeg);

            if(player.animation.frameDuration >= animation.player[action].speed / 10){
                player.animation.currentFrame = (player.animation.currentFrame + 1) % animation.player[action].rotationFrame.length;
                player.animation.frameDuration = 0;
            }
        }

        player.animation.frameDuration += delta;


        // Move Camera
        const targetPosition = player.position.clone().add(cameraOffset);
        camera.position.lerp(targetPosition, 1);
        camera.lookAt(player.position);

        // Update debug wireframes if debug mode is on
        if (debugMode) {
            updateDebugWireframes();
        }
        
        // Update VFX particles and effects
        VFX.update(delta);

        // Update the scene with post-processing (bloom)
        composer.render();
    }
    else if(!player.alive || victory){
        let delta = clock.getDelta();


        applyGravity(delta)

        if (victory) {
            checkCollisions(player.position);
            if (!isGrounded) {
                if (velocity.y > 0) {
                    if(player.backFlipping){
                        setAnimation("backflip");
                    }
                    else {
                        setAnimation("jump");
                    }
                }   
                else {
                    setAnimation("fall");
                    player.backFlipping = false;
                }
            }
            else{
                setAnimation("idle");
            }
        }


        const action = player.animation.current;
        const frame = player.animation.currentFrame;

        applyFrameRotation(player.BlockBody.torso, animation.player[action].frame[frame].torso);
        applyFrameRotation(player.BlockBody.neck, animation.player[action].frame[frame].neck);
        applyFrameRotation(player.BlockBody.leftArm, animation.player[action].frame[frame].leftArm);
        applyFrameRotation(player.BlockBody.rightArm, animation.player[action].frame[frame].rightArm);
        applyFrameRotation(player.BlockBody.leftLeg, animation.player[action].frame[frame].leftLeg);
        applyFrameRotation(player.BlockBody.rightLeg, animation.player[action].frame[frame].rightLeg);

        if(player.animation.frameDuration >= animation.player[action].speed / 10){
            player.animation.currentFrame = (player.animation.currentFrame + 1) % animation.player[action].frame.length;
            player.animation.frameDuration = 0;
        }

        player.animation.frameDuration += delta;

        camera.lookAt(player.position);
        
        // Update debug wireframes if debug mode is on
        if (debugMode) {
            updateDebugWireframes();
        }
        
        // Update VFX even when dead/victory
        VFX.update(delta);
        
        composer.render();
    }
    

    requestAnimationFrame(animate);
}


document.addEventListener('keydown', (event) => {
    keyState[event.key] = true;
    
    // F3 toggles debug mode
    if (event.key === 'F3') {
        event.preventDefault();
        debugMode = !debugMode;
        console.log('Debug mode:', debugMode ? 'ON' : 'OFF');
        if (!debugMode) {
            clearDebugWireframes();
        }
    }
});
document.addEventListener('keyup', (event) => {
    keyState[event.key] = false;
});
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});
window.addEventListener('blur', () => {
    keyState = {};
    paused = true;
    console.log("Paused");
});
window.addEventListener('focus', () => {
    console.log("Unpaused");
    paused = false;
});
window.addEventListener('DOMContentLoaded', () => {
    // Load audio preferences first, then start the game
    loadAudioSettings();
    addAudioToggleButtons();
    startGame();
});

// Add fadeScreen overlay div to body
const fadeScreen = document.createElement('div');
fadeScreen.style.position = 'fixed';
fadeScreen.style.top = '0';
fadeScreen.style.left = '0';
fadeScreen.style.width = '100%';
fadeScreen.style.height = '100%';
fadeScreen.style.backgroundColor = 'black';
fadeScreen.style.opacity = '0';
fadeScreen.style.transition = 'opacity 1s';
fadeScreen.style.pointerEvents = 'none';
fadeScreen.style.zIndex = '1000';
document.body.appendChild(fadeScreen);

const gameOverText = document.createElement('div');
gameOverText.style.position = 'fixed';
gameOverText.style.top = '50%';
gameOverText.style.left = '50%';
gameOverText.style.transform = 'translate(-50%, -50%)';
gameOverText.style.color = 'red';
gameOverText.style.fontSize = '48px';
gameOverText.style.fontFamily = 'Arial';
gameOverText.style.display = 'none';
gameOverText.textContent = 'GAME OVER';
fadeScreen.appendChild(gameOverText);

// Add life counter UI element
const lifeCounter = document.createElement('div');
lifeCounter.style.position = 'fixed';
lifeCounter.style.top = '20px';
lifeCounter.style.left = '20px';
lifeCounter.style.color = '#ff0000';
lifeCounter.style.fontSize = '24px';
lifeCounter.style.fontFamily = 'Arial';
lifeCounter.style.textShadow = '2px 2px 2px black';
lifeCounter.style.zIndex = '100';
document.body.appendChild(lifeCounter);

function updateLifeCounter() {
    lifeCounter.textContent = `Lives: ${player.lives}`;
}

function fadeToBlack(callback) {
    fadeScreen.style.opacity = '1';
    setTimeout(() => {
        if (callback) callback();
    }, 1000);
}

function fadeFromBlack(callback) {
    fadeScreen.style.opacity = '0';
    setTimeout(() => {
        if (callback) callback();
    }, 1000);
}

function resetLevel() {
    // Store reference to current player
    const currentPlayer = World.players[0];

    // Clear current level
    while(World.players.length > 0) {
        World.players.pop(); // Just remove from array, don't remove from scene
    }
    while(World.obstacles.length > 0) {
        scene.remove(World.obstacles.pop());
    }
    while(World.water.length > 0) {
        scene.remove(World.water.pop());
    }
    while(World.lava.length > 0) {
        scene.remove(World.lava.pop());
    }
    while(World.collectibles.length > 0) {
        scene.remove(World.collectibles.pop());
    }
    
    // Clean up water reflection cameras
    while(waterReflectionCameras.length > 0) {
        const item = waterReflectionCameras.pop();
        if (item.reflectors) {
            for (const reflector of item.reflectors) {
                reflector.getRenderTarget().dispose();
                reflector.geometry.dispose();
                reflector.material.dispose();
            }
        }
    }
    
    // Clean up VFX particles
    VFX.cleanup();

    // Put player back in World.players array
    if (currentPlayer) {
        World.players.push(currentPlayer);
    }
    
    // Reset game state
    velocity.set(0, 0, 0);
    isGrounded = false;
    victory = false;
    
    // Restart current level
    paused = true;
    setTimeout(() => {
        courses[currentLevel]();
    }, 100);
}

function handlePlayerDeath() {
    // Wait for die song to play for a bit before fading
    setTimeout(() => {
        if (player.lives > 1) {
            // Player has lives remaining
            player.lives--;
            updateLifeCounter(); // Update life counter display
            fadeToBlack(() => {                // Move player to a safe position before resetting
                player.position.set(0, 100, 0); // Move high up to prevent death trigger
                velocity.set(0, 0, 0);
                
                // Wait a frame to ensure position is updated
                requestAnimationFrame(() => {
                    // Reset level first
                    resetLevel();
                    // Then restore player state
                    player.health = 100;
                    player.alive = true;
                    player.damageAnimation = null;
                    fadeFromBlack(() => {
                        paused = false;
                        // Restart level music
                        if (currentLevel.includes("Tower")) {
                            playMusic("enemyTowers");
                        } else {
                            playMusic("blockCity");
                        }
                    });
                });
            });
        } else {
            // Game Over
            fadeToBlack(() => {
                gameOverText.style.display = 'block';
                playMusic("gameOver");
            });
        }
    }, 3000); // Wait 3 seconds before starting fade
}