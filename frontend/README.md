# Nea

A two-screen React Native + Expo Go frontend for the SIH demo. The ISL screen follows the supplied reference: a large photo window, a pale blue understanding panel, and readable conversation bubbles.

## Run on your Android phone

1. Extract this ZIP. Open the **nea** folder in VS Code.
2. Install Node.js LTS if it is not already installed. Node 22 LTS or 24 LTS works with this setup.
3. Open a terminal **inside the folder containing package.json** and run:

```sh
npm ci
npx expo start --go
```

4. Put your computer and Android phone on the same Wi-Fi network.
5. Open **Expo Go**, select **Scan QR code**, and scan the QR printed in your computer's terminal.
6. Tap **Continue**. ISL is already selected.

There is no account, API key, `.env` file, backend, or camera/microphone permission to configure. Keep the terminal running while demonstrating the app. An internet connection is needed to install the packages initially.

**Expo version:** this project uses **SDK 57**, matching the current Expo Go version shown in the supplied Android screenshot. If Expo Go reports an incompatible SDK later, update Expo Go from Google Play and keep the project's Expo dependencies aligned together.

## Demo walkthrough

| Action | Result |
| --- | --- |
| Continue | Opens the communication mode chooser |
| Select ISL | Opens the full ISL interface and hides the chooser |
| ISL → blue send arrow | Inserts the exam sentence as the first user message |
| Wait briefly | Shows the exact predefined Nea reply |
| Text | Shows the exam-support Brain Router mock; type below it to continue the chat |
| Voice | Tap the microphone to show listening; tap stop to send a fixed demo transcript |
| Video | Shows a camera placeholder and a working text conversation below |
| Fullscreen icon | Opens the static ISL image; close or Android Back returns |
| Settings → Change communication mode | Returns to the mode chooser without deleting messages |
| Settings → Start a new conversation | Clears all demo chats and enables the ISL arrow again |
| Settings → Back to welcome | Returns to the opening screen |

The mode chooser disappears as soon as a mode is selected. Use **Settings → Change communication mode** to return to it. Each mode retains its messages while the app remains open. Text and Video also retain their own drafts. Reloading the app clears everything.

The ISL user message always comes first. A 700 ms delay precedes the assistant response. Repeat taps cannot duplicate the ISL sentence. Reset also cancels any pending reply.

## Replace the demo image

Replace **assets/isl-exam-demo.jpg** with your own JPEG using that exact filename, then reload Expo Go. No code change is needed. Restart with `npx expo start --clear` if Metro keeps the old image.

The bundled photo is a crop of the user-supplied reference, including its original overlay pixels. The normal video window covers those old labels with the app's own controls. For the cleanest fullscreen presentation, replace it with an original photo without text or controls. This static photo and its scripted sentence do **not** demonstrate real ISL recognition or verify the meaning of the pictured sign.

The component uses `resizeMode="contain"` so the full reference photo remains visible. A photo around **657 × 568**, with both hands and the face comfortably inside the frame, best preserves the reference composition. The video keeps this aspect ratio on every phone and is never squeezed to make room for messages.

Replace **assets/logo.png** to use a different leaf mark. The included mark comes from the reference.

## Design choices

- System typography, navy `#123A8C`, blue `#4F7FF5`, and pale blue message surfaces.
- Title 27 px; understanding heading 20 px; translation 19 px; chat text 18 px.
- Reference video ratio: 657 ÷ 568. At 390 px screen width, its displayed size is approximately 362 × 313 px before system safe-area adjustments.
- A compact mode selector is the one additional element required by the brief.
- The ISL tagline is “Your everyday companion.” and the overlay says “ISL Translation”, following the written brief where it differs from the reference image.
- Normal system status/navigation bars are retained. The app does not draw the screenshot's iPhone bezel or fake status bar on an Android phone.
- Safe-area padding, flexible message widths, scrollable content, and a keyboard-aware composer handle smaller screens. Device font scaling remains enabled.

## Project files

```text
App.js
index.js
app.json
package.json
package-lock.json
src/
  theme.js
  screens/
    WelcomeScreen.js
    ChatScreen.js
  components/
    Logo.js
    ModeSelector.js
    ISLInput.js
    ChatBubble.js
    Composer.js
    VoiceInput.js
    VideoInput.js
assets/
  logo.png
  isl-exam-demo.jpg
docs/
  VALIDATION.md
```

`src/theme.js` contains the colors and scripted replies. `ISLInput.js` contains the video and translation layout. `ChatScreen.js` manages mode switching and in-memory messages. React Navigation supplies the two-screen stack.

## Dependency check

```sh
npm run check
```

Optional desktop preview:

```sh
npm run web
```

Runtime dependencies are Expo, React Native, React Navigation, their required native support libraries, icons, and Expo's font/asset support. React DOM and React Native Web only support the optional browser preview.

## If the QR does not connect

- Check that the terminal is running in this folder and that the phone and laptop share the same Wi-Fi network.
- Allow Node.js on **private networks** when Windows Firewall asks.
- Stop Metro with Ctrl+C, then run `npx expo start --go --clear`.
- If your network isolates devices, try a shared phone hotspot. Alternatively, `npx expo start --go --tunnel` uses Expo's optional tunnel setup and may ask to install its helper.
- For an SDK mismatch, install the matching Expo Go build as described above.

This is a frontend MVP. Voice and video are simulated, translations and replies are scripted, and no data is stored after a reload.

Setup references: [Expo Go compatibility](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/) · [React Navigation installation](https://reactnavigation.org/docs/getting-started/).
