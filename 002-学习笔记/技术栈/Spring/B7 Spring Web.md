---
created: 2026-02-21
modified: 2026-03-01
---

# JavaWeb 核心基础

在传统的 Java Web 开发中，存在三个最核心的组件：

| 组件名称 | 作用描述 | 运行特点 |
| :--- | :--- | :--- |
| **Servlet** | 服务器端组件，负责接收客户端请求并进行响应。 | **单例模式**。默认在第一次访问时创建。由容器管理生命周期。创建后执行 `init()` 方法。每个 Servlet 都有 `service()` 方法负责处理具体请求。 |
| **Filter** | 过滤器，对客户端请求进行拦截与过滤操作。 | **单例模式**。服务器**启动时即实例化**。对象创建完毕后执行 `init()` 方法。核心逻辑位于 `doFilter()` 方法中。 |
| **Listener** | 监听器，监听服务器端的特定事件。 | 按类型分为：**监听对象创建/销毁**、**监听对象属性变化**。<br>按域分类：**Request 域**、**Session 域**、**ServletContext 域**。 |

### 在 JavaWeb 中引入 Spring IoC 容器
为了在 Web 环境中使用 Spring，需要将 IoC 容器构造出来并存入 `servletContext` 中。有两种手动实现方式：
1.  在 Servlet 的 `init()` 方法中构造。
2.  在 `ServletContextListener` 的服务器上下文初始化方法中构造。

**框架封装后的实现方案：**
Spring 提供了 `ContextLoaderListener` 监听器来自动化此过程。在 `web.xml` 中配置：
```xml
<listener>  
    <listener-class>org.springframework.web.context.ContextLoaderListener</listener-class>  
</listener>
```

**容器初始化顺序与规则：**
1.  **检查 `contextClass` 参数**：若 `web.xml` 中指定了该参数，容器将使用指定的类作为 IoC 容器。例如指定一个继承了 `AnnotationConfigWebApplicationContext` 的类，实现基于注解的配置。
2.  **默认 XML 配置方案**：若未指定上述参数，则创建基于 XML 的 `WebApplicationContext`。此时必须通过 `contextConfigLocation` 指定配置文件路径：
```xml
<context-param>  
    <param-name>contextConfigLocation</param-name>  
    <param-value>classpath:tx.xml</param-value>  
</context-param>
```

> [!IMPORTANT] **解耦原理**
> `<context-param>` 中的变量值通过 `servletContext.getInitParameter()` 获取。这种方式使容器创建与配置文件路径解耦，无需在代码中硬编码配置文件名。

---

# 从 Java Web 进化到 Spring MVC

Spring MVC 的核心思想是使用**中央调度**和**注解驱动**，将业务逻辑从复杂的 Servlet 环境中剥离。

1.  **一个中心：DispatcherServlet（中央枢纽）**
    *   精髓：**变“多点接入”为“统一分发”**。
    *   概括：改变了每个请求对应一个 Servlet 的混乱局面。所有请求由 `DispatcherServlet` 统一接收，再分发给具体的 Controller。

2.  **解耦一：API 剥离（POJO 化）**
    *   精髓：**让 Controller 不再是 Servlet**。
    *   概括：Controller 不再需要继承 `HttpServlet`，摆脱了 `request` 和 `response` 的束缚，变成了 **POJO（普通 Java 类）**。代码更易于进行不依赖服务器的单元测试。

3.  **解耦二：参数自动化（自动化装配）**
    *   精髓：**变“手动搬运”为“自动投递”**。
    *   概括：无需手动 `getParameter` 或繁琐的类型转换，Spring 自动将数据绑定到方法参数上。

4.  **解耦三：视图逻辑化（逻辑视图）**
    *   精髓：**变“物理路径”为“逻辑代号”**。
    *   概括：Controller 只返回字符串代号（如 `"user"`），具体的物理路径和页面技术在配置文件中灵活定义，修改后缀或路径无需变动代码。

---

# Spring MVC 核心运行机制

### 核心组件
Spring MVC 作为 Spring 的子组件，以 `DispatcherServlet` 为核心，内部整合了以下组件：
*   **处理器映射器 (HandlerMapping)**
*   **处理器适配器 (HandlerAdapter)**
*   **视图解析器 (ViewResolver)**

![[QQ_1771742083481.png]]
![[QQ_1771745645105.png]]

**初始化逻辑：**
`DispatcherServlet` 初始化时会自动加载关键组件。
*   如果用户在容器中自定义了 `HandlerMapping` 类型的 Bean，则使用自定义组件。
*   否则，采用默认策略加载三种映射器：`BeanNameUrlHandlerMapping`、`RequestMappingHandlerMapping`、`RouterFunctionMapping`。

---

# 请求路径与参数获取

