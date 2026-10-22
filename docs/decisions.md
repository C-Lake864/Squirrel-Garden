## 2026-10-22 -- Squirrel-Garden 배포 방식
선택: friend-agent 는 그대로 두고, Squirrel-Garden(C-Lake864/Squirrel-Garden, 본인 계정 저장소)을 새 Cloud Run 서비스 squirrel-garden 으로 배포. 저장소는 원본을 그대로 clone 해서 작업.
버린 대안: friend-agent 덮어쓰기, friend-agent 삭제 후 재생성, 과제를 friend-agent 로만 진행.
이유: 덮어쓰기와 삭제는 되돌리기 어렵고 과제 시작 상태(llm-api-key 연결)를 깨뜨림. 새 서비스는 문제가 생겨도 그 서비스만 지우면 됨.
다시 볼 조건: friend-agent 가 더 필요 없어졌을 때, 또는 Cloud Run 에서 내장 SQLite 파일 데이터가 유지되지 않는 문제를 해결해야 할 때.
