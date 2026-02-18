import { describe, it } from 'node:test';
import assert from 'node:assert';
import { extractCaptions } from './extract-captions.js';

describe('extractCaptions', () => {
  it('returns empty steps when no Sequence with Caption is present', () => {
    const source = '<AbsoluteFill><div>Hello</div></AbsoluteFill>';
    const result = extractCaptions(source, 30);
    assert.strictEqual(result.fps, 30);
    assert.deepStrictEqual(result.steps, []);
  });

  it('extracts single Caption from a Sequence', () => {
    const source = `
      <Sequence from={0} durationInFrames={90}>
        <Intro title="Hi" />
      </Sequence>
      <Sequence from={90} durationInFrames={90}>
        <ScreenFrame src="a.png" />
        <Caption text="This is the dashboard." theme={theme} />
      </Sequence>
    `;
    const result = extractCaptions(source, 30);
    assert.strictEqual(result.fps, 30);
    assert.strictEqual(result.steps.length, 1);
    assert.strictEqual(result.steps[0].from, 90);
    assert.strictEqual(result.steps[0].durationInFrames, 90);
    assert.strictEqual(result.steps[0].durationSeconds, 3);
    assert.strictEqual(result.steps[0].startSeconds, 3);
    assert.strictEqual(result.steps[0].text, 'This is the dashboard.');
  });

  it('extracts multiple Captions from multiple Sequences', () => {
    const source = `
      <Sequence from={0} durationInFrames={90}>
        <Intro title="Hi" />
      </Sequence>
      <Sequence from={90} durationInFrames={75}>
        <Caption text="First step." theme={theme} />
      </Sequence>
      <Sequence from={165} durationInFrames={90}>
        <Caption text="Second step." theme={theme} />
      </Sequence>
    `;
    const result = extractCaptions(source, 30);
    assert.strictEqual(result.steps.length, 2);
    assert.strictEqual(result.steps[0].text, 'First step.');
    assert.strictEqual(result.steps[0].startSeconds, 3);
    assert.strictEqual(result.steps[1].text, 'Second step.');
    assert.strictEqual(result.steps[1].from, 165);
  });

  it('uses custom fps for durationSeconds and startSeconds', () => {
    const source = `
      <Sequence from={60} durationInFrames={60}>
        <Caption text="One second at 60fps." theme={theme} />
      </Sequence>
    `;
    const result = extractCaptions(source, 60);
    assert.strictEqual(result.fps, 60);
    assert.strictEqual(result.steps[0].startSeconds, 1);
    assert.strictEqual(result.steps[0].durationSeconds, 1);
  });

  it('matches Caption with single-quoted text', () => {
    const source = `<Sequence from={0} durationInFrames={30}><Caption text='Single quotes' theme={theme} /></Sequence>`;
    const result = extractCaptions(source, 30);
    assert.strictEqual(result.steps.length, 1);
    assert.strictEqual(result.steps[0].text, 'Single quotes');
  });
});
