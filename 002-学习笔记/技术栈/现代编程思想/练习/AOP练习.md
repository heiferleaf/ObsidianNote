---
created: 2026-04-03
modified: 2026-04-03
---
# Spring AOP 练习题

---

## 一、选择题

### 1. 下列关于 AOP 的说法正确的是：A
A. AOP 本质是代理技术  
B. AOP 本质是方法调用增强机制  
C. AOP 只能用于日志  
D. AOP 不依赖运行时  

---

### 2. 下列哪个对象负责推进调用链： C
A. Interceptor  
B. Advisor  
C. MethodInvocation  
D. JoinPoint  

---

### 3. `@Pointcut` 方法的本质是：C
A. 普通业务方法  
B. 一定会被执行的方法  
C. 切点表达式的命名别名  
D. Controller 方法  

---

### 4. 如果 `@Around` 通知中没有调用 `proceed()`：C
A. 程序一定编译失败  
B. 目标方法会执行两次  
C. 目标方法不会执行  
D. 对结果没有影响  

---

## 二、简答题

### 1. 什么是 JoinPoint？什么是 Pointcut？二者的本质区别是什么？

- JoinPoint 是Spring AOP 在运行时封装的实例，包含被代理方法对象，调用方法，方法参数，所有需要执行的Advisor方法（执行链形式组织），这些上下文信息。是在AOP代理后的对象调用方法时产生的。
- PointCut 是静态的匹配规则，在编译的时候就唯一确定。作用是在JoinPoint包含的上下文信息中，匹配被使用的Advisor中的方法

要求：
- 不能只写教材定义
- 必须从“运行时对象”和“匹配规则”的角度说明

---

### 2. 为什么说 Spring AOP 的执行机制本质上体现了责任链模式？

要求：
- 结合 `Interceptor`、`MethodInvocation`、`proceed()` 说明
- 不能只回答“因为有链”

`Interceptor`  会在 `MethodInvocation` 以链的形式进行组织。体现为：`MethodInvation` 的 `proceed()` 方法中，顺序执行 `Interceeptor` ，每一个 `Interceptor`  再通过调用 `MethodInvation` 的 `proceed()`，把链的执行控制权交回给 MethodInvation。
每一个 Interceptor 执行自己增强逻辑的时机，可以是调用 proceed 之前，对应 before，可以是之后，对应 after-return，可以是在抛出异常的处理中，对应 after-throw，可以是在finally语句块中，对应after ...


---

### 3. 为什么 Spring AOP 必须借助代理机制？如果不用代理，是否还能做到“在不修改原代码的前提下增强方法调用”？

- 代理作为"中间人"接管方法调用，在不修改原始代码的前提下构建拦截器链；
- 不用代理也可以：AspectJ 编译期织入或类加载期织入均可做到，但需要特殊编译器/Agent；
- Spring 选择代理是因为简单、无需改构建流程、与容器集成好，代价是无法拦截 self-invocation 和非 public 方法。

要求：
- 说明代理在 AOP 中的作用
- 可以从“拦截方法调用”角度展开

---

## 三、执行顺序题

已知某切面同时定义了如下四类通知：

```java
@Before
@AfterReturning
@AfterThrowing
@Around
```

### 1. 当目标方法正常返回时，写出完整执行顺序。

**正常返回**：`@Around前` → `@Before` → 目标方法 → `@AfterReturning` → `@Around后`


---

### 2. 当目标方法抛出异常时，写出完整执行顺序。

**抛出异常**：`@Around前` → `@Before` → 目标方法（抛异常）→ `@AfterThrowing` → `@Around后`（若未捕获则不执行）

---

### 3. 请不要只写“先后顺序”，再用“调用栈嵌套”的方式简要画出其执行结构。

```
→ @Around 前半段
  → @Before
    → 目标方法
    ← 目标方法返回
  ← @AfterReturning（正常）/ @AfterThrowing（异常）
← @Around 后半段
```


---

## 四、代码分析题

阅读下列代码：

```java
public Object proceed() throws Throwable {
    if (index == interceptors.size()) {
        return method.invoke(target, args);
    }

    MethodInterceptor interceptor = interceptors.get(index++);
    return interceptor.invoke(this);
}
```

回答下列问题：

### 1. `index` 的作用是什么？

保证执行链的推进

### 2. 为什么这里要写 `index++`，而不是只写 `index`？

具体的 Interceptor 只负责执行自己的逻辑，然后将控制权交回给 MethdoInvacation ，不负责 index++， 如果这里不写 `index++`。会陷入无限函数调用，最后 StackOverflow

