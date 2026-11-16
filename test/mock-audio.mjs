// Stand-in for assets/js/audio.js in unit tests.
//
// audioCtx records every buffer source that gets started:
//   log: [{ tag, when, offset, gain }]
// and its clock (currentTime) is set by the test.

export const log = [];
const gains = [];

export const audioCtx = {
  currentTime: 0,
  sampleRate: 8000,
  destination: {},

  createBuffer(_channels, length, sampleRate) {
    const data = new Float32Array(length);
    return { duration: length / sampleRate, getChannelData: () => data, tag: 'tick' };
  },

  createGain() {
    const g = {
      id: gains.length,
      gain: {
        value: 1,
        target: null,
        cancelScheduledValues() {},
        setValueAtTime() {},
        linearRampToValueAtTime(v) {
          g.gain.target = v;
        },
      },
      connect() {},
      disconnect() {
        g.disconnected = true;
      },
    };
    gains.push(g);
    return g;
  },

  createBufferSource() {
    const src = {
      stoppedAt: null,
      connect(g) {
        src.gainNode = g;
      },
      start(when, offset = 0) {
        log.push({
          tag: src.buffer.tag,
          when: Math.round(when * 1000) / 1000,
          offset: Math.round(offset * 1000) / 1000,
          gain: src.gainNode,
        });
      },
      stop(t) {
        src.stoppedAt = t;
      },
    };
    return src;
  },

  // Tests "decode" by tagging the fetched file name
  decodeAudioData: async (data) => data,
};

// Unused by loop.js but exported by the real module
export const ambient = {};
export function setUiSounds() {}
