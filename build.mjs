// Helm: a keyboard for a voice-first desk. Build with `node build.mjs` (add --light for the light theme).
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = process.env.ANATOMY_KIT || join(homedir(), ".claude/skills/anatomy");
const k = await import(pathToFileURL(join(SKILL, "kit/iso-kit.mjs")).href);
const { kitScript } = await import(pathToFileURL(join(SKILL, "scripts/inline-kit.mjs")).href);
const { brief, nav, eyebrow } = await import(pathToFileURL(join(HERE, "brief.mjs")).href);
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 720;
const HEIGHT = 388;

// World units are millimetres: x and y on the bench, z up.
const C = {
  PLATE: { x: -164, y: -72, w: 330, d: 182, r: 10 },
  PLATE_H: 8,
  FOOT_H: 5,
  DECK: { x: -150, y: -58, w: 300, d: 108, r: 9 },
  Z0: 3,
  TOP: 21,
  FRONT: 50,
  SIDE: 150,
  RISER: { x: -100, y: -54, w: 180, d: 12, r: 2 },
  RISER_H: 23,
  WIN: { x0: -94, x1: 74, z0: 29.8, z1: 40.4, r: 1.6, depth: 1.2 },
  MIC: { x: -126, y: -44, r: 4.6, len: 15, travel: 14.2, collar: 2.4 },
  AK: { x: -116, y: -31, w: 26, d: 22, gap: 4, n: 5, h: 6.4, z: 23.6, rise: 6 },
  LAD: { x: -96, y: -3.6, w: 124, d: 5, n: 30 },
  BAR: { x: -100, y: 10, w: 132, d: 24, r: 4, z: 23, h: 6.4, down: 2.2 },
  HALT: { x: -126, y: 22, down: 3 },
  T: { x: 62, y: 20, z0: 24, cap: 49, nutH: 4, nutR: 8.6, coilR: 5.6, capR: 10.5, capH: 5.4, travel: 4, wind: 11, px: 0, py: 0 },
  G: { x: 90, y: 35, r: 8.5, top: 26.5, max: 8 },
  LB: { x: 92, y: -53, w: 50, d: 17, r: 3, top: 25.6, x0: 100.5, step: 11, sy: -44.5 },
  W: { x: 122, y: 22, r: 17, top: 28.6 },
  DR: { x0: -74, x1: 36, z0: 5.6, z1: 15.6, out: 46 },
  U: 9.6,
  // The model. Speech and typing rates are the usual round figures for conversational English.
  SPEAK_WPM: 150,
  TYPE_WPM: 40,
  F_MIN: 0.5, // newtons of spring preload at stakes 0: an ordinary light key
  F_SPAN: 5.5, // added at stakes 1
  K: 0.5, // spring rate, N/mm
  LEASH: [["watch", 0], ["ask", 0.2], ["act", 0.5], ["run", 0.8]],
  PHRASES: [
    "find trains to berlin friday",
    "draft a reply to mara",
    "book the 9:10 and pay 86 euro",
    "send the contract to legal",
    "delete last year’s backups",
  ],
  ROWS: ["qwertyuiop", "asdfghjkl", "zxcvbnm"],
};

const P = k.fitProjection(
  [...k.boxCorners(C.PLATE, -C.PLATE_H - C.FOOT_H, 0), ...k.boxCorners(C.DECK, 0, 56)],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 58, elevation: 33 },
);
{
  // The pinion stands beside the nut, square to the view, so the mesh is seen side on.
  const [vx, vy] = k.towardViewer(P);
  C.T.px = +(C.T.x + 11.3 * vy).toFixed(2);
  C.T.py = +(C.T.y - 11.3 * vx).toFixed(2);
}

// How much is at stake in an instruction, 0 to 1, read from its verb.
function stakesOf(text) {
  const table = [
    [/\b(delete|erase|wipe|remove|destroy|cancel)\b/, 0.95],
    [/\b(pay|buy|book|order|transfer|wire|sign)\b/, 0.62],
    [/\b(send|post|publish|share|email|invite)\b/, 0.45],
    [/\b(draft|write|make|plan|sketch|summarise|summarize)\b/, 0.2],
    [/\b(find|show|search|read|check|list|compare|look)\b/, 0.05],
  ];
  let stakes = -1;
  for (const [pattern, value] of table) if (pattern.test(text.toLowerCase())) stakes = Math.max(stakes, value);
  return stakes < 0 ? 0.3 : stakes;
}

// Force on the finger, in newtons, with the nut wound `wind` mm and the cap pressed `drop` mm.
function forceAt(wind, drop) {
  return C.F_MIN + (wind / C.T.wind) * C.F_SPAN + C.K * drop;
}

// A coil spring on a vertical axis, split into the half behind its rod and the half in front.
function vcoil(cx, cy, r, z0, z1, turns) {
  const count = Math.round(turns * 18);
  const [vx, vy] = k.towardViewer(P);
  const back = [];
  const front = [];
  let run = [];
  let near = null;
  for (let index = 0; index <= count; index++) {
    const share = index / count;
    const angle = share * turns * Math.PI * 2;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const facing = nx * vx + ny * vy > 0;
    const flat = k.iso([cx + r * nx, cy + r * ny, z0 + (z1 - z0) * share], P);
    if (near === null) near = facing;
    if (facing !== near) {
      run.push(flat);
      (near ? front : back).push(k.pathOf(run));
      run = [flat];
      near = facing;
      continue;
    }
    run.push(flat);
  }
  if (run.length > 1) (near ? front : back).push(k.pathOf(run));
  return { back: back.join(""), front: front.join("") };
}

// The consent key: a cap on a spring whose seat is a nut that climbs a threaded post.
function towerSvg(wind, drop) {
  const T = C.T;
  const nutZ = T.z0 + wind;
  const nutTop = nutZ + T.nutH;
  const capZ = T.cap - drop;
  const threads = (from, to) => {
    const arcs = [];
    for (let z = 25.5; z < 48.6; z += 1.5) if (z > from + 0.5 && z < to - 0.4) arcs.push(k.sideArc(T.x, T.y, 2.1, z, P, 10));
    return k.lineSvg(arcs.join(""), { tone: "faint" });
  };
  const out = [];
  if (wind > 0.3) out.push(k.solidSvg(k.cylinder(T.x, T.y, 2.1, T.z0, wind, P, 18), { tone: "mid", crease: "none", inner: threads(T.z0, nutZ) }));
  out.push(
    k.solidSvg(k.cylinder(T.x, T.y, T.nutR, nutZ, T.nutH, P, 44, 0.5), {
      tone: "mid",
      inner: k.lineSvg(k.knurl(T.x, T.y, T.nutR, nutZ, nutTop, 40, P, 0.3), { tone: "lo" }),
    }),
  );
  out.push(k.lineSvg(k.ring(T.x, T.y, T.coilR, nutTop, P, 32), { tone: "lo" }));
  const spring = vcoil(T.x, T.y, T.coilR, nutTop, capZ, 5.5);
  out.push(k.lineSvg(spring.back, { tone: "lo" }));
  out.push(k.solidSvg(k.cylinder(T.x, T.y, 2.1, nutTop, capZ - nutTop, P, 18), { tone: "mid", crease: "none", inner: threads(nutTop, capZ) }));
  out.push(k.lineSvg(spring.front, { tone: "hi" }));
  const top = capZ + T.capH;
  out.push(k.solidSvg(k.cylinder(T.x, T.y, T.capR, capZ, T.capH, P, 52, 1), { tone: "hi", crease: "lo", lit: true }));
  out.push(k.lineSvg(k.ring(T.x, T.y, 6.8, top, P, 40), { tone: "mid" }));
  out.push(k.dotsSvg([k.iso([T.x, T.y, top], P)], { size: 0.7, tone: "hi" }));
  return out.join("");
}

function needleD(force) {
  const G = C.G;
  const angle = -Math.PI * 0.75 + (Math.min(G.max, Math.max(0, force)) / G.max) * Math.PI * 1.5;
  const sx = Math.sin(angle);
  const sy = -Math.cos(angle);
  return k.lineOnTop([G.x - sx * 1.8, G.y - sy * 1.8], [G.x + sx * 5.6, G.y + sy * 5.6], G.top + 0.1, P);
}

// What turns on the undo wheel: its ticks and the finger dimple.
function wheelSvg(angle) {
  const W = C.W;
  const ticks = k.radialTicks(W.x, W.y, 16.2, 60, 5, W.top, [1.3, 2.9], P, angle);
  const dx = W.x + Math.sin(angle + Math.PI) * 10;
  const dy = W.y - Math.cos(angle + Math.PI) * 10;
  return (
    k.lineSvg(ticks.minor, { tone: "lo" }) +
    k.lineSvg(ticks.major, { tone: "mid" }) +
    k.lineSvg(k.ring(dx, dy, 2.9, W.top, P, 20), { tone: "mid" }) +
    k.dotsSvg([k.iso([dx, dy, W.top], P)], { size: 0.6, tone: "hi" })
  );
}

// The progress bar in an agent key's window, at share 0 to 1.
function barD(index, share) {
  const A = C.AK;
  const x = A.x + index * (A.w + A.gap) + 4.4;
  const y = A.y + 4.5;
  if (share <= 0.005) return "";
  const to = x + 17.2 * Math.min(1, share);
  return k.onTop([[x, y], [to, y], [to, y + 3.8], [x, y + 3.8]], A.z + A.h, P, true);
}

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dt = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const planeOf = (y) => k.sideMatrix([0, y], 0, P, "left");
const flat = (x0, z0, x1, z1, r, steps = 6) => k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps).map(([u, z]) => [u, -z]), true);
const rectY = (x0, z0, x1, z1, r, y, steps = 4) => k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps).map(([x, z]) => at([x, y, z])), true);
const rectX = (y0, z0, y1, z1, r, x, steps = 4) => k.pathOf(k.roundedPlan({ x: y0, y: z0, w: y1 - y0, d: z1 - z0, r }, steps).map(([y, z]) => at([x, y, z])), true);
const TOP = C.TOP;

