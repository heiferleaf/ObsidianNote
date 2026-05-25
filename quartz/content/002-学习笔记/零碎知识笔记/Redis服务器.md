---
created: 2026-02-19
modified: 2026-02-20
---
# 📚 Redis 与分布式锁深度笔记

## 一、 Redis 架构原理：高性能的基石

### 1. 网络通信模型：C/S 架构
*   **物理部署**：Redis 通常作为独立的中间件服务器部署，与应用服务器（Client）分离。
*   **连接优化（Connection Pool）**：
    *   **痛点**：TCP 三次握手/四次挥手在高并发下开销极大（甚至超过数据处理时间）。
    *   **方案**：客户端维护**连接池**，实现连接复用，降低建立连接的延迟和 CPU 消耗。

### 2. 核心特性：单线程与 IO 多路复用
Redis 的“快”源于其独特的设计哲学：
*   **单线程执行命令**：
    *   **无锁化**：所有操作逻辑上都是顺序执行的，无需竞争锁。
    *   **无上下文切换**：避免了多线程环境下 CPU 切换线程带来的开销。
    *   **原子性**：单条指令的原子性是实现分布式锁的天然保障。
*   **IO 多路复用（epoll）**：
    *   **机制**：采用基于**事件驱动**的 `epoll` 模型（Linux 下）。
    *   **比喻**：CPU 不再像“外卖员”挨家挨户敲门问（轮询），而是像“快递柜”发送短信（中断通知），CPU 只在有数据准备好时才去处理，极大提升了单机并发处理连接的能力。

---

## 二、 深度解析：Redisson 分布式锁

### 1. 从 SETNX 到 Redisson 的演进
*   **普通 String 锁 (`SETNX`)**：仅能实现互斥，不支持重入，容易发生死锁（如业务超时或宕机）。
*   **Redisson 锁**：通过 **Lua 脚本** 将复杂的逻辑打包发给 Redis，保证了整体操作的**原子性**。

### 2. Hash 数据结构：锁的多维描述
Redisson 不再使用简单的 String，而是使用 **Hash** 结构存储锁信息：
*   **Key**: 锁的名字（如 `order:pay:lock`）。
*   **Field**: 线程唯一标识（`UUID + ThreadID`）。
*   **Value**: 重入计数（`Counter`）。
*   **逻辑优势**：
    *   **可重入性**：同一线程再次加锁时，判断 Field 一致，则 Value + 1。
    *   **读写锁**：在 Hash 中增加 `mode` 字段（`read`/`write`）来区分状态。

### 3. 看门狗机制（Watchdog）
为了解决“业务没跑完，锁提前过期”的问题：
*   如果未指定 `leaseTime`，Redisson 会启动一个后台线程（Watchdog）。
*   它每隔 10 秒（默认）检查一次，如果业务线程还在运行，就自动给锁**续命**（重置过期时间为 30 秒）。

---

## 三、 生产级代码实践

```java
@Component  
public class RedisService {  
  
    @Autowired  
    private StringRedisTemplate redisTemplate;  
  
    @Autowired  
    private RedissonClient redisson;  
  
    // ================= String 常用操作 (缓存使用) =================
  
    public void set(String key, String value) {  
        redisTemplate.opsForValue().set(key, value);  
    }  
  
    public void setWithExpire(String key, String value, long timeout, TimeUnit unit) {  
        redisTemplate.opsForValue().set(key, value, timeout, unit);  
    }  
  
    public String get(String key) {  
        return redisTemplate.opsForValue().get(key);  
    }  
  
    // ================= Redisson 分布式锁 (并发控制) =================
  
    /**  
     * 尝试加锁逻辑  
     * @param lockKey 锁标识  
     * @param waitTime 最大等待时间（在此时间内会不断尝试抢锁）  
     * @param leaseTime 自动释放时间（建议设为 -1 以开启看门狗机制）  
     */  
    public boolean tryLock(String lockKey, long waitTime, long leaseTime) {  
        RLock lock = redisson.getLock(lockKey);  
        try {  
            // tryLock 内部封装了 Lua 脚本，保证了加锁、设置过期时间、记录线程 ID 的原子性  
            return lock.tryLock(waitTime, leaseTime, TimeUnit.SECONDS);  
        } catch (InterruptedException e) {  
            Thread.currentThread().interrupt(); // 保持中断状态  
            return false;  
        }  
    }  
  
    /**  
     * 安全释放锁  
     */  
    public void unlock(String lockKey) {  
        RLock lock = redisson.getLock(lockKey);  
        // 关键点：必须判断锁是否被当前线程持有，防止非法释放或误删他人的锁  
        if (lock.isHeldByCurrentThread()) {  
            lock.unlock();  
        }  
    }  
}
```

---

## 四、 总结与对比

| 维度 | StringRedisTemplate (`SETNX`) | Redisson (`RLock`) |
| :--- | :--- | :--- |
| **底层结构** | String (简单键值) | **Hash (复合结构)** |
| **原子性** | 靠单条指令 | 靠 **Lua 脚本** 打包多条指令 |
| **可重入性** | 不支持 | **支持** (通过 Counter 计数) |
| **过期机制** | 固定过期，容易提前失效 | **看门狗 (Watchdog) 自动续期** |
| **适用场景** | 简单的互斥、防重点击 | 复杂的并发控制、核心业务逻辑 |

---

### 💡 优化建议：
1.  **关于 leaseTime**：在调用 `lock.tryLock` 时，如果 `leaseTime` 设为具体数值，看门狗机制会失效。如果希望看门狗生效，请传入 `-1` 或者不传。
2.  **关于序列化**：`StringRedisTemplate` 默认使用 `StringRedisSerializer`，这能保证在 Redis 中看到的 Key 是易读的字符串，而不是乱码。