---
title: DAY14 Maven基础
created: 2025-12-22
modified: 2025-12-28
tags: [技术栈, JavaEE]
subject: JavaEE
---
# Maven 项目管理工具

> **"优秀的工匠不会责怪他的工具，而是精通它。"** — 在软件开发中，精通构建工具就是高效交付的基石。

**【整理原则重申】**
1. **完整覆盖**：确保100%覆盖原始摘要的所有知识点，不丢弃、不擅自概括
2. **修正错误**：对可能的错误或易混淆点进行指正和说明
3. **结构化呈现**：将内容重新组织为逻辑清晰、层次分明的格式
4. **必要补充**：在完全覆盖原始要点的基础上，扩展关键概念和最佳实践

---

## 一、Maven 核心功能

### 1.1 三大核心能力
Maven 作为 Apache 基金会下的开源项目构建与管理工具，主要提供以下三方面核心能力：

1. **标准化项目结构**
   - 采用"约定优于配置"原则
   - 统一项目目录布局
   - 便于 IDE 识别和团队协作

2. **标准化构建流程**
   - 预定义完整的项目生命周期
   - 支持自动化构建：清理、编译、测试、打包、部署
   - 可复用的构建配置

3. **强大的依赖管理**
   - 自动下载和管理项目依赖
   - 处理依赖传递和冲突
   - 中央仓库和镜像机制

---

## 二、项目结构规范

### 2.1 标准目录布局
```
hello-maven/
├── pom.xml                    # 项目对象模型配置文件
├── src/
│   ├── main/
│   │   ├── java/             # 主程序Java源代码
│   │   │   └── com/example/
│   │   │       └── App.java
│   │   ├── resources/        # 主程序资源文件
│   │   │   └── application.properties
│   │   └── webapp/          # Web应用资源（Web项目）
│   └── test/
│       ├── java/             # 测试代码
│       │   └── com/example/
│       │       └── AppTest.java
│       └── resources/        # 测试资源
└── target/                   # 构建输出目录（自动生成）
```

### 2.2 目录结构说明
- **分离关注点**：源代码、资源文件、测试代码分离
- **环境适配**：resources目录支持不同环境配置文件
- **构建隔离**：target目录存放构建产物，便于清理

---

## 三、POM 配置文件详解

### 3.1 完整 POM 示例
```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    
    <!-- 模型版本（固定值） -->
    <modelVersion>4.0.0</modelVersion>
    
    <!-- 项目坐标：唯一标识 -->
    <groupId>com.example</groupId>
    <artifactId>hello-maven</artifactId>
    <version>1.0.0</version>
    
    <!-- 打包方式 -->
    <packaging>jar</packaging>
    
    <!-- 项目元数据 -->
    <name>Hello Maven Project</name>
    <description>A demo project to learn Maven</description>
    <url>http://www.example.com</url>
    
    <!-- 开发者信息 -->
    <developers>
        <developer>
            <name>John Doe</name>
            <email>john@example.com</email>
        </developer>
    </developers>
    
    <!-- 属性配置 -->
    <properties>
        <!-- 字符编码（必须设置） -->
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <project.reporting.outputEncoding>UTF-8</project.reporting.outputEncoding>
        
        <!-- Java版本配置（推荐使用release） -->
        <maven.compiler.release>17</maven.compiler.release>
        
        <!-- 项目相关版本 -->
        <junit.version>5.9.3</junit.version>
        <slf4j.version>2.0.7</slf4j.version>
        
        <!-- 构建相关 -->
        <maven.compiler.plugin.version>3.11.0</maven.compiler.plugin.version>
    </properties>
    
    <!-- 依赖管理 -->
    <dependencies>
        <!-- SLF4J 日志框架 -->
        <dependency>
            <groupId>org.slf4j</groupId>
            <artifactId>slf4j-api</artifactId>
            <version>${slf4j.version}</version>
        </dependency>
        <dependency>
            <groupId>org.slf4j</groupId>
            <artifactId>slf4j-simple</artifactId>
            <version>${slf4j.version}</version>
        </dependency>
        
        <!-- JUnit 5 测试框架 -->
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>${junit.version}</version>
            <scope>test</scope>
        </dependency>
        
        <!-- Apache Commons Lang3 -->
        <dependency>
            <groupId>org.apache.commons</groupId>
            <artifactId>commons-lang3</artifactId>
            <version>3.12.0</version>
        </dependency>
        
        <!-- MySQL驱动（运行时需要） -->
        <dependency>
            <groupId>mysql</groupId>
            <artifactId>mysql-connector-java</artifactId>
            <version>8.0.33</version>
            <scope>runtime</scope>
        </dependency>
    </dependencies>
    
    <!-- 构建配置 -->
    <build>
        <plugins>
            <!-- 编译器插件 -->
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>${maven.compiler.plugin.version}</version>
                <configuration>
                    <release>${maven.compiler.release}</release>
                    <encoding>${project.build.sourceEncoding}</encoding>
                    <showWarnings>true</showWarnings>
                    <showDeprecation>true</showDeprecation>
                </configuration>
            </plugin>
            
            <!-- 打包插件（创建可执行JAR） -->
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-jar-plugin</artifactId>
                <version>3.3.0</version>
                <configuration>
                    <archive>
                        <manifest>
                            <mainClass>com.example.App</mainClass>
                        </manifest>
                    </archive>
                </configuration>
            </plugin>
            
            <!-- 资源文件处理 -->
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-resources-plugin</artifactId>
                <version>3.3.1</version>
                <configuration>
                    <encoding>${project.build.sourceEncoding}</encoding>
                </configuration>
            </plugin>
        </plugins>
    </build>
    
</project>
```

