---
created: 2026-02-05
modified: 2026-02-05
---
## 加载过程

1. 初始化阶段：将 .class 字节码文件，通过classLoader，加载进入方法区，同时在堆区生成对应的Class对象，指向类信息
2. 验证字节码合法性
3. 分配类的静态成员的内存空间
4. 将常量池中的方法和字段引用指向真实的地址
5. 初始化静态字段，执行静态代码块

## 类加载器

1. 核心类加载器（BootStrap ClassLoader）:加载JDK核心类
2. 拓展类加载器（Extension ClassLoader）:加载拓展类（ext目录）
3. 应用类加载器（Application ClassLoader）:加载用户编写的类和第三方依赖

