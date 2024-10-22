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
ws = new WebSocket("ws://localhost:63227");

ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "offer") {
        await peerConnection.setRemoteDescription(data.offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "answer", answer }));
    } else if (data.type === "answer") {
        await peerConnection.setRemoteDescription(data.answer);
    } else if (data.type === "candidate") {
        try {
            await peerConnection.addIceCandidate(data.candidate);
        } catch (e) {
            console.error("Error adding received ICE candidate", e);
        }
    }
};

// Function to start the call
startCallButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    peerConnection = new RTCPeerConnection(configuration);

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
        }
    };

    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

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
