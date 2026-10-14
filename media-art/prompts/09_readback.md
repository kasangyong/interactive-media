# 9차 지시 — 진짜 병목은 getImageData (프로파일 근거)

8차 결과: 바다 2막 여전히 20fps(나머지 장면은 57~60). 8차의 속도장 격자는 유지해도 되지만 **원인이 아니었다.** 디렉터 쪽에서 Chrome 프로파일러(Intel Iris Xe, D3D11)로 바다 2막을 3초 쟀다.

```
프레임당 rAF 콜백(JS) 17.9ms / 프레임 24.4ms (≈41fps, 측정 오버헤드 포함)
자체 시간 비율:
77.3%  getImageData            ← 병목
 2.4%  step
 1.8%  (garbage collector)
 1.3%  finishFrame
```

## 원인
블룸의 밝기 임계값 처리에서 `getImageData`로 캔버스 픽셀을 읽는다. GPU 가속 캔버스에서 픽셀을 읽으면 GPU→CPU 동기 복사가 일어나 파이프라인이 멈춘다. 블룸 캔버스가 작아도(320×180) 원본 메인 캔버스 쪽 상태를 동기화해야 해서 비싸다.

## 조치
1. **코드 전체에서 `getImageData`·`putImageData`·`toDataURL`·`readPixels`를 매 프레임 경로에서 완전히 제거.** (시작할 때 한 번 노이즈 타일을 만드는 용도는 괜찮다.)
2. 블룸은 "축소 복사 → CSS"만으로:
   - 2프레임에 한 번 `bloomCtx.drawImage(mainCanvas, 0, 0, 320, 180)`만 한다.
   - 임계값은 CSS로: 블룸 캔버스 요소에 `filter: brightness(.55) contrast(2.4) blur(8px)`(작품별 조정) + `mix-blend-mode: screen`. contrast가 어두운 부분을 검정으로 눌러 임계값 역할을 한다. 전부 GPU 합성기에서 처리된다.
   - 블랙 레벨이 다시 뜨지 않는지 확인(검증 기준: 모서리 밝기 14 이하. 7·8차는 4.7~7.5로 좋았다).
3. 다른 작품도 같은 블룸 함수를 쓰면 함께 고쳐진다. 화면 결과는 7·8차와 최대한 같게.

`NOTES.md`에 9차 변경(프로파일 근거 포함)을 추가. 회사명·인명 금지. git commit 금지, 폴더 밖 수정 금지.
