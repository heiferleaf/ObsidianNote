---
created: 2026-03-02
modified: 2026-03-05
---
## Docker 部署 + CI/CD 自动化笔记

---

## 一、架构概览

服务器上运行 3 个 Docker 容器，通过内部虚拟网络互相通信：

- **SpringBoot 容器** - 业务应用
- **MySQL 容器** - 关系型数据库
- **Redis 容器** - 缓存数据库

容器间通信通过服务名而非 IP，例如 SpringBoot 连接 MySQL 使用 `mysql:3306`。

---

## 二、项目文件结构

### 本地项目根目录（与 pom.xml 同级）
```
项目根目录/
├── src/
├── pom.xml
├── Dockerfile                 ← 构建 SpringBoot 镜像的菜谱
├── docker-compose.yml         ← 编排所有容器
├── docker/
│   └── init.sql               ← 数据库建表语句
└── .github/
    └── workflows/
        └── deploy.yml         ← CI/CD 自动化工作流
```

### 服务器上文件结构
```
/root/backend/
├── docker-compose.yml
└── docker/
    └── init.sql
```

---

## 三、关键配置文件

### 3.1 application.yml 环境变量写法

使用 `${变量名:默认值}` 语法，本地开发用默认值，Docker 环境注入环境变量覆盖：

```yaml
spring:
  datasource:
    url: jdbc:mysql://${MYSQL_HOST:localhost}:3306/${MYSQL_DB:yourdb}?useSSL=false&serverTimezone=Asia/Shanghai&characterEncoding=utf8&allowPublicKeyRetrieval=true
    username: ${MYSQL_USER:root}
    password: ${MYSQL_PASSWORD:本地密码}
  
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: 6379
      password: ${REDIS_PASSWORD:}

flask:
  base-url: ${FLASK_URL:http://127.0.0.1:8001}
```

### 3.2 Dockerfile（多阶段构建）

第一阶段用 Maven 编译打包，第二阶段只保留轻量 JRE + jar，最终镜像体积小：

```dockerfile
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests -B

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

COPY --from=builder /build/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### 3.3 docker-compose.yml

```yaml
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: Root123456
      MYSQL_DATABASE: yourdb
      MYSQL_USER: appuser
      MYSQL_PASSWORD: App123456
    volumes:
      - mysql_data:/var/lib/mysql           # 数据持久化
      - ./docker/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks: [app-net]

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass Redis123456
    networks: [app-net]

  springboot:
    image: 阿里云镜像地址/命名空间/仓库名:latest
    ports: ["8080:8080"]
    environment:
      MYSQL_HOST: mysql
      MYSQL_DB: yourdb
      MYSQL_USER: appuser
      MYSQL_PASSWORD: App123456
      REDIS_HOST: redis
      REDIS_PASSWORD: Redis123456
      FLASK_URL: http://服务器IP:8001
    depends_on: [mysql, redis]
    networks: [app-net]

networks:
  app-net:
    driver: bridge

volumes:
  mysql_data:
```

### 3.4 GitHub Actions 工作流（deploy.yml）

触发条件：push 到 main 分支，自动执行构建和部署：

```yaml
on:
  push:
    branches: [backend]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: 登录阿里云
        run: docker login ${{ secrets.ALIYUN_REGISTRY }} -u ${{ secrets.ALIYUN_USERNAME }} -p ${{ secrets.ALIYUN_PASSWORD }}
      
      - name: 构建并推送镜像
        run: |
          docker build -t ${{ secrets.ALIYUN_REGISTRY }}/命名空间/仓库名:latest .
          docker push ${{ secrets.ALIYUN_REGISTRY }}/命名空间/仓库名:latest
      
      - name: SSH 部署到服务器
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          password: ${{ secrets.SERVER_PASSWORD }}
          script: |
            cd /root/backend
            docker login ${{ secrets.ALIYUN_REGISTRY }} -u ${{ secrets.ALIYUN_USERNAME }} -p ${{ secrets.ALIYUN_PASSWORD }}
            docker pull ${{ secrets.ALIYUN_REGISTRY }}/命名空间/仓库名:latest
            docker compose up -d springboot
            docker image prune -f