let clips = 0;
// A window let into a face that looks along +y, with its inner walls shaded by facing.
function recess({ x0, x1, z0, z1, r, depth }, y, back) {
  const id = `hm-clip-${clips++}`;
  const ring = k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, 6);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const { sinA } = k.cameraOf(P);
  const tops = [];
  const sides = [[], [], [], []];
  ring.forEach(([ax, az], index) => {
    const [bx, bz] = ring[(index + 1) % ring.length];
    const length = Math.hypot(bx - ax, bz - az) || 1;
    let [nx, nz] = [(bz - az) / length, -(bx - ax) / length];
    if (nx * (cx - (ax + bx) / 2) + nz * (cz - (az + bz) / 2) < 0) [nx, nz] = [-nx, -nz];
    if (nx <= 0 && nz <= 0) return;
    const quad = k.pathOf([at([ax, y, az]), at([bx, y, bz]), at([bx, y - depth, bz]), at([ax, y - depth, az])], true);
    if (nz >= nx) tops.push(quad);
    else sides[Math.min(3, Math.max(0, Math.floor(((nx * -sinA + 1) / 2) * 4)))].push(quad);
  });
  const shape = flat(x0, z0, x1, z1, r);
  return [
    `<clipPath id="${id}"><path transform="${planeOf(y)}" d="${shape}"/></clipPath>`,
    `<g clip-path="url(#${id})">`,
    `<path class="iso-top" d="${tops.join("")}"/>`,
    ...sides.map((d, shade) => (d.length ? `<path class="iso-shade" data-shade="${shade}" d="${d.join("")}"/>` : "")),
    `<g transform="${planeOf(y - depth)}"><path class="hm-dark" d="${shape}"/>${back}<path class="iso-line" data-tone="faint" d="${shape}"/></g>`,
    `</g>`,
    `<g transform="${planeOf(y)}"><path class="iso-line" data-tone="lo" d="${shape}"/></g>`,
  ].join("");
}

// A smooth curve through 3D points (Catmull-Rom), projected.
function curve(points, per = 10) {
  const out = [];
  const get = (index) => points[Math.min(points.length - 1, Math.max(0, index))];
  for (let index = 0; index < points.length - 1; index++) {
    const [a, b, c, d] = [get(index - 1), get(index), get(index + 1), get(index + 2)];
    for (let step = 0; step < per; step++) {
      const t = step / per;
      out.push(
        [0, 1, 2].map((axis) => 0.5 * (2 * b[axis] + (c[axis] - a[axis]) * t + (2 * a[axis] - 5 * b[axis] + 4 * c[axis] - d[axis]) * t * t + (3 * b[axis] - a[axis] - 3 * c[axis] + d[axis]) * t * t * t)),
      );
    }
  }
  out.push(points[points.length - 1]);
  return k.pathOf(out.map(at));
}

