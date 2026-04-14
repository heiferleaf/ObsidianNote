---
created: 2026-03-16
modified: 2026-03-17
---
# Ubuntu 系统常用命令

`systemctl start / status / stop / restart`


# Docker命令

## 镜像相关

```powershell
docker images                          # 查看所有镜像
docker pull nginx:latest               # 拉取镜像
docker rmi nginx:latest                # 删除镜像
docker rmi $(docker images -q)         # 删除所有镜像
docker image prune                     # 删除所有未使用的镜像
docker build -t myapp:1.0 .            # 从 Dockerfile 构建镜像
docker tag myapp:1.0 myapp:latest      # 给镜像打标签
```

---

## 容器相关

```powershell
docker ps                              # 查看运行中的容器
docker ps -a                           # 查看所有容器（含停止的）
docker start <容器名>                   # 启动容器
docker stop <容器名>                    # 停止容器
docker restart <容器名>                 # 重启容器
docker rm <容器名>                      # 删除容器（需先停止）
docker rm -f <容器名>                   # 强制删除（无需先停止）
docker rm $(docker ps -aq)             # 删除所有容器

docker logs <容器名>                    # 查看日志
docker logs -f <容器名>                 # 实时跟踪日志
docker logs --tail 100 <容器名>         # 只看最后100行

docker exec -it <容器名> bash          # 进入容器终端
docker exec -it <容器名> sh            # 容器没有bash时用sh
docker inspect <容器名>                 # 查看容器详细信息
docker stats                           # 查看所有容器资源占用
docker cp <容器名>:/path ./local        # 从容器复制文件到本机
```

---

## Compose 相关

```powershell
docker compose up -d                   # 后台启动所有服务
docker compose up -d mysql nacos       # 只启动指定服务
docker compose up mysql                # 前台启动（看实时日志）
docker compose down                    # 停止并删除所有容器
docker compose down -v                 # 同上，同时删除 volumes
docker compose start <服务名>          # 启动已存在的服务
docker compose stop <服务名>           # 停止服务
docker compose restart <服务名>        # 重启服务
docker compose rm <服务名>             # 删除服务容器

docker compose ps                      # 查看服务状态
docker compose logs -f                 # 实时查看所有服务日志
docker compose logs -f mysql           # 只看某个服务的日志
docker compose build                   # 重新构建所有镜像
docker compose build mysql             # 重新构建指定服务镜像
docker compose pull                    # 拉取所有服务最新镜像
docker compose exec mysql bash         # 进入某个服务的容器
```

---

## 清理命令

```powershell
docker system prune                    # 清理所有未使用的资源
docker system prune -a                 # 连未使用的镜像也清理
docker volume prune                    # 清理未使用的 volumes
docker network prune                   # 清理未使用的网络
```


## 网络命令

| **命令**             | **用途**     | **注意事项**                             |
| ------------------ | ---------- | ------------------------------------ |
| `ip addr`          | 查看容器自己的 IP | 容器通常在 `172.17.x.x` 网段。               |
| `ping <IP/域名>`     | 测试网络连通性    | 很多精简版镜像（如 Alpine）默认没装 ping，可能报错。     |
| `curl -I <URL>`    | 测试 Web 服务  | 常用于检查容器是否能通过物理机代理访问外网。               |
| `netstat -tlnp`    | 查看容器开启的端口  | 确认容器内的服务（如 MySQL 的 3306）是否真的启动了。     |
| `nslookup` / `dig` | 测试 DNS 解析  | 在自定义网络中，测试 `ping mysql_db` 能否解析出 IP。 |

## 容器网络配置

1. 容器使用的网络连接方式
	1. bridge模式（类似于虚拟机的NAT）
		- 同一个 network 的容器，都具备相同的网段，容器之间的通信，比如后端服务调用数据库，不能通过localhost，需要通过服务名
		- Docker 创建一个虚拟网卡 docker0，作为网桥使用
		- 每一个容器创建一对 veth 虚拟网卡，一段在容器内部，一端在 docker0 网桥中，实现容器之间的通信，以及虚拟机到容器的服务访问
		- 如果外部想要访问容器，需要在容器运行的时候，==配置端口转发==，这就类似于虚拟机的NAT
	2. host模式
		- host模式下，容器就类似于虚拟机上运行的进程，==端口不能重复==，容器之间的访问，==可以通过localhost==
		- 容器的IP就是虚拟机的IP
	3. none模式
		- 容器内部完全没有配置网络，无法和别的容器通信，无法和外网通信
		- 可以给一些安全敏感的任务配置none
2. 容器暴露端口给虚拟机，虚拟机进一步暴露端口给主机
	1. 如果容器是bridge模式，通过端口映射，就像虚拟机有了一个新的进程
	2. 如果容器是host模式，那么本来就和虚拟机里有新进程等效
	> 虚拟机内部的进程 - 容器服务

	3. 如果虚拟机是桥接模式，那么在局域网中，就可以直接通过虚拟机的IP + 端口访问容器服务
	4. 如果虚拟机时NAT模式，那么在局域网中，通过主机名 + 主机NAT设备映射端口，访问到容器服务
	> 容器也不一定需要在虚拟机中，也就是说，1、2中的虚拟机，完全可以换成物理机
	