### 3.2 重要配置说明

#### **项目坐标修正**
- **格式**：`groupId:artifactId:packaging:version`
- **示例**：`com.example:hello-maven:jar:1.0.0`
- **依赖引用**：`groupId:artifactId:version`

#### **属性配置要点**
1. **编码设置是必须的**：避免中文乱码问题
2. **Java版本配置**：
   ```xml
   <!-- 现代方式（Java 9+推荐） -->
   <maven.compiler.release>17</maven.compiler.release>
   
   <!-- 传统方式（Java 8及以下） -->
   <maven.compiler.source>1.8</maven.compiler.source>
   <maven.compiler.target>1.8</maven.compiler.target>
   ```

---

## 四、依赖管理深度解析

### 4.1 依赖作用域完整示例
```xml
<dependencies>
    <!-- compile（默认）：编译、测试、运行都需要 -->
    <dependency>
        <groupId>com.google.guava</groupId>
        <artifactId>guava</artifactId>
        <version>32.0.0-jre</version>
        <!-- scope默认就是compile，可省略 -->
    </dependency>
    
    <!-- provided：编译和测试需要，运行时由容器提供 -->
    <dependency>
        <groupId>javax.servlet</groupId>
        <artifactId>javax.servlet-api</artifactId>
        <version>4.0.1</version>
        <scope>provided</scope>
        <!-- 说明：Tomcat等Servlet容器会提供此API -->
    </dependency>
    
    <!-- runtime：运行时需要，编译时不需要 -->
    <dependency>
        <groupId>mysql</groupId>
        <artifactId>mysql-connector-java</artifactId>
        <version>8.0.33</version>
        <scope>runtime</scope>
        <!-- 说明：编译时用JDBC接口，运行时才需要具体驱动 -->
    </dependency>
    
    <!-- test：仅测试需要 -->
    <dependency>
        <groupId>org.junit.jupiter</groupId>
        <artifactId>junit-jupiter</artifactId>
        <version>5.9.3</version>
        <scope>test</scope>
    </dependency>
    
    <!-- system：系统路径依赖（不推荐） -->
    <dependency>
        <groupId>com.example</groupId>
        <artifactId>local-lib</artifactId>
        <version>1.0</version>
        <scope>system</scope>
        <systemPath>${project.basedir}/lib/local-lib.jar</systemPath>
    </dependency>
</dependencies>
```

### 4.2 依赖传递与冲突解决
```xml
<!-- 排除不需要的传递依赖 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <version>3.1.0</version>
    <exclusions>
        <!-- 排除Tomcat，使用Jetty -->
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-tomcat</artifactId>
        </exclusion>
    </exclusions>
</dependency>

<!-- 引入Jetty -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jetty</artifactId>
    <version>3.1.0</version>
</dependency>
```

### 4.3 依赖管理最佳实践
```xml
<!-- 1. 使用dependencyManagement统一管理版本 -->
<dependencyManagement>
    <dependencies>
        <!-- 导入Spring Boot BOM -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-dependencies</artifactId>
            <version>3.1.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<!-- 2. 子依赖无需指定版本 -->
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
        <!-- 版本从BOM继承 -->
    </dependency>
</dependencies>
```

