/**
 * Peer-to-peer calling.
 *
 * Signalling already existed — ringing, accept, decline and hang-up all travel
 * over the InsForge `user_call:{userId}` channel — but nothing ever carried
 * media. Accepting a call set the status to 'connected' and stopped there, so
 * both people looked at a connected screen with no audio and no video.
 *
 * This is the missing half: the peer connection, the microphone and camera,
 * and the SDP and ICE exchange that turns a ringing signal into a call.
 *
 * Media never touches a server. The offer, the answer and the ICE candidates
 * go through InsForge; the audio and video go directly between the two
 * devices.
 */

import { nexus } from './nexus';

/**
 * How the two ends find each other.
 *
 * STUN alone tells each peer its own public address, which is enough on most
 * home and office networks. It is not enough behind symmetric NAT or a strict
 * corporate firewall — roughly one call in five — where the media needs
 * relaying through a TURN server.
 *
 * TURN is read from the environment rather than hardcoded, because its
 * credential is a secret and because the server is something the operator
 * provisions. Without it those calls will connect their signalling, fail to
 * find a working path, and end. That is a real limitation and is reported to
 * the caller rather than left to look like a hang.
 */
export const buildIceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  const turnUser = import.meta.env.VITE_TURN_USERNAME as string | undefined;
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

  if (turnUrl && turnUser && turnCred) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
  }

  return servers;
};

export const hasTurn = (): boolean =>
  Boolean(import.meta.env.VITE_TURN_URL && import.meta.env.VITE_TURN_USERNAME);

export interface PeerHandlers {
  /** A remote track arrived; the UI binds this to a <video>. */
  onRemoteStream: (stream: MediaStream) => void;
  /** Connection state changed — used to report a failure rather than hang. */
  onStateChange: (state: RTCPeerConnectionState) => void;
}

/**
 * One call's worth of WebRTC.
 *
 * Deliberately not a singleton: a call has a lifetime, and tying the peer
 * connection to it means ending the call tears down everything with it rather
 * than leaving a camera light on.
 */
export class PeerSession {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream = new MediaStream();
  private channel: string;
  private selfId: string;
  private handlers: PeerHandlers;

  /** Candidates that arrive before the remote description is set. */
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(partnerId: string, selfId: string, handlers: PeerHandlers) {
    this.channel = `user_call:${partnerId}`;
    this.selfId = selfId;
    this.handlers = handlers;
  }

  /** The local camera and microphone, for the UI to preview. */
  get stream(): MediaStream | null {
    return this.localStream;
  }

  private ensurePc(): RTCPeerConnection {
    if (this.pc) return this.pc;

    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });

    // Trickle rather than waiting for gathering to finish: sending candidates
    // as they are found shortens the time to first frame noticeably.
    pc.onicecandidate = e => {
      if (!e.candidate) return;
      nexus.realtime
        .publish(this.channel, 'call_ice_candidate', {
          from: this.selfId,
          candidate: e.candidate.toJSON()
        })
        .catch(() => {});
    };

    pc.ontrack = e => {
      e.streams[0]?.getTracks().forEach(t => {
        if (!this.remoteStream.getTracks().includes(t)) this.remoteStream.addTrack(t);
      });
      this.handlers.onRemoteStream(this.remoteStream);
    };

    pc.onconnectionstatechange = () => {
      this.handlers.onStateChange(pc.connectionState);
    };

    this.pc = pc;
    return pc;
  }

  /**
   * Opens the camera and microphone.
   *
   * Separated from the offer so the UI can show a local preview while the
   * other side is still ringing, and so a denied permission surfaces as a
   * clear failure before any signalling happens.
   */
  async openMedia(video: boolean): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
    });

    const pc = this.ensurePc();
    this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream!));
    return this.localStream;
  }

  /** Caller: create and send the offer. */
  async createOffer(callId: string): Promise<void> {
    const pc = this.ensurePc();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await nexus.realtime.publish(this.channel, 'call_sdp_offer', {
      from: this.selfId,
      callId,
      sdp: offer
    });
  }

  /** Callee: accept the offer and answer it. */
  async acceptOffer(sdp: RTCSessionDescriptionInit, callId: string): Promise<void> {
    const pc = this.ensurePc();
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.drainCandidates();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await nexus.realtime.publish(this.channel, 'call_sdp_answer', {
      from: this.selfId,
      callId,
      sdp: answer
    });
  }

  /** Caller: the answer came back. */
  async acceptAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.ensurePc();
    // Guard against a duplicate answer, which would throw in `stable`.
    if (pc.signalingState === 'stable') return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.drainCandidates();
  }

  /**
   * A candidate from the other side.
   *
   * Candidates routinely arrive before the remote description is set — the
   * other peer starts gathering the moment it has a local description. Adding
   * one too early throws, so they are held and replayed.
   */
  async addCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.ensurePc();
    if (!pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[WebRTC] Could not add ICE candidate:', err);
    }
  }

  private async drainCandidates(): Promise<void> {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of queued) {
      try {
        await this.pc?.addIceCandidate(new RTCIceCandidate(c));
      } catch (err) {
        console.warn('[WebRTC] Could not add queued ICE candidate:', err);
      }
    }
  }

  setMuted(muted: boolean): void {
    this.localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; });
  }

  setCameraOn(on: boolean): void {
    this.localStream?.getVideoTracks().forEach(t => { t.enabled = on; });
  }

  /**
   * Ends the call and releases the devices.
   *
   * Stopping every track matters: without it the camera light stays on after
   * a call, which people reasonably read as still being watched.
   */
  close(): void {
    this.localStream?.getTracks().forEach(t => t.stop());
    this.remoteStream.getTracks().forEach(t => t.stop());
    this.pc?.close();
    this.pc = null;
    this.localStream = null;
    this.remoteStream = new MediaStream();
    this.pendingCandidates = [];
  }
}

export default PeerSession;
