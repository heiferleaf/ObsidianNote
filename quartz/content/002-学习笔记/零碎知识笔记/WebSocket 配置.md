---
created: 2026-02-20
modified: 2026-02-20
---


# 🛠️ WebSocket 系统构建笔记

## 1. 核心依赖清单 (pom.xml)

在开始写 Java 代码前，必须给 Maven 装备好“协议升级”的驱动。

XML

```
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

---

## 2. 模块角色分配 (代码结构)

我们将 WebSocket 拆分为四个核心组件，它们各司其职：

|**组件名称**|**核心类名**|**职责 (大白话)**|
|---|---|---|
|**安检员**|`WsHandshakeInterceptor`|连接建立前，看 Token，把 `userId` 塞进 Session 口袋。|
|**通讯录**|`WsSessionManager`|在内存里拿 Map 存物理管子，方便以后随时找人。|
|**接待员**|`MyWsHandler`|连接建立后，把管子存入“通讯录”，并在 Redis 登记上线。|
|**总调度**|`WebSocketConfig`|规定谁走哪个门（URL 映射），把上面的人全串起来。|

---

## 3. 步骤实现：四部曲

### 第一步：创建“通讯录” (WsSessionManager)

**为什么需要它？** 因为 Handler 只能处理建立连接的那一刻，我们需要一个全局的“盒子”把管子存起来。

Java

```
@Component
public class WsSessionManager {
    // 线程安全的 Map：Key=用户ID, Value=连接管子
    private final Map<Long, WebSocketSession> SESSION_POOL = new ConcurrentHashMap<>();

    public void add(Long userId, WebSocketSession session) { SESSION_POOL.put(userId, session); }
    public void remove(Long userId) { SESSION_POOL.remove(userId); }
    public WebSocketSession get(Long userId) { return SESSION_POOL.get(userId); }
}
```

### 第二步：编写“安检员” (WsHandshakeInterceptor)

**原理**：利用 HTTP 升级为 WS 之前的最后一次 GET 请求，把用户身份识别出来。

Java

```
@Component
public class WsHandshakeInterceptor implements HandshakeInterceptor {
    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, 
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        ServletServerHttpRequest servletRequest = (ServletServerHttpRequest) request;
        // 假设 App 请求：ws://localhost:8080/ws?token=xxxxx
        String token = servletRequest.getServletRequest().getParameter("token");
        
        if (token != null) {
            Long userId = 1001L; // 这里替换为你解析 JWT 的逻辑
            // 重点：存入 attributes。Handler 之后会从这里面拿 ID
            attributes.put("userId", userId); 
            return true; 
        }
        return false; // 没 Token 不准连
    }
    @Override
    public void afterHandshake(...) {} // 默认留空
}
```

### 第三步：编写“接待员” (MyWsHandler)

**重点**：继承 `TextWebSocketHandler`。它处理的是连接建立后的**物理状态**。

Java

```
@Component
public class MyWsHandler extends TextWebSocketHandler {
    @Autowired private WsSessionManager sessionManager;
    @Autowired private StringRedisTemplate redisTemplate;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        // 从拦截器塞入的口袋里拿 ID
        Long userId = (Long) session.getAttributes().get("userId");
        if (userId != null) {
            sessionManager.add(userId, session); // 存入本地内存找管子
            redisTemplate.opsForHash().put("ws:status", userId.toString(), "1"); // 存入Redis查在线
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long userId = (Long) session.getAttributes().get("userId");
        if (userId != null) {
            sessionManager.remove(userId); // 物理管子拔出
            redisTemplate.opsForHash().delete("ws:status", userId.toString()); // Redis 下线
        }
    }
}
```

### 第四步：总调度配置 (WebSocketConfig)

**为什么端口没冲突？** 因为 WS 在 8080 端口“借壳升级”。

Java

```
@Configuration
@EnableWebSocket // 开启协议转换引擎
public class WebSocketConfig implements WebSocketConfigurer {
    @Autowired private MyWsHandler myWsHandler;
    @Autowired private WsHandshakeInterceptor handshakeInterceptor;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(myWsHandler, "/ws") // 指定地址
                .addInterceptors(handshakeInterceptor) // 指定安检口
                .setAllowedOrigins("*"); // 允许 App 联调跨域
    }
}
```

---

## 4. 关键知识点梳理

1. **为什么不冲突？**：WS 握手是基于 HTTP 的，端口复用 8080，通过 `Upgrade` 头实现协议切换。
    
2. **物理管子 vs 逻辑状态**：`WebSocketSession`（物理管子）存内存；`userId` 在线状态存 Redis。
    
3. **解耦预留**：目前的 Handler 只能处理连接逻辑，后续广播功能通过 `WsSessionManager.get(userId)` 拿到管子后，在业务类中直接调用 `sendMessage()` 即可。
    

