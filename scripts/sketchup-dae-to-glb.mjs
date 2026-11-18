// SketchUp COLLADA(.dae) → GLB 스트리밍 변환기
// usage: node sketchup-dae-to-glb.mjs <in.dae> <textureDir[,textureDir2]> <out.glb>
// - visual_scene이 geometry보다 먼저 나오는 SketchUp 출력 구조를 이용해 한 번에 스트리밍 처리
// - 인스턴스 월드 행렬 적용 후 재질별로 메시를 합침, 면 법선 계산, 양면 재질

import fs from "node:fs";
import path from "node:path";
import { SaxesParser } from "saxes";
import { Document, NodeIO } from "@gltf-transform/core";

const [inFile, texDirsArg, outFile] = process.argv.slice(2);
const texDirs = texDirsArg.split(",");

// ---------- growable typed buffer ----------
class F32 {
  constructor() { this.a = new Float32Array(1 << 16); this.n = 0; }
  grow(k) { if (this.n + k > this.a.length) { const b = new Float32Array(this.a.length * 2); b.set(this.a); this.a = b; } }
  push3(x, y, z) { this.grow(3); this.a[this.n++] = x; this.a[this.n++] = y; this.a[this.n++] = z; }
  push2(x, y) { this.grow(2); this.a[this.n++] = x; this.a[this.n++] = y; }
  view() { return this.a.subarray(0, this.n); }
}

// ---------- row-major 4x4 ----------
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {
  const r = new Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    r[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] + a[i * 4 + 2] * b[8 + j] + a[i * 4 + 3] * b[12 + j];
  }
  return r;
}

// ---------- parse state ----------
const images = {}; // imageId -> file
const materials = {}; // materialId -> effectId
const effects = {}; // effectId -> { color, surfaceImage, transparency }
const instancesByGeom = {}; // geomId -> [{ world, bind:{symbol:target} }]
const acc = new Map(); // materialTarget -> { pos:F32, uv:F32 }

let text = [];
let collecting = false;
const stack = [];
const nodeStack = [];
let curInstance = null;
let curGeom = null;
let curEffect = null;
let curImage = null;
let curMaterial = null;
let triCount = 0;
let geomCount = 0;

const parser = new SaxesParser();
const startCollect = () => { text = []; collecting = true; };
const endCollect = () => { collecting = false; const s = text.join(""); text = []; return s; };
const nums = (s, Arr) => {
  const parts = s.trim().split(/\s+/);
  const out = new Arr(parts.length);
  for (let i = 0; i < parts.length; i++) out[i] = +parts[i];
  return out;
};
const inScope = (name) => stack.includes(name);

parser.on("text", (t) => { if (collecting) text.push(t); });

parser.on("opentag", (tag) => {
  const n = tag.name;
  const a = tag.attributes;
  stack.push(n);
  switch (n) {
    case "image": curImage = a.id; break;
    case "init_from": startCollect(); break;
    case "material": if (inScope("library_materials")) curMaterial = a.id; break;
    case "instance_effect": if (curMaterial) materials[curMaterial] = a.url.slice(1); break;
    case "effect": curEffect = a.id; effects[curEffect] = { color: [0.8, 0.8, 0.8, 1], surfaceImage: null, transparency: 1 }; break;
    case "color": case "float": if (curEffect) startCollect(); break;
    case "node":
      if (inScope("visual_scene")) nodeStack.push({ world: nodeStack.length ? nodeStack[nodeStack.length - 1].world : I });
      break;
    case "matrix": startCollect(); break;
    case "instance_geometry": curInstance = { geom: a.url.slice(1), world: nodeStack[nodeStack.length - 1].world, bind: {} }; break;
    case "instance_material": if (curInstance) curInstance.bind[a.symbol] = a.target.slice(1); break;
    case "geometry": curGeom = { id: a.id, sources: {}, vertices: null, prims: [] }; geomCount++; break;
    case "source": if (curGeom) curGeom.curSource = a.id; break;
    case "float_array": if (curGeom) startCollect(); break;
    case "accessor": if (curGeom && curGeom.curSource && curGeom.sources[curGeom.curSource]) curGeom.sources[curGeom.curSource].stride = +(a.stride || 1); break;
    case "vertices": if (curGeom) curGeom.vertices = { id: a.id, inputs: [] }; break;
    case "triangles": if (curGeom) curGeom.curPrim = { material: a.material, inputs: [], p: null }; break;
    case "input":
      if (curGeom && stack[stack.length - 2] === "vertices") curGeom.vertices.inputs.push({ semantic: a.semantic, source: a.source.slice(1) });
      else if (curGeom && curGeom.curPrim) curGeom.curPrim.inputs.push({ semantic: a.semantic, source: a.source.slice(1), offset: +a.offset });
      break;
    case "p": if (curGeom && curGeom.curPrim) startCollect(); break;
  }
});

