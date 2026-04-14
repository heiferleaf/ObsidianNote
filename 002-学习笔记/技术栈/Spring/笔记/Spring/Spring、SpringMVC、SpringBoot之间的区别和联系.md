---
created: 2026-03-02
modified: 2026-03-02
---

## Spring

Spring 是一个 Java 的企业级应用开发框架，集成了 IOC、DI、AOP、事务管理 等功能

## Spring MVC

MVC 是 Spring 中的一个重要模块，主要适用于 Web 网络应用的开发，旨在通过 Spring， 快速搭建一个 MVC 框架，其中M：Model（模型），V：View（视图），C：Controller（控制器）。通过MVC框架，实现业务逻辑、数据、显示渲染进行分离。

> Spring 中提供了一个 Servlet 的实现类 org.springframework.web.servlet.DispatcherServlet
> 作为前端的控制器使用，处理通过的逻辑业务，并且将请求分发到具体的 controller 中。
> 这个类通常被当作 Spring MVC 使用的容器，作为 IOC 容器的一个子容器，内部在初始化的时候注册组件 controller、HandlerMapping、HandlerAdapter、ViewResolver、拦截器、消息转换器（MessageConvert） 等等


在 Spring MVC 中，通过 controller 作为控制器，负责业务逻辑（底层通过三层框架），获得得到的 Model 数据，交给具体的视图 View 进行渲染。
可以通过各种注解，实现Controller对于业务参数的解耦获取，不依赖 servlet 复杂的 API


## Spring Boot

Spring Boot 是基于 Spring 发展出来的一个框架，延续了 IOC 和 DI 的特点，同时大大简化了Spring的开发流程，具体体现在内置的Tomcat服务器，全注解配置等等


