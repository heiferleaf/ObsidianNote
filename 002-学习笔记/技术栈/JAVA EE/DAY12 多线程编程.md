---
title: DAY12 多线程编程
created: 2025-12-17
modified: 2026-01-19
tags: [技术栈, JavaEE]
subject: JavaEE
---
**"理解多线程，是掌握现代高性能Java应用的必经之路。"**

### **Java多线程与并发编程详解**

#### **一、多线程基础概念**

**1. 并发与并行的区别**
*   **并发**：多个任务在同一时间段内**交替**执行（单核CPU场景）
*   **并行**：多个任务在同一时刻**同时**执行（多核CPU场景）
*   **目的**：提高系统吞吐量和资源利用率

**2. 多任务实现方式**
*   **多进程**：每个进程独立内存空间，稳定性高但开销大
*   **多线程**：同一进程内的线程共享内存，开销小但需处理同步问题
*   **混合模式**：现代应用的常见选择

**3. Java程序的线程模型**
*   Java程序运行即启动一个**JVM进程**
*   **主线程**：执行`main()`方法的线程
*   可在main中创建并启动多个子线程

#### **二、线程的创建与启动**

**1. 创建线程的两种方式**
```java
// 方式1：继承Thread类（不推荐，Java单继承限制）
class MyThread extends Thread {
    @Override
    public void run() {
        System.out.println("线程执行中...");
    }
}
MyThread t1 = new MyThread();

// 方式2：实现Runnable接口（推荐，更灵活）
class MyTask implements Runnable {
    @Override
    public void run() {
        System.out.println("任务执行中...");
    }
}
Thread t2 = new Thread(new MyTask());

// 匿名内部类写法
Thread t3 = new Thread(new Runnable() {
    @Override
    public void run() {
        // 任务代码
    }
});

// Lambda表达式（Java 8+，最简洁）
Thread t4 = new Thread(() -> {
    System.out.println("Lambda线程");
});
```

**2. 启动线程的关键点**
*   **必须调用`start()`**，而非`run()`
*   `start()`内部调用native方法`start0()`，由JVM创建新线程
*   直接调用`run()`只是在当前线程执行方法，不会创建新线程

**3. 线程优先级**
*   `setPriority(1-10)`设置优先级，**仅作参考**，操作系统不一定严格遵循
*   默认优先级为5，最低1，最高10
*   过度依赖优先级可能导致线程饥饿问题

#### **三、线程状态与生命周期**

**1. 六种线程状态**
```java
// 可通过Thread.getState()获取
public enum State {
    NEW,           // 新建，未start()
    RUNNABLE,      // 运行或就绪（JVM层面）
    BLOCKED,       // 等待监视器锁（synchronized）
    WAITING,       // 无限期等待（wait()、join()）
    TIMED_WAITING, // 限时等待（sleep()、wait(timeout)、join(timeout)）
    TERMINATED     // 终止
}
```

**2. 线程终止的三种情况**
1.  `run()`方法正常返回
2.  线程抛出**未捕获的异常**
3.  调用已弃用的`stop()`方法（**强烈不推荐**，可能导致资源未释放）

**3. 线程等待：join()**
```java
Thread t = new Thread(() -> {
    try {
        Thread.sleep(1000);
    } catch (InterruptedException e) {
        e.printStackTrace();
    }
});

t.start();
t.join();  // 当前线程等待t执行完毕
System.out.println("t线程已结束");
```

#### **四、线程中断机制**

**1. 优雅中断模式**
```java
Thread worker = new Thread(() -> {
    // 方式1：检查中断标志
    while (!Thread.currentThread().isInterrupted()) {
        // 执行任务...
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            // 睡眠时被中断会清除中断标志
            System.out.println("线程在睡眠中被中断");
            Thread.currentThread().interrupt(); // 重新设置中断标志
            break;
        }
    }
    System.out.println("线程正常结束");
});

worker.start();
Thread.sleep(1000);
worker.interrupt(); // 发送中断信号
```

> 线程处于 sleep wait join 状态时，被中断会抛出InterruptedException，同时清除中断标志
> 所以处理完InterruptedException异常之后，线程应该退出，或者catch中重新设置标记位，并且在任务代码中检查状态

**2. join()的中断处理**
```java
Thread t1 = new Thread(() -> {
    Thread t2 = new Thread(() -> {
        try {
            Thread.sleep(5000); // 长时间任务
        } catch (InterruptedException e) {
            System.out.println("t2被中断");
        }
    });
    t2.start();
    
    try {
        t2.join(); // 等待t2完成
    } catch (InterruptedException e) {
        System.out.println("t1在等待t2时被中断");
        t2.interrupt(); // 中断t2
    }
});
```

