---
created: 2026-03-04
modified: 2026-03-04
---
## 背景问题

`application.yml` 里能配置端口、数据库连接这些框架级的东西，但如果你想在**启动时执行一段自己的业务代码**（比如把数据库里的字典数据加载到内存），配置文件做不到，需要用代码钩子。

---

## 两种解决方案

**ApplicationRunner**

```java
@Component
public class MyApplicationRunner implements ApplicationRunner {
    @Override
    public void run(ApplicationArguments args) throws Exception {
        // SpringBoot 启动完成后自动执行这里
        System.out.println("初始化数据...");
    }
}
```

**CommandLineRunner**

```java
@Component
public class MyCommandLineRunner implements CommandLineRunner {
    @Override
    public void run(String... args) throws Exception {
        System.out.println("初始化数据...");
    }
}
```

两者几乎一样，区别只是 `run` 方法参数类型不同：

- `ApplicationRunner` → 参数是封装好的 `ApplicationArguments` 对象，更好解析
- `CommandLineRunner` → 参数是原始字符串数组 `String[]`

参数的含义本质上是 java 运行时的命令行参数

```bash
java -jar myapp.jar --port=8080 --env=prod debug verbose
```


`CommandLineRunner` 方式
```java
// 收到的就是原始字符串数组，自己解析
public void run(String... args) {
    // args = ["--port=8080", "--env=prod", "debug", "verbose"]
    for (String arg : args) {
        System.out.println(arg);
    }
}
```

`ApplicationRunner` 方式
```java
public void run(ApplicationArguments args) {
    // 获取所有选项参数的 key
    args.getOptionNames();           // → [port, env]
    
    // 获取某个选项的值
    args.getOptionValues("port");    // → ["8080"]
    args.getOptionValues("env");     // → ["prod"]
    
    // 获取非选项参数
    args.getNonOptionArgs();         // → ["debug", "verbose"]
}
```

---

## 执行时机

```
SpringBoot 启动
    ↓
扫描 Bean、初始化容器（IoC）
    ↓
所有 Bean 都准备好了
    ↓
callRunners()  ← 在这里执行你的初始化代码
    ↓
main 方法结束，应用正式对外服务
```

也就是说这时候 `@Autowired` 注入的东西全都可以用了，可以放心调用 Service、操作数据库。

---

## 多个 Runner 的执行顺序

用 `@Order` 注解控制：

```java
@Component
@Order(1)  // 数字越小越先执行
public class FirstRunner implements ApplicationRunner { ... }

@Component
@Order(2)
public class SecondRunner implements ApplicationRunner { ... }
```

默认情况下 `ApplicationRunner` 比 `CommandLineRunner` 先执行。

---

## 一句话总结

> 实现 `ApplicationRunner` 或 `CommandLineRunner` 接口，加上 `@Component`，SpringBoot 启动完成后就会自动调用你的 `run` 方法，适合做数据预加载、缓存初始化等启动任务。