---
title: report3
created: 2025-09-23 14:30
tags: [课程, 课程学习, 操作系统]
subject: 操作系统
modified: 2025-12-28 12:47
---
> [[|思考题]]
## 系统设计部分

### 架构设计说明

- 本实验采用 RISC-V Sv39 三级页表机制，把虚拟地址拆分为三段的 VPN，各级页表通过递归的映射，实现高效的虚拟-物理地址转换。
- 对于物理内存的分配，采用链表管理空闲物理页。
- 将部分代码文件的函数体定义都该放到 defs.h 中

### 关键数据结构

- 虚拟地址结构（39位）：
	```
	  | 38-30 | 29-21 | 20-12 | 11-0  |
	  |-------|-------|-------|-------|
	  | VPN[2]| VPN[1]| VPN[0]| offset|
	  
	  #define MAXVA (1L << (9 + 9 + 9 + 12 - 1)) // 256GB
	  在xv6的源码中，额外定义最大的虚拟地址空间只有38位，这是为了保证39位为0，符号拓展后高位都是0，从而让虚拟地址都是正数
	```
- 页表项（PTE）字段
	- V：有效位
	- R/W/X：读/写/执行权限
	- U：用户位
	- PPN：物理页号
- 地址对齐宏
  ```c
  #define PGROUNDUP(sz)   (((sz)+PGSIZE-1) & ~(PGSIZE-1))
  #define PGROUNDDOWN(a)  (((a)) & ~(PGSIZE-1))
  ```
- VPN索引提取宏
  ```c
  #define PXSHIFT(level)  (12 + 9 * (level))
  #define PX(level, va)   (((va) >> PXSHIFT(level)) & 0x1FF)
  ```
- PTE操作宏
  ```c
  #define PTE2PA(pte)     (((pte) >> 10) << 12)
  #define PA2PTE(pa)      ((((uint64)(pa)) >> 12) << 10)
  ```

### 与xv6对比分析

- xv6同样采用三级页表实现，数据结构和 RISC-V 标准兼容。
- 使用的数据结构和接口也和riscv一样。
- kmem 拓展了 freepages 字段用于内存统计

### 设计决策理由

- 三级页表平衡页表对内容空间的占用和查询效率
- 链表法极易实现，空间零额外开销（仅复用页头），效率极高
- freepages便于后续统计和异常检测

## 实验过程部分

### 实验步骤记录

- 设计types.h、riscv.h、memlayout.h、spinlock.h四个基础头文件，全部接口风格向xv6看齐。
- 实现kalloc.c，完成freerange/kfree/kalloc/kinit等核心接口。
- 实现 vm.c 的基本功能，包括为虚拟地址分配物理页，对应更新页表，把虚拟地址映射到物理地址等
- 实现 map_region, unmap_page, walkaddr 等辅助函数，支持多页映射和查询。
- 实现对于内核映像的页表初始化
- 修改 kernel.ld 链接脚本的对齐方案，使得各字段按照页大小对齐，方便在内核映像初始化分页
- 编写测试代码

### 问题与解决方案

- 物理内存边界由PHYSTOP控制，实验用128MB，便于QEMU测试。
- free_page/kfree加入地址合法性检查，避免链表损坏和越界。

### 源码理解与总结

1. 为什么选择三级页表
	- 空间：页表项太多，页表占用内存过大
	- 效率：页表级数越多，查找效率越低
2. 中间表页表项 R/W/X 如何设置
	- 中间项页表项的这几位必须全0，只有V位1，表示当前是中间项页表
	- 叶子页表的这几项不全为0，表示当前页会映射到物理页
3. 关于xv6的物理内存分配器
	xv6 的物理内存分配器通过极简的单链表管理所有的空闲物理页，每个页存放下一个页的指针，对于页的分配 kalloc 操作和释放 kfree 操作都是 $O(1)$ 的时间复杂度。
	对于多个进程释放同一个页面，回导致有的页面被错误释放。
4. 如何确定分配的内存范围
	从 \_end（由连接脚本定义的，在内核映像之后），到PHYSTOP
	最大的物理地址
5. 如何检测内存泄漏
	分配/释放时计数，或遍历链表统计剩余页数
6. walk() 遍历递归以及 alloc 参数
	walk() 从根页表递归或循环查找每一级的PTE。若遇到无效PTE（PTE_V未置位）：
	- alloc=0：直接返回0，仅查找不分配。
	- alloc=1：分配新页表页并挂入，继续递归。
	最终返回叶子页表项指针，便于后续建立或查询映射。
