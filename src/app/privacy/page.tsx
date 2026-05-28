import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보처리방침 — 모닝커피',
  description: '모닝커피 앱의 개인정보처리방침',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold mb-8">개인정보처리방침</h1>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <p className="text-foreground font-medium">
          시행일: 2026년 5월 28일
        </p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">1. 수집하는 개인정보</h2>
          <p>모닝커피는 서비스 제공을 위해 다음 정보를 처리합니다:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong className="text-foreground">위치 정보 (선택)</strong>: 현재 위치 근처 카페를 찾기 위해 GPS 좌표를 사용합니다. 위치 정보는 서버에 저장되지 않으며, 기기에서만 처리됩니다.
            </li>
            <li>
              <strong className="text-foreground">사용 데이터</strong>: Google Analytics 4를 통해 앱 사용 패턴(페이지 조회, 기능 사용 빈도)을 익명으로 수집합니다. 개인을 식별할 수 없는 통계 데이터입니다.
            </li>
            <li>
              <strong className="text-foreground">로컬 저장 데이터</strong>: 즐겨찾기, 최근 본 카페, 메모는 기기의 localStorage에만 저장되며 서버로 전송되지 않습니다.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">2. 계정 시스템</h2>
          <p>
            모닝커피는 회원가입이나 로그인을 요구하지 않습니다. 별도의 계정 시스템이 없으므로 이름, 이메일, 비밀번호 등의 개인정보를 수집하지 않습니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">3. 카페 제보</h2>
          <p>
            카페 제보 기능 이용 시 입력하신 카페명과 내용은 서비스 개선을 위해 서버에 저장됩니다. 제보에 개인정보를 포함하지 마세요.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">4. 제3자 서비스</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-foreground">카카오맵 SDK</strong>: 지도 표시 및 카페 정보 조회에 사용됩니다.</li>
            <li><strong className="text-foreground">Google Analytics</strong>: 익명 사용 통계 수집에 사용됩니다.</li>
            <li><strong className="text-foreground">Supabase</strong>: 카페 데이터베이스 호스팅에 사용됩니다.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">5. 데이터 보관 및 삭제</h2>
          <p>
            로컬 저장 데이터(즐겨찾기, 메모 등)는 브라우저 또는 앱 데이터 삭제 시 영구 제거됩니다. 서버에 저장되는 데이터는 없습니다(카페 제보 제외).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">6. 아동의 개인정보</h2>
          <p>
            모닝커피는 만 14세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">7. 문의</h2>
          <p>
            개인정보 관련 문의: <a href="mailto:sijinyudev@gmail.com" className="text-primary hover:underline">sijinyudev@gmail.com</a>
          </p>
        </section>

        <div className="border-t border-border pt-6 mt-8">
          <p className="text-xs text-muted-foreground">
            &copy; 2026. 유시진 All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