```

### 3.5 GitHub Secrets 配置

在仓库 Settings → Secrets and variables → Actions 中添加：

| 变量名 | 作用 |
|--------|------|
| `ALIYUN_REGISTRY` | 阿里云镜像仓库地址（crpi-xxx.cr.aliyuncs.com） |
| `ALIYUN_USERNAME` | 阿里云账号名（aliyunXXXX） |
| `ALIYUN_PASSWORD` | 阿里云访问凭证密码 |
| `SERVER_HOST` | 服务器公网 IP |
| `SERVER_USER` | 服务器用户名（root） |
| `SERVER_PASSWORD` | 服务器登录密码 |

---

## 四、初次部署步骤

1. **准备数据库脚本**
   - 在 DataGrip 导出 DDL，保存为 `docker/init.sql`
   - 文件开头添加 `USE yourdb;`

2. **修改配置文件**
   - 修改 `application.yml`，将连接地址改为环境变量写法
   - 项目根目录创建 `Dockerfile` 和 `docker-compose.yml`

3. **服务器环境准备**
   ```bash
   # 安装 Docker
   curl -fsSL https://get.docker.com | sh
   
   # 安装 Docker Compose
   apt-get install -y docker-compose-plugin
   
   # 登录阿里云镜像仓库
   docker login 仓库地址 -u 账号 -p 密码
   ```

4. **上传项目文件到服务器**
   ```bash
   scp -r . root@服务器IP:/root/backend
   ```

5. **启动所有容器**
   ```bash
   cd /root/backend
   docker compose up -d --build
   ```

6. **验证部署**
   ```bash
   # 验证数据库建表
   docker exec -it mysql mysql -u root -p -e 'SHOW TABLES;'
   
   # 验证应用日志
   docker compose logs springboot
   ```

7. **开放防火墙端口**
   - 在阿里云安全组开放 8080 端口（入方向，TCP，0.0.0.0/0）

---

## 五、日常开发流程（CI/CD 配置完成后）

配置完成后，日常更新只需三步：

```bash
git add .
git commit -m '你的提交信息'
git push
```

GitHub Actions 自动完成：
- 编译代码
- 构建镜像
- 推送阿里云
- SSH 部署服务器

---

## 六、常用 Docker 命令

### 6.1 容器管理

| 命令 | 作用 |
|------|------|
| `docker compose ps` | 查看所有容器状态 |
| `docker compose up -d` | 启动所有服务（后台运行） |
| `docker compose up -d --build` | 重新构建镜像并启动所有服务 |
| `docker compose up -d springboot` | 只启动/更新 springboot 服务 |
| `docker compose stop` | 停止所有服务（不删除容器） |
| `docker compose start` | 启动已停止的服务 |
| `docker compose restart springboot` | 重启某个服务 |
| `docker compose down` | 停止并删除所有容器（数据卷保留） |
| `docker compose down -v` | 停止并删除容器和数据卷（数据清空） |

### 6.2 日志查看

| 命令                                            | 作用                  |
| --------------------------------------------- | ------------------- |
| `docker compose logs springboot`              | 查看 springboot 的所有日志 |
| `docker compose logs -f springboot`           | 实时跟踪日志（Ctrl+C 退出）   |
| `docker compose logs -f --tail=50 springboot` | 只看最新 50 行并实时跟踪      |
| `docker compose logs mysql`                   | 查看 MySQL 日志         |

### 6.3 镜像管理

| 命令 | 作用 |
|------|------|
| `docker images` | 查看所有本地镜像 |
| `docker image prune -f` | 清理所有悬空镜像（旧版本） |
| `docker rmi 镜像名:标签` | 删除指定镜像 |
| `docker pull 镜像地址:latest` | 拉取最新镜像 |

### 6.4 容器内部操作

| 命令 | 作用 |
|------|------|
| `docker exec -it springboot sh` | 进入 springboot 容器内部 |
| `docker exec springboot env` | 查看容器的所有环境变量 |
| `docker exec -it mysql mysql -u root -p` | 进入 MySQL 命令行 |
| `docker exec mysql mysqladmin ping -u root -p密码` | 检查 MySQL 是否就绪 |

### 6.5 排查问题

| 命令                                                        | 作用              |
| --------------------------------------------------------- | --------------- |
| `docker compose logs springboot 2>&1 \| grep 'Caused by'` | 找到报错根本原因        |
| `docker compose logs springboot 2>&1 \| grep 'Started'`   | 确认是否启动成功        |
| `lsof -i:8080`                                            | 查看 8080 端口是否被占用 |
| `cat /root/.docker/config.json`                           | 查看 Docker 登录凭证  |

---

## 七、注意事项

- **初始化脚本执行时机**：`init.sql` 只在数据卷**第一次创建**时执行，重建容器需先执行 `docker compose down -v`
- **端口暴露原则**：MySQL 和 Redis 不暴露端口到外网，只有 SpringBoot 的 8080 需要对外
- **安全组配置**：阿里云安全组需手动开放 8080 端口，否则外网无法访问
- **登录凭证持久化**：服务器上的阿里云镜像仓库登录凭证永久保存在 `/root/.docker/config.json`
- **启动顺序问题**：SpringBoot 启动失败提示连不上数据库，通常是 MySQL 还未初始化完成，等待 30 秒后执行 `docker compose restart springboot`
- **Redis 安全**：Redis 在生产环境**必须**设置密码，防止被扫描攻击
- **环境变量敏感信息**：不要在代码中硬编码密码，使用环境变量或 Secrets
- **多环境配置**：可通过不同配置文件或 Profile 区分开发、测试、生产环境

---

## 八、常见问题排查

### 8.1 SpringBoot 无法连接 MySQL
```bash
# 检查 MySQL 是否正常运行
docker compose ps mysql
# 查看 MySQL 日志
docker compose logs mysql
# 进入 MySQL 容器测试连接
docker exec -it mysql mysql -u appuser -pApp123456 -h mysql yourdb
```

### 8.2 镜像构建失败
```bash
# 本地测试构建
docker build -t test-app .
# 查看构建日志详细输出
docker build --progress=plain -t test-app .
```

### 8.3 CI/CD 部署失败
- 检查 GitHub Secrets 配置是否正确
- 确认服务器 SSH 连接是否正常
- 查看 Actions 运行日志定位错误

### 8.4 容器启动后自动退出
```bash
# 查看容器退出状态和日志
docker compose ps -a
docker compose logs [服务名]
```