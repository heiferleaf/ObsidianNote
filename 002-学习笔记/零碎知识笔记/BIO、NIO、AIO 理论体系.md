---
created: 2026-03-04
modified: 2026-03-09
---


## 第一层：最基础的概念——什么是"等待"？

想象你去餐厅点餐：

```
场景A（同步阻塞）：你站在柜台前等，厨师做好才给你，你什么都不能干
场景B（同步非阻塞）：你每隔1分钟去问一次"好了吗？"，没好就回去坐着
场景C（异步）：你留下手机号，厨师做好了打电话通知你，你该干嘛干嘛
```

这三个场景，对应的就是 **BIO、NIO、AIO** 的核心思想。

---

## 第二层：CPU 和线程的真相

### 单核 CPU 的本质

```
┌─────────────────────────────────────────────────────┐
│                    单核 CPU                          │
│                                                     │
│  同一时刻，只能执行"一条"指令                          │
│                                                     │
│  那为什么我们感觉可以"同时"做很多事？                  │
│  → 因为 CPU 切换速度极快（纳秒级），制造出"并发"的假象  │
└─────────────────────────────────────────────────────┘
```

### 线程调度（时间片轮转）

```
时间轴 ────────────────────────────────────────────►

线程A  ████░░░░████░░░░████░░░░
线程B  ░░░░████░░░░████░░░░████
              ↑
         CPU 在这里切换（上下文切换）

█ = 线程正在CPU上执行
░ = 线程在等待，没有占用CPU
```

**关键理解**：线程切换是有代价的！保存/恢复寄存器、栈信息，这叫 **上下文切换开销**。

---

## 第三层：BIO —— 同步阻塞 I/O

### 什么是"阻塞"？

```
线程执行流：

main线程
   │
   ├──► 发起 read() 系统调用
   │
   │    ┌─────────────────────────────┐
   │    │  等待数据从磁盘/网络到达     │
   │    │                             │
   │    │  线程被挂起，不占CPU         │
   │    │  但是！线程还"活着"          │
   │    │  它就是在这里"傻等"          │
   │    └─────────────────────────────┘
   │
   ├──► 数据到了，线程被唤醒
   │
   └──► 继续执行后续代码
```

### BIO 处理多个客户端

```
客户端1 ──► 线程1（阻塞等待客户端1的数据）
客户端2 ──► 线程2（阻塞等待客户端2的数据）
客户端3 ──► 线程3（阻塞等待客户端3的数据）
...
客户端N ──► 线程N（阻塞等待客户端N的数据）

问题：10000个客户端 = 10000个线程
     每个线程占内存约 1MB
     10000线程 = 10GB 内存！！！
     而且大量线程在"傻等"，CPU利用率极低
```

### BIO 代码示例（Java）

```java
// BIO 服务器 - 最直观的写法
public class BIOServer {
    public static void main(String[] args) throws IOException {
        ServerSocket serverSocket = new ServerSocket(8080);
        
        while (true) {
            // accept() 会阻塞！直到有客户端连接
            Socket clientSocket = serverSocket.accept();
            
            // 每来一个客户端，就新建一个线程处理
            // 这个线程会一直阻塞等待该客户端发数据
            new Thread(() -> {
                try {
                    handleClient(clientSocket);
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }).start();
        }
    }
    
    static void handleClient(Socket socket) throws IOException {
        InputStream in = socket.getInputStream();
        byte[] buffer = new byte[1024];
        
        int len;
        // read() 会阻塞！直到客户端发来数据
        // 如果客户端一直不发，线程就一直卡在这里
        while ((len = in.read(buffer)) != -1) {
            String msg = new String(buffer, 0, len);
            System.out.println("收到: " + msg);
        }
    }
}
```

```
执行时间轴：

Thread-1: [accept阻塞]──[获得连接]──[read阻塞]──────────────[读到数据]──[处理]
Thread-2:               [accept阻塞]──[获得连接]──[read阻塞]──────[读到数据]──[处理]

CPU实际上大量时间都在"空转"，线程都在等I/O
```

---

## 第四层：NIO —— 同步非阻塞 I/O

### 核心思想：一个线程监视多个连接

```
NIO 的三大核心组件：

┌──────────┐    注册    ┌──────────────┐    轮询    ┌──────────┐
│  Channel  │ ─────────► │   Selector   │ ◄──────── │  Thread  │
│（数据通道）│           │  （选择器）   │           │ （线程）  │
└──────────┘           └──────────────┘           └──────────┘
                              │
                    监视多个Channel的状态
                    哪个"就绪"了，就处理哪个
```

