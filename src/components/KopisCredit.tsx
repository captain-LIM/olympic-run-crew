/**
 * KOPIS OPEN API 이용 조건: KOPIS에 의거해 개발된 서비스임을 반드시 명시해야 하고,
 * 출처가 없으면 서비스가 중단될 수 있다. 문구는 KOPIS가 든 예시 형식을 그대로 따른다.
 */
export function KopisCredit({ className = "" }: { className?: string }) {
  return (
    <span className={className}>
      출처 : (재)예술경영지원센터 공연예술통합전산망,{" "}
      <a href="https://www.kopis.or.kr" target="_blank" rel="noopener noreferrer" className="lnk">www.kopis.or.kr</a>
    </span>
  );
}