### 路径配置注解
| 相关注解 | 作用 | 使用位置 |
| :--- | :--- | :--- |
| **@RequestMapping** | 设置访问路径，接收任意类型的 HTTP 请求。 | 方法、类 |
| **@GetMapping** | 设置访问路径，仅限 **GET** 请求。 | 方法、类 |
| **@PostMapping** | 设置访问路径，仅限 **POST** 请求。 | 方法、类 |

> [!NOTE] **继承关系**
> 若类上标注了请求类型注解，其内部方法也会继承该类型限制。类上的路径注解相当于该类下所有方法的**访问前缀**。

### 请求参数获取详解

1.  **基础映射**：使用 `@RequestParam(value = "请求参数名")` 将请求中的键映射到方法变量上。
2.  **必填约束**：`required = true`（默认）。若请求中缺失该参数，系统会报错。若参数可选，应设为 `false`。
3.  **默认值设置**：`defaultValue` 常用于分页参数，防止参数缺失导致异常。
4.  **绑定集合或数组**：当同一参数名有多个值时（如 `ids=1&ids=2`），使用 `List` 或数组接收。==注意：使用集合接收时必须添加 @RequestParam 注解。==
5.  **接收所有参数**：使用 `Map<String, String>` 配合 `@RequestParam` 可获取所有动态参数。
6.  **基本类型与包装类**：
    *   若参数可能为空且未设默认值，必须使用包装类（如 `Integer`）。
    *   ==注意：若使用 int 类型接收 null，会抛出 500 异常。==
7.  **@PathVariable 对比**：
    *   `@RequestParam`：接收查询字符串（问号后的数据，如 `?id=1`）。
    *   `@PathVariable`：接收路径变量（路径的一部分，如 `/user/1`）。

---

# 进阶数据处理

### 获取请求体中的 Json 数据
若为 `raw` 类型数据，可通过 `@RequestBody String raw` 接收。对于 Json 对象，有以下配置方式：

**1. 基于 XML 的显式配置：**
需要引入 `jackson-databind` 依赖。
*   配置 `MappingJackson2HttpMessageConverter`（翻译官）。
*   将转换器注入 `RequestMappingHandlerAdapter` 的 `messageConverters` 属性中（调度员）。

**2. 自动注入方式（推荐）：**
配置 `<mvc:annotation-driven />`。它会自动检查 classpath 下是否存在 Jackson 包，若存在则自动创建并注入转换器。

**3. 配置类方式：**
使用 `@EnableWebMvc` 注解，其效果等同于 XML 中的 `annotation-driven`。

### 其他请求数据获取
*   **请求头**：`@RequestHeader(value = "headerName")` 或使用 Map 接收。
*   **Cookie**：`@CookieValue`。
*   **域属性**：`@RequestAttribute`（获取请求域中的数据）。

---

# 静态资源访问方案

**问题背景**：`DispatcherServlet` 的 `mapping-path` 若配置为 `/`，会拦截所有请求，包括静态资源（img, js, css），但它无法处理这些资源。

**三种解决方案：**
1.  **手动映射**：在 `web.xml` 中配置 Tomcat 原生的 `default` Servlet。
2.  **Spring 映射**：使用 `<mvc:resources mapping="/img/**" location="/img/"/>`。
3.  **自动处理（推荐）**：使用 **`<mvc:default-servlet-handler>`**。
    *   其内部会注册一个处理器映射器。
    *   ==注意：这会导致默认映射器失效，必须配合 `<mvc:annotation-driven />` 使用。==

---

# 响应数据处理

1.  **传统方式（视图渲染）：**
    *   **转发**：返回 `String` 默认为转发，如 `return "hello.jsp"`。
    *   **重定向**：使用 `redirect:` 前缀，如 `return "redirect:index.jsp"`。
    *   **ModelAndView**：通过 `addObject` 添加模型数据。
2.  **现代方式（数据交互）：**
    *   响应 JSON 字符串给调用者（如 Ajax）。
    *   必须使用 `@ResponseBody` 注解，配合 `<mvc:annotation-driven>` 实现对象到 JSON 的自动转换。
    *   **@RestController** 是 `@ResponseBody` 与 `@Controller` 的组合注解。

---

# 拦截器 (Interceptor)

拦截器是 Spring MVC 提供的技术，用于在进入 Controller 前对请求进行拦截。

**与 Filter 的区别**：调用时机不同。
![[QQ_1772350398431.png]]

**HandlerInterceptor 接口核心方法：**

| 方法名称 | 作用描述 | 参数说明 | 返回值含义 |
| :--- | :--- | :--- | :--- |
| **preHandle** | 预处理，执行处理器方法前调用。 | `handler`：目标处理器。 | `true` 放行；`false` 终止后续执行（不再执行后置方法，仅执行已放行拦截器的 `afterCompletion`）。 |
| **postHandle** | 后处理，处理器执行后调用。 | `modelAndView`：可修改模型和视图。 | 无 |
| **afterCompletion** | 最终处理，视图渲染完成后调用。 | `ex`：异常对象，可进行异常处理。 | 无 |