function plate() {
  const { PLATE, PLATE_H, FOOT_H, DR } = C;
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 24))) {
    out.push(S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6.2, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -5.4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dt(screws.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
  // The bay the letter drawer opens into, and the ruler that measures how far it is out.
  const bay = { x: DR.x0 - 2.5, y: 53.5, w: DR.x1 - DR.x0 + 5, d: 55, r: 2.5 };
  out.push(L(k.planOutline(bay, 0, P, 4), { tone: "faint" }));
  const strip = { x: DR.x1 + 7, y: 52.6, w: 7.5, d: 50, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const minor = [];
  const major = [];
  for (let index = 0; index <= 23; index++) {
    const y = strip.y + 2 + index * 2;
    (index % 5 === 0 ? major : minor).push(k.lineOnTop([strip.x, y], [strip.x + (index % 5 === 0 ? 4.4 : 2.6), y], 0.6, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(Dt([at([strip.x + 5.9, strip.y + 2, 0.6]), at([strip.x + 5.9, strip.y + 48, 0.6])], { size: 0.42 }));
  const label = { x: -142, y: 84, w: 44, d: 10, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.5), 0.8, P, 3), { tone: "faint" }));
  out.push(L([28, 34, 19].map((w, i) => k.lineOnTop([label.x + 4, label.y + 2.9 + i * 2.2], [label.x + 4 + w, label.y + 2.9 + i * 2.2], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dt([at([label.x + label.w - 3, label.y + 3, 0.8]), at([label.x + label.w - 3, label.y + 7, 0.8])], { size: 0.42 }));
  // The ear cradle: the board answers by ear. One bud waits in its well; the other well is empty because that bud is in use.
  const cradle = { x: 90, y: 68, w: 38, d: 19, r: 6 };
  out.push(k.wireSvg(at([109, C.FRONT, 6.2]), at([109, cradle.y, 1.7]), { via: [at([109, C.FRONT + 3.4, 0]), at([109, cradle.y - 2.2, 0])], tone: "lo", size: 1 }));
  out.push(S(k.slabOf(cradle, 0, 3.4, P, 6, 0.6), { tone: "mid", inner: L(k.sideSeam(cradle, 1.2, P, 6), { tone: "faint" }) }));
  for (const [index, x] of [100.5, 117.5].entries()) {
    out.push(`<path class="hm-dark" d="${k.ring(x, 77.5, 5, 3.4, P, 28)}"/>`, L(k.ring(x, 77.5, 5, 3.4, P, 28), { tone: "lo" }));
    if (index === 0) {
      out.push(Dt([at([x - 1.6, 77.5, 3.4]), at([x + 1.6, 77.5, 3.4])], { size: 0.45, tone: "hi" }));
      continue;
    }
    out.push(S(k.cylinder(x, 77.5, 4.2, 3.4, 3.6, P, 28, 0.6), { tone: "hi", crease: "lo", inner: L(k.sideArc(x, 77.5, 4.2, 4.8, P, 18), { tone: "faint" }) }));
    out.push(S(k.cylinder(x + 0.6, 77.1, 2.1, 7, 2.6, P, 18), { tone: "mid", crease: "lo" }));
    out.push(L(k.ring(x + 0.6, 77.1, 1.1, 9.6, P, 12), { tone: "lo" }));
  }
  out.push(Dt([at([cradle.x + 3.4, cradle.y + cradle.d - 3.4, 3.4]), at([cradle.x + cradle.w - 3.4, cradle.y + cradle.d - 3.4, 3.4])], { size: 0.42 }));
  // The charging post the cord runs to.
  const post = { x: 153, y: -68, w: 9, d: 9, r: 1.6 };
  out.push(S(k.slabOf({ x: 151, y: -70, w: 13, d: 13, r: 2 }, 0, 0.9, P, 3), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf(post, 0.9, 4.6, P, 3, 0.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(post, 2.2), 5.5, P, 3), { tone: "faint" }));
  out.push(Dt([at([155.4, -65.8, 5.5]), at([159.6, -65.8, 5.5])], { size: 0.45 }));
  out.push(S(k.slabOf({ x: 156, y: -59, w: 3, d: 2.4, r: 1 }, 1.6, 2.8, P, 3), { tone: "lo" }));
  return out.join("");
}

function deck() {
  const { DECK, Z0, FRONT, SIDE, DR, AK, BAR } = C;
  const out = [`<path class="iso-halo" d="${k.haloOf(DECK, 0, 8, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(DECK, 17))) out.push(S(k.cylinder(x, y, 6.5, 0, Z0, P, 24), { tone: "lo" }));
  out.push(S(k.slabOf(DECK, Z0, TOP - Z0, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(DECK, 17.6, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(DECK, 4), TOP, P), { tone: "faint" }));
  const screws = k.corners(DECK, 9.5);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.9, TOP, P, 14)).join(""), { tone: "lo" }));
  out.push(Dt(screws.map(([x, y]) => at([x, y, TOP])), { size: 0.5 }));
  // Wells the key rows stand in.
  const row = AK.n * AK.w + (AK.n - 1) * AK.gap;
  out.push(L(k.planOutline({ x: AK.x - 3.2, y: AK.y - 3.2, w: row + 6.4, d: AK.d + 6.4, r: 5 }, TOP, P, 5), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(BAR, -3.2), TOP, P, 5), { tone: "lo" }));
  // Front face: the drawer mouth, a speaker grille and the one engraved label.
  out.push(`<path class="hm-dark" d="${rectY(DR.x0, DR.z0, DR.x1, DR.z1, 0.6, FRONT)}"/>`);
  out.push(L(rectY(DR.x0, DR.z0, DR.x1, DR.z1, 0.6, FRONT), { tone: "lo" }));
  const grille = [];
  for (let row2 = 0; row2 < 3; row2++) for (let column = 0; column < 11; column++) grille.push(at([-138 + column * 4.6 + (row2 % 2) * 2.3, FRONT, 7.4 + row2 * 3.3]));
  out.push(Dt(grille, { size: 0.5, tone: "lo" }));
  out.push(k.faceTextSvg(k.sideMatrix([52, FRONT], 9, P, "left"), "HELM", { size: 4, tone: "lo" }));
  out.push(Dt([at([134, FRONT, 6.4]), at([134, FRONT, 14.2])], { size: 0.45 }));
  // Right face: cooling slots, a power slide and two screws.
  out.push(L(Array.from({ length: 7 }, (_, i) => rectX(8 + i * 4.2, 7, 9.6 + i * 4.2, 14.6, 0.8, SIDE)).join(""), { tone: "lo" }));
  out.push(L(rectX(-12, 8, 0, 13, 1.2, SIDE), { tone: "lo" }));
  out.push(S(k.slabOf({ x: SIDE, y: -10.6, w: 1.5, d: 5, r: 0.6 }, 8.8, 3.4, P, 2), { tone: "mid" }));
  out.push(Dt([at([SIDE, -44, 6.4]), at([SIDE, 40, 6.4])], { size: 0.45 }));
  return out.join("");
}

function ladder() {
  const { LAD } = C;
  const out = [S(k.slabOf({ x: LAD.x, y: LAD.y, w: LAD.w, d: LAD.d, r: 1.4 }, TOP, 0.6, P, 3), { tone: "lo", crease: "none" })];
  const gap = (LAD.w - 8) / (LAD.n - 1);
  for (let index = 0; index < LAD.n; index++) {
    const [x, y] = at([LAD.x + 4 + index * gap, LAD.y + LAD.d / 2, TOP + 0.6]);
    out.push(`<circle class="hm-led" data-led="${index}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="0.8"/>`);
  }
  return out.join("");
}

function mic() {
  const { MIC } = C;
  const zg = TOP + MIC.collar;
  const out = [S(k.cylinder(MIC.x, MIC.y, 7.6, TOP, MIC.collar, P, 36, 0.5), { tone: "lo" })];
  out.push(`<path class="hm-dark" d="${k.ring(MIC.x, MIC.y, 4.9, zg, P, 28)}"/>`);
  out.push(L(k.ring(MIC.x, MIC.y, 4.9, zg, P, 28), { tone: "lo" }));
  out.push(Dt([0, 1, 2].map((i) => at([MIC.x + 6.3 * Math.cos(0.6 + i * 2.094), MIC.y + 6.3 * Math.sin(0.6 + i * 2.094), zg])), { size: 0.4 }));
  // The stalk slides out of the gland: everything below the gland's near rim is clipped away.
  const [vx, vy] = k.towardViewer(P);
  const facing = Math.atan2(vy, vx);
  const arc = Array.from({ length: 25 }, (_, step) => {
    const angle = facing - Math.PI / 2 + (step / 24) * Math.PI;
    return at([MIC.x + 4.85 * Math.cos(angle), MIC.y + 4.85 * Math.sin(angle), zg]);
  });
  const clip = k.pathOf([...arc, [arc[24][0], arc[24][1] - 90], [arc[0][0], arc[0][1] - 90]], true);
  const top = zg + 0.8;
  const stalk = [
    S(k.cylinder(MIC.x, MIC.y, MIC.r, top - MIC.len, MIC.len, P, 30, 0.5), {
      tone: "hi",
      crease: "lo",
      inner: L([1.8, 3.2, 4.6, 6, 7.4].map((down) => k.sideArc(MIC.x, MIC.y, MIC.r, top - down, P, 16)).join(""), { tone: "lo" }),
    }),
    L(k.ring(MIC.x, MIC.y, 3.1, top, P, 20), { tone: "lo" }),
    Dt([at([MIC.x, MIC.y, top]), ...Array.from({ length: 6 }, (_, i) => at([MIC.x + 1.8 * Math.cos(i * 1.047), MIC.y + 1.8 * Math.sin(i * 1.047), top]))], { size: 0.38, tone: "hi" }),
  ].join("");
  out.push(`<clipPath id="hm-mic"><path d="${clip}"/></clipPath><g clip-path="url(#hm-mic)"><g data-part="mic">${stalk}</g></g>`);
  return out.join("");
}

function riser() {
  const { RISER, RISER_H, WIN } = C;
  const face = RISER.y + RISER.d;
  const top = TOP + RISER_H;
  const out = [S(k.slabOf(RISER, TOP, RISER_H, P, 4, 0.6), { tone: "mid" })];
  out.push(L(k.planOutline({ x: -26, y: RISER.y + 4.6, w: 32, d: 2.6, r: 1.3 }, top, P, 4), { tone: "lo" }));
  out.push(Dt([at([RISER.x + 5, RISER.y + 6, top]), at([RISER.x + RISER.w - 5, RISER.y + 6, top])], { size: 0.45 }));
  const text = `<text class="hm-text" data-part="ribbon" data-dim="" x="${WIN.x0 + 3.6}" y="${-(WIN.z0 + 3.3)}" font-size="6">hold space and say what you want</text>`;
  out.push(recess(WIN, face, text));
  out.push(Dt([at([WIN.x0 - 3, face, (WIN.z0 + WIN.z1) / 2]), at([WIN.x1 + 3, face, (WIN.z0 + WIN.z1) / 2])], { size: 0.42 }));
  return out.join("");
}

const leverAt = (stop) => k.translateAlong(P, [stop * C.LB.step, 0, 0]);
function leash() {
  const { LB } = C;
  const out = [S(k.slabOf(LB, TOP, LB.top - TOP, P, 4, 0.6), { tone: "mid" })];
  const slot = { x: LB.x0 - 3, y: LB.sy - 1.5, w: 3 * LB.step + 6, d: 3, r: 1.5 };
  out.push(`<path class="hm-dark" d="${k.planOutline(slot, LB.top, P, 4)}"/>`);
  out.push(L(k.planOutline(slot, LB.top, P, 4), { tone: "lo" }));
  for (let stop = 0; stop < 4; stop++) {
    const x = LB.x0 + stop * LB.step;
    out.push(L(k.lineOnTop([x, LB.sy + 1.5], [x, LB.sy + 5.2], LB.top, P), { tone: "lo" }));
    out.push(Dt([at([x, LB.sy + 5.9, LB.top])], { size: 0.4 + stop * 0.2, tone: "hi" }));
  }
  out.push(Dt([at([LB.x + 3.4, LB.y + 3.4, LB.top]), at([LB.x + LB.w - 3.4, LB.y + 3.4, LB.top])], { size: 0.42 }));
  const x = LB.x0;
  const lever = [
    S(k.cylinder(x, LB.sy, 2.5, LB.top, 1.2, P, 18), { tone: "lo" }),
    S(k.cylinder(x, LB.sy, 1.2, LB.top + 1.2, 10.2, P, 14), { tone: "mid", crease: "none" }),
    S(k.cylinder(x, LB.sy, 3.7, LB.top + 11.4, 4.8, P, 28, 0.5), { tone: "hi", crease: "lo", inner: L(k.knurl(x, LB.sy, 3.7, LB.top + 11.4, LB.top + 16.2, 22, P, 0.3), { tone: "lo" }) }),
    L(k.ring(x, LB.sy, 2.1, LB.top + 16.2, P, 16), { tone: "lo" }),
  ].join("");
  out.push(`<g class="hm-hit" data-part="lever" transform="${leverAt(2)}">${lever}</g>`);
  return out.join("");
}

function agents() {
  const { AK } = C;
  const out = [];
  for (let index = 0; index < AK.n; index++) {
    const x = AK.x + index * (AK.w + AK.gap);
    const plan = { x, y: AK.y, w: AK.w, d: AK.d, r: 3 };
    const top = AK.z + AK.h;
    out.push(S(k.slabOf(k.insetPlan(plan, 2.6), TOP, 8.6, P, 3), { tone: "lo", crease: "none" }));
    const cap = [
      S(k.slabOf(plan, AK.z, AK.h, P, 4, 0.5), { tone: "mid" }),
      `<path class="hm-dark" d="${k.planOutline({ x: x + 3.6, y: AK.y + 3.7, w: 18.8, d: 5.4, r: 1.2 }, top, P, 3)}"/>`,
      L(k.planOutline({ x: x + 3.6, y: AK.y + 3.7, w: 18.8, d: 5.4, r: 1.2 }, top, P, 3), { tone: "lo" }),
      `<path class="hm-bar" data-bar="${index}" d=""/>`,
      L(k.ring(x + 21, AK.y + 16.2, 1.9, top, P, 14), { tone: "lo" }),
      (() => {
        const [cx, cy] = at([x + 21, AK.y + 16.2, top]);
        return `<circle class="hm-lamp" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="1.25"/>`;
      })(),
      Dt(Array.from({ length: index + 1 }, (_, pip) => at([x + 4.4 + pip * 2.3, AK.y + 16.2, top])), { size: 0.45, tone: "mid" }),
    ].join("");
    out.push(`<g class="hm-agent hm-hit" data-agent="${index}" data-state="idle">${cap}</g>`);
  }
  return out.join("");
}

function halt() {
  const { HALT } = C;
  const { x, y } = HALT;
  const out = [S(k.cylinder(x, y, 16, TOP, 1.4, P, 52, 0.5), { tone: "lo" })];
  out.push(Dt([0.5, 2.6, 4.7].map((a) => at([x + 13.8 * Math.cos(a), y + 13.8 * Math.sin(a), TOP + 1.4])), { size: 0.45 }));
  out.push(S(k.cylinder(x, y, 7, TOP + 1.4, 4.8, P, 28), { tone: "mid", crease: "none" }));
  const z = TOP + 6;
  const head = [
    S(k.cylinder(x, y, 13.5, z, 5, P, 52, 1), { tone: "mid", crease: "lo", inner: L(k.knurl(x, y, 13.5, z, z + 5, 56, P, 0.3), { tone: "lo" }) }),
    L(k.ring(x, y, 9.6, z + 5, P, 40), { tone: "lo" }),
    L(k.ring(x, y, 3.4, z + 5, P, 20), { tone: "lo" }),
    Dt([at([x, y, z + 5])], { size: 0.7, tone: "hi" }),
  ].join("");
  out.push(`<g class="hm-hit" data-part="halt">${head}</g>`);
  return out.join("");
}

function talkBar() {
  const { BAR } = C;
  const top = BAR.z + BAR.h;
  const out = [S(k.slabOf(k.insetPlan(BAR, 2.2), TOP, 4.4, P, 4), { tone: "lo", crease: "none" })];
  const cap = [
    S(k.slabOf(BAR, BAR.z, BAR.h, P, 6, 0.6), { tone: "mid" }),
    L(k.planOutline(k.insetPlan(BAR, 3.4), top, P, 4), { tone: "faint" }),
    Dt([at([BAR.x + 8, BAR.y + BAR.d - 4.6, top]), at([BAR.x + BAR.w - 8, BAR.y + BAR.d - 4.6, top])], { size: 0.45 }),
  ].join("");
  out.push(`<g class="hm-hit" data-part="bar">${cap}</g>`);
  return out.join("");
}

function tower() {
  const { T } = C;
  const bridge = { x: 48, y: 5, w: 33, d: 28, r: 5 };
  const out = [S(k.slabOf(bridge, TOP, 1.6, P, 5, 0.4), { tone: "lo" })];
  out.push(Dt(k.corners(bridge, 3.6).map(([x, y]) => at([x, y, TOP + 1.6])), { size: 0.45 }));
  out.push(S(k.cylinder(T.px, T.py, 4, TOP + 1.6, 1, P, 20), { tone: "lo" }));
  out.push(S(k.cylinder(T.px, T.py, 2.6, TOP + 2.6, 19.6, P, 20), { tone: "mid", crease: "faint", inner: L(k.knurl(T.px, T.py, 2.6, TOP + 2.6, TOP + 22.2, 14, P, 0.3), { tone: "lo" }) }));
  out.push(Dt([at([T.px, T.py, TOP + 22.2])], { size: 0.45 }));
  out.push(S(k.cylinder(T.x, T.y, 5, TOP + 1.6, T.z0 - TOP - 1.6, P, 24), { tone: "mid" }));
  out.push(`<g class="hm-hit" data-part="tower">${towerSvg(0, 0)}</g>`);
  return out.join("");
}

function gauge() {
  const { G } = C;
  const out = [
    S(k.cylinder(G.x, G.y, G.r, TOP, G.top - TOP, P, 48, 0.7), {
      tone: "mid",
      crease: "lo",
      inner: L(k.sideArc(G.x, G.y, G.r, G.top - 2.4, P, 28), { tone: "faint" }) + L(k.knurl(G.x, G.y, G.r, G.top - 2.4, G.top, 56, P, 0.3), { tone: "lo" }),
    }),
  ];
  out.push(L(k.ring(G.x, G.y, 6.5, G.top, P, 40), { tone: "lo" }));
  const ticks = k.radialTicks(G.x, G.y, 6.5, 32, 4, G.top, [1, 2.1], P, -Math.PI * 0.75, Math.PI * 1.5);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(`<path class="iso-line hm-needle" data-tone="hi" data-free="" data-part="needle" d="${needleD(C.F_MIN)}"/>`);
  out.push(L(k.ring(G.x, G.y, 1.2, G.top, P, 12), { tone: "mid" }), Dt([at([G.x, G.y, G.top])], { size: 0.5, tone: "hi" }));
  out.push(S(k.slabOf({ x: G.x + G.r, y: G.y - 1.7, w: 2.4, d: 3.4, r: 0.8 }, TOP + 1.4, 3, P, 3), { tone: "mid" }));
  return out.join("");
}

function wheel() {
  const { W } = C;
  const out = [];
  const block = { x: W.x - 2.3, y: -3.6, w: 4.6, d: 5.6, r: 1 };
  out.push(S(k.slabOf(block, TOP, 8.6, P, 3, 0.3), { tone: "mid" }));
  out.push(L(k.lineOnTop([W.x, block.y], [W.x, block.y + block.d], TOP + 8.6, P), { tone: "hi" }));
  out.push(S(k.cylinder(W.x, W.y, 19, TOP, 1.6, P, 60, 0.5), { tone: "lo" }));
  out.push(
    S(k.cylinder(W.x, W.y, W.r, TOP + 1.6, W.top - TOP - 1.6, P, 64, 0.8), {
      tone: "mid",
      crease: "lo",
      inner: L(k.sideArc(W.x, W.y, W.r, TOP + 3.6, P, 40), { tone: "faint" }) + L(k.knurl(W.x, W.y, W.r, TOP + 3.6, W.top, 76, P, 0.3), { tone: "lo" }),
    }),
  );
  out.push(L(k.ring(W.x, W.y, 16.2, W.top, P, 60), { tone: "faint" }));
  out.push(`<g data-part="wheel">${wheelSvg(0)}</g>`);
  out.push(S(k.cylinder(W.x, W.y, 4.2, W.top, 1.4, P, 24), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(W.x, W.y, 2.3, W.top + 1.4, P, 16), { tone: "lo" }));
  return `<g class="hm-hit" data-part="undo">${out.join("")}</g>`;
}

function cord() {
  const { SIDE } = C;
  const out = [];
  out.push(S(k.slabOf({ x: SIDE, y: -31, w: 6.5, d: 10, r: 1.4 }, 7.4, 5.2, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: SIDE + 6.5, y: -28.7, w: 4, d: 5.4, r: 2 }, 8.2, 3.6, P, 4), { tone: "lo" }));
  const route = [
    [SIDE + 10.5, -26, 10],
    [SIDE + 13.4, -26.6, 8.4],
    [SIDE + 15, -29, 3.2],
    [SIDE + 14.4, -34, 0.6],
    [SIDE + 11.4, -44, 0.5],
    [SIDE + 8.4, -52, 0.6],
    [SIDE + 7.5, -56.6, 3],
  ];
  out.push(`<path class="iso-line hm-cord" data-tone="mid" d="${curve(route)}"/>`);
  out.push(Dt([at([SIDE + 7.5, -56.7, 3])], { size: 0.6, tone: "hi" }));
  return out.join("");
}

function drawer() {
  const { DR, FRONT, U, ROWS } = C;
  const box = { x: DR.x0 - 1.4, y: FRONT, w: DR.x1 - DR.x0 + 2.8, d: DR.out + 8.4, r: 0 };
  const clip = k.slabOf(box, DR.z0 - 0.7, DR.z1 - DR.z0 + 1.1, P, 1).fill;
  const out = [];
  const inner = { x: DR.x0 + 1.4, y: 6, w: DR.x1 - DR.x0 - 2.8, d: 44, r: 0.8 };
  out.push(S(k.slabOf(inner, DR.z0, 1.4, P, 2), { tone: "lo" }));
  out.push(S(k.slabOf({ x: inner.x, y: inner.y, w: inner.w, d: 1.4, r: 0.2 }, 7, 5.4, P, 1), { tone: "lo" }));
  out.push(S(k.slabOf({ x: inner.x, y: inner.y, w: 1.4, d: inner.d, r: 0.2 }, 7, 5.4, P, 1), { tone: "lo" }));
  const starts = [0, 0.25, 0.75];
  ROWS.forEach((letters, row) => {
    [...letters].forEach((letter, column) => {
      const plan = { x: inner.x + 3.4 + (starts[row] + column) * U, y: 10.2 + row * U, w: 8.2, d: 8.2, r: 1.3 };
      out.push(
        `<g class="hm-letter" data-letter="${letter}">${S(k.slabOf(plan, 7, 2.6, P, 2, 0.3), { tone: "mid", crease: "faint" })}${L(k.planOutline(k.insetPlan(plan, 1.7), 9.6, P, 2), { tone: "faint" })}</g>`,
      );
    });
  });
  out.push(S(k.slabOf({ x: inner.x + inner.w - 1.4, y: inner.y, w: 1.4, d: inner.d, r: 0.2 }, 7, 5.4, P, 1), { tone: "lo" }));
  const face = FRONT + 1.6;
  out.push(S(k.slabOf({ x: DR.x0, y: FRONT, w: DR.x1 - DR.x0, d: 1.6, r: 0.5 }, DR.z0, DR.z1 - DR.z0, P, 2, 0.3), { tone: "mid" }));
  out.push(L(rectY(DR.x0 + 4, 8.4, DR.x0 + 24, 12.8, 0.7, face), { tone: "lo" }));
  out.push(L(k.pathOf([at([DR.x0 + 7, face, 10.6]), at([DR.x0 + 19, face, 10.6])]), { tone: "lo", free: true }));
  out.push(Dt([at([DR.x1 - 4, face, 7.6]), at([DR.x1 - 4, face, 13.6])], { size: 0.42 }));
  const mid = (DR.x0 + DR.x1) / 2;
  for (const x of [mid - 13, mid + 10.6]) out.push(S(k.slabOf({ x, y: face, w: 2.4, d: 2.8, r: 0.6 }, 9.4, 2.4, P, 2), { tone: "lo" }));
  out.push(S(k.slabOf({ x: mid - 16, y: face + 2.6, w: 32, d: 2.4, r: 1.2 }, 9.1, 3, P, 4, 0.3), { tone: "mid" }));
  return `<clipPath id="hm-drawer"><path d="${clip}"/></clipPath><g clip-path="url(#hm-drawer)"><g class="hm-hit" data-part="drawer">${out.join("")}</g></g>`;
}

const LABEL =
  "Helm, a keyboard for a voice-first desk, on a bench plate. A long deck carries a ribbon display along the back, a microphone stalk that rises while the talk bar is held, five agent keys with lamps and progress bars, a mushroom halt button, a wide talk bar, an ear cradle with one bud in it, a tall consent key on a spring whose seat is wound up by a nut, a force gauge, a leash lever with four stops and an undo wheel. A shallow drawer in the front holds the twenty-six letters.";

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: [plate(), deck(), ladder(), mic(), riser(), leash(), agents(), halt(), talkBar(), tower(), gauge(), wheel(), cord(), drawer()],
});

function live() {
  const stage = document.querySelector(".hm-stage");
  const svg = stage.querySelector("svg");
  const q = (selector) => svg.querySelector(selector);
  const readout = document.querySelector("[data-readout]");
  const status = document.querySelector("[data-status]");
  const echo = document.querySelector("[data-echo]");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const el = {
    ribbon: q('[data-part="ribbon"]'),
    mic: q('[data-part="mic"]'),
    bar: q('[data-part="bar"]'),
    halt: q('[data-part="halt"]'),
    lever: q('[data-part="lever"]'),
    wheel: q('[data-part="wheel"]'),
    tower: q('[data-part="tower"]'),
    needle: q('[data-part="needle"]'),
    drawer: q('[data-part="drawer"]'),
    agents: [...svg.querySelectorAll("[data-agent]")],
    bars: [...svg.querySelectorAll("[data-bar]")],
    leds: [...svg.querySelectorAll("[data-led]")],
    letters: {},
  };
  svg.querySelectorAll("[data-letter]").forEach((node) => (el.letters[node.dataset.letter] = node));

  const CPS = (C.SPEAK_WPM * 5) / 60;
  const N = C.AK.n;
  const MAX = 41;
  const glider = (x, tau, eps = 0.01) => ({ x, t: x, tau, eps, shown: NaN });
  const v = {
    mic: glider(0, 0.11),
    bar: glider(0, 0.03),
    halt: glider(0, 0.05),
    lever: glider(2 * C.LB.step, 0.13),
    wheel: glider(0, 0.2, 0.0015),
    nut: glider(0, 0.26),
    drop: glider(0, 0.06),
    drawer: glider(0, 0.2, 0.02),
    level: glider(0, 0.05, 0.005),
    rise: Array.from({ length: N }, () => glider(0, 0.13)),
  };
  const agents = Array.from({ length: N }, () => ({ state: "idle", text: "", stakes: 0, p: 0, dur: 1, askedAt: 0, until: 0, shown: -1, tap: 0 }));
  const dips = {};
  const commits = [];
  const talk = { held: false, auto: false, linger: 0, phrase: "", heard: 0, next: 0 };
  const flash = { text: "", until: 0 };
  const press = { active: false, t: 0, dur: 0.2, fired: false, hold: 0, agent: -1 };
  let leash = 2, halted = false, focus = -1, focusUntil = 0, clock = 0, notch = 0, done = 0;
  let typed = "", drawerOpen = false, lit = 0, lastRibbon = "", lastReadout = "";
  let frame = 0, previous = 0, visible = false, touring = !still.matches, idle = 0;

  const say = (text, seconds = 2.4) => { flash.text = text; flash.until = clock + seconds; };
  const announce = (text) => { status.textContent = text; };
  const working = () => agents.filter((a) => a.state === "work").length;
  function asking() {
    if (focus >= 0 && agents[focus].state === "ask") return focus;
    let best = -1;
    agents.forEach((a, i) => { if (a.state === "ask" && (best < 0 || a.askedAt < agents[best].askedAt)) best = i; });
    return best;
  }

  function dispatch(text) {
    const i = agents.findIndex((a) => a.state === "idle");
    if (i < 0) { say("all five agents are busy"); return; }
    Object.assign(agents[i], { state: "work", text, stakes: stakesOf(text), p: 0, dur: 2.2 + text.length * 0.06 });
    say(i + 1 + " takes \u203a " + text, 1.7);
  }
  function commit(i, byHand) {
    const a = agents[i];
    commits.push(a.text);
    notch++;
    done++;
    a.state = "done";
    a.p = 1;
    a.until = clock + 1.8;
    if (focus === i) focus = -1;
    say((byHand ? "yes \u203a " : i + 1 + " did \u203a ") + a.text, 2.2);
    announce("Agent " + (i + 1) + (byHand ? " went ahead on your yes: " : " did it unasked: ") + a.text + ".");
  }
  function takeBack() {
    const i = asking();
    if (i >= 0) {
      const a = agents[i];
      say("sent back \u203a " + a.text);
      announce("Sent back: " + a.text + ".");
      Object.assign(a, { state: "idle", p: 0, text: "" });
      if (focus === i) focus = -1;
      return;
    }
    const last = commits.pop();
    if (last === undefined) { say("nothing to take back", 1.6); return; }
    notch--;
    done = Math.max(0, done - 1);
    say("undone \u203a " + last);
    announce("Undone: " + last + ".");
  }
  function consent() {
    if (press.active) return;
    const i = asking();
    Object.assign(press, { active: true, t: 0, fired: false, hold: 0.14, agent: i, dur: 0.16 + 0.5 * (i >= 0 ? agents[i].stakes : 0) });
  }
  function setHalt(on) {
    if (on === halted) return;
    halted = on;
    v.halt.t = on ? C.HALT.down : 0;
    stage.toggleAttribute("data-halted", on);
    el.halt.toggleAttribute("data-down", on);
    announce(on ? "Halted. Every agent holds still." : "Released. Agents carry on.");
    if (!on) say("released \u00b7 agents carry on", 1.6);
  }
  function setLeash(next) {
    next = Math.max(0, Math.min(3, next));
    if (next === leash) return;
    leash = next;
    v.lever.t = next * C.LB.step;
    const [name, from] = C.LEASH[next];
    say("leash " + name + " \u203a " + (from ? "asks you from stakes " + from.toFixed(2) : "asks before every act"), 2.6);
    announce("Leash " + name + ".");
  }
  function talkStart(index, auto = false) {
    if (talk.held) return;
    if (drawerOpen) { say("letters are out \u00b7 shut the drawer to talk"); return; }
    Object.assign(talk, { held: true, auto, linger: 0.3, heard: 0, phrase: C.PHRASES[(index ?? talk.next) % C.PHRASES.length] });
    v.mic.t = C.MIC.travel;
    v.bar.t = C.BAR.down;
    el.bar.toggleAttribute("data-down", true);
    announce("Listening.");
  }
  function talkEnd() {
    if (!talk.held) return;
    talk.held = false;
    v.mic.t = 0;
    v.bar.t = 0;
    el.bar.toggleAttribute("data-down", false);
    const heard = talk.phrase.slice(0, Math.floor(talk.heard)).trim();
    if (heard.length < 6) { say("didn’t catch that \u00b7 hold and speak", 2); return; }
    talk.next++;
    dispatch(heard);
  }
  function setDrawer(open) {
    if (open === drawerOpen) return;
    if (open && talk.held) talkEnd();
    drawerOpen = open;
    typed = "";
    v.drawer.t = open ? C.DR.out : 0;
    say(open ? "letters out \u203a type it, enter sends it" : "letters away", open ? 2.4 : 1.2);
    announce(open ? "Letter drawer open. Type, then press Enter." : "Letter drawer shut.");
  }
  function typeChar(char) {
    if (typed.length >= 30) return;
    typed += char;
    flash.until = 0;
    if (el.letters[char]) dips[char] = { at: dips[char]?.at ?? 0, held: 0.09 };
  }
  function pick(i) {
    focus = i;
    focusUntil = clock + 4;
    flash.until = 0;
    agents[i].tap = 0.1;
    el.agents.forEach((node, index) => node.toggleAttribute("data-on", index === i));
  }
  function resetAll() {
    agents.forEach((a) => Object.assign(a, { state: "idle", text: "", p: 0 }));
    commits.length = 0;
    notch = 0;
    done = 0;
    focus = -1;
    typed = "";
    flash.until = 0;
    talk.next = 0;
    if (talk.held) { talk.held = false; v.mic.t = 0; v.bar.t = 0; el.bar.toggleAttribute("data-down", false); }
    setHalt(false);
    if (drawerOpen) { drawerOpen = false; v.drawer.t = 0; }
    leash = 2;
    v.lever.t = 2 * C.LB.step;
    el.agents.forEach((node) => node.removeAttribute("data-on"));
  }

  const wound = () => asking() >= 0 && v.nut.x === v.nut.t;
  const TOUR = [
    { wait: 1.1, run: () => talkStart(0, true) }, { until: () => !talk.held },
    { wait: 0.5, run: () => talkStart(2, true) }, { until: () => !talk.held },
    { wait: 0.5, run: () => talkStart(4, true) }, { until: () => !talk.held },
    { until: wound }, { wait: 1.5, run: consent }, { until: () => !press.active },
    { until: wound }, { wait: 1.9, run: takeBack },
    { wait: 1.5, run: () => setLeash(1) },
    { wait: 1.2, run: () => talkStart(1, true) }, { until: () => !talk.held },
    { until: wound }, { wait: 1.3, run: consent }, { until: () => !press.active },
    { wait: 1.6, run: takeBack },
    { wait: 1.8, run: () => setDrawer(true) },
    ...[..."mara"].map((char, index) => ({ wait: index ? 60 / (C.TYPE_WPM * 5) : 1.1, run: () => typeChar(char) })),
    { wait: 1.4, run: () => setDrawer(false) },
    { wait: 1.1, run: () => setHalt(true) }, { wait: 1.7, run: () => setHalt(false) },
    { wait: 1.5, run: resetAll },
  ];
  const tour = { at: 0, wait: TOUR[0].wait };
  function tourStep(dt) {
    const step = TOUR[tour.at];
    if (step.until) {
      tour.wait += dt;
      if (!step.until() && tour.wait < 14) return;
    } else {
      tour.wait -= dt;
      if (tour.wait > 0) return;
      step.run();
    }
    tour.at = (tour.at + 1) % TOUR.length;
    tour.wait = TOUR[tour.at].until ? 0 : TOUR[tour.at].wait;
  }

  function glide(value, dt, calm) {
    if (value.x === value.t) return false;
    value.x = calm ? value.t : value.x + (value.t - value.x) * (1 - Math.exp(-dt / value.tau));
    if (Math.abs(value.t - value.x) < value.eps) value.x = value.t;
    return true;
  }
  const fresh = (value) => (value.shown === value.x ? false : ((value.shown = value.x), true));
  const lift = (node, dz) => (dz ? node.setAttribute("transform", translateAlong(P, [0, 0, dz])) : node.removeAttribute("transform"));
  const clipText = (text) => (text.length > MAX ? text.slice(0, MAX - 1) + "\u2026" : text);

  function ribbonText() {
    const blink = still.matches || Math.floor(clock * 2) % 2 ? "_" : " ";
    if (talk.held) return ["\u203a " + talk.phrase.slice(0, Math.floor(talk.heard)) + (talk.heard < talk.phrase.length ? blink : ""), false];
    if (halted) return ["halted \u00b7 every agent holds still", false];
    if (drawerOpen && (typed.length || clock >= flash.until)) return ["abc \u203a " + typed + blink, false];
    if (clock < flash.until) return [flash.text, false];
    const i = asking();
    if (i >= 0) return [i + 1 + " asks \u203a " + agents[i].text + "?", false];
    if (focus >= 0 && clock < focusUntil) {
      const a = agents[focus];
      return [focus + 1 + (a.state === "idle" ? " is free" : " " + (a.state === "work" ? Math.round(a.p * 100) + "% \u203a " : "done \u203a ") + a.text), false];
    }
    const busy = working();
    if (busy) return [busy + (busy > 1 ? " agents" : " agent") + " at work", true];
    return ["hold space and say what you want", true];
  }
  function readoutText() {
    const name = C.LEASH[leash][0];
    if (halted) return "halted \u00b7 " + agents.filter((a) => a.state === "work" || a.state === "ask").length + " held";
    if (talk.held) return "listening \u00b7 " + C.SPEAK_WPM + " wpm \u00b7 " + Math.floor(talk.heard) + " chars";
    if (drawerOpen) return "letters out \u00b7 " + typed.length + " typed \u00b7 " + (typed.length / CPS).toFixed(1) + " s to say";
    const i = asking();
    const force = forceAt(v.nut.x, v.drop.x).toFixed(1);
    if (i >= 0 || press.active) return "leash " + name + (i >= 0 ? " \u00b7 agent " + (i + 1) + " asks" : "") + " \u00b7 press " + force + " N";
    return "leash " + name + " \u00b7 " + working() + " working \u00b7 " + done + " done";
  }

  function tick(now) {
    const dt = previous ? Math.min((now - previous) / 1000, 1 / 30) : 1 / 60;
    previous = now;
    const calm = still.matches;
    clock += dt;
    if (touring) tourStep(dt);

    if (talk.held) {
      talk.heard = Math.min(talk.phrase.length, talk.heard + CPS * dt);
      if (talk.auto && talk.heard >= talk.phrase.length && (talk.linger -= dt) <= 0) talkEnd();
    }
    const from = C.LEASH[leash][1];
    agents.forEach((a, i) => {
      if (a.state === "work" && !halted) {
        a.p = Math.min(1, a.p + dt / a.dur);
        if (a.p >= 1) {
          if (a.stakes >= from) {
            a.state = "ask";
            a.askedAt = clock;
            announce("Agent " + (i + 1) + " asks: " + a.text + ". Saying yes takes " + forceAt(a.stakes * C.T.wind, 0).toFixed(1) + " newtons.");
          } else commit(i, false);
        }
      } else if (a.state === "ask" && !halted && a.stakes < from) commit(i, false);
      else if (a.state === "done" && clock >= a.until) Object.assign(a, { state: "idle", p: 0, text: "" });
    });
    if (focus >= 0 && clock >= focusUntil && agents[focus].state !== "ask") { el.agents[focus].removeAttribute("data-on"); focus = -1; }

    if (press.active) {
      press.t = calm ? 1 : Math.min(1, press.t + dt / press.dur);
      const eased = press.t * press.t * (3 - 2 * press.t);
      v.drop.x = v.drop.t = C.T.travel * eased;
      if (press.t >= 1 && !press.fired) {
        press.fired = true;
        const i = press.agent;
        if (halted) say("halted \u00b7 release it first", 1.8);
        else if (i >= 0 && agents[i].state === "ask") commit(i, true);
        else say("nothing is waiting for your yes", 1.8);
      }
      if (press.fired && (press.hold -= dt) <= 0) { press.active = false; v.drop.t = 0; }
    }

    let moving = false;
    const ask = asking();
    v.nut.t = ask >= 0 ? agents[ask].stakes * C.T.wind : 0;
    v.wheel.t = (notch * Math.PI) / 6;
    const speaking = talk.held && talk.heard < talk.phrase.length;
    v.level.t = speaking ? 0.2 + 0.8 * Math.abs(Math.sin(clock * 9.1) * Math.sin(clock * 3.3 + 1.2)) : 0;
    for (const name of ["mic", "bar", "halt", "lever", "wheel", "nut", "drawer", "level"]) moving = glide(v[name], dt, calm) || moving;
    if (!press.active) moving = glide(v.drop, dt, calm) || moving;

    if (fresh(v.mic)) lift(el.mic, v.mic.x);
    if (fresh(v.bar)) lift(el.bar, -v.bar.x);
    if (fresh(v.halt)) lift(el.halt, -v.halt.x);
    if (fresh(v.lever)) el.lever.setAttribute("transform", translateAlong(P, [v.lever.x, 0, 0]));
    if (fresh(v.wheel)) el.wheel.innerHTML = wheelSvg(v.wheel.x);
    if (fresh(v.drawer)) v.drawer.x ? el.drawer.setAttribute("transform", translateAlong(P, [0, v.drawer.x, 0])) : el.drawer.removeAttribute("transform");
    const nutFresh = fresh(v.nut);
    const dropFresh = fresh(v.drop);
    if (nutFresh || dropFresh) {
      el.tower.innerHTML = towerSvg(v.nut.x, v.drop.x);
      el.needle.setAttribute("d", needleD(forceAt(v.nut.x, v.drop.x)));
    }
    if (fresh(v.level)) {
      const count = Math.round(v.level.x * el.leds.length);
      if (count !== lit) {
        for (let i = Math.min(count, lit); i < Math.max(count, lit); i++) el.leds[i].toggleAttribute("data-on", i < count);
        lit = count;
      }
    }
    agents.forEach((a, i) => {
      const rise = v.rise[i];
      rise.t = a.state === "ask" ? C.AK.rise : 0;
      a.tap = Math.max(0, a.tap - dt);
      moving = glide(rise, dt, calm) || moving || a.tap > 0;
      const z = rise.x - (a.tap > 0 ? 1.2 : 0);
      if (rise.shown !== z) { rise.shown = z; lift(el.agents[i], z); }
      if (el.agents[i].dataset.state !== a.state) el.agents[i].dataset.state = a.state;
      const share = a.state === "idle" ? 0 : Math.round(a.p * 100) / 100;
      if (share !== a.shown) { a.shown = share; el.bars[i].setAttribute("d", barD(i, share)); }
    });
    for (const char in dips) {
      const dip = dips[char];
      dip.held = Math.max(0, dip.held - dt);
      const want = dip.held > 0 ? 1.3 : 0;
      dip.at = calm ? want : dip.at + (want - dip.at) * (1 - Math.exp(-dt / (want ? 0.025 : 0.07)));
      if (Math.abs(want - dip.at) < 0.01) dip.at = want;
      lift(el.letters[char], -dip.at);
      if (!dip.held && dip.at === 0) delete dips[char];
      else moving = true;
    }

    const [text, dim] = ribbonText();
    const shown = clipText(text);
    if (shown !== lastRibbon) {
      lastRibbon = shown;
      el.ribbon.textContent = shown;
      el.ribbon.toggleAttribute("data-dim", dim);
      echo.textContent = shown.replace(/_$/, "");
    }
    const line = readoutText();
    if (line !== lastReadout) readout.textContent = lastReadout = line;

    const busy = touring || moving || talk.held || press.active || drawerOpen || clock < flash.until || (focus >= 0 && clock < focusUntil) || agents.some((a) => (a.state === "work" && !halted) || a.state === "done");
    frame = visible && busy ? requestAnimationFrame(tick) : 0;
  }
  function run() { if (!frame && visible) { previous = 0; frame = requestAnimationFrame(tick); } }
  function takeOver() {
    if (touring) {
      touring = false;
      if (talk.held && talk.auto) talkEnd();
    }
    clearTimeout(idle);
    idle = setTimeout(() => {
      if (still.matches || talk.held) return;
      resetAll();
      tour.at = 0;
      tour.wait = TOUR[0].wait;
      touring = true;
      run();
    }, 16000);
  }
  const act = {
    yes: () => {
      if (drawerOpen && typed.trim().length > 1) { dispatch(typed.trim()); typed = ""; }
      else consent();
    },
    back: () => { if (drawerOpen && typed.length) typed = typed.slice(0, -1); else takeBack(); },
    halt: () => setHalt(!halted),
    looser: () => setLeash(leash + 1),
    tighter: () => setLeash(leash - 1),
    letters: () => setDrawer(!drawerOpen),
  };

  new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

  let capsAt = 0;
  stage.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    if (key === "Tab") return;
    takeOver();
    if (key === " ") {
      event.preventDefault();
      if (drawerOpen) typeChar(" ");
      else if (!event.repeat) talkStart();
    } else if (key === "Enter") { event.preventDefault(); if (!event.repeat) act.yes(); }
    else if (key === "Backspace") { event.preventDefault(); if (!event.repeat || (drawerOpen && typed.length)) act.back(); }
    else if (key === "Escape") { event.preventDefault(); if (!event.repeat) act.halt(); }
    else if (key === "ArrowRight") { event.preventDefault(); act.looser(); }
    else if (key === "ArrowLeft") { event.preventDefault(); act.tighter(); }
    else if (key === "ArrowUp" || key === "ArrowDown") { event.preventDefault(); pick((Math.max(0, focus) + (key === "ArrowDown" ? 1 : N - 1) + (focus < 0 ? (key === "ArrowDown" ? -1 : 1) : 0)) % N); }
    else if (key === "CapsLock") { capsAt = performance.now(); act.letters(); }
    else if (key.length === 1 && key >= "1" && key <= String(N)) pick(Number(key) - 1);
    else if (key.length === 1 && /[a-z]/i.test(key)) {
      if (drawerOpen) typeChar(key.toLowerCase());
      else say("letters live in the drawer \u203a caps lock", 2.2);
    }
    run();
  });
  stage.addEventListener("keyup", (event) => {
    if (event.key === " ") talkEnd();
    else if (event.key === "CapsLock" && performance.now() - capsAt > 700) { capsAt = performance.now(); takeOver(); act.letters(); }
    run();
  });
  stage.addEventListener("blur", () => { if (talk.held && !talk.auto) { talkEnd(); run(); } });

  let pointerTalk = false;
  const release = () => { if (pointerTalk) { pointerTalk = false; talkEnd(); run(); } };
  svg.addEventListener("pointerdown", (event) => {
    if (!event.target.closest('[data-part="bar"]')) return;
    takeOver();
    pointerTalk = true;
    talkStart();
    run();
  });
  addEventListener("pointerup", release);
  addEventListener("pointercancel", release);
  svg.addEventListener("click", (event) => {
    const target = event.target;
    const agent = target.closest("[data-agent]");
    const letter = target.closest("[data-letter]");
    if (target.closest('[data-part="bar"]')) return stage.focus({ preventScroll: true });
    takeOver();
    if (agent) pick(Number(agent.dataset.agent));
    else if (target.closest('[data-part="tower"]')) consent();
    else if (target.closest('[data-part="halt"]')) act.halt();
    else if (target.closest('[data-part="lever"]')) setLeash(leash === 3 ? 0 : leash + 1);
    else if (target.closest('[data-part="undo"]')) takeBack();
    else if (letter && drawerOpen) typeChar(letter.dataset.letter);
    else if (target.closest('[data-part="drawer"]')) act.letters();
    stage.focus({ preventScroll: true });
    run();
  });
  document.querySelectorAll("[data-act]").forEach((button) => {
    const name = button.dataset.act;
    if (name === "talk") {
      button.addEventListener("pointerdown", () => { takeOver(); pointerTalk = true; talkStart(); run(); });
      button.addEventListener("click", (event) => { if (event.detail === 0) { takeOver(); talkStart(undefined, true); run(); } });
    } else button.addEventListener("click", () => { takeOver(); act[name](); run(); });
  });
}

const preamble = `
const k = { iso, pathOf, towardViewer, cylinder, solidSvg, lineSvg, dotsSvg, onTop, lineOnTop, radialTicks, ring, knurl, sideArc };
const C = ${JSON.stringify(C)};
const P = ${JSON.stringify(P)};
${[stakesOf, forceAt, vcoil, towerSvg, needleD, wheelSvg, barD].map(String).join("\n")}
(${live.toString()})();
`;

// IBM Plex descends from IBM's typewriter faces, which suits a page about what comes after the typewriter keyboard.
const FONT_LINK = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&family=IBM+Plex+Sans:wght@400;600&display=swap">`;
// Every text size on the page is one of these six steps. The label step is 12px, the smallest size the page uses.
const TYPE_TOKENS = `--anatomy-mono:"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;--hm-sans:"IBM Plex Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--t-display:clamp(1.625rem,1.1rem + 2.4vw,2.125rem);--t-title:1.1875rem;--t-lede:1.0625rem;--t-body:1rem;--t-small:.875rem;--t-label:.75rem;`;
// The kit's muted grey is 3.9:1 on the dark page and 3.0:1 on the light one. These reach 5.7:1 and 4.7:1.
const THEME_TOKENS = {
  dark: "--anatomy-muted:#8f8f8f;--hm-in-dark:visible;--hm-in-light:hidden;",
  light: "--anatomy-muted:#6b6b70;--hm-in-dark:hidden;--hm-in-light:visible;",
};

const css = `<style>
.iso{${TYPE_TOKENS}${THEME_TOKENS.dark}}
.iso[data-theme="light"]{${THEME_TOKENS.light}}
body{font-family:var(--hm-sans);font-size:var(--t-body);line-height:1.55;font-synthesis:none;-moz-osx-font-smoothing:grayscale}
[id]{scroll-margin-top:16px}

.hm-dark{fill:var(--anatomy-shade-0);stroke:none}
.hm-text{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);letter-spacing:.02em;white-space:pre}
.hm-text[data-dim]{fill:var(--anatomy-muted)}
.hm-bar{fill:var(--anatomy-hi);stroke:none}
.hm-lamp{fill:var(--anatomy-dot);opacity:.14;transition:opacity .3s var(--anatomy-ease)}
.hm-agent[data-state="work"] .hm-lamp{animation:hm-work 1s ease-in-out infinite alternate}
.hm-agent[data-state="ask"] .hm-lamp{opacity:1}
.hm-agent[data-state="done"] .hm-lamp{opacity:.5}
.hm-agent[data-state="ask"] .iso-solid>.iso-edge,.hm-agent[data-on] .iso-solid>.iso-edge,[data-down]>.iso-solid>.iso-edge{stroke:var(--anatomy-hi)}
.hm-stage[data-halted] .hm-lamp{animation-play-state:paused}
.hm-led{fill:var(--anatomy-dot);opacity:.13;transition:opacity .12s linear}
.hm-led[data-on]{opacity:.95}
.hm-needle{stroke-width:1.1px}
.hm-cord{stroke-width:1.3px}
.hm-hit{cursor:pointer}
@keyframes hm-work{from{opacity:.2}to{opacity:.95}}
@media (prefers-reduced-motion:reduce){.hm-agent[data-state="work"] .hm-lamp{animation:none;opacity:.7}}
.hm-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.hm-stage{position:relative;touch-action:pan-y}
.hm-stage svg{user-select:none;-webkit-user-select:none}
.hm-stage:focus{outline:none}
.hm-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}

.iso-plate-corner{font-size:var(--t-label)}
.iso-legend{color:var(--anatomy-text);font-size:var(--t-small);line-height:1.55}
.iso-caption{max-width:68ch;text-wrap:pretty}

.hm-head{display:grid;gap:14px;margin-bottom:32px}
.hm-eyebrow{margin:0;color:var(--anatomy-muted);font-family:var(--anatomy-mono);font-size:var(--t-label);letter-spacing:.08em;text-transform:uppercase}
.hm-head h1{margin:0;color:var(--anatomy-strong);font-size:var(--t-display);font-weight:600;line-height:1.1;letter-spacing:-.02em;text-wrap:balance}
.hm-lede{display:grid;gap:10px;max-width:64ch}
.hm-lede p{margin:0;font-size:var(--t-lede);text-wrap:pretty}
.hm-nav{display:flex;flex-wrap:wrap;align-items:center;gap:0 20px;font-family:var(--anatomy-mono);font-size:var(--t-label);letter-spacing:.08em;text-transform:uppercase}
.hm-nav a{display:inline-flex;align-items:center;min-height:44px;color:var(--anatomy-text);text-decoration-color:var(--anatomy-lo);text-decoration-thickness:1px;text-underline-offset:5px;transition:color 150ms ease-out,text-decoration-color 150ms ease-out}

.hm-k,.hm-theme{appearance:none;min-height:44px;border:0;border-radius:8px;background:var(--anatomy-card);box-shadow:0 0 0 1px var(--anatomy-lo);color:var(--anatomy-text);font:inherit;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none;transition:transform 150ms ease-out,box-shadow 150ms ease-out,color 150ms ease-out}
.hm-k:active,.hm-theme:active{transform:scale(.96);box-shadow:0 0 0 1px var(--anatomy-hi);color:var(--anatomy-strong)}
.hm-k:focus-visible,.hm-theme:focus-visible,.hm-nav a:focus-visible,.hb a:focus-visible,.hb-scroll:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:3px}
@media (hover:hover) and (pointer:fine){
.hm-k:hover,.hm-theme:hover{box-shadow:0 0 0 1px var(--anatomy-mid)}
.hm-nav a:hover{color:var(--anatomy-strong);text-decoration-color:var(--anatomy-mid)}
}
.hm-keys{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 8px}
.hm-k{display:inline-flex;align-items:center;gap:8px;padding:0 14px 0 8px;font-size:var(--t-small);line-height:1.2}
.hm-k kbd{padding:4px 7px;border-radius:4px;background:var(--anatomy-faint);color:var(--anatomy-strong);font-family:var(--anatomy-mono);font-size:var(--t-label);letter-spacing:.04em;text-transform:uppercase}
.hm-theme{display:inline-grid;place-items:center;margin-inline-start:auto;padding:0 12px;letter-spacing:inherit;text-transform:inherit}
.hm-theme span{grid-area:1/1}
.hm-theme .to-dark{visibility:var(--hm-in-light)}
.hm-theme .to-light{visibility:var(--hm-in-dark)}
.hm-echo{display:none;margin:12px 0 0;min-height:1.5em;color:var(--anatomy-strong);font-family:var(--anatomy-mono);font-size:var(--t-small)}

.hm-why,.hb section{display:grid;gap:12px;min-width:0}
.hm-why{margin-top:48px}
.hm-why h2,.hb h2{margin:0;color:var(--anatomy-strong);font-size:var(--t-title);font-weight:600;line-height:1.25;letter-spacing:-.01em;text-wrap:balance}
.hm-why>p,.hb p{margin:0;max-width:66ch;text-wrap:pretty}
.hm-why dl{margin:6px 0 0}
.hm-row{display:grid;grid-template-columns:9rem 1fr;gap:6px 24px;padding-block:16px;border-block-start:1px solid var(--anatomy-faint)}
.hm-row dt{color:var(--anatomy-strong);font-weight:600}
.hm-row dt span{display:block;margin-top:4px;color:var(--anatomy-muted);font-family:var(--anatomy-mono);font-size:var(--t-label);font-weight:400;letter-spacing:.06em;text-transform:uppercase}
.hm-row dd{margin:0;max-width:62ch;text-wrap:pretty}

.hb{display:grid;gap:48px;margin-top:56px}
.hb a{color:var(--anatomy-strong);text-decoration-thickness:from-font;text-underline-offset:3px;text-decoration-skip-ink:auto}
.hb-scroll{overflow-x:auto;margin-block:4px}
.hb table{width:100%;min-width:38rem;border-collapse:collapse;font-size:var(--t-small);line-height:1.5}
.hb th{padding-block:8px;padding-inline:0 16px;border-block-end:1px solid var(--anatomy-lo);color:var(--anatomy-muted);font-family:var(--anatomy-mono);font-size:var(--t-label);font-weight:400;letter-spacing:.06em;text-align:start;text-transform:uppercase;white-space:nowrap}
.hb td{padding-block:10px;padding-inline:0 16px;border-block-end:1px solid var(--anatomy-faint);vertical-align:top}
.hb td:first-child{color:var(--anatomy-strong);font-weight:600;white-space:nowrap}
.hb td:nth-child(2){font-variant-numeric:tabular-nums}
.hb-new{color:var(--anatomy-strong);font-weight:600;white-space:nowrap}
.hb ul,.hb ol{display:grid;gap:10px;margin:0;padding-inline-start:1.25rem;max-width:66ch}
.hb ol ul{margin-top:8px;gap:6px}
.hb .hb-steps{gap:20px}
.hb li::marker{color:var(--anatomy-muted)}
.hb strong{color:var(--anatomy-strong);font-weight:600}
.hb-done{display:block;margin-top:6px;color:var(--anatomy-muted);font-size:var(--t-small)}
@media (max-width:560px){.hm-echo{display:block}.hm-row{grid-template-columns:1fr}}
</style>`;

const keyStrip = `<div class="hm-keys" role="group" aria-label="The six keys that are left">
<button class="hm-k" data-act="talk" type="button"><kbd>Space</kbd>hold to talk</button>
<button class="hm-k" data-act="yes" type="button"><kbd>Enter</kbd>say yes</button>
<button class="hm-k" data-act="back" type="button"><kbd>Backspace</kbd>take it back</button>
<button class="hm-k" data-act="tighter" type="button"><kbd>&larr;</kbd>shorter leash</button>
<button class="hm-k" data-act="looser" type="button"><kbd>&rarr;</kbd>longer leash</button>
<button class="hm-k" data-act="halt" type="button"><kbd>Esc</kbd>halt</button>
<button class="hm-k" data-act="letters" type="button"><kbd>Caps</kbd>letters</button>
</div><p class="hm-echo" data-echo aria-hidden="true"></p>`;

// A value and its unit stay on one line.
const glue = (text) => text.replace(/(\d) (N\/mm|N|mm|mAh|GHz)(?![\w/])/g, "$1 $2");

const figure = k
  .plateHtml({
    fig: "Fig 1",
    title: "Helm",
    hint: "Hold space to talk · Enter says yes",
    readout: "leash act · 0 working · 0 done",
    keys: [
      { mark: "lit", label: glue("Consent key, its spring wound from 0.5 to 6 N by the stakes") },
      { mark: "raised", label: "Five agent keys; one stands up when its agent needs your yes" },
      { mark: "edge", label: "Talk bar and microphone stalk, which is above the deck only while the bar is held" },
      { mark: "dim", label: "Leash lever, undo wheel and halt button" },
      { mark: "flat", label: "Twenty-six letters, kept in a drawer" },
    ],
    caption: glue(
      "The model plays by itself until you touch it. Hold the bar and the microphone stands up. What it hears lands on the ribbon and goes to a free agent key. An agent that needs a yes raises its key, and a servo winds the nut under the consent key until the spring pushes back with 0.5 N plus 5.5 N times the stakes. Every act that goes through turns the wheel one notch. One earbud waits in the cradle and the other well is empty, because the answers come back by ear.",
    ),
    body: `<div class="iso-stage hm-stage" tabindex="0" role="group" aria-label="Helm keyboard. Hold Space to talk, Enter to consent, Backspace to take back, left and right arrows for the leash, Escape to halt, Caps Lock for the letter drawer, 1 to 5 to look at an agent.">${svg}<span class="hm-sr" role="status" aria-live="polite" data-status></span></div>`,
  })
  .replace('<figcaption class="iso-legend">', `${keyStrip}<figcaption class="iso-legend">`);

const headOf = (navHtml) =>
  `<header class="hm-head">${eyebrow}<h1>Keep the verbs, drop the alphabet.</h1><div class="hm-lede"><p>Helm is a keyboard for a desk where you talk to your computer and software agents do the work. Speech runs at about 150 words a minute and typing at about 40, so the sentences move to your voice. Six keys stay. None of them was ever a letter.</p><p>This page asks NuPhy to judge whether Helm can be built and, if so, to build a first working prototype. Helm is a design concept. No CAD, circuit board, firmware or prototype exists, and every size below comes from the model.</p></div>${navHtml}</header>`;

const rows = [
  ["Space", "the floor", "A voice has no edge. The machine cannot tell talking to it from talking near it, so holding the bar is the edge. The microphone is a stalk that sits below the deck unless the bar is down. You can see when it is listening."],
  ["Enter", "the yes", "Consent has to be deliberate, and nobody should be able to give it from across the room. So it stays a key, and its stiffness is set by what is at stake. Filing a draft is a 1.6 N tap. Deleting a year of backups is a slow push through 5.7 N, more than ten ordinary keys at once."],
  ["Backspace", "the take-back", "Every act an agent completes turns the undo wheel one notch. Turning it back is the same gesture whether you are refusing a request or reversing something already done."],
  ["Arrows", "the leash", "Four stops: watch, ask, act, run. The lever sets how much an agent may do before it has to raise its key. There is no fifth stop. Nothing irreversible goes through without a hand."],
  ["Escape", "the halt", "A mushroom button you can hit without looking. It latches, and every agent holds still until you release it."],
  ["Caps Lock", "the letters", "Names, passwords and symbols still need spelling, so the alphabet is kept, in a drawer. The least useful key on the old board finally has a job. It lets the letters out."],
];
const why = glue(
  `<section class="hm-why" id="why"><h2>Why these six</h2><p>Voice is the fast channel and the loose one. Hands are slow and exact. The board gives each the work it is good at. It also lets an agent ask for attention by moving something at the edge of your sight.</p><dl>${rows
    .map(([key, role, text]) => `<div class="hm-row"><dt>${role[0].toUpperCase() + role.slice(1)}<span>was ${key}</span></dt><dd>${text}</dd></div>`)
    .join("")}</dl></section>`,
);
const briefHtml = glue(brief);

const name = theme === "light" ? "helm-light.html" : "helm.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Helm Keyboard", theme, body: FONT_LINK + css + headOf(nav) + figure + why + briefHtml, script: kitScript() + preamble, width: 860 }));
console.log("wrote", name, `${svg.length} bytes of svg`);

