# Joystick flight

Owner-requested controls revision, 2026-10-29. This prepares the side-view prototype for testing the eventual front-facing game's steering and combat. The camera remains side-on; continuous left/right movement in 3D is a later change.

## Play

- Touch anywhere in the field with the first finger. A faint joystick appears there. Drag upward to climb or downward to descend; a larger deflection moves faster. Return to its center or release to stop vertically and hold height.
- Tap a second finger to shoot while steering. Hold that finger for repeated shots. The firing finger does not become the joystick when the steering finger lifts.
- Quickly flick the steering finger left or right to dodge in that direction. This spends the existing dodge charges; Thrusters upgrades retain their extra-charge benefits. A slow horizontal drag does not dodge.
- On a keyboard, hold W/S or Up/Down to steer; press A/D or Left/Right to dodge; tap or hold F/Space to fire. A mouse drag also steers. Pause remains available.

There are no fixed flight pads. The joystick is a non-interactive visual guide, so it cannot intercept the firing finger. Neutral input holds altitude outside an active gravity well; the well's marked influence can gently drift the ship until you steer away. Vertical boundaries slow outward movement and clamp the ship without old floor-contact damage. Rocks, enemy shots and active hazard cores/bands still damage the ship.

## Input and save behavior

Movement and combat remain in the existing fixed 60 Hz simulation. A firing press buffers at most one shot for 0.18 seconds, so a quick press/release between frames is not lost. This can bridge a nearly finished weapon cooldown; it does not bypass cooldowns or queue a long burst.

Pause, focus loss, hidden tabs, resizing, stopping and leaving flight clear control ownership and pending fire. Resume requires fresh input. Depot checkpoints never retain held steering or shooting; older checkpoints migrate to neutral controls with their build intact.

Thrusters improve movement response and dodging. Emergency Brake improves neutral stopping instead of forcing an upward kick near the former fatal floor. Low-G/Heavy modify steering response without making a released ship drift vertically.

Phase 3 adds no input or camera mode. Use the same steering to leave a comet line or ion band, fire to destroy a comet or disarm a mine, and steer away from gravity cores. A mine gives a visible fuse before its ring explodes; moving out is always an alternative to shooting. The Depot forecast and Help field guide explain each family. See [HAZARDS.md](HAZARDS.md).

The completed evaluation package keeps these same controls. Preserve solar cover or leave the charged band; shoot a wreck's bright weak point, then avoid its warned fragments. Evade the Warden's frozen volley and fire during the open-core window. Chassis alter vertical steering speed/health, and targeting lenses trade aim width against projectile speed. Flight Trials offer immediate practice plus Pause/Retry, with no extra flight pads. See [EVALUATION.md](EVALUATION.md).

## Browser gestures

Portrait and landscape are both supported automatically. Turn the phone sideways with system rotation lock off. A screen-size change pauses active flight, preserves the same run/build, and releases controls; choose Resume and begin a fresh gesture. The field and dialogs stay inside the side safe areas, and dynamic viewport height tracks mobile browser bars. The game does not force fullscreen or attempt to override the phone's orientation setting.

Stage resize observation and viewport/orientation events are combined into one resize per animation frame. Temporary zero-size measurements are ignored; duplicate same-size events preserve held input and do not clear the canvas bitmap. The [VisualViewport API](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport) supplies additional mobile resize notifications (documentation checked 2026-10-30).

The gameplay canvas declares `touch-action: none` before contact, with cancelable touch-event guards for mobile browsers. Interactive menu controls use `touch-action: manipulation` to suppress double-tap zoom while preserving scrolling. Menu scrolling and browser zoom outside the playfield remain available; global viewport zoom restrictions are removed.

This follows the [MDN touch-action guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action), checked 2026-10-29: browser gesture intent must be declared before a touch starts. Physical Safari/Chrome phone testing is still required; DOM cancellation tests cannot prove actual device behavior.

See [VALIDATION.md](VALIDATION.md) for executed checks and remaining playtest limits.
