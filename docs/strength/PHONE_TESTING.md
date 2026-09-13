# Strength on a phone

## Which version supports the camera?

- **Phone browser:** camera tracking for Bodyweight squat, Wall push-up, and Standing side-leg raise. Other movements use guided mode.
- **Expo Go / native app:** camera-free guided Strength. This repository does not contain an Android/iOS MediaPipe module; changing the web camera code cannot enable native pose tracking.

## Open the app securely

Phone browsers require **HTTPS** for camera access. `http://192.168.x.x:8081` is not a secure camera origin. `localhost` on a phone means the phone itself, not your computer.

Use a trusted HTTPS deployment of Bloom's web export, including the entire `strength/` asset directory. No third-party model CDN or camera upload service is required. Do not expose the current development-auth configuration or Meg reverse proxy publicly to obtain a phone preview. Production authentication must be configured before publishing.

For an Android development phone already connected to Android Debug Bridge over USB, port forwarding is an alternative that keeps the server local:

```sh
# Run in wholebloom
npx expo start --port 8081 --localhost

# In another terminal, with the intended phone selected
adb -s YOUR_DEVICE_SERIAL reverse tcp:8081 tcp:8081
```

Then open `http://localhost:8081` in Chrome **on that Android phone**. Remove the forwarding afterward with `adb -s YOUR_DEVICE_SERIAL reverse --remove tcp:8081`. This requires an installed Android SDK, USB debugging, and the phone's authorization. It is not an iPhone setup.

## Session checks

1. Open Strength, select a camera-supported movement, choose two sets, and press Start. The camera must remain off until **Enable camera**.
2. Allow camera access. Prop the phone securely, keep head and feet visible, and follow the requested front/side view. No frames are recorded or uploaded.
3. After framing completes, press **Begin set**. Check that the pose lines align in portrait and landscape. **Hide pose lines** must work independently of tracking.
4. Complete a set. During rest, the camera remains live and **Continue · set 2** starts the next set without another permission prompt.
5. Pause/resume, switch browser tabs, and stop midway through the next set. Verify the saved rep total includes the first set. Closing or leaving the session releases the camera.
6. Deny permission, retry, and choose **Continue guided**. Check narrow screens, rotation, large text, and the full summary scroll area.

## Automated checks

```sh
npm test
npm run typecheck
npm run build:web
# With Expo web running and the local development account enabled:
node scripts/strength-smoke.cjs
```

The browser smoke test supplies a synthetic canvas MediaStream (not your webcam), runs the real local MediaPipe model, and separately drives a synthetic pose fixture through calibration, reps, rest, pause/resume, and save. Permission denial is simulated. It does not validate real-person form accuracy, OS permission prompts, or physical iPhone/Android performance.

Physical-phone camera testing is still required before release. The movement thresholds remain pending professional review.

References: [browser camera security](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [MediaPipe web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js).
