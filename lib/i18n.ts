// 영어 화면 번역 (출퇴근 / 스케줄 / 로그인 / 매장선택 / 하단메뉴 한정)
// 화면에 나온 한글 문구를 사전에서 찾아 영어로 바꿔 보여줘요. 사전에 없는 문구(직원 입력 메모 등)는 그대로 둬요.

const PAIRS: [string, string][] = [
  // ── 로그인 / 매장선택 ──
  ['이름을 입력하세요', 'Enter your name'], ['PIN을 입력하세요', 'Enter your PIN'],
  ['등록되지 않은 이름입니다', 'Name not registered'], ['PIN이 틀렸습니다', 'Wrong PIN'],
  ['재직 중인 매장이 없어요. 사장님께 문의해주세요', 'No active store. Please ask the owner.'],
  ['매장노트', 'Store Note'], ['매장 운영의 모든 것', 'Everything for running your store'],
  ['이름', 'Name'], ['이름을 입력하세요', 'Enter your name'], ['4자리', '4 digits'],
  ['로그인 유지 (30일)', 'Stay logged in (30 days)'], ['로그인 중...', 'Logging in...'], ['로그인', 'Log in'],
  ['초기 PIN: 1234 (로그인 후 변경 필수)', 'Initial PIN: 1234 (must change after login)'],
  ['어떤 매장을 이용하시겠어요?', 'Which store would you like to use?'], ['매장 선택', 'Select store'],
  ['소속된 매장이 없습니다', 'You have no assigned store'], ['대표에게 등록 요청하세요', 'Ask the owner to register you'],
  ['대표', 'Owner'], ['관리자', 'Manager'], ['사원', 'Staff'], ['다른 계정으로 로그인', 'Log in with another account'],
  ['매장 이름 입력', 'Store name'], ['생성 중...', 'Creating...'], ['추가', 'Add'], ['취소', 'Cancel'], ['+ 새 매장 추가', '+ Add new store'],
  // ── 하단 메뉴 ──
  ['출퇴근', 'Clock In/Out'], ['체크리스트', 'Checklist'], ['마감', 'Closing'], ['재고&발주', 'Stock & Orders'], ['더보기', 'More'],
  ['스케줄', 'Schedule'], ['공지', 'Notices'], ['분석', 'Analytics'], ['직원관리', 'Staff'], ['레시피', 'Recipes'],
  ['매뉴얼', 'Manual'], ['목표매출', 'Sales Goal'], ['건의&제보', 'Suggestions'], ['결산', 'Settlement'], ['마이페이지', 'My Page'],
  // ── 공통 ──
  ['저장', 'Save'], ['저장 중...', 'Saving...'], ['삭제', 'Delete'], ['닫기', 'Close'], ['열기', 'Open'], ['설정', 'Settings'],
  ['확인', 'Confirm'], ['확인중...', 'Checking...'], ['로딩중...', 'Loading...'], ['로딩 중...', 'Loading...'], ['불러오는 중...', 'Loading...'],
  ['사유', 'Reason'], ['메모', 'Memo'], ['상태', 'Status'], ['없음', 'None'], ['승인됨', 'Approved'], ['거절됨', 'Rejected'],
  ['승인', 'Approve'], ['거절', 'Reject'], ['거부', 'Reject'], ['전송 중...', 'Sending...'], ['처리 중...', 'Processing...'],
  ['요청자', 'Requested by'], ['직원', 'Staff'], ['직원명', 'Staff'], ['전체', 'All'],
  // ── 요일/월 ──
  ['일', 'Sun'], ['월', 'Mon'], ['화', 'Tue'], ['수', 'Wed'], ['목', 'Thu'], ['금', 'Fri'], ['토', 'Sat'],
  ['일요일', 'Sunday'], ['월요일', 'Monday'], ['화요일', 'Tuesday'], ['수요일', 'Wednesday'], ['목요일', 'Thursday'], ['금요일', 'Friday'], ['토요일', 'Saturday'],
  ['날', 'Day'], ['날짜', 'Date'], ['요일', 'Day'], ['날짜 / 요일', 'Date / Day'], ['오늘', 'Today'], ['내일', 'Tomorrow'],
  ['신정', "New Year's Day"], ['설날연휴', 'Lunar New Year holiday'], ['삼일절', 'Independence Movement Day'], ['어린이날', "Children's Day"],
  ['어린이날/부처님오신날', "Children's Day / Buddha's Birthday"], ['부처님오신날', "Buddha's Birthday"], ['현충일', 'Memorial Day'],
  ['광복절', 'Liberation Day'], ['추석연휴', 'Chuseok holiday'], ['개천절', 'National Foundation Day'], ['한글날', 'Hangul Day'],
  ['크리스마스', 'Christmas'], ['근로자의날', "Labor Day"], ['설 전날', 'Seollal eve'], ['설날', 'Seollal'], ['설 다음날', 'Seollal day after'],
  ['추석 전날', 'Chuseok eve'], ['추석', 'Chuseok'], ['추석 다음날', 'Chuseok day after'], ['대체공휴일', 'Substitute holiday'], ['휴일', 'Holiday'],
  // ── 출퇴근 상태 ──
  ['정상', 'On time'], ['지각', 'Late'], ['조기퇴근', 'Left early'], ['지각+조기퇴근', 'Late + left early'], ['결근', 'Absent'],
  ['퇴근누락', 'No clock-out'], ['출근누락', 'No clock-in'], ['근무중', 'Working'], ['대기', 'Pending'], ['반차', 'Half day'], ['기타', 'Other'], ['조퇴', 'Early leave'],
  ['근무', 'Work'], ['출근', 'Clock in'], ['퇴근', 'Clock out'], ['출근 누락', 'Missed clock-in'], ['퇴근 누락', 'Missed clock-out'], ['출퇴근 모두', 'Both'],
  ['출근 시간', 'Clock-in time'], ['퇴근 시간', 'Clock-out time'], ['요청 유형', 'Request type'], ['출퇴근 수정 요청', 'Attendance correction request'],
  ['요청 후 대표 승인 시 반영됩니다', 'Applied after the owner approves'], ['수정이 필요한 사유를 입력해주세요', 'Enter the reason for the correction'],
  ['사유를 입력해주세요', 'Please enter a reason'], ['요청 보내기', 'Send request'], ['수정 요청이 전송되었습니다', 'Correction request sent'],
  ['출근 처리에 실패했습니다. 다시 시도해주세요.', 'Clock-in failed. Please try again.'], ['퇴근 처리에 실패했습니다. 다시 시도해주세요.', 'Clock-out failed. Please try again.'],
  ['IP 등록 완료', 'IP registered'],
  ['매장 와이파이 연결 필요', 'Connect to the store Wi-Fi'], ['이번 달 지적사항을 확인(체크)해야 출근할 수 있어요', "Check this month's notices to clock in"],
  ['전달사항을 모두 확인(체크)해야 출근할 수 있어요', 'Check all handover notes to clock in'], ['이미 출근했습니다', 'Already clocked in'],
  ['기록 조회', 'History'], ['전지점', 'All stores'], ['시간설정', 'Time settings'], ['수정요청', 'Request fix'],
  ['주말/공휴일', 'Weekend/Holiday'], ['오늘의 목표 매출', "Today's sales goal"], ['오늘의 목표 확인 완료!', "Today's goal confirmed!"], ['오늘의 목표를 확인했습니다', "I've checked today's goal"],
  ['매장 IP 미등록 — 대표가 먼저 IP를 등록해주세요', 'Store IP not registered — the owner must register it first'], ['와이파이 확인중...', 'Checking Wi-Fi...'],
  ['매장 와이파이 연결됨 — 출퇴근 가능', 'Store Wi-Fi connected — you can clock in/out'], ['매장 와이파이 미연결 — 출퇴근 불가', 'Not on store Wi-Fi — cannot clock in/out'],
  ['이번 달 지적사항', "This month's notices"], ['확인 체크 후 출근 가능', 'Check to clock in'], ['지적사항 사진', 'Notice photo'],
  ['매장 와이파이 연결 후 체크할 수 있습니다', 'Connect to the store Wi-Fi to check'], ['이번 달 지적사항을 확인했습니다 (필수)', "I've read this month's notices (required)"],
  ['이번 달 지적사항 확인 완료!', "This month's notices confirmed!"], ['출근 전 전달사항 확인 필수', 'Check handover notes before clocking in'],
  ['전날 마감 전달사항', "Yesterday's closing notes"], ['작성', 'By'], ['미완료 이월 할일', 'Unfinished carried-over tasks'], ['오늘 할일', "Today's tasks"],
  ['매장 와이파이 연결 후 체크할 수 있습니다', 'Connect to the store Wi-Fi to check'], ['전달사항을 모두 확인(체크)해야 출근 버튼이 활성화됩니다', 'Check all notes to enable the clock-in button'],
  ['전달사항 확인 완료 — 출근할 수 있어요!', 'All notes checked — you can clock in!'], ['이번달 내 근태', 'My attendance this month'],
  ['출근 기준', 'Clock-in time'], ['퇴근 기준', 'Clock-out time'], ['출근 대기중', 'Waiting to clock in'], ['오늘 스케줄 없음', 'No shift today'], ['퇴근 완료', 'Clocked out'],
  ['오늘 실근무시간', "Today's hours worked"], ['출퇴근 누락 수정 요청', 'Request attendance correction'], ['미출근', 'Not clocked in'],
  ['오늘 스케줄이 없습니다', 'No schedule today'], ['오늘 출퇴근 현황', "Today's attendance"], ['엑셀', 'Excel'], ['퇴사', 'Resigned'], ['근태', 'Attendance'],
  ['오늘 현황', "Today's status"], ['월별 기록', 'Monthly records'], ['건', 'items'], ['회', 'x'], ['완료', 'Done'],
  // ── 스케줄 ──
  ['스케줄이 없습니다', 'No schedule'], ['그리드 편집', 'Edit grid'], ['월간 보기', 'Monthly view'], ['그리드', 'Grid'], ['월간', 'Monthly'],
  ['직원별 보기로 전환', 'Switch to staff view'], ['표(PC) 보기로 전환', 'Switch to table view'], ['월간 요약', 'Monthly summary'],
  ['읽기 전용', 'Read only'], ['포지션 편집 / 휴일 요청 가능', 'Edit position / request day off'], ['셀 눌러서 편집', 'Tap a cell to edit'],
  ['선택', 'Select'], ['셀을 탭해서 여러 날 선택 후 아래 상태 버튼으로 일괄 적용하세요', 'Tap cells to select days, then apply a status below'],
  ['적용할 상태를 선택하세요', 'Choose a status to apply'], ['개 선택됨 — 적용할 상태를 선택하세요', ' selected — choose a status to apply'],
  ['메모 입력 (선택 · 전체 적용)', 'Memo (optional · applies to all)'], ['개 삭제', ' delete'],
  ['직원에게 비공개 (잠김)', 'Hidden from staff (locked)'], ['직원들이 스케줄을 볼 수 있어요', 'Staff can see the schedule'], ['직원들에게 스케줄이 보이지 않아요', 'Schedule is hidden from staff'],
  ['스케줄 작성 중', 'Schedule in progress'], ['대표가 스케줄을 완성하면 공개됩니다', 'It will be shown once the owner finishes the schedule'],
  ['지금 휴무 요청을 할 수 있어요 (셀 클릭)', 'You can request days off now (tap a cell)'],
  ['휴일확정', 'Day off confirmed'], ['요청중', 'Requested'], ['포지션', 'Position'], ['결근·조퇴', 'Absent/Early leave'], ['휴일요청', 'Day-off request'],
  ['조퇴 시간', 'Early leave time'], ['결근 처리 → 출퇴근에도 자동 반영됩니다', 'Marked absent → also applied to attendance'],
  ['병원, 생일, 야채샐러드...', 'Hospital, birthday, salad prep...'], ['야간, 오픈, 마감, 병원... (비워두면 메모 없음)', 'Night, open, close, hospital... (leave blank for no memo)'],
  ['(선택 · 메모', '(optional · memo'], ['일 전체 적용)', 'days)'], ['확정 잠금 OFF', 'Confirm lock OFF'], ['확정 잠금 ON', 'Confirm lock ON'],
  ['매니저가 이 날 수정 불가', 'Managers cannot edit this day'], ['누르면 매니저 수정 차단', 'Tap to block manager edits'],
  ['결근·조퇴 직접 저장', 'Save absence/early leave directly'], ['대표 승인 없이 바로 반영됩니다', 'Applied immediately without owner approval'],
  ['사유 입력...', 'Enter reason...'], ['휴일 변경 요청', 'Day-off change request'], ['대표 승인 후 반영됩니다', 'Applied after owner approval'],
  ['요청 상태', 'Request status'], ['요청 사유', 'Reason'], ['변경 사유를 입력해주세요', 'Enter the reason for the change'], ['변경 요청 보내기', 'Send change request'],
  ['변경 요청', 'Change request'], ['변경요청', 'Change requests'], ['변경 요청이 전송되었습니다!', 'Change request sent!'],
  ['휴무 요청 대기 중', 'Day-off request pending'], ['휴무 요청 거부됨', 'Day-off request rejected'], ['휴무 확정됨 🎉', 'Day off confirmed 🎉'],
  ['사유:', 'Reason:'], ['요청 취소하기', 'Cancel request'], ['휴무 확정', 'Day off confirmed'], ['휴무 요청 중', 'Requesting day off'],
  ['배려해주세요 💙', 'Please be considerate 💙'], ['다음 달 휴무 요청', 'Next month day-off request'], ['사유를 입력하고 요청해주세요', 'Enter a reason and send your request'],
  ['요청해도 같은 날 누군가 예비군 신청을 하면 휴무가 반영되지 않을 수 있어요 (자동 거절 + 알림)', 'If someone applies for reserve forces duty on the same day, your day off may not be granted (auto-rejected + notice)'],
  ['사유 필수 입력 (예: 병원, 가족행사...)', 'Reason required (e.g. hospital, family event...)'],
  ['증빙 사진 (선택 — 예비군 소집통지서, 진단서 등)', 'Proof photo (optional — reserve forces notice, medical certificate, etc.)'],
  ['업로드 중...', 'Uploading...'], ['휴무 요청 보내기', 'Send day-off request'], ['휴무 요청', 'Day-off request'], ['휴무요청', 'Day-off request'],
  ['예비군', 'Reserve forces'], ['휴무 신청', 'Day-off request'], ['휴무 거절', 'Day off rejected'], ['휴무 승인', 'Day off approved'],
  ['요청 불가 날짜 (공휴일/지정일)', 'Unavailable dates (holidays/designated days)'], ['요청 불가일', 'Unavailable days'], ['요청 불가', 'Unavailable'],
  ['직원 휴무 요청 중', 'Staff day-off requests open'], ['휴무 요청 닫힘', 'Day-off requests closed'], ['휴무 요청 열림', 'Day-off requests open'],
  ['직원 순서 변경', 'Reorder staff'], ['드래그해서 순서를 바꿔보세요', 'Drag to reorder'], ['순서', 'Order'], ['요청', 'Requests'],
  ['복사', 'Copy'], ['붙여넣기', 'Paste'], ['복사 취소', 'Cancel copy'], ['여기 붙여넣기', 'Paste here'], ['복사 중', 'Copying'],
  ['비공개', 'Hidden'], ['공개', 'Visible'], ['공개하기', 'Publish'], ['비공개로', 'Hide'], ['직원에게 비공개', 'Hidden from staff'], ['직원에게 공개됨', 'Visible to staff'],
  ['출근↑', 'In↑'], ['출근자 없음', 'No one clocked in'], ['등록된 출근자 없음', 'No one clocked in'], ['직원 없음', 'No staff'], ['등록된 직원 없음', 'No staff registered'],
  ['저장 실패:', 'Save failed:'], ['첨부 사진 업로드 실패:', 'Attachment upload failed:'], ['휴무', 'Off'], ['반', 'Half'], ['결', 'Abs'], ['기', 'Etc'], ['조', 'Early'], ['휴', 'Off'],
  ['대표가 확정한 날은 수정할 수 없어요', 'Days confirmed by the owner cannot be edited'], ['대표가 확정한 날은 변경 요청할 수 없어요', 'Days confirmed by the owner cannot be changed'],
  ['대표가 확정한 날은 삭제할 수 없어요', 'Days confirmed by the owner cannot be deleted'], ['지점 데이터가 없습니다.', 'No store data.'],
  ['확정', 'Confirmed'], ['수정 이력이 없습니다', 'No edit history'], ['삭제됨', 'Deleted'], ['일괄', 'Bulk'],
  // ── 예비군 ──
  ['예비군 날짜를 선택해주세요', 'Please select the reserve forces date'], ['증빙 서류(사진)를 올려야 신청할 수 있어요', 'Upload a proof document (photo) to apply'],
  ['이미 이 날짜에 예비군 신청을 했어요.', 'You already applied for this date.'], ['예비군 휴무 신청', 'Reserve forces day-off request'],
  ['예비군 휴무 신청하기', 'Apply for reserve forces day off'], ['예비군 날짜', 'Reserve forces date'], ['* 필수', '* Required'],
  ['증빙 서류 사진', 'Proof document photo'], ['(예비군 소집통지서 등)', '(reserve forces notice, etc.)'], ['메모 (선택)', 'Memo (optional)'],
  ['예: 동원훈련 1일차', 'e.g. Mobilization training day 1'], ['신청 중...', 'Submitting...'], ['내 신청 내역', 'My requests'], ['신청 내역이 없어요', 'No requests yet'],
  ['증빙 서류 업로드 실패:', 'Proof upload failed:'], ['신청에 실패했어요:', 'Request failed:'], ['자동 거절', 'auto-rejected'],
  ['별도로 휴일을 챙겨주지 않아요.', 'no extra day off will be given.'], ['출근하는 것이 기본 원칙', 'return to work after the duty is the default rule'], ['이에요.', '.'],
  ['님 · 일반 휴무 요청과 별개예요 (요청 불가 날짜도 신청 가능)', " · Separate from regular day-off requests (can apply on unavailable dates too)"],
  ['되고 알림이 가요.', ' and they get notified.'],
  // ── 기타 ──
  ['지점', 'Store'], ['(이름없음)', '(no name)'], ['다시 시도해주세요', 'Please try again'], ['출근 미설정', 'No clock-in time set'], ['퇴근 미설정', 'No clock-out time set'],
  ['현재 IP', 'Current IP'], ['등록된 IP', 'Registered IP'], ['등록', 'Register'], ['매장 IP 설정', 'Store IP setup'], ['매장 와이파이에 연결된 상태에서 등록하세요', 'Register while connected to the store Wi-Fi'],
  ['/ ', '/ '],
]

