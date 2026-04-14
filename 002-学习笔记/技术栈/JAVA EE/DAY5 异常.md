---
title: DAY5 异常
created: 2025-12-04
modified: 2026-01-09
tags: [技术栈, JavaEE]
subject: JavaEE
---
1. 异常体系的根类是 `Throwable`
	1. 下面分为`Error`和`Exception`
	2. `Exception`分为运行时异常和其他异常

2. `Error`和`RunTimeException`及其子类是不需要被捕获的异常

3. 对于需要捕获的异常，需要使用try...catch语句
	1. 如果不使用catch，就需要在方法处throws可能发生的异常
	2. 对于throws出的异常，需要在方法的调用处catch或者继续throws，直到main进行处理，或者throws给JVM处理
	3. 可以通过异常的printStackTrace方法打印异常栈，查看异常出错点

4. 捕获多个异常
	1. 对应多个catch语句
	2. 如果异常之间是继承关系，需要子类异常在前
	3. 如果不是继承关系，并且处理方式相同，可以用 | 分割

5. 在异常栈的处理过程之中，如果中间结点进行catch，并且抛出更加具体的子类异常，为了不丢失原始的异常信息，最好用原有的异常去构造新的异常

6. 在final语句块中，如果抛出异常，就会屏蔽catch中抛出的异常(如果抛出的话)
	1. 解决方法，在方法内设置一个`Exception origin`,在catch内赋值，在final中构造需要排除的异常e，通过`e.addSuppressed()`方法，添加屏蔽异常。

7. assert的使用需要在运行命令配置
	`-ea`
	如果是对指定包启动断言`-ea:com.example...` 结尾有3个...
	可以在断言后添加 ：“打印消息”，在断言不成立的时候添加打印信息