---

## 五、生命周期与构建命令

### 5.1 完整生命周期阶段
```bash
# 清理生命周期
mvn pre-clean     # 执行清理前的工作
mvn clean         # 清理target目录
mvn post-clean    # 执行清理后的工作

# 默认生命周期（核心）
mvn validate      # 验证项目
mvn compile       # 编译主代码
mvn test-compile  # 编译测试代码
mvn test          # 运行单元测试
mvn package       # 打包（jar/war）
mvn verify        # 集成测试
mvn install       # 安装到本地仓库
mvn deploy        # 部署到远程仓库

# 站点生命周期
mvn pre-site      # 生成站点前
mvn site          # 生成项目站点
mvn post-site     # 生成站点后
mvn site-deploy   # 部署站点
```

### 5.2 常用命令组合
```bash
# 开发常用
mvn clean compile              # 清理并编译
mvn test                       # 运行所有测试
mvn clean package              # 清理并打包
mvn clean install              # 清理并安装到本地

# 测试相关
mvn test -Dtest=UserTest       # 运行特定测试类
mvn test -Dtest=UserTest#testCreate  # 运行特定测试方法
mvn test -DskipTests=true      # 跳过测试
mvn test -Dmaven.test.failure.ignore=true  # 忽略测试失败

# 依赖相关
mvn dependency:tree            # 查看依赖树
mvn dependency:analyze         # 分析依赖
mvn dependency:copy-dependencies -DoutputDirectory=lib  # 复制依赖

# 多模块构建
mvn clean install -pl module1 -am  # 构建module1及其依赖
mvn clean install -DskipTests -P production  # 生产环境构建
```

---

## 六、插件系统实战

### 6.1 常用插件配置示例
```xml
<build>
    <plugins>
        <!-- 1. 编译器插件（详细配置） -->
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-compiler-plugin</artifactId>
            <version>3.11.0</version>
            <configuration>
                <release>17</release>
                <encoding>UTF-8</encoding>
                <parameters>true</parameters> <!-- 保留参数名，便于反射 -->
                <compilerArgs>
                    <arg>-Xlint:all</arg>     <!-- 启用所有警告 -->
                    <arg>-Werror</arg>        <!-- 将警告视为错误 -->
                </compilerArgs>
            </configuration>
            <executions>
                <!-- 编译主代码 -->
                <execution>
                    <id>default-compile</id>
                    <phase>compile</phase>
                    <goals>
                        <goal>compile</goal>
                    </goals>
                </execution>
                <!-- 编译测试代码 -->
                <execution>
                    <id>default-testCompile</id>
                    <phase>test-compile</phase>
                    <goals>
                        <goal>testCompile</goal>
                    </goals>
                </execution>
            </executions>
        </plugin>
        
        <!-- 2. 测试插件 -->
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-surefire-plugin</artifactId>
            <version>3.0.0</version>
            <configuration>
                <includes>
                    <include>**/*Test.java</include>
                    <include>**/*Tests.java</include>
                </includes>
                <excludes>
                    <exclude>**/*IntegrationTest.java</exclude>
                </excludes>
                <systemPropertyVariables>
                    <environment>test</environment>
                </systemPropertyVariables>
                <argLine>-Xmx512m</argLine> <!-- 测试JVM参数 -->
            </configuration>
        </plugin>
        
        <!-- 3. 创建源码JAR -->
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-source-plugin</artifactId>
            <version>3.2.1</version>
            <executions>
                <execution>
                    <id>attach-sources</id>
                    <phase>package</phase>
                    <goals>
                        <goal>jar-no-fork</goal>
                    </goals>
                </execution>
            </executions>
        </plugin>
        
        <!-- 4. 创建Javadoc JAR -->
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-javadoc-plugin</artifactId>
            <version>3.5.0</version>
            <executions>
                <execution>
                    <id>attach-javadocs</id>
                    <phase>package</phase>
                    <goals>
                        <goal>jar</goal>
                    </goals>
                    <configuration>
                        <doclint>none</doclint> <!-- 关闭严格检查 -->
                    </configuration>
                </execution>
            </executions>
        </plugin>
    </plugins>
</build>
```

---

## 七、综合实战示例

### 7.1 完整项目示例代码

