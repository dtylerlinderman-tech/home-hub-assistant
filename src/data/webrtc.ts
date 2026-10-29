// Live camera video from Home Assistant over WebRTC.
// Message names checked against homeassistant/components/camera/webrtc.py (HA 2026.10):
//   camera/webrtc/get_client_config → { configuration, dataChannel? }
//   camera/webrtc/offer (subscription) → { type: "session" | "answer" | "candidate" | "error", … }
//   camera/webrtc/candidate → send our ICE candidates for the session
import type { Connection } from 'home-assistant-js-websocket';

interface ClientConfig {
  configuration?: { iceServers?: RTCIceServer[]; ice_servers?: RTCIceServer[] };
  dataChannel?: string;
}

type OfferEvent =
  | { type: 'session'; session_id: string }
  | { type: 'answer'; answer: string }
  | { type: 'candidate'; candidate: { candidate: string; sdpMid?: string | null; sdp_mid?: string | null; sdpMLineIndex?: number | null; sdp_m_line_index?: number | null } }
  | { type: 'error'; code?: string; message?: string };

export async function openWebRtcStream(
  conn: Connection,
  entityId: string,
  onStream: (s: MediaStream) => void,
  onError: (message: string) => void,
): Promise<() => void> {
  const cfg = await conn.sendMessagePromise<ClientConfig>({ type: 'camera/webrtc/get_client_config', entity_id: entityId });
  const pc = new RTCPeerConnection({ iceServers: cfg.configuration?.iceServers ?? cfg.configuration?.ice_servers ?? [] });
  // Nest needs a data channel in the offer, or it won't answer.
  if (cfg.dataChannel) pc.createDataChannel(cfg.dataChannel);
  pc.addTransceiver('audio', { direction: 'recvonly' });
  pc.addTransceiver('video', { direction: 'recvonly' });

  const media = new MediaStream();
  pc.ontrack = (e) => { media.addTrack(e.track); onStream(media); };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') onError('The video connection failed.');
  };

  let sessionId: string | null = null;
  const pending: RTCIceCandidateInit[] = [];
  const sendCandidate = (c: RTCIceCandidateInit) => {
    void conn.sendMessagePromise({ type: 'camera/webrtc/candidate', entity_id: entityId, session_id: sessionId, candidate: c })
      .catch((e) => console.warn('WebRTC candidate rejected', e));
  };
  pc.onicecandidate = (e) => {
    if (!e.candidate) return;
    const c = e.candidate.toJSON();
    if (sessionId) sendCandidate(c); else pending.push(c);
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const unsub = await conn.subscribeMessage<OfferEvent>(
    (msg) => {
      switch (msg.type) {
        case 'session':
          sessionId = msg.session_id;
          pending.splice(0).forEach(sendCandidate);
          break;
        case 'answer':
          pc.setRemoteDescription({ type: 'answer', sdp: msg.answer }).catch((e) => onError(String(e)));
          break;
        case 'candidate': {
          const c = msg.candidate;
          pc.addIceCandidate({
            candidate: c.candidate,
            sdpMid: c.sdpMid ?? c.sdp_mid ?? undefined,
            sdpMLineIndex: c.sdpMLineIndex ?? c.sdp_m_line_index ?? undefined,
          }).catch((e) => console.warn('Bad ICE candidate from HA', e));
          break;
        }
        case 'error':
          onError(msg.message || 'The camera didn’t answer.');
          break;
      }
    },
    { type: 'camera/webrtc/offer', entity_id: entityId, offer: offer.sdp },
    { resubscribe: false },
  );

  return () => {
    void unsub().catch(() => {});
    pc.close();
  };
}