**多拦截器执行顺序：**
*   正常流程：
![[QQ_1772351288181.png]]
*   当某拦截器 `preHandle` 返回 `false`：
![[QQ_1772351374140.png]]

---

# 使用全注解配置

> 在之前的流程中，配置的xml包含
> 1. 容器配置
> 	1. 组件扫描：\<context:component-scan>
> 	2. HandlerAdapter 和 MappingJackson2HttpMessageConverter 的配置（可以通过 <mvc:annotation-driven> 代替）
> 	3. 针对静态资源的请求 <mvc:default-servlet-handler>
> 	4. 对于拦截器 Interceptor 的配置
> 2. Web服务器配置
> 	1. 监听器Listener \<ContextLoaderListener>，用于自动配置 IOC 容器
> 	2. \<context-param> 配置容器使用 xml 文件或者自定义的注解容器类路径
> 	3. Servlet：包含DispatcherServlet
> 	4. Servlet 的 mapping 映射

## @EnableWebMvc 原理剖析

注解内部通过 @Import， 将 DelegatingWebMvcConfiguration 注册为Bean，这个Bean是 WebMvcConfigurationSupport 类的子类，内部的方法通过@Bean注解，将 RequestMappingHandlerMapping等组件 注册为Bean。

此外，DelegatingWebMvcConfiguration 提供方法
```java
@Autowired(  
    required = false  
)  
public void setConfigurers(List<WebMvcConfigurer> configurers) {  
    if (!CollectionUtils.isEmpty(configurers)) {  
        this.configurers.addWebMvcConfigurers(configurers);  
    }  
  
}
```
将容器中的 WebMvcConfigurer 类以及子类的 Bean，注册到配置中，接着就可以通过配置和 @Bean 方法，创建具体的 Bean，比如在 实现 WebMvcConfigurer 的 configureDefaultServletHandling 方法中，通过config.enable() 方法，开启默认servlet处理器，之后的 @Bean 方法就会把具体的处理器注册到 Bean 中

## web.xml 的取代

在全注解开发中，Spring 提供了 WebApplicationInitializer 接口。当 Web 容器（如 Tomcat）启动时，会自动扫描实现该接口的类并调用其方法。

为了简化操作，Spring 进一步提供了 **AbstractAnnotationConfigDispatcherServletInitializer** 抽象类。

### 1. 替换 web.xml 的核心实现

你需要创建一个类继承该抽象类，并重写以下三个核心方法：


```java
public class MyWebAppInitializer extends AbstractAnnotationConfigDispatcherServletInitializer {

    // 1. 指定 Root 容器（父容器）的配置类：通常包含 Service、DAO、DataSource 等
    @Override
    protected Class<?>[] getRootConfigClasses() {
        return new Class<?>[] { RootConfig.class };
    }

    // 2. 指定 Servlet 容器（子容器）的配置类：通常包含 Controller、ViewResolver 等
    @Override
    protected Class<?>[] getServletConfigClasses() {
        return new Class<?>[] { WebConfig.class };
    }

    // 3. 指定 DispatcherServlet 的映射路径，等同于 <servlet-mapping>
    @Override
    protected String[] getServletMappings() {
        return new String[] { "/" };
    }

    // 4. (可选) 配置过滤器，如 CharacterEncodingFilter
    @Override
    protected Filter[] getServletFilters() {
        CharacterEncodingFilter encodingFilter = new CharacterEncodingFilter();
        encodingFilter.setEncoding("UTF-8");
        encodingFilter.setForceEncoding(true);
        return new Filter[] { encodingFilter };
    }
}
```

> [!NOTE] **底层原理**  
> 该类内部会自动创建 ContextLoaderListener（父容器）和 DispatcherServlet（子容器），实现了 web.xml 中所有 \<listener> 和 \<servlet> 标签的功能。

1. **Servlet 3.0+ 规范**：规定服务器（如 Tomcat）在启动时，会扫描所有 JAR 包下的 META-INF/services/jakarta.servlet.ServletContainerInitializer 文件。
    
2. **Spring 的实现**：在 spring-web 的 JAR 包中，确实存在这样一个文件，它指向了 Spring 定义的 SpringServletContainerInitializer 类。
    
3. **类扫描**：这个 Spring 的初始化类会进一步在你的代码中寻找 **WebApplicationInitializer** 接口的实现类。
    
4. **自动触发**：当你定义的 AbstractAnnotationConfigDispatcherServletInitializer 类（它是该接口的实现）被扫描到时，Tomcat 就会自动调用它内部的方法