---
created: 2026-03-03
modified: 2026-03-03
---
# 原理部分

## 服务注册

现在的云服务，很多都使用了微服务的技术，将一个完整的软件系统，按照业务领域进行划分，得到许多的微服务，比如用户注册服务，用户登录服务等，服务之间通过==网络通信==。

而对于无状态的服务，在云服务的场景下，或者在分布式的需求中，可能会因为需要处理大规模的数据（很多用户登录），而进行分布式处理（让很多逻辑层面的机器[^1]）。

那么就要考虑服务调用的设置了，显然，我们不能直接在调用处写死一个IP地址。
1. 失去了分布式的意义
2. 服务所在容器，暴露在虚拟机中的网络地址不一定每次都相同

于是，我们想到可以利用中间件，通过一个调度中心，让调用方在这里得到一个服务，所有的服务也交由中心来进行管理。
1. 调用方配置的IP不会变了
2. 调度中心（服务中心）可以实现对服务的负载均衡，或者其他高级配置

> 无状态的服务：用户随便在哪一个运行这个服务的容器/服务器上执行，都能得到相同的结果，结果并不与容器有相关性。比如登录，只要执行登录逻辑，管他是在哪里运行的。


> 此处的负载均衡可以实现更加复杂的逻辑，例如：
> 1. 灰度测试：当部分服务升级了之后，让10%的用户能访问到升级后的服务，剩余的用户访问的是升级之前的服务
> 2. 地区限制：让服务和调用处的位置尽可能近，减少网络传输的开销
> 3. 性能分配：服务在性能更好的服务器上，可以承担更多的流量

## 服务使用 （OpenFeign）

通过服务的注册，可以让服务中心管理所有的服务示例。以供其他服务使用服务中心中的服务。
> 此时的服务使用不依赖于被调用服务所在的 容器/虚拟机/物理机 暴露出来的IP地址，而是依赖服务中心的地址。
> 并且，就算不同服务在他们自己的环境中，暴露出来的IP地址相同，也可以通过服务名来进行区分


# SpringCloud 代码实现流程


### 第一步：父工程环境定义 (Dependency Management)

父工程不写代码，只负责分布式系统的**版本仲裁**，确保所有子模块的依赖版本一致，防止分布式环境下的类路径冲突。

**pom.xml (父项目根目录):**


```xml
<packaging>pom</packaging>
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.4</version>
</parent>

<properties>
    <java.version>17</java.version>
    <spring-cloud.version>2023.0.0</spring-cloud.version>
    <spring-cloud-alibaba.version>2022.0.0.0-RC2</spring-cloud-alibaba.version>
</properties>

<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>${spring-cloud.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
        <dependency>
            <groupId>com.alibaba.cloud</groupId>
            <artifactId>spring-cloud-alibaba-dependencies</artifactId>
            <version>${spring-cloud-alibaba.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

---

### 第二步：服务提供方 (Order-Service)

**1. 项目依赖 (order-service/pom.xml):**


```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
    </dependency>
</dependencies>
```

**2. 配置文件 (application.yml):**


```yaml
server:
  port: 8081 # 物理端口
spring:
  application:
    name: order-service # 逻辑服务名，分布式寻址的关键
  cloud:
    nacos:
      discovery:
        server-addr: 127.0.0.1:8848 # Nacos 容器的访问地址
```

**3. 核心代码 (OrderController.java):**


```java
@RestController
public class OrderController {
    @Value("${server.port}")
    private String port;

    @GetMapping("/order/info")
    public String getInfo() {
        // 返回包含端口的信息，方便观察分布式负载均衡效果
        return "来自节点 " + port + " 的订单数据";
    }
}
```

---

### 第三步：服务消费方 (User-Service)

**1. 项目依赖 (user-service/pom.xml):**


```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-openfeign</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-loadbalancer</artifactId>
    </dependency>
</dependencies>
```

**2. 配置文件 (application.yml):**


```yml
server:
  port: 8082
spring:
  application:
    name: user-service
  cloud:
    nacos:
      discovery:
        server-addr: 127.0.0.1:8848
```

**3. 声明式接口定义 (OrderClient.java):**

这里体现了分布式抽象：代码不关心 IP，只关心服务名 `order-service`。


```java
@FeignClient(name = "order-service") // 对应 Nacos 中的服务名
public interface OrderClient {
    @GetMapping("/order/info")
    String getOrderInfo();
}
```

**4. 业务调用与启动类:**


```java
@RestController
public class UserController {
    @Autowired
    private OrderClient orderClient;

    @GetMapping("/user/buy")
    public String buy() {
        return "用户服务收到 -> " + orderClient.getOrderInfo();
    }
}

@SpringBootApplication
@EnableDiscoveryClient
@EnableFeignClients // 必须开启 Feign 扫描
public class UserApplication {
    public static void main(String[] args) {
        SpringApplication.run(UserApplication.class, args);
    }
}
```

---

### 分布式原理深度总结

#### 1. 注册中心的角色 (Nacos)

分布式系统中，服务的生命周期是动态的。Nacos 充当了“**中央路由表**”，它通过**心跳检测**机制维护各实例的健康状态。当 `order-service` 启动时，它会向 Nacos 发送包含自身 IP 和端口的报文，这一步称为**服务注册**。

#### 2. 远程调用的本质 (OpenFeign)

OpenFeign 利用了 **JDK 动态代理**。你在代码里调用的 `getOrderInfo()` 实际上是一个代理对象。它会执行以下分布式逻辑：

- **拦截调用**：识别出你要访问 `order-service`。
    
- **服务发现**：去 Nacos 获取该服务的实时实例列表（例如 `[127.0.0.1:8081]`）。
    
- **负载均衡**：通过 `LoadBalancer` 在列表中选择一个 IP。
    
- **网络封装**：将方法转换为标准的 HTTP 请求并发出。

#### 3. 为什么选择这种架构？

- **高可用**：如果 8081 挂了，你再启动一个 8083，Nacos 会自动更新路由表，`User-Service` 无需修改任何代码即可自动切换。
    
- **屏蔽网络细节**：开发者只需要像写单机代码一样定义接口，复杂的网络寻址由框架在底层完成。



[^1]: 之所以说是逻辑层面，是考虑到物理上可能有很多的虚拟机在运行，所以运行单位不一定是物理机