**3. 标志位中断模式**
```java
class MyThread extends Thread {
    private volatile boolean running = true; // volatile保证可见性
    
    @Override
    public void run() {
        while (running) {
            // 执行任务
        }
    }
    
    public void shutdown() {
        running = false;
    }
}
```

#### **五、volatile关键字**

**1. Java内存模型（JMM）**
*   每个线程有自己的**工作内存**（缓存）
*   所有线程共享**主内存**
*   普通变量：线程修改工作内存副本，不定时写回主内存
*   `volatile`变量：直接读写主内存，保证可见性

**2. volatile的作用**
*   **可见性**：一个线程修改后，其他线程立即可见
*   **禁止指令重排序**：防止编译器优化导致代码执行顺序改变
*   **不保证原子性**：`count++`这样的操作仍需要互斥

```java
// 典型用法：状态标志
class TaskRunner {
    private volatile boolean stopRequested = false;
    
    public void run() {
        while (!stopRequested) {
            // 执行任务
        }
    }
    
    public void requestStop() {
        stopRequested = true;
    }
}
```

#### **六、守护线程**

**1. 特点与限制**
*   **设置时机**：必须在`start()`前调用`setDaemon(true)`
*   **JVM退出规则**：当所有**非守护线程**结束时，JVM退出，**不等待守护线程**
*   **限制**：守护线程**不能持有需要关闭的资源**（文件、数据库连接等），因为JVM退出时不会给它们清理机会

**2. 使用场景**
```java
// 监控线程、垃圾回收辅助线程等
Thread monitor = new Thread(() -> {
    while (true) {
        // 监控系统状态
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            break;
        }
    }
});
monitor.setDaemon(true); // 设置为守护线程
monitor.start();
```

#### **七、同步与锁机制**

**1. 为什么需要同步？**
*   **竞态条件**：多个线程同时访问共享资源
*   **数据不一致**：由于线程执行顺序不确定导致结果不可预测

**2. synchronized关键字**
```java
// 同步代码块（更灵活，粒度更细）
public void add(int value) {
    synchronized(this) { // 锁对象
        this.count += value;
    }
}

// 同步方法（等价于用synchronized(this)包裹方法体）
public synchronized void subtract(int value) {
    this.count -= value;
}

// 同步静态方法（锁的是Class对象）
public static synchronized void staticMethod() {
    // 锁住MyClass.class
}
```

**3. 线程安全的类特征**
*   **不可变类**：如`String`、`Integer`（状态不可变）
*   **正确同步的类**：内部使用`synchronized`保证线程安全
*   **线程安全的集合**：`ConcurrentHashMap`、`CopyOnWriteArrayList`等

#### **八、可重入锁与等待/通知机制**

**1. 可重入锁特性**
*   Java的锁都是可重入的
*   同一个线程可多次获取同一把锁
*   内部使用计数器记录重入次数，计数器为0时才真正释放锁

**2. wait()/notify()机制**
```java
class TaskQueue {
    private final Object lock = new Object();
    private Queue<String> queue = new LinkedList<>();
    
    public void addTask(String task) {
        synchronized(lock) {
            queue.add(task);
            lock.notify(); // 唤醒一个等待线程
            // lock.notifyAll(); // 唤醒所有等待线程
        }
    }
    
    public String getTask() throws InterruptedException {
        synchronized(lock) {
            while (queue.isEmpty()) {
                lock.wait(); // 释放锁并等待
            }
            return queue.remove();
        }
    }
}
```

**关键点**：
*   `wait()`必须**在synchronized块内调用**
*   `wait()`会**释放锁**，让其他线程可以进入同步块
*   被唤醒后需要**重新获取锁**才能继续执行

#### **九、java.util.concurrent高级锁**

**1. ReentrantLock（可重入锁）**
```java
import java.util.concurrent.locks.*;

class Counter {
    private final ReentrantLock lock = new ReentrantLock();
    private int count = 0;
    
    public void add(int n) {
        lock.lock(); // 获取锁
        try {
            count += n;
        } finally {
            lock.unlock(); // 必须释放锁
        }
    }
    
    public boolean tryAdd(int n) {
        // 尝试获取锁，最多等待1秒
        try {
            if (lock.tryLock(1, TimeUnit.SECONDS)) {
                try {
                    count += n;
                    return true;
                } finally {
                    lock.unlock();
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return false;
    }
}
```

> `ReetrantLock`锁一定要在获取锁，执行业务代码时候，释放锁，所以建议把业务代码用try-finally包围

