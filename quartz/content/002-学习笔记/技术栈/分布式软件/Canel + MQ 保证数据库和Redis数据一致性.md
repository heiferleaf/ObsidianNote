---
title: Canel + MQ 保证数据库和Redis数据一致性
created: 2026-03-19
modified: 2026-03-19
tags:
  - 技术栈
subject: 分布式软件
---
## 技术原理

### Canel

Canel是一个伪装成 MySQL 从库的服务器，通过和MySQL数据保持TCP通信，监听主库的 binlog（二进制日志），知晓主库的数据变化
> 在技术搭配中，Canel作为MQ的生产者，提供消息，SpringBoot项目中，编写一个Bean，作为MQ的消费者
## MQ

消息对列，支持操作的解耦和异步执行。通过将操作数据和操作类型，以消息的格式，放入消息队列中，可以实现消息的持久化存储，有效的防止操作丢失。

- **解耦**：业务逻辑不需要关注缓存数据内容，只需要关注数据库内容。这种解耦也保持了开闭原则，后续如果像拓展搜索业务，只需要新增消费者，不需要改动业务逻辑
- **重试机制：** 通过ACK机制，保证MQ中的任务被完成，防止因为网络波动，导致的删除缓存失败
- **持久存储**：MQ存放在消息对列这个服务器的磁盘中，就算宕机了，后续还能恢复MQ

> [!NOTE] 延迟双删技术
> 在主从同步中，是存在一定的延迟的，多线程并发操作的时候，因为读写分离，读取到的数据很可能是旧数据，如果在读取的时候，缓存有过期了，那么就会把读取到的旧数据写到缓存中，更麻烦的是，这个操作如果发生在主库写后删除缓存的行为之后，就相当于缓存中有脏数据。
> 为了防止这种情况，可以在第一次删除缓存之后，间隔一段时间再一次删除缓存。叫做延迟双删
> 
> MQ因为是在canel接收到binlog之后，才工作的，所以这时候其他的读线程基本都已经完成了，或者写缓存的操作完成了，因此MQ删除缓存之后，大概率数据保持一致性。可以通过设置数据的缓存过期时间、采用双删策略


Rabbit MQ 的消息转发机制

- 生产者：生产者会将消息发送给交换机，消息上有一个“邮编”
- 消费者：设置一个本地邮箱、接收的邮编、与交换机的连接规则
- 交换机（Exchange）：消息中心，负责接收数据，按照消费者定义的订阅数据的规则，提供消息
	- DIRECT：根据邮编精准匹配
	- FANOUT：全部接受
	- TOPIC：支持邮编的模糊匹配，`*` 代表一个词，`#` 代表多个词，比如 `canal.update.*`


## 主从架构下的读写操作强一致性

原来的单机数据库，通过读写锁的设置，保证写进程执行的之后，无法进行读操作。

在分布式软件 + 主从架构的设计下
1. 锁需要从内存锁 -》 分布式锁
2. 当写锁释放，主库数据不一定同步到从库，读操作的数据不一定最新

解决方案
1. 在某些场景的写操作发生时，接下的一段时间，强制读取主库
2. 主从同步的机制，设置为同步复制，等待所有数据库数据一致，认为写操作完成


## 具体实现

镜像版本选择

- Canal：Canal-server:v1.1.8 :支持RabbitMQ
- RabbitMQ：rabbitmq:3.12-management-alpine

Maven依赖
```xml
<dependency>  
    <groupId>org.springframework.boot</groupId>  
    <artifactId>spring-boot-starter-amqp</artifactId>  
</dependency>
```

Docker-compose 配置
```yml
# ==================== RabbitMQ (新增) ====================  
rabbitmq:  
  image: rabbitmq:3.12-management-alpine  
  container_name: rabbitmq  
  ports:  
    - "5672:5672"  
    - "15672:15672" # 管理面板端口  
  healthcheck:  
    test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]  
    interval: 10s  
    timeout: 5s  
    retries: 5  
  networks:  
    - app-network  
  
# ==================== Canal (新增) ====================  
canal:  
  image: canal/canal-server:v1.1.8  
  container_name: canal  
  depends_on:  
    mysql:  
      condition: service_healthy  
    rabbitmq:  
      condition: service_healthy  
  volumes:  
    - ./canal_conf/canal.properties:/home/admin/canal-server/conf/canal.properties  
    - ./canal_conf/example/instance.properties:/home/admin/canal-server/conf/example/instance.properties  
  # ↓ 原来的 environment 块全部删掉，配置已经在文件里了  
  networks:  
    - app-network
```

