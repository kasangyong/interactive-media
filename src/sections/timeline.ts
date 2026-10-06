import { createLoop } from '../core/loop';
import { scrollProgress } from '../core/pointer';

interface Milestone {
  year: string;
  title: string;
  body: string;
  img: string;
}

const ITEMS: Milestone[] = [
  {
    year: '1963',
    title: 'Sketchpad',
    body: '이반 서덜랜드가 라이트 펜으로 화면 위에 직접 도형을 그리고 조작했다. 그래픽 사용자 인터페이스의 출발점.',
    img: 'tl-1963',
  },
  {
    year: '1968',
    title: 'The Mother of All Demos',
    body: '더글러스 엥겔바트가 마우스, 하이퍼텍스트, 화상 협업을 한 무대에서 시연했다. 오늘날 컴퓨팅의 예고편.',
    img: 'tl-1968',
  },
  {
    year: '1970s',
    title: 'Videoplace',
    body: '마이런 크루거는 카메라로 관객의 실루엣을 읽어 화면 속 그래픽과 상호작용하게 했다. 몸 전체가 입력이 된 첫 작업들.',
    img: 'tl-1974',
  },
  {
    year: '1989',
    title: 'World Wide Web',
    body: '팀 버너스리가 CERN에서 하이퍼텍스트 문서 시스템을 제안했다. 링크를 누르는 행위가 전 세계의 기본 인터랙션이 된다.',
    img: 'tl-1989',
  },
  {
    year: '1996',
    title: 'Flash',
    body: '벡터 애니메이션과 스크립트가 웹에 들어오며 인터랙티브 웹사이트와 넷아트의 황금기가 열렸다.',
    img: 'tl-1996',
  },
  {
    year: '2011',
    title: 'WebGL',
    body: '플러그인 없이 브라우저에서 GPU를 직접 쓰게 되었다. 셰이더와 3D가 웹 페이지의 일부가 된다.',
    img: 'tl-2010',
  },
  {
    year: '2016',
    title: 'WebVR & Web Audio',
    body: '헤드셋과 공간 음향이 브라우저로 들어왔다. 화면을 보는 것에서 공간 안에 들어가는 것으로.',
    img: 'tl-2016',
  },
  {
    year: '2020s',
    title: 'On-device ML & WebGPU',
    body: '손 추적, 포즈 인식 같은 모델이 기기 안에서 실시간으로 돈다. 입력의 해상도가 몸짓과 표정까지 내려온다.',
    img: 'tl-2020',
  },
];

/** 세로 스크롤 → 가로 이동. 섹션은 sticky 로 고정되고 트랙만 움직인다 */
export function initTimeline(): void {
  const section = document.querySelector<HTMLElement>('#timeline');
  const track = section?.querySelector<HTMLElement>('[data-timeline]');
  const bar = section?.querySelector<HTMLElement>('.timeline__progress span');
  if (!section || !track) return;

  const base = import.meta.env.BASE_URL;
  track.innerHTML = ITEMS.map(
    (m, i) => `
    <article class="tl-card">
      <figure class="tl-card__img"><img src="${base}img/${m.img}.jpg" alt="" loading="lazy" decoding="async" /></figure>
      <div class="tl-card__meta"><span>${String(i + 1).padStart(2, '0')}</span><span>${m.year}</span></div>
      <h3>${m.title}</h3>
      <p>${m.body}</p>
    </article>`,
  ).join('');

  let p = 0;
  let maxShift = 0;
  const measure = () => {
    maxShift = Math.max(0, track.scrollWidth - window.innerWidth);
    // 이동 거리만큼 세로 스크롤 길이를 확보
    section.style.height = `${window.innerHeight + maxShift}px`;
  };
  measure();
  new ResizeObserver(measure).observe(track);
  window.addEventListener('resize', measure);

  const loop = createLoop(() => {
    p += (scrollProgress(section) - p) * 0.12;
    track.style.transform = `translate3d(${-p * maxShift}px, 0, 0)`;
    if (bar) bar.style.transform = `scaleX(${p})`;
  });
  new IntersectionObserver(([e]) => (e.isIntersecting ? loop.start() : loop.stop())).observe(section);
}
