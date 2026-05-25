---
title: DAY13 线程编程理解加固
created: 2025-12-18 14:10
modified: 2025-12-18 14:11
tags: [技术栈, JavaEE]
subject: JavaEE
---
> 因为线程，关联到的对于JVM内存分布的一些学习
> OS运行JVM，JVM申请堆区，运行Java字节码
> OS栈区分配Native栈，JVM在其中分配线程栈
> 因为缓存


**Q：Java程序的内存谁管理？**  
A：JVM管理Java堆（对象），OS管理进程地址空间；JVM通过mmap向OS申请内存。

**Q：Java堆是OS堆吗？**  
A：不是。Java堆是JVM用mmap从OS申请的虚拟内存，自己管理，与malloc无关。

**Q：代码段和数据段谁管？**  
A：JVM自身的二进制由OS映射到代码/数据段；Java字节码存在Metaspace（native memory），不由OS段管理。

**Q：线程有自己堆吗？**  
A：没有。所有线程共享同一个Java堆；只有栈是线程私有的（OS分配native栈，JVM在其上建Java栈帧）。

**Q：“线程有内存副本”对吗？**  
A：错。只有栈私有；堆中对象全局唯一，共享访问。

**Q：为什么共享变量改了别人看不到？**  
A：因CPU缓存未同步 + 指令重排序；堆共享≠修改自动可见。

**Q：volatile解决什么？**  
A：插入内存屏障，强制缓存刷写（可见性）+ 禁止重排序（有序性）。

**Q：线程通信为何简单？**  
A：因共享地址空间，可直接读写同一堆对象，无需IPC。

**Q：JVM创建线程时内存变化？**  
A：OS分配native栈 + JVM在堆中建Thread对象 + 可能分配TLAB。

**Q：native层指什么？**  
A：JVM自身及JNI等C/C++代码，运行在OS上，非Java字节码。


