---
created: 2026-03-04
modified: 2026-03-04
---
1. 起步依赖通过maven的依赖管理机制，将模块的相关依赖，仅通过一个依赖包含进来，便于版本的管理，防止依赖之间发生冲突
2. 通过起步依赖，可以实现开发的模块化，比如数据库访问，消息对列，web开发
3. Spring Boot 通过自动化配置，通过解析引入的依赖，自动对相关的Bean进行装配

> [!NOTE] 关于 3 自动装配的说明
> ![[QQ_1772623788208.png]]


Spring 通过 @EnableAutoConfiguration 开启自动配置， 将 spring。factories 中的内容进行注册 ==注意的是，在Spring 3 之后，注册类文件在META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports 中==。
根据 各个自动配置类的@Conditional注解，按照是否有starter起步依赖，是否有对应配置文件的配置信息，是否已经手动注册为容器中的Bean，将对应的框架自动配置类注册为Bean，以完成自动配置。
> 比如把WebMVC框架的自动配置类 WebMvcAutoConfiguration 注册为Bean，可以自动配置静态资源处理的servlet，dispatcher中的各个组件