数据库修改配置
`mysql_conf/my.cnf` 中配置
```
[mysqld]  
# 基础配置  
user = mysql  
character-set-server=uft8mb4  
  
# 配置 canel 伪装的从库  
server-id=123 # 主库的唯一ID，不能和别的从库冲突  
log-bin=mysql-bin # 开启 binlog  
binlog-format=ROW # 记录主库每一行的变化  
binlog-row-image=FULL  
bind-address=0.0.0.0
```

> 目的是开启 binlog

数据库初始化配置
```sql
CREATE USER 'canal'@'%' IDENTIFIED WITH mysql_native_password BY 'canal_password';  
GRANT SELECT, REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'canal'@'%';  
FLUSH PRIVILEGES;
```

> 创建伪装从库的用户

数据库Docker-compose挂载
```yml
# ==================== MySQL ====================  
mysql:  
  image: mysql:8.0  
  container_name: mysql  
  environment:  
    MYSQL_ROOT_PASSWORD: root123  
    MYSQL_DATABASE: shop  
    TZ: Asia/Shanghai  
  volumes:  
    - mysql_data:/var/lib/mysql  
    - ./mysql/init.sql:/docker-entrypoint-initdb.d/init.sql  
    - ./mysql_conf/my.cnf:/etc/mysql/conf.d/my.cnf
```

canal-config 配置
`canal-config/example/instance.properties` 中修改

```
canal.instance.dbUsername=canal  # 上面创建的从库的用户名
canal.instance.dbPassword=canal_password # 密码

canal.instance.master.address=mysql:3306 # 主库域名

canal.mq.topic=example # 消息的topic
```

`canal-config/canal.properties` 中修改
```
rabbitmq.host = rabbitmq  
rabbitmq.virtual.host = /  
rabbitmq.exchange = canal.exchange  
rabbitmq.username = guest  
rabbitmq.password = guest  
rabbitmq.queue = canal_shop_queue  
rabbitmq.routingKey = example  
rabbitmq.deliveryMode = direct

canal.serverMode = rabbitMQ
```

接收MQ的数据类定义
```java
@Data  
public class CanalMessage<T> {  
    // 发生变更的数据库名  
    private String database;  
    // 发生变更的数据表名  
    private String table;  
    // 动作类型 insert / delete / update    private String type;  
    // 变化后的数据  
    private List<T> data;  
    // 发生变更的sql  
    private String sql;  
    // 主键字段  
    private List<String> pkNames;  
    // 是否是DDL语句  
    private Boolean isDdl;  
}
```

创建消费 MQ 消息的 Bean，通过注解配置订阅的消息转发中心和消息Topic，注册存储消息的对列，消息存储的持久化配置

```java
@Slf4j  
@Component  
public class CanalCacheSyncListener {  
    @Autowired  
    ObjectMapper objectMapper;  
    @Autowired  
    private RedisTemplate<String, Object> redisTemplate;  
  
    @RabbitListener(bindings = @QueueBinding(  
            value = @Queue(value = "canal_shop_queue", durable = "true"),   // 在 MQ 服务器中，声明一个对列，接收消息，持久化存储到磁盘中  
            exchange = @Exchange(value = "canal.exchange", type = "direct"),  // 在 MQ 服务器中，连接canal_exchange这个消息中心，指定连接方式是直连，所以只有消息邮编和指定接收邮编完全一致，才会被放到消息队列中  
            key = "example"  
    ))  
    public void processProductChange(Message message, Channel channel) throws IOException {  
        long deliveryTag = message.getMessageProperties().getDeliveryTag();  
        log.info("receive message with deliveryTag {}", deliveryTag);  
        try {  
            String jsonStr = new String(message.getBody(), StandardCharsets.UTF_8);  
  
            if(jsonStr.isBlank()) return;  
  
            CanalMessage<Product> canalMessage = objectMapper.readValue(jsonStr, new TypeReference<CanalMessage<Product>>(){});  
            if(canalMessage == null) return;  
  
            if("shop".equals(canalMessage.getDatabase()) && "product".equals(canalMessage.getTable())) {  
                String type = canalMessage.getType();  
                if("UPDATE".equals(type) || "DELETE".equals(type)) {  
                    for(Product product : canalMessage.getData()) {  
                        String productCacheKey = "product:" + product.getId();  
                        redisTemplate.delete(productCacheKey);  
                        log.info("异步清理缓存");  
                    }  
                    String allProductCacheKey = "products:all";  
                    redisTemplate.delete(allProductCacheKey);  
                    log.info("异步清理全局商品列表缓存: products:all");  
                }  
            }  
            channel.basicAck(deliveryTag, true);  
        } catch (Exception e) {  
            log.error(e.getMessage());  
            channel.basicNack(deliveryTag, false, true);  
        }  
    }  
}
```