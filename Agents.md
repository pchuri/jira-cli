# Agents Release Playbook

## 목적
최근 버그 픽스가 반영됐지만 Conventional Commits 규칙을 지키지 않아 자동 배포가 스킵된 경우를 대비해 수동으로 릴리스를 트리거하는 절차를 정리한다.

## 옵션 1: 빈 커밋으로 semantic-release 트리거
1. 최신 `main`을 기준으로 작업 브랜치를 준비한다.
2. 빌드가 통과한 것을 확인한 뒤 아래 커밋을 만든다.
   ```bash
   git commit --allow-empty -m "fix: trigger release after hotfix"
   ```
3. PR을 생성해 CI가 통과하면 `main` 또는 `beta`에 병합한다.
4. 병합 시 Release 워크플로가 실행돼 패치 버전이 증가한다.

## 옵션 2: 수동 버전업 (예비용)
1. semantic-release가 실패하거나 비상 상황일 때만 사용한다.
2. `package.json`과 `package-lock.json`의 `version` 값을 원하는 버전으로 올린다.
3. 변경 사항을 커밋한다.
   ```bash
   git commit -am "chore(release): 1.0.1"
   ```
4. 태그를 작성해 푸시한다.
   ```bash
   git tag v1.0.1
   git push origin HEAD --tags
   ```
5. GitHub Release를 수동으로 작성하거나 `gh release create`를 사용한다.
6. npm 배포가 필요하면 `npm publish`를 수동으로 실행한다.

> 기본 전략은 Conventional Commits를 준수하는 실제 코드 변경 커밋을 생성하는 것이다. 위 절차는 긴급 상황에서만 사용하며, 작업 후에는 semantic-release 기반 자동 배포가 다시 동작하도록 커밋 메시지 규칙을 준수한다.
