## 2026-10-22 -- Squirrel-Garden 배포 방식
선택: friend-agent 는 그대로 두고, Squirrel-Garden(C-Lake864/Squirrel-Garden, 본인 계정 저장소)을 새 Cloud Run 서비스 squirrel-garden 으로 배포. 저장소는 원본을 그대로 clone 해서 작업.
버린 대안: friend-agent 덮어쓰기, friend-agent 삭제 후 재생성, 과제를 friend-agent 로만 진행.
이유: 덮어쓰기와 삭제는 되돌리기 어렵고 과제 시작 상태(llm-api-key 연결)를 깨뜨림. 새 서비스는 문제가 생겨도 그 서비스만 지우면 됨.
다시 볼 조건: friend-agent 가 더 필요 없어졌을 때, 또는 Cloud Run 에서 내장 SQLite 파일 데이터가 유지되지 않는 문제를 해결해야 할 때.

## 2026-10-22 -- 교안을 Squirrel-Garden 에 맞게 변형해 진행
선택: 교안(friend-agent 기준)을 Squirrel-Garden 에 맞게 변형. deploy.yml, WIF 설정 문서, 장애 패치 2개를 새로 작성하고 이름은 squirrel-garden-* 로 한다. llm-api-key 관련 단계는 뺀다. friend-agent 서비스는 건드리지 않는다.
버린 대안: 템플릿 저장소로 friend-agent 진행, 앞부분만 Squirrel-Garden 에서 하고 배포는 friend-agent 로 진행.
이유: 템플릿의 starter/ 폴더와 docs/wif-setup.md 가 이 저장소에 없고, 앱 구조(Express, SQLite)가 교안의 FastAPI 에이전트와 다름. 사용자가 변형안을 선택.
다시 볼 조건: 템플릿 저장소를 받게 되거나, 변형한 워크플로가 교안의 점검 항목(권한, 액션 버전)을 지키기 어려울 때.

## 2026-10-22 -- squirrel-garden 공개 범위와 첫 배포 방식
선택: 서비스를 공개(allow-unauthenticated)로 두고, 첫 배포(서비스 생성)는 사용자 계정으로 gcloud 를 한 번 실행해 만든다. 이후 변경은 GitHub Actions 자동 배포가 담당하고 배포 서비스 계정은 교안의 권한 4개만 갖는다.
버린 대안: 비공개(IAM 인증 필요), 배포 서비스 계정에 서비스 생성 권한(run.developer 등)까지 부여.
이유: 사용자가 교안처럼 브라우저로 바로 열 수 있기를 선택. 최소 권한 원칙 때문에 배포 서비스 계정 권한은 넓히지 않음.
다시 볼 조건: 실습이 끝났을 때(서비스 삭제 또는 비공개 전환 검토). 앱에 로그인이 없어 URL을 아는 누구나 할 일을 보고 지울 수 있음.

## 2026-10-22 -- 디자인 v2 반영: 연속 달성 규칙과 Jua 폰트
선택: 사용자가 Claude Design 에서 만든 v2 를 앱에 반영한다. 알밤 규칙은 "연속 달성"으로 바꾼다(나무 단계 = 연속으로 알밤을 얻은 날 수, 하루 건너뛰면 0, 누적 총합은 계속 쌓임). 제목 폰트 Jua 는 Google Fonts 링크로 넣는다.
버린 대안: 현재 규칙(이번 달 알밤 수) 유지 + 총합만 추가, 규칙은 나중에 화면만 v2 로. 폰트 파일 직접 포함, 폰트 없이 기존 서체.
이유: v2 안내문("하루라도 건너뛰게 되면 원래대로 돌아와요")과 규칙을 일치시키기 위해. 사용자가 두 항목 모두 추천안을 선택.
다시 볼 조건: 연속 규칙이 너무 엄격하게 느껴질 때(할 일이 없는 날도 끊김으로 계산됨), 또는 Google Fonts 요청이 문제가 될 때(접속자의 브라우저가 Google 에 요청을 보냄).

## 2026-10-22 -- 날짜별, 카테고리별 보기 방식
선택: 날짜는 '날짜별' 탭에서 날짜 고르기 + 이전/다음 날 이동으로, 카테고리는 알약 필터 버튼으로 보여 준다. 두 조건은 함께 쓸 수 있다(서버 필터: filter=date&date=...&category=...).
버린 대안: 전체 목록을 날짜 제목으로 묶어 보기, 카테고리 제목으로 묶어 보기, 두 방식을 모두 넣기.
이유: 특정 날의 알밤을 되돌아보기 좋고 연속 달성 규칙과 잘 맞으며, 필터 버튼은 날짜 보기와 겹쳐 쓰기 쉽다. 사용자가 추천안을 선택.
다시 볼 조건: 마감일 없는 할 일이 늘어 '날짜별'에서 보이지 않는 점이 불편해질 때(그런 할 일은 '전체'에서만 보인다), 카테고리가 많아져 버튼 줄이 길어질 때.

## 2026-10-27 -- 이미지 배포 실습의 기준 저장소를 Squirrel-Garden 으로
선택: 교안의 friend-agent 대신 이 저장소(Squirrel-Garden)에서 실습한다. 교안의 이름은 friend-agent→squirrel-garden, COMMIT_SHA→GIT_SHA, pytest→npm test 로 바꿔 쓰고, 배포 계정은 기존 github-deployer 를 그대로 쓴다. 버린 대안: friend-agent 저장소에 전용 배포 계정 friend-agent-deployer 를 만들어 진행(이미 만들어 둠, 사용하지 않음).
이유: 이 저장소에 WIF, 배포 계정, BUILD_SA 변수, Dockerfile, /version(GIT_SHA)이 이미 있어 교안의 시작 상태와 가장 가깝다. 빠진 것은 ci.yml, staging 브랜치와 환경, staging 서비스였다.
다시 볼 조건: 교안의 고장 난 Dockerfile 실습(섹션 7)처럼 Python/tesseract 전제인 부분을 Node 에 맞출 때.

## 2026-10-27 -- 이미지 정리 정책: 7일 지난 것 삭제, 최근 10개 유지 (드라이런)
선택: squirrel-garden, cloud-run-source-deploy 두 저장소에 docs/cleanup-policy.json 의 정책(7일보다 오래된 이미지 삭제 + 최근 10개 유지)을 드라이런으로 건다. 실제 삭제(--no-dry-run)는 감사 로그로 지워질 이미지를 확인한 뒤 따로 정한다. 버린 대안: 삭제 정책만 걸기(production 이 쓰는 이미지가 지워질 수 있음), 바로 실제 적용.
이유: 롤백하려면 이전 리비전이 쓰던 이미지가 남아 있어야 한다. staging 과 production 이미지가 같은 저장소에 함께 쌓이므로 두 환경의 최근 몇 번의 배포를 남기는 기준으로 10개를 잡았다.
다시 볼 조건: 정책 반영(하루 뒤) 후 감사 로그의 드라이런 결과가 롤백에 필요한 이미지를 포함할 때, 배포가 잦아져 10개로 부족할 때.
