(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const video = $('scene-video');
  let samples, currentKey = 'coast', panorama, controller, flat = false, webglAvailable = true;
  video.muted = true;
  video.volume = 0.7;
  function updateClock() {
    const duration = Number.isFinite(video.duration) ? video.duration : 5;
    const time = video.currentTime || 0;
    $('seek').max = duration;
    $('seek').value = time;
    $('seek').setAttribute('aria-valuetext', `${time.toFixed(1)} of ${duration.toFixed(1)} seconds`);
    $('clock').textContent = `0:${String(Math.floor(time)).padStart(2, '0')} / 0:${String(Math.round(duration)).padStart(2, '0')}`;
  }
  function updatePlay() {
    $('play-symbol').textContent = video.paused ? '▶' : 'Ⅱ';
    $('play-label').textContent = video.paused ? 'Play scene' : 'Pause scene';
    $('play').setAttribute('aria-label', video.paused ? 'Play scene' : 'Pause scene');
  }
  function updateSound() {
    $('sound-label').textContent = video.muted ? 'Sound off' : 'Sound on';
    $('sound').setAttribute('aria-pressed', String(!video.muted));
    $('sound').setAttribute('aria-label', video.muted ? 'Turn sound on' : 'Mute sound');
  }
  function setBusy(busy) {
    $('viewer').setAttribute('aria-busy', String(busy));
    for (const id of ['play', 'seek', 'sound']) $(id).disabled = busy;
    for (const id of ['projection', 'reset-view']) $(id).disabled = busy || !webglAvailable;
  }
  function showError(message) {
    $('load-status').hidden = true;
    $('error-message').textContent = message;
    $('viewer-error').hidden = false;
    $('viewer').setAttribute('aria-busy', 'false');
  }
  function changeProjection(value) {
    flat = value;
    $('viewer').classList.toggle('is-flat', flat);
    $('projection').textContent = flat ? '360° view' : 'Flat view';
    $('projection').title = flat ? 'Switch to the 360 degree view' : 'Switch to the flat panorama';
    $('projection').setAttribute('aria-pressed', String(flat));
    $('view-label').textContent = flat ? 'Flat panorama' : '360° panorama';
    $('heading').hidden = flat;
    $('panorama').tabIndex = flat ? -1 : 0;
    $('panorama').setAttribute('aria-hidden', String(flat));
    if (panorama) { panorama.enabled = !flat; panorama.dirty = true; }
  }
  function useFlatFallback(message) {
    webglAvailable = false;
    changeProjection(true);
    $('projection').disabled = true;
    $('reset-view').disabled = true;
    $('view-label').textContent = 'Flat panorama · 360° unavailable';
    $('view-label').title = message;
  }
  try {
    panorama = new PanoramaViewer($('panorama'), video, yaw => { $('heading').textContent = `${Math.round(yaw)}°`; }, useFlatFallback);
  } catch (error) { useFlatFallback(error.message); }
  function resetView() {
    const scene = samples?.[currentKey];
    if (scene && panorama) panorama.setView(scene.yaw, scene.pitch);
  }
  function selectScene(key) {
    if (!samples?.[key]) return;
    const resume = !video.paused;
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;
    video.pause();
    currentKey = key;
    const scene = samples[key];
    setBusy(true);
    $('viewer-error').hidden = true;
    $('load-status').hidden = false;
    $('load-status').textContent = `Loading ${scene.title.toLowerCase()}…`;
    $('viewer-poster').src = scene.poster;
    $('viewer-poster').alt = scene.description;
    $('viewer-poster').hidden = false;
    $('scene-title').textContent = scene.title;
    $('prompt-excerpt').textContent = `“${scene.excerpt}”`;
    $('scene-note').textContent = scene.note;
    $('fallback-link').href = scene.video;
    document.querySelectorAll('[data-scene]').forEach(button => {
      const selected = button.dataset.scene === key;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    resetView();
    const url = new URL(location.href);
    url.searchParams.set('scene', key);
    history.replaceState(null, '', url);
    let timer = setTimeout(() => {
      if (video.readyState < 2) showError('This scene is taking longer to load. Try again or open the video directly.');
    }, 45000);
    signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
    video.addEventListener('loadeddata', async () => {
      clearTimeout(timer);
      if (signal.aborted) return;
      $('viewer-poster').hidden = true;
      $('load-status').hidden = true;
      $('viewer-error').hidden = true;
      setBusy(false);
      updateClock();
      if (panorama) panorama.dirty = true;
      if (resume) { try { await video.play(); } catch { updatePlay(); } }
    }, { once: true, signal });
    video.addEventListener('error', () => {
      clearTimeout(timer);
      setBusy(true);
      showError('The scene could not load. Check your connection and try again, or open the video directly.');
    }, { once: true, signal });
    video.poster = scene.poster;
    video.src = scene.video;
    video.load();
    updateClock();
  }
  async function initialize() {
    try {
      const response = await fetch('assets/samples.json');
      if (!response.ok) throw new Error('metadata');
      const data = await response.json();
      samples = data.scenes;
      document.querySelectorAll('[data-listen]').forEach(button => { button.disabled = !Object.hasOwn(samples, button.dataset.listen); });
      const requested = new URLSearchParams(location.search).get('scene');
      selectScene(Object.hasOwn(samples, requested) ? requested : currentKey);
    } catch { showError('Scene details could not load. Check your connection and try again.'); }
  }
  $('play').addEventListener('click', async () => {
    try { if (video.paused) await video.play(); else video.pause(); }
    catch { showError('Playback could not start in this browser. Try again or open the video directly.'); }
  });
  $('sound').addEventListener('click', () => { video.muted = !video.muted; });
  $('seek').addEventListener('input', () => { video.currentTime = Number($('seek').value); updateClock(); });
  $('projection').addEventListener('click', () => changeProjection(!flat));
  $('reset-view').addEventListener('click', resetView);
  $('panorama').addEventListener('keydown', event => { if (event.key === 'Home') { event.preventDefault(); resetView(); } });
  $('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if ($('viewer').requestFullscreen) await $('viewer').requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    } catch { $('fullscreen').title = 'Fullscreen is unavailable in this browser'; }
  });
  if (!document.fullscreenEnabled && !video.webkitEnterFullscreen) $('fullscreen').hidden = true;
  document.addEventListener('fullscreenchange', () => {
    $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
    if (panorama) panorama.dirty = true;
  });
  $('retry').addEventListener('click', () => samples ? selectScene(currentKey) : initialize());
  document.querySelectorAll('[data-scene]').forEach(button => button.addEventListener('click', () => selectScene(button.dataset.scene)));
  document.querySelectorAll('[data-listen]').forEach(button => button.addEventListener('click', async () => {
    const key = button.dataset.listen;
    if (!samples?.[key]) return;
    if (currentKey !== key) selectScene(key);
    else if (video.readyState >= 1) video.currentTime = 0;
    video.muted = false;
    // Request playback within the user's click so sound is explicitly enabled.
    const playback = video.play();
    $('viewer').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    try { await playback; }
    catch (error) {
      if (currentKey === key && error.name !== 'AbortError') showError('Use Play scene to start this example, or open the video directly.');
    }
  }));
  for (const event of ['play', 'pause', 'ended']) video.addEventListener(event, updatePlay);
  for (const event of ['timeupdate', 'seeked']) video.addEventListener(event, updateClock);
  video.addEventListener('volumechange', updateSound);
  updateSound();
  initialize();
})();