#### **项目结构**
```
maven-demo/
├── pom.xml
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/example/
│   │   │       ├── App.java
│   │   │       ├── service/
│   │   │       │   ├── UserService.java
│   │   │       │   └── impl/
│   │   │       │       └── UserServiceImpl.java
│   │   │       ├── model/
│   │   │       │   └── User.java
│   │   │       └── util/
│   │   │           └── StringUtils.java
│   │   └── resources/
│   │       ├── application.properties
│   │       └── logback.xml
│   └── test/
│       ├── java/
│       │   └── com/example/
│       │       ├── AppTest.java
│       │       └── service/
│       │           └── UserServiceTest.java
│       └── resources/
│           └── test-data.json
└── README.md
```

#### **App.java - 主类**
```java
package com.example;

import com.example.model.User;
import com.example.service.UserService;
import com.example.service.impl.UserServiceImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.apache.commons.lang3.StringUtils;

public class App {
    private static final Logger logger = LoggerFactory.getLogger(App.class);
    private final UserService userService = new UserServiceImpl();
    
    public static void main(String[] args) {
        App app = new App();
        app.run();
    }
    
    private void run() {
        logger.info("Maven Demo Application Starting...");
        
        // 使用 Apache Commons Lang3
        String text = "  Hello Maven  ";
        String trimmed = StringUtils.trim(text);
        System.out.println("Trimmed: '" + trimmed + "'");
        
        // 创建用户
        User user = new User("john_doe", "john@example.com");
        userService.createUser(user);
        
        // 查找用户
        User found = userService.findUser("john_doe");
        if (found != null) {
            System.out.println("Found user: " + found.getUsername());
        }
        
        logger.info("Application Finished");
    }
}
```

#### **User.java - 模型类**
```java
package com.example.model;

public class User {
    private String username;
    private String email;
    
    public User() {}
    
    public User(String username, String email) {
        this.username = username;
        this.email = email;
    }
    
    // Getter和Setter
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    
    @Override
    public String toString() {
        return "User{username='" + username + "', email='" + email + "'}";
    }
}
```

#### **UserService.java - 服务接口**
```java
package com.example.service;

import com.example.model.User;

public interface UserService {
    void createUser(User user);
    User findUser(String username);
    boolean deleteUser(String username);
}
```

#### **UserServiceImpl.java - 服务实现**
```java
package com.example.service.impl;

import com.example.model.User;
import com.example.service.UserService;
import java.util.HashMap;
import java.util.Map;

public class UserServiceImpl implements UserService {
    private final Map<String, User> userStore = new HashMap<>();
    
    @Override
    public void createUser(User user) {
        if (user == null || user.getUsername() == null) {
            throw new IllegalArgumentException("User cannot be null");
        }
        userStore.put(user.getUsername(), user);
    }
    
    @Override
    public User findUser(String username) {
        return userStore.get(username);
    }
    
    @Override
    public boolean deleteUser(String username) {
        return userStore.remove(username) != null;
    }
}
```

#### **StringUtils.java - 工具类**
```java
package com.example.util;

public class StringUtils {
    /**
     * 检查字符串是否为空或null
     */
    public static boolean isEmpty(String str) {
        return str == null || str.trim().isEmpty();
    }
    
    /**
     * 将字符串转换为大写
     */
    public static String toUpperCase(String str) {
        return str != null ? str.toUpperCase() : null;
    }
}
```

#### **AppTest.java - 单元测试**
```java
package com.example;

import com.example.model.User;
import com.example.service.UserService;
import com.example.service.impl.UserServiceImpl;
import com.example.util.StringUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;

class AppTest {
    private UserService userService;
    
    @BeforeEach
    void setUp() {
        userService = new UserServiceImpl();
    }
    
    @Test
    @DisplayName("测试用户创建和查找")
    void testUserCreationAndRetrieval() {
        // 准备测试数据
        User user = new User("testuser", "test@example.com");
        
        // 执行操作
        userService.createUser(user);
        User found = userService.findUser("testuser");
        
        // 验证结果
        assertNotNull(found);
        assertEquals("testuser", found.getUsername());
        assertEquals("test@example.com", found.getEmail());
    }
    
    @Test
    @DisplayName("测试删除用户")
    void testDeleteUser() {
        User user = new User("todelete", "delete@example.com");
        userService.createUser(user);
        
        boolean deleted = userService.deleteUser("todelete");
        assertTrue(deleted);
        assertNull(userService.findUser("todelete"));
    }
    
    @Test
    @DisplayName("测试工具类方法")
    void testStringUtils() {
        assertTrue(StringUtils.isEmpty(null));
        assertTrue(StringUtils.isEmpty(""));
        assertTrue(StringUtils.isEmpty("   "));
        assertFalse(StringUtils.isEmpty("Hello"));
        
        assertEquals("HELLO", StringUtils.toUpperCase("hello"));
        assertNull(StringUtils.toUpperCase(null));
    }
    
    @Test
    @DisplayName("测试空用户创建应抛出异常")
    void testCreateUserWithNullShouldThrowException() {
        assertThrows(IllegalArgumentException.class, () -> {
            userService.createUser(null);
        });
    }
}
```

