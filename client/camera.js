const startCallButton = document.getElementById("startCall");
const endCallButton = document.getElementById("endCall");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let localStream;
let peerConnection;
let ws;

// Define configuration for STUN server
const configuration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// Connect to WebSocket signaling server

// *****************************************************************

// IMPORTANT: USE THE CORRECT WEBSOCKET FOR WHATEVER TESTING METHOD YOU USE

// Use THIS line for local testing
//ws = new WebSocket("ws://localhost:3000");

// Use THIS line for ngrok testing across multiple devices
// replace the part after "wss://"" with whatever ngrok generates
ws = new WebSocket("wss://b947-2620-8d-8000-1074-4cd6-9722-d2f1-a467.ngrok-free.app");

// *****************************************************************

ws.onmessage = async (event) => {
    let data;
    
    if (event.data instanceof Blob) {
        // Convert Blob to text and then parse as JSON
        const textData = await event.data.text();
        data = JSON.parse(textData);
    } else {
        // Directly parse if it's a string
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

    // When ICE candidates are found, send them to the other peer
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }));
        }
    };

    // When a remote stream is added, display it
    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Add local stream tracks to the peer connection
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
}

// Handling signaling messages
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

// Function to create and send offer
// async function startCall() {
//     await createPeerConnection();
//     const offer = await peerConnection.createOffer();
//     await peerConnection.setLocalDescription(offer);

//     ws.send(JSON.stringify({ type: 'offer', offer }));
// }

// Function to start the call
startCallButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    await createPeerConnection();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    ws.send(JSON.stringify({ type: "offer", offer }));
};

// Function to end the call
endCallButton.onclick = () => {
    peerConnection.close();
    localVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
};