> [!NOTE] `ReentrantLock`的优势
> 1. 中断响应：`lockInterruptibly`和`tryLock()` 可被中断的获取锁
> 2. 超时等待：`tryLock()`允许在一段时间内尝试获取锁，性能更高
> 3. 超时等待失败后，非阻塞等待
> 4. 基于用户态的`CAS`实现，性能快
> 5. 可以创建多个同步的`Condition`

**2. Condition实现等待/通知**
```java
class BoundedBuffer {
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull = lock.newCondition();  // 队列不满条件
    private final Condition notEmpty = lock.newCondition(); // 队列不空条件
    private final Object[] items = new Object[100];
    private int putptr, takeptr, count;
    
    public void put(Object x) throws InterruptedException {
        lock.lock();
        try {
            while (count == items.length) {
                notFull.await(); // 等待队列不满
            }
            items[putptr] = x;
            if (++putptr == items.length) putptr = 0;
            count++;
            notEmpty.signal(); // 通知队列不空
        } finally {
            lock.unlock();
        }
    }
    
    public Object take() throws InterruptedException {
        lock.lock();
        try {
            while (count == 0) {
                notEmpty.await(); // 等待队列不空
            }
            Object x = items[takeptr];
            if (++takeptr == items.length) takeptr = 0;
            count--;
            notFull.signal(); // 通知队列不满
            return x;
        } finally {
            lock.unlock();
        }
    }
}
```

#### **十、读写锁**

**1. 读写锁特点**
*   **读锁共享**：多个线程可同时持有读锁
*   **写锁独占**：写锁与其他所有锁互斥
*   **适合场景**：读多写少的并发场景

```java
import java.util.concurrent.locks.*;

class Cache<K, V> {
    private final ReadWriteLock rwlock = new ReentrantReadWriteLock();
    private final Lock rlock = rwlock.readLock();   // 读锁
    private final Lock wlock = rwlock.writeLock();  // 写锁
    private final Map<K, V> map = new HashMap<>();
    
    public V get(K key) {
        rlock.lock(); // 获取读锁
        try {
            return map.get(key);
        } finally {
            rlock.unlock();
        }
    }
    
    public void put(K key, V value) {
        wlock.lock(); // 获取写锁
        try {
            map.put(key, value);
        } finally {
            wlock.unlock();
        }
    }
}
```

**2. StampedLock（邮戳锁）**
*   支持**乐观读**，进一步提升读性能
*   不可重入
*   使用更复杂，需处理版本验证

```java
class Point {
    private final StampedLock stampedLock = new StampedLock();
    private double x, y;
    
    // 乐观读
    public double distanceFromOrigin() {
        long stamp = stampedLock.tryOptimisticRead(); // 尝试乐观读
        double currentX = x, currentY = y;
        if (!stampedLock.validate(stamp)) { // 验证版本
            stamp = stampedLock.readLock(); // 乐观读失败，转悲观读
            try {
                currentX = x;
                currentY = y;
            } finally {
                stampedLock.unlockRead(stamp);
            }
        }
        return Math.sqrt(currentX * currentX + currentY * currentY);
    }
}
```

#### **十一、信号量（Semaphore）**

```java
import java.util.concurrent.Semaphore;

// 限流器：最多允许5个线程同时访问
class RateLimiter {
    private final Semaphore semaphore = new Semaphore(5);
    
    public void accessResource() throws InterruptedException {
        semaphore.acquire(); // 获取许可
        try {
            // 访问共享资源
            System.out.println(Thread.currentThread().getName() + " 正在访问资源");
            Thread.sleep(1000);
        } finally {
            semaphore.release(); // 释放许可
        }
    }
    
    // 尝试获取许可，不阻塞
    public boolean tryAccess() {
        return semaphore.tryAcquire();
    }
}
```

#### **十二、原子类**

**1. java.util.concurrent.atomic包**
*   提供无锁的线程安全操作
*   基于CAS（Compare And Swap）实现

```java
import java.util.concurrent.atomic.*;

class AtomicCounter {
    private final AtomicInteger count = new AtomicInteger(0);
    
    public void increment() {
        count.incrementAndGet(); // 原子操作
    }
    
    public int get() {
        return count.get();
    }
    
    // CAS操作示例
    public boolean compareAndSet(int expected, int update) {
        return count.compareAndSet(expected, update);
    }
}
```

**常用原子类**：
*   `AtomicInteger` / `AtomicLong`：整型原子操作
*   `AtomicBoolean`：布尔型原子操作
*   `AtomicReference<V>`：引用类型原子操作
*   `AtomicIntegerArray`：数组原子操作

