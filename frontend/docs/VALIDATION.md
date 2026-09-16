# Validation

## Verified in this workspace

- Expo SDK 57 dependencies were aligned to the versions declared by Expo SDK 57.
- Metro started using `expo start --go`.
- A running Metro instance served the **Nea / SDK 57.0.0 Android Expo Go manifest** successfully.
- Its Android development bundle compiled and returned successfully (4,699,211 bytes at this check).
- An Android Hermes export compiled successfully.
- All **7 React Native component integration tests passed**:
  1. Continue navigates to ISL with no initial chat messages and the reference video aspect ratio.
  2. Sending ISL produces the user sentence before the predefined response, without duplicate sends.
  3. All four modes switch; an in-flight reply stays attached to its original conversation.
  4. Text sends typed content, preserves per-mode drafts, and ignores whitespace-only input.
  5. Voice starts/stops its demo listening state and inserts its transcript.
  6. Reset clears messages and cancels pending replies.
  7. Fullscreen closes and the settings action navigates back to Welcome.

Tests use the real React Navigation stack, React Native components, and app state. Device safe-area measurements and native services use the test environment's substitutes.

## Layout implementation

The video uses its reference aspect ratio (657/568) and the full available content width. It does not depend on the number of messages. The body scrolls, messages wrap without a line limit, the app respects safe areas, and input fields sit above the keyboard using native Android resize behavior / iOS keyboard avoidance. The welcome screen can also scroll if space is limited.

## Not verified here

A physical Android phone / Expo Go runtime was not available. The available browser could not reach the local preview, so no rendered phone screenshots or pixel-by-pixel visual verification are claimed. Actual Android system fonts, safe-area insets, keyboard behavior, and display/font scaling should be checked on your demonstration phone.

The app contains no real ISL recognition, speech transcription, video processing, or model inference. Its media and replies are intentionally local frontend demonstrations.

## Final check on the demonstration phone

Run the commands in README.md, scan the QR with Expo Go for SDK 54, and try Continue → ISL arrow → automatic reply. Scroll back to the mode tabs, then try Text, Voice, and Video. Check the keyboard in Text mode and verify the last message remains reachable by scrolling. Use Settings → Start a new conversation before each presentation.
