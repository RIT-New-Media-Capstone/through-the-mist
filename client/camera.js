const startCallButton = document.getElementById("startCall");
const endCallButton = document.getElementById("endCall");
const localVideo = document.getElementById("localVideo");
const localCanvas = document.getElementById("localCanvas");

let localStream, peerConnection, ws, localAnimationFrameId;

const configuration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// Connect to WebSocket signaling server
ws = new WebSocket("wss://b947-2620-8d-8000-1074-4cd6-9722-d2f1-a467.ngrok-free.app");

ws.onmessage = async (event) => {
    let data;

    if (event.data instanceof Blob) {
        const textData = await event.data.text();
        data = JSON.parse(textData);
    } else {
        data = JSON.parse(event.data);
    }

    switch (data.type) {
        case 'offer':
            await handleOffer(data.offer);
            break;
        case 'answer':
            await handleAnswer(data.answer);
            break;
        case 'ice-candidate':
            await handleNewICECandidateMsg(data.candidate);
            break;
    }
};

// Create the peer connection
async function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }));
        }
    };

    peerConnection.ontrack = event => {
        const [remoteStream] = event.streams;
        localVideo.srcObject = remoteStream;
        
        localVideo.onloadeddata = () => {
            console.log("Remote video loaded, applying WebGL effect.");
            setupWebGLShaderEffect(localVideo, localCanvas);
        };
    };

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
}

// Handle signaling messages
async function handleOffer(offer) {
    await createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    ws.send(JSON.stringify({ type: 'answer', answer }));
}

async function handleAnswer(answer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

async function handleNewICECandidateMsg(candidate) {
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
        console.error('Error adding received ICE candidate', e);
    }
}

// Start the call
startCallButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    await createPeerConnection();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    ws.send(JSON.stringify({ type: "offer", offer }));

    localVideo.onloadeddata = () => {
        console.log("Local video loaded, applying WebGL effect.");
        setupWebGLShaderEffect(localVideo, localCanvas);
    };
};

// End the call
endCallButton.onclick = () => {
    peerConnection.close();
    localVideo.srcObject.getTracks().forEach(track => track.stop());
    cancelAnimationFrame(localAnimationFrameId);
};


// Set up WebGL shader with Three.js for a video stream
function setupWebGLShaderEffect(videoElement, canvasElement, streamType) {
    const videoTexture = new THREE.VideoTexture(videoElement);

    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBFormat;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: videoTexture },
            uFade: { value: 1.0 }, // Fade control
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D uTexture;
            uniform float uFade;
            varying vec2 vUv;

            void main() {
                vec4 color = texture2D(uTexture, vUv);
                float gray = (color.r + color.g + color.b) / 3.0;
                float threshold = 0.5;
                vec3 chalkColor = gray < threshold ? vec3(0.0) : vec3(1.0);

                float dx = 1.0 / 800.0;
                float dy = 1.0 / 600.0;

                float edgeDetection = 0.0;
                edgeDetection += texture2D(uTexture, vec2(vUv.x - dx, vUv.y)).r;
                edgeDetection += texture2D(uTexture, vec2(vUv.x + dx, vUv.y)).r;
                edgeDetection += texture2D(uTexture, vec2(vUv.x, vUv.y - dy)).r;
                edgeDetection += texture2D(uTexture, vec2(vUv.x, vUv.y + dy)).r;
                edgeDetection -= 4.0 * gray;

                vec3 outline = edgeDetection > 0.1 ? vec3(1.0) : vec3(0.0);
                vec3 finalColor = mix(chalkColor, outline, step(0.0, edgeDetection));

                gl_FragColor = vec4(mix(finalColor, color.rgb, uFade), 1.0);
            }
        `
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasElement });
    renderer.setSize(canvasElement.clientWidth, canvasElement.clientHeight);

    let fadeStartTime = Date.now();
    const fadeDuration = 10000; // 10 seconds for each fade stage
    const totalFadeStages = 5;
    const fadeStep = 1 / totalFadeStages;

    function animate() {
        const elapsed = Date.now() - fadeStartTime;
        const currentStage = Math.floor(elapsed / fadeDuration);
        if (currentStage < totalFadeStages) {
            material.uniforms.uFade.value = currentStage * fadeStep;
        } else {
            material.uniforms.uFade.value = 1.0;
        }

        renderer.render(scene, camera);
        if (streamType === "local") {
            localAnimationFrameId = requestAnimationFrame(animate);
        } else {
            remoteAnimationFrameId = requestAnimationFrame(animate);
        }
    }

    animate();
}