#### **十三、线程池**

**1. 为什么使用线程池？**
*   **降低资源消耗**：复用已创建的线程
*   **提高响应速度**：任务到达时无需等待线程创建
*   **提高可管理性**：统一管理线程

**2. Executor框架**

所有的线程池创建的方法都被封装在`Executors`的静态方法中
1. `FixedThreadPool`
	容量固定的线程池
	通过`submit`提交方法，通过`shutdown`关闭线程池（等待任务执行），通过`shutdownNow`会停止正在执行的任务，`awaitTermination`可以指定一段等待时间之后再关闭线程池
2. `CachedThreadPool`
	创建动态容量的线程池
	如果要自己创建指定容量范围的线程池
	```
	ExecutorService es = new ThreadPoolExecutor(
		指定最小， 指定最大
		...
	)
	```
3. `ScheduledThreadPool`
	可以指定任务是否周期性执行
	- `ses.schedule(new Task("one-time"), 1, TimeUnit.SECONDS);`
	- 执行一次的任务，1代表在1秒后开始执行
	对于周期性执行的任务来说，可以指定间隔时间
	- 每相隔固定时间执行一次
		- `ses.scheduleAtFixedRate(new Task("fixed-rate"), 2, 3, TimeUnit.SECONDS);`
		- 2表示在2秒之后开始执行，3表示每间隔3秒执行一次
	- 等上一次执行完之后，等待固定间隔执行下一次
		- `ses.scheduleWithFixedDelay(new Task("fixed-delay"), 2, 3, TimeUnit.SECONDS);`
		- 3表示执行完上一次之后，等待3秒会执行下一次

> 当固定时间间隔执行的任务，没有在这段间隔时间完成执行时，会等到该任务完成后，立刻下一次任务，任务有可能会在不同的线程上执行


```java
import java.util.concurrent.*;

public class ThreadPoolDemo {
    public static void main(String[] args) {
        // 1. 固定大小线程池
        ExecutorService fixedPool = Executors.newFixedThreadPool(5);
        
        // 2. 缓存线程池（线程数量动态调整）
        ExecutorService cachedPool = Executors.newCachedThreadPool();
        
        // 3. 单线程线程池（保证任务顺序执行）
        ExecutorService singleThread = Executors.newSingleThreadExecutor();
        
        // 提交任务
        for (int i = 0; i < 10; i++) {
            final int taskId = i;
            fixedPool.submit(() -> {
                System.out.println("执行任务 " + taskId + "，线程: " + 
                    Thread.currentThread().getName());
            });
        }
        
        // 关闭线程池
        fixedPool.shutdown(); // 温和关闭，等待已提交任务完成
        // fixedPool.shutdownNow(); // 立即关闭，尝试中断所有任务
        
        try {
            // 等待线程池终止
            if (!fixedPool.awaitTermination(60, TimeUnit.SECONDS)) {
                fixedPool.shutdownNow(); // 超时后强制关闭
            }
        } catch (InterruptedException e) {
            fixedPool.shutdownNow();
        }
    }
}
```

**3. 自定义线程池**
```java
// 核心参数：
// corePoolSize: 核心线程数（即使空闲也不会回收）
// maximumPoolSize: 最大线程数
// keepAliveTime: 非核心线程空闲存活时间
// workQueue: 任务队列
// threadFactory: 线程工厂
// handler: 拒绝策略

ExecutorService customPool = new ThreadPoolExecutor(
    4, // 核心线程数
    10, // 最大线程数
    60L, TimeUnit.SECONDS, // 空闲线程存活时间
    new ArrayBlockingQueue<>(100), // 任务队列容量100
    Executors.defaultThreadFactory(), // 线程工厂
    new ThreadPoolExecutor.CallerRunsPolicy() // 拒绝策略：调用者运行
);
```

**4. 定时任务线程池**
```java
ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

// 延迟执行
scheduler.schedule(() -> {
    System.out.println("延迟5秒执行");
}, 5, TimeUnit.SECONDS);

// 固定频率执行（不考虑任务执行时间）
scheduler.scheduleAtFixedRate(() -> {
    System.out.println("每隔3秒执行一次");
}, 1, 3, TimeUnit.SECONDS);

// 固定延迟执行（任务结束后延迟指定时间再执行）
scheduler.scheduleWithFixedDelay(() -> {
    try {
        Thread.sleep(2000); // 任务执行时间
        System.out.println("任务结束后延迟2秒再执行");
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
}, 1, 2, TimeUnit.SECONDS);
```

#### **十四、线程安全集合**

