---
created: 2026-01-15
modified: 2026-02-21
---
## 导引

之前我们学习的部分都是 `JavaSE(Java Standard Edition)`，主要内容是基于`JDK`进行学习，当然也学习了如何使用 `maven` 引入日志的依赖，使用`XML`的`Java Bean`解析，和`JSON`的解析

```Java
JacksonXmlModule module = new JacksonModule();
XmlMapper mapper = new XmlMapper(module);
mapper.readValue()

ObjectMapper mapper = new ObjectMapper()
mapper.configure(DeserializationFeature. ...)
```

而本次学习的Web开发，则是属于 `JavaEE(Java Enterprise Edition)`，也就是Java的企业级开发。

> 至于有时候会了解到一个`JavaME`的概念，是`Java`在嵌入式的应用，用的比较少
> ![[Java教程-廖雪峰-2025-06-16.pdf#page=966&rect=19,456,182,589|Java教程-廖雪峰-2025-06-16, p.966]]

`JavaEE`并不是一款软件或是全新的语言，它是一种软件架构和设计思想，可以看作在`JavaSE`的基础上，开发的一系列基于服务器的组件、API标准和通用的架构。

其中最核心的组件是基于`Servlet`标准的Web服务器，程序是基于 `Servlet API`并且在服务器中运行。当然，除了 `Web` 服务的接口标准，`JavaEE`还包括了`JPA`数据访问规范，`JTA`事务管理标准。

> 核心组件是实现 `Servlet API` 的`Web`服务器，这体现的是 `JavaEE` 应用面向的主流场景是网络应用（Web应用）。服务器监听`80`端口，负责处理`HTTP`请求，进行业务逻辑处理，数据库访问和数据返回。
> 顺带一提，现在万维网越发流行，`B/S`架构愈发流行，本质就是浏览器充当原来的客户端角色，不过这个"客户端"的内容，都要从服务器请求得到，减轻了用户主机的存储压力，省地下载各种软件。不管是哪一种架构，都可能需要由远程地网络服务器来处理业务需求。


## Web 基础

在计算机网络中，我们已经学习到计算机网络的分层设计体系。

在运输层中，互联网可以提供面向连接的 `TCP` 传输服务，和面向无连接的 `UDP` 传输服务，这两种服务都实现了差错校验和复用分用。这里就先不详细展开差错校验方法，也不讨论两种服务封装的报文头部格式，或是`TCP`如何实现流量控制、拥塞控制、计时器管理。

运输层如何向应用层提供传输服务的复用和分用呢，也就是运输层提供的`SAP(服务访问点)`：端口。端口分为三种
	1. 熟知端口：服务器内部使用，通常是经常使用的、运行某种应用层协议的进程，通信双方心知肚明
	2. 登记端口：服务器内部使用，相对来说，这些端口对应的进程就是不会长期使用的，服务器需要告诉客户端端口，双方才能建立连接。比如 `FTP` 的被动数据连接，服务器就是把自己登记的一个端口告诉客户端，客户端发起连接
	3. 临时端口：客户端使用，用完之后，就废弃，可以被其他进程使用
应用层协议都是实现某些特定功能的网络应用，在传输数据时，通信双方遵循的通信规则。我们就以`HTTP`为例子
	现在的网络应用基本都使用这一协议来通信，通信的请求方，发出`HTTP`请求，通信的响应方，就进行`HTTP`响应。其中，请求和响应都会满足对应的格式要求，比如请求头和请求体、响应行和响应体。
	`HTTP`协议使用`TCP`的可靠连接，实现网络中的端到端通信，占用`80`端口。
	当使用浏览器，输入一个网址时，会使用`DNS`服务，向`DNS`服务器请求`IP`地址，然后向该`IP`地址发送`HTTP`请求(默认的端口是`80`)。服务器方，当收到一个`HTTP`请求，根据请求行中的`URL`，监听`80`端口的进程，会返回对应的内容，包装成响应体。
	浏览器方，收到`Web`服务器（监听80进程的主机）的响应数据，进行渲染，并根据资源需求进行后续请求

## 简单的Web服务器

一个进程监听80端口，当接收到嵌套字连接的时候，创建一个子线程来对连接进行处理，那么这个进程就可以称作一个简单的Web服务器。

而Web服务器，也是`JavaEE`最重要的组件，后续，我们会进一步将这个简陋的服务器进行封装，让代码编写者，在使用的时候，不需要对TCP的连接、关闭，输入流、输出流花费过多的精力，就可以便捷的使用`TCP`来传输`HTTP`数据

```Java
@Override  
public void run() {  
    try (Socket s = this.socket; // 确保 socket 最终被关闭  
         BufferedReader reader = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));  
         BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(s.getOutputStream(), StandardCharsets.UTF_8))) {  
  
        String firstLine = reader.readLine();  
        if (firstLine == null) return;  
  
        boolean requestOk = firstLine.startsWith("GET / HTTP/1.");  
  
        // 重要：读掉剩余的请求头，直到空行  
        String headerLine;  
        while ((headerLine = reader.readLine()) != null && !headerLine.isEmpty()) {  
            System.out.println(headerLine);  
        }  
  
        if (requestOk) {  
            String data = "<html><body><h1>Hello World!</h1></body></html>";  
            byte[] bytes = data.getBytes(StandardCharsets.UTF_8);  
  
            String response = """  
            HTTP/1.1 200 OK            Content-Type: text/html; charset=UTF-8            Content-Length: %d            Connection: close                        %s""".formatted(bytes.length, data).replace("\n", "\r\n");  
  
            writer.write(response);  
            writer.flush();  
        } else {  
            writer.write("HTTP/1.1 404 Not Found\r\n\r\n");  
            writer.flush();  
        }  
    } catch (IOException e) {  
        e.printStackTrace();  
    }  
}
```

> [!NOTE] 在`HTTP1.1`背景下的`readLine()`隐患
> 在`HTTP1.1`的版本中，引入了`TCP`的长连接，浏览器会复用一个`TCP`连接，用于请求和响应。
> `readLine()`读取的机制：只要没有读取到`EOF(End of File)`，就会一直读取，如果输入流中没有数据，会阻塞。
> 在长连接中，一次请求后，连接没有关闭，请求头中`Connection:keep-alive`默认开启。这就导致了，使用readLine读取输入流时，读取到最后，会因为没有读取到`EOF`，并且没有新的数据进入流，从而导致程序阻塞
> ==所以我们需要手动判断是否读取到空行，请求头和请求体中间是有空行的==
## Serlvet 入门

在上面这个简单的Web服务器中，通过基于多线程的编写的`TCP`服务器，在接收到`HTTP`请求之后，进行读取，发送响应，实现了`HTTP`的通信。

可以说，我们是在传输层的基础上编程的，需要模拟完整的应用层协议数据通信的格式要求，这是一件很麻烦的事情。所以简化的思路，就是加层封装，使得我们可以直接面向应用层编程，不需要关注应用层协议的数据格式（请求头和响应头），不用关注传输层如何读取数据，写入数据。

为了更好的了解现有的Web服务器的工作方式，我们先自己实现一个Servlet应用后端处理。
所谓地实现`JavaEE`接口规范的服务器，就是实现`Servlet API`接口的、能够处理`HTTP`请求和响应的线程。

1. `@WebServlet(urlPatterns = "/")`：注解类，表示类是一个`Servlet`，映射到`url`，也就是类能处理的`url`请求地址
2. 类继承`HttpServlet`：重写`doGet()`或者`doPost()`，来对不同方法的`Http`协议请求处理

![[Java教程-廖雪峰-2025-06-16.pdf#page=978&rect=39,334,411,450&color=note|Java教程-廖雪峰-2025-06-16, p.978]]
引入的包依赖如上，注意作用范围是`provided`编译时，这是因为在具体运行的时候，具体的已经实现的`Web`服务器本身已经持有API相关的jar包，换句话说，如果我们使用Tomcat作为Web服务器，在使用`Servlet API`调用的时候，只需要编译出的字节码，能找到方法引用，具体的方法内部代码，在服务器中包含了具体的方法jar包

那么如何运行我们自己写的`Servlet`呢。
	> 正常运行一个程序，我们需要启动一个JVM，运行main函数
	> 但是Web应用不同，我们运行程序还需要具体的服务器支持
1. 将我们自己的Web应用的后端程序打包为`war`:`mvn clean package`->`MySerlvet.war`
2. 以`Tomcat`为例子：将`war`文件夹复制到`webapps`目录下，切换到`bin`中执行`startup.sh 或者 startup.bat`
3. 在浏览器中就可以通过`HTTP`访问后端

> 上述步骤启动的服务器后端，提供处理服务的`url`是`http://localhost:8080/myservlet/`，这里的`myservlet`是服务器中，这个应用的标识，最后的`/`才是路径。如果不想用应用名作为url一部分，可以将`war`包重命名为`ROOT.war`，这个服务器默认运行的应用

把类似于`Tomcat`这样的，实现`Servlet API`的服务器叫做容器，让浏览器访问服务器时，会根据url地址，找到对应的服务器应用，并且创建`Servlet`实例对象。
1. 创建的对象是唯一的，对象在处理请求的时候，通过多线程，所以要注意对象的属性的线程安全
2. 每一个线程执行`doXXX()`方法，传入的`HttpServletResponse`和`HttpServletRequest`作为局部变量使用，他们是不存在线程安全问题的
3. 如果`doXXX()`方法中，使用了`ThreadLocal`方法，需要及时`remove`清理，不然线程池复用线程处理任务时，有可能出错


## Servlet 开发

> [!PDF|note] [[Java教程-廖雪峰-2025-06-16.pdf#page=983&selection=15,0,29,9&color=note|Java教程-廖雪峰-2025-06-16, p.983]]
> > 1. 编写Servlet； 2. 打包为war文件； 3. 复制到Tomcat的webapps目录下； 4. 启动Tomcat。

> 上面的这个流程太复杂了，而且调试程序也特别麻烦

解决的方法就是使用嵌入式的Tomcat服务器，自己编写代码启动服务器

```Java
public class Main {  
    public static void main(String[] args) throws LifecycleException {  
        Tomcat tomcat = new Tomcat();  
        // 设置监听端口  
        tomcat.setPort(Integer.getInteger("port", 8080));  
        // 使用上面的配置作为连接器  
        tomcat.getConnector();  
  
        // 创建一个web应用  
        Context ctx = tomcat.addWebapp("", new File("src/main/webapp").getAbsolutePath());  
            // 上面这一行语句是制定了服务器寻找资源的文件路径，用于给浏览器返回网页资源，比如html、css、js、媒体资源  
            // contentPath 制定了浏览器访问的根路径，docBase 指定了服务器寻找请求资源的根路径  
        WebResourceRoot resource = new StandardRoot(ctx); // 让Tomcat服务器管理资源空间，包括应用资源，编译源码  
        resource.addPreResources(new DirResourceSet(resource, "/WEB_INF/classes", new File("target/classes").getAbsolutePath(), "/"));  
        ctx.setResources(resource);
        
        tomcat.start();  
        tomcat.getServer().await(); // 这一行相当于一个处理请求的死循环  
    }  
}
```

## Servlet 处理

配置好底层实现`Servlet API`的`Web`服务器之后，我们就只需要关注`Servlet`的处理逻辑。

1. 通过`@WebServlet(urlPatterns="")`注解类处理的请求路径
	1. 对于`@WebServlet(urlPatterns="/")`：会处理所有未匹配的请求访问路径，相当于 `switch-case`中`default`
2. 通过 `HttpServletRequest`、`HttpServletResponse`的接口，实现了之前面向传输层编程，处理应用层协议的数据格式很麻烦的问题
	1. `getMethod`
	2. `getRequestUrl`
	3. `getQueryString`：返回请求参数，比如“name=Bob&a=1”
	4. `getParameter(name)`：对于get，得到请求行中的参数，对于Post，得到请求体中参数
	5. `getContentType`
	6. `getContextPath`：当前应用在WebApp中的挂在路径，也就是引用名，对于ROOT，总是返回""
	7. `getCookies()`：得到所有Cookie
	8. `getHeaderNames`
	9. `getHeader(name)`
	10. `getInputStream`：以字节流方式读取请求体的内容
	11. `getReader`：字符方式打开
	12. `getRemoteAddress`
	13. `getScheme`：协议类型

	14. `setStatus`
	15. `setContentType`
	16. `setCharsetEncoding(charset)`
	17. `setHeader(name, value)`
	18. `addCookie(cookie)`
	19. `getOutputStream`
	20. `getWriter`
3. Servlet类是由容器创建的单例对象，所以需要使用类对象的属性，需要注意线程安全，比如使用锁，或者线程安全的集合

## 重定向

重定向分为两种，302 永久重定向，浏览器收到302的响应后，会把请求的路径和重定向的路径建立映射，存入本地缓存，之后再次发出请求时，就可以直接向重定向的路径请求。 301 临时重定向，没有缓存映射机制。

1. 302 重定向
	1. 准备好完整的再次请求的url（不用包含host,port,protocal）
	2. `resp.sendRedirect(newUrl)`
2. 301 重定向
	1. `resp.setStatus(HttpServletResponse.SC_MOVED_PERMANENTLY)` // 301
	2. `resp.setHeader("Location", "/hello")`重定位到hello

还有一种特殊的机制叫做转发，即一个处理类内部，将请求和响应的处理，都交给另外一个处理类
	`req.getRequestDispatcher("/hello").forward(req, resp)`

## Session 和 Cookie

服务器内部开辟内存，存放Session对象，Session内部保存用户的各类信息。
如何定位到特定的Session对象，通过Cookie实现。在初次调用`req.getSession`的时候，如果发现请求头中没有SESSION ID,就会创建一个，并且映射到一个具体的Session对象，附加在响应头中。
后续还是通过`req.getSession`，但是这时候有了ID，就可以直接定位了。

那么有了Session，怎么使用呢，很简单，`setAttribute()、getAttribute()`

Cookie除了作为Session的标识符，自己也可以充当信息的存储媒介，通过自定义Cookie `Cookie cookie = new Cookie("name" , "value")`，存放信息，还可以设置存放时间`cookie.setMaxAge(秒)`，设置生效的url前缀`cookie.setPath("/user")` 旨在user开头的请求中生效`
通过将自定义的Cookie加到响应头`resp.addCookie()`，使用时，通过名来读取`getCookie()`

其中，如果cookie设置加密的话`setSecure(ture)`，就需要用https协议来访问，因为http都是明文传输的

获取Cookie值：
1. 获取请求中所有的Cookie：`getCookies()`
2. 遍历`Cookie[]`
3. 通过`Cookie 的 getName` 方法判断名字 建议 equal
4. 通过`getValue`方法获取值

## JSP

现在，我们知道 `Servlet`类， 无非就是借助 `Tomcat`获取其他实现 `Servlet API` 接口的服务器，实现对HTPP请求和响应的处理。

如果我们想要在响应体中返回一个复杂的页面，会非常复杂，需要设置 `write` 写入的字符串，这个字符串拼接过程很麻烦
```Java
PrintWriter pw = resp.getWriter();
pw.write(...)
pw.flush
```

通过 `JSP` 我们可以解决这个问题，JSP就是 Java Serve Pages，Java 服务于页面。将 `.jsp` 文件放在 `webApp` 目录下，运行的时候，会将文件编译为 `Servlet` 类。

在文件内，具体的使用方式
1. 正常编写前端的代码
2. 支持嵌入Java代码，用 `<% 代码 %>`
3. 支持嵌入变量值，用 `<%= xxx %>`
	内嵌了几个变量：
	- out（`HttpServletResponse.getWriter()`）
	- session（会话的session）
	- request（当前的`HttpServletRequest`）
4. 导入Java类 `<%@ page import="类的包" %>` 这样在代码中直接通过类名，不需要完整包名
5. 导入别的 `jsp` 文件： `<%@ include file="文件名.jsp" %>`


## `MVC` 开发

> 考虑到：
> 1. 使用 `servlet` 类，可以进行业务逻辑处理，但是不适合返回 `html` 页面
> 2. 使用 `jsp` 文件，可以编写复杂页面，但是不适合处理业务逻辑

可以综合两者，也就是 `MVC` 开发，`Servlet`类作为控制器，操作具体的`JavaBean`，传给 `jsp` 进行页面编写，返回给浏览器进行 `View` 视图渲染。

实现方式：通过上面说过的转发
	`req.getRequestDispatcher("/hello").forward(req, resp)`
不过这次的转发对象，是 `WEB-INF` 目录下的 `jsp` 文件，浏览器无法直接访问这个目录内的文件，需要通过服务器分发请求，这保证了一定的安全性。
在分发之前，需要将使用的 `JavaBean` 传入请求，通过 `req.setAttribute("name", Object)` 设置， 在 `jsp` 中，通过 `<% (具体类型) request.getAttribute("name") %>` 来获取和使用

## `MVC` 高级开发

上面的这种 `MVC` 设计，让我们可以实现业务逻辑和复杂页面的编写。但是还存在一些缺陷

> [!PDF|] [[Java教程-廖雪峰-2025-06-16.pdf#page=1016&selection=21,0,25,34|Java教程-廖雪峰-2025-06-16, p.1016]]
> > Servlet提供的接口仍然偏底层，需要实现Servlet调用相关接口； JSP对页面开发不友好，更好的替代品是模板引擎； 业务逻辑最好由纯粹的Java类实现，而不是强迫继承自Servlet。
> 
> 已经很接近 Spring MVC 的设计了

^69d49f

![[Java教程-廖雪峰-2025-06-16.pdf#page=1018&rect=30,572,448,799|Java教程-廖雪峰-2025-06-16, p.1018]]
- 编写一个类，请求会根据 `url` 进入类的不同方法进行处理
- 一些参数的获取，不需要调用 `HttpServletRequest / Response` 的接口，可以直接在方法的参数中解析注入
- 方法返回 `ModelAndView`，解析后写入响应体
	- `Model` : 是存放实体对象的 `Map<String, Object>`
	- `View`  ：表示页面模板的路径

> 在这套框架下，我们用户要写的就是处理的 `Controller` 的方法

## Filter

在一套系统中，每一个请求都需要设置编码格式，可以选择在每一个Controller方法前编写，但是最好的方法时设置Filter，对请求进行拦截配置。和前端的拦截器差不多

1. 编写 `xxxFilter` 类，实现 `Filter` 接口
2. 类注解 `@WebFilter(urlPatterns="/*")` 
	1. `"/*"`:表示拦截所有请求
	2. `"/user/*"`:表示拦截所有 `/user/`开头的请求
3. 类实现 `doFilter(ServletRequest req, ServletResponse resp, FilterChain chain)` 方法，在方法中进行处理
4. 如果想要在一个拦截器处理完，交给下一个拦截器链式处理，需要在方法中调用 `chain.doFilter(req, resp)`
5. 拦截器的处理顺序需要在 `web.xml` 文件中配置， 服务器会检查配置文件，设置好顺序
6. 当方法中，没有调用 `chain.doFilter`，那就需要如下处理
	1. 请求转发，`req.getRequestDispatcher().forward(req,resp)`
	2. 直接修改响应数据，`resp.setContentType() resp.getWriter.write()`
	3. 重定向，比如拦截到没有登录的请求，重定位到登陆 `req.sendRequest("")`

## Servlet 拦截器中的流重读与响应缓存

在 Servlet 生命周期中，由于 `HttpServletRequest` 的输入流（Input Stream）和 `HttpServletResponse` 的输出流（Output Stream）默认都是**一次性**的，在需要对请求/响应内容进行多次读取或二次加工（如：全量日志打印、加解密、HTML 压缩）时，必须通过“包装类”接管流。

---

### 1. 核心痛点：流的单次读写特性

- **读取痛点**：`ServletInputStream` 是基于网络套接字的原始流，指针只能向前移动一次。若在 `Filter` 中读取了 Body，后续 `Servlet` 拿到的流将为空。
    
- **写入痛点**：`HttpServletResponse` 的输出直接指向 Socket 缓冲区。一旦数据写入，就会被立即发往网络，拦截器无法截获内容进行修改。
    

---

### 2. 请求端：`ReReadableHttpServletRequest` 实现

通过在构造函数中预读所有字节，并重写 `getInputStream` 返回一个从内存数组中读取的新流，实现“复活”。

#### 实现代码


```Java
class ReReadableHttpServletRequest extends HttpServletRequestWrapper {
    private byte[] body; // 缓存字节数组
    private boolean open = false; // 流状态标记

    public ReReadableHttpServletRequest(HttpServletRequest request, byte[] body) {
        super(request);
        this.body = body; // 外部读取后传入或在此初始化
    }

    @Override
    public ServletInputStream getInputStream() throws IOException {
        if (open) { throw new IllegalStateException("Cannot re-open input stream!"); }
        open = true;
        return new ServletInputStream() {
            private int offset = 0;
            @Override
            public boolean isFinished() { return offset >= body.length; }
            @Override
            public boolean isReady() { return true; }
            @Override
            public void setReadListener(ReadListener listener) {}
            @Override
            public int read() throws IOException {
                if (offset >= body.length) return -1;
                return body[offset++] & 0xff;
            }
        };
    }
}
```

---

### 3. 响应端：缓存响应内容截获

核心在于“调包” `HttpServletResponse`，让下游组件将内容写入我们预设的 `ByteArrayOutputStream`。

#### 实现代码（核心逻辑）


```Java
class CachedResponseWrapper extends HttpServletResponseWrapper {
    private ByteArrayOutputStream output = new ByteArrayOutputStream(); // 内存容器

    public CachedResponseWrapper(HttpServletResponse response) {
        super(response);
    }

    @Override
    public ServletOutputStream getOutputStream() {
        return new ServletOutputStream() {
            @Override
            public void write(int b) { output.write(b); }
            // 实现其他必要存根方法...
        };
    }

    @Override
    public PrintWriter getWriter() {
        return new PrintWriter(new OutputStreamWriter(output, StandardCharsets.UTF_8));
    }

    public byte[] getContents() {
        return output.toByteArray(); // 供 Filter 拿回内容
    }
}
```

---

### 4. 过滤器中的组件装配逻辑

在 `doFilter` 中执行“偷梁换柱”，这是机制生效的前提条件。


```Java
public void doFilter(ServletRequest req, ServletResponse resp, FilterChain chain) {
    // 1. 包装 Request（支持重复读）
    byte[] body = req.getInputStream().readAllBytes();
    ReReadableHttpServletRequest reqWrapper = new ReReadableHttpServletRequest((HttpServletRequest) req, body);
    
    // 2. 包装 Response（截获输出）
    CachedResponseWrapper respWrapper = new CachedResponseWrapper((HttpServletResponse) resp);

    // 3. 传入包装后的对象，而非原始对象
    chain.doFilter(reqWrapper, respWrapper); 

    // 4. 获取被下游组件（Servlet/Controller）写入的内容并加工
    byte[] data = respWrapper.getContents();
    // 此时可以进行压缩、替换等操作，最后再通过原始 resp 写出
    resp.getOutputStream().write(data);
}
```

---

### 5. 注意事项与最佳实践

- **内存泄露风险**：所有数据均缓存在 `byte[]` 中。对于文件上传等大数据请求，必须在 `Filter` 中先检查 `Content-Length`，严禁全量缓存超过阈值（如 2MB）的报文。
    
- **状态标记**：`open` 变量可以防止流被重复开启导致状态异常，符合 Servlet 规范的安全要求。
    
- **编码转换**：在 `getReader()` 和 `getWriter()` 中，务必使用 `StandardCharsets.UTF_8` 保持编码一致，防止中文乱码。

## `Listener` 监听器组件

该组件核心是通过回调函数的设计，以类似发布-订阅的模式，实现 `Web` 服务器完成特定事件后，触发回调通知，组件内定义的回调函数会自动执行。

1. 类注解 `@WebListener`
2. 类实现接口，重写对应的方法

以 `ServeltContextListener` 接口为例，实现的 `contextInitialized(ServletContextEvent sce)` 和 `ContextDestoryed(ServletContextEvent sce)` 两个方法，分别是 `Web` 服务器初始化之后和关闭之后的回调函数

初次之外，还有几种接口![[Java教程-廖雪峰-2025-06-16.pdf#page=1044&rect=29,69,525,215|Java教程-廖雪峰-2025-06-16, p.1044]]