### Selector 工作原理

```
一个线程 + Selector 管理 N 个连接：

           ┌─► Channel1（客户端1）── 状态：等待中
           │
Selector ──┼─► Channel2（客户端2）── 状态：有数据可读！◄── 线程去处理它
           │
           └─► Channel3（客户端3）── 状态：等待中

select() 调用：
  - 扫描所有注册的Channel
  - 返回"就绪"的Channel集合
  - 没有就绪的就等待（或超时返回）
```

### NIO 代码示例

```java
public class NIOServer {
    public static void main(String[] args) throws IOException {
        // 1. 开启Selector（多路复用器）
        Selector selector = Selector.open();
        
        // 2. 开启ServerSocketChannel
        ServerSocketChannel serverChannel = ServerSocketChannel.open();
        serverChannel.bind(new InetSocketAddress(8080));
        serverChannel.configureBlocking(false); // 关键！设为非阻塞
        
        // 3. 把serverChannel注册到selector，监听"接受连接"事件
        serverChannel.register(selector, SelectionKey.OP_ACCEPT);
        
        // 只需要一个线程！
        while (true) {
            // select() 阻塞，直到至少有一个Channel就绪
            selector.select();
            
            // 获取所有就绪的事件
            Set<SelectionKey> keys = selector.selectedKeys();
            Iterator<SelectionKey> iter = keys.iterator();
            
            while (iter.hasNext()) {
                SelectionKey key = iter.next();
                iter.remove();
                
                if (key.isAcceptable()) {
                    // 有新连接来了
                    ServerSocketChannel server = (ServerSocketChannel) key.channel();
                    SocketChannel clientChannel = server.accept();
                    clientChannel.configureBlocking(false);
                    // 把新的客户端连接也注册到selector，监听"可读"事件
                    clientChannel.register(selector, SelectionKey.OP_READ);
                    System.out.println("新客户端连接！");
                    
                } else if (key.isReadable()) {
                    // 某个客户端有数据可读了
                    SocketChannel clientChannel = (SocketChannel) key.channel();
                    ByteBuffer buffer = ByteBuffer.allocate(1024);
                    int len = clientChannel.read(buffer);
                    if (len > 0) {
                        buffer.flip();
                        System.out.println("收到: " + new String(buffer.array(), 0, len));
                    }
                }
            }
        }
    }
}
```

```
NIO执行时间轴（单线程处理10000个连接）：

主线程: [select等待]──[客户端1有数据]──[处理]──[select等待]──[客户端5有数据]──[处理]──...

              只有真正有数据时才工作，其余时间一个select()搞定所有等待
              这就是"多路复用"的精髓！
```

### BIO vs NIO 对比

```
BIO：
10000客户端 → 10000线程 → 9999个线程在傻等 → 内存爆炸，CPU浪费

NIO：
10000客户端 → 1个线程 + 1个Selector → 只处理"活跃"的连接 → 高效！

本质区别：
BIO：我守着你，你不说话我就等着
NIO：我装了个"广播监听器"，谁有消息了通知我，我再去处理
```

---

## 第五层：AIO —— 异步非阻塞 I/O

### 同步 vs 异步 的根本区别

```
同步（BIO/NIO）：
  我发起I/O操作 → 我自己等结果（或轮询结果）→ 我得到结果后继续

异步（AIO）：
  我发起I/O操作 → 我去做别的事 → 操作系统做完后主动通知我（回调）

关键差异：谁负责"等"？
  同步：调用方自己等
  异步：操作系统帮你等，等完了通知你
```

### AIO 的执行流程

```
应用程序               操作系统               硬件（磁盘/网卡）
    │                     │                        │
    ├──read(buf,callback)─►│                        │
    │                     ├──发起DMA传输───────────►│
    │                     │                        │
    │ （应用程序继续执行）   │                        │
    │ （做其他事情！）      │    （数据在传输中...）   │
    │                     │                        │
    │                     │◄──传输完成中断───────────┤
    │                     │                        │
    │◄─────callback()─────┤                        │
    │  (操作系统调用你的    │                        │
    │   回调函数，数据      │                        │
    │   已经在buf里了)      │                        │
    │                     │                        │
```

### 什么是回调函数？（重点！）