**1. 并发集合类**
*   `ConcurrentHashMap`：分段锁实现的线程安全HashMap，并发程度高
*   `CopyOnWriteArrayList`：写时复制的ArrayList，适合读多写少
*   `ConcurrentLinkedQueue`：无锁队列，基于CAS实现互斥操作
*   `BlockingQueue`：阻塞队列接口，多个实现类

**2. 阻塞队列示例**
```java
// 生产者-消费者模式
BlockingQueue<String> queue = new ArrayBlockingQueue<>(10);

// 生产者
new Thread(() -> {
    try {
        queue.put("任务"); // 队列满时阻塞
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
}).start();

// 消费者
new Thread(() -> {
    try {
        String task = queue.take(); // 队列空时阻塞
        System.out.println("处理: " + task);
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
}).start();
```


#### 十五 使用Future

使用线程池执行任务时，任务对象只需要实现Runnable接口，重写run方法，就可以放到线程池执行。
不过这样存在一个问题，run函数签名的返回类型是void，那如果任务是需要一个返回结果的话，可以实现Callable接口，这是一个泛型结果，需要什么类型的返回，就实现什么类型的泛型接口，通过线程池的提交服务之后，可以得到`Future<E>`的对应泛型结果

future的方法
1. get() ：获取结果（可能会等待）
2. get(long timeout, TimeUnit unit) ：获取结果，但只等待指定的时间；
3. cancel(boolean mayInterruptIfRunning) ：取消当前任务；
4. isDone() ：判断任务是否已完成。

#### 十六 CompletableFuture

Future的阻塞得到返回结果往往是我们不希望看到的，为此，可以使用`CompletableFuture`

一些比较常用的方法
1. 创建对象
	CompletableFuture<E> cf = CompletableFuture.supplyAsync()
	这场来说，这里的传入参数是一个Supply接口的实现类，但是Supply接口注解了@FunctionalInterface,所以一般是通过传入一个lambda函数，创建对象，函数的返回类型需要和E对应
2. 对于上面的cf对象，单独来说
	1. .thenAccept(),同样可以传入一个labmda函数，会消费cf执行的返回结果，不会产出值
	2. .thenApply(),对产出结果进行加工，传入lambda函数
	3. .exceptionall(),对产生的异常进行处理，处理完后，还是需要返回一个E类型的结果，或者继续抛出异常，进入异常链处理
	4. cf.join()阻塞获得结果
3. cf对象还可以和别的任务进行组合
	1. CompletableFuture<E> cfAll = CompletableFuture.allOf(cf1, cf2) | cfAll会等到所有执行结束
	2. CompletableFuture<E> cfAny = CompletableFuture.anyOf(cf1, cf2) | cfAll会等到其中一个执行结束
	3. CompletableFuture<E> cfcombine = cf.thenCombine(cf1, (e1, e2) -> {}) | cf和cf1并行执行，e1是cf的返回结果，e2是cf1的返回结果
	4. CompletableFuture<E> cfcompose = cf.thenCompose((cf返回结果) -> {返回一个ComputableFuture<E>对象})
4. 方法中
	1. 如果有Async的后缀，往往是把回调函数交给线程池进行执行，也意味着，任务的执行线程和回调的执行线程可能不会是同一个线程
		1. thenApply
		2. thenApplyAsync

#### 十七 ThreadLocal

当我们在一个任务中，有很深的调用栈，并且深层次的函数，和浅层都需要当前任务的一个通过执行环境，可以通过执行任务的线程来提供这个环境
应用方式：
1. 在主线程中，可以封装一个类，内部持有一个静态常量ThreadLocal类型
2. 类封装set和get方法
3. 类实现AutoCloseable接口，重写close方法，内部调用.remove
之后，我们就通过类的静态方法来调用封装的set和get，还可以try-with-resource,在try（）中创建类对象，这样可以自动释放注入的上下文信息


#### 十八 虚拟线程

线程调用是由操作系统进行管理调度的，线程切换时，需要上下文切换，这个过程相当消耗CPU资源。另外，创建一个线程，虽然比创建进程经济，但是总体来说还是消耗资源。
在大型服务器通信中，一个用户请求用线程来执行，为了防止线程的创建和销毁，可以通过线程池的方式来优化，但是面对大量的用户请求，线程池也是吃不消的

另外，线程如果是IO密集型的，会经常因为IO操作而等待，我们用协程（虚拟线程）解决这个问题

虚拟线程的创建
1. Thread.startVirtualThread 创建就运行
2. Thread.ofVirtual.unstart 创建不运行
3. 得到工厂

具体使用等到之后要用到在学习吧~
Java21 发布，需要在运行时启用 --enable-preview
---