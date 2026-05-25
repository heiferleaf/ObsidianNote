---
title: report2
created: 2025-09-16 16:23
tags: [课程, 课程学习, 操作系统]
subject: 操作系统
modified: 2025-12-28 12:47
---
## 系统设计部分

### 架构设计说明

![[系统架构设计.png]]
### 关键数据结构

| 名称             | 作用                 |
| -------------- | ------------------ |
| `va_list`      | 存储可变参数，用于逐个取出格式化参数 |
| `digits[]`     | 数字表，用于数字到字符的映射     |
| `char buf[20]` | 临时缓冲区，存储逆序生成的数字    |
| `pr.lock`      | 自旋锁，保证多核环境输出不交错    |
### 与xv6对比分析

| 设计要素 | xv6 实现    | 我们的设计                |
| ---- | --------- | -------------------- |
| 数字转换 | 循环取模，逆序输出 | 一致，避免递归              |
| 格式解析 | 手动状态机     | 处理方法相同，忽略对于指针地址%p等实现 |
| 清屏功能 | 不支持       | 增加 ANSI 转义序列         |
| 线程安全 | 自旋锁       | 暂时不支持，后续拓展实现         |

### 设计决策理由

- 采用非递归算法：防止栈的溢出，同时提高执行效率
- 分层设计：提高代码的可拓展性

## 实验过程部分

### 实验步骤记录

1. 设计输出架构：
	- 格式化层 -> 控制台层 -> 硬件层
	- 定义下层向上层的接口`uart.h (uart_putc), console.h (console_putc, console_puts, clear_screen), printf.h (printf, sprintf)`。
2. 实现 `printint、 printf`
	- 解析 fmt 循环, 普通字符用 console_putc, % 后匹配 %d/%x/%s/%c/%%。
	- 调用 printint 处理数字, 字符串/字符直接输出, 未知格式打印 % 和字符。
3. 实现 `console.c`
	- console_putc 处理 \n 加 \r, 调用 uart_putc; console_puts 循环输出; clear_screen 用 ANSI \033[2J\033[H 清屏。
4. 综合测试: 
	-  start.c 测试 %d/%x/%s/%c/%%, INT_MIN/NULL, 清屏, 100 次输出。

### 问题与解决方案

- 编译警告: 'implicit declaration of console_putc', 因 console.h 用 \#ifdef 错误, 改 \#ifndef 修正;

### 源码理解与总结

-  printf.c: printf 解析格式, va_start 处理参数, printint 循环 % base 逆序转换, 处理负数转正 (INT_MIN 特殊 0x80000000); printptr 打印 0x%p。 
- 从 uart.c: uartputc poll LSR THRE 写 THR, uartinit 设置波特率。
- 从 console.c: consputc 抽象 uartputc, 处理 \n 换行。 分层职责: printf 格式, console 字符处理, uart 硬件; 优势: 易扩展设备。 

思考: 
- xv6 不递归避免栈溢出;
- INT_MIN 溢出问题：通过对最小值的额外处理解决;
- 线程安全: xv6 用锁, 我的单核忽略
- xv6 的 console 支持 write 和 read 的系统调用，我的暂时没有实现

## 测试验证部分

### 功能测试结果

### 性能数据

### 异常测试

### 运行截图