```
回调（Callback）= "等事情做完了，帮我调用这个函数"

生活类比：
  你叫外卖，留了电话号码（= 注册回调函数）
  外卖小哥送到了，打你电话（= 触发回调）
  你去开门取餐（= 执行回调函数体）

代码层面：
  回调函数 = 一个函数，作为参数传给另一个函数
  当某件事完成时，被"回头调用"
```

### 回调函数的实现逻辑（从零理解）

```javascript
// 最简单的回调示例（JavaScript）

// 步骤1：定义一个"接受回调"的函数
function doAsyncWork(data, callback) {
    console.log("开始处理数据...");
    
    // 模拟异步操作（比如读文件，网络请求）
    setTimeout(() => {
        let result = data + " 处理完毕";
        
        // 操作完成！调用你传入的回调函数
        callback(result);  // ← 这就是"回调"的发生点
        
    }, 2000); // 2秒后完成
    
    // 注意：这里函数就返回了，不等待！
    console.log("已提交任务，继续做其他事...");
}

// 步骤2：调用时传入回调函数
doAsyncWork("hello", function(result) {
    // 这个函数会在2秒后被调用
    console.log("收到结果：" + result);
});

console.log("主流程继续执行！");

// 输出顺序：
// 开始处理数据...
// 已提交任务，继续做其他事...
// 主流程继续执行！
// （2秒后）收到结果：hello 处理完毕
```

### 回调函数的本质：函数指针/引用

```
内存视角：

┌────────────────────────────────────────┐
│              内存                       │
│                                        │
│  地址0x1000: [我的回调函数的代码]        │
│                                        │
│  当我调用 doAsyncWork(data, callback)  │
│  实际上是把 0x1000 这个地址传过去了！    │
│                                        │
│  操作系统/框架拿到这个地址               │
│  在合适的时机：                          │
│  CALL 0x1000  ← 跳转到你的函数执行      │
└────────────────────────────────────────┘

C语言里叫"函数指针"
Java里叫"接口/Lambda"
JavaScript里叫"函数引用"
本质完全一样！
```

### AIO 代码示例（Java）

```java
public class AIOServer {
    public static void main(String[] args) throws Exception {
        AsynchronousServerSocketChannel server = 
            AsynchronousServerSocketChannel.open()
                .bind(new InetSocketAddress(8080));
        
        // 发起异步accept，传入回调（CompletionHandler）
        server.accept(null, new CompletionHandler<AsynchronousSocketChannel, Object>() {
            
            // 回调函数1：有新连接时，操作系统调用这里
            @Override
            public void completed(AsynchronousSocketChannel clientChannel, Object attachment) {
                // 立刻继续监听下一个连接（递归注册）
                server.accept(null, this);
                
                ByteBuffer buffer = ByteBuffer.allocate(1024);
                
                // 发起异步读，传入另一个回调
                clientChannel.read(buffer, buffer, new CompletionHandler<Integer, ByteBuffer>() {
                    
                    // 回调函数2：数据读完时，操作系统调用这里
                    @Override
                    public void completed(Integer len, ByteBuffer buf) {
                        buf.flip();
                        System.out.println("收到(AIO): " + new String(buf.array(), 0, len));
                        // 数据已经在buffer里了，直接用！
                    }
                    
                    @Override
                    public void failed(Throwable exc, ByteBuffer buf) {
                        System.out.println("读取失败: " + exc.getMessage());
                    }
                });
            }
            
            @Override
            public void failed(Throwable exc, Object attachment) {
                System.out.println("连接失败: " + exc.getMessage());
            }
        });
        
        // 主线程什么都不用做了！
        // 操作系统会在后台处理I/O，完成后调用我们的回调
        System.out.println("服务器启动，主线程去做别的事...");
        Thread.sleep(Integer.MAX_VALUE); // 保持程序运行
    }
}
```

---

## 第六层：单核CPU下的多线程真相

### 并发 ≠ 并行

```
并行（Parallel）：真正同时执行（需要多核）
  CPU核1: 线程A ████████████████
  CPU核2: 线程B ████████████████
  
并发（Concurrent）：交替执行（单核也能做）
  CPU核1: 线程A ████░░░░████░░░░
  CPU核1: 线程B ░░░░████░░░░████
```

### 单核CPU为什么还要多线程？

