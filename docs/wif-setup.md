# WIF 설정 (Squirrel-Garden)

GitHub Actions 가 키 파일 없이 Cloud Run 에 배포하도록 Google Cloud 를 설정한다.
교안의 `docs/wif-setup.md` 를 Squirrel-Garden 값으로 옮긴 것이다. `llm-api-key` 시크릿은 쓰지 않는다.

## 실행 전 점검 (명령마다 확인)

| 확인할 것 | 걸리면 |
|---|---|
| 서비스 계정 키 파일(JSON)을 만드는가 (`keys create`) | 실행하지 않는다. WIF 로 한다 |
| Owner, Editor 같은 기본 역할을 주는가 | 실행하지 않는다. 아래 역할 표와 대조한다 |
| 권한 대상이 프로젝트 전체인가 | `serviceAccountUser` 는 runtime, builder 두 계정에만 준다 |
| 템플릿과 다른 액션 버전을 쓰는가 | 실행하지 않는다 |
| 무언가를 삭제하는가 | 대상 이름을 확인하고 판단한다 |

## 값

| 이름 | 값 |
|---|---|
| 프로젝트 ID | `friend-agent-course-512206` |
| 저장소 | `C-Lake864/Squirrel-Garden` |
| 서비스, 리전 | `squirrel-garden`, `us-central1` |
| 런타임 서비스 계정 | `squirrel-garden-runtime` |
| 빌드 서비스 계정 | `squirrel-garden-builder` |
| 배포 서비스 계정 | `github-deployer` |
| 풀, 공급자 | `github`, `squirrel-garden-repo` |

## 역할 표

| 계정 | 역할 | 대상 |
|---|---|---|
| squirrel-garden-runtime | 없음 (시크릿을 읽지 않는다) | |
| squirrel-garden-builder | `roles/run.builder` | 프로젝트 |
| github-deployer | `roles/run.sourceDeveloper` | 프로젝트 |
| github-deployer | `roles/serviceusage.serviceUsageConsumer` | 프로젝트 |
| github-deployer | `roles/iam.serviceAccountUser` | squirrel-garden-runtime 계정 하나 |
| github-deployer | `roles/iam.serviceAccountUser` | squirrel-garden-builder 계정 하나 |
| 저장소 신원 | `roles/iam.workloadIdentityUser` | github-deployer 계정 하나 |

## 0. 변수

```bash
PROJECT_ID=friend-agent-course-512206
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
REPO=C-Lake864/Squirrel-Garden
DEPLOYER=github-deployer@$PROJECT_ID.iam.gserviceaccount.com
```

## 1. 런타임, 빌드 서비스 계정

```bash
gcloud iam service-accounts create squirrel-garden-runtime --project $PROJECT_ID --display-name "squirrel-garden 실행용"
gcloud iam service-accounts create squirrel-garden-builder --project $PROJECT_ID --display-name "squirrel-garden 빌드용"
gcloud projects add-iam-policy-binding $PROJECT_ID --member "serviceAccount:squirrel-garden-builder@$PROJECT_ID.iam.gserviceaccount.com" --role roles/run.builder
```

## 2. 배포 서비스 계정

```bash
gcloud iam service-accounts create github-deployer --project $PROJECT_ID --display-name "GitHub Actions 배포용"
gcloud projects add-iam-policy-binding $PROJECT_ID --member "serviceAccount:$DEPLOYER" --role roles/run.sourceDeveloper
gcloud projects add-iam-policy-binding $PROJECT_ID --member "serviceAccount:$DEPLOYER" --role roles/serviceusage.serviceUsageConsumer
gcloud iam service-accounts add-iam-policy-binding squirrel-garden-runtime@$PROJECT_ID.iam.gserviceaccount.com --project $PROJECT_ID --member "serviceAccount:$DEPLOYER" --role roles/iam.serviceAccountUser
gcloud iam service-accounts add-iam-policy-binding squirrel-garden-builder@$PROJECT_ID.iam.gserviceaccount.com --project $PROJECT_ID --member "serviceAccount:$DEPLOYER" --role roles/iam.serviceAccountUser
```

## 2-1. 첫 배포 (사용자 계정으로 한 번)

새 서비스를 만드는 일은 배포 서비스 계정 권한에 없으므로 내 계정으로 한 번 만든다.
이후 변경은 자동 배포가 한다.

```bash
gcloud run deploy squirrel-garden --project $PROJECT_ID --region us-central1 --source . \
  --service-account squirrel-garden-runtime@$PROJECT_ID.iam.gserviceaccount.com \
  --build-service-account projects/$PROJECT_ID/serviceAccounts/squirrel-garden-builder@$PROJECT_ID.iam.gserviceaccount.com \
  --allow-unauthenticated --max-instances 1 \
  --set-env-vars GIT_SHA=first-manual
```

## 3. 풀과 공급자

```bash
gcloud iam workload-identity-pools create github --project $PROJECT_ID --location global --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc squirrel-garden-repo --project $PROJECT_ID --location global --workload-identity-pool github --display-name "squirrel-garden 저장소" --issuer-uri "https://token.actions.githubusercontent.com" --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" --attribute-condition "assertion.repository=='$REPO'"
```

## 4. 권한 연결

```bash
gcloud iam service-accounts add-iam-policy-binding $DEPLOYER --project $PROJECT_ID --role roles/iam.workloadIdentityUser --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$REPO"
```

## 7. 저장소 변수

```bash
WIF_PROVIDER=$(gcloud iam workload-identity-pools providers describe squirrel-garden-repo --project $PROJECT_ID --location global --workload-identity-pool github --format 'value(name)')
gh variable set GCP_PROJECT_ID --body "$PROJECT_ID"
gh variable set WIF_PROVIDER --body "$WIF_PROVIDER"
gh variable set DEPLOY_SA --body "$DEPLOYER"
gh variable set RUNTIME_SA --body "squirrel-garden-runtime@$PROJECT_ID.iam.gserviceaccount.com"
gh variable set BUILD_SA --body "squirrel-garden-builder@$PROJECT_ID.iam.gserviceaccount.com"
gh variable list
```

## 8. 확인

- IAM > 서비스 계정: 세 계정의 키(Keys) 탭에 키가 없다.
- IAM: github-deployer 의 역할이 소스 배포, 서비스 사용량 소비자 두 개뿐이다.
- 워크로드 아이덴티티 제휴 > 공급자 수정 화면: 속성 조건에 `assertion.repository=='C-Lake864/Squirrel-Garden'` 이 있다.
- IAM 변경은 반영까지 최대 5분쯤 걸린다.
