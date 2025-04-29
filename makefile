## ショートカット（自分のよく使うものを登録すると便利）
default: containers-start
lint: policy-edit-frontend-lint policy-edit-backend-lint policy-edit-mcp-lint frontend-lint idea-discussion-backend-lint admin-lint
format: policy-edit-frontend-format policy-edit-backend-format policy-edit-mcp-format frontend-format idea-discussion-backend-format admin-format
test: policy-edit-frontend-test policy-edit-backend-test policy-edit-mcp-test frontend-test idea-discussion-backend-test admin-test

# ターゲット定義（makefile は薄いラッパーとして使う。複雑な処理を書かずシンプルに保つこと）
containers-start:
	docker compose up

containers-stop:
	docker compose down

idea-discussion-containers-start:
	docker compose up frontend idea-backend mongo admin

policy-edit-containers-start:
	docker compose up policy-frontend policy-backend

policy-edit-frontend-lint:
	cd policy-edit/frontend && npm run lint

policy-edit-frontend-format:
	cd policy-edit/frontend && npm run format

policy-edit-frontend-test:
	cd policy-edit/frontend && npm run test

policy-edit-backend-lint:
	cd policy-edit/backend && npm run lint

policy-edit-backend-format:
	cd policy-edit/backend && npm run format

policy-edit-backend-test:
	cd policy-edit/backend && npm run test

policy-edit-mcp-lint:
	cd policy-edit/mcp && npm run lint

policy-edit-mcp-format:
	cd policy-edit/mcp && npm run format

policy-edit-mcp-test:
	cd policy-edit/mcp && npm run test

frontend-lint:
	cd frontend && npm run lint

frontend-format:
	cd frontend && npm run format

frontend-test:
	cd frontend && npm run test

idea-discussion-backend-lint:
	cd idea-discussion/backend && npm run lint

idea-discussion-backend-format:
	cd idea-discussion/backend && npm run format

idea-discussion-backend-test:
	cd idea-discussion/backend && npm run test

# Admin panel commands
admin-containers-start:
	docker compose up admin

admin-lint:
	cd admin && npm run lint

admin-format:
	cd admin && npm run format

admin-test:
	cd admin && npm run test

admin-build:
	cd admin && npm run build