#### **application.properties - 配置文件**
```properties
# 应用配置
app.name=Maven Demo
app.version=1.0.0
app.environment=development

# 日志配置
logging.level.com.example=DEBUG
logging.level.root=INFO

# 数据库配置（示例）
db.url=jdbc:mysql://localhost:3306/demo
db.username=root
db.password=secret
db.driver=com.mysql.cj.jdbc.Driver
```

#### **logback.xml - 日志配置**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>
    
    <appender name="FILE" class="ch.qos.logback.core.FileAppender">
        <file>logs/application.log</file>
        <append>true</append>
        <encoder>
            <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>
    
    <root level="INFO">
        <appender-ref ref="CONSOLE" />
        <appender-ref ref="FILE" />
    </root>
    
    <logger name="com.example" level="DEBUG" />
</configuration>
```

---

## 八、配套练习代码

### 练习1：修复有问题的POM配置
```xml
<!-- 以下POM配置存在多个问题，请找出并修复 -->
<project>
    <modelVersion>4.0.0</modelVersion>
    
    <!-- 问题1：groupId不符合规范 -->
    <groupId>myproject</groupId>
    
    <!-- 问题2：版本号格式不规范 -->
    <artifactId>demo-app</artifactId>
    <version>v1.0</version>
    
    <properties>
        <!-- 问题3：缺少必要配置 -->
        <java.version>17</java.version>
    </properties>
    
    <dependencies>
        <dependency>
            <!-- 问题4：坐标不完整 -->
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <!-- 问题5：scope配置错误 -->
            <scope>compile</scope>
        </dependency>
        
        <dependency>
            <groupId>mysql</groupId>
            <artifactId>mysql-connector-java</artifactId>
            <version>8.0.33</version>
            <!-- 问题6：scope应该是什么？ -->
            <scope>compile</scope>
        </dependency>
    </dependencies>
    
    <build>
        <plugins>
            <!-- 问题7：编译器插件缺少必要配置 -->
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

### 练习2：多模块项目配置
```xml
<!-- parent-pom.xml -->
<!-- 任务：创建父POM，管理两个子模块：common和webapp -->
<!-- 要求：
1. 父POM的packaging为pom
2. 统一管理依赖版本
3. common模块包含工具类
4. webapp模块依赖common模块
-->

<!-- 你的实现 -->
```

### 练习3：自定义构建配置
```xml
<!-- 任务：配置Maven实现以下构建要求 -->
<!--
要求：
1. 编译Java 17代码，启用所有警告
2. 跳过集成测试，但运行单元测试
3. 打包时包含源码和javadoc
4. 生产环境构建时排除开发依赖
5. 创建可执行的fat jar
-->
```

### 练习4：命令行操作
```bash
# 任务：写出实现以下需求的Maven命令

# 1. 只编译项目，不运行测试
# 你的命令：

# 2. 运行特定的测试类 UserServiceTest
# 你的命令：

# 3. 查看项目的完整依赖树
# 你的命令：

# 4. 清理并打包，跳过测试
# 你的命令：

# 5. 将依赖复制到lib目录
# 你的命令：

# 6. 多模块项目中，只构建webapp模块及其依赖
# 你的命令：
```

---

## 九、答案与最佳实践