### 3. 如果去掉 `index++`，可能会出现什么问题？

会陷入无限函数调用，最后 StackOverflow

### 4. 该代码体现了什么设计思想或设计模式？请说明理由。

体现了责任链的设计模式，所有的Interceptor组成执行链，MethodInvocation 负责控制执行链的推进

---

## 五、综合分析题

阅读下列代码：

```java
@Around("execution(* com.example.service.*.*(..))")
public Object around(ProceedingJoinPoint jp) throws Throwable {
    System.out.println("A");
    Object r = jp.proceed();
    System.out.println("B");
    return r;
}

@Before("execution(* com.example.service.*.*(..))")
public void before() {
    System.out.println("C");
}

@AfterReturning("execution(* com.example.service.*.*(..))")
public void afterReturning() {
    System.out.println("D");
}
```

假设目标方法本身会输出：

```java
System.out.println("TARGET");
```

请回答：

### 1. 最终控制台完整输出顺序是什么？

```
A
C
TARGET
D
B
```

### 2. 请解释为什么会是这个顺序。

**原因**：@Around 前半段先输出 A，然后 proceed() 进入链；@Before 输出 C；链末调用目标方法输出 TARGET；正常返回触发 @AfterReturning 输出 D；控制权回到 @Around 输出 B。

---

## 六、改错题

阅读下列代码：

```java
@Around("execution(* com.example.service.*.*(..))")
public Object test(ProceedingJoinPoint jp) throws Throwable {
    System.out.println("start");
    System.out.println("end");
    return null;
}
```

回答下列问题：

### 1. 这段代码的核心问题是什么？

### 2. 该问题会导致什么结果？

### 3. 请写出修改后的正确版本。

1. **问题**：没有调用 `jp.proceed()`，调用链在此终止。
2. **结果**：目标方法永不执行，返回 null，业务静默失效。
3. **修正**：

```java
@Around("execution(* com.example.service.*.*(..))")
public Object test(ProceedingJoinPoint jp) throws Throwable {
    System.out.println("start");
    Object result = jp.proceed(); // 推进链
    System.out.println("end");
    return result; // 返回真实结果
}
```

---

## 七、设计题（10 分）

请设计一个“简易版 AOP 调用链模型”，至少包含以下两个核心角色：

1. `MethodInterceptor`
2. `MethodInvocation`

要求：

- 支持多个 interceptor 组成调用链
- 支持通过 `proceed()` 推进执行
- 最终能够调用目标方法
- 写出核心代码结构即可，不要求完整可运行

```java

interface MethodInterceptor {
	public Object invoke(MethodInvation invocation);
}

class Interceptor1 implements {
	// before 类型的advice
	public Object invoke(MethodInvation invocation) {
		doSomrthing();
		return invacation.proceed();
	}
	
	private Object doSomething() {
		...
	}
}

class Interceptor2 implements {
	// after 类型的advice
	public void invoke(MethodInvation invocation) {
		try {
			invacation.proceed();
		} catch(Exception e) {
		
		} finally {
			doSomething();
		}
	}
	
	private void doSomething() {
		...
	}
}

class MethodInvacation {
	private Object target;
	private Object proxy;
	private Method method;
	private Object[] args;
	private List<Interceptor> interceptors;
	
	private int index = -1;
	
	public MethodInvacation(Object t, Object p, Method m, Object[] args, List<Interceptor> is) {
		this.target = t;
		this.proxy  = p;
		this.m      = m;
		this.args   = args;
		this.interceptors = is;
	}
	
	public Object proceed() {
		index++;
		if(index < interceptors.size()) {
			Object result = interceptors.get(index).invoke();
			if(result == target) {
				return proxy;
			}
			return result;
		}
		Object result = method.invoke(target, args);
		if(result == target) {
			return proxy;
		}
		return result;
	}
}

```


---

## 八、附加思考题

### 1. 为什么说 `@Around` 是最强大的通知？

### 2. 一个目标方法如果同时匹配多个 Advisor，会发生什么？

### 3. `@Pointcut` 空方法为什么不会被执行，却仍然有意义？

- **@Around 最强大**：唯一可阻止目标方法执行、修改参数/返回值、吞掉异常的通知。
- **多 Advisor 匹配**：所有 Interceptor 组入同一条链，执行顺序由 `@Order` 控制，未指定则顺序不确定。
- **@Pointcut 空方法的意义**：方法体不执行，Spring 只读取注解表达式，方法签名作为别名供复用，提升切点的可读性、复用性和可组合性。

---

> 请在答题时注意：  
> 不要只背结论，应尽量从“调用链、代理、运行时机制”的角度分析。
