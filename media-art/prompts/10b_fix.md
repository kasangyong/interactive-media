# 10차 보완 — 실행 오류 (자동 검증 결과)

새 숲이 브라우저에서 실행 중 예외를 던져 애니메이션 루프가 멈췄다. 이 때문에 작품 시계가 흐르지 않고(실제 2초 동안 0초) 48초 뒤 다음 작품으로 넘어가지도 않는다.

```
pageerror: Failed to execute 'drawImage' on 'CanvasRenderingContext2D': The provided value is not of type '(CSSImageValue or HTMLCanvasElement or HTMLImageElement or HTMLVideoElement or ImageBitmap or OffscreenCanvas or SVGImageElement or VideoFrame)'.
```

- `drawImage` 첫 인자로 넘기는 스프라이트(빛줄기·안개 타일·포자 등)가 정의되기 전이거나 `undefined`/일반 객체인 경로가 있다. 특히 `init()`/`seek()` 이전, 리사이즈 직후, 막 점프 직후 첫 프레임을 확인하라.
- 스프라이트는 작품 `init()`에서 전부 만들고, 리사이즈 때 다시 만든다. `drawImage` 직전에 존재를 가정하지 말고 생성 순서를 보장하라.
- 프레임 루프 한 번의 예외가 전체를 멈추지 않도록, `frame()` 안에서 작품 `step()` 호출을 try/catch로 감싸고 `console.error`로 한 번만 남겨라(검증은 콘솔 오류도 실패로 보므로 근본 원인은 반드시 고칠 것).
- 숲 디자인(10차)은 그대로 유지. 다른 작품 손대지 말 것. git commit 금지, 폴더 밖 수정 금지.
