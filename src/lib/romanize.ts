// 한글 주소 로마자 변환 — 국어의 로마자 표기법(Revised Romanization) 기반.
// 외부 의존성 0. 외국인 여행객이 택시/길찾기에서 주소를 읽을 수 있도록 표시용.
// ponytail: 자모 단위 매핑만 — 음운 변화(비음화/유음화 등)는 미반영. 주소 표기엔 충분.

const CHO = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const JUNG = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
// 종성(받침): 순서 = 없음,ㄱ,ㄲ,ㄳ,ㄴ,ㄵ,ㄶ,ㄷ,ㄹ,ㄺ,ㄻ,ㄼ,ㄽ,ㄾ,ㄿ,ㅀ,ㅁ,ㅂ,ㅄ,ㅅ,ㅆ,ㅇ,ㅈ,ㅊ,ㅋ,ㅌ,ㅍ,ㅎ (28개)
// 대표음 규칙에 가깝게 매핑 (ㄱ→k, ㄷ→t, ㅂ→p, ㅇ→ng 등)
const JONG = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'l', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;

/** 한글이 섞인 문자열을 로마자로 변환. 한글이 아닌 문자(숫자/공백/영문)는 그대로 통과. */
export function romanize(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code < HANGUL_BASE || code > HANGUL_END) {
      out += ch; // 한글 음절이 아니면 원본 유지
      continue;
    }
    const offset = code - HANGUL_BASE;
    const cho = Math.floor(offset / 588);
    const jung = Math.floor((offset % 588) / 28);
    const jong = offset % 28;
    out += CHO[cho] + JUNG[jung] + JONG[jong];
  }
  return out;
}

/** 주소를 로마자화하고 각 단어 첫 글자를 대문자로 (표기 가독성). ko 로케일에선 원본 그대로. */
export function romanizeAddress(address: string | null, locale: string): string {
  if (!address) return '';
  if (locale === 'ko') return address;
  return romanize(address)
    .split(' ')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// ponytail 셀프체크: 대표 주소 토큰이 기대 로마자와 맞는지
export function __demo() {
  const cases: [string, string][] = [
    ['강남구', 'gangnamgu'],
    ['분당구', 'bundanggu'],
    ['서울', 'seoul'],
    ['성남시', 'seongnamsi'],
    ['정자동', 'jeongjadong'],
  ];
  for (const [input, expected] of cases) {
    const got = romanize(input);
    if (got !== expected) throw new Error(`romanize("${input}") = "${got}", expected "${expected}"`);
  }
  return true;
}