parser.on("closetag", (tag) => {
  const n = tag.name;
  stack.pop();
  switch (n) {
    case "init_from": {
      const s = endCollect().trim();
      if (curImage && stack[stack.length - 1] === "image") images[curImage] = s;
      else if (curEffect && stack.includes("surface")) effects[curEffect].surfaceImage ??= s;
      break;
    }
    case "image": curImage = null; break;
    case "material": curMaterial = null; break;
    case "color": if (curEffect) { const s = endCollect(); if (stack.includes("diffuse")) effects[curEffect].color = nums(s, Array); } break;
    case "float": if (curEffect) { const s = endCollect(); if (stack.includes("transparency")) effects[curEffect].transparency = parseFloat(s); } break;
    case "effect": curEffect = null; break;
    case "matrix": {
      const local = nums(endCollect(), Array);
      if (nodeStack.length) {
        const parent = nodeStack.length > 1 ? nodeStack[nodeStack.length - 2].world : I;
        nodeStack[nodeStack.length - 1].world = mul(parent, local);
      }
      break;
    }
    case "instance_geometry":
      if (curInstance) { (instancesByGeom[curInstance.geom] ??= []).push(curInstance); curInstance = null; }
      break;
    case "node": if (nodeStack.length && inScope("visual_scene")) nodeStack.pop(); break;
    case "float_array": if (curGeom) curGeom.sources[curGeom.curSource] = { data: nums(endCollect(), Float32Array), stride: 3 }; break;
    case "source": if (curGeom) curGeom.curSource = null; break;
    case "p": if (curGeom && curGeom.curPrim) curGeom.curPrim.p = nums(endCollect(), Uint32Array); break;
    case "triangles": if (curGeom && curGeom.curPrim) { curGeom.prims.push(curGeom.curPrim); curGeom.curPrim = null; } break;
    case "geometry": emitGeometry(curGeom); curGeom = null; break;
  }
});

function getAcc(key) {
  let a = acc.get(key);
  if (!a) { a = { pos: new F32(), uv: new F32() }; acc.set(key, a); }
  return a;
}

function emitGeometry(g) {
  const insts = instancesByGeom[g.id];
  if (!insts || !g.prims.length) return;
  const vin = g.vertices ? g.vertices.inputs : [];
  for (const prim of g.prims) {
    if (!prim.p) continue;
    const stride = Math.max(...prim.inputs.map((i) => i.offset)) + 1;
    const vIn = prim.inputs.find((i) => i.semantic === "VERTEX");
    if (!vIn) continue;
    const posIn = vin.find((i) => i.semantic === "POSITION");
    const posSrc = posIn && g.sources[posIn.source];
    if (!posSrc) continue;
    let uvSrc = null, uvOff = -1;
    const vtc = vin.find((i) => i.semantic === "TEXCOORD");
    if (vtc) { uvSrc = g.sources[vtc.source]; uvOff = vIn.offset; }
    const tIn = prim.inputs.find((i) => i.semantic === "TEXCOORD");
    if (tIn) { uvSrc = g.sources[tIn.source]; uvOff = tIn.offset; }

    const P = posSrc.data, ps = posSrc.stride, posOff = vIn.offset;
    const UV = uvSrc && uvSrc.data, us = uvSrc ? uvSrc.stride : 0;
    const idx = prim.p;
    const verts = idx.length / stride;
    for (const inst of insts) {
      const m = inst.world;
      const out = getAcc(inst.bind[prim.material] || prim.material || "default");
      for (let v = 0; v < verts; v++) {
        const pi = idx[v * stride + posOff] * ps;
        const x = P[pi], y = P[pi + 1], z = P[pi + 2];
        out.pos.push3(
          m[0] * x + m[1] * y + m[2] * z + m[3],
          m[4] * x + m[5] * y + m[6] * z + m[7],
          m[8] * x + m[9] * y + m[10] * z + m[11],
        );
        if (UV && uvOff >= 0) {
          const ui = idx[v * stride + uvOff] * us;
          out.uv.push2(UV[ui], 1 - UV[ui + 1]);
        } else out.uv.push2(0, 0);
      }
      triCount += verts / 3;
    }
  }
}

