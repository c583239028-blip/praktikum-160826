import { Device } from 'mediasoup-client';
import * as Base64 from 'base-64';
import { emitMediaPromise } from './socket.service';
import { SOCKET_EVENTS } from '@worldplay/shared';

if (typeof global.btoa === 'undefined') {
  global.btoa = (str) => Base64.encode(str);
}
if (typeof global.atob === 'undefined') {
  global.atob = (str) => Base64.decode(str);
}

let device = null;
let webrtcReady = false;

function ensureWebRTC() {
  if (webrtcReady) return;
  const {
    registerGlobals,
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    MediaStream,
    MediaStreamTrack,
  } = require('@livekit/react-native-webrtc');
  registerGlobals();
  globalThis.RTCPeerConnection = RTCPeerConnection;
  globalThis.RTCIceCandidate = RTCIceCandidate;
  globalThis.RTCSessionDescription = RTCSessionDescription;
  globalThis.MediaStream = MediaStream;
  globalThis.MediaStreamTrack = MediaStreamTrack;
  webrtcReady = true;
}

export const MediasoupManager = {
  async initDevice(routerRtpCapabilities) {
    try {
      ensureWebRTC();
      device = new Device({ handlerName: 'ReactNative106' });
      await device.load({ routerRtpCapabilities });
      console.log('✅ Mediasoup Device loaded successfully');
      return device;
    } catch (error) {
      console.error('Failed to load device:', error);
      throw error;
    }
  },

  getRtpCapabilities() {
    if (!device) {
      throw new Error('Device not initialized. Call initDevice first.');
    }
    return device.rtpCapabilities;
  },

  async getLocalStream() {
    try {
      ensureWebRTC();
      const { mediaDevices } = require('@livekit/react-native-webrtc');
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user',
          width: 640,
          height: 480,
          frameRate: 30,
        },
      });
      return stream;
    } catch (err) {
      console.warn('getLocalStream failed, returning null', err);
      return null;
    }
  },

  async createTransport(socket, direction, streamId) {
    if (!device) throw new Error('Device not initialized');

    const params = await emitMediaPromise(
      SOCKET_EVENTS.STREAM.CREATE_TRANSPORT,
      { streamId, direction }
    );

    const transport =
      direction === 'send'
        ? device.createSendTransport(params)
        : device.createRecvTransport(params);

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await emitMediaPromise(SOCKET_EVENTS.STREAM.CONNECT_TRANSPORT, {
          transportId: transport.id,
          dtlsParameters,
          streamId,
        });
        callback();
      } catch (err) {
        errback(err);
      }
    });

    if (direction === 'send') {
      transport.on(
        'produce',
        async ({ kind, rtpParameters }, callback, errback) => {
          try {
            const { id } = await emitMediaPromise(
              SOCKET_EVENTS.STREAM.PRODUCE,
              {
                transportId: transport.id,
                kind,
                rtpParameters,
                streamId,
              }
            );
            callback({ id });
          } catch (err) {
            errback(err);
          }
        }
      );
    }

    return transport;
  },
};
