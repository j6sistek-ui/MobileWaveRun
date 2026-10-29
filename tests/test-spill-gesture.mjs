import assert from 'node:assert/strict';
import { createSpillStick, moveSpillStick, sampleSpillStick, spillStickAxis } from '../dist/js/spill-gesture.js';

let cases = 0;
function test(name, run) { run(); cases++; console.log(`gesture: ${name}`); }

test('the first contact establishes a neutral CSS-pixel origin, including near edges', () => {
  for (const [x, y] of [[2, 3], [150, 370], [388, 758]]) {
    const stick = createSpillStick(17, x, y, 0);
    assert.equal(stick.owner, 17);
    assert.equal(stick.x0, x); assert.equal(stick.y0, y);
    assert.equal(spillStickAxis(stick), 0);
    sampleSpillStick(stick, 1000);
    assert.equal(spillStickAxis(stick), 0, 'a stationary finger cannot acquire a steering bias');
  }
});

test('small hand jitter stays neutral and larger vertical drag remains analog', () => {
  const stick = createSpillStick(1, 100, 200, 0);
  for (const offset of [-3, 2, -1, 3]) {
    moveSpillStick(stick, 101, 200 + offset, 20);
    assert.equal(spillStickAxis(stick), 0);
  }
  moveSpillStick(stick, 100, 212, 40); const small = spillStickAxis(stick);
  moveSpillStick(stick, 100, 224, 60); const large = spillStickAxis(stick);
  assert(small > 0 && large > small && large < 1);
  moveSpillStick(stick, 100, 500, 80); assert.equal(spillStickAxis(stick), 1);
  moveSpillStick(stick, 100, -100, 100); assert.equal(spillStickAxis(stick), -1);
  moveSpillStick(stick, 100, 200, 120); assert.equal(spillStickAxis(stick), 0);
});

test('screen position does not change joystick sensitivity', () => {
  const low = createSpillStick(1, 10, 20, 0), high = createSpillStick(2, 310, 700, 0);
  moveSpillStick(low, 10, 42, 100); moveSpillStick(high, 310, 722, 100);
  assert.equal(spillStickAxis(low), spillStickAxis(high));
});

test('a quick horizontal flick produces the correct sign in either direction', () => {
  for (const direction of [-1, 1]) {
    const stick = createSpillStick(1, 100, 200, 0);
    assert.equal(moveSpillStick(stick, 100 + direction * 45, 202, 50), direction);
    assert.equal(stick.x0, 100); assert.equal(stick.y0, 200, 'a dodge does not move the neutral origin');
    assert.equal(spillStickAxis(stick), 0);
  }
});

test('fast vertical and diagonal steering cannot become a horizontal dodge', () => {
  for (const [dx, dy] of [[2, -60], [-2, 60], [50, 45], [-50, -45], [30, 30]]) {
    const stick = createSpillStick(1, 100, 200, 0);
    assert.equal(moveSpillStick(stick, 100 + dx, 200 + dy, 40), 0);
    assert.equal(Math.sign(spillStickAxis(stick)), Math.sign(dy));
  }
});

test('a slow drag never accumulates into a flick', () => {
  const stick = createSpillStick(1, 100, 200, 0);
  for (let i = 1; i <= 30; i++) {
    assert.equal(moveSpillStick(stick, 100 + i * 8, 200, i * 40), 0);
  }
});

test('a recent flick works after a long stationary hold', () => {
  for (const direction of [-1, 1]) {
    const stick = createSpillStick(1, 100, 200, 0);
    for (let time = 16; time <= 10000; time += 16) sampleSpillStick(stick, time);
    assert(stick.samples.length <= 10, 'history remains bounded during a long hold');
    assert.equal(moveSpillStick(stick, 100 + direction * 40, 200, 10050), direction,
      '40 px in 50 ms is a flick; old stationary time cannot dilute its speed');
  }
});

test('a later flick preserves the vertical position being held', () => {
  const stick = createSpillStick(1, 100, 200, 0);
  moveSpillStick(stick, 100, 224, 200);
  for (let time = 216; time <= 1000; time += 16) sampleSpillStick(stick, time);
  const before = spillStickAxis(stick);
  assert.equal(moveSpillStick(stick, 145, 224, 1050), 1);
  assert.equal(spillStickAxis(stick), before);
});

test('cooldown prevents a second dodge, then permits a fresh opposite flick', () => {
  const stick = createSpillStick(1, 100, 200, 0);
  assert.equal(moveSpillStick(stick, 145, 200, 50), 1);
  assert.equal(moveSpillStick(stick, 195, 200, 90), 0);
  for (let time = 106; time <= 330; time += 16) sampleSpillStick(stick, time);
  assert.equal(moveSpillStick(stick, 150, 200, 380), -1);
});

test('holding the final point never repeats a dodge', () => {
  const stick = createSpillStick(1, 100, 200, 0);
  assert.equal(moveSpillStick(stick, 145, 200, 50), 1);
  for (let time = 66; time < 1000; time += 16) {
    sampleSpillStick(stick, time);
    assert.equal(moveSpillStick(stick, 145, 200, time), 0);
  }
});

test('a new touch resets previous displacement and flick history', () => {
  const old = createSpillStick(1, 100, 200, 0);
  moveSpillStick(old, 180, 250, 40);
  const fresh = createSpillStick(2, 180, 250, 500);
  assert.equal(spillStickAxis(fresh), 0);
  assert.equal(moveSpillStick(fresh, 181, 251, 520), 0);
});

console.log(`${cases} pure gesture cases passed`);