```
场景：下载文件同时显示进度条

单线程：
  [下载中，阻塞...]  → 界面冻结，进度条不动，用户以为程序死了

多线程（单核）：
  线程1(下载): ████░░░░████░░░░████
  线程2(UI):   ░░░░████░░░░████░░░░
  
  CPU快速切换，用户看到：界面响应，进度条更新 ✓
  
结论：多线程在单核上解决的是"响应性"问题，不是速度问题
     在多核上才能真正提升计算速度
```

### I/O密集型 vs CPU密集型

```
I/O密集型（网络请求、文件读写）：
  线程大部分时间在等I/O，不占CPU
  → 多线程有意义！线程等I/O时，CPU去跑其他线程
  → 线程数可以远超CPU核数

  例：100个线程，每个线程90%时间等网络
      CPU利用率 = 100 × 10% = 1000% ??? 
      不对，单核最多100%，所以实际有效并发线程数 ≈ 核数/（1-等待比例）
      
CPU密集型（图像处理、加密计算）：
  线程一直在算，不会主动让出CPU
  → 线程数 = CPU核数最优（超过了反而因上下文切换变慢）
```

---

## 第七层：完整对比与选型

```
┌─────────┬──────────────┬────────────────┬──────────────────┐
│         │     BIO      │      NIO       │       AIO        │
├─────────┼──────────────┼────────────────┼──────────────────┤
│同步/异步 │    同步      │     同步       │      异步        │
├─────────┼──────────────┼────────────────┼──────────────────┤
│阻塞/非阻 │    阻塞      │    非阻塞      │     非阻塞       │
├─────────┼──────────────┼────────────────┼──────────────────┤
│谁来等待  │ 调用线程等   │调用线程轮询    │ 操作系统帮我等   │
├─────────┼──────────────┼────────────────┼──────────────────┤
│编程模型  │ 简单直观     │  复杂一些      │  回调/Future     │
├─────────┼──────────────┼────────────────┼──────────────────┤
│适用场景  │连接数少，    │连接数多，高并  │超高并发，Linux   │
│         │开发简单应用  │发（Netty基于此）│ Windows支持好   │
├─────────┼──────────────┼────────────────┼──────────────────┤
│典型框架  │传统Servlet  │Netty, Nginx    │Windows IOCP      │
└─────────┴──────────────┴────────────────┴──────────────────┘
```

### 底层系统调用对应关系

```
BIO  → read()/write()          同步阻塞系统调用
NIO  → select()/poll()/epoll() 多路复用（Linux epoll最高效）
AIO  → io_uring（Linux新）     异步I/O
       IOCP（Windows）          异步I/O
```

---

## 第八层：回调地狱与解决方案

### 多层嵌套回调（Callback Hell）

```javascript
// 真实开发中回调会嵌套，变成"回调地狱"
readFile('a.txt', function(dataA) {
    sendToServer(dataA, function(response) {
        writeFile('b.txt', response, function(result) {
            updateDB(result, function(dbResult) {
                // 继续嵌套...
                // 代码向右无限延伸，难以维护！
            });
        });
    });
});
```

### 解决方案：Promise / async-await

```javascript
// Promise 链式调用（扁平化）
readFile('a.txt')
    .then(dataA => sendToServer(dataA))
    .then(response => writeFile('b.txt', response))
    .then(result => updateDB(result))
    .catch(err => console.error(err));

// async/await（看起来像同步，实际是异步）
async function process() {
    try {
        const dataA    = await readFile('a.txt');
        const response = await sendToServer(dataA);
        const result   = await writeFile('b.txt', response);
        const dbResult = await updateDB(result);
    } catch (err) {
        console.error(err);
    }
}
// await 背后仍然是回调，只是语法糖让它看起来像同步代码
```

---

## 总结：一张图看懂全部

```
                    发起I/O请求
                        │
              ┌─────────┴─────────┐
              │                   │
           同步                 异步
    （我自己处理结果）     （操作系统处理，完成通知我）
              │                   │
    ┌─────────┴──────┐         AIO
    │                │       （回调函数）
  阻塞            非阻塞
（等结果）      （轮询结果）
    │                │
   BIO              NIO
（每连接一线程）  （Selector多路复用）


单核CPU多线程：
  ├── 解决响应性（I/O等待期间切换到其他线程）
  ├── 不能真正并行计算
  └── 上下文切换有开销，线程数要合理

回调函数：
  ├── 本质 = 传递函数引用（地址）
  ├── 由框架/OS在合适时机调用
  └── 问题：嵌套过多 = 回调地狱 → 用Promise/async解决
```
