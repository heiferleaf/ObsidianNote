---
title: VSCode 远程连接
created: 2025-09-10 12:24
tags: [课程, 课程学习, 操作系统]
subject: 操作系统
modified: 2025-12-28 12:47
---
# 🔧 VSCode Remote-SSH 连接虚拟机完整教程（NAT + 端口转发）

## 📋 准备工作

- 宿主机：Windows/macOS/Linux，已安装 VSCode
- 虚拟机：VirtualBox + Ubuntu（或其他 Linux 发行版）
- 虚拟机网络配置：NAT 模式

---

## 步骤 1：配置虚拟机网络（NAT + 端口转发）

### 1.1 设置 NAT 网络

1. 关闭虚拟机
2. 在 VirtualBox 中选择你的虚拟机
3. 点击 **设置** → **网络**
4. 适配器 1：
    - ✅ **启用网络连接**
    - **连接方式**：选择 **NAT**

### 1.2 配置端口转发

1. 点击 **高级** → **端口转发**
2. 点击 **+** 添加新规则：
    
    ```
    名称: SSH协议: TCP主机 IP: 127.0.0.1主机端口: 2222子系统 IP: (留空)子系统端口: 22
    ```
    
3. 点击 **确定** 保存

### 1.3 启动虚拟机

配置完成后启动虚拟机。

---

## 步骤 2：在虚拟机中安装和配置 SSH

### 2.1 安装 SSH 服务

在虚拟机终端中执行：

```bash
# 更新包管理器
sudo apt update

# 安装 SSH 服务
sudo apt install openssh-server -y

# 启用 SSH 服务（开机自启）
sudo systemctl enable ssh

# 启动 SSH 服务
sudo systemctl start ssh
```

### 2.2 检查 SSH 服务状态

```bash
# 检查服务状态
sudo systemctl status ssh

# 查看 SSH 监听端口
sudo netstat -tlnp | grep :22
```

如果看到 `active (running)` 和端口 22 在监听，说明 SSH 服务正常。

### 2.3 配置 SSH（可选，提高安全性）

编辑 SSH 配置文件：

```bash
sudo nano /etc/ssh/sshd_config
```

推荐修改的配置：

```bash
# 允许 root 登录（可选，不推荐）
PermitRootLogin no

# 允许密码认证
PasswordAuthentication yes

# 允许公钥认证
PubkeyAuthentication yes
```

修改后重启 SSH 服务：

```bash
sudo systemctl restart ssh
```

---

## 步骤 3：测试宿主机到虚拟机的连接

### 3.1 获取虚拟机用户信息

在虚拟机中查看当前用户名：

```bash
whoami
# 输出例如：ubuntu 或 your-username
```

### 3.2 在宿主机测试 SSH 连接

在宿主机终端中测试：

```bash
# 使用端口转发连接虚拟机
ssh -p 2222 ubuntu@127.0.0.1
```

- 替换 `ubuntu` 为你的虚拟机用户名
- 首次连接会提示确认主机密钥，输入 `yes`
- 输入虚拟机用户密码

如果能成功登录到虚拟机，说明 SSH 连接配置正确。

---

## 步骤 4：配置 SSH 密钥（免密登录）

### 4.1 在宿主机生成 SSH 密钥

```bash
# 生成 SSH 密钥对（如果已有可跳过）
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# 一路回车使用默认设置
```

### 4.2 复制公钥到虚拟机

```bash
# 方式 1：使用 ssh-copy-id（推荐）
ssh-copy-id -p 2222 ubuntu@127.0.0.1

# 方式 2：手动复制
cat ~/.ssh/id_rsa.pub
# 复制输出的内容，然后在虚拟机中执行：
# echo "粘贴的公钥内容" >> ~/.ssh/authorized_keys
```

### 4.3 测试免密登录

```bash
ssh -p 2222 ubuntu@127.0.0.1
```

如果不需要输入密码就能登录，说明密钥配置成功。

---

## 步骤 5：安装和配置 VSCode Remote-SSH

### 5.1 安装 Remote-SSH 插件

1. 打开 VSCode
2. 点击左侧 **扩展** 图标（或按 `Ctrl+Shift+X`）
3. 搜索 **Remote - SSH**
4. 安装 Microsoft 官方的 Remote - SSH 插件

