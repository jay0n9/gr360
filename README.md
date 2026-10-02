# GR360

[Project page](https://jay0n9.github.io/gr360/)

From text to 360° environments you can look around and listen to — a project by Minjae Kim.

## Features

- Generate panoramic video scenes from text descriptions.
- Generate spatial audio that places sounds within the 360° environment.
- Replay short environmental scenes in an interactive browser viewer.
- Inspect audiovisual correspondence in qualitative examples with one-click sound playback.

This repository contains the public project website and selected demo media only.
The research implementation, generation scripts, model details, and experiment
records are not included.

The site is published from `main` to GitHub Pages. Browser JavaScript provides
video playback, interactive panorama viewing, and a spatial audio preview.

The selected demos are **Blue hour in the courtyard** (stereo audio),
**Morning on the silver lake**, **Peach light on the cove**,
**A quiet jade garden**, and **Rose dawn in the alpine meadow** (spatial audio
that follows the viewing direction).
Use headphones for the spatial preview. The examples are qualitative; perceptual
audio quality, source separation, and localization accuracy have not been validated.

Page layout inspired by [Spectral DeTuning](https://horwitz.ai/spectral_detuning).

All four spatial-audio scenes use 4096 × 2048 upscaled video, with their original
spatial audio preserved. Blue hour in the courtyard remains 2048 × 1024.
All clips are five seconds long.
