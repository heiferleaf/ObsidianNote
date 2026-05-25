---
title: Java IO
created: 2026-03-21
modified: 2026-03-21
tags:
  - 技术栈
subject: JavaEE
---
## NIO的实现原理

Java NIO 的实现，涉及到以下几个组件：
1. Channel（通道）：`Channel` 是NIO中的概念，类似于流，可以非阻塞的执行IO操作。Channel有几种类型，FileChannel、DatagramChannel、SocketChannel、ServerSocketChannel
2. Buffer（缓冲区）：`Buffer`是NIO中，用来存放数据的的容器，`Channel`从 `Buffer` 中读取数据，并把数据写到 `Buffer` 中。Buffer提供了对数据的结构化访问，让读写操作方便。Buffer的关键实现由CharBuffer、ByteBuffer、ShortBuffer、IntBuffer、LongBuffer、FloatBuffer、DoubleBuffer组成。涵盖发送的基本数据类型。`Buffer`有三个重要的属性
	- Capacity（容量上限）
	- Position（当前读写位置）
	- Limit（读写的上限）
3. Selector（选择器）：允许一个线程监控多个 `Channel`，当某一个 `Channel` 中发生读或者写事件，可以通过 `Selector` 得到通知。

![[Java IO 2026-03-21 20.56.51.excalidraw]]

具体的实现步骤：
1. 打开 Channel ： 通过 xxxChannel.open() 静态方法
2. 创建Buffer：创建一个或者多个 Buffer，用来读取、写入数据
3. 写入Channel数据：把数据写入 Buffer，然后把 Buffer 中的数据写入 Channel
4. 从Channel读数据：把Channel中的数据读取到Buffer中
5. 注册 Channel 到 Selector：Selector 监控 Channel
6. 事件处理：当Channel中发生事件，Selector可以读取（通过循环中，调用select()，得到多个Channel发生的事件，通过slectedKeys()获取到key，得到发生的事件类型）

### NIO 中的零拷贝技术

