/* Synchronized FOA preview for the original, unchanged panorama video. */
(() => {
  'use strict';
  class SpatialAudioPlayer {
    constructor(video, onChange, onError) {
      this.video = video; this.onChange = onChange; this.onError = onError;
      this.enabled = false; this.mode = 'stereo'; this.yaw = 0; this.pitch = 0;
      this.token = 0; this.resyncs = 0;
      for (const name of ['playing', 'seeked', 'ratechange']) video.addEventListener(name, () => this.sync(true));
      for (const name of ['pause', 'ended', 'waiting', 'seeking', 'emptied']) video.addEventListener(name, () => this.stop());
      this.timer = setInterval(() => this.sync(false), 100);
      addEventListener('pagehide', event => { this.stop(); if (!event.persisted) { clearInterval(this.timer); this.context?.close(); } });
    }
    ensureContext() {
      if (this.context) return;
      this.context = new AudioContext({sampleRate:48000});
      this.master = this.context.createGain(); this.master.gain.value = .5;
      this.master.connect(this.context.destination);
      this.decoder = FoaPreviewDecoder.create(this.context, this.master);
      this.decoder.orient(this.yaw, this.pitch);
    }
    async select(scene, signal) {
      const token = ++this.token;
      this.stop(); this.buffer = null; this.error = null;
      this.mode = scene.foa ? 'foa' : 'stereo';
      this.video.muted = this.mode === 'foa' || !this.enabled;
      this.loading = this.mode === 'foa'; this.onChange();
      if (!scene.foa) return;
      try {
        const response = await fetch(scene.foa.url, {signal});
        if (!response.ok) throw Error(`FOA download failed (${response.status})`);
        const raw = await response.arrayBuffer();
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)), x => x.toString(16).padStart(2,'0')).join('');
        if (digest !== scene.foa.sha256) throw Error('FOA file verification failed');
        if (signal.aborted || token !== this.token) return;
        this.ensureContext();
        this.buffer = FoaPreviewDecoder.readFloatWav(raw, this.context);
        this.loading = false; this.onChange(); this.sync(true);
      } catch (error) {
        if (signal.aborted || token !== this.token) return;
        this.loading = false; this.error = error.message; this.enabled = false;
        this.video.muted = true; this.stop(); this.onChange();
        this.onError('Spatial audio could not load. Use Retry to reload this scene.');
      }
    }
    async setEnabled(value) {
      if (value && this.mode === 'foa' && this.error) {
        this.enabled = false; this.onChange();
        this.onError('Spatial audio could not load. Use Retry to reload this scene.'); return;
      }
      this.enabled = Boolean(value);
      if (this.mode === 'foa') {
        this.video.muted = true;
        if (this.enabled) {
          try { this.ensureContext(); await this.context.resume(); }
          catch (error) { this.enabled=false; this.error=error.message; this.onError('Audio could not start. Tap Sound again.'); }
        }
        this.sync(true);
      } else this.video.muted = !this.enabled;
      this.onChange();
    }
    orient(yaw, pitch) {
      this.yaw=yaw; this.pitch=pitch;
      this.decoder?.orient(yaw,pitch);
    }
    stop() {
      if (!this.source) return;
      this.source.onended = null;
      this.source.stop(); this.source.disconnect(); this.source = null;
    }
    position() {
      if (!this.source) return null;
      return (this.offset + (this.context.currentTime-this.started)*this.rate) % this.buffer.duration;
    }
    sync(force) {
      const v=this.video;
      if (this.mode!=='foa' || !this.enabled || !this.buffer || this.context?.state!=='running' || v.paused || v.ended || v.seeking || v.readyState<3) {
        this.stop(); return;
      }
      const offset=v.currentTime % this.buffer.duration;
      const current=this.position();
      const delta=current===null ? Infinity : Math.abs(((current-offset+this.buffer.duration*1.5)%this.buffer.duration)-this.buffer.duration/2);
      this.drift=Number.isFinite(delta)?delta:null;
      if (this.source && !force && delta < .1) return;
      this.stop();
      const source=this.context.createBufferSource();
      source.buffer=this.buffer; source.loop=true; source.playbackRate.value=v.playbackRate;
      source.connect(this.decoder.input);
      this.source=source; this.started=this.context.currentTime; this.offset=offset; this.rate=v.playbackRate;
      source.start(this.started,offset); this.resyncs++;
    }
    diagnostics() {
      return {mode:this.mode,enabled:this.enabled,loading:this.loading,error:this.error,
        channels:this.buffer?.numberOfChannels,samples:this.buffer?.length,sampleRate:this.buffer?.sampleRate,
        activeSources:this.source?1:0,videoMuted:this.video.muted,yaw:this.yaw,pitch:this.pitch,
        audioTime:this.position(),videoTime:this.video.currentTime,drift:this.drift,resyncs:this.resyncs,
        decoderSpeakers:this.decoder?.speakers.length,contextState:this.context?.state,
        listener:this.context?[this.context.listener.forwardX.value,this.context.listener.forwardY.value,this.context.listener.forwardZ.value]:null};
    }
  }
  window.SpatialAudioPlayer=SpatialAudioPlayer;
})();
