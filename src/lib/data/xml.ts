import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });

export type XmlRecord = Record<string, unknown>;

/** data.go.kr 표준 응답(response.body.items.item) 및 변형 구조에서 item 배열을 찾는다 */
export function parseItems(xml: string): XmlRecord[] {
  const doc = parser.parse(xml);
  const found = findKey(doc, "item");
  if (!found) return [];
  return Array.isArray(found) ? (found as XmlRecord[]) : [found as XmlRecord];
}

/** 공공데이터 에러 응답(resultCode != 00) 검출 */
export function parseResultCode(xml: string): { code: string; msg: string } | null {
  const doc = parser.parse(xml);
  const code = findKey(doc, "resultCode") ?? findKey(doc, "returnReasonCode");
  const msg = findKey(doc, "resultMsg") ?? findKey(doc, "returnAuthMsg");
  return code === undefined ? null : { code: String(code), msg: String(msg ?? "") };
}

function findKey(node: unknown, key: string): unknown {
  if (node === null || typeof node !== "object") return undefined;
  if (key in (node as XmlRecord)) return (node as XmlRecord)[key];
  for (const v of Object.values(node as XmlRecord)) {
    const r = findKey(v, key);
    if (r !== undefined) return r;
  }
  return undefined;
}

/**
 * 응답 필드명이 확정되지 않았으므로 후보 패턴으로 값을 고른다.
 * 활용신청 후 실제 필드명을 확인하면 후보 맨 앞에 정확한 키를 추가할 것.
 */
export function pick(rec: XmlRecord, candidates: (string | RegExp)[]): string | undefined {
  for (const c of candidates) {
    if (typeof c === "string") {
      if (rec[c] !== undefined && rec[c] !== "") return String(rec[c]);
    } else {
      const k = Object.keys(rec).find((key) => c.test(key));
      if (k && rec[k] !== "") return String(rec[k]);
    }
  }
  return undefined;
}

/** 20261121, 2026-11-21, 2026.11.21 등 → YYYY-MM-DD */
export function normalizeDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return undefined;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}
