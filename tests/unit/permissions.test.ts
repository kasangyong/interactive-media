import { afterEach, expect, test, vi } from 'vitest';
import { requestCamera, requestMicrophone, requestMotion } from '../../src/core/permissions';

afterEach(() => vi.unstubAllGlobals());

function stubMedia(impl: () => Promise<MediaStream>) {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(impl) } });
}

const named = (name: string) => Object.assign(new Error(name), { name });

test('NotAllowedError → denied', async () => {
  stubMedia(() => Promise.reject(named('NotAllowedError')));
  const r = await requestCamera();
  expect(r).toMatchObject({ ok: false, reason: 'denied' });
});

test('missing mediaDevices → unsupported', async () => {
  vi.stubGlobal('navigator', {});
  const r = await requestMicrophone();
  expect(r).toMatchObject({ ok: false, reason: 'unsupported' });
});

test('NotFoundError → unsupported, other errors → error', async () => {
  stubMedia(() => Promise.reject(named('NotFoundError')));
  expect(await requestCamera()).toMatchObject({ ok: false, reason: 'unsupported' });
  stubMedia(() => Promise.reject(named('NotReadableError')));
  expect(await requestCamera()).toMatchObject({ ok: false, reason: 'error' });
});

test('success returns the stream', async () => {
  const stream = {} as MediaStream;
  stubMedia(() => Promise.resolve(stream));
  expect(await requestMicrophone()).toEqual({ ok: true, value: stream });
});

test('motion: no requestPermission → ok, denied → denied', async () => {
  vi.stubGlobal('DeviceOrientationEvent', class {});
  expect(await requestMotion()).toEqual({ ok: true, value: true });
  vi.stubGlobal('DeviceOrientationEvent', Object.assign(class {}, { requestPermission: () => Promise.resolve('denied') }));
  expect(await requestMotion()).toMatchObject({ ok: false, reason: 'denied' });
});
