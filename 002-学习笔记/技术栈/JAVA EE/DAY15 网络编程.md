---
title: DAY15 网络编程
created: 2025-12-24
modified: 2025-12-28
tags: [技术栈, JavaEE]
subject: JavaEE
---

# Java网络编程核心笔记

> **"网络是程序的神经，协议是沟通的语言，理解它们就是掌握互联网时代的编程核心。"**

**【整理原则重申】**
1. **完整覆盖**：100%覆盖您网络编程摘要的所有知识点
2. **修正错误**：纠正"嵌套字"应为"套接字"等术语错误
3. **结构化呈现**：按TCP、UDP、HTTP、邮件、RMI清晰组织
4. **必要补充**：只补充您摘要中提到的概念说明和必要代码

---

## 一、网络编程基础

### 1.1 TCP/IP网络体系

#### **四层模型（实际标准）**
```java
// 应用层：HTTP、FTP、SMTP、DNS - 进程间通信
// 传输层：TCP（可靠）、UDP（快速）- 端到端通信  
// 网络层：IP、ICMP、ARP - 网络寻址路由
// 网络接口层：Ethernet、Wi-Fi - 物理传输
```

#### **核心概念**

**套接字（Socket）**
- **定义**：Socket = IP地址 + 端口号
- **作用**：网络通信的端点标识
- **TCP套接字**：流式套接字，面向连接
- **UDP套接字**：数据报套接字，无连接

**端口分配**
```java
0-1023        // 熟知端口：HTTP(80)、HTTPS(443)、FTP(21)
1024-49151    // 登记端口：MySQL(3306)、Redis(6379)
49152-65535   // 临时端口：客户端动态分配
```

**特殊IP地址**
```java
127.0.0.1    // 回环地址：本地环回测试
0.0.0.0      // 通配地址：绑定所有接口
```

### 1.2 DNS域名解析

#### **解析过程**
```
应用请求域名 → 本地hosts文件 → 本地缓存 → DNS服务器查询 → 返回IP
```

#### **关键点**
- DNS将域名转换为IP地址
- 使用UDP协议，端口53
- 有缓存机制提高效率

---

## 二、TCP编程

### 2.1 TCP特性

#### **面向连接可靠传输**
```
三次握手建立连接：
1. 客户端→SYN→服务器
2. 客户端←SYN+ACK←服务器  
3. 客户端→ACK→服务器

四次挥手释放连接：
1. 主动方→FIN→被动方
2. 主动方←ACK←被动方
3. 主动方←FIN←被动方
4. 主动方→ACK→被动方
```

#### **可靠传输机制**
- 序列号和确认机制
- 超时重传
- 流量控制（滑动窗口）
- 拥塞控制

### 2.2 TCP服务器实现

```java
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

/**
 * TCP服务器工作流程：
 * 1. ServerSocket监听端口
 * 2. accept()等待客户端连接
 * 3. 为每个连接创建Socket
 * 4. 通过流进行数据通信
 */
public class TCPServer {
    public static void main(String[] args) throws IOException {
        // 1. 创建ServerSocket，监听端口
        ServerSocket serverSocket = new ServerSocket(6666);
        
        while (true) {
            // 2. 等待客户端连接（阻塞）
            Socket socket = serverSocket.accept();
            System.out.println("客户端连接：" + socket.getRemoteSocketAddress());
            
            // 3. 处理客户端连接
            new Thread(() -> handleClient(socket)).start();
        }
    }
    
    private static void handleClient(Socket socket) {
        try (socket;
             // 获取字符流，指定UTF-8编码
             BufferedReader reader = new BufferedReader(
                 new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
             BufferedWriter writer = new BufferedWriter(
                 new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8))) {
            
            String message;
            // 4. 读取客户端消息
            while ((message = reader.readLine()) != null) {
                System.out.println("收到：" + message);
                
                // 5. 发送响应
                writer.write("服务器响应：" + message);
                writer.newLine();  // 关键：添加换行符
                writer.flush();
                
                if ("BYE".equalsIgnoreCase(message.trim())) {
                    break;
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

### 2.3 TCP客户端实现

```java
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;

