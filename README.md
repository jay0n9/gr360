# OmniEnv360

[Project page](https://jay0n9.github.io/gr360/)

From text to 360° environments you can look around and listen to — a project by Minjae Kim.

## Features

- Generate panoramic video scenes from text descriptions.
- Give each sounding object its own sound, placed where the object appears in the 360° scene.
- Replay short looping scenes in an interactive browser viewer.
- Inspect audiovisual correspondence in qualitative examples with one-click sound playback.

This repository contains the public project website and selected demo media only.
The research implementation, generation scripts, model details, and experiment
records are not included.

The site is published from `main` to GitHub Pages. Browser JavaScript provides
video playback, interactive panorama viewing, and a spatial audio preview.

The page shows twenty generated scenes, from a taiko festival and a blacksmith's
forge to a frozen lake and a dragon's cavern. Every scene is a 2048 × 1024
panorama with a five-second loop and first-order Ambisonics (ACN/SN3D) spatial
audio that follows the viewing direction; each video file also carries a stereo
mix of the same sound. Loudness is matched across scenes for listening.
Use headphones for the spatial preview. The examples are qualitative; perceptual
audio quality, source separation, and localization accuracy have not been validated.

Page layout inspired by [Spectral DeTuning](https://horwitz.ai/spectral_detuning).