const DICT = new Map<string, string>(PAIRS)

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW_FULL: Record<string, string> = { 일: 'Sun', 월: 'Mon', 화: 'Tue', 수: 'Wed', 목: 'Thu', 금: 'Fri', 토: 'Sat' }
const HANGUL = /[가-힣]/

type Rule = [RegExp, (m: RegExpMatchArray, tr: (s: string) => string) => string]
const RULES: Rule[] = [
  [/^(\d+)월 (\d+)일 ([일월화수목금토])요일$/, m => `${DOW_FULL[m[3]]}, ${MON[+m[1] - 1]} ${m[2]}`],
  [/^(\d+)월 (\d+)일$/, m => `${MON[+m[1] - 1]} ${m[2]}`],
  [/^(\d{4})년\s*(\d+)월(.*)$/, (m, tr) => `${MON[+m[2] - 1]} ${m[1]}${m[3].trim() ? ' ' + tr(m[3].trim()) : ''}`],
  [/^(\d{4})\.(\d+) 근태$/, m => `${m[1]}.${m[2]} Attendance`],
  [/^(\d+)월 기준$/, m => `As of ${MON[+m[1] - 1]}`],
  [/^(\d+)월 합계$/, m => `${MON[+m[1] - 1]} total`],
  [/^(\d+)월$/, m => MON[+m[1] - 1] || m[0]],
  [/^(\d+)년$/, m => m[1]],
  [/^(\d+)건$/, m => `${m[1]} items`],
  [/^(\d+)명 출근$/, m => `${m[1]} working`],
  [/^(\d+)명$/, m => `${m[1]}`],
  [/^(\d+)개 선택$/, m => `${m[1]} selected`],
  [/^☑ (\d+)개 선택$/, m => `☑ ${m[1]} selected`],
  [/^(\d+)개 선택됨 — 적용할 상태를 선택하세요$/, m => `${m[1]} selected — choose a status to apply`],
  [/^🗑 (\d+)개 삭제$/, m => `🗑 Delete ${m[1]}`],
  [/^(\d+)회$/, m => `${m[1]}x`],
  [/^(\d+)일째$/, m => `Day ${m[1]}`],
  [/^(\d+)일$/, m => `${m[1]}d`],
  [/^(\d+)분 지각$/, m => `${m[1]} min late`],
  [/^\((\d+)분 지각\)$/, m => `(${m[1]} min late)`],
  [/^(\d+)시간(?: (\d+)분)?$/, m => `${m[1]}h${m[2] ? ' ' + m[2] + 'm' : ''}`],
  [/^(\d+)분$/, m => `${m[1]}m`],
  [/^(→ )?(\d{1,2}:\d{2}) (출근|퇴근)$/, m => `${m[1] || ''}${m[2]} ${m[3] === '출근' ? 'In' : 'Out'}`],
  [/^(\d{1,2}:\d{2}) 출근 → (\d{1,2}:\d{2}) 퇴근$/, m => `${m[1]} In → ${m[2]} Out`],
  [/^기준 (.*)$/, m => `Standard ${m[1]}`],
  [/^\(기준 (.*)\)$/, m => `(Standard ${m[1]})`],
  [/^(\d+)\/(\d+) 확인$/, m => `${m[1]} / ${m[2]} checked`],
  [/^([^\n]*?)에 휴무를 신청했습니다$/, m => m[0]],
]