function faceNormals(pos) {
  const n = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i + 3] - pos[i], ay = pos[i + 4] - pos[i + 1], az = pos[i + 5] - pos[i + 2];
    const bx = pos[i + 6] - pos[i], by = pos[i + 7] - pos[i + 1], bz = pos[i + 8] - pos[i + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (let k = 0; k < 3; k++) { n[i + k * 3] = nx; n[i + k * 3 + 1] = ny; n[i + k * 3 + 2] = nz; }
  }
  return n;
}

function findTexture(file) {
  if (!file) return null;
  const base = path.basename(decodeURIComponent(file).replace(/\\/g, "/"));
  for (const d of texDirs) {
    const p = path.join(d, base);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function build() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene("KSPO DOME");
  // SketchUp: inch, Z-up → glTF: meter, Y-up
  const s = Math.SQRT1_2;
  const root = doc.createNode("root").setScale([0.0254, 0.0254, 0.0254]).setRotation([-s, 0, 0, s]);
  scene.addChild(root);
  const toLinear = (c) => Math.pow(c, 2.2);
  const texCache = new Map();
  let missingTex = 0;

  for (const [key, a] of acc) {
    const pos = a.pos.view();
    if (!pos.length) continue;
    const eff = effects[materials[key]] || { color: [0.8, 0.8, 0.8, 1], transparency: 1 };
    const mat = doc.createMaterial(key).setDoubleSided(true).setMetallicFactor(0).setRoughnessFactor(0.9);
    const alpha = (eff.color[3] ?? 1) * (eff.transparency ?? 1);
    mat.setBaseColorFactor([toLinear(eff.color[0]), toLinear(eff.color[1]), toLinear(eff.color[2]), alpha]);
    if (alpha < 0.99) mat.setAlphaMode("BLEND");
    const texPath = eff.surfaceImage ? findTexture(images[eff.surfaceImage]) : null;
    if (eff.surfaceImage && !texPath) missingTex++;
    if (texPath) {
      let tex = texCache.get(texPath);
      if (!tex) {
        const ext = path.extname(texPath).toLowerCase();
        tex = doc.createTexture(path.basename(texPath)).setImage(new Uint8Array(fs.readFileSync(texPath))).setMimeType(ext === ".png" ? "image/png" : "image/jpeg");
        texCache.set(texPath, tex);
      }
      mat.setBaseColorTexture(tex).setBaseColorFactor([1, 1, 1, alpha]);
    }
    const prim = doc.createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(buffer))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(faceNormals(pos)).setBuffer(buffer))
      .setMaterial(mat);
    if (texPath) prim.setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(a.uv.view())).setBuffer(buffer));
    root.addChild(doc.createNode(key).setMesh(doc.createMesh(key).addPrimitive(prim)));
  }
  const glb = await new NodeIO().writeBinary(doc);
  fs.writeFileSync(outFile, glb);
  console.log(`geometries=${geomCount} triangles=${Math.round(triCount)} materials=${acc.size} textures=${texCache.size} missingTextures=${missingTex} -> ${(glb.byteLength / 1048576).toFixed(1)}MB`);
}

console.time("parse");
const stream = fs.createReadStream(inFile, { encoding: "utf8", highWaterMark: 1 << 20 });
stream.on("data", (chunk) => parser.write(chunk));
stream.on("end", () => {
  parser.close();
  console.timeEnd("parse");
  build().catch((e) => { console.error(e); process.exit(1); });
});
