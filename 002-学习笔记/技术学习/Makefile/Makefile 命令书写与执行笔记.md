---
title: Makefile 命令书写与执行笔记
created: 2025-08-09 09:46
modified: 2025-08-09 09:46
tags: [技术学习, Makefile, 工具]
subject: Makefile
---
### 1. 基本规则

- 每条规则中的命令需以 **Tab** 开头（除非紧跟依赖规则后的分号后写的命令）。
    
- 命令是按顺序执行的。
    
- 空行/空格会被忽略，但若以 **Tab** 开头会被认为是空命令。
    
- 默认 Shell：`/bin/sh`（可通过 `SHELL` 变量修改）。
    

---

### 2. 注释

- `#` 表示注释，和 C/C++ 的 `//` 类似。
    

---

### 3. 显示与隐藏命令

- 默认：执行前会显示命令内容。
    
- 在命令前加 `@`：只执行，不显示命令本身。
    
    ```makefile
    @echo 正在编译...
    ```
    
- 全局控制：
    
    - `make -n` / `--just-print`：只显示，不执行。
        
    - `make -s` / `--silent` / `--quiet`：不显示任何命令。
        

---

### 4. 命令执行与多条命令

- 当依赖文件比目标文件新 → 触发执行命令。
    
- 多行命令默认是**独立的 Shell 环境**，上一行的状态不会延续到下一行。
    
- 如果要让上一条命令的效果延续到下一条，需要**写在同一行并用分号隔开**：
    
    ```makefile
    exec:
        cd /home/user; pwd  # 正确
    ```
    
    如果写成：
    
    ```makefile
    exec:
        cd /home/user
        pwd
    ```
    
    `pwd` 会打印 Makefile 所在目录，而不是 `/home/user`。
    

---

### 5. 忽略命令出错

- 默认：命令出错（返回码非 0）会终止执行。
    
- 前加 `-`（Tab 后）：忽略该命令出错。
    
    ```makefile
    clean:
        -rm -f *.o
    ```
    
- 全局忽略：
    
    - `make -i` 或 `--ignore-errors`
        
    - `.IGNORE` 目标：该规则内的所有命令都忽略错误。
        
- `make -k` / `--keep-going`：当前规则出错停止，但继续执行其他规则。
    

---

### 6. 嵌套执行 Make

- 用于模块化管理大型项目。
    
- 在总控 Makefile 中调用子目录 Makefile：
    
    ```makefile
    subsystem:
        $(MAKE) -C subdir
    ```
    
    等价于：
    
    ```makefile
    subsystem:
        cd subdir && $(MAKE)
    ```
    
- 变量传递：
    
    - `export var=value`：传递变量给子 Makefile。
        
    - `unexport var`：阻止变量传递。
        
    - `export`（无参数）：传递所有变量。
        
    - `SHELL` 和 `MAKEFLAGS` 始终自动传递。
        

---

### 7. 显示当前目录

- `make -w` / `--print-directory`：进入和离开子目录时会显示当前目录。
    
- `-C` 自动开启 `-w`，但 `-s` 会关闭它。
    

---

### 8. 定义命令包（命令序列）

- 用 `define ... endef` 定义可复用的命令序列。
    
    ```makefile
    define run-yacc
        yacc $(firstword $^)
        mv y.tab.c $@
    endef
    ```
    
- 使用时像变量一样：
    
    ```makefile
    foo.c: foo.y
        $(run-yacc)
    ```
    
- `$^` → 所有依赖文件  
    `$@` → 目标文件
    

---

### 9. 常用命令行参数速查

|参数|作用|
|---|---|
|`-n` / `--just-print`|只显示命令，不执行|
|`-s` / `--silent`|全部不显示命令|
|`-i` / `--ignore-errors`|全局忽略错误|
|`-k` / `--keep-going`|出错后继续执行其他规则|
|`-w` / `--print-directory`|显示目录切换|
|`-C <dir>`|切换到指定目录执行|