### 5.2 配置 SSH 主机

1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入 `Remote-SSH: Open Configuration File`
3. 选择配置文件（通常是用户目录下的 `.ssh/config`）

### 5.3 添加虚拟机配置

在配置文件中添加：

```
Host ubuntu-vm
    HostName 127.0.0.1
    User ubuntu
    Port 2222
    IdentityFile ~/.ssh/id_rsa
```

配置说明：

- `Host ubuntu-vm`：自定义的连接名称
- `HostName 127.0.0.1`：本地回环地址
- `User ubuntu`：替换为你的虚拟机用户名
- `Port 2222`：端口转发配置的端口
- `IdentityFile`：私钥路径（可选，有默认值）

---

## 步骤 6：连接到虚拟机

### 6.1 建立 Remote-SSH 连接

1. 点击 VSCode 左下角的绿色图标 **><**
2. 选择 **Remote-SSH: Connect to Host...**
3. 选择 `ubuntu-vm`（你配置的主机名）
4. 选择操作系统类型（通常是 Linux）
5. 等待 VSCode 在虚拟机中安装 VSCode Server

### 6.2 验证连接

连接成功后：

- VSCode 左下角显示 **SSH: ubuntu-vm**
- 文件资源管理器显示虚拟机的文件系统
- 终端是虚拟机的终端环境

---

## 步骤 7：在虚拟机中设置开发环境

### 7.1 安装基础开发工具

在 VSCode 的虚拟机终端中：

```bash
# 安装编译工具
sudo apt install build-essential -y

# 安装 Git
sudo apt install git -y

# 安装 curl 和 wget
sudo apt install curl wget -y
```

### 7.2 安装编程语言环境

根据需要安装：

```bash
# Python 开发环境
sudo apt install python3 python3-pip python3-venv -y

# Node.js 开发环境
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install nodejs -y

# Go 开发环境
sudo apt install golang-go -y

# Java 开发环境
sudo apt install openjdk-11-jdk -y
```

### 7.3 安装 VSCode 扩展

在远程连接的 VSCode 中安装需要的扩展：

- Python（用于 Python 开发）
- GitLens（Git 增强）
- Docker（如果需要）
- 等其他扩展...

---

## 🔧 故障排除

### 问题 1：无法连接到虚拟机

**解决方案：**

1. 确认虚拟机正在运行
2. 检查端口转发配置是否正确
3. 在宿主机测试：`telnet 127.0.0.1 2222`
4. 检查虚拟机防火墙：`sudo ufw status`

### 问题 2：SSH 连接被拒绝

**解决方案：**

1. 检查 SSH 服务状态：`sudo systemctl status ssh`
2. 重启 SSH 服务：`sudo systemctl restart ssh`
3. 检查 SSH 配置：`sudo nano /etc/ssh/sshd_config`

### 问题 3：VSCode Server 安装失败

**解决方案：**

1. 确保虚拟机有网络连接：`ping google.com`
2. 清除 VSCode Server 缓存：删除 `~/.vscode-server` 目录
3. 重新连接

### 问题 4：性能较慢

**解决方案：**

1. 增加虚拟机内存和CPU核心
2. 在虚拟机中安装 `build-essential`
3. 使用 SSD 存储虚拟机文件

---

## ✨ 使用技巧

### 1. 文件同步

- VSCode 中的文件操作都在虚拟机环境
- 可以使用 `scp` 命令在宿主机和虚拟机间传输文件

### 2. 端口转发

如果虚拟机中运行的服务需要宿主机访问，可以添加更多端口转发：

```
名称: Web
协议: TCP  
主机端口: 3000
子系统端口: 3000
```

### 3. 多个终端

可以在 VSCode 中打开多个终端，都是虚拟机环境。

### 4. 调试

所有的调试和运行都在虚拟机环境中进行。

---

## 🎉 完成！

现在你已经成功配置了 VSCode Remote-SSH 连接到 NAT 模式的虚拟机。你可以：

- 在宿主机的 VSCode 中编辑虚拟机的代码
- 在虚拟机环境中运行和调试程序
- 享受接近本地开发的体验

需要帮助或有其他问题，随时问我！