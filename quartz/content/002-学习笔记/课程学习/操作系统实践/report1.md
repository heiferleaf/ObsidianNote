---
title: report1
created: 2025-09-09 16:29
tags: [课程, 课程学习, 操作系统]
subject: 操作系统
modified: 2025-12-28 12:47
---
## 系统设计部分

### 架构设计说明

启动流程图：

```
复位 (M-mode, PC @0x80000000) 
  |
 v
  _entry (kernel/entry.S):
	- 输出 'S' (调试, UART 0x10000000)
	- la sp, stack_top (设置栈)
	- 输出 'P' (验证栈)
	- 清 BSS (从 bss_start 到 bss_end)
	- call start (跳转 C) | v start() (kernel/start.c):
	- uart_puts("Hello OS\n") (初始化 UART, 输出)
	- while(1) {} (死循环)

```

内存布局方案:
- 0x80000000: .text (代码段)
- 后接: .rodata (只读数据), .data (初始化数据), .bss (未初始化数据)
- end 后: stack (4KB, stack_top 指向顶端), 假设 @0x80100000 (内核 < 1MB)
必需硬件初始化步骤:
- 栈: la sp, stack_top (位置: end 后, 大小: 4KB)
- BSS: 清零 (从 bss_start 到 bss_end)
- UART: 写 THR (0x10000000), poll LSR THRE (0x10000005 bit 5)，其中基地址0x10000000是硬编码

### 关键数据结构

链接脚本定义内存段:
- .text (代码) @0x80000000, 包含所有 .text 段。
- .rodata (只读数据), .data (初始化数据), .bss (未初始化数据) 依次后接。
- 符号: etext (代码结束), edata (数据结束),bss_start/bss_end (BSS 范围), end (内核结束)。 
- 栈: end 后 ALIGN(16), stack_bottom 标记底, . += 0x1000 分配 4KB, stack_top 标记顶。

### 与xv6对比分析

- xv6 支持多核启动，在`entry.S`中，通过`mhartid`来为每一个CPU分配自己的栈；而我的内核是单核，只需要一个固定的栈

### 设计决策理由

- 栈位置: 放在内核 end 后 (如 0x80100000), 避免覆盖代码/数据段。
- 栈大小: 4KB, 基于 xv6 单核需求, 考虑函数调用深度 (嵌套调用和局部变量); 太小会导致溢出 (覆盖数据), 检测方法: 暂用固定大小.
- 清零 BSS: 必须, 省略会导致全局变量初始值随机 (如 int global_var 可能 != 0), 引发未定义行为。
- 最简串口输出: 只配置 THR (0x10000000) 写字符, LSR (0x10000005) poll THRE 位确保发送 ready, 无需完整初始化 (QEMU 默认支持)。
- 内存的起始地址：0x80000000，遵循 QEMU virt 约定

## 实验过程部分

### 实验步骤记录

1. 创建 kernel/entry.S: 
	- 定义入口 \_entry (global), 代码段 (.text)。
	- 调试输出 'S' 到 UART (li t0, 0x10000000; li t1, 'S'; sb t1, 0(t0)) 标记启动。
	- 设置栈指针 la sp, stack_top (stack_top 在 kernel.ld 定义)。
	- 调试输出 'P' (li t1, 'P'; sb t1, 0(t0)) 验证栈设置。
	- 清零 BSS 段: la a0, 、bss_start; la a1, bss_end; bgeu 跳过; clear_bss 循环 sd zero, (a0); addi a0, 8; bltu 继续。 
	- 跳转 C: call start。 - 死循环: j . 防止退出
2. 创建 kernel/kernel.ld:
	- ENTRY(\_entry) 设置入口, 匹配 entry.S。
	- . = 0x80000000 定义起始地址。 
	- 组织段: .text { \*(.text .text.\*) }, etext = .; .rodata { \*(.rodata .rodata.\*) }; .data { \*(.data .data.\*) }, edata = .; .bss { \*(.bss .bss.\*) }, bss_start = edata, bss_end = ., end = .。 
	- 栈定义: ALIGN(8), stack_bottom = . , . += 0x1000, stack_top = .。
3. 创建 kernel/uart.c: 
	- 定义 UART_THR (0x10000000) 和 UART_LSR (0x10000005) 寄存器。
	- 实现 uart_putc: 轮询 LSR bit 5 (THRE), 写 THR 发送字符。 
	- 实现 uart_puts: 循环调用 uart_putc 发送字符串。
4. 创建 kernel/start.c
	- 声明 extern uart_puts。
	- 实现 start()函数，调用串口的输出函数

### 问题与解决方案

- 若无 'S' 或 'P' 输出: 检查 UART 基址 0x10000000 (QEMU virt 约定), 确保 QEMU -nographic。
- 栈设置错误: 导致 call start 崩溃, 用 GDB si 单步检查 sp 值 (需 kernel.ld 定义 stack_top)。
- 链接失败: 最初报 "syntax error at line 11", 因 .rodata 段格式错误, 已修复缩进。 
- 栈地址错误: 确保 . += 0x1000 后定义 stack_top, 用 nm 验证。
- QEMU ROM 重叠：报错 "Some ROM regions are overlapping"，因为virt机器默认加载到内存地址和代码段重叠，通过 `bios none`参数，禁止默认固件的加载
- 编译/链接阶段 relocation truncated to fit：在start()代码段中，使用了Hello OS字符串常量，该常量地址超出了lui/addi指令的寻址范围，所以 riscv64-unknown-elf-ld 在处理 R_RISCV_HI20 重定位失败，使用 -mcmode=medany 的编译选项

### 源码理解与总结

通过阅读 `kernel/Entry.S` ：
- 第一条指令 `la sp, stack0` 设置指针，因为RISC-V M-mode 机器模式启动时没有默认栈，而栈用于函数调用，所以要在 `start.c` 中定义栈的符号stack0
- 清零 BSS：确保未初始化的全局变量初始为0，防止异常值干扰
- 跳转 C代码：通过 `call start` 调用`kernel/start.c` 的 `start()` 函数
通过阅读 kernel/kernel.ld：
- `ENTRY(_entry)` 设置入口点为 \_entry（entry.S）。 
- 代码段从 0x80000000 开始，因 QEMU virt 约定内核加载地址。
- 符号 etext（代码结束）、sbss/ebss（BSS 起止）、stack0（栈起点）用于清零和内存分配。 
思考： 
- 单核简化：无需 mhartid 偏移，固定一个栈。 
- 最小内存：仅需 .text、.data、.bss 和 4KB 栈，无需分页或动态分配。

## 测试验证部分

### 功能测试结果

通过在 Makefile 中设置依赖链，通过 make 指令链接得到 kernel.elf 文件。
通过 riscv64-unknown-elf-objdump -h kernel/kernel.elf 反汇编可以得到 section 信息
通过执行 make run 命令可以运行 QEMU ，把PSHello OS从串口中输出

### 运行截图

- 链接得到 elf
	![[QQ_1757501764338.png|链接得到 elf]]

- 反汇编 elf
	![[QQ_1757501597681.png|反汇编elf表]]

- 输出结果
	![[QQ_1757501812038.png|输出结果]]