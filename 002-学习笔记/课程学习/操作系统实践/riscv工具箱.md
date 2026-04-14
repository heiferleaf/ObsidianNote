---
title: riscv工具箱
created: 2025-09-10 12:59
tags: [课程, 课程学习, 操作系统]
subject: 操作系统
modified: 2025-12-28 12:47
---
## 命令汇总

| 命令                            | 工具类型   | 主要作用                      | 典型用法示例                                         | 在实验中的应用           |
| ----------------------------- | ------ | ------------------------- | ---------------------------------------------- | ----------------- |
| `riscv64-unknown-elf-as`      | 汇编器    | 汇编 `.S` 文件生成 `.o`         | `as -o kernel/entry.o kernel/entry.S`          | 编译 `entry.S`      |
| `riscv64-unknown-elf-gcc`     | 编译器/驱动 | 编译 `.c` 并链接生成 `.elf`      | `gcc -T kernel.ld -nostdlib -o kernel.elf *.o` | 编译 C 文件，链接内核      |
| `riscv64-unknown-elf-ld`      | 链接器    | 按链接脚本组合 `.o` 生成 `.elf`    | `ld -T kernel.ld -o kernel.elf *.o`            | 链接所有目标文件          |
| `riscv64-unknown-elf-objdump` | 分析工具   | 反汇编和显示段/符号信息              | `objdump -h kernel.elf`                        | 检查内存布局            |
| `riscv64-unknown-elf-nm`      | 分析工具   | 列出符号表                     | `nm kernel.elf`                                | 验证 `stack_top` 地址 |
| `riscv64-unknown-elf-size`    | 分析工具   | 显示段大小                     | `size kernel.elf`                              | 检查段占用             |
| `riscv64-unknown-elf-gdb`     | 调试工具   | 调试 `.elf`，设置断点            | `gdb kernel.elf -ex "target remote :1234"`     | 调试 `entry.S`      |
| `riscv64-unknown-elf-objcopy` | 转换工具   | 转换文件格式（如 `.elf` 到 `.bin`） | `objcopy -O binary kernel.elf kernel.bin`      | 生成裸机二进制（可选）       |
| `riscv64-unknown-elf-ar`      | 库管理工具  | 创建静态库 `.a`                | `ar rcs libmy.a *.o`                           | 不常用               |
| `riscv64-unknown-elf-strip`   | 优化工具   | 移除调试信息                    | `strip kernel.elf`                             | 优化文件大小（可选）        |

## RISCV 主要寄存器

| 寄存器名     | 特权级 | 作用/功能                | 常见用法/场景             | 访问类型 |
| -------- | --- | -------------------- | ------------------- | ---- |
| mtvec    | M   | Machine模式trap入口地址    | 设置M模式trap/异常/中断跳转入口 | 读写   |
| stvec    | S   | Supervisor模式trap入口地址 | 设置S模式trap/异常/中断跳转入口 | 读写   |
| mcause   | M   | Trap原因（中断/异常类型）      | M模式trap分发时判断类型      | 读写   |
| scause   | S   | Trap原因（中断/异常类型）      | S模式trap分发时判断类型      | 读写   |
| mepc     | M   | Trap返回PC（异常时保存的PC）   | M模式trap返回前恢复原执行流    | 读写   |
| sepc     | S   | Trap返回PC（异常时保存的PC）   | S模式trap返回前恢复原执行流    | 读写   |
| mtval    | M   | Trap附加信息（如错误地址）      | 错误分析、调试             | 读写   |
| stval    | S   | Trap附加信息（如错误地址）      | 错误分析、调试             | 读写   |
| mstatus  | M   | M模式状态（特权级、中断使能等）     | 启动设置、trap期间保存/恢复    | 读写   |
| sstatus  | S   | S模式状态（特权级、中断使能等）     | trap期间保存/恢复，权限检查    | 读写   |
| medeleg  | M   | 异常委托寄存器              | 委托页错误、系统调用等异常给S模式   | 读写   |
| mideleg  | M   | 中断委托寄存器              | 委托timer、外设等中断给S模式   | 读写   |
| mie      | M   | M模式中断使能              | 启用M模式timer/外设中断     | 读写   |
| mip      | M   | M模式中断挂起              | 查询当前挂起的M模式中断类型      | 读写   |
| sie      | S   | S模式中断使能              | 启用S模式timer/外设中断     | 读写   |
| sip      | S   | S模式中断挂起              | 查询当前挂起的S模式中断类型      | 读写   |
| pmpaddr0 | M   | PMP物理地址边界0           | 配置S模式物理内存访问权限       | 读写   |
| pmpcfg0  | M   | PMP配置0               | 配置S模式物理内存访问权限       | 读写   |
| mhartid  | M   | 当前CPU核编号（hart id）    | 多核支持，获取当前CPU编号      | 只读   |
| satp     | S   | 页表基址（虚拟内存管理）         | 启用/关闭MMU，切换页表       | 读写   |

```
备注：
- “trap”泛指中断和异常（如timer、外设、系统调用、页错误等）。
- 读写权限指的是是否可以通过CSR指令读写该寄存器（如csrr、csrw）。
- M/S特权级表示只能在对应模式下访问/修改该寄存器。
- 典型用法如trap入口设置、trap分发、委托配置、权限检查、调试等。

