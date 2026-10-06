/** Ashima Arts 3D simplex noise (MIT) — snoise(vec3) */
export const SNOISE3 = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

/**
 * 노이즈로 구 표면을 변위시키고, 이웃 두 점으로 법선을 재계산하는 버텍스 셰이더 본문.
 * uniform: uTime, uAmp, uFreq, uPointer(vec3, 월드 방향) 를 사용한다.
 */
export const DISPLACE_VERT = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform vec3 uPointer;
uniform float uPointerForce;
varying vec3 vNormal;
varying vec3 vViewDir;
varying float vDisp;
${SNOISE3}
float disp(vec3 p){
  float n = snoise(p * uFreq + vec3(0.0, uTime * 0.25, uTime * 0.1));
  n += 0.5 * snoise(p * uFreq * 2.1 - vec3(uTime * 0.2));
  float bump = smoothstep(0.55, 1.0, dot(normalize(p), uPointer)) * uPointerForce;
  return n * uAmp + bump;
}
vec3 orthogonal(vec3 v){
  return normalize(abs(v.x) > abs(v.z) ? vec3(-v.y, v.x, 0.0) : vec3(0.0, -v.z, v.y));
}
void main(){
  vec3 n = normalize(position);
  vec3 t = orthogonal(n);
  vec3 b = normalize(cross(n, t));
  float eps = 0.01;
  vec3 p0 = position + n * disp(position);
  vec3 p1 = position + t * eps; p1 += normalize(p1) * disp(p1);
  vec3 p2 = position + b * eps; p2 += normalize(p2) * disp(p2);
  vec3 dn = normalize(cross(p1 - p0, p2 - p0));
  vDisp = disp(position);
  vec4 world = modelMatrix * vec4(p0, 1.0);
  vNormal = normalize(mat3(modelMatrix) * dn);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/** 프레넬 림 + 이리데슨트 컬러 */
export const IRIDESCENT_FRAG = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uRim;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vViewDir;
varying float vDisp;
void main(){
  vec3 n = normalize(vNormal);
  float fres = pow(1.0 - max(dot(n, vViewDir), 0.0), 2.4);
  float band = 0.5 + 0.5 * sin(vDisp * 9.0 + n.y * 3.0);
  vec3 base = mix(uColorA, uColorB, band);
  float light = 0.35 + 0.65 * max(dot(n, normalize(vec3(0.4, 0.8, 0.6))), 0.0);
  vec3 col = base * light + uRim * fres * 1.4;
  gl_FragColor = vec4(col, uOpacity);
}
`;