function translateLine(line: string): string {
  const lead = (line.match(/^\s*/) as RegExpMatchArray)[0]
  const trail = (line.match(/\s*$/) as RegExpMatchArray)[0]
  const core = line.trim()
  if (!core || !HANGUL.test(core)) return line
  const res = translateCore(core)
  return res === core ? line : lead + res + trail
}

function translateCore(core: string): string {
  const exact = DICT.get(core)
  if (exact !== undefined) return exact
  for (const [re, fn] of RULES) {
    const m = core.match(re)
    if (m) return fn(m, translateCore)
  }
  // 앞/뒤의 이모지·기호를 떼고 다시 찾기
  const pre = (core.match(/^[^\p{L}\p{N}(]*/u) as RegExpMatchArray)[0]
  const rest = core.slice(pre.length)
  if (pre && rest) {
    const r = translateCore(rest)
    if (r !== rest) return pre + r
  }
  const suf = (core.match(/[^\p{L}\p{N})?]*$/u) as RegExpMatchArray)[0]
  const rest2 = core.slice(0, core.length - suf.length)
  if (suf && rest2) {
    const r = translateCore(rest2)
    if (r !== rest2) return r + suf
  }
  // "라벨: 값" 형태
  const lm = core.match(/^([^:]{1,40}?):\s*(.*)$/)
  if (lm) {
    const label = DICT.get(lm[1]) ?? DICT.get(lm[1] + ':')
    if (label) return `${label}: ${translateCore(lm[2]) }`
  }
  // 라벨 사전에 ':' 붙은 항목
  const withColon = DICT.get(core.replace(/\s*:\s*$/, ''))
  if (withColon && /:\s*$/.test(core)) return withColon + ':'
  // 숫자 + 단위가 섞인 문장은 조각 단위로 번역
  const parts = core.split(/(\d+[:.]?\d*)/)
  if (parts.length > 1) {
    const out = parts.map(p => (HANGUL.test(p) ? translateCore(p.trim()) === p.trim() ? p : ' ' + translateCore(p.trim()) + ' ' : p))
    const joined = out.join('').replace(/\s+/g, ' ').trim()
    if (joined !== core) return joined
  }
  return core
}

/** 한글 → 영어. 줄바꿈이 있으면 줄마다 번역 */
export function toEnglish(text: string): string {
  if (!text || !HANGUL.test(text)) return text
  if (text.includes('\n')) return text.split('\n').map(translateLine).join('\n')
  return translateLine(text)
}