// `--artifact` also writes the page for publishing: no document shell, tokens on :root, and the theme follows the viewer.
if (process.argv.includes("--artifact")) {
  // The switch sets the same root attribute the viewer's own theme choice does. Both labels are in the button and
  // the theme tokens show one, so the label is right on first paint and the button never changes width.
  const themeButton = `<button class="hm-theme" type="button" id="theme-switch" data-theme-switch><span class="to-dark">Dark version</span><span class="to-light">Light version</span></button>`;
  function themeSwitch() {
    const root = document.documentElement;
    document.querySelector("[data-theme-switch]").addEventListener("click", () => {
      const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = dark ? "light" : "dark";
      // Storage throws in private windows. The choice then lasts for this visit only.
      try {
        localStorage.setItem("helm-theme", root.dataset.theme);
      } catch {}
    });
  }
  // Runs before the page paints, so a saved choice never flashes the other theme first.
  const restoreTheme = `<script>try{const t=localStorage.getItem("helm-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch{}</script>`;

  const [whole, dark, light] = k.ISO_CSS.match(/\.iso\{([\s\S]*?)\}\s*\.iso\[data-theme="light"\]\{([\s\S]*?)\}/);
  const pageHead = `<title>Helm Keyboard</title>
<meta name="claude:viewport-fit-sides" content="cover">
${FONT_LINK}
${restoreTheme}
<style>
:root{${dark}${light}${TYPE_TOKENS}${THEME_TOKENS.light}}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${dark}${TYPE_TOKENS}${THEME_TOKENS.dark}color-scheme:dark}}
:root[data-theme="dark"]{${dark}${TYPE_TOKENS}${THEME_TOKENS.dark}color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--anatomy-page);color:var(--anatomy-text);-webkit-font-smoothing:antialiased}
.iso-page{max-width:892px;margin:0 auto;padding-block:48px 72px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
${k.ISO_CSS.replace(whole, "")}
</style>
`;
  const pageBody = `<main class="iso-page" lang="en">${css}${headOf(nav.replace("</nav>", themeButton + "</nav>"))}${figure.replace('<figure class="iso-figure">', '<figure class="iso-figure" id="model">')}${why}${briefHtml}</main>
<script type="module">${(kitScript() + preamble + `\n(${themeSwitch.toString()})();\n`).replace(/<\/(script)/gi, "<\\/$1")}</script>
`;
  writeFileSync(join(HERE, "helm-artifact.html"), pageHead + pageBody);
  // The same page with its own document shell, for hosting anywhere (GitHub Pages serves it as the site).
  writeFileSync(
    join(HERE, "index.html"),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="description" content="Helm, a concept keyboard for a voice-first desk: an interactive model and a build brief."><style>body{margin:0}</style>${pageHead}</head><body>${pageBody}</body></html>`,
  );
  console.log("wrote helm-artifact.html and index.html");
}