### 练习1答案：
```xml
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <!-- 修复1：groupId使用域名倒序 -->
    <groupId>com.example</groupId>
    
    <artifactId>demo-app</artifactId>
    <!-- 修复2：版本号去掉v前缀 -->
    <version>1.0.0</version>
    
    <properties>
        <!-- 修复3：添加编码和Java版本配置 -->
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <maven.compiler.release>17</maven.compiler.release>
        <java.version>17</java.version>
    </properties>
    
    <dependencies>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>5.9.3</version>
            <!-- 修复5：测试依赖使用test scope -->
            <scope>test</scope>
        </dependency>
        
        <dependency>
            <groupId>mysql</groupId>
            <artifactId>mysql-connector-java</artifactId>
            <version>8.0.33</version>
            <!-- 修复6：数据库驱动使用runtime scope -->
            <scope>runtime</scope>
        </dependency>
    </dependencies>
    
    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <!-- 修复7：配置编译器参数 -->
                <configuration>
                    <release>${maven.compiler.release}</release>
                    <encoding>${project.build.sourceEncoding}</encoding>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

### 练习2参考实现：
```xml
<!-- parent-pom.xml -->
<project>
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>parent-project</artifactId>
    <version>1.0.0</version>
    <packaging>pom</packaging>
    
    <modules>
        <module>common</module>
        <module>webapp</module>
    </modules>
    
    <properties>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <maven.compiler.release>17</maven.compiler.release>
        <junit.version>5.9.3</junit.version>
    </properties>
    
    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>org.junit.jupiter</groupId>
                <artifactId>junit-jupiter</artifactId>
                <version>${junit.version}</version>
                <scope>test</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>
</project>

<!-- common/pom.xml -->
<project>
    <parent>
        <groupId>com.example</groupId>
        <artifactId>parent-project</artifactId>
        <version>1.0.0</version>
    </parent>
    <artifactId>common</artifactId>
    
    <dependencies>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
        </dependency>
    </dependencies>
</project>

<!-- webapp/pom.xml -->
<project>
    <parent>
        <groupId>com.example</groupId>
        <artifactId>parent-project</artifactId>
        <version>1.0.0</version>
    </parent>
    <artifactId>webapp</artifactId>
    <packaging>war</packaging>
    
    <dependencies>
        <dependency>
            <groupId>com.example</groupId>
            <artifactId>common</artifactId>
            <version>${project.version}</version>
        </dependency>
    </dependencies>
</project>
```

### 练习3参考配置：
```xml
<build>
    <plugins>
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-compiler-plugin</artifactId>
            <version>3.11.0</version>
            <configuration>
                <release>17</release>
                <compilerArgs>
                    <arg>-Xlint:all</arg>
                    <arg>-Werror</arg>
                </compilerArgs>
            </configuration>
        </plugin>
        
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-surefire-plugin</artifactId>
            <version>3.0.0</version>
            <configuration>
                <excludes>
                    <exclude>**/*IntegrationTest.java</exclude>
                </excludes>
            </configuration>
        </plugin>
        
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-source-plugin</artifactId>
            <version>3.2.1</version>
            <executions>
                <execution>
                    <goals>
                        <goal>jar-no-fork</goal>
                    </goals>
                </execution>
            </executions>
        </plugin>
        
        <plugin>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-maven-plugin</artifactId>
            <version>3.1.0</version>
            <executions>
                <execution>
                    <goals>
                        <goal>repackage</goal>
                    </goals>
                </execution>
            </executions>
        </plugin>
    </plugins>
</build>

<profiles>
    <profile>
        <id>production</id>
        <dependencies>
            <!-- 生产环境排除开发依赖 -->
        </dependencies>
    </profile>
</profiles>
```

### 练习4答案：
```bash
# 1. 只编译项目，不运行测试
mvn compile -DskipTests

# 2. 运行特定的测试类 UserServiceTest
mvn test -Dtest=UserServiceTest

# 3. 查看项目的完整依赖树
mvn dependency:tree

# 4. 清理并打包，跳过测试
mvn clean package -DskipTests

# 5. 将依赖复制到lib目录
mvn dependency:copy-dependencies -DoutputDirectory=lib

# 6. 多模块项目中，只构建webapp模块及其依赖
mvn clean install -pl webapp -am
```

---

## 十、总结与标签

### 核心要点回顾
- ✅ **标准结构**：约定优于配置的项目布局
- ✅ **坐标定位**：groupId:artifactId:version 唯一标识
- ✅ **依赖管理**：作用域控制、传递依赖、冲突解决
- ✅ **生命周期**：clean/default/site 三套流程
- ✅ **插件系统**：goal绑定phase，扩展构建能力
- ✅ **Wrapper**：确保构建环境一致性

### 最佳实践
1. **始终设置编码**：避免乱码问题
2. **使用属性管理版本**：便于统一升级
3. **正确使用依赖作用域**：优化构建和运行
4. **多模块项目使用BOM**：统一依赖管理
5. **配置Maven Wrapper**：确保团队环境一致
