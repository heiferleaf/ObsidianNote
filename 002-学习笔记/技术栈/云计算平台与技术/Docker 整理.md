---
created: 2026-03-23
modified: 2026-03-25
---
## 目录 && QA

1. Docker 常用的命令
2. Docker 的网络配置
3. Docker 镜像的含义
4. Docker 数据卷、绑定挂载、tmpfs
5. Docker 如何打包镜像，在不同虚拟机之间传输镜像

q1：registry 镜像的作用和含义
	准确说，这个不是镜像，是一个镜像仓库，本地可以运行一个私有的仓库，仓库运行的时候，建议做绑定挂载或者数据卷
q2：容器网络配置为 host 的时候，如何决定容器在宿主机上的端口
	这时候，容器就和普通的进程一样，登记一个端口
q3：容器的状态

| 状态         | 说明                    |
| ---------- | --------------------- |
| created    | 创建了但是还没有启动            |
| running    | 正在运行                  |
| paused     | 暂停，资源还在内存中，通常因为资源不足暂停 |
| exited     | 已退出                   |
| restarting | 重启中                   |


docker
- pull \[仓库\命名空间]镜像\[:标签TAG（默认latest）]
	- --platform=xxx : 指定平台架构
- push
- run | create
	- --name
	- --network \[网络名(bridge)] \[host] \[none]
	- -p 主机端口:容器内部进程端口
	- -d
	- -v 数据卷名:容器内文件路径（数据卷为空，自动创建然后用文件路径中的文件初始化，用来存放数据） 宿主机路径:容器内文件路径 （用来传配置文件）
	- -e 环境变量
	- --restart=always
	- --unless-stopped
- rmi 镜像名/id
- images
- ps
	- -a
- start 容器名/id
- stop
- restart
- rm
	- -f
- inspect 容器名/id
- network
	- create 网络名 （bridge）
	- ls
	- rm 网络名
	- inspect 网络名
	- prune
- volume
	- ls
	- create 卷名
	- inspect 卷名
	- prune
- exec
	- -it : 交互式方式进行容器

## 容器 Docker

### 容器

Docker 是一种软件部署方案，轻量级。通过把软件运行的系统环境打包，实现快速部署。 Docker 借助宿主机的操作系统内核，完成，操作文件系统，而传统的虚拟机是有自己的操作系统内核，所以 Docker 更加轻量。也正因此，**容器在打包环境和运行环境内核不一样的情况下，无法正常运行**，在使用 Docker Desktop 的时候，会启动一个linux虚拟机，用来运行linux环境下打包的镜像

### 镜像

- 容器是基于镜像运行的，镜像包含了容器运行需要的环境、代码、依赖配置。
- 镜像是只读的，无法对镜像的内容进行修改
- 镜像的构建过程是分层的，每一层都是具体的文件和文件夹，最后构建出来的完成的运行环境
- Overlay2 是一个流行的文件存储驱动引擎，负责管理如何镜像的所有只读层（lowerdir），最后提供一个容器可写层（upperdir），组装成workdir（最后的工作目录），然后把workdir挂载到容器中，得到merged
	- workdir支持COW，所以对容器中的底层文件的修改操作，效率可能低的原因，就是因为先检索层次，然后拷贝，然后修改

### 仓库

存放镜像的库。想要从仓库中定位一个镜像 ： `[repository_address][/namespace]image_name:[tag]`
- repository_address：仓库名，docker.io是官方仓库，可以省略
- namespace：命名空间，通常是作者名，library是默认的命名空间，可以省略
- image_name：镜像名
- tag：标签，版本号，省略表示最新

## 容器的网络配置

容器通过CGroups来限制使用的宿主机资源（网络带宽、CPU、内存），通过 namespace 来隔离容器内的进程，让容器只能看到自己运行的进程。

在bridge模式下，容器有一个虚拟网卡，使得通过容器名可以访问同一个网络下的其他容器。进入容器后，可以 通过 ip addr show 发现容器自己有内部网络地址。

容器的进程对宿主机是封闭的，可以通过 -p 来暴露端口

 *  **自定义子网**:

    *  **创建**: `docker network create <子网名称>`。

    *  **加入**: `docker run --network <子网名称> ...`。

    *  **优势**:

      *  同一子网内的容器可以使用**容器名称**互相访问（Docker内部DNS机制）。

      *  不同子网之间默认隔离。

*  Host (主机模式)

  *  **功能**: Docker容器直接共享宿主机的网络命名空间。

  *  **IP地址**: 容器直接使用宿主机的IP地址。

  *  **端口**: 无需端口映射（`-p`），容器内的服务直接运行在宿主机的端口上，通过宿主机的IP和端口即可访问。

  *  **用途**: 解决一些复杂的网络问题。

  *  **语法**: `docker run --network host ...`。

*  None (无网络模式)

  *  **功能**: 容器不连接任何网络，完全隔离。

  *  **语法**: `docker run --network none ...`。

## Dockerfile

*  **定义**: Dockerfile是一个文本文件，详细列出了如何制作Docker镜像的步骤和指令，可类比为制作模具的图纸。

*  **基本结构与指令**:

  *  `FROM <基础镜像>`: 所有Dockerfile的第一行，选择一个基础镜像，表示新镜像在此基础上构建。

  *  `WORKDIR <目录路径>`: 设置镜像内的工作目录，后续命令在此目录下执行。

  *  `COPY <源路径> <目标路径>`: 将宿主机的文件或目录拷贝到镜像内的指定路径。

  *  `RUN <命令>`: 在镜像构建过程中执行的命令（例如安装依赖）。

  *  `EXPOSE <端口号>`: 声明镜像提供服务的端口（仅为声明，非强制，实际端口映射仍由`-p`参数决定）。

  *  `CMD <命令>`: 容器运行时默认执行的启动命令。一个Dockerfile只能有一个`CMD`指令。

  *  `ENTRYPOINT <命令>`: 与`CMD`类似，但优先级更高，不易被`docker run`命令覆盖。

## 跨虚拟机传递镜像

```
客户端
docker tag alpine myregistry.local:5000/alpine 给镜像打标签
docker push myregistry.local:5000/alpine

服务器
docker pull myregistry.local:5000/alpine
```

docker save 镜像 | gzip > xxx.tar.gz 镜像压缩包

通过和主机的共享文件夹传输，或者通过scp传输

docker load < 压缩包名