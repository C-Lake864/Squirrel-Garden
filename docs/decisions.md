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