7. 对于riscv对于页表大小的选择
	riscv中的页表和页面大小相同，这是为了重复利用分配页面的函数，来实现页表的内存分配。
	4906字节的页表大小，页表项为uint64类型-8位，所以页表中有512项pte
8. 对于 vm 中初始化部分
	-  **加载内核映像到内存起始。**
	- **kinit 把 _end ~ PHYSTOP 这段物理内存做成空闲链表。**
	- **kvminit/页表初始化时，需要分配页表用的物理页，就用 kalloc()，这些物理页从刚才的空闲链表中取出。**
	- **分配后的物理页用途可以是：页表、内核栈、其他内核结构、用户空间页面等。**
9. 对于 vm 内核部分分页，虚拟地址和物理地址相同的说明
	- “分页初始化之后，为了兼容原有代码/指针/数据，必须保证关键内存段VA=PA恒等映射，保证内核能继续正确运行。”
10.  **只有在执行了 `kvminithart()`（写SATP寄存器，sfence.vma）后，才真正启用分页**
	之后，CPU 会自动把所有的物理内存访问变成“虚拟地址-物理地址的转换”

## 测试验证部分

### 功能测试结果

```cpp
#include "defs.h"

#include "printf.h"

void test_physical_memory(void) {

    kinit();

    // 分配两个页

    void *page1 = kalloc();

    void *page2 = kalloc();

    printf("Allocated pages at %p and %p\n", page1, page2);

  

    if(page1 == page2) {

        printf("Allocated the same page twice!\n");

        return;

    }

  

    // 读入数据并读回

    *(int*) page1 = 0x12345678;

    if(*(int*) page1 != 0x12345678) {

        printf("Memory read/write test failed!\n");

        return;

    }

  

    // 释放、重分配

    kfree(page1);

    void *page3 = kalloc();

    printf("Re-allocated page at %p\n", page3);

    if(page3 != page1) {

        printf("Memory re-allocation test failed!\n");

        return;

    }

  

    kfree(page2);

    kfree(page3);

  

    printf("Physical memory allocation test passed.\n");

}

  

void test_pagetable(void) {

    printf("\n");

    // 1. 初始化一个页表

    pagetable_t pgtal = create_pagetable();

  

    // 2. 测试把一个虚拟地址映射到一个物理地址

    uint64 va = 0x1000000;  // 这里要注意Sv39的地址范围

    uint64 pa = (uint64)kalloc();   // 分配一个物理页

    printf("kalloc physical address:%p \n", pa);  // 打印一下 pa 的地址

    if(pa == 0) {

        printf("Failed to allocate physical page for testing\n");

        return;

    }

    if(map_page(pgtal, va, pa, PTE_R | PTE_W | PTE_U) != 0) {

        printf("map_page failed\n");

        kfree((void*)pa);

        return;

    }

    printf("Mapped VA 0x%x to PA 0x%x\n", (uint32)va, (uint32)pa);

  

    // 3. 测试walk_lookup能否找到正确的PTE

    pte_t* pte = walk_lookup(pgtal, va);

    if(pte == 0 || (PTE2PA(*pte)) != pa) {

        printf("walk_lookup failed to find correct PTE\n");

        unmap_page(pgtal, va);

        kfree((void*)pa);

        return;

    }

    printf("walk_lookup found correct PTE: 0x%x\n", (uint32)(*pte));

  

    // 4. 测试 pte 的权限位

    if((*pte & (PTE_R | PTE_W | PTE_U)) != (PTE_R | PTE_W | PTE_U)) {

        printf("PTE permissions incorrect\n");

        unmap_page(pgtal, va);

        kfree((void*)pa);

        return;

    }

    printf("PTE permissions correct\n");

  

    printf("\n");

}

  

void test_virtual_memory(void) {

    printf("Before enabling paging...\n");

    kvminit();

    kvminithart();

    printf("After enabling paging...\n");

  

    // 检查内核代码、数据可访问

    printf("kernel pagetable: %p\n", (uint64)kernel_pagetable);

  

    // 检查 UART 是否可用

    uart_putc('T');

    printf("UART test done\n");

}
```

### 性能数据

### 异常测试

### 运行截图

![[测试结果正常.png]]