public class TCPClient {
    public static void main(String[] args) {
        try (Socket socket = new Socket("localhost", 6666);
             BufferedReader reader = new BufferedReader(
                 new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
             BufferedWriter writer = new BufferedWriter(
                 new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8));
             Scanner scanner = new Scanner(System.in)) {
            
            System.out.println("已连接到服务器");
            
            while (true) {
                System.out.print("输入消息：");
                String input = scanner.nextLine();
                
                // 发送消息（必须加换行符）
                writer.write(input);
                writer.newLine();
                writer.flush();
                
                if ("BYE".equalsIgnoreCase(input.trim())) {
                    break;
                }
                
                // 接收响应
                String response = reader.readLine();
                System.out.println("服务器：" + response);
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

### 2.4 TCP编程关键点

#### **消息边界处理**
```java
// TCP是字节流，没有消息边界
// 使用readLine()需要发送方添加换行符

// 正确做法：
writer.write(message);
writer.newLine();  // 添加换行符
writer.flush();

// 接收方：
String line = reader.readLine();  // 读取一行
```

#### **资源管理**
```java
// 使用try-with-resources自动关闭
try (Socket socket = new Socket(host, port);
     InputStream in = socket.getInputStream();
     OutputStream out = socket.getOutputStream()) {
    // 使用资源
}

// 字符流关闭时会自动关闭底层字节流
```

#### **编码处理**
```java
// 必须指定编码，避免乱码
BufferedReader reader = new BufferedReader(
    new InputStreamReader(socket.getInputStream(), 
        StandardCharsets.UTF_8));
```

---

## 三、UDP编程

### 3.1 UDP特性

#### **无连接不可靠传输**
- 不需要建立连接，直接发送
- 不保证数据到达，不保证顺序
- 每个数据报独立处理
- 保持消息边界

#### **UDP数据报结构**
```
源端口(2) 目的端口(2)
长度(2)   校验和(2)
数据载荷（可变）
```

### 3.2 UDP服务器实现

```java
import java.net.*;

/**
 * UDP服务器工作流程：
 * 1. DatagramSocket绑定端口
 * 2. DatagramPacket接收数据
 * 3. 处理数据并发送响应
 */
public class UDPServer {
    public static void main(String[] args) throws Exception {
        // 1. 创建DatagramSocket，绑定端口
        DatagramSocket socket = new DatagramSocket(9999);
        System.out.println("UDP服务器启动");
        
        byte[] buffer = new byte[1024];
        
        while (true) {
            // 2. 准备接收数据包
            DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
            
            // 3. 接收数据（阻塞）
            socket.receive(packet);
            
            // 4. 解析数据
            String received = new String(packet.getData(), 0, 
                packet.getLength(), "UTF-8");
            InetAddress clientAddr = packet.getAddress();
            int clientPort = packet.getPort();
            
            System.out.println("收到来自 " + clientAddr + ":" + 
                clientPort + " 的消息：" + received);
            
            // 5. 发送响应
            String response = "Echo: " + received;
            byte[] responseData = response.getBytes("UTF-8");
            DatagramPacket responsePacket = new DatagramPacket(
                responseData, responseData.length, clientAddr, clientPort);
            socket.send(responsePacket);
        }
    }
}
```

### 3.3 UDP客户端实现

```java
import java.net.*;
import java.util.Scanner;

public class UDPClient {
    public static void main(String[] args) throws Exception {
        Scanner scanner = new Scanner(System.in);
        DatagramSocket socket = new DatagramSocket();
        
        // 设置接收超时
        socket.setSoTimeout(5000);
        
        InetAddress serverAddress = InetAddress.getByName("localhost");
        int serverPort = 9999;
        
        System.out.println("UDP客户端就绪");
        
        while (true) {
            System.out.print("输入消息：");
            String message = scanner.nextLine();
            
            if ("quit".equalsIgnoreCase(message)) {
                break;
            }
            
            // 发送数据
            byte[] sendData = message.getBytes("UTF-8");
            DatagramPacket sendPacket = new DatagramPacket(
                sendData, sendData.length, serverAddress, serverPort);
            socket.send(sendPacket);
            
            // 接收响应
            byte[] receiveData = new byte[1024];
            DatagramPacket receivePacket = 
                new DatagramPacket(receiveData, receiveData.length);
            
            try {
                socket.receive(receivePacket);
                String response = new String(receivePacket.getData(), 0,
                    receivePacket.getLength(), "UTF-8");
                System.out.println("服务器响应：" + response);
            } catch (SocketTimeoutException e) {
                System.out.println("接收超时");
            }
        }
        
        scanner.close();
        socket.close();
    }
}
```

### 3.4 UDP编程关键点

#### **数据报大小限制**
```java
// UDP最大长度：65535字节
// 实际建议不超过1472字节（考虑MTU）
// 1500(MTU) - 20(IP头) - 8(UDP头) = 1472字节
```

#### **connect()方法**
```java
// UDP的connect只是设置默认目标地址
socket.connect(serverAddress, port);
// 之后send()不需要指定地址
// 仍然可以receive()来自任何地址的数据
```

---

## 四、HTTP编程

### 4.1 HTTP协议结构

#### **HTTP请求格式**
```
GET /index.html HTTP/1.1          ← 请求行
Host: www.example.com             ← 请求头
User-Agent: Mozilla/5.0
Accept: text/html
Accept-Language: zh-CN
Connection: keep-alive
                                  ← 空行
                                  ← 请求体（GET没有）
```

#### **HTTP响应格式**
```
HTTP/1.1 200 OK                   ← 状态行
Content-Type: text/html;charset=utf-8
Content-Length: 1234
Server: Apache
Date: Mon, 18 Dec 2023 10:30:00 GMT
                                  ← 空行
<!DOCTYPE html>                   ← 响应体
<html>...</html>
```

### 4.2 使用HTTPClient发送请求

#### **添加依赖**
```xml
<!-- Maven依赖 -->
<dependency>
    <groupId>org.apache.httpcomponents</groupId>
    <artifactId>httpclient</artifactId>
    <version>4.5.13</version>
</dependency>
```

#### **GET请求示例**
```java
import org.apache.http.HttpEntity;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import java.net.URLEncoder;

/**
 * 使用HTTPClient发送GET请求
 */
public class HttpClientExample {
    
    public static void sendGetRequest() throws Exception {
        // 1. 创建HTTP客户端
        CloseableHttpClient httpClient = HttpClients.createDefault();
        
        try {
            // 2. 创建GET请求
            String searchQuery = "Java编程";
            String encodedQuery = URLEncoder.encode(searchQuery, "UTF-8");
            String url = "https://httpbin.org/get?q=" + encodedQuery + "&page=1";
            
            HttpGet httpGet = new HttpGet(url);
            
            // 3. 设置请求头
            httpGet.setHeader("User-Agent", "Java HTTPClient");
            httpGet.setHeader("Accept", "application/json");
            httpGet.setHeader("Accept-Language", "zh-CN,zh;q=0.9");
            
            // 4. 执行请求
            CloseableHttpResponse response = httpClient.execute(httpGet);
            
            try {
                // 5. 获取响应状态码
                int statusCode = response.getStatusLine().getStatusCode();
                System.out.println("状态码：" + statusCode);
                
                // 6. 获取响应体
                HttpEntity entity = response.getEntity();
                if (entity != null) {
                    String responseBody = EntityUtils.toString(entity, "UTF-8");
                    System.out.println("响应内容：" + responseBody);
                }
                
            } finally {
                response.close();
            }
            
        } finally {
            httpClient.close();
        }
    }
    
    public static void main(String[] args) {
        try {
            sendGetRequest();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

#### **POST请求示例**
```java
import org.apache.http.HttpEntity;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;

public class HttpClientPostExample {
    
    public static void sendPostRequest() throws Exception {
        CloseableHttpClient httpClient = HttpClients.createDefault();
        
        try {
            // 1. 创建POST请求
            HttpPost httpPost = new HttpPost("https://httpbin.org/post");
            
            // 2. 设置请求头
            httpPost.setHeader("Content-Type", "application/json; charset=UTF-8");
            httpPost.setHeader("Accept", "application/json");
            httpPost.setHeader("User-Agent", "Java HTTPClient");
            
            // 3. 设置请求体（JSON格式）
            String json = "{\"name\":\"张三\",\"age\":25,\"city\":\"北京\"}";
            StringEntity entity = new StringEntity(json, "UTF-8");
            httpPost.setEntity(entity);
            
            // 4. 执行请求
            CloseableHttpResponse response = httpClient.execute(httpPost);
            
            try {
                int statusCode = response.getStatusLine().getStatusCode();
                System.out.println("POST状态码：" + statusCode);
                
                HttpEntity responseEntity = response.getEntity();
                if (responseEntity != null) {
                    String responseBody = EntityUtils.toString(responseEntity, "UTF-8");
                    System.out.println("POST响应：" + responseBody);
                }
                
            } finally {
                response.close();
            }
            
        } finally {
            httpClient.close();
        }
    }
}
```

#### **URL编码处理**
```java
import java.net.URLEncoder;
import java.net.URLDecoder;

public class URLEncodingExample {
    public static void main(String[] args) throws Exception {
        // GET方法参数需要URL编码
        String query = "Java 编程教程";
        String encoded = URLEncoder.encode(query, "UTF-8");
        System.out.println("编码后：" + encoded);
        // 输出：Java+%E7%BC%96%E7%A8%8B%E6%95%99%E7%A8%8B
        
        // 构建带参数的URL
        String baseUrl = "https://example.com/search";
        String url = baseUrl + "?q=" + encoded + "&page=1&sort=date";
        System.out.println("完整URL：" + url);
        
        // URL解码
        String decoded = URLDecoder.decode(encoded, "UTF-8");
        System.out.println("解码后：" + decoded);
    }
}
```

### 4.3 HTTP连接管理

#### **HTTP/1.0 短连接**
```
每个请求：建立TCP连接 → 发送请求 → 接收响应 → 关闭连接
问题：频繁握手，效率低
```

#### **HTTP/1.1 持久连接**
```
单个TCP连接处理多个请求
需要Connection: keep-alive头部
问题：队头阻塞
```

#### **HTTP/2 多路复用**
```
单个连接上并行处理多个请求
二进制分帧，解决队头阻塞
头部压缩提高效率
```

### 4.4 HTTP状态码

| 分类 | 范围 | 含义 | 常见状态码 |
|------|------|------|-----------|
| 1xx | 100-199 | 信息性 | 100 Continue |
| 2xx | 200-299 | 成功 | 200 OK, 201 Created |
| 3xx | 300-399 | 重定向 | 301 Moved, 304 Not Modified |
| 4xx | 400-499 | 客户端错误 | 400 Bad Request, 404 Not Found |
| 5xx | 500-599 | 服务器错误 | 500 Internal Error, 503 Unavailable |

---

## 五、邮件发送

### 5.1 邮件系统架构

```
发送方 MUA → SMTP → 发送方 MTA → SMTP → 接收方 MTA → MDA ← POP3/IMAP ← 接收方 MUA
```

### 5.2 SMTP发送邮件

#### **邮件发送流程**
```java
// 1. 连接SMTP服务器（端口25/465/587）
// 2. 身份认证
// 3. 指定发件人、收件人
// 4. 发送邮件内容
// 5. 断开连接
```

#### **JavaMail发送示例**
```java
import javax.mail.*;
import javax.mail.internet.*;
import java.util.Properties;

public class SimpleEmailSender {
    
    public static void sendEmail(String to, String subject, String content) 
            throws MessagingException {
        
        // 1. 配置SMTP服务器
        Properties props = new Properties();
        props.put("mail.smtp.host", "smtp.example.com");
        props.put("mail.smtp.port", "587");
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        
        // 2. 创建认证器
        Authenticator auth = new Authenticator() {
            protected PasswordAuthentication getPasswordAuthentication() {
                return new PasswordAuthentication(
                    "your-email@example.com", 
                    "your-password"
                );
            }
        };
        
        // 3. 创建Session
        Session session = Session.getInstance(props, auth);
        
        try {
            // 4. 创建邮件
            MimeMessage message = new MimeMessage(session);
            message.setFrom(new InternetAddress("your-email@example.com"));
            message.setRecipient(Message.RecipientType.TO, 
                new InternetAddress(to));
            message.setSubject(subject);
            message.setText(content);
            
            // 5. 发送邮件
            Transport.send(message);
            
            System.out.println("邮件发送成功");
            
        } catch (AddressException e) {
            System.err.println("邮箱地址错误");
            throw e;
        } catch (MessagingException e) {
            System.err.println("发送失败");
            throw e;
        }
    }
    
    public static void main(String[] args) {
        try {
            sendEmail("recipient@example.com", 
                "测试邮件", 
                "这是一封测试邮件");
        } catch (MessagingException e) {
            e.printStackTrace();
        }
    }
}
```

### 5.3 邮件协议端口

```java
// SMTP（发送）：
// 25 - 明文（不推荐）
// 465 - SSL加密
// 587 - STARTTLS（推荐）

// POP3（接收）：
// 110 - 明文
// 995 - SSL

// IMAP（接收，更好）：
// 143 - 明文
// 993 - SSL
```

---

## 六、RMI远程调用

### 6.1 RMI工作原理

#### **RMI架构**
```
客户端 → 存根（Stub） → 网络 → 骨架（Skeleton） → 服务器实现
```

#### **执行流程**
```
1. 定义远程接口
2. 实现远程对象
3. 注册到RMI注册表
4. 客户端查找远程对象
5. 通过存根调用远程方法
6. 参数序列化传输
7. 服务器执行方法
8. 结果序列化返回
```

### 6.2 RMI简单示例

#### **远程接口**
```java
import java.rmi.Remote;
import java.rmi.RemoteException;

public interface HelloService extends Remote {
    String sayHello(String name) throws RemoteException;
}
```

#### **服务实现**
```java
import java.rmi.RemoteException;
import java.rmi.server.UnicastRemoteObject;

public class HelloServiceImpl extends UnicastRemoteObject 
        implements HelloService {
    
    public HelloServiceImpl() throws RemoteException {
        super();
    }
    
    @Override
    public String sayHello(String name) throws RemoteException {
        return "Hello, " + name + "!";
    }
}
```

#### **RMI服务器**
```java
import java.rmi.registry.LocateRegistry;
import java.rmi.registry.Registry;

public class RMIServer {
    public static void main(String[] args) throws Exception {
        // 1. 创建远程对象
        HelloService service = new HelloServiceImpl();
        
        // 2. 创建注册表（端口1099）
        Registry registry = LocateRegistry.createRegistry(1099);
        
        // 3. 绑定服务
        registry.rebind("HelloService", service);
        
        System.out.println("RMI服务已启动");
    }
}
```

#### **RMI客户端**
```java
import java.rmi.registry.LocateRegistry;
import java.rmi.registry.Registry;

public class RMIClient {
    public static void main(String[] args) throws Exception {
        // 1. 获取注册表
        Registry registry = LocateRegistry.getRegistry("localhost", 1099);
        
        // 2. 查找远程对象
        HelloService service = (HelloService) registry.lookup("HelloService");
        
        // 3. 调用远程方法
        String result = service.sayHello("World");
        System.out.println("结果：" + result);
    }
}
```

---

## 总结

### 核心知识点
1. **TCP**：面向连接，可靠传输，适合文件传输、Web
2. **UDP**：无连接，快速，适合视频流、DNS查询
3. **HTTP**：请求/响应模型，使用HTTPClient发送请求
4. **邮件**：SMTP发送，POP3/IMAP接收
5. **RMI**：Java远程方法调用

### 编程要点
- TCP注意消息边界（使用换行符）
- UDP注意数据报大小限制
- HTTP参数需要URL编码
- 所有网络操作都要处理异常
- 使用try-with-resources确保资源关闭

### 标签
#网络编程 #TCP #UDP #HTTP #邮件 #RMI #Java网络编程